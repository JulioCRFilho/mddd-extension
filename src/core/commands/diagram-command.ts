import * as vscode from 'vscode';
import { filterAllNodes, splitNodes, ProcessedNode } from '../diagram/parser';
import { validateDiagram, findParentId } from '../diagram/validator';
import { extractIdentifierBelow, toReadableLabel } from '../diagram/identifier';
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
 * Encontra as tags relacionadas a um prefixo no documento
 */
function findRelatedTags(document: vscode.TextDocument, prefix: string): ProcessedNode[] {
    // Step 1: Filter all //@ nodes
    const allNodes = filterAllNodes(document);

    // Step 2: Split types (retro vs forward)
    const { retroPointers, forwardPointers } = splitNodes(allNodes);

    // Step 3: Process retro pointers (//@)
    const processedRetro: Array<{ line: number; id: string; label: string; description: string | null }> = [];
    for (const node of retroPointers) {
        const nodeLower = node.id.toLowerCase();
        const prefixLower = prefix.toLowerCase();
        // Verifica se o ID começa com o prefixo (para capturar Login2, Login2.1, Login2.1.1)
        if (!nodeLower.startsWith(prefixLower)) continue;

        // Extrai identificador do código abaixo
        const text = document.getText();
        const lines = text.split(/\r?\n/);
        let identifier: string | null = null;
        let j = node.line + 1;

        while (j < lines.length && lines[j].match(/\/\/@/)) {
            j++;
        }

        if (j < lines.length) {
            identifier = extractIdentifierBelow(lines[j]);
        }

        const label = identifier ? toReadableLabel(identifier) : node.id;
        processedRetro.push({
            line: node.line,
            id: node.id,
            label: label,
            description: node.description
        });
    }

    // Step 4: Process forward pointers (//@->)
    const processedForward: Array<{ line: number; id: string; label: string; description: string | null; connections: Array<{ id: string; label: string }> }> = [];
    for (const node of forwardPointers) {
        const targetLower = node.id.toLowerCase();
        const prefixLower = prefix.toLowerCase();
        // Verifica se o ID alvo começa com o prefixo
        if (!targetLower.startsWith(prefixLower)) continue;

        // Verifica se o alvo existe
        const targetDeclared = allNodes.some(n => n.id === node.id && !n.isArrow);
        if (!targetDeclared) {
            vscode.window.showErrorMessage(
                `Erro: //@->${node.id} (linha ${node.line + 1}) aponta para "${node.id}" que não foi declarado. Crie //@${node.id} primeiro.`
            );
            return [];
        }

        const text = document.getText();
        const lines = text.split(/\r?\n/);
        let identifier: string | null = null;
        let j = node.line + 1;

        while (j < lines.length && lines[j].match(/\/\/@/)) {
            j++;
        }

        if (j < lines.length) {
            identifier = extractIdentifierBelow(lines[j]);
        }

        const sourceName = identifier || 'Unknown';
        const syntheticId = `${sourceName}_${node.line}`;
        const label = identifier ? toReadableLabel(identifier) : node.id;

        processedForward.push({
            line: node.line,
            id: syntheticId,
            label: label,
            description: null,
            connections: [{ id: node.id, label: node.description || '' }]
        });
    }

    // Step 5: Filtering - FilterGroups → FilterPrefix → FilterSequences
    const allProcessed: Array<{ line: number; id: string; label: string; description: string | null; connections: Array<{ id: string; label: string }> }> = [
        ...processedRetro.map(n => ({ ...n, connections: [] as Array<{ id: string; label: string }> })),
        ...processedForward
    ];

    const groups = allProcessed.filter(node => !/\d/.test(node.id));
    const prefixNodes = allProcessed.filter(node => /^[a-zA-Z_]+[0-9]+$/.test(node.id));
    const sequenceNodes = allProcessed.filter(node => /\.[0-9]+/.test(node.id));

    // Combina todos os nós filtrados e normaliza tipos
    const filteredNodes = [...groups, ...prefixNodes, ...sequenceNodes].map(node => ({
        line: node.line,
        id: node.id,
        label: node.label || node.id,
        description: node.description || null,
        connections: node.connections || []
    })) as ProcessedNode[];

    // Remove duplicatas mantendo ordem
    const uniqueNodes = filteredNodes.filter((node, index, self) =>
        index === self.findIndex(n => n.id === node.id)
    );

    // Ordena por ID
    uniqueNodes.sort((a, b) => {
        const numsA = a.id.match(/\d+/g)?.map(Number) || [0];
        const numsB = b.id.match(/\d+/g)?.map(Number) || [0];

        for (let i = 0; i < Math.max(numsA.length, numsB.length); i++) {
            const numA = numsA[i] || 0;
            const numB = numsB[i] || 0;
            if (numA !== numB) return numA - numB;
        }
        return 0;
    });

    // Step 6: Validate diagram
    const validation = validateDiagram(allNodes, prefix);
    if (!validation.valid) {
        const errorMessages = validation.errors.map(e =>
            `ID "${e.missingId}" não encontrado na linha ${e.line + 1}`
        ).join('\n');

        vscode.window.showErrorMessage(
            `Diagrama inválido:\n${errorMessages}`
        );
        return [];
    }

    return uniqueNodes;
}

/**
 * Valida e exibe o diagrama, retornando mensagem de erro se inválido
 */
export function validateAndDisplayDiagram(context: DiagramCommandContext): DiagramResult {
    // Filtra todos os nós
    const allNodes = filterAllNodes(context.document);

    // Separa tipos
    splitNodes(allNodes);

    // Valida diagrama
    const validation = validateDiagram(allNodes, context.prefix);

    if (!validation.valid) {
        const errorMessages = validation.errors.map(e =>
            `Linha ${e.line + 1}: ID "${e.missingId}" não encontrado`
        ).join('\n');

        return {
            success: false,
            errorMessage: `Diagrama inválido:\n${errorMessages}`
        };
    }

    // Gera diagrama
    const relatedTags = findRelatedTags(context.document, context.prefix);
    const mermaidCode = generateMermaidDiagram(relatedTags);

    // Exibe diagrama
    MDDDDiagramPanel.createOrShow(context.extensionUri, mermaidCode);

    return { success: true };
}