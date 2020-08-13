/* eslint-disable implicit-arrow-linebreak */
import { promises as fs } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';

const FRONTMATTER_DIR = ['.forestry', 'front_matter', 'templates'];

export const readFrontmatterTemplates = async (rootDir) => {
  const frontmatterDir = join(rootDir, ...FRONTMATTER_DIR);
  // get filenames
  const filenames = await fs.readdir(frontmatterDir);
  // open each file and add to array
  const templates = await Promise.all(filenames.map(async (filename) => {
    const fileContents = await fs.readFile(join(frontmatterDir, filename));
    return {
      filename,
      contents: fileContents.toString(),
    };
  }));
  return templates;
};

export const parseTemplateContents = (templatesWithContent) =>
  templatesWithContent.map((templateWithContents) => {
    const { filename, contents } = templateWithContents;
    const parsed = yaml.safeLoad(contents);
    return {
      filename,
      parsed,
    };
  });

export const removeTemplatePages = (templatesParsed) =>
  templatesParsed.map((template) => {
    const { pages, ...definition } = template.parsed;
    return {
      filename: template.filename,
      definition,
    };
  });

export const keepTemplatePagesOnly = (templatesParsed) =>
  templatesParsed.map((template) => {
    const { pages } = template.parsed;
    return {
      filename: template.filename,
      pages,
    };
  });

export const serializeTemplateContents = (templatesWithDefinition) =>
  templatesWithDefinition.map((templateWithDefinition) => {
    const { filename, definition } = templateWithDefinition;
    const contents = yaml.safeDump(definition, { noArrayIndent: true });
    return {
      filename,
      contents: `---\n${contents}`,
    };
  });

export const writeFrontmatterTemplates = (rootDir) => async (templatesWithContent) => {
  const frontmatterDir = join(rootDir, ...FRONTMATTER_DIR);
  // create directory
  await fs.mkdir(frontmatterDir, { recursive: true });
  // open each file and add to array
  await Promise.all(templatesWithContent.map((templateWithContent) =>
    fs.writeFile(
      join(frontmatterDir, templateWithContent.filename),
      templateWithContent.contents,
    )));
  return 'Success!';
};

export const joinPagesIntoTemplateDefinitions = (filesWithPages, filesWithDefinition) => {
  const findFile = (filename) => (file) => file.filename === filename;
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

const updateFrontmatter = async (sourceDir, targetDir) => {
  const eventLog = [];
  // read source dir fm into array
  const sourcesWithContent = await readFrontmatterTemplates(sourceDir);
  const sourcesParsed = parseTemplateContents(sourcesWithContent);
  const sourcesWithDefinition = removeTemplatePages(sourcesParsed);
  eventLog.push('Got source front matter files');
  // read target dir pages into array
  let targetWithPages = [];
  try {
    const targetWithContent = await readFrontmatterTemplates(targetDir);
    const targetParsed = parseTemplateContents(targetWithContent);
    targetWithPages = keepTemplatePagesOnly(targetParsed);
    eventLog.push('Got possible pages from target frontmatter');
  } catch (error) {
    if (error.code === 'ENOENT') eventLog.push('No target files found');
    else throw error;
  }
  // delete target dir
  await fs.rmdir(join(targetDir, ...FRONTMATTER_DIR), { recursive: true });
  // join target pages into source front matter
  const templatesWithPages = joinPagesIntoTemplateDefinitions(
    targetWithPages,
    sourcesWithDefinition,
  );
  // write to dir
  const templatesWithContent = serializeTemplateContents(templatesWithPages);
  const status = await writeFrontmatterTemplates(targetDir)(templatesWithContent);
  eventLog.push(status);
  return eventLog;
};

export default updateFrontmatter;
