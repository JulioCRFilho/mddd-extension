import { BaseDiagramCommand } from './shared/base-command';

/**
 * Command handler for ER (Entity Relationship) diagrams.
 * Supports: erDiagram
 *
 * Specific behavior:
 * - Extracts complete SQL blocks to define entities
 * - Uses SQL DDL below groups as entity definitions
 *
 * The ER-specific processing (SQL extraction) is performed
 * in the `processRetroPointers` helper with isERDiagram=true
 */
export class ERCommand extends BaseDiagramCommand {
    readonly type = 'er';

    matches(diagramType: string): boolean {
        return diagramType.toLowerCase().startsWith('erdiagram');
    }
}