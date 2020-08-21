import {
  jsonlToObjects,
} from "./domain.ts";
import {
  createAdminQueryable,
} from "./graphql.ts";
import {
  collectionBulkQuery,
  Jsonl,
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
import { toContent } from "./content.ts";

// file downloading

const download = async <T extends string>(url: string) => {
  const response = await fetch(url);
  return await response.text() as T;
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
    .map(toContent)
    .map(serialize);

  // write
  await deleteDirectory(collectionsDir);
  await Promise.all(files.map(write));

  console.log("Success!");
}
