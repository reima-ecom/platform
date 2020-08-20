import { assertEquals } from "https://deno.land/std@0.65.0/testing/asserts.ts";
import { dirname, deleteDirectory } from "./filesystem.ts";

Deno.test("dirname works", () => {
  assertEquals(dirname("/hello/there"), "/hello");
  assertEquals(dirname("/hello/there.md"), "/hello");
  assertEquals(dirname("/hello/iam/here/not/there.md"), "/hello/iam/here/not");
  assertEquals(dirname("hello/there"), "hello");
});

Deno.test("remove dir doesn't throw on non-exising path", async () => {
  await deleteDirectory("nonexisting/path");
});
