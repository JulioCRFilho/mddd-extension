import * as vscode from 'vscode';
import { NodeInfo } from './parser';

export interface ValidationError {
    line: number;
    message: string;
    missingId?: string;
}

export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    warnings?: ValidationError[];
}

/**
 * Valida a estrutura completa do diagrama:
 * 1. Todos os //@-> apontam para IDs existentes
 * 2. Todo sequence node (X.Y) tem pai imediato (X) declarado
 * 3. Todo entry node (Login1) tem grupo correspondente (Login)
 * 4. Hierarquia é consistente (ex: Login1.1.1 → Login1.1 → Login1 → Login)
 */
export function validateDiagram(
    allNodes: NodeInfo[],
    prefix: string
): ValidationResult {
    const errors: ValidationError[] = [];
    const prefixLower = prefix.toLowerCase();

    // Coleta TODOS os IDs declarados (não são arrows)
    const declaredIds = new Map<string, NodeInfo>();
    for (const node of allNodes) {
        if (!node.isArrow) {
            declaredIds.set(node.id, node);
        }
    }

    const declaredIdSet = new Set(declaredIds.keys());

    // 1. Verifica se todos os //@-> apontam para IDs existentes
    for (const node of allNodes) {
        if (node.isArrow) {
            // Pula conexões diretas (//@Source->Target) - não precisam ser declaradas
            if (node.id.includes('->')) continue;
            
            if (!declaredIdSet.has(node.id)) {
                errors.push({
                    line: node.line,
                    message: `//@->${node.id} aponta para "${node.id}" que não foi declarado. Crie //@${node.id} primeiro.`,
                    missingId: node.id
                });
            }
        }
    }

    // 2. Valida hierarquia: para cada sequence node, verifica se o pai imediato existe
    for (const [id, nodeInfo] of declaredIds) {
        // Só valida nós com pontos (sequence nodes)
        if (!id.includes('.')) continue;

        // Acha o pai imediato (ex: "Login1.1.1" → pai "Login1.1")
        const lastDot = id.lastIndexOf('.');
        const parentId = id.substring(0, lastDot);

        if (!declaredIdSet.has(parentId)) {
            errors.push({
                line: nodeInfo.line,
                message: `"${id}" (linha ${nodeInfo.line + 1}) tem pai "${parentId}" que não foi declarado. Crie //@${parentId} antes.`,
                missingId: parentId
            });
        }
    }

    // 3. Valida que todo entry node tem um grupo correspondente
    for (const [id, nodeInfo] of declaredIds) {
        // Identifica entry node: prefixo + número inteiro (ex: "Login1", "Signup2")
        const entryMatch = id.match(/^([a-zA-Z_]+)\d+$/);
        if (!entryMatch) continue;

        const groupId = entryMatch[1];
        if (!declaredIdSet.has(groupId)) {
            errors.push({
                line: nodeInfo.line,
                message: `"${id}" (linha ${nodeInfo.line + 1}) pertence ao grupo "${groupId}", mas o grupo não foi declarado. Crie //@${groupId} antes.`,
                missingId: groupId
            });
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