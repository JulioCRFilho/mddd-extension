import { ProcessedNode } from '../parser';
import { DiagramGenerator } from './types';

/**
 * Extract attributes from a CREATE TABLE block
 */
function extractCreateTableAttributes(code: string): string[] {
    const attrs: string[] = [];
    
    // Find the block between parentheses
    const match = code.match(/CREATE\s+TABLE\s+\w+\s*\(([\s\S]+)\)/i);
    if (!match) return attrs;
    
    const columnsBlock = match[1];
    
    // Smart split by commas, respecting parentheses
    const lines: string[] = [];
    let current = '';
    let depth = 0;
    
    for (const char of columnsBlock) {
        if (char === '(') depth++;
        else if (char === ')') depth--;
        
        if (char === ',' && depth === 0) {
            lines.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    if (current.trim()) lines.push(current.trim());
    
    for (const line of lines) {
        // Ignore lines that are constraints (PRIMARY KEY, FOREIGN KEY, etc.)
        // Includes FULLTEXT which is an index type, not a column
        if (/^(PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT|INDEX|KEY|FULLTEXT)/i.test(line)) {
            continue;
        }
        
        // Extract the column name (first word before space or parenthesis)
        const columnMatch = line.match(/^(\w+)/);
        if (columnMatch) {
            attrs.push(columnMatch[1]);
        }
    }
    
    return attrs;
}

export const erGenerator: DiagramGenerator = {
    type: 'erDiagram',
    matches(diagramType: string): boolean {
        return diagramType.toLowerCase().startsWith('erdiagram');
    },
    generate(tags: ProcessedNode[], diagramType: string): string {
        let mermaid = `${diagramType}\n`;
        const entities = new Map<string, string[]>();
        const relationships: string[] = [];

        // First pass: collect entities and their attributes
        for (const tag of tags) {
            // Ignore relationships (tags with ->)
            if (tag.id.includes('->')) {
                continue;
            }

            // Entities (IDs without numbers)
            if (!/\d/.test(tag.id)) {
                if (!entities.has(tag.id)) {
                    entities.set(tag.id, []);
                }
                
                // Extract attributes from the SQL code in the label
                if (tag.label && tag.label.toUpperCase().startsWith('CREATE TABLE')) {
                    const attrs = extractCreateTableAttributes(tag.label);
                    entities.set(tag.id, attrs);
                }
            }
        }

        // Second pass: process relationships from node connections
        // Includes both normal tag connections and direct connections (//@Source->Target)
        for (const tag of tags) {
            // Process only nodes that have connections (ignores tags with -> in the ID, which are treated as connections)
            if (!tag.id.includes('->') && tag.connections && tag.connections.length > 0) {
                for (const conn of tag.connections) {
                    const label = conn.label || 'has';
                    // Labels with spaces or special characters (/, etc.) need quotes in Mermaid
                    const needsQuotes = /[\s\/\\,:;!@#$%^&*()+=]/.test(label);
                    const formattedLabel = needsQuotes ? `"${label}"` : label;

                    // Infer cardinality from label
                    // "has one", "billing", "shipping" = one-to-one (||--||)
                    // demais casos = one-to-many (||--o{)
                    let leftSide = tag.id;
                    let rightSide = conn.id;
                    let cardinality = '||--o{';

                    if (/^(has.one|billing|shipping)$/i.test(label.trim())) {
                        cardinality = '||--||';
                    }

                    // "references" indicates child->parent relationship (child FK points to parent)
                    // Invert direction to show parent->children in the diagram
                    if (/^references$/i.test(label.trim())) {
                        leftSide = conn.id;
                        rightSide = tag.id;
                    }

                    relationships.push(`    ${leftSide} ${cardinality} ${rightSide} : ${formattedLabel}`);
                }
            }
        }

        // Generate Mermaid
        for (const [entityName, attrs] of entities) {
            mermaid += `    ${entityName} {\n`;
            for (const attr of attrs) {
                mermaid += `        string ${attr.replace(/\s+/g, '_')}\n`;
            }
            mermaid += '    }\n';
        }
        
        for (const rel of relationships) {
            mermaid += rel + '\n';
        }

        return mermaid;
    }
};