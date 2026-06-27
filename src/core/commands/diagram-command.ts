/**
 * DIAGRAM COMMAND - Main entry point (backward compatibility).
 *
 * This file has been refactored into multiple specific modules:
 *
 *   commands/
 *     index.ts              ← Main dispatcher and factory
 *     flowchart-command.ts  ← Handler for Flowchart/Graph
 *     sequence-command.ts   ← Handler for Sequence Diagram
 *     class-command.ts      ← Handler for Class Diagram
 *     state-command.ts      ← Handler for State Diagram
 *     er-command.ts         ← Handler for ER Diagram
 *     shared/
 *       types.ts            ← Shared interfaces and types
 *       helpers.ts          ← Helper functions (processRetroPointers, processForwardPointers, etc.)
 *       validation.ts       ← MAD and Mermaid validation by type
 *       base-command.ts     ← Abstract base class for all handlers
 *
 * The validateAndDisplayDiagram() function is now a dispatcher that
 * automatically delegates to the correct handler based on the diagram
 * type read from the first line of the file.
 *
 * To add a new diagram type:
 * 1. Create a handler extending BaseDiagramCommand in commands/
 * 2. Implement matches() to identify your type
 * 3. Register it in the array in commands/index.ts
 */

// Re-exports everything from the new index.ts module for compatibility
export {
    validateAndDisplayDiagram,
    registerCommandHandler,
    getHandler,
    FlowchartCommand,
    SequenceCommand,
    ClassCommand,
    StateCommand,
    ERCommand,
} from './index';

export type {
    DiagramCommandContext,
    DiagramResult,
    DiagramCommandHandler,
} from './shared/types';