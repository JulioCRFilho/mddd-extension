import * as vscode from 'vscode';

export class MADDiagramPanel {
    public static currentPanel: MADDiagramPanel | undefined;
    public static readonly viewType = 'mad.diagram';

    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri, mermaidCode: string) {
        const currentColumn = vscode.window.activeTextEditor?.viewColumn;
        if (currentColumn === undefined) return;

        const besideColumn = currentColumn + 1;

        if (MADDiagramPanel.currentPanel) {
            MADDiagramPanel.currentPanel._panel.reveal(besideColumn);
            MADDiagramPanel.currentPanel._update(mermaidCode);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            MADDiagramPanel.viewType,
            'Mermaid Diagram',
            besideColumn,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        MADDiagramPanel.currentPanel = new MADDiagramPanel(panel, extensionUri, mermaidCode);
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

        // Escapes the Mermaid code for safe insertion in JS
        const escapedMermaidCode = mermaidCode
            .replace(/\\/g, '\\\\')
            .replace(/`/g, '\\`')
            .replace(/\$/g, '\\$');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mermaid Diagram</title>
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.min.js"></script>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 0;
            margin: 0;
            background-color: ${colors.background};
            color: ${colors.text};
            display: flex;
            flex-direction: column;
            height: 100vh;
        }
        .toolbar {
            display: flex;
            gap: 8px;
            padding: 8px 12px;
            background-color: ${colors.secondary};
            border-bottom: 1px solid ${colors.line}33;
            flex-shrink: 0;
            align-items: center;
            flex-wrap: wrap;
        }
        .toolbar button {
            background: ${colors.primary};
            color: ${colors.primaryText};
            border: none;
            padding: 6px 14px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-family: inherit;
            transition: opacity 0.2s;
            white-space: nowrap;
        }
        .toolbar button:hover {
            opacity: 0.85;
        }
        .toolbar button.secondary {
            background: transparent;
            color: ${colors.text};
            border: 1px solid ${colors.line}66;
        }
        .toolbar .status {
            margin-left: auto;
            font-size: 11px;
            opacity: 0.7;
        }
        .toolbar .search-input {
            background: ${colors.tertiary};
            border: 1px solid ${colors.line}66;
            color: ${colors.text};
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-family: inherit;
            width: 160px;
        }
        .toolbar .search-input:focus {
            outline: none;
            border-color: ${colors.primary};
        }
        .mermaid-container {
            flex: 1;
            display: flex;
            justify-content: center;
            align-items: flex-start;
            padding: 24px;
            overflow: auto;
        }
        .mermaid {
            display: flex;
            justify-content: center;
            min-height: 200px;
            width: 100%;
        }
        .zoom-controls {
            display: flex;
            gap: 4px;
            align-items: center;
        }
        .zoom-controls button {
            padding: 4px 8px;
            font-size: 11px;
            min-width: 28px;
        }
        .zoom-controls span {
            font-size: 11px;
            opacity: 0.7;
            min-width: 36px;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="toolbar">
        <button onclick="copyToClipboard()" title="Copy Mermaid code">📋 Copy</button>
        <button class="secondary" onclick="exportAsSVG()" title="Exportar como SVG">📥 SVG</button>
        <button class="secondary" onclick="exportAsPNG()" title="Exportar como PNG">🖼 PNG</button>
        <div class="zoom-controls">
            <button onclick="zoomOut()" title="Zoom out">−</button>
            <span id="zoomLevel">100%</span>
            <button onclick="zoomIn()" title="Zoom in">+</button>
            <button onclick="resetZoom()" title="Reset zoom">↺</button>
        </div>
        <input type="text" class="search-input" id="searchInput" placeholder="🔍 Search nodes..." oninput="filterNodes(this.value)" />
        <span class="status" id="status"></span>
    </div>
    <div class="mermaid-container" id="mermaidContainer">
        <div class="mermaid" id="mermaidContent">
            ${mermaidCode}
        </div>
    </div>
    <script>
        const MERMAID_CODE = \`${escapedMermaidCode}\`;
        let currentZoom = 1.0;
        const ZOOM_STEP = 0.1;
        const MIN_ZOOM = 0.3;
        const MAX_ZOOM = 3.0;

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

        function setStatus(msg, isError) {
            const el = document.getElementById('status');
            el.textContent = msg;
            el.style.color = isError ? '#e74c3c' : '';
            setTimeout(() => { el.textContent = ''; }, 3000);
        }

        function updateZoom() {
            const el = document.getElementById('mermaidContent');
            el.style.transform = \`scale(\${currentZoom})\`;
            el.style.transformOrigin = 'center top';
            document.getElementById('zoomLevel').textContent = Math.round(currentZoom * 100) + '%';
        }

        function zoomIn() {
            currentZoom = Math.min(currentZoom + ZOOM_STEP, MAX_ZOOM);
            updateZoom();
        }

        function zoomOut() {
            currentZoom = Math.max(currentZoom - ZOOM_STEP, MIN_ZOOM);
            updateZoom();
        }

        function resetZoom() {
            currentZoom = 1.0;
            updateZoom();
        }

        async function copyToClipboard() {
            try {
                await navigator.clipboard.writeText(MERMAID_CODE);
                setStatus('✓ Copied!');
            } catch (err) {
                setStatus('✗ Copy failed', true);
            }
        }

        async function exportAsSVG() {
            try {
                await mermaid.run({ nodes: [document.getElementById('mermaidContent')] });
                const svgEl = document.querySelector('.mermaid svg');
                if (!svgEl) {
                    setStatus('✗ No SVG found', true);
                    return;
                }
                const svgClone = svgEl.cloneNode(true);
                svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                const serializer = new XMLSerializer();
                const svgString = serializer.serializeToString(svgClone);
                const blob = new Blob([svgString], { type: 'image/svg+xml' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'diagram.svg';
                a.click();
                URL.revokeObjectURL(url);
                setStatus('✓ SVG exported');
            } catch (err) {
                setStatus('✗ Export failed', true);
            }
        }

        async function exportAsPNG() {
            try {
                await mermaid.run({ nodes: [document.getElementById('mermaidContent')] });
                const container = document.getElementById('mermaidContainer');
                // Reset zoom temporarily for full quality export
                const originalZoom = currentZoom;
                currentZoom = 1.0;
                updateZoom();
                // Wait for re-render
                await new Promise(r => setTimeout(r, 100));
                const canvas = await htmlToImage.toCanvas(container, {
                    backgroundColor: '${colors.background}',
                    pixelRatio: 2,
                    filter: (node) => {
                        // Exclude toolbar from screenshot
                        return !node.classList || !node.classList.contains('toolbar');
                    }
                });
                currentZoom = originalZoom;
                updateZoom();
                const link = document.createElement('a');
                link.download = 'diagram.png';
                link.href = canvas.toDataURL('image/png');
                link.click();
                setStatus('✓ PNG exported');
            } catch (err) {
                // Restore zoom on error
                currentZoom = 1.0;
                updateZoom();
                setStatus('✗ PNG export failed: ' + err.message, true);
            }
        }

        function filterNodes(query) {
            const svg = document.querySelector('.mermaid svg');
            if (!svg) return;
            const allNodes = svg.querySelectorAll('[id^="flowchart-"], [id^="graph-"], .cluster, .node');
            allNodes.forEach(node => {
                const text = node.textContent.toLowerCase();
                const rects = node.querySelectorAll('rect, ellipse, polygon');
                if (!query) {
                    node.style.opacity = '1';
                    node.style.filter = '';
                    return;
                }
                const matches = text.includes(query.toLowerCase());
                node.style.opacity = matches ? '1' : '0.15';
                node.style.filter = matches ? 'brightness(1.2)' : 'grayscale(1)';
            });
            setStatus(query ? \`Filtered: "\${query}"\` : 'Filter cleared');
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === '=' || e.key === '+') {
                    e.preventDefault();
                    zoomIn();
                } else if (e.key === '-') {
                    e.preventDefault();
                    zoomOut();
                } else if (e.key === '0') {
                    e.preventDefault();
                    resetZoom();
                }
            }
            if (e.key === 'Escape') {
                document.getElementById('searchInput').value = '';
                filterNodes('');
            }
            if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
                const input = document.getElementById('searchInput');
                if (document.activeElement !== input) {
                    e.preventDefault();
                    input.focus();
                }
            }
        });
    </script>
</body>
</html>`;
    }

    public dispose() {
        MADDiagramPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}