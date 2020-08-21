import { CollectionType, CollectionHandle } from "./domain.ts";

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

export const objectToContent = (
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
          title: obj.title,
          seotitle: obj.seoTitle,
          seodescription: obj.seoDescription,
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
