import * as vscode from 'vscode';

export interface NodeInfo {
    line: number;
    id: string;
    description: string | null;
    isArrow: boolean;
    /** Arrow type for classDiagram: '-->' (assoc), '--' (dep), '<|--' (inheritance), '*--' (composition), 'o--' (aggregation) */
    arrowPrefix?: string;
}

export interface ProcessedNode {
    line: number;
    id: string;
    label: string;
    description: string | null;
    connections: Array<{ id: string; label: string; arrowPrefix?: string }>;
}

/**
 * Reads the diagram type from the first line of the file.
 * Expected format: //@::DiagramType
 * Example: //@::flowchart TD
 * Returns "flowchart TD" as fallback if not found.
 */
export function readDiagramType(document: vscode.TextDocument): string {
    const text = document.getText();
    const firstLine = text.split(/\r?\n/)[0] || '';
    const match = firstLine.match(/\/\/@::(.+)/);
    return match ? match[1].trim() : 'flowchart TD';
}

/**
 * Filters all //@ nodes from the document
 */
export function filterAllNodes(document: vscode.TextDocument): NodeInfo[] {
    const allNodes: NodeInfo[] = [];
    const text = document.getText();
    const lines = text.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Verifica //@--Target, //@<|--Target, //@*--Target, //@o--Target (classDiagram relationships)
        const classArrowMatch = line.match(/\/\/@(<\|--|--|\*--|o--)([\w.]+)(?::([^\n]+))?/);
        if (classArrowMatch) {
            allNodes.push({
                line: i,
                id: classArrowMatch[2],
                description: classArrowMatch[3] ? classArrowMatch[3].trim() : null,
                isArrow: true,
                arrowPrefix: classArrowMatch[1]
            });
            continue;
        }

        // Checks //@->Target:comment (explicit forward pointer)
        // Ex: //@->Server:HTTP Request
        const arrowExplicitMatch = line.match(/\/\/@->([\w.]+)(?::([^\n]+))?/);
        if (arrowExplicitMatch) {
            allNodes.push({
                line: i,
                id: arrowExplicitMatch[1],
                description: arrowExplicitMatch[2] ? arrowExplicitMatch[2].trim() : null,
                isArrow: true,
                arrowPrefix: '-->'
            });
            continue;
        }

        // Checks //@Source->Target:comment (inline forward pointer)
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

        // Checks //@ID:comment (retro pointer)
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
 * Splits nodes into retro pointers //@ and forward pointers //@->
 */
export function splitNodes(
    allNodes: NodeInfo[]
): {
    retroPointers: Array<{ line: number; id: string; description: string | null }>;
    forwardPointers: Array<{ line: number; id: string; description: string | null; arrowPrefix?: string }>;
} {
    const retroPointers: Array<{ line: number; id: string; description: string | null }> = [];
    const forwardPointers: Array<{ line: number; id: string; description: string | null; arrowPrefix?: string }> = [];

    for (const node of allNodes) {
        if (node.isArrow) {
            forwardPointers.push({
                line: node.line,
                id: node.id,
                description: node.description,
                arrowPrefix: node.arrowPrefix
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
 * Filters groups (IDs without numbers)
 */
export function filterGroups(
    nodes: ProcessedNode[]
): ProcessedNode[] {
    return nodes.filter(node => !/\d/.test(node.id));
}

/**
 * Filters entry nodes (prefix+ simple number)
 */
export function filterPrefix(
    nodes: ProcessedNode[]
): ProcessedNode[] {
    return nodes.filter(node => /^[a-zA-Z_]+[0-9]+$/.test(node.id));
}

/**
 * Filters sequence nodes (prefix+ number.number...)
 */
export function filterSequences(
    nodes: ProcessedNode[]
): ProcessedNode[] {
    return nodes.filter(node => /\.[0-9]+/.test(node.id));
}