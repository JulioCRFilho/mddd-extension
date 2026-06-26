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
 * Lê o tipo de diagrama da primeira linha do arquivo.
 * Formato esperado: //@::DiagramType
 * Exemplo: //@::flowchart TD
 * Retorna "flowchart TD" como fallback se não encontrar.
 */
export function readDiagramType(document: vscode.TextDocument): string {
    const text = document.getText();
    const firstLine = text.split(/\r?\n/)[0] || '';
    const match = firstLine.match(/\/\/@::(.+)/);
    return match ? match[1].trim() : 'flowchart TD';
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

        // Verifica //@->Target:comentário (forward pointer explícito)
        // Ex: //@->Server:HTTP Request
        const arrowExplicitMatch = line.match(/\/\/@->([\w.]+)(?::([^\n]+))?/);
        if (arrowExplicitMatch) {
            allNodes.push({
                line: i,
                id: arrowExplicitMatch[1],
                description: arrowExplicitMatch[2] ? arrowExplicitMatch[2].trim() : null,
                isArrow: true
            });
            continue;
        }

        // Verifica //@Source->Target:comentário (forward pointer inline)
        // Ex: //@Client->Server:HTTP Request
        const arrowInlineMatch = line.match(/\/\/@([\w.]+)->([\w.]+)(?::([^\n]+))?/);
        if (arrowInlineMatch) {
            allNodes.push({
                line: i,
                id: `${arrowInlineMatch[1]}->${arrowInlineMatch[2]}`,
                description: arrowInlineMatch[3] ? arrowInlineMatch[3].trim() : null,
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