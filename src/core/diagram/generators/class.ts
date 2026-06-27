import { ProcessedNode } from '../parser';
import { DiagramGenerator } from './types';

export const classGenerator: DiagramGenerator = {
    type: 'classDiagram',
    matches(diagramType: string): boolean {
        return diagramType.toLowerCase().startsWith('classdiagram');
    },
    generate(tags: ProcessedNode[], diagramType: string): string {
        let mermaid = `${diagramType}\n`;
        const classContents = new Map<string, string[]>();
        const relationships: string[] = [];

        for (const tag of tags) {
            if (!/\d/.test(tag.id)) {
                if (!classContents.has(tag.id)) classContents.set(tag.id, []);
                continue;
            }

            const groupMatch = tag.id.match(/^([a-zA-Z_]+)\d+/);
            if (groupMatch) {
                const groupId = groupMatch[1];
                if (classContents.has(groupId)) classContents.get(groupId)!.push(`    +${tag.label}()`);
            }

            if (tag.connections && tag.connections.length > 0) {
                for (const conn of tag.connections) {
                    const arrow = conn.arrowPrefix || '-->';
                    const className = tag.id.match(/^([a-zA-Z_]+)/)?.[1] || tag.id;
                    const label = conn.label ? ` : ${conn.label}` : '';
                    // Inheritance (<|--) needs swapped order because //@<|--Parent:inherits
                    // means "Child inherits from Parent", but Mermaid requires Parent <|-- Child
                    if (arrow === '<|--') {
                        relationships.push(`${conn.id} ${arrow} ${className}${label}`);
                    } else {
                        relationships.push(`${className} ${arrow} ${conn.id}${label}`);
                    }
                }
            }
        }

        for (const [className, methods] of classContents) {
            mermaid += `    class ${className} {\n`;
            for (const method of methods) mermaid += method + '\n';
            mermaid += '    }\n';
        }
        for (const rel of relationships) mermaid += `    ${rel}\n`;

        return mermaid;
    }
};