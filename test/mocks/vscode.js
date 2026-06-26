// Mock do módulo vscode para testes Node puro.
// Carregado via NODE_PATH=test/mocks
'use strict';

class Uri {
  static file(p) {
    return { fsPath: p, path: p, scheme: 'file', with: () => this, toJSON: () => ({}), toString: () => p };
  }
  static parse(p) {
    return { fsPath: p, path: p, scheme: 'file' };
  }
}

class Range {}
class Position {
  constructor(line, character) {
    this.line = line;
    this.character = character;
  }
}

const EndOfLine = { LF: 1, CRLF: 2 };
const DiagnosticSeverity = { Error: 0, Warning: 1, Information: 2, Hint: 3 };

module.exports = { Uri, Range, Position, EndOfLine, DiagnosticSeverity };
