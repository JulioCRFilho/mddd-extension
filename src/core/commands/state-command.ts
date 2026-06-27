import { BaseDiagramCommand } from './shared/base-command';

/**
 * Command handler for State Diagram type.
 * Supports: stateDiagram, stateDiagram-v2
 */
export class StateCommand extends BaseDiagramCommand {
    readonly type = 'state';

    matches(diagramType: string): boolean {
        const key = diagramType.toLowerCase();
        return key.startsWith('statediagram') || key.includes('state');
    }
}