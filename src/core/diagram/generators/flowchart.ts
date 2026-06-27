import { ProcessedNode } from '../parser';
import { DiagramGenerator, extractNumbersFromId } from './types';

export const flowchartGenerator: DiagramGenerator = {
    type: 'flowchart',
    matches(diagramType: string): boolean {
        const key = diagramType.toLowerCase();
        return key.startsWith('flowchart') || key.startsWith('graph');
    },
    generate(tags: ProcessedNode[], diagramType: string): string {
        const groups = tags.filter(t => !/\d/.test(t.id));
        const numbered = tags.filter(t => /\d/.test(t.id));
        const sortedGroups = [...groups].sort((a, b) => a.id.localeCompare(b.id));

        const entryNodes = numbered.filter(t => /^[a-zA-Z]+[0-9]+$/.test(t.id));
        const sequenceNodes = numbered.filter(t => /\.[0-9]/.test(t.id));
        const syntheticNodes = numbered.filter(t => /^[a-zA-Z]+_[0-9]+$/.test(t.id));

        const sortedEntryNodes = [...entryNodes].sort((a, b) => {
            const numsA = extractNumbersFromId(a.id);
            const numsB = extractNumbersFromId(b.id);
            for (let i = 0; i < Math.max(numsA.length, numsB.length); i++) {
                const diff = (numsA[i] || 0) - (numsB[i] || 0);
                if (diff !== 0) return diff;
            }
            return 0;
        });

        const sortedSequenceNodes = [...sequenceNodes].sort((a, b) => {
            const numsA = extractNumbersFromId(a.id);
            const numsB = extractNumbersFromId(b.id);
            for (let i = 0; i < Math.max(numsA.length, numsB.length); i++) {
                const diff = (numsA[i] || 0) - (numsB[i] || 0);
                if (diff !== 0) return diff;
            }
            return 0;
        });

        let mermaid = `${diagramType}\n`;
        const idToNodeId = new Map<string, string>();
        let nodeIndex = 0;

        for (const group of sortedGroups) {
            const safeLabel = group.id.replace(/"/g, '"');
            mermaid += `    subgraph ${safeLabel}\n`;

            const groupEntryNodes = sortedEntryNodes.filter(entry =>
                entry.id.toLowerCase() === group.id.toLowerCase() || entry.id.toLowerCase().startsWith(group.id.toLowerCase())
            );

            for (const entry of groupEntryNodes) {
                const nodeId = `N${nodeIndex++}`;
                const safeLabel = entry.label.replace(/"/g, '"').replace(/\n/g, ' ');
                idToNodeId.set(entry.id, nodeId);
                mermaid += `        ${nodeId}["${safeLabel}"]\n`;
            }

            const groupSequenceNodes = sortedSequenceNodes.filter(seq =>
                seq.id.toLowerCase().startsWith(group.id.toLowerCase())
            );

            for (const seq of groupSequenceNodes) {
                const nodeId = `N${nodeIndex++}`;
                const safeLabel = seq.label.replace(/"/g, '"').replace(/\n/g, ' ');
                idToNodeId.set(seq.id, nodeId);
                mermaid += `        ${nodeId}["${safeLabel}"]\n`;
            }

            // Maps the group to the first node in the group (for //@->Group connections)
            const firstNode = groupEntryNodes[0] || groupSequenceNodes[0];
            if (firstNode) {
                idToNodeId.set(group.id, idToNodeId.get(firstNode.id)!);
            }

            mermaid += `    end\n`;
        }

        for (const item of syntheticNodes) {
            const nodeId = `N${nodeIndex++}`;
            const safeLabel = item.label.replace(/"/g, '"').replace(/\n/g, ' ');
            idToNodeId.set(item.id, nodeId);
            mermaid += `    ${nodeId}["${safeLabel}"]\n`;
        }

        const edges = new Set<string>();
        const addEdge = (from: string, to: string, label?: string) => {
            const key = label ? `${from}->${to}:${label}` : `${from}->${to}`;
            if (edges.has(key)) return;
            edges.add(key);
            if (label && label.trim()) {
                mermaid += `    ${from} -->|${label.replace(/"/g, '"')}| ${to}\n`;
            } else {
                mermaid += `    ${from} --> ${to}\n`;
            }
        };

        for (const seq of sortedSequenceNodes) {
            const src = idToNodeId.get(seq.id);
            if (!src) continue;
            const lastDot = seq.id.lastIndexOf('.');
            if (lastDot > 0) {
                const parentId = seq.id.substring(0, lastDot);
                const parentNode = idToNodeId.get(parentId);
                if (parentNode && parentNode !== src) {
                    const label = seq.description || undefined;
                    addEdge(parentNode, src, label);
                }
            }
        }

        for (const item of [...sortedEntryNodes, ...sortedSequenceNodes, ...syntheticNodes]) {
            const src = idToNodeId.get(item.id);
            if (!src) continue;
            if (item.connections && item.connections.length > 0) {
                for (const conn of item.connections) {
                    const dst = idToNodeId.get(conn.id);
                    if (dst) addEdge(src, dst, conn.label || undefined);
                }
            }
        }

        return mermaid;
    }
};