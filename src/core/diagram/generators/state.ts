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
            // Ignora conexões diretas (//@Source->Target) - serão processadas depois
            if (tag.id.includes('->')) continue;

            // Estados principais (sem números)
            if (!/\d/.test(tag.id)) {
                if (!states.has(tag.id)) states.set(tag.id, []);
                continue;
            }

            // Ações de um estado (LoggedOut1, LoggedOut1.1, etc)
            const groupMatch = tag.id.match(/^([a-zA-Z_]+)\d+/);
            if (groupMatch) {
                const groupId = groupMatch[1];
                if (states.has(groupId)) {
                    // Formata o label da ação: "Display login form" → "DisplayLoginForm"
                    const actionId = tag.label.replace(/\s+/g, '');
                    states.get(groupId)!.push(`${actionId}: ${tag.label}`);
                }
            }
        }

        // Processa conexões de tag.connections (vindas do pipeline de diagram-command)
        // Inclui tanto conexões de tags normais quanto conexões diretas (//@Source->Target)
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

        // Gera os states (sem aspas!)
        for (const stateId of states.keys()) {
            mermaid += `    state ${stateId} {\n`;
            const actions = states.get(stateId) || [];
            for (const action of actions) {
                mermaid += `        ${action}\n`;
            }
            mermaid += '    }\n';
        }

        // Adiciona transições
        for (const trans of transitions) mermaid += trans + '\n';

        return mermaid;
    }
};
