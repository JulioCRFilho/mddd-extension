import { BaseDiagramCommand } from './shared/base-command';

/**
 * Command handler for Class Diagram type.
 * Supports: classDiagram
 */
export class ClassCommand extends BaseDiagramCommand {
    readonly type = 'class';

    matches(diagramType: string): boolean {
        return diagramType.toLowerCase().startsWith('classdiagram');
    }
}