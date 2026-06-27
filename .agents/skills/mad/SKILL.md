---
name: mad
description: Mermaid Auto-Doccing — rules and usage of MDDD tags to generate Mermaid diagrams from //@ comments in code.
---

# MAD — Mermaid Auto-Doccing

## Invariants

- First line of the file: `//@::` defines the diagram type.
- Any line starting with `//@` generates a node or connection.
- Gutter icon: every `//@...` line must receive the icon.
- Extra comments (`// ...` without `@`) are ignored.

## Supported diagram types

- `graph LR` / `graph TD` — flowchart
- `sequenceDiagram` — sequence
- `classDiagram` — class/domain model
- `stateDiagram-v2` — state machine
- `erDiagram` — entity-relationship

## Nodes (definition)

### Flowchart
- `//@Name` — creates node/subgraph `Name`.
- `//@Name:Label` — sets the displayed label.

### Sequence
- `//@Name` — creates participant `Name`.

### Class
- `//@Name` — creates class `Name`.
- Members/methods are inferred inside the `class` block.

### State
- `//@Name` — creates state `Name`.
- `//@Name1:Action` inside the state — internal action.

### ER
- `//@Name` — creates entity `Name`.
- Attributes are inferred as fields.

## Connections

- `//@Source->Target:label` — generic edge.
- `//@Source->>Target:label` — synchronous message (sequence).
- `//@-->Target:label` — UML association (class).
- `//@<|--Target` — inheritance (class).
- `//@*--Target` — composition (class).
- `//@o--Target` — aggregation (class).

## Guidelines

1. Do not over-nest names across multiple levels.
2. Keep one node per responsibility.
3. Connect `Entry/Start` to the next steps.
4. Limit subgraphs/states to a readable amount.
5. Use `//@` for any line that should appear in the diagram.

## Keeping diagrams clean and concise

- Prefer multiple small diagrams over one giant diagram.
- Remove peripheral nodes that do not help understand the main flow.
- Keep 1 node per responsibility; avoid merging multiple concepts into the same node.
- Use short names and labels; relevant details can be described in surrounding text.
- Prioritize readability over excessive detail.

### When to decouple / abstract

- If a diagram starts to get too large or complex, separate the main concept from secondary details.
- Move secondary details into separate diagrams when it makes sense.
- Reuse names/states across diagrams to maintain coherence.
