/**
 * List of code prefixes to be removed before label formatting
 */
const PREFIXES_TO_REMOVE = [
    'void', 'class', 'fun', 'def', 'function', 'const', 'val', 'var', 'let',
    'interface', 'type', 'enum', 'struct', 'public', 'private', 'protected',
    'static', 'async', 'await', 'override', 'abstract', 'final',
    'int', 'string', 'boolean', 'number', 'float', 'double', 'byte', 'short', 'long',
    'signed', 'unsigned', 'char', 'import', 'export', 'return'
];

/**
 * Cleans the raw code, removing inline comments, prefixes and suffixes,
 * and returns a readable formatted label.
 *
 * Exemplo:
 *   "void clickLoginButton();"  → "Click Login Button"
 *   "class Login {}"            → "Login"
 *   "_tryLogin();"              → "Try Login"
 *   "val usuario = getUser();"  → "Get User"
 */
export function formatCodeToLabel(code: string): string {
    // 0. Remove line breaks and normalize spaces
    let cleaned = code.replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ').trim();
    
    // 1. Remove inline comments (// or #)
    cleaned = cleaned.replace(/\/\/.*$/, '').replace(/#.*$/, '').replace(/--.*$/, '');

    // 2. Remove assignments (= ...) since we only want the symbol name
    cleaned = cleaned.replace(/\s*=.*$/, '');

    // 3. Remove common suffixes: ();, (), {};, ;
    cleaned = cleaned.replace(/\(\);?$/, '').replace(/\(\)$/, '').replace(/\{\};?$/, '').replace(/;$/, '');

    // 4. Remove known prefixes (iteratively, for cases like "public void")
    let previous = '';
    while (previous !== cleaned) {
        previous = cleaned;
        for (const prefix of PREFIXES_TO_REMOVE) {
            const regex = new RegExp(`^${prefix}\\s+`, 'i');
            cleaned = cleaned.replace(regex, '');
        }
        cleaned = cleaned.trim();
    }

    // 5. Remove any non-word, non-number, non-underscore character
    cleaned = cleaned.replace(/[^a-zA-Z0-9_\s]/g, '');
    
    // 6. Split by space to generate list of words
    const words = cleaned.split(/\s+/).filter(w => w.length > 0);
    
    // 7. Look for the first word matching camelCase, PascalCase or snake_case
    for (const word of words) {
        // camelCase: starts with lowercase, has at least one uppercase
        const camelCaseMatch = word.match(/^[a-z][a-z0-9]*[A-Z][a-zA-Z0-9]*$/);
        // PascalCase: starts with uppercase, has at least one lowercase
        const pascalCaseMatch = word.match(/^[A-Z][a-z]+[A-Za-z0-9]*$/);
        // snake_case: has underscores
        const snakeCaseMatch = word.match(/^[a-zA-Z][a-zA-Z0-9_]*$/);
        
        if (camelCaseMatch || pascalCaseMatch || snakeCaseMatch) {
            // Found the word! Now break into more words based on the pattern
            let label = word;
            
            if (camelCaseMatch) {
                // camelCase: break at lowercase→uppercase transitions
                label = label.replace(/([a-z])([A-Z])/g, '$1 $2');
            } else if (pascalCaseMatch) {
                // PascalCase: break at uppercase→lowercase transitions
                label = label.replace(/([A-Z])([a-z])/g, '$1 $2');
            } else if (snakeCaseMatch) {
                // snake_case: replace underscores with spaces
                label = label.replace(/_/g, ' ');
            }
            
            // Capitalizes each word
            label = label.replace(/\b\w/g, (char) => char.toUpperCase());
            
            return label.trim();
        }
    }
    
    // 8. Fallback: return the first word if no pattern was found
    if (words.length > 0) {
        return words[0].replace(/_/g, '');
    }
    
    return '';
}

/**
 * Extracts the raw identifier from the code line (first word after cleaning prefixes/suffixes),
 * without formatting to label. Returns null if nothing is found.
 *
 * Exemplo: "void clickLoginButton();" → "clickLoginButton"
 */
export function extractIdentifierBelow(lineText: string): string | null {
    // 0. Remove line breaks first
    let cleaned = lineText.replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ').trim();
    
    // 1. Remove inline comments
    cleaned = cleaned.replace(/\/\/.*$/, '').replace(/#.*$/, '').replace(/--.*$/, '');

    // 2. Remove assignments (= ...)
    cleaned = cleaned.replace(/\s*=.*$/, '');

    // 3. Remove common suffixes
    cleaned = cleaned.replace(/\(\);?$/, '').replace(/\(\)$/, '').replace(/\{\};?$/, '').replace(/;$/, '');

    // 4. Remove known prefixes iteratively
    const PREFIXES = ['void', 'class', 'fun', 'def', 'function', 'const', 'val', 'var', 'let',
        'interface', 'type', 'enum', 'struct', 'public', 'private', 'protected',
        'static', 'async', 'await', 'override', 'abstract', 'final',
        'int', 'string', 'boolean', 'number', 'float', 'double', 'byte', 'short', 'long',
        'signed', 'unsigned', 'char', 'import', 'export', 'return', 'new', 'display'];

    let previous = '';
    while (previous !== cleaned) {
        previous = cleaned;
        for (const prefix of PREFIXES) {
            const regex = new RegExp(`^${prefix}\\s+`, 'i');
            cleaned = cleaned.replace(regex, '');
        }
        cleaned = cleaned.trim();
    }

    // 5. Extract the first identifier (word)
    const match = cleaned.match(/^[a-zA-Z_][a-zA-Z0-9_]*/);
    if (!match) return null;

    return match[0];
}

/**
 * Maintained for compatibility — delegates to formatCodeToLabel.
 */
export function toReadableLabel(name: string): string {
    return formatCodeToLabel(name);
}
