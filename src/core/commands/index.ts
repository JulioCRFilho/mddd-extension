/**
 * ENTRY POINT for diagram commands.
 *
 * This module unifies all specific diagram handlers
 * and exports a `validateAndDisplayDiagram` function that delegates
 * to the correct handler based on the diagram type read from the file.
 *
 * Each diagram type has its own file:
 * - flowchart-command.ts
 * - sequence-command.ts
 * - class-command.ts
 * - state-command.ts
 * - er-command.ts
 *
 * To add a new type:
 * 1. Create a file extending BaseDiagramCommand
 * 2. Implement matches() to identify the diagram type
 * 3. Register it in the handlers array below
 * 4. Done! The dispatcher will route automatically
 */

import { DiagramCommandHandler, DiagramCommandContext, DiagramResult } from './shared/types';
import { FlowchartCommand } from './flowchart-command';
import { SequenceCommand } from './sequence-command';
import { ClassCommand } from './class-command';
import { StateCommand } from './state-command';
import { ERCommand } from './er-command';

export type { DiagramCommandContext, DiagramResult, DiagramCommandHandler };

/** List of all registered command handlers */
const handlers: DiagramCommandHandler[] = [
    new FlowchartCommand(),
    new SequenceCommand(),
    new ClassCommand(),
    new StateCommand(),
    new ERCommand(),
];

/**
 * Registers a new handler dynamically.
 * Useful for plugins or extensions.
 */
export function registerCommandHandler(handler: DiagramCommandHandler): void {
    handlers.push(handler);
}

/**
 * Gets the appropriate handler for the given diagram type.
 */
export function getHandler(diagramType: string): DiagramCommandHandler {
    for (const handler of handlers) {
        if (handler.matches(diagramType)) return handler;
    }
    // Fallback to flowchart
    return handlers[0];
}

/**
 * Validates and displays the diagram, returning an error message if invalid.
 *
 * This function replaces the original validateAndDisplayDiagram in diagram-command.ts.
 * It reads the diagram type from the first line of the file and delegates
 * to the specific handler.
 */
export function validateAndDisplayDiagram(context: DiagramCommandContext): DiagramResult {
    const { document } = context;

    // Read the diagram type from the first line
    const firstLine = document.getText().split(/\r?\n/)[0] || '';
    const match = firstLine.match(/\/\/@::(.+)/);
    const diagramType = match ? match[1].trim() : 'flowchart TD';

    // Get the appropriate handler and execute
    const handler = getHandler(diagramType);
    return handler.execute(context);
}

// Re-exports individual classes for direct use when needed
export { FlowchartCommand } from './flowchart-command';
export { SequenceCommand } from './sequence-command';
export { ClassCommand } from './class-command';
export { StateCommand } from './state-command';
export { ERCommand } from './er-command';