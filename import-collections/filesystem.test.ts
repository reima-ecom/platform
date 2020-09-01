import { assertEquals, assertArrayContains } from "./deps.test.ts";
import {
  dirname,
  deleteDirectory,
  readFilesFromDir,
  File,
  deserializeContent,
  Content,
} from "./filesystem.ts";

Deno.test("dirname works", () => {
  assertEquals(dirname("/hello/there"), "/hello");
  assertEquals(dirname("/hello/there.md"), "/hello");
  assertEquals(dirname("/hello/iam/here/not/there.md"), "/hello/iam/here/not");
  assertEquals(dirname("hello/there"), "hello");
});

Deno.test("remove dir doesn't throw on non-exising path", async () => {
  await deleteDirectory("nonexisting/path");
});

Deno.test("file reading non-existing dir returns empty array", async () => {
  const files = await readFilesFromDir("test/notadir")();
  assertEquals(files, []);
});

Deno.test("recursive file reading works", async () => {
  const files = await readFilesFromDir("test/dir")();
  const expected: File[] = [
    { path: "file.md", data: "# This is a file" },
    { path: "subdir/file.txt", data: "Also a file" },
  ];
  assertArrayContains(files, expected);
});

Deno.test("deserializer works", () => {
  const content = deserializeContent(JSON.parse)(
    { path: "a/path.md", data: '---\n{\n"a":"b"\n}\n---' },
  );
  assertEquals(
    content,
    <Content> {
      path: "a/path.md",
      content: {
        a: "b",
      },
    },
  );
});
