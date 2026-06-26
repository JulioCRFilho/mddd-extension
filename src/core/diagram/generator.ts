import { ProcessedNode } from './parser';

/**
 * Gera o código Mermaid flowchart TD estilizado baseado nas tags relacionadas
 * Usa flowchart TD com cores temáticas do usuário
 */
export function generateMermaidDiagram(tags: ProcessedNode[]): string {
    if (tags.length === 0) {
        return 'flowchart TD\n    A[Nenhuma tag relacionada encontrada]';
    }

    const groups = tags.filter(t => !/\d/.test(t.id));
    const numbered = tags.filter(t => /\d/.test(t.id));

    const sortedGroups = [...groups].sort((a, b) => a.id.localeCompare(b.id));

    // Separa nós de entrada (IDs terminados com número inteiro: ID1, ID2, auth1, Login_15...) de nós subsequentes (ID1.1, ID1.2...)
    const entryNodes = numbered.filter(t => /^[a-zA-Z_]*[0-9]+$/.test(t.id) || /^[a-zA-Z_]+_[0-9]+$/.test(t.id));
    const sequenceNodes = numbered.filter(t => /\.[0-9]/.test(t.id));

    const sortedEntryNodes = [...entryNodes].sort((a, b) => {
        const numA = parseInt(a.id) || 0;
        const numB = parseInt(b.id) || 0;
        return numA - numB;
    });

    const sortedSequenceNodes = [...sequenceNodes].sort((a, b) => {
        const numsA = a.id.match(/\d+/g)?.map(Number) || [0];
        const numsB = b.id.match(/\d+/g)?.map(Number) || [0];

        for (let i = 0; i < Math.max(numsA.length, numsB.length); i++) {
            const numA = numsA[i] || 0;
            const numB = numsB[i] || 0;
            if (numA !== numB) return numA - numB;
        }
        return 0;
    });

    let mermaid = 'flowchart TD\n';
    const idToNodeId = new Map<string, string>();
    let nodeIndex = 0;

    const allocated = new Set<string>();

    for (const group of sortedGroups) {
        const safeLabel = group.label.replace(/"/g, '"');
        mermaid += `    subgraph ${safeLabel}\n`;

        // Nós de entrada (números inteiros) que pertencem a este grupo
        const groupEntryNodes = sortedEntryNodes.filter(entry => {
            const entryLower = entry.id.toLowerCase();
            const groupLower = group.id.toLowerCase();
            return entryLower === groupLower || entryLower.startsWith(groupLower);
        });

        for (const entry of groupEntryNodes) {
            const nodeId = `N${nodeIndex++}`;
            const safeLabel = entry.label.replace(/"/g, '"');
            idToNodeId.set(entry.id, nodeId);
            mermaid += `        ${nodeId}["${safeLabel}"]\n`;
            allocated.add(entry.id);
        }

        // Nós subsequentes (1.1, 1.2, 2.1...) que pertencem a este grupo
        const groupSequenceNodes = sortedSequenceNodes.filter(seq => {
            const seqLower = seq.id.toLowerCase();
            const groupLower = group.id.toLowerCase();
            return seqLower.startsWith(groupLower);
        });

        for (const seq of groupSequenceNodes) {
            const nodeId = `N${nodeIndex++}`;
            const safeLabel = seq.label.replace(/"/g, '"');
            idToNodeId.set(seq.id, nodeId);
            mermaid += `        ${nodeId}["${safeLabel}"]\n`;
            allocated.add(seq.id);
        }

        mermaid += `    end\n`;
    }

    // Nós não alocados (sintéticos de //@->)
    for (const item of [...sortedEntryNodes, ...sortedSequenceNodes]) {
        if (!allocated.has(item.id)) {
            const nodeId = `N${nodeIndex++}`;
            const safeLabel = item.label.replace(/"/g, '"');
            idToNodeId.set(item.id, nodeId);
            mermaid += `    ${nodeId}["${safeLabel}"]\n`;

            // Se o nó tem conexões, verifica se o alvo da conexão está em um grupo
            // e adiciona uma seta implícita para o grupo pai
            if (item.connections && item.connections.length > 0) {
                for (const conn of item.connections) {
                    const connLower = conn.id.toLowerCase();
                    const groupEntry = [...sortedGroups].find(g => {
                        const groupLower = g.id.toLowerCase();
                        return connLower === groupLower || connLower.startsWith(groupLower);
                    });
                    if (groupEntry) {
                        const parentNode = idToNodeId.get(groupEntry.id);
                        if (parentNode) {
                            mermaid += `    ${parentNode} --> ${nodeId}\n`;
                        }
                    }
                }
            }
        }
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

    // Arestas de pai-filho imediato (entryNode → sequenceNode ou sequenceNode → sequenceNode filho)
    // Conecta cada nó ao seu pai direto baseado no ID
    // Ex: "auth1" ← "auth1.1" (1 dot), "auth1.1" ← "auth1.1.1" (last dot)
    for (const seq of sortedSequenceNodes) {
        const src = idToNodeId.get(seq.id);
        if (!src) continue;

        // Acha o pai imediato (ex: "auth1.1" → pai "auth1", "auth1.2.1" → pai "auth1.2")
        const lastDot = seq.id.lastIndexOf('.');
        if (lastDot > 0) {
            const parentId = seq.id.substring(0, lastDot);
            const parentNode = idToNodeId.get(parentId);
            if (parentNode && parentNode !== src) {
                // Procura o label da descrição no nó filho (description = //@ID:desc)
                const seqNode = [...sortedSequenceNodes].find(s => s.id === seq.id);
                const label = seqNode?.description || undefined;
                addEdge(parentNode, src, label);
            }
        }
    }

    // Conexões explícitas (//@->ID:desc)
    for (const item of [...sortedEntryNodes, ...sortedSequenceNodes]) {
        const src = idToNodeId.get(item.id);
        if (!src) continue;

        if (item.connections && item.connections.length > 0) {
            for (const conn of item.connections) {
                const dst = idToNodeId.get(conn.id);
                if (dst) {
                    addEdge(src, dst, conn.label || undefined);
                }
            }
        }
    }

    return mermaid;
}