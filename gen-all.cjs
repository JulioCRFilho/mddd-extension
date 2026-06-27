const { readFileSync } = require('fs');
const { resolve } = require('path');

const { findRelatedTags } = require('./out/src/core/commands/shared/helpers');
const { generateMermaidDiagram } = require('./out/src/core/diagram/generator');

function mockDocument(content) {
  return {
    getText: () => content,
    uri: { fsPath: '/mock', path: '/mock', scheme: 'file' },
    fileName: '/mock',
    isUntitled: false,
    languageId: 'plaintext',
    version: 1,
    isDirty: false,
    isClosed: false,
    save: () => Promise.resolve(true),
    lineCount: content.split(/\r?\n/).length,
    lineAt: (n) => {
      const lines = content.split(/\r?\n/);
      return { text: lines[n] || '', lineNumber: n, range: {} };
    },
    offsetAt: () => 0,
    positionAt: () => ({ line: 0, character: 0 }),
    getWordRangeAtPosition: () => null,
    validateRange: () => null,
    validatePosition: () => null,
  };
}

const examples = [
  '01-flowchart-login.ts',
  '02-sequence-api.js',
  '03-class-diagram-oop.py',
  '04-state-machine-login.js',
  '05-er-database.sql',
];

for (const name of examples) {
  const content = readFileSync(resolve(__dirname, 'examples', name), 'utf-8');
  const firstLine = content.split(/\r?\n/)[0] || '';
  const m = firstLine.match(/\/\/@::(.+)/);
  const diagramType = m ? m[1].trim() : 'flowchart TD';
  const doc = mockDocument(content);
  const tags = findRelatedTags(doc, 'md', diagramType);
  const output = generateMermaidDiagram(tags, diagramType);
  console.log('╔══════════════════════════════════════════════');
  console.log('║ ' + name);
  console.log('║ Type: ' + diagramType);
  console.log('╚══════════════════════════════════════════════');
  console.log(output);
  console.log();
}
