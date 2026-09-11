# Evidências — O que torna Projects e Threads do T3 Code simples de navegar?

Fonte: `pingdotgg/t3code`, commit `7bd7f99e6cab940892ff9240549c507bfd066aee` (HEAD em 2026-09-11, clone readonly em `/tmp/t3code-ro`).
Sem execução visual: todas as afirmações abaixo vêm de código-fonte e testes; nenhum screenshot ou runtime foi validado.

## Resumo em 30 segundos

O T3 Code tem **duas sidebars**: a padrão (`apps/web/src/components/Sidebar.tsx`, ~4930 linhas) organiza threads numa **lista única por ciclo de vida** — `pinned / active / snoozed / settled` — com identidade de projeto **por linha** (favicon + nome) e um **filtro de escopo por projeto** no topo, não uma árvore. A legada (`LegacySidebar.tsx`, ~3820 linhas, atrás do flag `legacySidebarEnabled`, default `false` em `packages/contracts/src/settings.ts:421`) é a árvore **Project → Threads** que o brief descreve. A lógica pura citada no brief existe mesmo: `components/Sidebar.logic.ts` (1237 linhas, com `Sidebar.logic.test.ts`). Agrupamento/ordenação compartilhados web+mobile vivem em `packages/client-runtime/src/state/` (`projectGrouping.ts`, `threadSort.ts`).

## As duas sidebars e quando cada uma aparece

- `AppSidebarLayout.tsx:146,230-256` — `useLegacySidebarEnabled()` escolhe entre `LegacyThreadSidebar` e `ThreadSidebar`. O hook (`hooks/useSettings.ts:378-383`) documenta que o default é a nova sidebar e o flag mora em Settings → General → Legacy features. Default do schema: `false` (`packages/contracts/src/settings.ts:421`, teste em `settings.test.ts:393-408`).
- Consequência para reuso: a árvore Project→Threads **não** é a UX atual padrão; é o modo legado. A UX padrão responde "qual trabalho precisa de mim?" (seções por ciclo de vida), não "onde está cada projeto?".

## Sidebar padrão: lista por ciclo de vida, projeto por linha

Classificação (`Sidebar.tsx:2491-2588`): cada thread visível (não-arquivada, dentro do escopo) cai numa seção, nesta precedência: `snoozed` (se `effectiveSnoozed`, supera todo o resto) → `settled` (se `settledOverride === "settled"` e o servidor tem capability) → `pinned` (se `pinnedAt != null`) → `active`. Servidores antigos sem capability nunca classificam como settled ("evita encalhar linhas sem affordance").

- **Ordenação por seção**: pinned por `pinOrderKey` (`sortPinnedThreadsForSidebar`); active por chaves de ordem ancoradas em criação (`sortThreadsForSidebar`); snoozed por wake mais próximo ("what comes back next"); settled por **quando o trabalho terminou** (`resolveSettledThreadTimestamp`: `settledAt`, senão última mensagem/turno, senão `updatedAt` — `Sidebar.logic.ts:933-945` e `threadSort.ts:27-50`).
- **Pinned usa fractional-index keys** (string base-26, `pinOrderKeyBetween`, `planPinnedReorder` em `client-runtime/src/state/threadSort.ts:154-231`): reordenar por drag escreve **uma chave numa thread**, sem tocar vizinhas que podem viver noutro servidor; todos os clientes convergem. Settling limpa o pin ("done beats keep on top"), snooze preserva o pin (`threadActionMenu.logic.ts:72-74`).
- **Shelves colapsadas por default**: `Settled (...)` e `Snoozed (...)` mostram contagem quando fechadas, chevron `ChevronDownIcon` rotaciona ao abrir (`Sidebar.tsx:629-683`); persistência em localStorage `t3code:sidebar:settled-expanded` / `t3code:sidebar:snoozed-expanded` (default `false`, `Sidebar.tsx:247-248,2668-2698`). Cauda settled paginada: 10 iniciais + 25 por "Show more" (`SETTLED_TAIL_INITIAL_COUNT/PAGE_COUNT`). A thread aberta **nunca** se esconde sob shelf colapsada ou "Show more" (`Sidebar.tsx:2646-2711`).
- **Sem seção "recent"**: recência é ordem de sort, não seção. O que há de "recente/ativo" acima da lista são **draft rows**: sessões de composer com conteúdo não-enviado aparecem acima do bloco pinned (`SidebarDraftBlock`, `Sidebar.tsx:792-880`) — duas linhas (projeto + prompt digitado), clique = navegar a `/draft/$draftId` sem tocar em nada.
- **Marcadores de drag** `pinned-header / pinned-divider / active-placeholder / settled-placeholder / snoozed-header / settled-header` (`Sidebar.logic.ts:96-123`) só ganham rótulo visível durante drag; snoozed **não** aceita drop ("snoozing requires a wake time", `Sidebar.logic.ts:90-94`).

