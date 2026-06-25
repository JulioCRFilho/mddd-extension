import * as vscode from 'vscode';
import { NodeInfo } from './parser';

export interface ValidationResult {
    valid: boolean;
    errors: Array<{ line: number; missingId: string }>;
}

/**
 * Valida se todos os IDs referenciados em //@-> existem como nós declarados
 */
export function validateDiagram(
    allNodes: NodeInfo[],
    prefix: string
): ValidationResult {
    const errors: Array<{ line: number; missingId: string }> = [];

    const prefixLower = prefix.toLowerCase();

    // Coleta todos os IDs declarados (não são arrows) que começam com o prefixo
    const declaredIds = new Set<string>();
    for (const node of allNodes) {
        if (!node.isArrow) {
            const nodeLower = node.id.toLowerCase();
            if (nodeLower.startsWith(prefixLower)) {
                declaredIds.add(node.id);
            }
        }
    }

    // Verifica se todos os //@-> apontam para IDs existentes
    for (const node of allNodes) {
        if (node.isArrow) {
            const targetLower = node.id.toLowerCase();
            if (targetLower.startsWith(prefixLower)) {
                if (!declaredIds.has(node.id)) {
                    errors.push({
                        line: node.line,
                        missingId: node.id
                    });
                }
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors: errors
    };
}

/**
 * Encontra o ID do pai de um item numerado
 */
export function findParentId(id: string, groups: Array<{ id: string }>): string | null {
    const lastDotIndex = id.lastIndexOf('.');
    if (lastDotIndex > 0) {
        const parentId = id.substring(0, lastDotIndex);
        return parentId;
    }

    const match = id.match(/^([a-zA-Z_]+)\d+$/);
    if (match) {
        const groupId = match[1];
        if (groups.some(g => g.id === groupId)) {
            return groupId;
        }
    }

    return null;
}