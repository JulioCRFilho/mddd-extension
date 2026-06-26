import { ProcessedNode } from './parser';

/**
 * Extrai o(s) número(s) do ID de um nó para ordenação.
 * Ex: "Login1" → [1], "Login1.1" → [1, 1], "Login1.1.2" → [1, 1, 2]
 */
function extractNumbersFromId(id: string): number[] {
    const match = id.match(/\d+(\.\d+)*/g);
    if (!match) return [0];
    return match[0].split('.').map(Number);
}

/**
 * Gera o código Mermaid baseado no tipo de diagrama.
 */
export function generateMermaidDiagram(tags: ProcessedNode[], diagramType: string = 'flowchart TD'): string {
    if (tags.length === 0) {
        return `${diagramType}\n    A[Nenhuma tag relacionada encontrada]`;
    }

    const typeKey = diagramType.toLowerCase();

    if (typeKey.startsWith('flowchart') || typeKey.startsWith('graph')) {
        return generateFlowchart(tags, diagramType);
    }
    if (typeKey.startsWith('sequencediagram')) {
        return generateSequenceDiagram(tags, diagramType);
    }
    if (typeKey.startsWith('classdiagram')) {
        return generateClassDiagram(tags, diagramType);
    }
    if (typeKey.startsWith('statediagram') || typeKey.includes('state')) {
        return generateStateDiagram(tags, diagramType);
    }
    if (typeKey.startsWith('erdiagram')) {
        return generateERDiagram(tags, diagramType);
    }
    if (typeKey.startsWith('gantt')) {
        return generateGantt(tags, diagramType);
    }
    if (typeKey.startsWith('pie')) {
        return generatePie(tags, diagramType);
    }
    if (typeKey.startsWith('journey')) {
        return generateJourney(tags, diagramType);
    }

    // Fallback para flowchart
    return generateFlowchart(tags, diagramType);
}

// ─── FLOWCHART ──────────────────────────────────────────────────────────────

