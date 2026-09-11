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
### 2026-09-11 — Resolução (AFK, leo)
Pesquisa concluída contra `pingdotgg/t3code` @ `7bd7f99`. Achado central: a sidebar padrão atual organiza threads por ciclo de vida (pinned/active/snoozed/settled) com projeto por linha, e a árvore Project→Threads vive no modo legado atrás de flag. Cobertura completa da pergunta em ## Answer e no relatório ligado acima.
## Answer
**O que torna Projects e Threads do T3 Code simples de navegar** (fonte: `pingdotgg/t3code` @ `7bd7f99`, sem validação visual — só leitura de código):
- **Duas sidebars**: a padrão (`apps/web/src/components/Sidebar.tsx`) é uma lista única por ciclo de vida — seções `pinned / active / snoozed / settled` — com favicon+nome do projeto em cada linha e filtro de escopo por projeto no topo; a árvore Project→Threads é o modo **legado** (`LegacySidebar.tsx`, flag `legacySidebarEnabled`, default `false`). A `Sidebar.logic` do brief existe (`components/Sidebar.logic.ts`, pura e testada); grouping/sort compartilhados web+mobile moram em `packages/client-runtime/src/state/`.
- **Sempre visível na linha**: título, projeto (favicon + nome), branch, tempo ou pill de status, glyph de máquina só se remoto, badge de provider/modelo. **Contextual (hover/focus/tooltip)**: Settle/Snooze/Wake/Un-settle/Discard-draft, unpin, PR badge, terminal, porta descoberta, jump-hints no lugar do timestamp, tooltips ricas.
- **Estados**: `approval / input / working / monitoring / failed / ready` (ready = repouso sem rótulo); pills Working/Connecting/Pending Approval/Awaiting Input/Plan Ready/Monitoring/Completed com rollup por prioridade no header do projeto; running = `session.status == running + activeTurnId`; unread = `completedAt > lastVisitedAt`; threads working/monitoring "recuam" visualmente.
- **Pinned sem seção "recent"**: pin = `pinnedAt + pinOrderKey` (fractional-index base-26: um drag escreve uma chave, sem tocar vizinhas de outros servidores); settling limpa o pin, snooze preserva. Recência é ordem de sort, não seção; drafts não-enviados ficam acima do pinned.
- **Collapse/expand**: projetos (legada, persistido por `projectExpandedById`), shelves Settled/Snoozed colapsadas por default com contagem (localStorage), cauda settled paginada 10+25; a thread aberta nunca se esconde.
- **Criação rápida**: botão SquarePen no header (Shift+click = projeto atual, senão picker `new-thread-in`), botão por projeto na legada, "New thread on `<branch>`", drafts locais promovidos depois (`/draft/$draftId` → thread servidor).
- **Seleção/navegação**: rota `/$environmentId/$threadId`, refs sempre escopadas (multi-servidor estrutural, sem seletor global); plain-click navega, Cmd/Ctrl alterna, Shift cobre intervalo; duplo-clique renomeia; fallback pós-delete = mesma projeto na ordem atual.
- **Menus (fonte única `buildThreadActionMenuItems`, sidebar + chat-header)**: new-thread-on-branch, pin/unpin, settle/unsettle, snooze-presets (1h/3h/noite/amanhã/semana que vem), rename, regenerate title, mark unread, Copy (path/branch/ID), project settings, archive (bloqueado com turno ativo), delete. Archive ≠ settle ≠ delete.
- **Ícones**: `ProjectFavicon` (favicon real ou ícone determinístico por nome+path + emoji override) e glyphs de máquina (`server/cloud/linux/desktop/laptop/mac-mini/mac-studio`), local sem marcador.
- **Insumo às questões 6–8** (texto não localizado no `map.md`): thread = exatamente um environment; grouping é presentational/reversível sem apagar o projeto físico; settle × archive são eixos independentes.
- Detalhes, linhas e limites em [Evidências — O que torna Projects e Threads do T3 Code simples de navegar?](../research/t3-explorer.md).
