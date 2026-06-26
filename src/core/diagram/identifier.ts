/**
 * Lista de prefixos de código a serem removidos antes da formatação do label
 */
const PREFIXES_TO_REMOVE = [
    'void', 'class', 'fun', 'def', 'function', 'const', 'val', 'var', 'let',
    'interface', 'type', 'enum', 'struct', 'public', 'private', 'protected',
    'static', 'async', 'await', 'override', 'abstract', 'final',
    'int', 'string', 'boolean', 'number', 'float', 'double', 'byte', 'short', 'long',
    'signed', 'unsigned', 'char', 'import', 'export', 'return'
];

/**
 * Limpa o código bruto, removendo comentários inline, prefixos e sufixos,
 * e retorna um label legível formatado.
 *
 * Exemplo:
 *   "void clickLoginButton();"  → "Click Login Button"
 *   "class Login {}"            → "Login"
 *   "_tryLogin();"              → "Try Login"
 *   "val usuario = getUser();"  → "Get User"
 */
export function formatCodeToLabel(code: string): string {
    // 0. Remove quebras de linha e normaliza espaços
    let cleaned = code.replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ').trim();
    
    // 1. Remove comentários inline (// ou #)
    cleaned = cleaned.replace(/\/\/.*$/, '').replace(/#.*$/, '').replace(/--.*$/, '');

    // 2. Remove atribuições (= ...) pois queremos só o nome do símbolo
    cleaned = cleaned.replace(/\s*=.*$/, '');

    // 3. Remove sufixos comuns: ();, (), {};, ;
    cleaned = cleaned.replace(/\(\);?$/, '').replace(/\(\)$/, '').replace(/\{\};?$/, '').replace(/;$/, '');

    // 4. Remove prefixos conhecidos (iterativamente, para casos como "public void")
    let previous = '';
    while (previous !== cleaned) {
        previous = cleaned;
        for (const prefix of PREFIXES_TO_REMOVE) {
            const regex = new RegExp(`^${prefix}\\s+`, 'i');
            cleaned = cleaned.replace(regex, '');
        }
        cleaned = cleaned.trim();
    }

    // 5. Remove qualquer caractere que não seja palavra, número ou _
    cleaned = cleaned.replace(/[^a-zA-Z0-9_\s]/g, '');
    
    // 6. Split por espaço para gerar lista de palavras
    const words = cleaned.split(/\s+/).filter(w => w.length > 0);
    
    // 7. Procura a primeira palavra que combina com camelCase, PascalCase ou snake_case
    for (const word of words) {
        // camelCase: começa com minúscula, tem pelo menos uma maiúscula
        const camelCaseMatch = word.match(/^[a-z][a-z0-9]*[A-Z][a-zA-Z0-9]*$/);
        // PascalCase: começa com maiúscula, tem pelo menos uma minúscula
        const pascalCaseMatch = word.match(/^[A-Z][a-z]+[A-Za-z0-9]*$/);
        // snake_case: tem underscores
        const snakeCaseMatch = word.match(/^[a-zA-Z][a-zA-Z0-9_]*$/);
        
        if (camelCaseMatch || pascalCaseMatch || snakeCaseMatch) {
            // Encontrou a palavra! Agora quebra em mais palavras baseado no padrão
            let label = word;
            
            if (camelCaseMatch) {
                // camelCase: quebra nas transições minúscula→maiúscula
                label = label.replace(/([a-z])([A-Z])/g, '$1 $2');
            } else if (pascalCaseMatch) {
                // PascalCase: quebra nas transições maiúscula→minúscula
                label = label.replace(/([A-Z])([a-z])/g, '$1 $2');
            } else if (snakeCaseMatch) {
                // snake_case: substitui underscores por espaços
                label = label.replace(/_/g, ' ');
            }
            
            // Capitaliza cada palavra
            label = label.replace(/\b\w/g, (char) => char.toUpperCase());
            
            return label.trim();
        }
    }
    
    // 8. Fallback: retorna a primeira palavra se não encontrou padrão
    if (words.length > 0) {
        return words[0].replace(/_/g, '');
    }
    
    return '';
}

/**
 * Extrai o identificador bruto da linha de código (primeira palavra após limpeza de prefixos/sufixos),
 * sem formatar para label. Retorna null se não encontrar nada.
 *
 * Exemplo: "void clickLoginButton();" → "clickLoginButton"
 */
export function extractIdentifierBelow(lineText: string): string | null {
    // 0. Remove quebras de linha primeiro
    let cleaned = lineText.replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ').trim();
    
    // 1. Remove comentários inline
    cleaned = cleaned.replace(/\/\/.*$/, '').replace(/#.*$/, '').replace(/--.*$/, '');

    // 2. Remove atribuições (= ...)
    cleaned = cleaned.replace(/\s*=.*$/, '');

    // 3. Remove sufixos comuns
    cleaned = cleaned.replace(/\(\);?$/, '').replace(/\(\)$/, '').replace(/\{\};?$/, '').replace(/;$/, '');

    // 4. Remove prefixos conhecidos iterativamente
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

    // 5. Extrai o primeiro identificador (palavra)
    const match = cleaned.match(/^[a-zA-Z_][a-zA-Z0-9_]*/);
    if (!match) return null;

    return match[0];
}

/**
 * Mantido para compatibilidade — delega a formatCodeToLabel.
 */
export function toReadableLabel(name: string): string {
    return formatCodeToLabel(name);
}