## Sidebar legada: árvore Project → Threads

- **Cabeçalho de projeto** (`LegacySidebar.tsx:2358-2461`): chevron (rotate-90 quando expandido; quando colapsado **com** status, vira dot de status que revela o chevron no hover), `ProjectFavicon`, `displayName`, badge `N projects` quando agrupado, badge de ambiente remoto (ícone de máquina, tooltip com labels dos ambientes) e botão hover **new thread** (SquarePen). Clique alterna expansão; expansão persiste por `projectExpandedById` com chaves de preferência = projectKey + physicalKeys + chave legada de cwd (`projectExpansionPreferenceKeys`, `:264-270`; store em `uiStateStore.ts:23-65`).
- **Preview de threads**: default **6** visíveis, configurável 1–15 (`DEFAULT_SIDEBAR_THREAD_PREVIEW_COUNT = 6`, `settings.ts:63-72`; menu "Sidebar options" com number-field "Visible threads", `LegacySidebar.tsx:2790-2825`). Overflow → "Show more / Show less" com status agregado do oculto. Projeto colapsado com thread ativa mostra **só** a linha ativa ("pinnedCollapsedThread", `:1351-1416`).
- **Sort**: projetos `updated_at (Last user message) / created_at / manual` (manual = drag vertical com dnd-kit + `projectOrder` persistido); threads `updated_at / created_at` onde updated_at = **última mensagem do usuário**, não último evento (`SIDEBAR_*_LABELS :217-225`; timestamp em `threadSort.ts:63-100`). Sort de projeto por atividade usa o **máximo** dos timestamps das threads (`getProjectSortTimestamp`, `Sidebar.logic.ts:1104-1120`); threads arquivadas não contam para atividade (`sortLogicalProjectsForSidebar:1182`).
- **Agrupamento** (default `repository`, `settings.ts:56-62`): chave física `environmentId:caminho-normalizado`; chave lógica por identidade de repositório (+ caminho relativo em `repository_path`); `separate` = uma linha por path; override por projeto via diálogo "Group into..." (`LegacySidebar.tsx:1680-1768,2548-2617`). Deduplicação física com "winner", representante = ambiente primário quando presente, label do grupo = título do representante ou derivado do repo (`client-runtime/state/projectGrouping.ts:247-322`; snapshots com `displayName, groupedProjectCount, environmentPresence, memberProjects, memberProjectRefs` em `web/src/sidebarProjectGrouping.ts:54-121`). Quando agrupado, ações de projeto viram **submenu por membro** (`env label — workspaceRoot`).

## Linha de thread: sempre visível × contextual

Padrão, variante **card** (active/pinned, `h-[4.875rem]`): linha 1 favicon+nome do projeto e slot de status/ações; linha 2 **título** (sempre truncado); linha 3 branch + ícones (`Sidebar.tsx:1745-1953`). Variante **slim** (settled/snoozed, `h-9`): favicon esmaecido + título + tempo (`Sidebar.tsx:1563-1712`).

Sempre visível: título; projeto (favicon + nome); branch; timestamp relativo **ou** pill de status; glyph de máquina remota se `environmentId != currentEnvironmentId` (local não ganha marcador — "needs no marker"); badge de provider/modelo.

Contextual (hover/focus/tooltip): botões Settle / Snooze-presets / Wake-now / Un-settle / Discard-draft; pin clicável (unpin); PR badge; ícone de terminal com processos rodando; globo de porta descoberta; `ThreadWorktreeIndicator`; jump-hint substitui o timestamp enquanto o modificador está pressionado (`THREAD_JUMP_HINT_SHOW_DELAY_MS = 200`); toda linha tem tooltip rica (`SidebarThreadTooltip`: projeto, ambiente, modelo, branch-mismatch, terminal). Legada: mesmo padrão — archive/Confirm aparece no hover, timestamp some (`threadMetaClassName`, `:484-488`).

## Estados: seis status, cinco pills, um rollup

