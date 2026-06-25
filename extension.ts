import * as vscode from 'vscode';
import { MDDDDecorationManager } from './src/core/ui/decoration-manager';
import { validateAndDisplayDiagram, DiagramCommandContext } from './src/core/commands/diagram-command';

export function activate(context: vscode.ExtensionContext) {
    console.log('MDDD Extension está ativa');

    const iconPath = vscode.Uri.joinPath(context.extensionUri, 'assets', 'icon.png').fsPath;

    const decorationManager = new MDDDDecorationManager(iconPath);
    context.subscriptions.push(decorationManager);

    const updateDecorations = (editor: vscode.TextEditor) => {
        const decorations = decorationManager.provideDecorations(editor.document);
        decorationManager.apply(editor, decorations);
    };

    const showDiagramCommand = vscode.commands.registerCommand(
        'mddd.showDiagram',
        (lineNumber: number) => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;

            const document = editor.document;
            const lineText = document.lineAt(lineNumber).text;
            const tagMatch = lineText.match(/\/\/@([\w.]+)/);
            if (!tagMatch) return;

            const fullId = tagMatch[1];
            const prefix = fullId.split(/[0-9]/)[0];

            const diagramContext: DiagramCommandContext = {
                document: document,
                prefix: prefix,
                extensionUri: context.extensionUri
            };

            const result = validateAndDisplayDiagram(diagramContext);

            if (!result.success && result.errorMessage) {
                vscode.window.showErrorMessage(result.errorMessage);
            }
        }
    );
    context.subscriptions.push(showDiagramCommand);

    let lastClickLine = -1;
    const clickDetection = vscode.window.onDidChangeTextEditorSelection(event => {
        const editor = event.textEditor;
        if (!editor) return;

        const selection = editor.selection;
        if (!selection.isEmpty) return;

        const currentLine = selection.active.line;

        if (currentLine === lastClickLine) return;
        lastClickLine = currentLine;

        updateDecorations(editor);

        const lineText = editor.document.lineAt(currentLine).text;
        if (lineText.match(/\/\/@([\w.]+)/)) {
            vscode.commands.executeCommand('mddd.showDiagram', currentLine);
        }
    });
    context.subscriptions.push(clickDetection);

    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) updateDecorations(editor);
    }));

    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(event => {
        const editor = vscode.window.activeTextEditor;
        if (editor && event.document === editor.document) updateDecorations(editor);
    }));

    if (vscode.window.activeTextEditor) {
        updateDecorations(vscode.window.activeTextEditor);
    }
}

export function deactivate() {
    console.log('MDDD Extension foi desativada');
}