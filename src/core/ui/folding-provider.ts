import * as vscode from 'vscode';

/**
 * FoldingRangeProvider that creates folding regions for each consecutive //@ tag.
 * Allows the user to hide/expand tag blocks with 1 click.
 */
export class MADFoldingProvider implements vscode.FoldingRangeProvider {
    provideFoldingRanges(
        document: vscode.TextDocument,
        _context: vscode.FoldingContext,
        _token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.FoldingRange[]> {
        const ranges: vscode.FoldingRange[] = [];
        const text = document.getText();
        const lines = text.split(/\r?\n/);

        let i = 0;
        while (i < lines.length) {
            const line = lines[i];

            // Detects start of //@ tag
            const isTag = line.match(/\/\/@([\w.]+)/);
            if (!isTag) {
                i++;
                continue;
            }

            // Encontra o bloco de tags consecutivas
            const startLine = i;
            let endLine = i;
            while (endLine < lines.length && lines[endLine].match(/\/\/@/)) {
                endLine++;
            }
            endLine--; // last tag line

            // Create folding range only for tags, without including code below
            if (endLine > startLine) {
                ranges.push(new vscode.FoldingRange(
                    startLine,
                    endLine,
                    vscode.FoldingRangeKind.Region
                ));
            }
            // Don\t create folding for single tag (one line only)

            i = endLine + 1;
        }

        return ranges;
    }
}