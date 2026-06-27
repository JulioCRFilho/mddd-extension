import { ProcessedNode } from '../parser';
import { DiagramGenerator } from './types';
import { flowchartGenerator } from './flowchart';
import { sequenceGenerator } from './sequence';
import { classGenerator } from './class';
import { stateGenerator } from './state';
import { erGenerator } from './er';

/** List of all registered generators */
const generators: DiagramGenerator[] = [
    flowchartGenerator,
    sequenceGenerator,
    classGenerator,
    stateGenerator,
    erGenerator,
];

/**
 * Registers a new generator dynamically.
 * Useful for plugins or extensions.
 */
export function registerGenerator(generator: DiagramGenerator): void {
    generators.push(generator);
}

/**
 * Gets the appropriate generator for the given diagram type.
 */
export function getGenerator(diagramType: string): DiagramGenerator {
    for (const gen of generators) {
        if (gen.matches(diagramType)) return gen;
    }
    // Fallback to flowchart
    return flowchartGenerator;
}

/**
 * Generates the Mermaid code for the given diagram type and tags.
 * Delegates to the appropriate generator based on type.
 */
export function generateMermaidDiagram(tags: ProcessedNode[], diagramType: string = 'flowchart TD'): string {
    if (tags.length === 0) {
        return `${diagramType}\n    A[No related tags found]`;
    }
    const generator = getGenerator(diagramType);
    return generator.generate(tags, diagramType);
}