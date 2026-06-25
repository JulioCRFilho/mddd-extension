import * as vscode from 'vscode';

/**
 * CodeLens que aparece acima de linhas com tags //@
 */
class MDDDCodeLensProvider implements vscode.CodeLensProvider {
    
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;
    
    provideCodeLenses(
        document: vscode.TextDocument,
        token: vscode.CancellationToken
    ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
        
        const codeLenses: vscode.CodeLens[] = [];
        const text = document.getText();
        const lines = text.split(/\r?\n/);
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Verifica se a linha contém uma tag //@
            if (line.match(/\/\/@([\w.]+)/)) {
                const range = new vscode.Range(i, 0, i, 0);
                const codeLens = new vscode.CodeLens(range, {
                    title: '📊 Ver Diagrama',
                    command: 'mddd.showDiagram',
                    arguments: [document.uri, i]
                });
                codeLenses.push(codeLens);
            }
        }
        
        return codeLenses;
    }
    
    resolveCodeLens(
        codeLens: vscode.CodeLens,
        token: vscode.CancellationToken
    ): vscode.CodeLens | Thenable<vscode.CodeLens> {
        return codeLens;
    }
}

/**
 * Utilitário para transformar nomes camelCase/snake_case em labels legíveis
 */
function toReadableLabel(name: string): string {
    // Remove prefixos de underscore
    let cleaned = name.replace(/^_+/, '');
    
    // Insere espaço antes de letras maiúsculas (camelCase)
    cleaned = cleaned.replace(/([a-z])([A-Z])/g, '$1 $2');
    
    // Substitui underscores e hífens por espaços (snake_case/kebab-case)
    cleaned = cleaned.replace(/[_-]+/g, ' ');
    
    // Capitaliza primeira letra de cada palavra
    cleaned = cleaned.replace(/\b\w/g, (char) => char.toUpperCase());
    
    // Remove espaços extras
    cleaned = cleaned.trim().replace(/\s+/g, ' ');
    
    return cleaned;
}

/**
 * Extrai o identificador da linha imediatamente abaixo do comentário
 */
function extractIdentifierBelow(lineText: string): string | null {
    // Remove comentários de linha (//, #, --, etc)
    let code = lineText.replace(/^\s*\/\/.*$/, '').replace(/^\s*#.*$/, '').replace(/^\s*--.*$/, '');
    
    // Padrão para capturar identificadores: letras, números, underscore
    const match = code.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*[\(\)\[\]\{\}:=,;]?/);
    
    if (match && match[1]) {
        return match[1];
    }
    
    return null;
}

/**
 * Escaneia o documento para encontrar todas as tags //@ com o mesmo prefixo
 */
function findRelatedTags(document: vscode.TextDocument, prefix: string): Array<{line: number, id: string, label: string}> {
    const relatedTags: Array<{line: number, id: string, label: string}> = [];
    const text = document.getText();
    const lines = text.split(/\r?\n/);
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const tagMatch = line.match(/\/\/@([\w.]+)/);
        
        if (tagMatch) {
            const fullId = tagMatch[1];
            const tagPrefix = fullId.split(/[0-9]/)[0]; // Extrai prefixo antes dos números
            
            if (tagPrefix.toLowerCase() === prefix.toLowerCase()) {
                // Tenta extrair identificador na linha abaixo
                let identifier: string | null = null;
                if (i + 1 < lines.length) {
                    identifier = extractIdentifierBelow(lines[i + 1]);
                }
                
                const label = identifier ? toReadableLabel(identifier) : fullId;
                
                relatedTags.push({
                    line: i,
                    id: fullId,
                    label: label
                });
            }
        }
    }
    
    return relatedTags;
}

/**
 * Gera o código Mermaid graph TD baseado nas tags relacionadas
 */
