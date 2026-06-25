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
    
    // Palavras-chave comuns em linguagens de programação
    const keywords = /\b(class|function|const|let|var|interface|type|enum|struct|def|func|public|private|protected|static|async|await|import|export|from|return|if|else|for|while|do|switch|case|break|continue|new|this|super|extends|implements|abstract|final|override)\b/;
    
    // Remove palavras-chave do início da linha
    let cleaned = code.replace(/^\s*/, '');
    while (keywords.test(cleaned)) {
        cleaned = cleaned.replace(keywords, '').trim();
    }
    
    // Padrão para capturar identificadores: letras, números, underscore
    const match = cleaned.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*[\(\)\[\]\{\}:=,;]?/);
    
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
    
    // Ordena por ID numérico (ex: Teste1, Teste1.1, Teste1.2, Teste2)
    relatedTags.sort((a, b) => {
        const idA = a.id;
        const idB = b.id;
        
        // Extrai números do ID
        const numsA = idA.match(/\d+/g)?.map(Number) || [0];
        const numsB = idB.match(/\d+/g)?.map(Number) || [0];
        
        // Compara cada nível numérico
        for (let i = 0; i < Math.max(numsA.length, numsB.length); i++) {
            const numA = numsA[i] || 0;
            const numB = numsB[i] || 0;
            
            if (numA !== numB) {
                return numA - numB;
            }
        }
        
        return 0;
    });
    
    return relatedTags;
}

/**
 * Gera o código Mermaid graph TD baseado nas tags relacionadas
 */
function generateMermaidDiagram(tags: Array<{line: number, id: string, label: string}>): string {
    if (tags.length === 0) {
        return 'graph TD\n    A[Nenhuma tag relacionada encontrada]';
    }
    
    // Ordena por ID para manter ordem hierárquica
    const sorted = [...tags].sort((a, b) => {
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
    
    // Mapa de ID para nodeId
    const idToNodeId = new Map<string, string>();
    
    // Cria nós
    for (let i = 0; i < sorted.length; i++) {
        const current = sorted[i];
        const nodeId = `N${i}`;
        const safeLabel = current.label.replace(/"/g, '"');
        
        idToNodeId.set(current.id, nodeId);
        mermaid += `    ${nodeId}["${safeLabel}"]\n`;
    }
    
    // Cria conexões hierárquicas baseadas no ID
    for (let i = 0; i < sorted.length; i++) {
        const current = sorted[i];
        const currentNodeId = idToNodeId.get(current.id)!;
        
        // Extrai o pai baseado no ID
        // Ex: Login1.1 -> Login1, Login2 -> Login, Login -> raiz
        const parentId = getParentId(current.id);
        
        if (parentId && idToNodeId.has(parentId)) {
            const parentNodeId = idToNodeId.get(parentId)!;
            mermaid += `    ${parentNodeId} --> ${currentNodeId}\n`;
        }
    }
    
    return mermaid;
}

/**
 * Extrai o ID do pai baseado na estrutura do ID
 * Ex: Login1.1 -> Login1, Login2 -> Login, Login -> null
 */
function getParentId(id: string): string | null {
    // Remove números do final para encontrar o pai
    // Login1.1 -> Login1
    // Login2 -> Login
    // Login -> null (raiz)
    
    const match = id.match(/^(.+?)(\d+(\.\d+)*)$/);
    if (match) {
        const base = match[1];
        const numbers = match[2];
        
        // Se tem apenas um número (ex: Login1), o pai é a base
        if (!numbers.includes('.')) {
            // Verifica se a base não é vazia (ex: "1" -> base "")
            if (base) {
                return base;
            }
        } else {
            // Se tem múltiplos números (ex: Login1.1), remove o último nível
            const lastDotIndex = numbers.lastIndexOf('.');
            if (lastDotIndex > 0) {
                return base + numbers.substring(0, lastDotIndex);
            } else {
                return base;
            }
        }
    }
    
    return null;
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
