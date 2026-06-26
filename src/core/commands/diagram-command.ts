import * as vscode from 'vscode';
import { filterAllNodes, splitNodes, readDiagramType, ProcessedNode } from '../diagram/parser';
import { validateDiagram, ValidationError } from '../diagram/validator';
import { extractIdentifierBelow, formatCodeToLabel } from '../diagram/identifier';
import { generateMermaidDiagram } from '../diagram/generator';
import { MDDDDiagramPanel } from '../ui/diagram-panel';

export interface DiagramCommandContext {
    document: vscode.TextDocument;
    prefix: string;
    extensionUri: vscode.Uri;
}

export interface DiagramResult {
    success: boolean;
    errorMessage?: string;
}

/**
 * Extrai o código-fonte abaixo de uma tag, pulando linhas que são apenas tags consecutivas.
 */
function extractCodeLine(document: vscode.TextDocument, tagLine: number): string | null {
    const text = document.getText();
    const lines = text.split(/\r?\n/);
    let j = tagLine + 1;
    while (j < lines.length && lines[j].match(/\/\/@/)) {
        j++;
    }
    if (j < lines.length) {
        // Remove quebras de linha e espaços extras
        return lines[j].replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ').trim();
    }
    return null;
}

/**
 * Processa nós retro (//@ID): filtra por prefixo, extrai código, formata label.
 */
function processRetroPointers(
    document: vscode.TextDocument,
    retroPointers: Array<{ line: number; id: string; description: string | null }>,
    prefix: string
): Array<{ line: number; id: string; label: string; description: string | null }> {
    const prefixLower = prefix.toLowerCase();
    const result: Array<{ line: number; id: string; label: string; description: string | null }> = [];

    for (const node of retroPointers) {
        if (!node.id.toLowerCase().startsWith(prefixLower)) continue;

        // Grupos (IDs sem números) usam o ID diretamente, sem formatação
        const isGroup = !/\d/.test(node.id);
        const codeLine = extractCodeLine(document, node.line);
        const identifier = codeLine ? extractIdentifierBelow(codeLine) : null;
        const label = isGroup ? node.id : (identifier ? formatCodeToLabel(identifier) : node.id);

        result.push({
            line: node.line,
            id: node.id,
            label: label,
            description: node.description
        });
    }

    return result;
}

/**
 * Verifica se uma linha de código já foi usada por um nó retro,
 * retornando o ID do nó retro correspondente, ou null se não encontrado.
 */
function findRetroNodeForLine(
    retroNodes: Array<{ line: number; id: string; label: string; description: string | null }>,
    document: vscode.TextDocument,
    forwardLine: number
): { id: string; line: number } | null {
    const codeLine = extractCodeLine(document, forwardLine);
    if (!codeLine) return null;

    // Verifica se algum nó retro tem a mesma linha de código abaixo dele
    for (const retro of retroNodes) {
        const retroCodeLine = extractCodeLine(document, retro.line);
        if (retroCodeLine === codeLine) {
            return { id: retro.id, line: retro.line };
        }
    }
    return null;
}

/**
 * Agrupa forward pointers consecutivos (mesma linha) em um único nó sintético
 */
