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
} from "./queries.ts";

type Jsonl = string;

type CollectionHandle = string;
type ProductHandle = string;

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

const download = async <T extends string>(url: string) => {
  const response = await fetch(url);
  return await response.text() as T;
};

type Node = { id: ID };
type NodeWithParent = Node & { __parentId: ID };
export enum NodeType {
  Collection,
  Product,
}

export const getNodeType = (id: ID): NodeType => {
  const match = id.match(/gid:\/\/shopify\/(\w+)\/.*/);
  if (!match) throw new Error(`Could not get type from id ${id}`);
  return NodeType[match[1] as keyof typeof NodeType];
};

const mapCollection = (bulkCollection: BulkCollection): Collection => ({
  type: "collection",
  handle: bulkCollection.handle,
  title: bulkCollection.title,
  description: bulkCollection.descriptionHtml,
});

export const mapCollectionProduct = (
  collectionHandles: { [id: string]: string },
) =>
  (bulkCollectionProduct: BulkCollectionProduct): CollectionProduct => ({
    type: "product",
    handle: bulkCollectionProduct.handle,
    collection: collectionHandles[bulkCollectionProduct.__parentId],
  });

const parseJson = (json: string) =>
  JSON.parse(json) as BulkCollection | BulkCollectionProduct;

const mapJsonToObject = (
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

const filterType = (type: NodeType) =>
  (obj: Node) => getNodeType(obj.id) === type;

const filterPublished = (obj: BulkCollection | BulkCollectionProduct) =>
  obj.publishedOnCurrentPublication;

export const collectionHandleReducer = (
  collectionHandles: { [id: string]: string },
  collection: BulkCollection,
) => {
  return {
    ...collectionHandles,
    [collection.id]: collection.handle,
  };
};

export const jsonlToObjects = (jsonl: Jsonl): Object[] => {
  // split lines into json, filter away last empty line, and parse
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
  return parsed.map(mapJsonToObject(mapProduct));
};

type File = {
  filepath: string;
  contents: string;
};

const objectToContent = (obj: Object) => {
  if (obj.type === "collection") {
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
  }
  return obj;
};

const serializeObject = (stringifier: (obj: object) => string) =>
  (obj: Object): File => ({
    filepath: obj.type === "product"
      ? `${obj.collection}/products/${obj.handle}.md`
      : `${obj.handle}/_index.md`,
    contents: `---\n${stringifier(obj)}\n---`,
  });

export const dirname = (path: string) => {
  const arr = path.split("/");
  arr.pop();
  return arr.join("/");
};

const writeFileToDir = (dir: string) =>
  async (file: File) => {
    const path = `${dir}/${file.filepath}`;
    await Deno.mkdir(dirname(path), { recursive: true });
    await Deno.writeFile(
      path,
      new TextEncoder().encode(file.contents),
    );
  };

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
