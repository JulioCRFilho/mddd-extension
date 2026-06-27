import { ProcessedNode } from '../parser';
import { DiagramGenerator } from './types';

export const sequenceGenerator: DiagramGenerator = {
    type: 'sequenceDiagram',
    matches(diagramType: string): boolean {
        return diagramType.toLowerCase().startsWith('sequencediagram');
    },
    generate(tags: ProcessedNode[], diagramType: string): string {
        let mermaid = `${diagramType}\n`;
        const participantSet = new Set<string>();
        const participants: string[] = [];
        const messages: Array<{ from: string; to: string; label: string }> = [];

        // First pass: collect all participants (groups)
        for (const tag of tags) {
            if (!/\d/.test(tag.id) && !tag.id.includes('->')) {
                if (!participantSet.has(tag.id)) {
                    participantSet.add(tag.id);
                    participants.push(tag.id);
                }
            }
        }

        // Second pass: process tags in file order
        const sortedByLine = [...tags].sort((a, b) => a.line - b.line);
        for (const tag of sortedByLine) {
            // Process direct connections: //@Source->Target:label
            if (tag.id.includes('->')) {
                const [source, target] = tag.id.split('->');
                if (source && target) {
                    const sourceClean = source.trim();
                    const targetClean = target.trim();
                    
                    if (!participantSet.has(sourceClean)) {
                        participantSet.add(sourceClean);
                        participants.push(sourceClean);
                    }
                    if (!participantSet.has(targetClean)) {
                        participantSet.add(targetClean);
                        participants.push(targetClean);
                    }
                    
                    messages.push({ from: sourceClean, to: targetClean, label: tag.description || tag.label || 'message' });
                }
                continue;
            }

            if (tag.connections && tag.connections.length > 0) {
                const groupId = tag.id.match(/^([a-zA-Z_]+)/)?.[1];
                if (groupId && participantSet.has(groupId)) {
                    for (const conn of tag.connections) {
                        if (!participantSet.has(conn.id)) {
                            participantSet.add(conn.id);
                            participants.push(conn.id);
                        }
                        messages.push({ from: groupId, to: conn.id, label: conn.label || tag.label });
                    }
                }
            }
        }

        // Do NOT sort! Messages are already in the correct order
        // pois foram adicionadas na ordem das tags no arquivo

        for (const p of participants) mermaid += `    participant ${p}\n`;
        for (const msg of messages) mermaid += `    ${msg.from}->>${msg.to}: ${msg.label}\n`;

        return mermaid;
    }
};