function generateMermaidDiagram(tags: Array<{line: number, id: string, label: string}>): string {
    if (tags.length === 0) {
        return 'graph TD\n    A[Nenhuma tag relacionada encontrada]';
    }
    
    // Ordena por número do ID para manter ordem hierárquica
    const sorted = [...tags].sort((a, b) => {
        const numA = parseInt(a.id.match(/\d+/)![0]) || 0;
        const numB = parseInt(b.id.match(/\d+/)![0]) || 0;
        return numA - numB;
    });
    
    let mermaid = 'graph TD\n';
    
    // Cria nós e conexões hierárquicas
    for (let i = 0; i < sorted.length; i++) {
        const current = sorted[i];
        const nodeId = `N${i}`;
        const safeLabel = current.label.replace(/"/g, '"');
        
        mermaid += `    ${nodeId}["${safeLabel}"]\n`;
        
        // Conecta ao anterior (hierarquia linear)
        if (i > 0) {
            const prevNode = `N${i - 1}`;
            mermaid += `    ${prevNode} --> ${nodeId}\n`;
        }
    }
    
    return mermaid;
}

/**
 * Hover Provider para comentários //@ID
 */
class MDDDHoverProvider implements vscode.HoverProvider {
    
    provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.Hover> {
        
        console.log('[MDDD] provideHover called at line:', position.line);
        
        const line = document.lineAt(position.line);
        const lineText = line.text;
        console.log('[MDDD] lineText:', lineText);
        
        // Verifica se a linha contém uma tag //@
        const tagMatch = lineText.match(/\/\/@([\w.]+)/);
        console.log('[MDDD] tagMatch:', tagMatch);
        
        if (!tagMatch) {
            console.log('[MDDD] No tag match, returning null');
            return null;
        }
        
        const fullId = tagMatch[1];
        const prefix = fullId.split(/[0-9]/)[0];
        
        // Encontra todas as tags relacionadas
        const relatedTags = findRelatedTags(document, prefix);
        console.log('[MDDD] relatedTags count:', relatedTags.length);
        
        if (relatedTags.length === 0) {
            console.log('[MDDD] No related tags, returning null');
            return null;
        }
        
        // Gera diagrama Mermaid
        const mermaidCode = generateMermaidDiagram(relatedTags);
        
        // Cria conteúdo do hover
        const hoverContent = new vscode.MarkdownString();
        hoverContent.isTrusted = true;
        hoverContent.appendMarkdown(`**Tag:** \`//@${fullId}\`\n\n`);
        hoverContent.appendMarkdown(`**Prefixo:** \`${prefix}\`\n\n`);
        hoverContent.appendMarkdown(`**Tags relacionadas:** ${relatedTags.length}\n\n`);
        hoverContent.appendMarkdown('---\n\n');
        hoverContent.appendMarkdown(mermaidCode);
        
        // Aplica hover na linha do comentário
        const hoverRange = new vscode.Range(
            position.line,
            0,
            position.line,
            lineText.length
        );
        
        console.log('[MDDD] Returning hover with', relatedTags.length, 'tags');
        return new vscode.Hover(hoverContent, hoverRange);
    }
}

/**
 * Ativa a extensão
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('MDDD Hover Extension está ativa');
    
    // Registra o CodeLensProvider
    const codeLensProvider = vscode.languages.registerCodeLensProvider(
        { scheme: 'file' },
        new MDDDCodeLensProvider()
    );
    context.subscriptions.push(codeLensProvider);
    
    // Registra o comando para mostrar diagrama
    const showDiagramCommand = vscode.commands.registerCommand(
        'mddd.showDiagram',
        (uri: vscode.Uri, lineNumber: number) => {
            const document = vscode.window.activeTextEditor?.document;
            if (!document) return;
            
            // Extrai o prefixo da tag na linha
            const lineText = document.lineAt(lineNumber).text;
            const tagMatch = lineText.match(/\/\/@([\w.]+)/);
            if (!tagMatch) return;
            
            const fullId = tagMatch[1];
            const prefix = fullId.split(/[0-9]/)[0];
            
            // Encontra todas as tags relacionadas
            const relatedTags = findRelatedTags(document, prefix);
            const mermaidCode = generateMermaidDiagram(relatedTags);
            
            // Abre webview com o diagrama em nova coluna
            MDDDDiagramPanel.createOrShow(context.extensionUri, mermaidCode);
        }
    );
    context.subscriptions.push(showDiagramCommand);
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
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
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
            theme: 'default',
            themeVariables: {
                primaryColor: '#007acc',
                primaryTextColor: '#fff',
                primaryBorderColor: '#007acc',
                lineColor: '#666',
                secondaryColor: '#f5f5f5',
                tertiaryColor: '#fff'
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
 * Desativa a extensão
 */
export function deactivate() {
    console.log('MDDD Hover Extension foi desativada');
}
