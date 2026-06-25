import * as vscode from 'vscode';

export class MDDDDiagramPanel {
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