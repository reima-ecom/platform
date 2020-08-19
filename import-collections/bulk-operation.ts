import { GraphQLQueryable } from "./graphql.ts";
import {
  createBulkQuery,
  BulkQuery,
  BulkQueryResponse,
  CurrentBulkOperation,
  currentBulkOperation,
} from "./queries.ts";

function createYieldableQuery<T>(
  queryable: GraphQLQueryable,
) {
  async function* getNext(graphQl: string) {
    while (true) {
      yield queryable<T>(graphQl);
    }
  }
  return getNext;
}

export const createBulkOperation = (adminQuery: GraphQLQueryable) =>
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

export const getBulkOperationUrlWhenReady = async (
  adminQuery: GraphQLQueryable,
) => {
  const bulkOperationYieldable = createYieldableQuery<CurrentBulkOperation>(
    adminQuery,
  )(currentBulkOperation);
  for await (const result of bulkOperationYieldable) {
    const { currentBulkOperation } = result;
    console.log(currentBulkOperation.status);
    if (currentBulkOperation.status === "COMPLETED") {
      return currentBulkOperation.url;
    }
  }
  throw new Error("Bulk operation not for awaitable");
};
