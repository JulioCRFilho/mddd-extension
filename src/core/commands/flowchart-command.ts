import { BaseDiagramCommand } from './shared/base-command';

/**
 * Command handler for Flowchart / Graph diagrams.
 * Supports: flowchart TD, flowchart LR, graph TD, graph LR, etc.
 */
export class FlowchartCommand extends BaseDiagramCommand {
    readonly type = 'flowchart';

    matches(diagramType: string): boolean {
        const key = diagramType.toLowerCase();
        return key.startsWith('flowchart') || key.startsWith('graph');
    }
}