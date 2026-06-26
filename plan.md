```mermaid
    flowchart TD

    Initial[Start processing] --> ReadDiagramType[Read //@::DiagramType from first line]
    ReadDiagramType --> FilterGroups[Filter every node's group]
    FilterGroups --> FilterNodes[Filter all //@ tagged lines]
    FilterNodes --> ExtractCode[Extract code line below each tag as node label]
    ExtractCode --> FormatLabel[Format code into label: remove prefixes, split camelCase/PascalCase, capitalize]
    FormatLabel --> SplitTypes[Split //@ nodes from //@-> nodes]
    
    SplitTypes --> RetroPointers[Connect //@ nodes to their parent group]
    RetroPointers --> Filtering
    
    SplitTypes --> ForwardPointers[Connect //@-> nodes to their target ID]
    ForwardPointers --> Filtering
    
    Filtering --> BuildHierarchy[Build parent-child tree: Group > EntryNode > SequenceNode]
    BuildHierarchy --> AssignConnections[Assign edge comments from :suffix, build edges from //@-> targets]
    AssignConnections --> WriteDiagram[Write the diagram using saved diagram type, with nodes, edges, subgraphs and themed colors]
    WriteDiagram --> Validate[Validate diagram structure and references]
    Validate --> |Valid|Display[Display diagram using themed colors]
    Validate --> |Invalid|Error[Display validation error with details]
    
    subgraph Filtering
        FilterPrefix[Filter every ID prefix]
        FilterPrefix --> FilterEntryNodes[Filter every entry node `prefix+X`]
        FilterEntryNodes --> FilterSequences[Filter every sequence node `prefix+X.X...`]
    end
```

---

## Comportamento Detalhado

### Formato das Tags

Cada tag é uma linha de comentário que **marca a linha de código abaixo dela**:

```
//@ID:EdgeComment     ← tag (retro: conecta ao pai)
void minhaFuncao();  ← código que vira o nó
```

```
//@->TargetID:Comment  ← tag (target: conecta ao alvo)
algumCodigo();        ← código que vira o nó
```

### Tratamento do Código para Label do Nó

O código abaixo da tag é processado para gerar o label exibido no diagrama:

| Código original | Label gerado |
|---|---|
| `class Login {}` | `Login` |
| `void inputEmail();` | `Input Email` |
| `void inputPass();` | `Input Pass` |
| `void clickLoginButton();` | `Click Login Button` |
| `void clickForgotPasswordButton();` | `Click Forgot Password Button` |
| `_tryLogin();` | `Try Login` |
| `val usuario = getUser();` | `Val Usuario = Get User` |

**Regras de formatação:**
1. Remover prefixos comuns: `void`, `class`, `fun`, `def`, `function`, `const`, `val`, `var`, `let`
2. Remover sufixos: `();`, `()`, `{}`, `;`
3. Remover underscores `_` no início
4. Separar em palavras nos limites de camelCase/PascalCase
5. Capitalizar primeira letra de cada palavra

### Comentários nas Arestas

O sufixo `:Comentario` após o ID da tag define o **comentário da aresta** (edge label), não o label do nó:

```
//@Login1.1:Teste        ← "Teste" é comentário da aresta (edge label)
void inputPass();        ← "Input Pass" é o label do nó
```

### Tipos de Conexão

| Tag | Tipo | Comportamento |
|---|---|---|
| `//@ID:suffix` | Retro | Para **sequence nodes**, conecta ao nó pai imediato na hierarquia. A aresta recebe `suffix` como label. **Entry nodes** não geram aresta — a relação com o grupo é implícita pelo subgraph. |
| `//@->TargetID:suffix` | Target | Conecta o nó ao **alvo específico** `TargetID`. A aresta recebe `suffix` como label. |

### Níveis de Nós

| Nível | Formato | Exemplo |
|---|---|---|
| Grupo | Apenas letras | `Login`, `Signup`, `Home` |
| EntryNode | Prefixo + número inteiro | `Login1`, `Signup2`, `Home1` |
| SequenceNode | Prefixo + número sequencial | `Login1.1`, `Login1.1.1`, `Home1.2.2` |

A hierarquia é definida pelo ID: `Login1.1` é filho de `Login1`, que é filho de `Login` (grupo).

---

## Exemplo de Uso

### Entrada

```typescript
//@::flowchart TD
//@Login
class Login {}

//@Login1
void inputEmail();

//@Login1.1:Teste
void inputPass();

//@Login1.1.1:Teste 2
//@->Login1.1.2
void clickLoginButton();

//@Login1.1.2
void clickForgotPasswordButton();

//@Login2
//@->Login1.1:Teste 4
void clickRegisterButton();

//@Login1.1.1.1:Sucesso
void displaySuccess();

//@Login1.1.1.2:Erro
void displayError();
```

### Saída Esperada

```mermaid
graph TD
    subgraph Login
        Login1[Input Email] -->|Teste| Login1_1
        Login1_1[Input Pass] -->|Teste 2| Login1_1_1
        Login1_1 --> Login1_1_2
        Login1_1_1[Click Login Button] --> Login1_1_2
        Login1_1_1 -->|Sucesso| Login1_1_1_1[Display Success]
        Login1_1_1 -->|Erro| Login1_1_1_2[Display Error]
        Login1_1_2[Click Forgot Password Button]
        Login2[Click Register Button] -->|Teste 4| Login1_1
    end
```
