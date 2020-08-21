import {
  assertEquals,
} from "https://deno.land/std@0.65.0/testing/asserts.ts";
import {
  getNodeType,
  NodeType,
} from "./node.ts";

Deno.test("type getting works", () => {
  const type = getNodeType("gid://shopify/Collection/199172030614");
  assertEquals(type, NodeType.Collection);
});