function groupConsecutiveForwardPointers(
    forwardPointers: Array<{ line: number; id: string; description: string | null }>
): Array<{ line: number; ids: string[]; descriptions: Map<string, string> }> {
    const grouped: Array<{ line: number; ids: string[]; descriptions: Map<string, string> }> = [];
    
    for (const node of forwardPointers) {
        // Verifica se já existe um grupo para esta linha
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
 */
function processForwardPointers(
    document: vscode.TextDocument,
    forwardPointers: Array<{ line: number; id: string; description: string | null }>,
    retroNodes: Array<{ line: number; id: string; label: string; description: string | null }>,
    _prefix: string
): {
    syntheticNodes: Array<{ line: number; id: string; label: string; connections: Array<{ id: string; label: string }> }>;
    extraConnections: Array<{ sourceId: string; targetId: string; label: string }>;
} {
    const syntheticNodes: Array<{ line: number; id: string; label: string; connections: Array<{ id: string; label: string }> }> = [];
    const extraConnections: Array<{ sourceId: string; targetId: string; label: string }> = [];

    // Separa forward pointers comuns de conexões (//@Source->Target)
    const regularForward: Array<{ line: number; id: string; description: string | null }> = [];
    const directConnections: Array<{ sourceId: string; targetId: string; label: string }> = [];

    for (const node of forwardPointers) {
        if (node.id.includes('->')) {
            // É uma conexão direta: //@Source->Target
            const [source, target] = node.id.split('->');
            if (source && target) {
                directConnections.push({
                    sourceId: source.trim(),
                    targetId: target.trim(),
                    label: node.description || ''
                });
            }
        } else {
            regularForward.push(node);
        }
    }

    // Processa forward pointers comuns (//@->Target)
    const grouped = groupConsecutiveForwardPointers(regularForward);

    for (const group of grouped) {
        const existingRetro = findRetroNodeForLine(retroNodes, document, group.line);

        if (existingRetro) {
            for (const targetId of group.ids) {
                extraConnections.push({
                    sourceId: existingRetro.id,
                    targetId: targetId,
                    label: group.descriptions.get(targetId) || ''
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

    // Adiciona conexões diretas como extraConnections para que cheguem aos generators
    for (const conn of directConnections) {
        extraConnections.push({
            sourceId: conn.sourceId,
            targetId: conn.targetId,
            label: conn.label
        });
    }

    return { syntheticNodes, extraConnections };
}

/**
 * Filtra nós por tipo (FilterGroups → FilterPrefix → FilterSequences),
 * adiciona conexões extras de forwards, remove duplicatas e ordena.
 */
function filterAndSortNodes(
    retroNodes: Array<{ line: number; id: string; label: string; description: string | null }>,
    syntheticNodes: Array<{ line: number; id: string; label: string; connections: Array<{ id: string; label: string }> }>,
    extraConnections: Array<{ sourceId: string; targetId: string; label: string }>
): ProcessedNode[] {
    const allNodes: Array<{ line: number; id: string; label: string; description: string | null; connections: Array<{ id: string; label: string }> }> = [
        ...retroNodes.map(n => ({ ...n, connections: [] as Array<{ id: string; label: string }> })),
        ...syntheticNodes.map(n => ({ ...n, description: null as string | null, connections: n.connections || [] }))
    ];

    // Adiciona conexões extras aos nós correspondentes
    for (const conn of extraConnections) {
        const sourceNode = allNodes.find(n => n.id === conn.sourceId);
        if (sourceNode) {
            sourceNode.connections.push({ id: conn.targetId, label: conn.label });
        }
    }

    // Normaliza MANTENDO A ORDEM ORIGINAL
    const normalized = allNodes.map(node => ({
        line: node.line,
        id: node.id,
        label: node.label || node.id,
        description: node.description || null,
        connections: node.connections || []
    })) as ProcessedNode[];

    // Remove duplicatas mantendo ordem de primeira ocorrência
    const unique = normalized.filter((node, index, self) =>
        index === self.findIndex(n => n.id === node.id)
    );

    // NÃO ordena! Mantém a ordem original do arquivo (cada generator decide se ordena)
    return unique;
}

/**
 * Pipeline completo: filtra nós → separa tipos → processa retro → processa forward → filtra, ordena e retorna.
 * Retorna TODAS as tags do documento (não filtra por prefixo).
 */
function findRelatedTags(document: vscode.TextDocument, _prefix: string): ProcessedNode[] {
    const allNodes = filterAllNodes(document);
    const { retroPointers, forwardPointers } = splitNodes(allNodes);

    // Processa TODOS os retro pointers (sem filtro de prefixo)
    const processedRetro = retroPointers.map(node => {
        // Grupos (IDs sem números) usam o ID diretamente, sem formatação
        const isGroup = !/\d/.test(node.id);
        const codeLine = extractCodeLine(document, node.line);
        const identifier = codeLine ? extractIdentifierBelow(codeLine) : null;
        const label = isGroup ? node.id : (identifier ? formatCodeToLabel(identifier) : node.id);

        return {
            line: node.line,
            id: node.id,
            label: label,
            description: node.description
        };
    });

    // Processa TODOS os forward pointers
    const { syntheticNodes, extraConnections } = processForwardPointers(document, forwardPointers, processedRetro, _prefix);

    // Inclui conexões diretas (//@Source->Target) como tags para manter a ordem
    const directConnectionTags: Array<{ line: number; id: string; label: string; description: string | null; connections: Array<{ id: string; label: string }> }> = [];
    for (const fp of forwardPointers.filter(f => f.id.includes('->'))) {
        directConnectionTags.push({
            line: fp.line,
            id: fp.id,
            label: fp.description || fp.id,
            description: fp.description || null,
            connections: []
        });
    }

    // Combina tudo mantendo a ordem original
    const allProcessed = [...processedRetro, ...syntheticNodes, ...directConnectionTags];
    
    // Normaliza todos os objetos para terem as mesmas propriedades
    return allProcessed.map(node => ({
        line: node.line,
        id: node.id,
        label: node.label,
        description: 'description' in node ? (node as any).description : null,
        connections: 'connections' in node ? (node as any).connections : []
    })) as ProcessedNode[];
}

/**
 * Valida e exibe o diagrama, retornando mensagem de erro se inválido
 */
export function validateAndDisplayDiagram(context: DiagramCommandContext): DiagramResult {
    // Step 1: Read diagram type from first line
    const diagramType = readDiagramType(context.document);

    // Step 2: Filter all nodes
    const allNodes = filterAllNodes(context.document);

    // Step 3: Validate diagram structure (regras MDDD)
    const validation = validateDiagram(allNodes, context.prefix);

    if (!validation.valid) {
        const errorMessages = validation.errors.map(e =>
            `Linha ${e.line + 1}: ${e.message}`
        ).join('\n');

        return {
            success: false,
            errorMessage: `Erro no diagrama:\n${errorMessages}`
        };
    }

    // Step 4: Find related tags
    const relatedTags = findRelatedTags(context.document, context.prefix);

    // Step 5: Generate diagram with saved diagram type
    const mermaidCode = generateMermaidDiagram(relatedTags, diagramType);

    // Step 6: Validate sintaxe Mermaid (validação básica)
    const mermaidValidation = validateMermaidSyntax(mermaidCode, diagramType);
    if (!mermaidValidation.valid) {
        return {
            success: false,
            errorMessage: `Erro de sintaxe Mermaid:\n${mermaidValidation.error}`
        };
    }

    // Step 7: Display diagram
    MDDDDiagramPanel.createOrShow(context.extensionUri, mermaidCode);

    return { success: true };
}

/**
 * Validação básica de sintaxe Mermaid (baseada no tipo de diagrama)
 */
function validateMermaidSyntax(mermaidCode: string, diagramType: string): { valid: boolean; error?: string } {
    const lines = mermaidCode.split('\n').filter(l => l.trim() && !l.trim().startsWith('subgraph'));
    const typeKey = diagramType.toLowerCase().replace(/\s+/g, '');
    
    // Para flowchart/graph: verifica nós N0[...] e conexões -->
    if (typeKey.startsWith('flowchart') || typeKey.startsWith('graph')) {
        const hasNodes = lines.some(l => /^[A-Za-z0-9_]+\[/.test(l.trim()));
        const hasConnections = lines.some(l => /-->/.test(l) || /---/.test(l) || /==>/.test(l));
        
        if (!hasNodes && !hasConnections) {
            return {
                valid: false,
                error: 'Nenhum nó ou conexão encontrada. Verifique se as tags estão corretas.'
            };
        }
        
        const ids = new Set<string>();
        const idRegex = /^([A-Za-z0-9_]+)\[/;
        for (const line of lines) {
            const match = line.match(idRegex);
            if (match) {
                const id = match[1];
                if (ids.has(id)) return { valid: false, error: `ID duplicado: "${id}".` };
                ids.add(id);
            }
        }
    }
    
    // Para sequenceDiagram: verifica participantes e mensagens
    if (typeKey.startsWith('sequencediagram')) {
        const hasParticipants = lines.some(l => l.trim().startsWith('participant'));
        const hasMessages = lines.some(l => l.includes('->>'));
        if (!hasParticipants && !hasMessages) {
            return {
                valid: false,
                error: 'Nenhum participante ou mensagem encontrada. Verifique as tags.'
            };
        }
    }
    
    // Para stateDiagram: verifica states e transições
    if (typeKey.startsWith('statediagram') || typeKey.includes('state')) {
        const hasStates = lines.some(l => l.trim().startsWith('state'));
        const hasTransitions = lines.some(l => l.includes('-->'));
        if (!hasStates && !hasTransitions) {
            return {
                valid: false,
                error: 'Nenhum estado ou transição encontrada. Verifique as tags.'
            };
        }
    }
    
    // Para classDiagram: verifica classes
    if (typeKey.startsWith('classdiagram')) {
        const hasClasses = lines.some(l => l.trim().startsWith('class'));
        if (!hasClasses) {
            return {
                valid: false,
                error: 'Nenhuma classe encontrada. Verifique as tags.'
            };
        }
    }
    
    // Para erDiagram: verifica entidades
    if (typeKey.startsWith('erdiagram')) {
        const hasEntities = lines.some(l => /\w+\s*\{/.test(l));
        if (!hasEntities) {
            return {
                valid: false,
                error: 'Nenhuma entidade encontrada. Verifique as tags.'
            };
        }
    }
    
    // Para gantt, pie, journey: validação mais branda
    // (o renderizador Mermaid cuidará dos erros)
    
    return { valid: true };
}
