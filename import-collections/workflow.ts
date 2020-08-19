import {
  createAdminQueryable,
  createYieldableQuery,
  GraphQLQueryable,
} from "./graphql.ts";
import {
  currentBulkOperation,
  CurrentBulkOperation,
  BulkQuery,
  BulkQueryResponse,
  createBulkQuery,
  collectionBulkQuery,
  BulkCollection,
  ID,
  BulkCollectionProduct,
  BulkCollectionTypes,
} from "./queries.ts";

type Jsonl = string;
type CollectionHandle = string;
type ProductHandle = string;

// domain object types

export type Collection = {
  type: "collection";
  handle: CollectionHandle;
  title: string;
  description: string;
};

export type CollectionProduct = {
  type: "product";
  collection: CollectionHandle;
  handle: ProductHandle;
};

export type Object = Collection | CollectionProduct;

// bulk operation graphql

const createBulkOperation = (adminQuery: GraphQLQueryable) =>
  async (query: BulkQuery) => {
    const graphQl = createBulkQuery(query);

    const { bulkOperationRunQuery: { bulkOperation, userErrors } } =
      await adminQuery<BulkQueryResponse>(graphQl);

    if (userErrors.length) {
      console.error(userErrors);
      throw new Error("Could not create bulk query");
    }

    return bulkOperation;
  };

const getBulkOperationUrlWhenReady = async (
  bulkOperationYieldable: AsyncGenerator<CurrentBulkOperation, void, unknown>,
) => {
  for await (const result of bulkOperationYieldable) {
    const { currentBulkOperation } = result;
    console.log(currentBulkOperation.status);
    if (currentBulkOperation.status === "COMPLETED") {
      return currentBulkOperation.url;
    }
  }
  throw new Error("Bulk operation not for awaitable");
};

// file downloading

const download = async <T extends string>(url: string) => {
  const response = await fetch(url);
  return await response.text() as T;
};

// node type

type Node = { id: ID };
export enum NodeType {
  Collection,
  Product,
}

export const getNodeType = (id: ID): NodeType => {
  const match = id.match(/gid:\/\/shopify\/(\w+)\/.*/);
  if (!match) throw new Error(`Could not get type from id ${id}`);
  return NodeType[match[1] as keyof typeof NodeType];
};

// parse into correct types

const parseJson = (json: string) => JSON.parse(json) as BulkCollectionTypes;

// mappers

export const mapCollection = (bulkCollection: BulkCollection): Collection => ({
  type: "collection",
  handle: bulkCollection.handle,
  title: bulkCollection.title,
  description: bulkCollection.descriptionHtml,
});

/**
 * @param collectionHandles Map (object) of collection ids to handles
 */
export const mapCollectionProduct = (
  collectionHandles: { [id: string]: string },
) =>
  (bulkCollectionProduct: BulkCollectionProduct): CollectionProduct => ({
    type: "product",
    handle: bulkCollectionProduct.handle,
    collection: collectionHandles[bulkCollectionProduct.__parentId],
  });

const objectToDomain = (
  mapCollectionProduct: (
    bulkCollectionProduct: BulkCollectionProduct,
  ) => CollectionProduct,
) =>
  (obj: Node): Object => {
    switch (getNodeType(obj.id)) {
      case NodeType.Collection:
        return mapCollection(obj as BulkCollection);
      case NodeType.Product:
        return mapCollectionProduct(obj as BulkCollectionProduct);
    }
  };

// filters

const filterType = (type: NodeType) =>
  (obj: Node) => getNodeType(obj.id) === type;

const filterPublished = (obj: { publishedOnCurrentPublication: boolean }) =>
  obj.publishedOnCurrentPublication;

// collection handle map getter

export const collectionHandleReducer = (
  collectionHandles: { [id: string]: string },
  collection: BulkCollection,
) => {
  return {
    ...collectionHandles,
    [collection.id]: collection.handle,
  };
};

// jsonl to domain object

export const jsonlToObjects = (jsonl: Jsonl): Object[] => {
  const parsed = jsonl
    .split("\n")
    .filter(Boolean)
    .map(parseJson)
    .filter(filterPublished);
  const collectionHandles = parsed
    .filter(filterType(NodeType.Collection))
    .map((obj) => obj as BulkCollection)
    .reduce<{ [id: string]: string }>(collectionHandleReducer, {});
  const mapProduct = mapCollectionProduct(collectionHandles);
  return parsed.map(objectToDomain(mapProduct));
};

// domain object to content dto

const objectToContent = (obj: Object) => {
  // todo: remove type from frontmatter?
  // const { type, ...rest } = obj;
  switch (obj.type) {
    case "collection":
      return {
        ...obj,
        layout: "collection",
        main: [
          {
            template: "products",
            collection: obj.handle,
          },
        ],
      };
    case "product":
      return {
        ...obj,
        // todo: set type to products?
      };
  }
};

// file handling

type File = {
  filepath: string;
  contents: string;
};

const serializeObject = (stringifier: (obj: object) => string) =>
  (obj: Object): File => ({
    filepath: obj.type === "product"
      ? `${obj.collection}/products/${obj.handle}.md`
      : `${obj.handle}/_index.md`,
    contents: `---\n${stringifier(obj)}\n---`,
  });

const writeFileToDir = (dir: string) =>
  async (file: File) => {
    const path = `${dir}/${file.filepath}`;
    await Deno.mkdir(dirname(path), { recursive: true });
    await Deno.writeFile(
      path,
      new TextEncoder().encode(file.contents),
    );
  };

export const dirname = (path: string) => {
  const arr = path.split("/");
  arr.pop();
  return arr.join("/");
};

// main workflow

export default async function syncCollections(
  shopifyShop: string,
  shopifyBasicAuth: string,
  collectionsDir: string,
  stringifier: (obj: object) => string,
) {
  const adminQueryable = createAdminQueryable(
    shopifyShop,
    shopifyBasicAuth,
  );
  const bulkOperationCreator = createBulkOperation(adminQueryable);
  const bulkOperationYieldable = createYieldableQuery<CurrentBulkOperation>(
    adminQueryable,
  )(currentBulkOperation);

  await bulkOperationCreator(collectionBulkQuery);
  const url = await getBulkOperationUrlWhenReady(bulkOperationYieldable);
  const jsonl = await download<Jsonl>(url);
  const serialize = serializeObject(stringifier);
  const write = writeFileToDir(collectionsDir);
  await Promise.all(
    jsonlToObjects(jsonl)
      .map(objectToContent)
      .map(serialize)
      .map(write),
  );
}
