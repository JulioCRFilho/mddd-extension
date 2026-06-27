import { ProcessedNode } from '../parser';
import { DiagramGenerator } from './types';

export const stateGenerator: DiagramGenerator = {
    type: 'stateDiagram',
    matches(diagramType: string): boolean {
        const key = diagramType.toLowerCase();
        return key.startsWith('statediagram') || key.includes('state');
    },
    generate(tags: ProcessedNode[], diagramType: string): string {
        let mermaid = `${diagramType}\n`;
        const states = new Map<string, string[]>();
        const transitions: string[] = [];
        const addedEdges = new Set<string>();

        for (const tag of tags) {
            // Ignore direct connections (//@Source->Target) - they will be processed later
            if (tag.id.includes('->')) continue;

            // Main states (without numbers)
            if (!/\d/.test(tag.id)) {
                if (!states.has(tag.id)) states.set(tag.id, []);
                continue;
            }

            // Actions of a state (LoggedOut1, LoggedOut1.1, etc)
            const groupMatch = tag.id.match(/^([a-zA-Z_]+)\d+/);
            if (groupMatch) {
                const groupId = groupMatch[1];
                if (states.has(groupId)) {
                    // Format the action label: "Display login form" → "DisplayLoginForm"
                    const actionId = tag.label.replace(/\s+/g, '');
                    const displayLabel = tag.description || tag.label;
                    states.get(groupId)!.push(`${actionId}: ${displayLabel}`);
                }
            }
        }

        // Process tag.connections (coming from the diagram-command pipeline)
        // Includes both normal tag connections and direct connections (//@Source->Target)
        for (const tag of tags) {
            if (!/\d/.test(tag.id) && tag.connections && tag.connections.length > 0) {
                for (const conn of tag.connections) {
                    const key = `${tag.id}->${conn.id}`;
                    if (!addedEdges.has(key)) {
                        addedEdges.add(key);
                        transitions.push(`    ${tag.id} --> ${conn.id}${conn.label ? ': ' + conn.label : ''}`);
                    }
                }
            }
        }

        // Generate states (no quotes!)
        for (const stateId of states.keys()) {
            mermaid += `    state ${stateId} {\n`;
            const actions = states.get(stateId) || [];
            for (const action of actions) {
                mermaid += `        ${action}\n`;
            }
            mermaid += '    }\n';
        }

        // Add transitions
        for (const trans of transitions) mermaid += trans + '\n';

        return mermaid;
    }
};
