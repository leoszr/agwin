# 28: Navegar por Projects e Threads em múltiplos Ambientes

**What to build:** Entregar um Project Explorer compacto para criar, localizar e selecionar Threads em Ambientes locais e remotos sem ambiguidade de destino.

**Blocked by:** 26/Persistir e restaurar a bancada com segurança; 27/Aplicar temas neutros acessíveis à bancada

**Status:** ready-for-human
**Assignee:** leo

- [x] A árvore apresenta Project, buckets de estado e Threads sem níveis permanentes desnecessários.
- [x] Workspace permanece visível e Ambiente aparece quando remoto ou ambíguo.
- [x] A pessoa cria uma Thread globalmente ou dentro de um Project com contexto explícito.
- [x] Execução, espera, conclusão recente, erro e offline são distinguíveis por texto, ícone e semântica acessível.
- [x] Threads homônimas em múltiplos Projects e Ambientes continuam encontráveis e inequívocas.
- [x] Seleção e navegação permanecem utilizáveis em viewport restrito.

## Comments

### 2026-09-19 — Implementação e validação (responsável: leo)

Entregue o Project Explorer compacto integrado à aplicação real (`PiWebApp` e `AppNavigationPanel`):
- `src/client/domain/thread.ts`: modelo de Thread estendido com `workspaceLabel`, `projectName` e `unread`. Funções de agrupamento por estado (`groupThreadsByState`) e desambiguação de ambiente (`getThreadDisambiguation`).
- `src/client/explorer/sessionThreadBridge.ts`: bridge pura traduzindo `SessionInfo`, `Workspace`, `Project` e estados operacionais em `Thread` e `ProjectExplorerProject`:
  - `cwd -> workspace -> project` com resolução de rótulo e caminho.
  - Derivação rigorosa de `ThreadState` (`running`, `waiting`, `completed`, `error`, `offline`) a partir de `SessionStatus` (`pendingAsk`, `pendingDialogs`, `isStreaming`, `isBashRunning`), `SessionActivity` (`phase`) e `WebEnvironmentStatus`.
  - Resolução de `environmentId` a partir do projeto e da máquina selecionada.
- `src/client/explorer/ProjectExplorer.ts`: componente de árvore compacta `Project → buckets de estado → Threads`:
  - Layout de 2 linhas por Thread: Linha 1 (ícone de estado, título da Thread, badge de ambiente quando remoto/ambíguo, badge de unread), Linha 2 (rótulo do Workspace permanentemente visível).
  - Campo de busca/filtro integrado pesquisando em tempo real por título da Thread, projeto, workspace e ambiente.
  - Alternância expand/collapse com chevrons em cada Project e cada bucket de estado.
  - Botões de criação de Thread global (`+ Nova Thread`) e contextual por Project (`+`).
  - Navegação por teclado completa com setas (ArrowUp, ArrowDown, ArrowLeft, ArrowRight) e ativação com Enter/Space.
  - Semântica acessível ARIA (`role="tree"`, `role="treeitem"`, `aria-expanded`, `aria-selected`, `aria-label`).
- `src/client/src/components/ProjectExplorerView.ts`: Lit component (`<project-explorer-view>`) conectando o bridge reativo ao `ProjectExplorer`.
- `src/client/src/components/appShell/AppNavigationPanel.ts`: integrado `<project-explorer-view>` no painel de navegação principal, serializando e aguardando em ordem `await onSelectProject -> await onSelectWorkspace -> await onSelectSession`.
- Changeset: `.changeset/project-explorer-threads.md`.

Validação executada em 2026-09-19:
- Testes unitários direcionados: `ProjectExplorer.test.ts`, `sessionThreadBridge.test.ts`, `ProjectExplorerView.test.ts` e `AppNavigationPanel.test.ts` passando com 100% de sucesso.
- Suite completa de testes: 402 arquivos de teste / 4.092 testes verdes (2 skipped).
- Typecheck incremental (`npm run typecheck:cached`) limpo sem diagnósticos.
- Validação visual real no navegador Chromium headless via Vite dev server:
  - Árvore de navegação renderizada com 3 projetos e 130 threads reais em bucket "Concluído".
  - Busca em tempo real filtrando instantaneamente (ex: busca por "neovim" filtrou de 130 para 2 threads).
  - Seleção de thread no Explorer carregou imediatamente a sessão correspondente no Chat central.
  - Colapso e reexpansão de projetos testados com preservação da thread ativa selecionada.
