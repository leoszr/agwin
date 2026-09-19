# 26: Persistir e restaurar a bancada com segurança

**What to build:** Persistir localmente a composição visual dos Painéis e restaurá-la sem controlar execução nem perder estado transitório.

**Blocked by:** 24/Usar Diff como Painel contextual; 25/Usar Terminal como Painel fixo ao Workspace

**Status:** resolved
**Assignee:** leo

- [x] Somente geometria e configuração visual segura são persistidas no Cliente.
- [x] Contextos indisponíveis restauram como placeholders recuperáveis, sem retargeting automático.
- [x] A largura reduzida compacta e reexpande o layout sem perder seleção ou configuração.
- [x] Restaurar o default recompõe a geometria sem apagar rascunhos, buffers, mensagens ou processos.
- [x] Layout inválido falha de forma recuperável e não interfere na execução server-side.

## Comments

### 2026-09-17 — Implementação (agente; responsável: leo)

Helpers puros de `layoutStorage.ts` (já testados) ligados à bancada real:
- `DockviewWorkbench` persiste no Cliente em `addPanel`/`closePanel`/`onDidLayoutChange`/`dispose` via `persistQuietly` (falha de storage nunca derruba a bancada); salva só geometria + config visual (`isUnsafeDirty`/`activeFilePath`/buffers/credenciais ficam fora).
- `restoreSavedLayout` aceita `isContextAvailable` e reutiliza `restoreWorkbenchPanels`: indisponível vira `PlaceholderDockviewPanel` (modo pinned, contexto original preservado, `retryPlaceholder` revive sem retargeting). Wrapper de placeholder relido via `parseWorkbenchLayout`, sem sufixo duplicado.
- `handleContainerWidth` usa `ResponsiveLayoutManager` + classe `workbench-compact`, preservando o painel ativo na reexpansão. Compactação aqui é preservação de seleção/config com hook visual (sem cirurgia nos grupos do dockview).
- `resetToDefaultLayout` fecha e readiciona os painéis do registry sem tocar nas instâncias/serviços (rascunhos, buffers, PTYs sobrevivem); exposto no elemento como `resetLayout()`. Sem gatilho de UI ainda — follow-up quando houver menu/toolbar da bancada.
- `DockviewWorkbenchPanel.initWorkbench` tenta restore primeiro (disponível = mesmo `environmentId` do contexto atual) e cai para os 3 painéis padrão em layout ausente/inválido; `ResizeObserver` alimenta `handleContainerWidth`.
- Smoke Web/AppImage de ponta a ponta pendente (mesma situação das issues 23–25; AppImage diferido por decisão do leo).

Verificação em 2026-09-17: `npm test -- --run src/client/workbench` — 9 arquivos, 51 testes verdes (5 novos em `DockviewWorkbench.test.ts`); `npm run typecheck` e `eslint` dos arquivos tocados limpos; `git diff --check` limpo. Changeset patch em `.changeset/workbench-layout-persistence.md`.

### 2026-09-19 — Robustez transacional (follow-up)

`restoreSavedLayout` encena os registros e faz rollback completo se `api.fromJSON` rejeitar a geometria (registry limpo para o fallback padrão). `retryPlaceholder` preserva o placeholder e restaura o registry se a adição do painel real falhar. Cobertos por 2 testes de caminho de falha em `DockviewWorkbench.test.ts` (arquivo agora com 7 testes: 5 originais + 2 de rollback).

Verificação em 2026-09-19: `npm test -- --run src/client/workbench` — 9 arquivos, 53 testes verdes; `npm run typecheck`, `eslint` dos tocados e `git diff --check` limpos.
