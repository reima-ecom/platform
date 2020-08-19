import {
  assertEquals,
} from "https://deno.land/std@0.65.0/testing/asserts.ts";
import {
  getNodeType,
  NodeType,
  collectionHandleReducer,
  mapCollectionProduct,
  CollectionProduct,
  jsonlToObjects,
} from "./workflow.ts";
import { CollectionShopify } from "./queries.ts";

Deno.test("type getting works", () => {
  const type = getNodeType("gid://shopify/Collection/199172030614");
  assertEquals(type, NodeType.Collection);
});

Deno.test("collection handles mapper works", () => {
  const collections: CollectionShopify[] = [
    {
      id: "1",
      handle: "something",
      descriptionHtml: "",
      publishedOnCurrentPublication: true,
      seo: {
        description: "",
        title: "",
      },
      title: "",
    },
    {
      id: "2",
      handle: "something else",
      descriptionHtml: "",
      publishedOnCurrentPublication: true,
      seo: {
        description: "",
        title: "",
      },
      title: "",
    },
  ];
  const handles = collections.reduce(collectionHandleReducer, {});
  assertEquals(handles, {
    "1": "something",
    "2": "something else",
  });
});

Deno.test("collection product mapper works", () => {
  const actual = mapCollectionProduct({
    "1": "something",
    "2": "something else",
  })({
    __parentId: "2",
    handle: "product",
    id: "aoeu",
    publishedOnCurrentPublication: true,
  });
  const expected: CollectionProduct = {
    collection: "something else",
    handle: "product",
    type: "product",
  };
  assertEquals(actual, expected);
});

Deno.test("jsonl mapper works", () => {
  const actual = jsonlToObjects(
    `{"id":"gid://shopify/Collection/1","handle":"something","descriptionHtml":"","publishedOnCurrentPublication":"","seo":{"description":"","title":""},"title":"","publishedOnCurrentPublication": true}
{"id":"gid://shopify/Collection/2","handle":"something else","descriptionHtml":"","publishedOnCurrentPublication":"","seo":{"description":"","title":""},"title":"","publishedOnCurrentPublication": true}
{"__parentId":"gid://shopify/Collection/2","handle":"product","id":"gid://shopify/Product/","publishedOnCurrentPublication": true}
`,
  );
  const expected: Object[] = [
    { type: "collection", description: "", handle: "something", title: "" },
    {
      type: "collection",
      description: "",
      handle: "something else",
      title: "",
    },
    { type: "product", handle: "product", collection: "something else" },
  ];
  assertEquals(actual, expected);
});
