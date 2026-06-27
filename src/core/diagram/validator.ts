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
 * Validates the complete diagram structure:
 * 1. All //@-> point to existing IDs
 * 2. Every sequence node (X.Y) has an immediate parent (X) declared
 * 3. Every entry node (Login1) has a corresponding group (Login)
 * 4. Hierarchy is consistent (e.g. Login1.1.1 → Login1.1 → Login1 → Login)
 */
export function validateDiagram(
    allNodes: NodeInfo[],
    prefix: string
): ValidationResult {
    const errors: ValidationError[] = [];
    const prefixLower = prefix.toLowerCase();

    // Collects ALL declared IDs (not arrows)
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
            // Skip direct connections (//@Source->Target) - they don\t need to be declared
            if (node.id.includes('->')) continue;
            
            if (!declaredIdSet.has(node.id)) {
                errors.push({
                    line: node.line,
                    message: `//@->${node.id} points to "${node.id}" which has not been declared. Create //@${node.id} first.`,
                    missingId: node.id
                });
            }
        }
    }

    // 2. Valida hierarquia: para cada sequence node, verifica se o pai imediato existe
    for (const [id, nodeInfo] of declaredIds) {
        // Only validates nodes with dots (sequence nodes)
        if (!id.includes('.')) continue;

        // Acha o pai imediato (ex: "Login1.1.1" → pai "Login1.1")
        const lastDot = id.lastIndexOf('.');
        const parentId = id.substring(0, lastDot);

        if (!declaredIdSet.has(parentId)) {
            errors.push({
                line: nodeInfo.line,
                message: `"${id}" (linha ${nodeInfo.line + 1}) has parent "${parentId}" which has not been declared. Create //@${parentId} first.`,
                missingId: parentId
            });
        }
    }

    // 3. Valida que todo entry node tem um grupo correspondente
    for (const [id, nodeInfo] of declaredIds) {
        // Identifies entry node: prefix + integer number (e.g. "Login1", "Signup2")
        const entryMatch = id.match(/^([a-zA-Z_]+)\d+$/);
        if (!entryMatch) continue;

        const groupId = entryMatch[1];
        if (!declaredIdSet.has(groupId)) {
            errors.push({
                line: nodeInfo.line,
                message: `"${id}" (linha ${nodeInfo.line + 1}) belongs to group "${groupId}", but the group has not been declared. Create //@${groupId} first.`,
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
 * Finds the parent ID of a numbered item
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