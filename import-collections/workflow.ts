import {
  createAdminQueryable,
} from "./graphql.ts";
import {
  collectionBulkQuery,
  ID,
  CollectionShopify,
  CollectionProductShopify,
  CollectionTypeShopify,
} from "./queries.ts";
import {
  createBulkOperation,
  getBulkOperationUrlWhenReady,
} from "./bulk-operation.ts";
import {
  serializeContent,
  writeFileToDir,
  deleteDirectory,
} from "./filesystem.ts";

type Jsonl = string;

// domain object types

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
  handle: ProductHandle;
  collection: CollectionHandle;
};

export type CollectionType = Collection | CollectionProduct;

export type Content<t, T, A = {}> = {
  path: string;
  type: t;
  content: T;
} & A;

export type CollectionContent = Content<"collection", {
  layout: "collection";
  handle: CollectionHandle;
  title: string;
  description: string;
  filters: boolean;
  main: [
    {
      template: "products";
      collection: CollectionHandle;
    },
  ];
}>;

export type CollectionProductContent = Content<"product", {
  type: "products";
  noindex: true;
  weight: number;
}, { collection: CollectionHandle }>;

export type CollectionTypeContent =
  | CollectionContent
  | CollectionProductContent;

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

const parseJson = (json: string) => JSON.parse(json) as CollectionTypeShopify;

// mappers

export const mapCollection = (
  bulkCollection: CollectionShopify,
): Collection => ({
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
  (bulkCollectionProduct: CollectionProductShopify): CollectionProduct => ({
    type: "product",
    handle: bulkCollectionProduct.handle,
    collection: collectionHandles[bulkCollectionProduct.__parentId],
  });

const objectToDomain = (
  mapCollectionProduct: (
    bulkCollectionProduct: CollectionProductShopify,
  ) => CollectionProduct,
) =>
  (obj: Node): CollectionType => {
    switch (getNodeType(obj.id)) {
      case NodeType.Collection:
        return mapCollection(obj as CollectionShopify);
      case NodeType.Product:
        return mapCollectionProduct(obj as CollectionProductShopify);
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
  collection: CollectionShopify,
) => {
  return {
    ...collectionHandles,
    [collection.id]: collection.handle,
  };
};

// jsonl to domain object

export const jsonlToObjects = (jsonl: Jsonl): CollectionType[] => {
  const parsed = jsonl
    .split("\n")
    .filter(Boolean)
    .map(parseJson)
    .filter(filterPublished);
  const collectionHandles = parsed
    .filter(filterType(NodeType.Collection))
    .map((obj) => obj as CollectionShopify)
    .reduce<{ [id: string]: string }>(collectionHandleReducer, {});
  const mapProduct = mapCollectionProduct(collectionHandles);
  const domainObjects = parsed.map(objectToDomain(mapProduct));
  return domainObjects;
};

// domain object to content dto

const objectToContent = (
  obj: CollectionType,
  counter: number,
): CollectionTypeContent => {
  switch (obj.type) {
    case "collection":
      return {
        path: `${obj.handle}/_index.md`,
        type: "collection",
        content: {
          layout: "collection",
          handle: obj.handle,
          description: obj.description,
          title: obj.title,
          filters: true,
          main: [
            {
              template: "products",
              collection: obj.handle,
            },
          ],
        },
      };
    case "product":
      return {
        path: `${obj.collection}/products/${obj.handle}.md`,
        type: "product",
        content: {
          noindex: true,
          type: "products",
          weight: counter,
        },
      } as CollectionProductContent;
  }
};

// main workflow

export default async function syncCollections(
  shopifyShop: string,
  shopifyBasicAuth: string,
  collectionsDir: string,
  stringifier: (obj: object) => string,
) {
  // set up dependencies
  const adminQueryable = createAdminQueryable(
    shopifyShop,
    shopifyBasicAuth,
  );
  const runBulkQuery = createBulkOperation(adminQueryable);
  const runCollectionBulkQuery = () => runBulkQuery(collectionBulkQuery);
  const getBulkOperationUrl = () =>
    getBulkOperationUrlWhenReady(adminQueryable);
  const serialize = serializeContent(stringifier);
  const write = writeFileToDir(collectionsDir);

  // get jsonl
  const jsonl: Jsonl = await Promise.resolve()
    .then(runCollectionBulkQuery)
    .then(getBulkOperationUrl)
    .then(download);

  // create files
  const files = jsonlToObjects(jsonl)
    .map(objectToContent)
    .map(serialize);

  // write
  await deleteDirectory(collectionsDir);
  await Promise.all(files.map(write));

  console.log("Success!");
}