- Modelo (`Sidebar.logic.ts:784-843`): `approval / input / working / monitoring / failed / ready`. `ready` é o repouso **sem rótulo** ("finished, asked a question, or proposed a plan"); "unread completion" é rastreado à parte (`hasUnseenCompletion`: `completedAt > lastVisitedAt`, nunca-visitado conta como lido para não acender histórico). Falha de sessão supera liveness de fundo; `monitoring` é só watch-loops.
- Pills legadas (`resolveThreadStatusPill`, `:969-1058`): Working (sky, pulse), Connecting (sky, pulse), Pending Approval (amber), Awaiting Input (indigo), Plan Ready (violet), Monitoring (sky, sem pulse), Completed (emerald). Cabeçalho de projeto agrega pelo **máximo de prioridade** approval > input > working/connecting > plan-ready > monitoring > completed (`THREAD_STATUS_PRIORITY`, `:506-514`).
- Recuo visual (`shouldRecedeSidebarThread`, `:799-812` + `shouldRecede` na row): working/monitoring sempre recuam; ready/approval/input recuam só se lidos e sem wake; ativo/selecionado nunca recua.
- Labels de tempo: ativas "há quanto tempo" (`latestUserMessageAt ?? updatedAt ?? createdAt`); settled "há quanto terminou" (mesma chave do sort — label e ordem não divergem); snoozed mostra **quando volta** ("2h"), não quando foi tocada; working mostra duração decorrida `12s/3m/2h` (`formatWorkingDurationLabel`).

## Criação rápida

- Header padrão: input de busca + botão SquarePen "New thread" (desabilitado com 0 projetos). **Shift+click = cria no projeto atual**; clique normal com >1 projeto abre a paleta em `new-thread-in` (`Sidebar.tsx:4271-4306`; regra `shouldCreateNewThreadInCurrentProject`, `Sidebar.logic.ts:657-666`). Legada: mesmo botão por cabeçalho de projeto + diálogo de picker quando agrupado (`:1990-2076`).
- Menu "New thread on `<branch>`" (só quando a thread tem branch) carrega branch/worktree/envMode (`threadActionMenu.logic.ts:56-64`; handler legada `:2265-2287`).
- Nova thread = **draft local primeiro**: `useHandleNewThread` resolve projeto, carrega modelo/modo do contexto atual (composer visível vence estado persistido) e roteia a `/draft/$draftId`; promoção posterior liga o draft à thread servidor (`useHandleNewThread.ts:62-123`, `resolveActiveThreadRouteRef`).
- Projeto novo: botão FolderPlus → paleta `add-project` (padrão) / trigger `sidebar-add-project-trigger` (legada).

## Seleção, navegação, teclado

- Rota canônica `/$environmentId/$threadId` (`buildThreadRouteParams`, `threadRoutes.ts:42-50`): **toda ref é escopada** (`environmentId:threadId`), logo multi-servidor na mesma janela é estrutural, sem seletor global. Clique simples navega e fixa âncora; Cmd/Ctrl+click alterna, Shift+click seleciona intervalo sobre as chaves ordenadas **renderizadas** (via ref, para não quebrar memoização das linhas); elementos `data-thread-selection-safe` não limpam seleção (`threadSelectionStore.ts:1-131`, `shouldClearThreadSelectionOnMouseDown`).
- Duplo-clique = rename inline (desktop; mobile fica no menu); Enter/Espaço ativa; `commitRename` valida vazio/igual e chama `threadEnvironment.updateMetadata` (`LegacySidebar.tsx:2107-2151`).
- Jump hints: `threadJumpCommandForIndex(i)` + label de keybinding por linha; travessia prev/next (`resolveAdjacentThreadId`, `Sidebar.logic.ts:714-739`).
- Pós-delete: fallback = primeira thread do **mesmo projeto** na ordem atual; senão fica onde está (`getFallbackThreadIdAfterDelete`, `:1078-1103`).
- Arquivar ≠ settle ≠ deletar (comentário explícito em `threadActionMenu.logic.ts:124-128`): **Settle** = cauda Settled visível; **Archive** = some da sidebar, conversa em Settings → Archived threads (rejeita thread com turno ativo — item desabilitado em vez de falhar); **Delete** = apaga histórico, destrutivo, com confirmação configurável.

## Menus contextuais (fonte única)

`buildThreadActionMenuItems` (`threadActionMenu.logic.ts:52-143`) alimenta **sidebar e chat-header**, mesma ordem/labels/gating por capability: new-thread-on-branch → pin/unpin → settle/unsettle → snooze-submenu (presets `hour / three-hours / evening / tomorrow / next-week` com `whenLabel`, `threadSettled.ts:174-254`) → Rename → Regenerate title → Mark unread → Copy-submenu (Path / Branch / Thread ID) → Project settings → Archive thread → Delete. Multi-seleção (`Sidebar.logic.ts:444-487` + legada): Mark unread (N) / Archive (N, desabilitado com running) / Delete (N) + Unpin (N, só se houver pinned) + Regenerate titles. Projeto (legada, `:1671-1790`): Rename / Group into... / Copy Path / Project settings (`/projects/$projectKey`) / Remove (destrutivo; bloqueia com aviso se houver threads, "Delete anyway" opcional).

