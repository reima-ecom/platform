import test from 'ava';
import { promises as fs } from 'fs';
import {
  readFrontmatterTemplates,
  parseTemplateContents,
  serializeTemplateContents,
  writeFrontmatterTemplates,
  removeTemplatePages,
  keepTemplatePagesOnly,
  joinPagesIntoTemplateDefinitions,
} from './workflows.js';

test('reads source dir correctly', async (t) => {
  const templates = await readFrontmatterTemplates('tests/read-dir');
  t.deepEqual(templates, [
    {
      filename: 'one.yml',
      contents: '---\n'
        + "label: 'One'\n"
        + 'hide_body: true\n'
        + 'fields:\n'
        + '- name: title\n'
        + '  type: text\n'
        + '- name: items\n'
        + '  type: field_group_list\n'
        + 'pages:\n'
        + '- content/_index.md\n'
        + '- content/deprecated.md\n',
    },
    {
      filename: 'two.yml',
      contents: '---\nlabel: Two\nfields:\n- name: text\n  type: text\n  label: Text\n',
    },
  ]);
});

test('yaml parsing works', (t) => {
  const templates = parseTemplateContents([
    {
      filename: 'one.yml',
      contents: '---\n'
        + "label: 'One'\n"
        + 'hide_body: true\n'
        + 'pages:\n'
        + '- content/_index.md\n'
        + '- content/deprecated.md\n',
    },
    {
      filename: 'two.yml',
      contents: '---\nlabel: Two\nfields:\n- name: text\n  type: text\n  label: Text\n',
    },
  ]);
  t.deepEqual(templates, [
    {
      filename: 'one.yml',
      parsed: {
        label: 'One',
        hide_body: true,
        pages: [
          'content/_index.md',
          'content/deprecated.md',
        ],
      },
    },
    {
      filename: 'two.yml',
      parsed: {
        label: 'Two',
        fields: [{
          name: 'text',
          type: 'text',
          label: 'Text',
        }],
      },
    },
  ]);
});

test('yaml serialization works', (t) => {
  const templates = serializeTemplateContents(
    [
      {
        filename: 'one.yml',
        definition: {
          label: 'One',
          hide_body: true,
        },
      },
      {
        filename: 'two.yml',
        definition: {
          label: 'Two',
          fields: [{
            name: 'text',
            type: 'text',
            label: 'Text',
          }],
        },
      },
    ],
  );
  t.deepEqual(templates, [
    {
      filename: 'one.yml',
      // assert the triple-dash at the top of the page also
      contents: '---\n'
        + 'label: One\n'
        + 'hide_body: true\n',
    },
    {
      filename: 'two.yml',
      contents: '---\nlabel: Two\nfields:\n- name: text\n  type: text\n  label: Text\n',
    },
  ]);
});

test('writing files works', async (t) => {
  const templatesWithContent = [{
    filename: 'test.yml',
    contents: 'hi: there',
  }];
  await fs.rmdir('tests/temp-write', { recursive: true });
  const status = await writeFrontmatterTemplates('tests/temp-write')(templatesWithContent);
  t.is(status, 'Success!');
  const templatesRead = await readFrontmatterTemplates('tests/temp-write');
  t.deepEqual(templatesRead, templatesWithContent);
});

test('removes pages param', (t) => {
  const noPages = removeTemplatePages([
    { filename: 'a', parsed: { a: 'a' } },
    { filename: 'b', parsed: { b: 'b', pages: 'something' } },
  ]);
  t.deepEqual(noPages, [
    { filename: 'a', definition: { a: 'a' } },
    { filename: 'b', definition: { b: 'b' } },
  ]);
});

test('keeps only pages param', (t) => {
  const onlyPages = keepTemplatePagesOnly([
    { filename: 'a', parsed: { a: 'a' } },
    { filename: 'b', parsed: { b: 'b', pages: ['something'] } },
  ]);
  t.deepEqual(onlyPages, [
    { filename: 'a', pages: undefined },
    { filename: 'b', pages: ['something'] },
  ]);
});

test('joining pages', (t) => {
  const joined = joinPagesIntoTemplateDefinitions(
    [
      { filename: 'a', pages: ['a pages'] },
      { filename: 'b', pages: ['b pages'] },
    ],
    [
      { filename: 'a', definition: { key: 'a' } },
      { filename: 'c', definition: { key: 'c' } },
    ],
  );
  const expected = [
    { filename: 'a', definition: { key: 'a', pages: ['a pages'] } },
    { filename: 'c', definition: { key: 'c' } },
  ];
  t.deepEqual(joined, expected);
});
