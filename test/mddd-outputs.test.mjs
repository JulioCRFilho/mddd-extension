/**
 * Testes de output dos diagramas — usa node:test nativo (zero dependências).
 *
 * Compila o projeto com `npm run compile`, depois roda:
 *   node --test test/mddd-outputs.test.mjs
 */
import { describe, it, before } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// ── imports do core compilado ──────────────────────────────────────────
const { findRelatedTags } = require('../out/src/core/commands/shared/helpers');
const { generateMermaidDiagram } = require('../out/src/core/diagram/generator');

// ── mock de vscode.TextDocument ────────────────────────────────────────
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

  it('começa com flowchart TD', () => {
    assert.ok(out.startsWith('graph LR\n') || out.startsWith('flowchart TD\n'));
  });

  it('contém subgraphs Auth, Dashboard e Error', () => {
    assert.ok(out.includes('subgraph Auth'));
    assert.ok(out.includes('subgraph Dashboard'));
    assert.ok(out.includes('subgraph Error'));
  });

  it('contém labels extraídos do código', () => {
    assert.ok(out.includes('Authenticate'));
    assert.ok(out.includes('Handle Login Request'));
    assert.ok(out.includes('Create Session'));
    assert.ok(out.includes('Show Dashboard'));
    assert.ok(out.includes('Load User Data'));
    assert.ok(out.includes('Handle Error'));
  });

  it('contém arestas da hierarquia', () => {
    assert.ok(/N\d+ -->\|Verify 2FA code\| N\d+/.test(out),
      'aresta de Verify 2FA code');
    assert.ok(/N\d+ -->\|Load user data\| N\d+/.test(out),
      'aresta de Load user data');
  });

  it('snapshot completo', (t) => {
    t.assert.snapshot(out);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 02 – Sequence
// ═══════════════════════════════════════════════════════════════════════
describe('02 – Sequence (02-sequence-api.js)', () => {
  let out = '';

  before(() => { out = processExample('02-sequence-api.js'); });

  it('começa com sequenceDiagram', () => {
    assert.ok(out.startsWith('sequenceDiagram\n'));
  });

  it('contém participantes Client, Server, Database, Error', () => {
    for (const p of ['Client', 'Server', 'Database', 'Error'])
      assert.ok(out.includes(`participant ${p}`), `participant ${p}`);
  });

  it('contém ao menos 5 mensagens com ->>', () => {
    const msgs = out.split('\n').filter(l => l.includes('->>'));
    assert.ok(msgs.length >= 5, `esperado >=5, obtido ${msgs.length}`);
  });

  it('snapshot completo', (t) => {
    t.assert.snapshot(out);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 03 – Class Diagram
// ═══════════════════════════════════════════════════════════════════════
describe('03 – Class (03-class-diagram-oop.py)', () => {
  let out = '';

  before(() => { out = processExample('03-class-diagram-oop.py'); });

  it('começa com classDiagram', () => {
    assert.ok(out.startsWith('classDiagram\n'));
  });

  it('contém classes User, Order e Product', () => {
    for (const c of ['class User', 'class Order', 'class Product'])
      assert.ok(out.includes(c), `classe ${c}`);
  });

  it('contém métodos Python', () => {
    for (const m of ['+init()', '+Place Order()', '+Calculate Total()', '+Add Item()'])
      assert.ok(out.includes(m), `método ${m}`);
  });

  it('contém relacionamentos', () => {
    assert.ok(out.includes('User --> Order'), 'User --> Order');
    assert.ok(out.includes('Admin --> Product'), 'Admin --> Product');
  });

  it('snapshot completo', (t) => {
    t.assert.snapshot(out);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 04 – State Machine
// ═══════════════════════════════════════════════════════════════════════
describe('04 – State (04-state-machine-login.js)', () => {
  let out = '';

  before(() => { out = processExample('04-state-machine-login.js'); });

  it('começa com stateDiagram-v2', () => {
    assert.ok(out.startsWith('stateDiagram-v2\n'));
  });

  it('contém estados LoggedOut, LoggedIn, SessionExpired', () => {
    for (const s of ['state LoggedOut', 'state LoggedIn', 'state SessionExpired'])
      assert.ok(out.includes(s), `estado ${s}`);
  });

  it('contém ações dentro dos estados', () => {
    const actions = [
      'DisplayLoginForm: Display Login Form',
      'ValidateCredentials: Validate Credentials',
      'SendCode: Send Code',
      'StartTokenRefreshTimer: Start Token Refresh Timer',
      'RedirectToLogin: Redirect To Login',
    ];
    for (const a of actions) assert.ok(out.includes(a), `ação ${a}`);
  });

  it('contém as 3 transições entre estados', () => {
    assert.ok(out.includes('LoggedOut --> LoggingIn: User submits credentials'));
    assert.ok(out.includes('LoggedIn --> SessionExpired: Token expired'));
    assert.ok(out.includes('SessionExpired --> LoggedOut: User redirected'));
  });

  it('snapshot completo', (t) => {
    t.assert.snapshot(out);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 05 – ER Diagram
// ═══════════════════════════════════════════════════════════════════════
describe('05 – ER (05-er-database.sql)', () => {
  let out = '';

  before(() => { out = processExample('05-er-database.sql'); });

  it('começa com erDiagram', () => {
    assert.ok(out.startsWith('erDiagram\n'));
  });

  it('contém entidades User, Order, Product e OrderItem', () => {
    for (const e of ['User {', 'Order {', 'Product {', 'OrderItem {'])
      assert.ok(out.includes(e), `entidade ${e}`);
  });

  it('contém atributos SQL', () => {
    const attrs = ['string id', 'string name', 'string email',
                   'string total', 'string stock', 'string quantity'];
    for (const a of attrs) assert.ok(out.includes(a), `atributo ${a}`);
  });

  it('contém os 3 relacionamentos', () => {
    assert.ok(out.includes('User ||--o{ Order : places'));
    assert.ok(out.includes('Order ||--o{ OrderItem : contains'));
    assert.ok(out.includes('OrderItem ||--o{ Product : references'));
  });

  it('snapshot completo', (t) => {
    t.assert.snapshot(out);
  });
});