## Ícones de projeto e de ambiente

- `ProjectFavicon.tsx:98-181`: favicon real do repo quando há; senão ícone determinístico de `selectProjectIcon(nome, workspaceRoot)` — 24 nomes lucide com scoring por tokens + fallback estável (`projectIconModel.ts:1-192`) — mais override de emoji; cor via `projectIconColors`. Superfícies devem passar o **registro do projeto**, nunca só o label (comentário `:98-101` conta um drift já ocorrido na paleta). Picker: lista popular + busca full lucide + ~30 emojis (`projectIconOptions.ts`).
- Ambientes: `EnvironmentMachineIcon` por `resolveEnvironmentMachineKind(serverConfig)` — `server / cloud / linux / desktop / laptop / mac-mini / mac-studio` (as duas Apple desenhadas na gramática lucide). Linha mostra glyph só para remoto; header de grupo mostra badge só quando `environmentPresence === "remote-only"`, com tratamento "Local sandbox" vs "Remote" (`sidebarProjectGrouping.ts:17-27,85-119`).

## Busca e escopo (só sidebar padrão)

- Busca no header: "Search threads or PRs" (título + PRs linkadas, `searchSidebarThreads`), ARIA combobox/listbox completa, ↑/↓ + Enter, Esc limpa, scroll-into-view do ativo; resultados **mantêm a ordem do ciclo de vida** (`Sidebar.logic.ts:878-893`, render `:4555-4612`).
- Escopo de projeto: combobox "All projects / `<nome>`" com busca, empty-state, item-settings por linha, Shift+F10/ContextMenu abre settings, seleção persiste em `sidebarProjectScopeKey`; **trocar de escopo limpa a multi-seleção** para bulk-actions nunca tocarem linhas invisíveis (`Sidebar.tsx:2325-2434`).

## O que alimenta as questões em aberto

O ticket pede insumo às questões 6–8; o `map.md` lido não contém o texto dessas questões, então registro o insumo neutro correspondente: (a) **thread↔servidor**: no T3, thread pertence a exatamente um environment (`ScopedThreadRef`), e a janela mistura environments sem seletor global — o ponto de decisão para o novo produto é se "workspace" vira o escopo visível equivalente ao "project scope" deles; (b) **agrupamento**: grouping é presentational e reversível (modos + overrides), nunca apaga o projeto físico — membros seguem como alvos reais de navegação/criação; (c) **arquivamento vs settle**: dois eixos independentes (visibilidade de trabalho vs guarda de histórico), o que sugere não colapsar os dois num só "done" sem avaliar.

## Recomendações (não-decisões)

1. Adotar o vocabulário testável deles como ponto de partida: seções por ciclo de vida + `resolveSettledThreadTimestamp` único para sort e label; pills com prioridade documentada; "ready sem rótulo".
2. Copiar o padrão "sempre visível × hover": título/projeto/tempo-status sempre; ações destrutivas e lifecycle só no hover/focus — nunca remover o timestamp sem substituto (jump-hint conta como substituto).
3. Reaproveitar a matemática de `pinOrderKeyBetween`/`planPinnedReorder` para qualquer ordenação manual multi-servidor: uma chave por item, sem writes em vizinhos.
4. Manter refs escopadas `(environmentId, id)` em rotas, seleção, persistência e menus — é o que permite multi-servidor sem seletor global.
5. Separar draft (não-enviado) de thread (servidor) na navegação, com promoção explícita — evita o menu "archive vs delete vs settle" virar ambíguo.

## Limites e lacunas

- Sem validação visual/runtime; densidades, animações (`autoAnimate`, motion) e comportamento mobile avaliados só por leitura.
- Lógica servidor de settle/snooze/pin (validações, `canSnooze`, wake events) vista só pelos call-sites cliente e `client-runtime`; `apps/server` não foi auditado.
- Desktop (`apps/desktop`) e mobile (`apps/mobile`) não foram comparados linha a linha — afirmações de paridade vêm de comentários ("one shared rule on every platform") e da colocação em `client-runtime`, não de verificação cruzada.
- Contagens: `Sidebar.tsx` tem 4931 linhas, `LegacySidebar.tsx` 3822, `Sidebar.logic.ts` 1237 (medidos no checkout); descrições de UI citam linhas aproximadas que podem variar com o editor.
