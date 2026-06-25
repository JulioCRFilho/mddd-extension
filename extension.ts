import * as vscode from 'vscode';

/**
 * Gerenciador de decorações com ícone de polvo na margem
 */
class MDDDDecorationManager {
    private decorationType: vscode.TextEditorDecorationType;
    
    constructor(iconPath: string) {
        this.decorationType = vscode.window.createTextEditorDecorationType({
            gutterIconPath: vscode.Uri.file(iconPath),
            gutterIconSize: 'contain',
            isWholeLine: true
        });
    }
    
    provideDecorations(document: vscode.TextDocument): vscode.DecorationOptions[] {
        const decorations: vscode.DecorationOptions[] = [];
        const text = document.getText();
        const lines = text.split(/\r?\n/);
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            if (line.match(/\/\/@([\w.]+)/)) {
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

/**
 * Utilitário para transformar nomes camelCase/snake_case em labels legíveis
 */
function toReadableLabel(name: string): string {
    let cleaned = name.replace(/^_+/, '');
    cleaned = cleaned.replace(/([a-z])([A-Z])/g, '$1 $2');
    cleaned = cleaned.replace(/[_-]+/g, ' ');
    cleaned = cleaned.replace(/\b\w/g, (char) => char.toUpperCase());
    cleaned = cleaned.trim().replace(/\s+/g, ' ');
    return cleaned;
}

/**
 * Extrai o identificador da linha imediatamente abaixo do comentário
 */
function extractIdentifierBelow(lineText: string): string | null {
    let code = lineText.replace(/^\s*\/\/.*$/, '').replace(/^\s*#.*$/, '').replace(/^\s*--.*$/, '');
    
    const keywords = /\b(class|function|const|let|var|interface|type|enum|struct|def|func|public|private|protected|static|async|await|import|export|from|return|if|else|for|while|do|switch|case|break|continue|new|this|super|extends|implements|abstract|final|override)\b/;
    
    let cleaned = code.replace(/^\s*/, '');
    while (keywords.test(cleaned)) {
        cleaned = cleaned.replace(keywords, '').trim();
    }
    
    const match = cleaned.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*[\(\)\[\]\{\}:=,;]?/);
    
    if (match && match[1]) {
        return match[1];
    }
    
    return null;
}

/**
 * Escaneia o documento para encontrar todas as tags //@ com o mesmo prefixo
 * Retorna tags com conexões adicionais
 */
function findRelatedTags(document: vscode.TextDocument, prefix: string): Array<{line: number, id: string, label: string, connections: string[]}> {
    const relatedTags: Array<{line: number, id: string, label: string, connections: string[]}> = [];
    const text = document.getText();
    const lines = text.split(/\r?\n/);
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const tagMatch = line.match(/\/\/@([\w.]+)/);
        
        if (tagMatch) {
            const fullId = tagMatch[1];
            // Ignora tags de conexão manual (//@->ID)
            if (fullId.startsWith('->')) continue;
            
            const tagPrefix = fullId.split(/[0-9]/)[0];
            
            if (tagPrefix.toLowerCase() === prefix.toLowerCase()) {
                let identifier: string | null = null;
                let connections: string[] = [];
                
                // Varre linhas seguintes para encontrar conexões manuais e o código
                let j = i + 1;
                
                // Primeiro, coleta todas as conexões manuais (//@->ID)
                while (j < lines.length) {
                    const nextLine = lines[j];
                    const connMatch = nextLine.match(/\/\/@->([\w.]+)/);
                    if (connMatch) {
                        connections.push(connMatch[1]);
                        j++;
                    } else {
                        break;
                    }
                }
                
                // A primeira linha que não é //@ nem //@-> é o código do nó
                if (j < lines.length) {
                    const codeLine = lines[j];
                    // Só extrai se não for uma tag
                    if (!codeLine.match(/\/\/@/)) {
                        identifier = extractIdentifierBelow(codeLine);
                    }
                }
                
                const label = identifier ? toReadableLabel(identifier) : fullId;
                
                relatedTags.push({
                    line: i,
                    id: fullId,
                    label: label,
                    connections: connections
                });
            }
        }
    }
    
    relatedTags.sort((a, b) => {
        const numsA = a.id.match(/\d+/g)?.map(Number) || [0];
        const numsB = b.id.match(/\d+/g)?.map(Number) || [0];
        
        for (let i = 0; i < Math.max(numsA.length, numsB.length); i++) {
            const numA = numsA[i] || 0;
            const numB = numsB[i] || 0;
            if (numA !== numB) return numA - numB;
        }
        return 0;
    });
    
    return relatedTags;
}

/**
 * Gera o código Mermaid graph TD baseado nas tags relacionadas
 */
function generateMermaidDiagram(tags: Array<{line: number, id: string, label: string, connections: string[]}>): string {
    if (tags.length === 0) {
        return 'graph TD\n    A[Nenhuma tag relacionada encontrada]';
    }
    
    const groups = tags.filter(t => !/\d/.test(t.id));
    const numbered = tags.filter(t => /\d/.test(t.id));
    
    const sortedGroups = [...groups].sort((a, b) => a.id.localeCompare(b.id));
    
    const sortedNumbered = [...numbered].sort((a, b) => {
        const numsA = a.id.match(/\d+/g)?.map(Number) || [0];
        const numsB = b.id.match(/\d+/g)?.map(Number) || [0];
        
        for (let i = 0; i < Math.max(numsA.length, numsB.length); i++) {
            const numA = numsA[i] || 0;
            const numB = numsB[i] || 0;
            if (numA !== numB) return numA - numB;
        }
        return 0;
    });
    
    let mermaid = 'graph TD\n';
    const idToNodeId = new Map<string, string>();
    let nodeIndex = 0;
    
    for (const group of sortedGroups) {
        const safeGroupLabel = group.label.replace(/"/g, '"');
        mermaid += `    subgraph ${safeGroupLabel}\n`;
        
        const groupItems = sortedNumbered.filter(item => {
            const parentId = findParentId(item.id, sortedGroups);
            return parentId === group.id || item.id.startsWith(group.id);
        });
        
        for (const item of groupItems) {
            const nodeId = `N${nodeIndex++}`;
            const safeLabel = item.label.replace(/"/g, '"');
            idToNodeId.set(item.id, nodeId);
            mermaid += `        ${nodeId}["${safeLabel}"]\n`;
        }
        
        mermaid += `    end\n`;
    }
    
    for (const item of sortedNumbered) {
        const currentNodeId = idToNodeId.get(item.id)!;
        const parentId = findParentId(item.id, sortedGroups);
        
        if (parentId && idToNodeId.has(parentId)) {
            const parentNodeId = idToNodeId.get(parentId)!;
            mermaid += `    ${parentNodeId} --> ${currentNodeId}\n`;
        }
        
        // Conexões manuais (//@->ID)
        if (item.connections && item.connections.length > 0) {
            for (const targetId of item.connections) {
                if (idToNodeId.has(targetId)) {
                    const targetNodeId = idToNodeId.get(targetId)!;
                    mermaid += `    ${currentNodeId} --> ${targetNodeId}\n`;
                }
            }
        }
    }
    
    return mermaid;
}

/**
 * Encontra o ID do pai de um item numerado
 */
function findParentId(id: string, groups: Array<{id: string}>): string | null {
    const lastDotIndex = id.lastIndexOf('.');
    if (lastDotIndex > 0) {
        const parentId = id.substring(0, lastDotIndex);
        return parentId;
    }
    
    const match = id.match(/^([a-zA-Z_]+)\d+$/);
    if (match) {
        const groupId = match[1];
        if (groups.some(g => g.id === groupId)) {
            return groupId;
        }
    }
    
    return null;
}

/**
 * Painel Webview para exibir diagramas Mermaid
 */
class MDDDDiagramPanel {
    public static currentPanel: MDDDDiagramPanel | undefined;
    public static readonly viewType = 'mddd.diagram';
    
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    
    public static createOrShow(extensionUri: vscode.Uri, mermaidCode: string) {
        const currentColumn = vscode.window.activeTextEditor?.viewColumn;
        if (currentColumn === undefined) return;
        
        const besideColumn = currentColumn + 1;
        
        if (MDDDDiagramPanel.currentPanel) {
            MDDDDiagramPanel.currentPanel._panel.reveal(besideColumn);
            MDDDDiagramPanel.currentPanel._update(mermaidCode);
            return;
        }
        
        const panel = vscode.window.createWebviewPanel(
            MDDDDiagramPanel.viewType,
            'Diagrama Mermaid',
            besideColumn,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );
        
        MDDDDiagramPanel.currentPanel = new MDDDDiagramPanel(panel, extensionUri, mermaidCode);
    }
    
    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, mermaidCode: string) {
        this._panel = panel;
        this._update(mermaidCode);
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    }
    
    private _update(mermaidCode: string) {
        const html = this._getHtmlForWebview(mermaidCode);
        this._panel.webview.html = html;
    }
    
    private _getHtmlForWebview(mermaidCode: string): string {
        const isDarkTheme = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark;
        
        const colors = isDarkTheme ? {
            primary: '#007acc',
            primaryText: '#fff',
            line: '#666',
            secondary: '#2d2d2d',
            tertiary: '#1e1e1e',
            background: '#1e1e1e',
            text: '#d4d4d4'
        } : {
            primary: '#007acc',
            primaryText: '#fff',
            line: '#666',
            secondary: '#f5f5f5',
            tertiary: '#fff',
            background: '#ffffff',
            text: '#333333'
        };
        
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Diagrama Mermaid</title>
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            background-color: ${colors.background};
            color: ${colors.text};
        }
        .mermaid {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 200px;
        }
    </style>
</head>
<body>
    <div class="mermaid">
        ${mermaidCode}
    </div>
    <script>
        mermaid.initialize({
            startOnLoad: true,
            theme: '${isDarkTheme ? 'dark' : 'default'}',
            themeVariables: {
                primaryColor: '${colors.primary}',
                primaryTextColor: '${colors.primaryText}',
                primaryBorderColor: '${colors.primary}',
                lineColor: '${colors.line}',
                secondaryColor: '${colors.secondary}',
                tertiaryColor: '${colors.tertiary}'
            }
        });
    </script>
</body>
</html>`;
    }
    
    public dispose() {
        MDDDDiagramPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}

/**
 * Ativa a extensão
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('MDDD Extension está ativa');
    
    // Caminho do ícone
    const iconPath = vscode.Uri.joinPath(context.extensionUri, 'assets', 'icon.png').fsPath;
    
    // Cria gerenciador de decorações
    const decorationManager = new MDDDDecorationManager(iconPath);
    context.subscriptions.push(decorationManager);
    
    // Atualiza decorações
    const updateDecorations = (editor: vscode.TextEditor) => {
        const decorations = decorationManager.provideDecorations(editor.document);
        decorationManager.apply(editor, decorations);
    };
    
    // Comando para mostrar diagrama
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
            
            const relatedTags = findRelatedTags(document, prefix);
            const mermaidCode = generateMermaidDiagram(relatedTags);
            
            MDDDDiagramPanel.createOrShow(context.extensionUri, mermaidCode);
        }
    );
    context.subscriptions.push(showDiagramCommand);
    
    // Detecta clique na linha com tag e abre diagrama automaticamente
    let lastClickLine = -1;
    const clickDetection = vscode.window.onDidChangeTextEditorSelection(event => {
        const editor = event.textEditor;
        if (!editor) return;
        
        const selection = editor.selection;
        if (!selection.isEmpty) return;
        
        const currentLine = selection.active.line;
        
        // Evita repetição do mesmo clique
        if (currentLine === lastClickLine) return;
        lastClickLine = currentLine;
        
        // Atualiza decorações
        updateDecorations(editor);
        
        // Se a linha tem tag, abre o diagrama
        const lineText = editor.document.lineAt(currentLine).text;
        if (lineText.match(/\/\/@([\w.]+)/)) {
            vscode.commands.executeCommand('mddd.showDiagram', currentLine);
        }
    });
    context.subscriptions.push(clickDetection);
    
    // Atualiza decorações quando o editor muda
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) updateDecorations(editor);
    }));
    
    // Atualiza decorações quando o documento muda
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(event => {
        const editor = vscode.window.activeTextEditor;
        if (editor && event.document === editor.document) updateDecorations(editor);
    }));
    
    // Aplica decorações iniciais
    if (vscode.window.activeTextEditor) {
        updateDecorations(vscode.window.activeTextEditor);
    }
}

/**
 * Desativa a extensão
 */
export function deactivate() {
    console.log('MDDD Extension foi desativada');
}