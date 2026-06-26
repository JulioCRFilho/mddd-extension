import * as vscode from 'vscode';
import { MDDDDecorationManager } from './src/core/ui/decoration-manager';
import { validateAndDisplayDiagram, DiagramCommandContext } from './src/core/commands/diagram-command';
import { MDDDHoverProvider } from './src/core/ui/hover-provider';
import { MDDDDocumentSymbolProvider } from './src/core/ui/document-symbols';
import { MDDDFoldingProvider } from './src/core/ui/folding-provider';
import { filterAllNodes, readDiagramType } from './src/core/diagram/parser';

export function activate(context: vscode.ExtensionContext) {
    console.log('MDDD Extension está ativa');

    const iconPath = vscode.Uri.joinPath(context.extensionUri, 'assets', 'icon.png').fsPath;

    // ── Decoration Manager (ícone na gutter) ──
    const decorationManager = new MDDDDecorationManager(iconPath);
    context.subscriptions.push(decorationManager);

    const updateDecorations = (editor: vscode.TextEditor) => {
        const decorations = decorationManager.provideDecorations(editor.document);
        decorationManager.apply(editor, decorations);
    };

    // ── Comando: Abrir diagrama ──
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

    // ── Comando: Navegar para linha específica ──
    const goToLineCommand = vscode.commands.registerCommand(
        'mddd.goToLine',
        (lineNumber: number) => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;

            const line = Math.max(0, Math.min(lineNumber, editor.document.lineCount - 1));
            const targetRange = new vscode.Range(line, 0, line, 0);
            editor.selection = new vscode.Selection(line, 0, line, 0);
            editor.revealRange(targetRange, vscode.TextEditorRevealType.InCenter);
        }
    );
    context.subscriptions.push(goToLineCommand);

    // ── Comando: Abrir diagrama do prefixo sob o cursor ──
    const showDiagramAtCursorCommand = vscode.commands.registerCommand(
        'mddd.showDiagramAtCursor',
        () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;

            const lineNumber = editor.selection.active.line;
            vscode.commands.executeCommand('mddd.showDiagram', lineNumber);
        }
    );
    context.subscriptions.push(showDiagramAtCursorCommand);

    // ── Comando: Mostrar estatísticas do diagrama ──
    const showStatsCommand = vscode.commands.registerCommand(
        'mddd.showStats',
        () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;

            const allNodes = filterAllNodes(editor.document);
            const diagramType = readDiagramType(editor.document);

            const declared = allNodes.filter((n: { isArrow: boolean }) => !n.isArrow);
            const forward = allNodes.filter((n: { isArrow: boolean }) => n.isArrow);

            const groups = declared.filter((n: { id: string }) => !/\d/.test(n.id));
            const entries = declared.filter((n: { id: string }) => /^[a-zA-Z_]+[0-9]+$/.test(n.id));
            const sequences = declared.filter((n: { id: string }) => /\.[0-9]+/.test(n.id));

            const msg = [
                `**📊 MDDD Stats**`,
                ``,
                `**Tipo:** \`${diagramType}\``,
                `**Total de tags:** ${allNodes.length}`,
                ``,
                `**Declarados:** ${declared.length}`,
                `  ┣ Grupos: ${groups.length}`,
                `  ┣ Entry Nodes: ${entries.length}`,
                `  ┗ Sequence Nodes: ${sequences.length}`,
                `**Forward Pointers:** ${forward.length}`,
            ].join('\n');

            vscode.window.showInformationMessage(msg, { modal: false });
        }
    );
    context.subscriptions.push(showStatsCommand);

    // ── Hover Provider: tooltip com informações da tag ──
    const hoverProvider = vscode.languages.registerHoverProvider(
        [
            { language: 'javascript' },
            { language: 'typescript' },
            { language: 'python' },
            { language: 'java' },
            { language: 'csharp' },
            { language: 'go' },
            { language: 'rust' },
            { language: 'php' },
            { language: 'dart' },
            { language: 'ruby' },
            { language: 'swift' },
            { language: 'kotlin' },
            { language: 'scala' },
            { language: 'cpp' },
            { language: 'c' }
        ],
        new MDDDHoverProvider()
    );
    context.subscriptions.push(hoverProvider);

    // ── FoldingRange Provider: esconder/expandir blocos de tags ──
    context.subscriptions.push(
        vscode.languages.registerFoldingRangeProvider(
            [
                { language: 'javascript' },
                { language: 'typescript' },
                { language: 'python' },
                { language: 'java' },
                { language: 'csharp' },
                { language: 'go' },
                { language: 'rust' },
                { language: 'php' },
                { language: 'dart' },
                { language: 'ruby' },
                { language: 'swift' },
                { language: 'kotlin' },
                { language: 'scala' },
                { language: 'cpp' },
                { language: 'c' }
            ],
            new MDDDFoldingProvider()
        )
    );

    // ── Comando: Colapsar todas as tags ──
    const foldAllTagsCommand = vscode.commands.registerCommand(
        'mddd.foldAllTags',
        () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;
            vscode.commands.executeCommand('editor.foldAllMarkerRegions');
        }
    );
    context.subscriptions.push(foldAllTagsCommand);

    // ── Comando: Expandir todas as tags ──
    const unfoldAllTagsCommand = vscode.commands.registerCommand(
        'mddd.unfoldAllTags',
        () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;
            vscode.commands.executeCommand('editor.unfoldAllMarkerRegions');
        }
    );
    context.subscriptions.push(unfoldAllTagsCommand);

    // ── Auto-fold tags APENAS na primeira abertura do arquivo ──
    const foldedFiles = new Set<string>();

    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(document => {
            const text = document.getText();
            if (!text.includes('//@')) return;

            const fileKey = document.uri.toString();
            // Só folda se nunca foi aberto antes
            if (!foldedFiles.has(fileKey)) {
                foldedFiles.add(fileKey);
                setTimeout(() => {
                    const editor = vscode.window.activeTextEditor;
                    if (editor && editor.document === document) {
                        vscode.commands.executeCommand('editor.foldAllMarkerRegions');
                    }
                }, 100);
            }
        })
    );

    // ── DocumentSymbol Provider: outline com árvore de tags ──
    context.subscriptions.push(
        vscode.languages.registerDocumentSymbolProvider(
            [
                { language: 'javascript' },
                { language: 'typescript' },
                { language: 'python' },
                { language: 'java' },
                { language: 'csharp' },
                { language: 'go' },
                { language: 'rust' },
                { language: 'php' },
                { language: 'dart' },
                { language: 'ruby' },
                { language: 'swift' },
                { language: 'kotlin' },
                { language: 'scala' },
                { language: 'cpp' },
                { language: 'c' }
            ],
            new MDDDDocumentSymbolProvider()
        )
    );

    // ── Click detection para abrir diagrama ──
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

    // ── Listeners de mudança ──
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) updateDecorations(editor);
    }));

    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(event => {
        const editor = vscode.window.activeTextEditor;
        if (editor && event.document === editor.document) updateDecorations(editor);
    }));

    // ── Atualiza decorações iniciais ──
    if (vscode.window.activeTextEditor) {
        updateDecorations(vscode.window.activeTextEditor);
    }
}

export function deactivate() {
    console.log('MDDD Extension foi desativada');
}