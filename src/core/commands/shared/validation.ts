import { filterAllNodes } from '../../diagram/parser';
import { validateDiagram, ValidationResult } from '../../diagram/validator';

export type { ValidationResult } from '../../diagram/validator';

/**
 * Valida a estrutura MAD do diagrama
 */
export function validateMADStructure(document: import('vscode').TextDocument, prefix: string): ValidationResult {
    const allNodes = filterAllNodes(document);
    return validateDiagram(allNodes, prefix);
}

/**
 * Basic Mermaid syntax validation for Flowchart/Graph
 */
function validateFlowchartSyntax(lines: string[]): { valid: boolean; error?: string } {
    const hasNodes = lines.some(l => /^[A-Za-z0-9_]+\[/.test(l.trim()));
    const hasConnections = lines.some(l => /-->/.test(l) || /---/.test(l) || /==>/.test(l));

    if (!hasNodes && !hasConnections) {
        return {
            valid: false,
            error: 'No nodes or connections found. Check if the tags are correct.'
        };
    }

    const ids = new Set<string>();
    const idRegex = /^([A-Za-z0-9_]+)\[/;
    for (const line of lines) {
        const match = line.match(idRegex);
        if (match) {
            const id = match[1];
            if (ids.has(id)) return { valid: false, error: `Duplicate ID: "${id}".` };
            ids.add(id);
        }
    }

    return { valid: true };
}

/**
 * Mermaid syntax validation for Sequence Diagram
 */
function validateSequenceSyntax(lines: string[]): { valid: boolean; error?: string } {
    const hasParticipants = lines.some(l => l.trim().startsWith('participant'));
    const hasMessages = lines.some(l => l.includes('->>'));
    if (!hasParticipants && !hasMessages) {
        return {
            valid: false,
            error: 'No participants or messages found. Check the tags.'
        };
    }
    return { valid: true };
}

/**
 * Mermaid syntax validation for Class Diagram
 */
function validateClassSyntax(lines: string[]): { valid: boolean; error?: string } {
    const hasClasses = lines.some(l => l.trim().startsWith('class'));
    if (!hasClasses) {
        return {
            valid: false,
            error: 'No classes found. Check the tags.'
        };
    }
    return { valid: true };
}

/**
 * Mermaid syntax validation for State Diagram
 */
function validateStateSyntax(lines: string[]): { valid: boolean; error?: string } {
    const hasStates = lines.some(l => l.trim().startsWith('state'));
    const hasTransitions = lines.some(l => l.includes('-->'));
    if (!hasStates && !hasTransitions) {
        return {
            valid: false,
            error: 'No states or transitions found. Check the tags.'
        };
    }
    return { valid: true };
}

/**
 * Mermaid syntax validation for ER Diagram
 */
function validateERSyntax(lines: string[]): { valid: boolean; error?: string } {
    const hasEntities = lines.some(l => /\w+\s*\{/.test(l));
    if (!hasEntities) {
        return {
            valid: false,
            error: 'No entities found. Check the tags.'
        };
    }
    return { valid: true };
}

/**
 * Validates the Mermaid syntax based on the diagram type
 */
export function validateMermaidForType(mermaidCode: string, diagramType: string): { valid: boolean; error?: string } {
    const lines = mermaidCode.split('\n').filter(l => l.trim() && !l.trim().startsWith('subgraph'));
    const typeKey = diagramType.toLowerCase().replace(/\s+/g, '');

    if (typeKey.startsWith('flowchart') || typeKey.startsWith('graph')) {
        return validateFlowchartSyntax(lines);
    }
    if (typeKey.startsWith('sequencediagram')) {
        return validateSequenceSyntax(lines);
    }
    if (typeKey.startsWith('classdiagram')) {
        return validateClassSyntax(lines);
    }
    if (typeKey.startsWith('statediagram') || typeKey.includes('state')) {
        return validateStateSyntax(lines);
    }
    if (typeKey.startsWith('erdiagram')) {
        return validateERSyntax(lines);
    }

    // For other types, lenient validation
    return { valid: true };
}