import * as vscode from 'vscode';
import { ProcessedNode, filterAllNodes, splitNodes } from '../../diagram/parser';
import { extractIdentifierBelow, formatCodeToLabel } from '../../diagram/identifier';

/**
 * Extracts the source code below a tag, skipping lines that are only consecutive tags.
 */
export function extractCodeLine(document: vscode.TextDocument, tagLine: number): string | null {
    const text = document.getText();
    const lines = text.split(/\r?\n/);
    let j = tagLine + 1;
    while (j < lines.length && lines[j].match(/\/\/@/)) {
        j++;
    }
    if (j < lines.length) {
        return lines[j].replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ').trim();
    }
    return null;
}

/**
 * Extracts a complete SQL code block (multiline) for ER diagrams
 */
export function extractSQLBlock(document: vscode.TextDocument, tagLine: number): string | null {
    const text = document.getText();
    const lines = text.split(/\r?\n/);

    let j = tagLine + 1;
    while (j < lines.length && lines[j].match(/\/\/@/)) {
        j++;
    }

    if (j >= lines.length) return null;

    const codeLines: string[] = [];
    while (j < lines.length) {
        const line = lines[j];
        if (line.match(/\/\/@/)) break;
        codeLines.push(line);
        if (line.includes(';')) break;
        j++;
    }

    return codeLines.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Checks if a line of code has already been used by a retro node,
 * returning the ID of the corresponding retro node, or null if not found.
 */
export function findRetroNodeForLine(
    retroNodes: Array<{ line: number; id: string; label: string; description: string | null }>,
    document: vscode.TextDocument,
    forwardLine: number
): { id: string; line: number } | null {
    // Strategy 1: same exact code line
    const codeLine = extractCodeLine(document, forwardLine);
    if (codeLine) {
        for (const retro of retroNodes) {
            const retroCodeLine = extractCodeLine(document, retro.line);
            if (retroCodeLine === codeLine) {
                return { id: retro.id, line: retro.line };
            }
        }
    }

    // Strategy 2: find closest retro node above
    // (for //@-> inside methods, associate with parent method)
    let closest: { id: string; line: number } | null = null;
    for (const retro of retroNodes) {
        if (retro.line < forwardLine && (!closest || retro.line > closest.line)) {
            // Only numbered retro nodes (entries) — not sub-steps or groups
            if (/^[a-zA-Z_]+\d+$/.test(retro.id)) {
                closest = { id: retro.id, line: retro.line };
            }
        }
    }
    return closest;
}

/**
 * Process ALL retro nodes (//@ID): extracts code, formats label.
 * Does NOT filter by prefix - ALL tags in the document must be rendered.
 */
export function processRetroPointers(
    document: vscode.TextDocument,
    retroPointers: Array<{ line: number; id: string; description: string | null }>,
    prefix: string,
    isERDiagramOrType: boolean | string = false
): Array<{ line: number; id: string; label: string; description: string | null; connections: Array<{ id: string; label: string }> }> {
    const isERDiagram = typeof isERDiagramOrType === 'string'
        ? isERDiagramOrType.toLowerCase().startsWith('erdiagram')
        : isERDiagramOrType;
    const isFlowchart = typeof isERDiagramOrType === 'string'
        ? isERDiagramOrType.toLowerCase().startsWith('flowchart') || isERDiagramOrType.toLowerCase().startsWith('graph')
        : false;
    const result: Array<{ line: number; id: string; label: string; description: string | null; connections: Array<{ id: string; label: string }> }> = [];

    for (const node of retroPointers) {
        const isGroup = !/\d/.test(node.id);

        let label: string;
        if (isERDiagram && isGroup) {
            const sqlBlock = extractSQLBlock(document, node.line);
            label = sqlBlock || node.id;
        } else {
            const codeLine = extractCodeLine(document, node.line);
            const identifier = codeLine ? extractIdentifierBelow(codeLine) : null;
            const fromCode = identifier ? formatCodeToLabel(identifier) : null;
            // For main entries (without dot): use code identifier
            // For sub-steps (with dot .): prefers explicit annotation description
            const isEntry = /^[a-zA-Z_]+\d+$/.test(node.id);
            const hasDots = /\.\d/.test(node.id);
            if (isGroup) {
                label = node.id;
            } else if (isFlowchart && hasDots && node.description) {
                label = node.description;
            } else {
                label = fromCode || node.description || node.id;
            }
        }

        result.push({
            line: node.line,
            id: node.id,
            label: label,
            description: node.description,
            connections: []
        });
    }

    return result;
}

/**
 * Groups consecutive forward pointers (same line) into a single synthetic node
 */
function groupConsecutiveForwardPointers(
    forwardPointers: Array<{ line: number; id: string; description: string | null; arrowPrefix?: string }>
): Array<{ line: number; ids: string[]; descriptions: Map<string, string>; arrowPrefixes: Map<string, string> }> {
    const grouped: Array<{ line: number; ids: string[]; descriptions: Map<string, string>; arrowPrefixes: Map<string, string> }> = [];

    for (const node of forwardPointers) {
        const existing = grouped.find(g => g.line === node.line);
        if (existing) {
            existing.ids.push(node.id);
            if (node.description) {
                existing.descriptions.set(node.id, node.description);
            }
            if (node.arrowPrefix) {
                existing.arrowPrefixes.set(node.id, node.arrowPrefix);
            }
        } else {
            grouped.push({
                line: node.line,
                ids: [node.id],
                descriptions: node.description ? new Map([[node.id, node.description]]) : new Map(),
                arrowPrefixes: node.arrowPrefix ? new Map([[node.id, node.arrowPrefix]]) : new Map()
            });
        }
    }

    return grouped;
}

/**
 * Processes forward nodes (//@->ID).
 * If the code line already has an associated retro node, adds the connections to that node.
 * Otherwise, creates a synthetic node with multiple connections.
 *
 * Forward pointers with -> in the ID (e.g. //@Client->Server) are direct connections.
 *
 * Also returns an ordered list of direct connections (by file line)
 * para que generators (como sequence) possam respeitar a ordem original.
 */
export function processForwardPointers(
    document: vscode.TextDocument,
    forwardPointers: Array<{ line: number; id: string; description: string | null; arrowPrefix?: string }>,
    retroNodes: Array<{ line: number; id: string; label: string; description: string | null }>,
    _prefix: string
): {
    syntheticNodes: Array<{ line: number; id: string; label: string; connections: Array<{ id: string; label: string; arrowPrefix?: string }> }>;
    extraConnections: Array<{ sourceId: string; targetId: string; label: string; line: number; arrowPrefix?: string }>;
    orderedDirectConnections: Array<{ sourceId: string; targetId: string; label: string; line: number }>;
} {
    const syntheticNodes: Array<{ line: number; id: string; label: string; connections: Array<{ id: string; label: string; arrowPrefix?: string }> }> = [];
    const extraConnections: Array<{ sourceId: string; targetId: string; label: string; line: number; arrowPrefix?: string }> = [];
    const orderedDirectConnections: Array<{ sourceId: string; targetId: string; label: string; line: number }> = [];

    const regularForward: Array<{ line: number; id: string; description: string | null; arrowPrefix?: string }> = [];

    for (const node of forwardPointers) {
        if (node.id.includes('->')) {
            const [source, target] = node.id.split('->');
            if (source && target) {
                orderedDirectConnections.push({
                    sourceId: source.trim(),
                    targetId: target.trim(),
                    label: node.description || '',
                    line: node.line
                });
            }
        } else {
            regularForward.push(node);
        }
    }

    const grouped = groupConsecutiveForwardPointers(regularForward);

    for (const group of grouped) {
        const existingRetro = findRetroNodeForLine(retroNodes, document, group.line);

        if (existingRetro) {
            for (const targetId of group.ids) {
                extraConnections.push({
                    sourceId: existingRetro.id,
                    targetId: targetId,
                    label: group.descriptions.get(targetId) || '',
                    line: group.line,
                    arrowPrefix: group.arrowPrefixes.get(targetId)
                });
            }
        } else {
            const codeLine = extractCodeLine(document, group.line);
            const identifier = codeLine ? extractIdentifierBelow(codeLine) : null;
            const sourceName = identifier || 'Unknown';
            const syntheticId = `${sourceName}_${group.line}`;
            const label = identifier ? formatCodeToLabel(identifier) : sourceName;

            const connections = group.ids.map(targetId => ({
                id: targetId,
                label: group.descriptions.get(targetId) || ''
            }));

            syntheticNodes.push({
                line: group.line,
                id: syntheticId,
                label: label,
                connections: connections
            });
        }
    }

    return { syntheticNodes, extraConnections, orderedDirectConnections };
}

/**
 * Filters nodes by type, adds extra connections from forwards,
 * remove duplicatas e ordena.
 */
export function filterAndSortNodes(
    retroNodes: Array<{ line: number; id: string; label: string; description: string | null }>,
    syntheticNodes: Array<{ line: number; id: string; label: string; connections: Array<{ id: string; label: string }> }>,
    extraConnections: Array<{ sourceId: string; targetId: string; label: string; line: number; arrowPrefix?: string }>
): ProcessedNode[] {
    const allNodes: Array<{ line: number; id: string; label: string; description: string | null; connections: Array<{ id: string; label: string; arrowPrefix?: string }> }> = [
        ...retroNodes.map(n => ({ ...n, connections: [] as Array<{ id: string; label: string; arrowPrefix?: string }> })),
        ...syntheticNodes.map(n => ({ ...n, description: null as string | null, connections: n.connections || [] }))
    ];

    for (const conn of extraConnections) {
        const sourceNode = allNodes.find(n => n.id === conn.sourceId);
        if (sourceNode) {
            sourceNode.connections.push({ id: conn.targetId, label: conn.label, arrowPrefix: conn.arrowPrefix });
        }
    }

    const normalized = allNodes.map(node => ({
        line: node.line,
        id: node.id,
        label: node.label || node.id,
        description: node.description || null,
        connections: node.connections || []
    })) as ProcessedNode[];

    const unique = normalized.filter((node, index, self) =>
        index === self.findIndex(n => n.id === node.id)
    );

    return unique;
}

/**
 * Result of the tag processing pipeline with preserved ordering.
 * Includes the processed nodes and the ordered list of direct connections
 * (//@Source->Target) na ordem original do arquivo.
 */
export interface RelatedTagsResult {
    nodes: ProcessedNode[];
    /** Direct connections (//@Source->Target) in the original file order */
    orderedDirectConnections: Array<{ sourceId: string; targetId: string; label: string; line: number }>;
}

/**
 * Pipeline completo: filtra TODAS as tags → separa tipos → processa retro → processa forward → filtra, ordena e retorna.
 * Does NOT filter by prefix - ALL tags in the document are included in the diagram.
 * Returns only processed nodes (compatible with existing generators).
 */
export function findRelatedTags(
    document: vscode.TextDocument,
    prefix: string,
    diagramType: string
): ProcessedNode[] {
    const result = findRelatedTagsWithOrder(document, prefix, diagramType);

    // Merges orderedDirectConnections (//@Source->Target:label) nos node.connections
    // so generators like state and ER can access them via tag.connections
    for (const conn of result.orderedDirectConnections) {
        const sourceNode = result.nodes.find(n => n.id === conn.sourceId);
        if (sourceNode) {
            // Avoids duplicates (in case a connection was already added via extraConnections)
            const alreadyPresent = sourceNode.connections.some(
                c => c.id === conn.targetId && c.label === conn.label
            );
            if (!alreadyPresent) {
                sourceNode.connections.push({ id: conn.targetId, label: conn.label });
            }
        }
    }

    return result.nodes;
}

/**
 * Extended version of the pipeline that also returns ordered direct connections.
 * Used by diagrams that need the exact order of messages (e.g. sequenceDiagram).
 */
export function findRelatedTagsWithOrder(
    document: vscode.TextDocument,
    prefix: string,
    diagramType: string
): RelatedTagsResult {
    const allNodes = filterAllNodes(document);
    const { retroPointers, forwardPointers } = splitNodes(allNodes);

    // Processa TODOS os retro pointers (sem filtro de prefixo)
    const processedRetro = processRetroPointers(document, retroPointers, prefix, diagramType);
    const { syntheticNodes, extraConnections, orderedDirectConnections } = processForwardPointers(document, forwardPointers, processedRetro, prefix);

    return {
        nodes: filterAndSortNodes(processedRetro, syntheticNodes, extraConnections),
        orderedDirectConnections
    };
}
