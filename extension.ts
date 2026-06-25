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
 * Utilitário para transformar nomes em labels legíveis
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
 * Extrai o identificador da linha, ignorando keywords
 */
function extractIdentifierBelow(lineText: string): string | null {
    let code = lineText.replace(/^\s*\/\/.*$/, '').replace(/^\s*#.*$/, '').replace(/^\s*--.*$/, '');
    
    const keywords = /\b(class|function|const|let|var|interface|type|enum|struct|def|func|public|private|protected|static|async|await|import|export|from|return|if|else|for|while|do|switch|case|break|continue|new|this|super|extends|implements|abstract|final|override|void|int|string|boolean|number|any|null|undefined|char|float|double|byte|short|long|signed|unsigned)\b/;
    
    let cleaned = code.replace(/^\s*/, '');
    while (keywords.test(cleaned)) {
        cleaned = cleaned.replace(keywords, '').trim();
    }
    
    const match = cleaned.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)/);
    
    if (match && match[1]) {
        return match[1];
    }
    
    return null;
}

/**
 * Escaneia o documento para encontrar todas as tags //@ com o mesmo prefixo
 * Conexões: //@->ID:comentário (comentário vai na seta, não no nó)
 */
function findRelatedTags(document: vscode.TextDocument, prefix: string): Array<{line: number, id: string, label: string, description: string | null, connections: Array<{id: string, label: string}>}> {
    const relatedTags: Array<{line: number, id: string, label: string, description: string | null, connections: Array<{id: string, label: string}>}> = [];
    const text = document.getText();
    const lines = text.split(/\r?\n/);
    
    // Primeiro passo: identifica todas as tags
    const allTags: Array<{line: number, id: string, description: string | null, isConnection: boolean, isArrow: boolean}> = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Verifica se é tag com seta //@->ID:comentário
        // Cria um nó independente a partir do código abaixo, com conexão para ID
        const connMatch = line.match(/\/\/@->([\w.]+)(?::([^\n]+))?/);
        if (connMatch) {
            const targetId = connMatch[1];
            const description = connMatch[2] ? connMatch[2].trim() : null;
            
            allTags.push({
                line: i,
                id: targetId,
                description: description,
                isConnection: false,
                isArrow: true
            });
            continue;
        }
        
        // Verifica se é tag normal //@ID:comentário (retroativo)
        // O comentário vira label na seta do nó anterior para este nó
        const tagMatch = line.match(/\/\/@([\w.]+)(?::([^\n]+))?/);
        
        if (tagMatch) {
            const fullId = tagMatch[1];
            const description = tagMatch[2] ? tagMatch[2].trim() : null;
            
            allTags.push({
                line: i,
                id: fullId,
                description: description,
                isConnection: false,
                isArrow: false
            });
        }
    }
    
    // Segundo passo: marca conexões (tags seguidas sem código)
    for (let i = 1; i < allTags.length; i++) {
        const prev = allTags[i - 1];
        const current = allTags[i];
        
        if (current.line === prev.line + 1) {
            current.isConnection = true;
        }
    }
    
    // Terceiro passo: coleta tags do prefixo
    for (const tag of allTags) {
        if (tag.isConnection) continue;
        
        // Extrai identificador do código (primeira linha não-//@)
        let identifier: string | null = null;
        let j = tag.line + 1;
        
        while (j < lines.length && lines[j].match(/\/\/@/)) {
            j++;
        }
        
        if (j < lines.length) {
            identifier = extractIdentifierBelow(lines[j]);
        }
        
        if (tag.isArrow) {
            // //@->TargetId:desc — cria nó a partir do código abaixo + seta para TargetId
            const sourceId = identifier || 'Unknown';
            const sourcePrefix = sourceId.split(/[0-9]/)[0];
            
            if (sourcePrefix.toLowerCase() !== prefix.toLowerCase()) continue;
            
            const label = identifier ? toReadableLabel(identifier) : tag.id;
            const connections: Array<{id: string, label: string}> = [];
            
            // Adiciona conexão deste nó para o targetId (tag.id)
            connections.push({
                id: tag.id,
                label: tag.description || ''
            });
            
            relatedTags.push({
                line: tag.line,
                id: sourceId,
                label: label,
                description: null,
                connections: connections
            });
            
            // Se o targetId não existe ainda como nó, precisamos adicioná-lo também
            // para que a seta tenha um destino visível
            const targetExists = allTags.some(
                t => t.id === tag.id && !t.isArrow && !t.isConnection
            );
            if (!targetExists) {
                // Cria nó para o target com id igual ao próprio targetId
                const targetLabel = toReadableLabel(tag.id);
                relatedTags.push({
                    line: tag.line,
                    id: tag.id,
                    label: targetLabel,
                    description: null,
                    connections: []
                });
            }
            
            continue;
        }
        
        const fullId = tag.id;
        const tagPrefix = fullId.split(/[0-9]/)[0];
        
        if (tagPrefix.toLowerCase() === prefix.toLowerCase()) {
            const connections: Array<{id: string, label: string}> = [];
            const tagIndex = allTags.indexOf(tag);
            
            for (let k = tagIndex + 1; k < allTags.length; k++) {
                const nextTag = allTags[k];
                if (nextTag.isConnection && nextTag.line === tag.line + (k - tagIndex)) {
                    connections.push({
                        id: nextTag.id,
                        label: nextTag.description || ''
                    });
                } else {
                    break;
                }
            }
            
            // Label do nó: sempre do código, nunca da tag
            const label = identifier ? toReadableLabel(identifier) : fullId;
            
            relatedTags.push({
                line: tag.line,
                id: fullId,
                label: label,
                description: tag.description,
                connections: connections
            });
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
 * Gera o código Mermaid graph TD baseado nas tags relacionadas
 */
function generateMermaidDiagram(tags: Array<{line: number, id: string, label: string, description: string | null, connections: Array<{id: string, label: string}>}>): string {
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
            // Se o item tem description (comentário do padrão //@ID:desc),
            // usa como label na seta do pai para o filho
            if (item.description && item.description.trim()) {
                const safeLabel = item.description.replace(/"/g, '"');
                mermaid += `    ${parentNodeId} -->|${safeLabel}| ${currentNodeId}\n`;
            } else {
                mermaid += `    ${parentNodeId} --> ${currentNodeId}\n`;
            }
        }
        
        // Conexões manuais com comentário na seta (formato: A -->|comentário| B)
        if (item.connections && item.connections.length > 0) {
            for (const conn of item.connections) {
                if (idToNodeId.has(conn.id)) {
                    const targetNodeId = idToNodeId.get(conn.id)!;
                    // Se tem comentário, adiciona na seta com |comentário|
                    if (conn.label && conn.label.trim()) {
                        const safeLabel = conn.label.replace(/"/g, '"');
                        mermaid += `    ${currentNodeId} -->|${safeLabel}| ${targetNodeId}\n`;
                    } else {
                        mermaid += `    ${currentNodeId} --> ${targetNodeId}\n`;
                    }
                }
            }
        }
    }
    
    return mermaid;
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
            
            const relatedTags = findRelatedTags(document, prefix);
            const mermaidCode = generateMermaidDiagram(relatedTags);
            
            MDDDDiagramPanel.createOrShow(context.extensionUri, mermaidCode);
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