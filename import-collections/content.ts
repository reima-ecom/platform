import {
  CollectionType,
  CollectionHandle,
  Collection,
  CollectionProduct,
} from "./domain.ts";

export type Content<t, T, A = {}> = {
  path: string;
  type: t;
  content: T;
} & A;

export type CollectionContent = Content<"collection", {
  layout: "collection";
  handle: CollectionHandle;
  title: string;
  seotitle: string;
  seodescription: string;
  filters: boolean;
  main: Array<ContentModule>;
}>;

export type CollectionProductContent = Content<"product", {
  type: "products";
  noindex: true;
  weight: number;
}, { collection: CollectionHandle }>;

export type CollectionTypeContent =
  | CollectionContent
  | CollectionProductContent;

type Markdown = string;

type ContentModuleBase<T, t> = {
  template: t;
} & T;

type ContentModuleContent = ContentModuleBase<{ content: Markdown }, "content">;
type ContentModuleProductList = ContentModuleBase<
  { collection: CollectionHandle },
  "products"
>;
type ContentModule = ContentModuleContent | ContentModuleProductList;

export const toCollectionContent = (
  collection: Collection,
): CollectionContent => {
  const main: ContentModule[] = [];
  // add summary to modules if exists
  if (collection.contentHtmlSummary) {
    main.push({
      template: "content",
      content: collection.contentHtmlSummary,
    });
  }
  // add product list
  main.push({
    template: "products",
    collection: collection.handle,
  });
  // add main content to modules if exists
  if (collection.contentHtml) {
    main.push({
      template: "content",
      content: collection.contentHtml,
    });
  }

  return {
    path: `${collection.handle}/_index.md`,
    type: "collection",
    content: {
      layout: "collection",
      handle: collection.handle,
      title: collection.title,
      seotitle: collection.seoTitle,
      seodescription: collection.seoDescription,
      filters: true,
      main,
    },
  };
};

export const toCollectionProductContent = (
  collectionProduct: CollectionProduct,
  counter: number,
): CollectionProductContent => ({
  path:
    `${collectionProduct.collection}/products/${collectionProduct.handle}.md`,
  type: "product",
  collection: collectionProduct.collection,
  content: {
    noindex: true,
    type: "products",
    weight: counter,
  },
});

export const objectToContent = (
  obj: CollectionType,
  counter: number,
): CollectionTypeContent => {
  switch (obj.type) {
    case "collection":
      return toCollectionContent(obj);
    case "product":
      return toCollectionProductContent(obj, counter);
  }
};
