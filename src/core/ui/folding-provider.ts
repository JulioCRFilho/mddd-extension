import * as vscode from 'vscode';

/**
 * FoldingRangeProvider que cria regiões de folding para cada tag //@ consecutiva.
 * Permite ao usuário esconder/expandir blocos de tags com 1 clique.
 */
export class MDDDFoldingProvider implements vscode.FoldingRangeProvider {
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

            // Detecta início de tag //@
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
            endLine--; // última linha de tag

            // Cria folding range apenas para as tags, sem incluir código abaixo
            if (endLine > startLine) {
                ranges.push(new vscode.FoldingRange(
                    startLine,
                    endLine,
                    vscode.FoldingRangeKind.Region
                ));
            }
            // Não cria folding para tag única (apenas uma linha)

            i = endLine + 1;
        }

        return ranges;
    }
}