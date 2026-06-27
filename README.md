# MDDD Extension

<p align="center"><img src="assets/icon.png" width="128" alt="MDDD icon"></p>

VS Code extension that renders Mermaid diagrams from `//@` tags embedded in code comments.

## Features

- Detects comments in the format `//@ID` (e.g. `//@Login1`, `//@Auth2`, `//@Entry1:Handle login`).
- Every `//@...` line now receives a gutter icon for quick navigation.
- Groups related tags by prefix and builds the appropriate Mermaid diagram type.
- Supports multiple diagram types declared via `//@::<type>` on the first line.
- Renders diagrams natively in VS Code hover (Mermaid support built into the editor).

## Supported diagram types

- `graph LR` / `graph TD` — flowchart
- `sequenceDiagram` — sequence
- `classDiagram` — class/domain model
- `stateDiagram-v2` — state machine
- `erDiagram` — entity-relationship

## Usage

1. Install dependencies: `npm install`
2. Compile: `npm run compile`
3. Run the extension in development: `F5` in VS Code (`Developer: Run and Debug`)
4. Add `//@` tags in your code files:

```typescript
//@::graph LR

//@Entry
class LoginController {
  //@Entry1:Handle login
  async handleLogin(email, password) {
    //@->Auth1:Check credentials
    await auth.authenticate(email, password);
    //@->Error1:Invalid credentials
    return error.invalidCredentials();
  }
}
```

5. Hover over any `//@` line to see the generated Mermaid diagram with related tags.

## Running tests

```bash
npm run compile
NODE_PATH=test/mocks node --test test/mddd-outputs.test.mjs
```

Update snapshots after changes:

```bash
NODE_PATH=test/mocks node --test-update-snapshots --test test/mddd-outputs.test.mjs
```

## MAD skill

This project includes `.agents/skills/mad/SKILL.md`, the **MAD — Mermaid Auto-Doccing** skill.
It defines:

- `//@` invariants and icon rules
- Supported diagram types
- Node and connection rules per diagram type
- Guidelines to keep diagrams clean and concise
- When to decouple or abstract complex diagrams

## Technologies

- TypeScript
- VS Code Extension API
- Mermaid (native VS Code hover rendering)

## License

MIT
