/**
 * SINGLE ENTRY POINT for Mermaid diagram generation.
 * 
 * This file re-exports the function from the generators module,
 * ensuring compatibility with existing imports.
 * 
 * Each diagram type has its own file in ./generators/:
 * - flowchart.ts
 * - sequence.ts
 * - class.ts
 * - state.ts
 * - er.ts
 * 
 * To add a new type:
 * 1. Create a file in ./generators/ implementing DiagramGenerator
 * 2. Add it to the array in ./generators/index.ts
 * 3. Done! The dispatcher will route automatically
 */
export { generateMermaidDiagram, registerGenerator, getGenerator } from './generators/index';
export type { DiagramGenerator } from './generators/types';