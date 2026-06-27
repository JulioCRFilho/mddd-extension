import * as vscode from 'vscode';
import { readDiagramType, ProcessedNode } from '../../diagram/parser';
import { generateMermaidDiagram } from '../../diagram/generator';
import { MADDiagramPanel } from '../../ui/diagram-panel';
import { DiagramCommandContext, DiagramResult, DiagramCommandHandler } from './types';
import { findRelatedTags } from './helpers';
import { validateMADStructure, validateMermaidForType } from './validation';

/**
 * Abstract base class for all diagram commands.
 * Implements the common pipeline: MAD validation → tag processing → Mermaid generation → Mermaid validation → display.
 * Each diagram type only needs to implement `matches()` and can override methods for specific behavior.
 */
export abstract class BaseDiagramCommand implements DiagramCommandHandler {
    abstract readonly type: string;
    abstract matches(diagramType: string): boolean;

    /**
     * Reads the diagram type from the first line of the file
     */
    protected readDiagramType(document: vscode.TextDocument): string {
        return readDiagramType(document);
    }

    /**
     * Validates the MAD diagram structure (hierarchy rules, references, etc.)
     */
    protected validateMAD(document: vscode.TextDocument, prefix: string): { valid: boolean; error?: string } {
        const result = validateMADStructure(document, prefix);
        if (!result.valid) {
            const errorMessages = result.errors.map(e =>
                `Line ${e.line + 1}: ${e.message}`
            ).join('\n');
            return { valid: false, error: `Diagram error:\n${errorMessages}` };
        }
        return { valid: true };
    }

    /**
     * Finds and processes all tags related to the diagram.
     * Uses the simple version that returns only ProcessedNode[].
     */
    protected findTags(document: vscode.TextDocument, prefix: string, diagramType: string): ProcessedNode[] {
        return findRelatedTags(document, prefix, diagramType);
    }

    /**
     * Generates the Mermaid code from the processed tags
     */
    protected generateMermaid(tags: ProcessedNode[], diagramType: string): string {
        return generateMermaidDiagram(tags, diagramType);
    }

    /**
     * Validates the Mermaid syntax specific to this diagram type
     * Can be overridden by subclasses for custom validation
     */
    protected validateMermaid(mermaidCode: string, diagramType: string): { valid: boolean; error?: string } {
        return validateMermaidForType(mermaidCode, diagramType);
    }

    /**
     * Displays the diagram in the webview panel
     */
    protected displayDiagram(extensionUri: vscode.Uri, mermaidCode: string): void {
        MADDiagramPanel.createOrShow(extensionUri, mermaidCode);
    }

    /**
     * Hook executed before MAD validation.
     * Can be used for diagram type-specific pre-processing.
     */
    protected beforeValidation(_document: vscode.TextDocument, _prefix: string): void {
        // No-op by default
    }

    /**
     * Hook executed before diagram display.
     * Can be used for post-processing of the Mermaid code.
     */
    protected beforeDisplay(_mermaidCode: string, _diagramType: string): string {
        return _mermaidCode;
    }

    /**
     * Executes the complete diagram pipeline.
     * Subclasses can override this method to change the flow,
     * but using the hooks for minor customizations is recommended.
     */
    execute(context: DiagramCommandContext): DiagramResult {
        const { document, prefix, extensionUri } = context;

        // Step 1: Read diagram type
        const diagramType = this.readDiagramType(document);

        // Step 1.5: Pre-validation hook
        this.beforeValidation(document, prefix);

        // Step 2: Validate MAD structure
        const validation = this.validateMAD(document, prefix);
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
                errorMessage: `Mermaid syntax error:\n${mermaidValidation.error}`
            };
        }

        // Step 7: Display diagram
        this.displayDiagram(extensionUri, mermaidCode);

        return { success: true };
    }
}