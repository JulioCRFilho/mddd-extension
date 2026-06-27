import * as vscode from 'vscode';
import { filterAllNodes, NodeInfo } from '../diagram/parser';

/**
 * DocumentSymbolProvider that indexes //@ tags and displays them in the VS Code outline.
 * Organizes in a tree: Groups → Entry Nodes → Sequence Nodes
 */
export class MADDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
    provideDocumentSymbols(
        document: vscode.TextDocument
    ): vscode.ProviderResult<vscode.SymbolInformation[] | vscode.DocumentSymbol[]> {
        const allNodes = filterAllNodes(document);

        // Only declared nodes (not arrows)
        const declaredNodes = allNodes.filter(n => !n.isArrow);

        // Organizes in a tree
        const result: vscode.DocumentSymbol[] = [];

        // 1. Groups
        const groups = declaredNodes.filter(n => !/\d/.test(n.id));
        for (const group of groups) {
            const groupSymbol = new vscode.DocumentSymbol(
                group.id,
                group.description || 'Group',
                vscode.SymbolKind.Namespace,
                new vscode.Range(group.line, 0, group.line, 100),
                new vscode.Range(group.line, 0, group.line, 100)
            );

            // 2. Entry nodes deste grupo
            const entryNodes = declaredNodes.filter(n => {
                const match = n.id.match(/^([a-zA-Z_]+)\d+$/);
                return match && match[1].toLowerCase() === group.id.toLowerCase();
            });

            for (const entry of entryNodes) {
                const entrySymbol = new vscode.DocumentSymbol(
                    entry.id,
                    entry.description || 'Entry Node',
                    vscode.SymbolKind.Field,
                    new vscode.Range(entry.line, 0, entry.line, 100),
                    new vscode.Range(entry.line, 0, entry.line, 100)
                );

                // 3. Sequence nodes deste entry
                const sequenceNodes = declaredNodes.filter(n => {
                    const entryId = entry.id;
                    return n.id.startsWith(entryId + '.') && n.id.split('.').length === entryId.split('.').length + 1;
                });

                for (const seq of sequenceNodes) {
                    const seqSymbol = new vscode.DocumentSymbol(
                        seq.id,
                        seq.description || 'Step',
                        vscode.SymbolKind.Method,
                        new vscode.Range(seq.line, 0, seq.line, 100),
                        new vscode.Range(seq.line, 0, seq.line, 100)
                    );

                    // Recursivamente, filhos de sequence nodes
                    this._addChildSequences(seq, declaredNodes, seqSymbol);

                    entrySymbol.children.push(seqSymbol);
                }

                groupSymbol.children.push(entrySymbol);
            }

            result.push(groupSymbol);
        }

        // 4. Orphan nodes (do not belong to any group)
        const orphanNodes = declaredNodes.filter(n => {
            if (!/\d/.test(n.id)) return false; // not numbered
            const match = n.id.match(/^([a-zA-Z_]+)\d+$/);
            if (!match) return false;
            return !groups.some(g => g.id.toLowerCase() === match[1].toLowerCase());
        });

        if (orphanNodes.length > 0) {
            const orphanSymbol = new vscode.DocumentSymbol(
                'Orphans',
                `${orphanNodes.length} ungrouped nodes`,
                vscode.SymbolKind.File,
                new vscode.Range(0, 0, 0, 0),
                new vscode.Range(0, 0, 0, 0)
            );
            for (const orphan of orphanNodes) {
                orphanSymbol.children.push(new vscode.DocumentSymbol(
                    orphan.id,
                    orphan.description || '',
                    vscode.SymbolKind.Field,
                    new vscode.Range(orphan.line, 0, orphan.line, 100),
                    new vscode.Range(orphan.line, 0, orphan.line, 100)
                ));
            }
            result.push(orphanSymbol);
        }

        // 5. Forward pointers (for reference)
        const forwardNodes = allNodes.filter(n => n.isArrow);
        if (forwardNodes.length > 0) {
            const forwardSymbol = new vscode.DocumentSymbol(
                'Forward Pointers',
                `${forwardNodes.length} external references`,
                vscode.SymbolKind.Variable,
                new vscode.Range(0, 0, 0, 0),
                new vscode.Range(0, 0, 0, 0)
            );
            for (const fwd of forwardNodes) {
                forwardSymbol.children.push(new vscode.DocumentSymbol(
                    `-> ${fwd.id}`,
                    fwd.description || '',
                    vscode.SymbolKind.Variable,
                    new vscode.Range(fwd.line, 0, fwd.line, 100),
                    new vscode.Range(fwd.line, 0, fwd.line, 100)
                ));
            }
            result.push(forwardSymbol);
        }

        return result;
    }

    /**
     * Adiciona recursivamente filhos de sequence nodes
     */
    private _addChildSequences(
        parent: NodeInfo,
        allNodes: NodeInfo[],
        parentSymbol: vscode.DocumentSymbol
    ): void {
        const children = allNodes.filter(n => {
            if (n.isArrow) return false;
            if (n.id === parent.id) return false;
            const prefix = parent.id + '.';
            return n.id.startsWith(prefix) && n.id.split('.').length === prefix.split('.').length;
        });

        for (const child of children) {
            const childSymbol = new vscode.DocumentSymbol(
                child.id,
                child.description || 'Step',
                vscode.SymbolKind.Method,
                new vscode.Range(child.line, 0, child.line, 100),
                new vscode.Range(child.line, 0, child.line, 100)
            );
            this._addChildSequences(child, allNodes, childSymbol);
            parentSymbol.children.push(childSymbol);
        }
    }
}