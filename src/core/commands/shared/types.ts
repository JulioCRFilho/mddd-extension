import * as vscode from 'vscode';

export interface DiagramCommandContext {
    document: vscode.TextDocument;
    prefix: string;
    extensionUri: vscode.Uri;
}

export interface DiagramResult {
    success: boolean;
    errorMessage?: string;
}

/**
 * Interface that every diagram command must implement.
 * Each diagram type (flowchart, sequence, class, state, er)
 * has its own implementation with specific Mermaid validation.
 */
export interface DiagramCommandHandler {
    /** Unique identifier for the diagram type */
    type: string;
    /** Checks if this handler matches the given diagram type */
    matches(diagramType: string): boolean;
    /** Executes the complete pipeline: validation, processing and display */
    execute(context: DiagramCommandContext): DiagramResult;
}