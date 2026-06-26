import { ProcessedNode } from '../parser';
import { DiagramGenerator } from './types';
import { flowchartGenerator } from './flowchart';
import { sequenceGenerator } from './sequence';
import { classGenerator } from './class';
import { stateGenerator } from './state';
import { erGenerator } from './er';
import { pieGenerator } from './pie';
import { journeyGenerator } from './journey';

/** Lista de todos os generators registrados */
const generators: DiagramGenerator[] = [
    flowchartGenerator,
    sequenceGenerator,
    classGenerator,
    stateGenerator,
    erGenerator,
    pieGenerator,
    journeyGenerator,
];

/**
 * Registra um novo generator dinamicamente.
 * Útil para plugins ou extensões.
 */
export function registerGenerator(generator: DiagramGenerator): void {
    generators.push(generator);
}

/**
 * Obtém o generator adequado para o tipo de diagrama informado.
 */
export function getGenerator(diagramType: string): DiagramGenerator {
    for (const gen of generators) {
        if (gen.matches(diagramType)) return gen;
    }
    // Fallback para flowchart
    return flowchartGenerator;
}

/**
 * Gera o código Mermaid para o tipo de diagrama e tags informados.
 * Delega para o generator adequado baseado no tipo.
 */
export function generateMermaidDiagram(tags: ProcessedNode[], diagramType: string = 'flowchart TD'): string {
    if (tags.length === 0) {
        return `${diagramType}\n    A[Nenhuma tag relacionada encontrada]`;
    }
    const generator = getGenerator(diagramType);
    return generator.generate(tags, diagramType);
}