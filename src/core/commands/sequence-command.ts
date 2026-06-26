import * as vscode from 'vscode';
import { BaseDiagramCommand } from './shared/base-command';
import { MDDDDiagramPanel } from '../ui/diagram-panel';
import { DiagramCommandContext, DiagramResult } from './shared/types';
import { findRelatedTagsWithOrder } from './shared/helpers';
import { readDiagramType } from '../diagram/parser';

/**
 * Command handler para diagramas do tipo Sequence Diagram.
 * Suporta: sequenceDiagram
 *
 * Sobrescreve o pipeline padrão para garantir que as mensagens
 * (conexões //@Source->Target) sejam renderizadas na ordem exata
 * em que aparecem no arquivo, independente de agrupamento por nó fonte.
 */
export class SequenceCommand extends BaseDiagramCommand {
    readonly type = 'sequence';

    matches(diagramType: string): boolean {
        return diagramType.toLowerCase().startsWith('sequencediagram');
    }

    /**
     * Gera o código Mermaid do sequence diagram respeitando a ordem
     * original das conexões no arquivo.
     */
    private generateSequenceMermaid(
        document: vscode.TextDocument,
        prefix: string,
        diagramType: string
    ): string {
        const result = findRelatedTagsWithOrder(document, prefix, diagramType);
        const { nodes, orderedDirectConnections } = result;

        let mermaid = `${diagramType}\n`;
        const participantSet = new Set<string>();
        const participants: string[] = [];
        const messages: Array<{ from: string; to: string; label: string }> = [];

        // Primeira passada: coleta todos os participantes (grupos) e entry nodes,
        // na ordem em que aparecem no arquivo
        const sortedByLine = [...nodes].sort((a, b) => a.line - b.line);

        for (const tag of sortedByLine) {
            // Coleta grupos (IDs sem números)
            if (!/\d/.test(tag.id) && !tag.id.includes('->')) {
                if (!participantSet.has(tag.id)) {
                    participantSet.add(tag.id);
                    participants.push(tag.id);
                }
            }
        }

        // Segunda passada: processa conexões das tags (//@->Target)
        // na ordem das linhas do arquivo
        for (const tag of sortedByLine) {
            if (tag.connections && tag.connections.length > 0) {
                const groupId = tag.id.match(/^([a-zA-Z_]+)/)?.[1];
                if (groupId && participantSet.has(groupId)) {
                    for (const conn of tag.connections) {
                        if (!participantSet.has(conn.id)) {
                            participantSet.add(conn.id);
                            participants.push(conn.id);
                        }
                        messages.push({
                            from: groupId,
                            to: conn.id,
                            label: conn.label || tag.label
                        });
                    }
                }
            }
        }

        // Terceira passada: conexões diretas (//@Source->Target)
        // na ORDEM ORIGINAL DO ARQUIVO
        for (const conn of orderedDirectConnections) {
            const sourceClean = conn.sourceId;
            const targetClean = conn.targetId;

            if (!participantSet.has(sourceClean)) {
                participantSet.add(sourceClean);
                participants.push(sourceClean);
            }
            if (!participantSet.has(targetClean)) {
                participantSet.add(targetClean);
                participants.push(targetClean);
            }

            messages.push({
                from: sourceClean,
                to: targetClean,
                label: conn.label || 'message'
            });
        }

        // Gera código Mermaid
        for (const p of participants) {
            mermaid += `    participant ${p}\n`;
        }
        for (const msg of messages) {
            mermaid += `    ${msg.from}->>${msg.to}: ${msg.label}\n`;
        }

        return mermaid;
    }

    /**
     * Sobrescreve execute() para usar a ordem correta das conexões.
     */
    execute(context: DiagramCommandContext): DiagramResult {
        const { document, prefix, extensionUri } = context;

        const diagramType = this.readDiagramType(document);

        // Validação MDDD
        const validation = this.validateMDDD(document, prefix);
        if (!validation.valid) {
            return { success: false, errorMessage: validation.error };
        }

        // Gera código Mermaid com ordenação correta
        const mermaidCode = this.generateSequenceMermaid(document, prefix, diagramType);

        // Pré-display hook
        const processedCode = this.beforeDisplay(mermaidCode, diagramType);

        // Validação Mermaid
        const mermaidValidation = this.validateMermaid(processedCode, diagramType);
        if (!mermaidValidation.valid) {
            return {
                success: false,
                errorMessage: `Erro de sintaxe Mermaid:\n${mermaidValidation.error}`
            };
        }

        // Exibe diagrama
        this.displayDiagram(extensionUri, processedCode);

        return { success: true };
    }
}