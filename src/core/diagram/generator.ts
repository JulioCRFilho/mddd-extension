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

    const getGroupPrefix = (id: string) => id.split(/[0-9]/)[0].toLowerCase();

    const sortedNumbered = [...numbered].sort((a, b) => {
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
        const groupPrefix = getGroupPrefix(group.id);
        mermaid += `    subgraph ${safeLabel}\n`;

        // Nó de entrada do grupo
        const entryNodeId = `N${nodeIndex++}`;
        idToNodeId.set(group.id, entryNodeId);
        mermaid += `        ${entryNodeId}["${safeLabel}"]\n`;

        // Itens cujo ID começa com o ID do grupo (case-insensitive)
        // OU que tem conexão para um ID que está no grupo
        const groupItems = sortedNumbered.filter(item => {
            const itemLower = item.id.toLowerCase();
            const groupLower = group.id.toLowerCase();

            // Verifica se o ID do item começa com o ID do grupo
            const startsWithGroup = itemLower === groupLower || itemLower.startsWith(groupLower);

            // Verifica se o item tem conexão para um ID que está no grupo
            const hasConnectionToGroup = item.connections && item.connections.some(conn => {
                const connLower = conn.id.toLowerCase();
                return connLower === groupLower || connLower.startsWith(groupLower);
            });

            return startsWithGroup || hasConnectionToGroup;
        });

        for (const item of groupItems) {
            const nodeId = `N${nodeIndex++}`;
            const safeItemLabel = item.label.replace(/"/g, '"');
            idToNodeId.set(item.id, nodeId);
            mermaid += `        ${nodeId}["${safeItemLabel}"]\n`;
            allocated.add(item.id);
        }

        mermaid += `    end\n`;
    }

    // Nós não alocados (sintéticos de //@->)
    for (const item of sortedNumbered) {
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

    // Arestas
    for (const item of sortedNumbered) {
        const src = idToNodeId.get(item.id);
        if (!src) continue;

        // Seta pai-filho retroativa (//@ID:desc) — conecta grupo → item
        const itemLower = item.id.toLowerCase();
        const groupEntry = [...sortedGroups].find(g => {
            const groupLower = g.id.toLowerCase();
            return itemLower === groupLower || itemLower.startsWith(groupLower);
        });
        const parentNode = groupEntry ? idToNodeId.get(groupEntry.id) : undefined;
        if (parentNode) {
            if (item.description && item.description.trim()) {
                mermaid += `    ${parentNode} -->|${item.description.replace(/"/g, '"')}| ${src}\n`;
            } else {
                mermaid += `    ${parentNode} --> ${src}\n`;
            }
        }

        // Conexões explícitas (//@->ID:desc)
        if (item.connections && item.connections.length > 0) {
            for (const conn of item.connections) {
                const dst = idToNodeId.get(conn.id);
                if (dst) {
                    if (conn.label && conn.label.trim()) {
                        mermaid += `    ${src} -->|${conn.label.replace(/"/g, '"')}| ${dst}\n`;
                    } else {
                        mermaid += `    ${src} --> ${dst}\n`;
                    }
                }
            }
        }
    }

    return mermaid;
}