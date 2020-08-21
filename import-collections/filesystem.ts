export type File = {
  path: string;
  data: string;
};

type Content = {
  path: string;
  content: object;
};

export const serializeContent = (stringifier: (obj: object) => string) =>
  (obj: Content): File => ({
    path: obj.path,
    data: `---\n${stringifier(obj.content)}\n---`,
  });

export const writeFileToDir = (dir: string) =>
  async (file: File) => {
    const path = `${dir}/${file.path}`;
    await Deno.mkdir(dirname(path), { recursive: true });
    await Deno.writeFile(
      path,
      new TextEncoder().encode(file.data),
    );
  };

export const deleteDirectory = async (dir: string) => {
  try {
    await Deno.remove(dir, { recursive: true });
  } catch (error) {
    // throw if this was something else than not found error
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
};

export const dirname = (path: string) => {
  const arr = path.split("/");
  arr.pop();
  return arr.join("/");
};
