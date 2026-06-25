import * as vscode from 'vscode';

export interface NodeInfo {
    line: number;
    id: string;
    description: string | null;
    isArrow: boolean;
}

export interface ProcessedNode {
    line: number;
    id: string;
    label: string;
    description: string | null;
    connections: Array<{ id: string; label: string }>;
}

/**
 * Filtra todos os nós //@ do documento
 */
export function filterAllNodes(document: vscode.TextDocument): NodeInfo[] {
    const allNodes: NodeInfo[] = [];
    const text = document.getText();
    const lines = text.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Verifica //@->ID:comentário (forward pointer)
        const arrowMatch = line.match(/\/\/@->([\w.]+)(?::([^\n]+))?/);
        if (arrowMatch) {
            allNodes.push({
                line: i,
                id: arrowMatch[1],
                description: arrowMatch[2] ? arrowMatch[2].trim() : null,
                isArrow: true
            });
            continue;
        }

        // Verifica //@ID:comentário (retro pointer)
        const tagMatch = line.match(/\/\/@([\w.]+)(?::([^\n]+))?/);
        if (tagMatch) {
            allNodes.push({
                line: i,
                id: tagMatch[1],
                description: tagMatch[2] ? tagMatch[2].trim() : null,
                isArrow: false
            });
        }
    }

    return allNodes;
}

/**
 * Separa nós em retro pointers //@ e forward pointers //@->
 */
export function splitNodes(
    allNodes: NodeInfo[]
): {
    retroPointers: Array<{ line: number; id: string; description: string | null }>;
    forwardPointers: Array<{ line: number; id: string; description: string | null }>;
} {
    const retroPointers: Array<{ line: number; id: string; description: string | null }> = [];
    const forwardPointers: Array<{ line: number; id: string; description: string | null }> = [];

    for (const node of allNodes) {
        if (node.isArrow) {
            forwardPointers.push({
                line: node.line,
                id: node.id,
                description: node.description
            });
        } else {
            retroPointers.push({
                line: node.line,
                id: node.id,
                description: node.description
            });
        }
    }

    return { retroPointers, forwardPointers };
}

/**
 * Filtra grupos (IDs sem números)
 */
export function filterGroups(
    nodes: ProcessedNode[]
): ProcessedNode[] {
    return nodes.filter(node => !/\d/.test(node.id));
}

/**
 * Filtra nós de entrada (prefix+ número simples)
 */
export function filterPrefix(
    nodes: ProcessedNode[]
): ProcessedNode[] {
    return nodes.filter(node => /^[a-zA-Z_]+[0-9]+$/.test(node.id));
}

/**
 * Filtra nós de sequência (prefix+ número.número...)
 */
export function filterSequences(
    nodes: ProcessedNode[]
): ProcessedNode[] {
    return nodes.filter(node => /\.[0-9]+/.test(node.id));
}