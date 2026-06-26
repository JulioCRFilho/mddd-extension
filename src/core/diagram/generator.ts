/**
 * PONTO DE ENTRADA ÚNICO para geração de diagramas Mermaid.
 * 
 * Este arquivo re-exporta a função do módulo de generators,
 * garantindo compatibilidade com imports existentes.
 * 
 * Cada tipo de diagrama tem seu próprio arquivo em ./generators/:
 * - flowchart.ts
 * - sequence.ts
 * - class.ts
 * - state.ts
 * - er.ts
 * 
 * Para adicionar um novo tipo:
 * 1. Crie um arquivo em ./generators/ implementando DiagramGenerator
 * 2. Adicione ao array em ./generators/index.ts
 * 3. Pronto! O dispatcher fará o roteamento automaticamente
 */
export { generateMermaidDiagram, registerGenerator, getGenerator } from './generators/index';
export type { DiagramGenerator } from './generators/types';