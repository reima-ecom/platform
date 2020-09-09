import { map, yaml } from "./deps.ts";

const FRONTMATTER_PATH = ".forestry/front_matter/templates";

type FrontmatterSpecs = {
  [key: string]: any;
  pages?: string[];
};

type FileWithContents = {
  filename: string;
  contents: string;
};

type FileParsed = {
  filename: string;
  parsed: FrontmatterSpecs;
};

type FileWithDefinitionOnly = {
  filename: string;
  definition: Omit<FrontmatterSpecs, "pages">;
};

type FileWithPages = {
  filename: string;
  pages: string[];
};

type FileWithDefinition = {
  filename: string;
  definition: FrontmatterSpecs;
};

const readDirGithub = (githubRepo: string, path: string) =>
  async (): Promise<string[]> => {
    throw new Error("Not implemented");
  };

const readFileGithub = (githubRepo: string, path: string) =>
  async (filename: string): Promise<FileWithContents> => {
    throw new Error("Not implemented");
  };

const readDir = (dirpath: string) =>
  async (): Promise<string[]> => {
    throw new Error("Not implemented");
  };

const readFile = (filepath: string) =>
  async (filename: string): Promise<FileWithContents> => {
    throw new Error("Not implemented");
  };

export const parseTemplateContents = (
  templateWithContents: FileWithContents,
): FileParsed => {
  const { filename, contents } = templateWithContents;
  const parsed = yaml.parse(contents) as object;
  return {
    filename,
    parsed,
  };
};

export const removeTemplatePage = (
  template: FileParsed,
): FileWithDefinitionOnly => {
  const { pages, ...definition } = template.parsed;
  return {
    filename: template.filename,
    definition,
  };
};

export const keepTemplatePagesOnly = (
  template: FileParsed,
): FileWithPages => {
  const { pages } = template.parsed;
  return {
    filename: template.filename,
    pages: pages || [],
  };
};

export const joinPagesIntoTemplateDefinitions = (
  filesWithPages: FileWithPages[],
  filesWithDefinition: FileWithDefinition[],
): FileWithDefinition[] => {
  const findFile = (filename: string) =>
    (file: FileWithPages) => file.filename === filename;
  return filesWithDefinition.map((file) => {
    const fileWithPages = filesWithPages.find(findFile(file.filename));
    if (fileWithPages && fileWithPages.pages) {
      return {
        filename: file.filename,
        definition: {
          ...file.definition,
          pages: fileWithPages.pages,
        },
      };
    }
    return file;
  });
};

export const serializeTemplateContents = (
  template: FileWithDefinition,
): FileWithContents => {
  const { filename, definition } = template;
  const contents = yaml.stringify(definition, { noArrayIndent: true });
  return {
    filename,
    contents: `---\n${contents}`,
  };
};

export const writeFrontmatterTemplate = (rootDir: string) =>
  async (templateWithContent: FileWithContents): Promise<void> =>
    Deno.writeTextFile(
      `${rootDir}/${FRONTMATTER_PATH}/${templateWithContent.filename}`,
      templateWithContent.contents,
    );

const updateFrontmatter = async (
  githubRepo: string,
  targetDir: string,
): Promise<string[]> => {
  const eventLog: string[] = [];
  // read source dir fm into array
  const sourceDefinitions = await Promise
    .resolve()
    .then(readDirGithub(githubRepo, FRONTMATTER_PATH))
    .then(map(readFileGithub(githubRepo, FRONTMATTER_PATH)))
    .then(map(parseTemplateContents))
    .then(map(removeTemplatePage));
  eventLog.push("Got source front matter files");

  // read target dir pages into array
  const targetPages = await Promise
    .resolve()
    .then(readDir(FRONTMATTER_PATH))
    .then(map(readFile(FRONTMATTER_PATH)))
    .then(map(parseTemplateContents))
    .then(map(keepTemplatePagesOnly));
  eventLog.push("Got possible pages from target frontmatter");

  // delete target dir
  const dirPath = `${targetDir}/${FRONTMATTER_PATH}`;
  await Deno.mkdir(dirPath, { recursive: true });

  // join target pages into source front matter
  const templatesWithPages = joinPagesIntoTemplateDefinitions(
    targetPages,
    sourceDefinitions,
  );

  // write to dir
  await Promise
    .resolve(templatesWithPages)
    .then(map(serializeTemplateContents))
    .then(map(writeFrontmatterTemplate(dirPath)));
  eventLog.push("Success!");

  return eventLog;
};

export default updateFrontmatter;
