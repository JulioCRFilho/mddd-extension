import * as vscode from 'vscode';
import { readDiagramType, ProcessedNode } from '../../diagram/parser';
import { generateMermaidDiagram } from '../../diagram/generator';
import { MDDDDiagramPanel } from '../../ui/diagram-panel';
import { DiagramCommandContext, DiagramResult, DiagramCommandHandler } from './types';
import { findRelatedTags } from './helpers';
import { validateMDDDStructure, validateMermaidForType } from './validation';

/**
 * Classe base abstrata para todos os comandos de diagrama.
 * Implementa o pipeline comum: validação MDDD → processamento de tags → geração Mermaid → validação Mermaid → exibição.
 * Cada tipo de diagrama precisa apenas implementar `matches()` e pode sobrescrever métodos para comportamento específico.
 */
export abstract class BaseDiagramCommand implements DiagramCommandHandler {
    abstract readonly type: string;
    abstract matches(diagramType: string): boolean;

    /**
     * Lê o tipo de diagrama da primeira linha do arquivo
     */
    protected readDiagramType(document: vscode.TextDocument): string {
        return readDiagramType(document);
    }

    /**
     * Valida a estrutura MDDD do diagrama (regras de hierarquia, referências, etc.)
     */
    protected validateMDDD(document: vscode.TextDocument, prefix: string): { valid: boolean; error?: string } {
        const result = validateMDDDStructure(document, prefix);
        if (!result.valid) {
            const errorMessages = result.errors.map(e =>
                `Linha ${e.line + 1}: ${e.message}`
            ).join('\n');
            return { valid: false, error: `Erro no diagrama:\n${errorMessages}` };
        }
        return { valid: true };
    }

    /**
     * Encontra e processa todas as tags relacionadas ao diagrama.
     * Usa a versão simples que retorna apenas ProcessedNode[].
     */
    protected findTags(document: vscode.TextDocument, prefix: string, diagramType: string): ProcessedNode[] {
        return findRelatedTags(document, prefix, diagramType);
    }

    /**
     * Gera o código Mermaid a partir das tags processadas
     */
    protected generateMermaid(tags: ProcessedNode[], diagramType: string): string {
        return generateMermaidDiagram(tags, diagramType);
    }

    /**
     * Valida a sintaxe Mermaid específica para este tipo de diagrama
     * Pode ser sobrescrito por subclasses para validação customizada
     */
    protected validateMermaid(mermaidCode: string, diagramType: string): { valid: boolean; error?: string } {
        return validateMermaidForType(mermaidCode, diagramType);
    }

    /**
     * Exibe o diagrama no painel webview
     */
    protected displayDiagram(extensionUri: vscode.Uri, mermaidCode: string): void {
        MDDDDiagramPanel.createOrShow(extensionUri, mermaidCode);
    }

    /**
     * Hook executado antes da validação MDDD.
     * Pode ser usado para pré-processamento específico do tipo de diagrama.
     */
    protected beforeValidation(_document: vscode.TextDocument, _prefix: string): void {
        // No-op por padrão
    }

    /**
     * Hook executado antes da exibição do diagrama.
     * Pode ser usado para pós-processamento do código Mermaid.
     */
    protected beforeDisplay(_mermaidCode: string, _diagramType: string): string {
        return _mermaidCode;
    }

    /**
     * Executa o pipeline completo do diagrama.
     * Subclasses podem sobrescrever este método para alterar o fluxo,
     * mas é recomendado usar os hooks para personalizações menores.
     */
    execute(context: DiagramCommandContext): DiagramResult {
        const { document, prefix, extensionUri } = context;

        // Step 1: Read diagram type
        const diagramType = this.readDiagramType(document);

        // Step 1.5: Pre-validation hook
        this.beforeValidation(document, prefix);

        // Step 2: Validate MDDD structure
        const validation = this.validateMDDD(document, prefix);
        if (!validation.valid) {
            return { success: false, errorMessage: validation.error };
        }

        // Step 3: Find and process related tags
        const relatedTags = this.findTags(document, prefix, diagramType);

        // Step 4: Generate Mermaid code
        let mermaidCode = this.generateMermaid(relatedTags, diagramType);

        // Step 5: Pre-display hook
        mermaidCode = this.beforeDisplay(mermaidCode, diagramType);

        // Step 6: Validate Mermaid syntax
        const mermaidValidation = this.validateMermaid(mermaidCode, diagramType);
        if (!mermaidValidation.valid) {
            return {
                success: false,
                errorMessage: `Erro de sintaxe Mermaid:\n${mermaidValidation.error}`
            };
        }

        // Step 7: Display diagram
        this.displayDiagram(extensionUri, mermaidCode);

        return { success: true };
    }
}