import * as vscode from 'vscode';

/**
 * Gerenciador de decorações com ícone de polvo na margem
 */

// Regex para detectar linhas com //@ (qualquer linha que comece com //@)
export class MDDDDecorationManager {
    private decorationType: vscode.TextEditorDecorationType;

    constructor(iconPath: string) {
        this.decorationType = vscode.window.createTextEditorDecorationType({
            gutterIconPath: vscode.Uri.file(iconPath),
            gutterIconSize: 'contain',
            isWholeLine: false  // Apenas a gutter, não a linha inteira
        });
    }

    provideDecorations(document: vscode.TextDocument): vscode.DecorationOptions[] {
        const decorations: vscode.DecorationOptions[] = [];
        const text = document.getText();
        const lines = text.split(/\r?\n/);

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (line.match(/^\s*\/\/@/)) {
                const range = new vscode.Range(i, 0, i, 0);
                decorations.push({
                    range: range,
                    hoverMessage: 'Open diagram'
                });
            }
        }

        return decorations;
    }

    apply(editor: vscode.TextEditor, decorations: vscode.DecorationOptions[]) {
        editor.setDecorations(this.decorationType, decorations);
    }

    dispose() {
        this.decorationType.dispose();
    }
}
