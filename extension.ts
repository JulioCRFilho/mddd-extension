import * as vscode from 'vscode';
import { MADDecorationManager } from './src/core/ui/decoration-manager';
import { validateAndDisplayDiagram, DiagramCommandContext } from './src/core/commands/diagram-command';
import { MADHoverProvider } from './src/core/ui/hover-provider';
import { MADDocumentSymbolProvider } from './src/core/ui/document-symbols';
import { MADFoldingProvider } from './src/core/ui/folding-provider';
import { filterAllNodes, readDiagramType } from './src/core/diagram/parser';

export function activate(context: vscode.ExtensionContext) {
    console.log('MAD is active');

    const iconPath = vscode.Uri.joinPath(context.extensionUri, 'assets', 'icon.png').fsPath;

    // ── Decoration Manager (gutter icon) ──
    const decorationManager = new MADDecorationManager(iconPath);
    context.subscriptions.push(decorationManager);

    const updateDecorations = (editor: vscode.TextEditor) => {
        const decorations = decorationManager.provideDecorations(editor.document);
        decorationManager.apply(editor, decorations);
    };

    // ── Command: Open diagram ──
    const showDiagramCommand = vscode.commands.registerCommand(
        'mad.showDiagram',
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

    // ── Command: Navigate to specific line ──
    const goToLineCommand = vscode.commands.registerCommand(
        'mad.goToLine',
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

    // ── Command: Open diagram for prefix under cursor ──
    const showDiagramAtCursorCommand = vscode.commands.registerCommand(
        'mad.showDiagramAtCursor',
        () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;

            const lineNumber = editor.selection.active.line;
            vscode.commands.executeCommand('mad.showDiagram', lineNumber);
        }
    );
    context.subscriptions.push(showDiagramAtCursorCommand);

    // ── Command: Show diagram statistics ──
    const showStatsCommand = vscode.commands.registerCommand(
        'mad.showStats',
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
                `**📊 MAD Stats**`,
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
            { language: 'c' },
            { language: 'sql' }
        ],
        new MADHoverProvider()
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
                { language: 'c' },
                { language: 'sql' }
            ],
            new MADFoldingProvider()
        )
    );

    // ── Comando: Colapsar todas as tags ──
    const foldAllTagsCommand = vscode.commands.registerCommand(
        'mad.foldAllTags',
        () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;
            vscode.commands.executeCommand('editor.foldAllMarkerRegions');
        }
    );
    context.subscriptions.push(foldAllTagsCommand);

    // ── Comando: Expandir todas as tags ──
    const unfoldAllTagsCommand = vscode.commands.registerCommand(
        'mad.unfoldAllTags',
        () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;
            vscode.commands.executeCommand('editor.unfoldAllMarkerRegions');
            // Marca cooldown de 5 minutos para este arquivo
            const fileKey = editor.document.uri.toString();
            unfoldCooldowns.set(fileKey, Date.now() + 5 * 60 * 1000);
        }
    );
    context.subscriptions.push(unfoldAllTagsCommand);

    // ── Auto-fold tags ao abrir arquivo (com cooldown de 5min após unfold) ──
    const unfoldCooldowns = new Map<string, number>();

    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(document => {
            const text = document.getText();
            if (!text.includes('//@')) return;

            const fileKey = document.uri.toString();
            const cooldownUntil = unfoldCooldowns.get(fileKey);
            
            // If on cooldown, don't fold
            if (cooldownUntil && Date.now() < cooldownUntil) return;

            setTimeout(() => {
                const editor = vscode.window.activeTextEditor;
                if (editor && editor.document === document) {
                    const cooldown = unfoldCooldowns.get(fileKey);
                    if (!cooldown || Date.now() >= cooldown) {
                        vscode.commands.executeCommand('editor.foldAllMarkerRegions');
                    }
                }
            }, 100);
        })
    );

    // Limpa cooldowns antigos (mais de 10 minutos)
    setInterval(() => {
        const now = Date.now();
        for (const [key, cooldown] of unfoldCooldowns.entries()) {
            if (now > cooldown + 10 * 60 * 1000) {
                unfoldCooldowns.delete(key);
            }
        }
    }, 60 * 1000);

    // ── DocumentSymbol Provider: outline with tag tree ──
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
                { language: 'c' },
                { language: 'sql' }
            ],
            new MADDocumentSymbolProvider()
        )
    );

    // ── Click detection to open diagram ──
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
            vscode.commands.executeCommand('mad.showDiagram', currentLine);
        }
    });
    context.subscriptions.push(clickDetection);

    // ── Change listeners ──
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) updateDecorations(editor);
    }));

    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(event => {
        const editor = vscode.window.activeTextEditor;
        if (editor && event.document === editor.document) updateDecorations(editor);
    }));

    // ── Update initial decorations ──
    if (vscode.window.activeTextEditor) {
        updateDecorations(vscode.window.activeTextEditor);
    }
}

export function deactivate() {
    console.log('MAD has been deactivated');
}