/**
 * Utilitário para transformar nomes em labels legíveis
 */
export function toReadableLabel(name: string): string {
    let cleaned = name.replace(/^_+/, '');
    cleaned = cleaned.replace(/([a-z])([A-Z])/g, '$1 $2');
    cleaned = cleaned.replace(/[_-]+/g, ' ');
    cleaned = cleaned.replace(/\b\w/g, (char) => char.toUpperCase());
    cleaned = cleaned.trim().replace(/\s+/g, ' ');
    return cleaned;
}

const KEYWORDS = /\b(class|function|const|let|var|interface|type|enum|struct|def|func|public|private|protected|static|async|await|import|export|from|return|if|else|for|while|do|switch|case|break|continue|new|this|super|extends|implements|abstract|final|override|void|int|string|boolean|number|any|null|undefined|char|float|double|byte|short|long|signed|unsigned)\b/;

/**
 * Extrai o identificador da linha, ignorando keywords
 */
export function extractIdentifierBelow(lineText: string): string | null {
    let code = lineText
        .replace(/^\s*\/\/.*$/, '')
        .replace(/^\s*#.*$/, '')
        .replace(/^\s*--.*$/, '');

    let cleaned = code.replace(/^\s*/, '');
    while (KEYWORDS.test(cleaned)) {
        cleaned = cleaned.replace(KEYWORDS, '').trim();
    }

    const match = cleaned.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)/);

    if (match && match[1]) {
        return match[1];
    }

    return null;
}