function generateFlowchart(tags: ProcessedNode[], diagramType: string): string {
    const groups = tags.filter(t => !/\d/.test(t.id));
    const numbered = tags.filter(t => /\d/.test(t.id));
    const sortedGroups = [...groups].sort((a, b) => a.id.localeCompare(b.id));

    const entryNodes = numbered.filter(t => /^[a-zA-Z]+[0-9]+$/.test(t.id));
    const sequenceNodes = numbered.filter(t => /\.[0-9]/.test(t.id));
    const syntheticNodes = numbered.filter(t => /^[a-zA-Z]+_[0-9]+$/.test(t.id));

    const sortedEntryNodes = [...entryNodes].sort((a, b) => {
        const numsA = extractNumbersFromId(a.id);
        const numsB = extractNumbersFromId(b.id);
        for (let i = 0; i < Math.max(numsA.length, numsB.length); i++) {
            const diff = (numsA[i] || 0) - (numsB[i] || 0);
            if (diff !== 0) return diff;
        }
        return 0;
    });

    const sortedSequenceNodes = [...sequenceNodes].sort((a, b) => {
        const numsA = extractNumbersFromId(a.id);
        const numsB = extractNumbersFromId(b.id);
        for (let i = 0; i < Math.max(numsA.length, numsB.length); i++) {
            const diff = (numsA[i] || 0) - (numsB[i] || 0);
            if (diff !== 0) return diff;
        }
        return 0;
    });

    let mermaid = `${diagramType}\n`;
    const idToNodeId = new Map<string, string>();
    let nodeIndex = 0;

    for (const group of sortedGroups) {
        const safeLabel = group.id.replace(/"/g, '"');
        mermaid += `    subgraph ${safeLabel}\n`;

        const groupEntryNodes = sortedEntryNodes.filter(entry =>
            entry.id.toLowerCase() === group.id.toLowerCase() || entry.id.toLowerCase().startsWith(group.id.toLowerCase())
        );

        for (const entry of groupEntryNodes) {
            const nodeId = `N${nodeIndex++}`;
            const safeLabel = entry.label.replace(/"/g, '"').replace(/\n/g, ' ');
            idToNodeId.set(entry.id, nodeId);
            mermaid += `        ${nodeId}["${safeLabel}"]\n`;
        }

        const groupSequenceNodes = sortedSequenceNodes.filter(seq =>
            seq.id.toLowerCase().startsWith(group.id.toLowerCase())
        );

        for (const seq of groupSequenceNodes) {
            const nodeId = `N${nodeIndex++}`;
            const safeLabel = seq.label.replace(/"/g, '"').replace(/\n/g, ' ');
            idToNodeId.set(seq.id, nodeId);
            mermaid += `        ${nodeId}["${safeLabel}"]\n`;
        }

        mermaid += `    end\n`;
    }

    for (const item of syntheticNodes) {
        const nodeId = `N${nodeIndex++}`;
        const safeLabel = item.label.replace(/"/g, '"').replace(/\n/g, ' ');
        idToNodeId.set(item.id, nodeId);
        mermaid += `    ${nodeId}["${safeLabel}"]\n`;
    }

    const edges = new Set<string>();
    const addEdge = (from: string, to: string, label?: string) => {
        const key = label ? `${from}->${to}:${label}` : `${from}->${to}`;
        if (edges.has(key)) return;
        edges.add(key);
        if (label && label.trim()) {
            mermaid += `    ${from} -->|${label.replace(/"/g, '"')}| ${to}\n`;
        } else {
            mermaid += `    ${from} --> ${to}\n`;
        }
    };

    for (const seq of sortedSequenceNodes) {
        const src = idToNodeId.get(seq.id);
        if (!src) continue;
        const lastDot = seq.id.lastIndexOf('.');
        if (lastDot > 0) {
            const parentId = seq.id.substring(0, lastDot);
            const parentNode = idToNodeId.get(parentId);
            if (parentNode && parentNode !== src) {
                const label = seq.description || undefined;
                addEdge(parentNode, src, label);
            }
        }
    }

    for (const item of [...sortedEntryNodes, ...sortedSequenceNodes, ...syntheticNodes]) {
        const src = idToNodeId.get(item.id);
        if (!src) continue;
        if (item.connections && item.connections.length > 0) {
            for (const conn of item.connections) {
                const dst = idToNodeId.get(conn.id);
                if (dst) addEdge(src, dst, conn.label || undefined);
            }
        }
    }

    return mermaid;
}

// ─── SEQUENCE DIAGRAM ───────────────────────────────────────────────────────

function generateSequenceDiagram(tags: ProcessedNode[], diagramType: string): string {
    let mermaid = `${diagramType}\n`;
    const participants: string[] = [];
    const participantSet = new Set<string>();
    const messages: string[] = [];

    // Mapa: sourceId → array de { targetId, label }
    const connections = new Map<string, Array<{ targetId: string; label: string }>>();

    for (const tag of tags) {
        if (!/\d/.test(tag.id)) {
            // Grupo = participante
            if (!participantSet.has(tag.id)) {
                participantSet.add(tag.id);
                participants.push(tag.id);
            }
            
            // Processa conexões do grupo (ex: //@Client->Server)
            if (tag.connections && tag.connections.length > 0) {
                if (!connections.has(tag.id)) {
                    connections.set(tag.id, []);
                }
                for (const conn of tag.connections) {
                    connections.get(tag.id)!.push({ targetId: conn.id, label: conn.label });
                    if (!participantSet.has(conn.id)) {
                        participantSet.add(conn.id);
                        participants.push(conn.id);
                    }
                }
            }
            continue;
        }

        // Conexões explícitas do entry node
        if (tag.connections && tag.connections.length > 0) {
            // Encontra o grupo pai deste entry node
            const groupId = tag.id.match(/^([a-zA-Z_]+)/)?.[1];
            if (groupId && participantSet.has(groupId)) {
                if (!connections.has(groupId)) {
                    connections.set(groupId, []);
                }
                for (const conn of tag.connections) {
                    connections.get(groupId)!.push({ targetId: conn.id, label: conn.label });
                    // Garante que o target é um participante
                    if (!participantSet.has(conn.id)) {
                        participantSet.add(conn.id);
                        participants.push(conn.id);
                    }
                }
            }
        }
    }

    // Groups com `->` no ID são conexões do tipo `Source->Target:label`
    for (const tag of tags) {
        if (tag.id.includes('->')) {
            const [source, target] = tag.id.split('->');
            if (source && target) {
                const sourceClean = source.trim();
                const targetClean = target.trim();
                
                if (!participantSet.has(sourceClean)) {
                    participantSet.add(sourceClean);
                    participants.push(sourceClean);
                }
                if (!participantSet.has(targetClean)) {
                    participantSet.add(targetClean);
                    participants.push(targetClean);
                }
                
                messages.push(`    ${sourceClean}->>${targetClean}: ${tag.description || tag.label}`);
            }
        }
    }

    // Gera participantes primeiro
    for (const p of participants) {
        mermaid += `    participant ${p}\n`;
    }

    // Gera mensagens das conexões de entry nodes
    for (const [sourceId, conns] of connections) {
        for (const conn of conns) {
            mermaid += `    ${sourceId}->>${conn.targetId}: ${conn.label || 'message'}\n`;
        }
    }

    // Gera mensagens de grupos com ->
    for (const msg of messages) {
        mermaid += msg + '\n';
    }

    return mermaid;
}

// ─── CLASS DIAGRAM ──────────────────────────────────────────────────────────

function generateClassDiagram(tags: ProcessedNode[], diagramType: string): string {
    let mermaid = `${diagramType}\n`;
    const classContents = new Map<string, string[]>();
    const relationships: string[] = [];

    for (const tag of tags) {
        if (!/\d/.test(tag.id)) {
            // Grupo = classe
            if (!classContents.has(tag.id)) {
                classContents.set(tag.id, []);
            }
            continue;
        }

        // Entry node = método da classe
        const groupMatch = tag.id.match(/^([a-zA-Z_]+)\d+/);
        if (groupMatch) {
            const groupId = groupMatch[1];
            if (classContents.has(groupId)) {
                classContents.get(groupId)!.push(`    +${tag.label}()`);
            }
        }

        // Conexões = relacionamentos
        if (tag.connections && tag.connections.length > 0) {
            for (const conn of tag.connections) {
                relationships.push(`${tag.id.match(/^([a-zA-Z_]+)/)?.[1] || tag.id} --> ${conn.id}`);
            }
        }
    }

    for (const [className, methods] of classContents) {
        mermaid += `    class ${className} {\n`;
        for (const method of methods) {
            mermaid += method + '\n';
        }
        mermaid += '    }\n';
    }

    for (const rel of relationships) {
        mermaid += `    ${rel}\n`;
    }

    return mermaid;
}

// ─── STATE DIAGRAM ──────────────────────────────────────────────────────────

function generateStateDiagram(tags: ProcessedNode[], diagramType: string): string {
    let mermaid = `${diagramType}\n`;
    const states = new Map<string, string[]>();
    const transitions: string[] = [];

    for (const tag of tags) {
        if (!/\d/.test(tag.id)) {
            // Grupo = estado
            if (!states.has(tag.id)) {
                states.set(tag.id, []);
            }
            continue;
        }

        // Entry node = ação dentro do estado
        const groupMatch = tag.id.match(/^([a-zA-Z_]+)\d+/);
        if (groupMatch) {
            const groupId = groupMatch[1];
            if (states.has(groupId)) {
                states.get(groupId)!.push(tag.label);
            }
        }

        // Conexões = transições
        if (tag.connections && tag.connections.length > 0) {
            for (const conn of tag.connections) {
                const source = tag.id.match(/^([a-zA-Z_]+)/)?.[1] || tag.id;
                transitions.push(`    ${source} --> ${conn.id}${conn.label ? ': ' + conn.label : ''}`);
            }
        }
    }

    // Conecta states aos seus entry nodes via transições pai-filho
    const edges = new Set<string>();
    for (const tag of tags) {
        if (tag.id.includes('.')) {
            const lastDot = tag.id.lastIndexOf('.');
            const parentId = tag.id.substring(0, lastDot);
            const parentTag = tags.find(t => t.id === parentId);
            if (parentTag) {
                const src = parentTag.id.match(/^([a-zA-Z_]+)/)?.[1] || parentTag.id;
                const dst = tag.id.match(/^([a-zA-Z_]+)/)?.[1] || tag.id;
                const key = `${src}->${dst}`;
                if (!edges.has(key)) {
                    edges.add(key);
                    transitions.push(`    ${src} --> ${dst}`);
                }
            }
        }
    }

    // Declara estados
    for (const stateId of states.keys()) {
        mermaid += `    state "${stateId}" {\n`;
        const actions = states.get(stateId) || [];
        for (const action of actions) {
            mermaid += `        ${stateId.toLowerCase()}_${action.replace(/\s+/g, '')} : ${action}\n`;
        }
        mermaid += '    }\n';
    }

    for (const trans of transitions) {
        mermaid += trans + '\n';
    }

    return mermaid;
}

// ─── ER DIAGRAM ─────────────────────────────────────────────────────────────

function generateERDiagram(tags: ProcessedNode[], diagramType: string): string {
    let mermaid = `${diagramType}\n`;
    const entities = new Map<string, string[]>();
    const relationships: string[] = [];

    for (const tag of tags) {
        if (!/\d/.test(tag.id)) {
            // Grupo = entidade
            if (!entities.has(tag.id)) {
                entities.set(tag.id, []);
            }
            continue;
        }

        // Entry node = atributo
        const groupMatch = tag.id.match(/^([a-zA-Z_]+)\d+/);
        if (groupMatch) {
            const groupId = groupMatch[1];
            if (entities.has(groupId)) {
                entities.get(groupId)!.push(tag.label);
            }
        }

        // Conexões = relacionamentos
        if (tag.connections && tag.connections.length > 0) {
            for (const conn of tag.connections) {
                relationships.push(`    ${tag.id.match(/^([a-zA-Z_]+)/)?.[1] || tag.id} ||--o{ ${conn.id} : ${conn.label || 'has'}`);
            }
        }
    }

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

// ─── GANTT ──────────────────────────────────────────────────────────────────

function generateGantt(tags: ProcessedNode[], diagramType: string): string {
    let mermaid = `${diagramType}\n`;

    for (const tag of tags) {
        if (!/\d/.test(tag.id)) {
            // Grupo = section
            mermaid += `    section ${tag.id}\n`;
            continue;
        }

        // Entry node = tarefa
        // Descrição tem o formato "Nome:after id, duração"
        const taskLabel = tag.label;
        const desc = tag.description || taskLabel;
        
        // Tenta extrair duração da descrição
        const durationMatch = desc.match(/(\d+)\s*(d|w|h)/);
        const duration = durationMatch ? `${durationMatch[1]}${durationMatch[2]}` : '1d';

        mermaid += `    ${taskLabel} : ${tag.id}, ${duration}\n`;
    }

    return mermaid;
}

// ─── PIE ────────────────────────────────────────────────────────────────────

function generatePie(tags: ProcessedNode[], diagramType: string): string {
    let mermaid = `${diagramType}\n`;

    for (const tag of tags) {
        if (!/\d/.test(tag.id)) {
            // Grupo é o título
            if (tag.description) {
                mermaid = `${diagramType} "${tag.id}"\n`;
            }
            continue;
        }

        // Entry node = item do pie
        // Descrição tem o valor numérico
        const label = tag.label;
        const value = tag.description || '10';
        mermaid += `    "${label}" : ${value}\n`;
    }

    return mermaid;
}

// ─── JOURNEY ────────────────────────────────────────────────────────────────

function generateJourney(tags: ProcessedNode[], diagramType: string): string {
    let mermaid = `${diagramType}\n`;
    const sections: Map<string, string[]> = new Map();

    for (const tag of tags) {
        if (!/\d/.test(tag.id)) {
            // Grupo = section
            if (!sections.has(tag.id)) {
                sections.set(tag.id, []);
            }
            continue;
        }

        // Entry node = task
        const groupMatch = tag.id.match(/^([a-zA-Z_]+)\d+/);
        if (groupMatch) {
            const groupId = groupMatch[1];
            if (sections.has(groupId)) {
                sections.get(groupId)!.push(tag.label);
            }
        }
    }

    // Concatena tudo em uma seção
    for (const [section, tasks] of sections) {
        mermaid += `    section ${section}\n`;
        for (const task of tasks) {
            mermaid += `      ${task}: 5: ${section}\n`;
        }
    }

    return mermaid;
}