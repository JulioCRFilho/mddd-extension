/**
 * Diagram output tests — uses native node:test (zero dependencies).
 *
 * Compiles the project with `npm run compile`, then runs:
 *   node --test test/mad-outputs.test.mjs
 */
import { describe, it, before } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// ── compiled core imports ──────────────────────────────────────────
const { findRelatedTags } = require('../out/src/core/commands/shared/helpers');
const { generateMermaidDiagram } = require('../out/src/core/diagram/generator');

// ── vscode.TextDocument mock ────────────────────────────────────────
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

// ── helpers ─────────────────────────────────────────────────────────────
function readExample(name) {
  return readFileSync(resolve(__dirname, '..', 'examples', name), 'utf-8');
}

function processExample(name) {
  const content = readExample(name);
  const doc = mockDocument(content);
  const firstLine = content.split(/\r?\n/)[0] || '';
  const m = firstLine.match(/\/\/@::(.+)/);
  const diagramType = m ? m[1].trim() : 'flowchart TD';
  const tags = findRelatedTags(doc, 'md', diagramType);
  return generateMermaidDiagram(tags, diagramType);
}

// ═══════════════════════════════════════════════════════════════════════
// 01 – Flowchart
// ═══════════════════════════════════════════════════════════════════════
describe('01 – Flowchart (01-flowchart-login.ts)', () => {
  let out = '';

  before(() => { out = processExample('01-flowchart-login.ts'); });

  it('starts with flowchart TD', () => {
    assert.ok(out.startsWith('graph LR\n') || out.startsWith('flowchart TD\n'));
  });

  it('contains subgraphs Auth, Dashboard and Error', () => {
    assert.ok(out.includes('subgraph Auth'));
    assert.ok(out.includes('subgraph Dashboard'));
    assert.ok(out.includes('subgraph Error'));
  });

  it('contains labels extracted from code', () => {
    assert.ok(out.includes('Handle Login'));
    assert.ok(out.includes('Verify 2FA'));
    assert.ok(out.includes('Authenticate'));
    assert.ok(out.includes('Create Session'));
    assert.ok(out.includes('Challenge 2FA') || out.includes('Initiate Challenge'));
    assert.ok(out.includes('Show Dashboard'));
  });

  it('contains hierarchy edges', () => {
    assert.ok(/N\d+ -->\|Authenticate\| N\d+/.test(out),
      'A edge of Authenticate');
    assert.ok(/N\d+ -->\|Show dashboard\| N\d+/.test(out),
      'A edge of Show dashboard');
    assert.ok(/N\d+ -->\|Validate code\| N\d+/.test(out),
      'A edge of Validate code');
  });

  it('complete snapshot', (t) => {
    t.assert.snapshot(out);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 02 – Sequence
// ═══════════════════════════════════════════════════════════════════════
describe('02 – Sequence (02-sequence-api.js)', () => {
  let out = '';

  before(() => { out = processExample('02-sequence-api.js'); });

  it('starts with sequenceDiagram', () => {
    assert.ok(out.startsWith('sequenceDiagram\n'));
  });

  it('contains participants Client, Server, Database, Error', () => {
    for (const p of ['Client', 'Server', 'Database', 'Error'])
      assert.ok(out.includes(`participant ${p}`), `participant ${p}`);
  });

  it('contains at least 5 messages with ->>', () => {
    const msgs = out.split('\n').filter(l => l.includes('->>'));
    assert.ok(msgs.length >= 5, `expected >=5, got ${msgs.length}`);
  });

  it('complete snapshot', (t) => {
    t.assert.snapshot(out);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 03 – Class Diagram
// ═══════════════════════════════════════════════════════════════════════
describe('03 – Class (03-class-diagram-oop.py)', () => {
  let out = '';

  before(() => { out = processExample('03-class-diagram-oop.py'); });

  it('starts with classDiagram', () => {
    assert.ok(out.startsWith('classDiagram\n'));
  });

  it('contains classes User, Order and Product', () => {
    for (const c of ['class User', 'class Order', 'class Product'])
      assert.ok(out.includes(c), `class ${c}`);
  });

  it('contains Python methods', () => {
    for (const m of ['+init()', '+Place Order()', '+Calculate Total()', '+Add Item()'])
      assert.ok(out.includes(m), `method ${m}`);
  });

  it('contains relationships', () => {
    assert.ok(out.includes('User --> Order'), 'User --> Order');
    assert.ok(out.includes('Admin --> Product'), 'Admin --> Product');
  });

  it('complete snapshot', (t) => {
    t.assert.snapshot(out);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 04 – State Machine
// ═══════════════════════════════════════════════════════════════════════
describe('04 – State (04-state-machine-login.js)', () => {
  let out = '';

  before(() => { out = processExample('04-state-machine-login.js'); });

  it('starts with stateDiagram-v2', () => {
    assert.ok(out.startsWith('stateDiagram-v2\n'));
  });

  it('contains states LoggedOut, LoggingIn, TwoFactorAuth, LoggedIn, AccountLocked and SessionExpired', () => {
    for (const s of ['state LoggedOut', 'state LoggingIn', 'state TwoFactorAuth', 'state LoggedIn', 'state AccountLocked', 'state SessionExpired'])
      assert.ok(out.includes(s), `state ${s}`);
  });

  it('contains actions inside states (uses @comment description)', () => {
    const actions = [
      'Show login form',
      'Authenticate',
      'Verify code',
      'Show dashboard',
      'Show lock screen',
      'Redirect to login',
    ];
    for (const a of actions) assert.ok(out.includes(a), `action ${a}`);
  });

  it('contains transitions between states', () => {
    assert.ok(out.includes('LoggedOut --> LoggingIn'));
    assert.ok(out.includes('LoggingIn --> TwoFactorAuth'));
    assert.ok(out.includes('TwoFactorAuth --> LoggedIn'));
    assert.ok(out.includes('LoggedIn --> SessionExpired'));
    assert.ok(out.includes('SessionExpired --> LoggedOut'));
    assert.ok(out.includes('LoggingIn --> AccountLocked'));
    assert.ok(out.includes('TwoFactorAuth --> AccountLocked'));
  });

  it('complete snapshot', (t) => {
    t.assert.snapshot(out);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 05 – ER Diagram
// ═══════════════════════════════════════════════════════════════════════
describe('05 – ER (05-er-database.sql)', () => {
  let out = '';

  before(() => { out = processExample('05-er-database.sql'); });

  it('starts with erDiagram', () => {
    assert.ok(out.startsWith('erDiagram\n'));
  });

  it('contains entities User, Order, Product and OrderItem', () => {
    for (const e of ['User {', 'Order {', 'Product {', 'OrderItem {'])
      assert.ok(out.includes(e), `entity ${e}`);
  });

  it('contains SQL attributes', () => {
    const attrs = ['string id', 'string name', 'string email',
                   'string total', 'string stock', 'string quantity'];
    for (const a of attrs) assert.ok(out.includes(a), `attribute ${a}`);
  });

  it('contains all 3 relationships', () => {
    assert.ok(out.includes('User ||--o{ Order : places'));
    assert.ok(out.includes('Order ||--o{ OrderItem : contains'));
    assert.ok(out.includes('Product ||--o{ OrderItem : references'));
  });

  it('complete snapshot', (t) => {
    t.assert.snapshot(out);
  });
});
