import * as vscode from 'vscode';
import { BaseDiagramCommand } from './shared/base-command';
import { MADDiagramPanel } from '../ui/diagram-panel';
import { DiagramCommandContext, DiagramResult } from './shared/types';
import { findRelatedTagsWithOrder } from './shared/helpers';
import { readDiagramType } from '../diagram/parser';

/**
 * Command handler for Sequence Diagram type.
 * Supports: sequenceDiagram
 *
 * Overrides the default pipeline to ensure messages
 * (//@Source->Target connections) are rendered in the exact order
 * they appear in the file, regardless of grouping by source node.
 */
export class SequenceCommand extends BaseDiagramCommand {
    readonly type = 'sequence';

    matches(diagramType: string): boolean {
        return diagramType.toLowerCase().startsWith('sequencediagram');
    }

    /**
     * Generates the Mermaid sequence diagram code respecting the
     * original order of connections in the file.
     */
    private generateSequenceMermaid(
        document: vscode.TextDocument,
        prefix: string,
        diagramType: string
    ): string {
        const result = findRelatedTagsWithOrder(document, prefix, diagramType);
        const { nodes, orderedDirectConnections } = result;

        let mermaid = `${diagramType}\n`;
        const participantSet = new Set<string>();
        const participants: string[] = [];
        const messages: Array<{ from: string; to: string; label: string }> = [];

        // First pass: collect all participants (groups) and entry nodes,
        // in the order they appear in the file
        const sortedByLine = [...nodes].sort((a, b) => a.line - b.line);

        for (const tag of sortedByLine) {
            // Collect groups (IDs without numbers)
            if (!/\d/.test(tag.id) && !tag.id.includes('->')) {
                if (!participantSet.has(tag.id)) {
                    participantSet.add(tag.id);
                    participants.push(tag.id);
                }
            }
        }

        // Second pass: process tag connections (//@->Target)
        // in file line order
        for (const tag of sortedByLine) {
            if (tag.connections && tag.connections.length > 0) {
                const groupId = tag.id.match(/^([a-zA-Z_]+)/)?.[1];
                if (groupId && participantSet.has(groupId)) {
                    for (const conn of tag.connections) {
                        if (!participantSet.has(conn.id)) {
                            participantSet.add(conn.id);
                            participants.push(conn.id);
                        }
                        messages.push({
                            from: groupId,
                            to: conn.id,
                            label: conn.label || tag.label
                        });
                    }
                }
            }
        }

        // Third pass: direct connections (//@Source->Target)
        // in ORIGINAL FILE ORDER
        for (const conn of orderedDirectConnections) {
            const sourceClean = conn.sourceId;
            const targetClean = conn.targetId;

            if (!participantSet.has(sourceClean)) {
                participantSet.add(sourceClean);
                participants.push(sourceClean);
            }
            if (!participantSet.has(targetClean)) {
                participantSet.add(targetClean);
                participants.push(targetClean);
            }

            messages.push({
                from: sourceClean,
                to: targetClean,
                label: conn.label || 'message'
            });
        }

        // Generate Mermaid code
        for (const p of participants) {
            mermaid += `    participant ${p}\n`;
        }
        for (const msg of messages) {
            mermaid += `    ${msg.from}->>${msg.to}: ${msg.label}\n`;
        }

        return mermaid;
    }

    /**
     * Overrides execute() to use the correct connection order.
     */
    execute(context: DiagramCommandContext): DiagramResult {
        const { document, prefix, extensionUri } = context;

        const diagramType = this.readDiagramType(document);

        // MAD validation
        const validation = this.validateMAD(document, prefix);
        if (!validation.valid) {
            return { success: false, errorMessage: validation.error };
        }

        // Generate Mermaid code with correct ordering
        const mermaidCode = this.generateSequenceMermaid(document, prefix, diagramType);

        // Pre-display hook
        const processedCode = this.beforeDisplay(mermaidCode, diagramType);

        // Mermaid validation
        const mermaidValidation = this.validateMermaid(processedCode, diagramType);
        if (!mermaidValidation.valid) {
            return {
                success: false,
                errorMessage: `Mermaid syntax error:\n${mermaidValidation.error}`
            };
        }

        // Display diagram
        this.displayDiagram(extensionUri, processedCode);

        return { success: true };
    }
}