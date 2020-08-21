import { toCollectionContent, CollectionContent } from "./content.ts";
import { assertEquals } from "https://deno.land/std@0.65.0/testing/asserts.ts";

Deno.test("content summaries work", () => {
  const content = toCollectionContent({
    type: "collection",
    handle: "coll",
    seoDescription: "",
    seoTitle: "",
    title: "Collection",
    contentHtml: "content",
    contentHtmlSummary: "summary",
  });
  const expected: CollectionContent = {
    type: "collection",
    path: "coll/_index.md",
    content: {
      filters: true,
      handle: "coll",
      layout: "collection",
      seodescription: "",
      seotitle: "",
      title: "Collection",
      main: [
        {
          template: "content",
          content: "summary"
        },
        {
          template: "products",
          collection: "coll",
        },
        {
          template: "content",
          content: "content",
        }
      ],
    },
  };
  assertEquals(content, expected);
});
