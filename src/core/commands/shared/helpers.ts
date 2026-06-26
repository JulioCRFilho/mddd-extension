import * as vscode from 'vscode';
import { ProcessedNode, filterAllNodes, splitNodes } from '../../diagram/parser';
import { extractIdentifierBelow, formatCodeToLabel } from '../../diagram/identifier';

/**
 * Extrai o código-fonte abaixo de uma tag, pulando linhas que são apenas tags consecutivas.
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
 * Extrai um bloco de código SQL completo (multilinhas) para diagramas ER
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
 * Verifica se uma linha de código já foi usada por um nó retro,
 * retornando o ID do nó retro correspondente, ou null se não encontrado.
 */
export function findRetroNodeForLine(
    retroNodes: Array<{ line: number; id: string; label: string; description: string | null }>,
    document: vscode.TextDocument,
    forwardLine: number
): { id: string; line: number } | null {
    const codeLine = extractCodeLine(document, forwardLine);
    if (!codeLine) return null;

    for (const retro of retroNodes) {
        const retroCodeLine = extractCodeLine(document, retro.line);
        if (retroCodeLine === codeLine) {
            return { id: retro.id, line: retro.line };
        }
    }
    return null;
}

/**
 * Processa TODOS os nós retro (//@ID): extrai código, formata label.
 * NÃO filtra por prefixo - TODAS as tags do documento devem ser renderizadas.
 */
export function processRetroPointers(
    document: vscode.TextDocument,
    retroPointers: Array<{ line: number; id: string; description: string | null }>,
    prefix: string,
    isERDiagram: boolean = false
): Array<{ line: number; id: string; label: string; description: string | null; connections: Array<{ id: string; label: string }> }> {
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
            label = isGroup ? node.id : (identifier ? formatCodeToLabel(identifier) : node.id);
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
 * Agrupa forward pointers consecutivos (mesma linha) em um único nó sintético
 */
function groupConsecutiveForwardPointers(
    forwardPointers: Array<{ line: number; id: string; description: string | null }>
): Array<{ line: number; ids: string[]; descriptions: Map<string, string> }> {
    const grouped: Array<{ line: number; ids: string[]; descriptions: Map<string, string> }> = [];

    for (const node of forwardPointers) {
        const existing = grouped.find(g => g.line === node.line);
        if (existing) {
            existing.ids.push(node.id);
            if (node.description) {
                existing.descriptions.set(node.id, node.description);
            }
        } else {
            grouped.push({
                line: node.line,
                ids: [node.id],
                descriptions: node.description ? new Map([[node.id, node.description]]) : new Map()
            });
        }
    }

    return grouped;
}

/**
 * Processa nós forward (//@->ID).
 * Se a linha de código já tem um nó retro associado, adiciona as conexões a esse nó.
 * Caso contrário, cria um nó sintético com múltiplas conexões.
 *
 * Forward pointers com -> no ID (ex: //@Client->Server) são conexões diretas.
 *
 * Retorna também uma lista ordenada de conexões diretas (por linha do arquivo)
 * para que generators (como sequence) possam respeitar a ordem original.
 */
export function processForwardPointers(
    document: vscode.TextDocument,
    forwardPointers: Array<{ line: number; id: string; description: string | null }>,
    retroNodes: Array<{ line: number; id: string; label: string; description: string | null }>,
    _prefix: string
): {
    syntheticNodes: Array<{ line: number; id: string; label: string; connections: Array<{ id: string; label: string }> }>;
    extraConnections: Array<{ sourceId: string; targetId: string; label: string; line: number }>;
    orderedDirectConnections: Array<{ sourceId: string; targetId: string; label: string; line: number }>;
} {
    const syntheticNodes: Array<{ line: number; id: string; label: string; connections: Array<{ id: string; label: string }> }> = [];
    const extraConnections: Array<{ sourceId: string; targetId: string; label: string; line: number }> = [];
    const orderedDirectConnections: Array<{ sourceId: string; targetId: string; label: string; line: number }> = [];

    const regularForward: Array<{ line: number; id: string; description: string | null }> = [];

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
                    line: group.line
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
 * Filtra nós por tipo, adiciona conexões extras de forwards,
 * remove duplicatas e ordena.
 */
export function filterAndSortNodes(
    retroNodes: Array<{ line: number; id: string; label: string; description: string | null }>,
    syntheticNodes: Array<{ line: number; id: string; label: string; connections: Array<{ id: string; label: string }> }>,
    extraConnections: Array<{ sourceId: string; targetId: string; label: string; line: number }>
): ProcessedNode[] {
    const allNodes: Array<{ line: number; id: string; label: string; description: string | null; connections: Array<{ id: string; label: string }> }> = [
        ...retroNodes.map(n => ({ ...n, connections: [] as Array<{ id: string; label: string }> })),
        ...syntheticNodes.map(n => ({ ...n, description: null as string | null, connections: n.connections || [] }))
    ];

    for (const conn of extraConnections) {
        const sourceNode = allNodes.find(n => n.id === conn.sourceId);
        if (sourceNode) {
            sourceNode.connections.push({ id: conn.targetId, label: conn.label });
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
 * Resultado do pipeline de processamento de tags com ordenação preservada.
 * Inclui os nós processados e a lista ordenada de conexões diretas
 * (//@Source->Target) na ordem original do arquivo.
 */
export interface RelatedTagsResult {
    nodes: ProcessedNode[];
    /** Conexões diretas (//@Source->Target) na ordem original do arquivo */
    orderedDirectConnections: Array<{ sourceId: string; targetId: string; label: string; line: number }>;
}

/**
 * Pipeline completo: filtra TODAS as tags → separa tipos → processa retro → processa forward → filtra, ordena e retorna.
 * NÃO filtra por prefixo - TODAS as tags do documento são incluídas no diagrama.
 * Retorna apenas os nós processados (compatível com generators existentes).
 */
export function findRelatedTags(
    document: vscode.TextDocument,
    prefix: string,
    diagramType: string
): ProcessedNode[] {
    const result = findRelatedTagsWithOrder(document, prefix, diagramType);

    // Mescla orderedDirectConnections (//@Source->Target:label) nos node.connections
    // para que geradores como state e ER possam acessá-las via tag.connections
    for (const conn of result.orderedDirectConnections) {
        const sourceNode = result.nodes.find(n => n.id === conn.sourceId);
        if (sourceNode) {
            // Evita duplicatas (caso uma conexão já tenha sido adicionada via extraConnections)
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
 * Versão estendida do pipeline que também retorna conexões diretas ordenadas.
 * Usado por diagramas que precisam da ordem exata das mensagens (ex: sequenceDiagram).
 */
export function findRelatedTagsWithOrder(
    document: vscode.TextDocument,
    prefix: string,
    diagramType: string
): RelatedTagsResult {
    const allNodes = filterAllNodes(document);
    const { retroPointers, forwardPointers } = splitNodes(allNodes);

    const isERDiagram = diagramType.toLowerCase().startsWith('erdiagram');

    // Processa TODOS os retro pointers (sem filtro de prefixo)
    const processedRetro = processRetroPointers(document, retroPointers, prefix, isERDiagram);
    const { syntheticNodes, extraConnections, orderedDirectConnections } = processForwardPointers(document, forwardPointers, processedRetro, prefix);

    return {
        nodes: filterAndSortNodes(processedRetro, syntheticNodes, extraConnections),
        orderedDirectConnections
    };
}
