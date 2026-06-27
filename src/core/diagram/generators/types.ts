import { ProcessedNode } from '../parser';

/**
 * Interface que todo generator de diagrama deve implementar
 */
export interface DiagramGenerator {
    /** Unique identifier for the diagram type */
    type: string;
    /** Verifica se este generator atende ao diagramType informado */
    matches(diagramType: string): boolean;
    /** Generates the Mermaid code */
    generate(tags: ProcessedNode[], diagramType: string): string;
}

/**
 * Extracts the number(s) from a node ID for sorting.
 * Ex: "Login1" → [1], "Login1.1" → [1, 1], "Login1.1.2" → [1, 1, 2]
 */
export function extractNumbersFromId(id: string): number[] {
    const match = id.match(/\d+(\.\d+)*/g);
    if (!match) return [0];
    return match[0].split('.').map(Number);
}