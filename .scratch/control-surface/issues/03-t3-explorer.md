# O que torna Projects e Threads do T3 Code simples de navegar?

Type: research
Labels: wayfinder:research
Mode: AFK
Status: resolved
Assignee: leo
Parent: ../map.md
Blocked by:
Research branch: research/t3-explorer
Research asset: [Evidências — O que torna Projects e Threads do T3 Code simples de navegar?](../research/t3-explorer.md)

## Question

Investigar no código real de `pingdotgg/t3code` a UX de Project/Thread: Sidebar, Sidebar.logic ou equivalentes reais, grouping, ordering, ícones, estados, running/completed, pinned/recent, collapse/expand, criação rápida, seleção, navegação e menus contextuais.

Cobrir Etapa C e alimentar as questões abertas 6, 7 e 8. Separar o comportamento observado das propostas para o novo produto. Aqui já está decidido que uma janela reúne threads de servidores diferentes e cada thread pertence a um único servidor; Workspace permanece aberto. Não impor um seletor global único por copiar outra aplicação.

Relatar quais informações ficam sempre visíveis e quais aparecem contextualmente, com fontes fixadas em commit. Usar screenshot oficial ou runtime real apenas se acessível, sem fingir validação visual a partir de código. Não decidir a UX final nem construir o Project Explorer.
## Comments
### 2026-09-11 — Resolução (pesquisa executada pelo agente Wayfinder; assignee: leo)
Pesquisa concluída contra `pingdotgg/t3code` @ `7bd7f99e6cab940892ff9240549c507bfd066aee`. Achado central: a sidebar padrão atual organiza threads por ciclo de vida (pinned/active/snoozed/settled) com projeto por linha, e a árvore Project→Threads vive no modo legado atrás de flag (`legacySidebarEnabled`, default `false`) — registro factual, sem recomendar qual modelo o novo produto adota. Questões 6–8 do brief §14 cobertas em ## Answer e no relatório. Correções pós-revisão: contagem de pills, qualificação card×slim×capability, URLs permanentes no relatório, sem promessa de convergência concorrente.
## Answer
**O que torna Projects e Threads do T3 Code simples de navegar** (fonte: `pingdotgg/t3code` @ `7bd7f99`, sem validação visual — só leitura de código; URLs permanentes no relatório):
- **Duas sidebars**: a padrão (`apps/web/src/components/Sidebar.tsx`) é uma lista única por ciclo de vida — seções `pinned / active / snoozed / settled` — com favicon+nome do projeto em cada linha e filtro de escopo por projeto no topo; a árvore Project→Threads é o modo **legado** (`LegacySidebar.tsx`, flag `legacySidebarEnabled`, default `false`). A `Sidebar.logic` do brief existe (`components/Sidebar.logic.ts`, pura e testada); grouping/sort compartilhados web+mobile moram em `packages/client-runtime/src/state/`. Qual modelo o produto adota é decisão humana.
- **Visível × contextual, por variante**: card (active/pinned) mostra título, projeto (favicon+nome), branch (só se houver), tempo-ou-pill e glyph remoto; slim (settled/snoozed) mostra só favicon esmaecido + título + tempo/wake/Woke. Ações Settle/Snooze/Wake/Un-settle/Discard-draft/unpin só no hover/focus e só se o servidor anuncia a capability; PR/terminal/porta/worktree só com dados; jump-hints substituem o timestamp com modificador.
- **Estados**: seis status (`approval / input / working / monitoring / failed / ready`, ready sem rótulo); **sete** pills (Working/Connecting/Pending Approval/Awaiting Input/Plan Ready/Monitoring/Completed) com rollup por prioridade no header; running = `session.status == running + activeTurnId`; unread = `completedAt > lastVisitedAt`; working/monitoring "recuam" visualmente.
- **Pinned sem seção "recent"**: pin = `pinnedAt + pinOrderKey` (chaves fracionárias base-26: um drag escreve uma chave, sem tocar vizinhas — convergência sob concorrência **não** verificada); settling limpa o pin, snooze preserva. Recência é ordem de sort; drafts não-enviados ficam acima do pinned.
- **Collapse/expand**: projetos (legada, `projectExpandedById`), shelves Settled/Snoozed colapsadas por default com contagem (localStorage), cauda settled paginada 10+25; a thread aberta nunca se esconde.
- **Criação rápida**: botão SquarePen no header (Shift+click = projeto atual, senão picker `new-thread-in`), botão por projeto na legada, "New thread on `<branch>`", drafts locais promovidos depois (`/draft/$draftId` → thread servidor).
- **Seleção/navegação**: rota `/$environmentId/$threadId`, refs sempre escopadas (multi-servidor estrutural, sem seletor global); plain-click navega, Cmd/Ctrl alterna, Shift cobre intervalo; duplo-clique renomeia; fallback pós-delete = mesmo projeto na ordem atual.
- **Menus (fonte única `buildThreadActionMenuItems`)**: new-thread-on-branch, pin/unpin, settle/unsettle, snooze-presets, rename, regenerate title, mark unread, Copy (path/branch/ID), project settings, archive (bloqueado com turno ativo), delete. Archive ≠ settle ≠ delete.
- **Ícones**: `ProjectFavicon` (favicon real ou ícone determinístico + emoji override) e glyphs de máquina (local sem marcador).
- **Q6 (Workspace visível ou contextual?)**: no T3, path é contextual (diálogos, Copy Path, tooltips, chaves de agrupamento); o visível é branch + nome do projeto.
- **Q7 (Machine: seletor global ou no Explorer?)**: não há seletor global de machine na navegação (o único combobox da sidebar filtra projeto; o seletor de environment é do composer). Machine aparece embutida: glyph por linha remota, badge em grupo remoto, labels em tooltips/submenus.
- **Q8 (multi-servidor sem poluição)**: refs escopadas em tudo; local sem marcador; agrupamento lógico colapsa mesmo repo em N ambientes numa linha; capabilities escondem affordances; histórico colapsado+paginado; picker com preferido primeiro.
- Detalhes, linhas e limites em [Evidências — O que torna Projects e Threads do T3 Code simples de navegar?](../research/t3-explorer.md).
