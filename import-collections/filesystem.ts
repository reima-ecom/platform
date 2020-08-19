import { CollectionTypeContent } from "./workflow.ts";

export type File = {
  path: string;
  contents: string;
};

export const serializeContent = (stringifier: (obj: object) => string) =>
  (obj: CollectionTypeContent): File => ({
    path: obj.path,
    contents: `---\n${stringifier(obj.content)}\n---`,
  });

export const writeFileToDir = (dir: string) =>
  async (file: File) => {
    const path = `${dir}/${file.path}`;
    await Deno.mkdir(dirname(path), { recursive: true });
    await Deno.writeFile(
      path,
      new TextEncoder().encode(file.contents),
    );
  };

export const dirname = (path: string) => {
  const arr = path.split("/");
  arr.pop();
  return arr.join("/");
};