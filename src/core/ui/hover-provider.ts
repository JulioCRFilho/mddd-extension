import * as vscode from 'vscode';
import { filterAllNodes } from '../diagram/parser';

/**
 * HoverProvider that displays detailed info about //@ tags on mouse hover.
 * Shows the ID, formatted label, and code preview below the tag.
 */
export class MADHoverProvider implements vscode.HoverProvider {
    provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.ProviderResult<vscode.Hover> {
        const lineText = document.lineAt(position.line).text;

        // Verifica se a linha tem uma tag //@
        const tagMatch = lineText.match(/\/\/@([\w.]+)(?::([^\n]+))?/);
        if (!tagMatch) return null;

        const fullId = tagMatch[1];
        const description = tagMatch[2]?.trim();

        // Extract code line below the tag (pulando outras tags consecutivas)
        const text = document.getText();
        const lines = text.split(/\r?\n/);
        let codeLine: string | null = null;
        let j = position.line + 1;
        while (j < lines.length && lines[j].match(/\/\/@/)) {
            j++;
        }
        if (j < lines.length) {
            codeLine = lines[j].trim();
        }

        // Determines the tag type
        const isArrow = lineText.includes('//@->');
        const isGroup = !/\d/.test(fullId);
        const isEntry = /^[a-zA-Z_]+[0-9]+$/.test(fullId);
        const isSequence = /\.[0-9]+/.test(fullId);

        // Builds the hover parts
        const markdownParts: string[] = [];

        // Title
        markdownParts.push(`**🔖 MAD Tag**`);

        // Tag type
        const tagType = isArrow ? '➡️ Forward Pointer' :
            isGroup ? '📦 Group' :
            isEntry ? '🔤 Entry Node' :
            '🔁 Sequence Node';
        markdownParts.push(`**Type:** ${tagType}`);

        // ID da tag
        markdownParts.push(`**ID:** \`${fullId}\``);

        // Inline description if it exists
        if (description) {
            markdownParts.push(`**Description:** ${description}`);
        }

        // Code below tag
        if (codeLine) {
            const code = codeLine.length > 80 ? codeLine.substring(0, 80) + '...' : codeLine;
            markdownParts.push('');
            markdownParts.push('**Code:**');
            markdownParts.push('```\n' + code + '\n```');
        }

        // Hierarchy for sequence nodes
        if (isSequence) {
            const parts = fullId.split('.');
            const parentId = parts.slice(0, -1).join('.');
            markdownParts.push('');
            markdownParts.push(`**⬆️ Parent:** \`${parentId}\``);
        }

        // For entry nodes, shows the group
        if (isEntry) {
            const groupMatch = fullId.match(/^([a-zA-Z_]+)\d+$/);
            if (groupMatch) {
                markdownParts.push('');
                markdownParts.push(`**📂 Group:** \`${groupMatch[1]}\``);
            }
        }

        // For forward pointers, shows the target
        if (isArrow) {
            markdownParts.push('');
            markdownParts.push(`**🎯 Target:** \`${fullId}\``);
        }

        // Click action
        markdownParts.push('');
        markdownParts.push('---');
        markdownParts.push('*Click to open the diagram*');

        return new vscode.Hover(
            new vscode.MarkdownString(markdownParts.join('\n\n')),
            new vscode.Range(position.line, 0, position.line, lineText.length)
        );
    }
}