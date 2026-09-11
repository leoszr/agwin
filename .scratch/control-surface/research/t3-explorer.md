# Evidências — O que torna Projects e Threads do T3 Code simples de navegar?

Fonte: `pingdotgg/t3code`, commit `7bd7f99e6cab940892ff9240549c507bfd066aee` (HEAD em 2026-09-11, clone readonly em `/tmp/t3code-ro`).
Pesquisa executada pelo agente Wayfinder (assignee do ticket: leo). Sem execução visual: todas as afirmações vêm de leitura de código-fonte e testes; nenhum screenshot ou runtime foi validado. Nada aqui decide a UX do novo produto — § "O que isto não decide" ao final.

URLs permanentes (blob no SHA citado; linhas conferidas no checkout):

- Sidebar padrão: <https://github.com/pingdotgg/t3code/blob/7bd7f99e6cab940892ff9240549c507bfd066aee/apps/web/src/components/Sidebar.tsx>
- Sidebar legada: <https://github.com/pingdotgg/t3code/blob/7bd7f99e6cab940892ff9240549c507bfd066aee/apps/web/src/components/LegacySidebar.tsx>
- Lógica pura/testada: <https://github.com/pingdotgg/t3code/blob/7bd7f99e6cab940892ff9240549c507bfd066aee/apps/web/src/components/Sidebar.logic.ts> (+ `Sidebar.logic.test.ts` no mesmo diretório)
- Alternância entre as duas: <https://github.com/pingdotgg/t3code/blob/7bd7f99e6cab940892ff9240549c507bfd066aee/apps/web/src/components/AppSidebarLayout.tsx#L146-L256>
- Flag + defaults de sort/agrupamento: <https://github.com/pingdotgg/t3code/blob/7bd7f99e6cab940892ff9240549c507bfd066aee/packages/contracts/src/settings.ts#L48-L72> (sort/grouping), <https://github.com/pingdotgg/t3code/blob/7bd7f99e6cab940892ff9240549c507bfd066aee/packages/contracts/src/settings.ts#L421> (`legacySidebarEnabled`, default `false`; testes em `packages/contracts/src/settings.test.ts:393-408`)
- Ordenação e chaves de pin: <https://github.com/pingdotgg/t3code/blob/7bd7f99e6cab940892ff9240549c507bfd066aee/packages/client-runtime/src/state/threadSort.ts#L154-L231> (pin), <https://github.com/pingdotgg/t3code/blob/7bd7f99e6cab940892ff9240549c507bfd066aee/packages/client-runtime/src/state/threadSort.ts#L27-L50> (timestamp de settled)
- Agrupamento lógico de projetos: <https://github.com/pingdotgg/t3code/blob/7bd7f99e6cab940892ff9240549c507bfd066aee/packages/client-runtime/src/state/projectGrouping.ts#L247-L322> (+ `apps/web/src/sidebarProjectGrouping.ts:54-121` para os snapshots com `displayName`, `groupedProjectCount`, `environmentPresence`)
- Menu de ações (fonte única sidebar + chat-header): <https://github.com/pingdotgg/t3code/blob/7bd7f99e6cab940892ff9240549c507bfd066aee/apps/web/src/components/threadActionMenu.logic.ts#L52-L143>
- Ícones: `apps/web/src/components/ProjectFavicon.tsx:98-181`, `apps/web/src/projectIconModel.ts:1-192`, `apps/web/src/projectIconOptions.ts`, `apps/web/src/components/EnvironmentMachineIcon.tsx:46-75`

## Resumo em 30 segundos

O T3 Code tem **duas sidebars**. A padrão (`Sidebar.tsx`, ~4930 linhas) organiza threads numa **lista única por ciclo de vida** — `pinned / active / snoozed / settled` — com identidade de projeto **por linha** (favicon + nome) e um **filtro de escopo por projeto** no topo, não uma árvore. A árvore **Project → Threads** que o brief descreve é o modo **legado** (`LegacySidebar.tsx`, ~3820 linhas, atrás do flag `legacySidebarEnabled`, default `false`). A lógica pura citada no brief existe: `Sidebar.logic.ts` (1237 linhas, com `Sidebar.logic.test.ts`). Agrupamento/ordenação compartilhados web+mobile vivem em `packages/client-runtime/src/state/` (`projectGrouping.ts`, `threadSort.ts`).

## As duas sidebars e quando cada uma aparece

- `AppSidebarLayout.tsx:146,230-256` — `useLegacySidebarEnabled()` escolhe entre `LegacyThreadSidebar` e `ThreadSidebar`. O hook (`hooks/useSettings.ts:378-383`) documenta o flag em Settings → General → Legacy features, com default da nova sidebar até hidratar settings. Schema default `false` (`settings.ts:421`).
- Consequência para a investigação: a árvore Project→Threads **não** é a UX padrão atual; é o modo legado preservado. A UX padrão responde "qual trabalho precisa de mim?" (seções por ciclo de vida), não "onde está cada projeto?".

## Sidebar padrão: lista por ciclo de vida, projeto por linha

Classificação (`Sidebar.tsx:2491-2588`): cada thread visível (não-arquivada, dentro do escopo) cai numa seção, nesta precedência: `snoozed` (se `effectiveSnoozed`, supera todo o resto) → `settled` (se `settledOverride === "settled"` e o servidor tem capability) → `pinned` (se `pinnedAt != null`) → `active`. Servidores antigos sem capability nunca classificam como settled ("evita encalhar linhas sem affordance").

- **Ordenação por seção**: pinned por `pinOrderKey` (`sortPinnedThreadsForSidebar`); active por chaves de ordem ancoradas em criação (`sortThreadsForSidebar`); snoozed por wake mais próximo ("what comes back next"); settled por **quando o trabalho terminou** (`resolveSettledThreadTimestamp`: `settledAt`, senão última mensagem/turno, senão `updatedAt` — `Sidebar.logic.ts:933-945`, `threadSort.ts:27-50`).
- **Pinned usa chaves fracionárias** (string base-26, `pinOrderKeyBetween`, `planPinnedReorder`, `threadSort.ts:154-231`): o comentário no código afirma que reordenar escreve **uma chave numa thread**, sem tocar vizinhas que podem viver noutro servidor, e que web e mobile computam a mesma ordem a partir dos mesmos dados. **Qualificação**: li o helper, o comentário e os testes adjacentes (`threadSort.test.ts`, `Sidebar.logic.test.ts` existem); **não** verifiquei convergência sob concorrência nem executei os testes — tratar "converge entre clientes" como afirmação do código, não fato medido.
- Settling limpa o pin ("done beats keep on top"), snooze preserva o pin (`threadActionMenu.logic.ts:72-74`).
- **Shelves colapsadas por default**: `Settled (...)` e `Snoozed (...)` mostram contagem quando fechadas, chevron rotaciona ao abrir (`Sidebar.tsx:629-683`); persistência em localStorage `t3code:sidebar:settled-expanded` / `t3code:sidebar:snoozed-expanded` (default `false`, `Sidebar.tsx:247-248,2668-2698`). Cauda settled paginada: 10 iniciais + 25 por "Show more" (`SETTLED_TAIL_INITIAL_COUNT/PAGE_COUNT`, `:244`). A thread aberta **nunca** se esconde sob shelf colapsada ou "Show more" (`:2646-2711`).
- **Sem seção "recent"**: recência é ordem de sort, não seção. O que há de "recente/ativo" acima da lista são **draft rows**: sessões de composer com conteúdo não-enviado aparecem acima do bloco pinned (`SidebarDraftBlock`, `:792-880`) — duas linhas (projeto + prompt digitado), clique = navegar a `/draft/$draftId` sem tocar em nada.
- **Marcadores de drag** `pinned-header / pinned-divider / active-placeholder / settled-placeholder / snoozed-header / settled-header` (`Sidebar.logic.ts:96-123`) só ganham rótulo visível durante drag; snoozed **não** aceita drop ("snoozing requires a wake time", `:90-94`).

## Sidebar legada: árvore Project → Threads

- **Cabeçalho de projeto** (`LegacySidebar.tsx:2358-2461`): chevron (rotate-90 quando expandido; quando colapsado **com** status, vira dot de status que revela o chevron no hover), `ProjectFavicon`, `displayName`, badge `N projects` quando agrupado, badge de ambiente remoto (ícone de máquina, tooltip com labels dos ambientes) e botão hover **new thread** (SquarePen). Clique alterna expansão; expansão persiste por `projectExpandedById` com chaves de preferência = projectKey + physicalKeys + chave legada de cwd (`projectExpansionPreferenceKeys`, `:264-270`; store em `uiStateStore.ts:23-65`).
- **Preview de threads**: default **6** visíveis, configurável 1–15 (`DEFAULT_SIDEBAR_THREAD_PREVIEW_COUNT = 6`, `settings.ts:63-72`; menu "Sidebar options" com number-field "Visible threads", `LegacySidebar.tsx:2790-2825`). Overflow → "Show more / Show less" com status agregado do oculto. Projeto colapsado com thread ativa mostra **só** a linha ativa ("pinnedCollapsedThread", `:1351-1416`).
- **Sort**: projetos `updated_at (Last user message) / created_at / manual` (manual = drag vertical com dnd-kit + `projectOrder` persistido); threads `updated_at / created_at` onde updated_at = **última mensagem do usuário**, não último evento (`SIDEBAR_*_LABELS :217-225`; timestamp em `threadSort.ts:63-100`). Sort de projeto por atividade usa o **máximo** dos timestamps das threads (`getProjectSortTimestamp`, `Sidebar.logic.ts:1104-1120`); threads arquivadas não contam para atividade (`sortLogicalProjectsForSidebar:1182`).
- **Agrupamento** (default `repository`, `settings.ts:56-62`): chave física `environmentId:caminho-normalizado`; chave lógica por identidade de repositório (+ caminho relativo em `repository_path`); `separate` = uma linha por path; override por projeto via diálogo "Group into..." (`LegacySidebar.tsx:1680-1768,2548-2617`). Deduplicação física com "winner", representante = ambiente primário quando presente, label do grupo = título do representante ou derivado do repo (`projectGrouping.ts:247-322`; snapshots em `sidebarProjectGrouping.ts:54-121`). Quando agrupado, ações de projeto viram **submenu por membro** (`env label — workspaceRoot`).

## Linha de thread: visível × contextual, por variante e capability

Duas variantes na sidebar padrão. **Card** (active/pinned, `h-[4.875rem]`, `Sidebar.tsx:1745-1953`): linha 1 favicon+nome do projeto e slot status/ações; linha 2 **título** truncado; linha 3 branch + ícones. **Slim** (settled/snoozed, `h-9`, `:1563-1712`): favicon esmaecido em repouso + título + tempo (ou wake-countdown / pill Woke) — sem linha de branch, sem slot de status.

Qualificação campo a campo (nada é "sempre visível" sem condição):

- Título: sempre renderizado nas duas variantes (input inline durante rename).
- Projeto (favicon + nome): card sempre; slim só favicon (nome some).
- Branch: só no card, só se a thread tem branch; o comentário (`:1901-1903`) diz que o branch ocupa o slot deliberadamente por ser "o identificador mais estável".
- Timestamp relativo **ou** pill de status: mesmo slot, alternam — pill quando há estado (Working/Monitoring/Approval/Input/Failed/Done/Woke), tempo caso contrário; jump-hint de teclado substitui o timestamp enquanto o modificador está pressionado (`THREAD_JUMP_HINT_SHOW_DELAY_MS = 200`).
- Glyph de máquina remota: só se `environmentId != currentEnvironmentId`; ambiente local nunca ganha marcador (`:1190-1194`). Badge de provider/modelo: só se a instância resolve para uma entry conhecida.
- PR badge, ícone de terminal, globo de porta, `ThreadWorktreeIndicator`, diff `+x −y` (hoje sempre `null` — seam declarada em `latestTurnDiff`, `:1963-1970`): só com dados.
- Botões Settle / Snooze / Wake / Un-settle / Discard-draft / Unpin: **só no hover/focus**, e Settle/Snooze/Pin **só se o servidor anuncia a capability** (`threadSettlement`, `threadSnooze`, `threadPinning` lidas de `serverConfigs`; affordances somem em vez de falhar — `:4669-4680`, `:1343-1346`). Sem capability de settlement, a thread sequer classifica como settled.
- Legada, mesmo padrão: botão archive/Confirm no hover com o timestamp cedendo o slot (`threadMetaClassName`, `:484-488`); tooltip rica em todas as linhas.

## Estados: seis status, sete pills, um rollup (correção de contagem)

- Modelo (`Sidebar.logic.ts:784-843`): **seis** status — `approval / input / working / monitoring / failed / ready`. `ready` é o repouso **sem rótulo** ("finished, asked a question, or proposed a plan"); "unread completion" é rastreado à parte (`hasUnseenCompletion`: `completedAt > lastVisitedAt`, nunca-visitado conta como lido para não acender histórico). Falha de sessão supera liveness de fundo; `monitoring` é só watch-loops.
- Pills legadas (`resolveThreadStatusPill`, `:969-1058`): **sete** labels — Working (sky, pulse), Connecting (sky, pulse), Pending Approval (amber), Awaiting Input (indigo), Plan Ready (violet), Monitoring (sky, sem pulse), Completed (emerald). (Versão anterior deste relatório dizia "cinco pills" e listava sete — corrigido.)
- Cabeçalho de projeto agrega pelo **máximo de prioridade** approval > input > working/connecting > plan-ready > monitoring > completed (`THREAD_STATUS_PRIORITY`, `:506-514`).
- Recuo visual (`shouldRecedeSidebarThread`, `:799-812` + `shouldRecede` na row): working/monitoring sempre recuam; ready/approval/input recuam só se lidos e sem wake; ativo/selecionado nunca recua.
- Labels de tempo: ativas "há quanto tempo" (`latestUserMessageAt ?? updatedAt ?? createdAt`); settled "há quanto terminou" (mesma chave do sort — label e ordem não divergem); snoozed mostra **quando volta** ("2h"), não quando foi tocada; working mostra duração decorrida `12s/3m/2h` (`formatWorkingDurationLabel`).

## Criação rápida

- Header padrão: input de busca + botão SquarePen "New thread" (desabilitado com 0 projetos). **Shift+click = cria no projeto atual**; clique normal com >1 projeto abre a paleta em `new-thread-in` (`Sidebar.tsx:4271-4306`; regra `shouldCreateNewThreadInCurrentProject`, `Sidebar.logic.ts:657-666`). Legada: mesmo botão por cabeçalho de projeto + diálogo de picker quando agrupado (`:1990-2076`).
- Menu "New thread on `<branch>`" (só quando a thread tem branch) carrega branch/worktree/envMode (`threadActionMenu.logic.ts:56-64`; handler legada `:2265-2287`).
- Nova thread = **draft local primeiro**: `useHandleNewThread` (`hooks/useHandleNewThread.ts:62-123`) resolve projeto, carrega modelo/modo do contexto atual (composer visível vence estado persistido) e roteia a `/draft/$draftId`; promoção posterior liga o draft à thread servidor (`resolveActiveThreadRouteRef`, `threadRoutes.ts`).
- Projeto novo: botão FolderPlus → paleta `add-project` (padrão) / trigger `sidebar-add-project-trigger` (legada).

## Seleção, navegação, teclado

- Rota canônica `/$environmentId/$threadId` (`buildThreadRouteParams`, `threadRoutes.ts:42-50`): **toda ref é escopada** (`environmentId:threadId`), logo multi-servidor na mesma janela é estrutural, sem seletor global. Clique simples navega e fixa âncora; Cmd/Ctrl+click alterna, Shift+click seleciona intervalo sobre as chaves ordenadas **renderizadas** (via ref, para não quebrar memoização das linhas); elementos `data-thread-selection-safe` não limpam seleção (`threadSelectionStore.ts:1-131`, `shouldClearThreadSelectionOnMouseDown`).
- Duplo-clique = rename inline (desktop; mobile fica no menu); Enter/Espaço ativa; `commitRename` valida vazio/igual e chama `threadEnvironment.updateMetadata` (`LegacySidebar.tsx:2107-2151`).
- Jump hints: `threadJumpCommandForIndex(i)` + label de keybinding por linha; travessia prev/next (`resolveAdjacentThreadId`, `Sidebar.logic.ts:714-739`).
- Pós-delete: fallback = primeira thread do **mesmo projeto** na ordem atual; senão fica onde está (`getFallbackThreadIdAfterDelete`, `:1078-1103`).
- Arquivar ≠ settle ≠ deletar (comentário explícito em `threadActionMenu.logic.ts:124-128`): **Settle** = cauda Settled visível; **Archive** = some da sidebar, conversa em Settings → Archived threads (rejeita thread com turno ativo — item desabilitado em vez de falhar); **Delete** = apaga histórico, destrutivo, com confirmação configurável.

## Menus contextuais (fonte única)

`buildThreadActionMenuItems` (`threadActionMenu.logic.ts:52-143`) alimenta **sidebar e chat-header**, mesma ordem/labels/gating por capability: new-thread-on-branch → pin/unpin → settle/unsettle → snooze-submenu (presets `hour / three-hours / evening / tomorrow / next-week` com `whenLabel`, `client-runtime/src/state/threadSettled.ts:174-254`) → Rename → Regenerate title → Mark unread → Copy-submenu (Path / Branch / Thread ID) → Project settings → Archive thread → Delete. Multi-seleção (`Sidebar.logic.ts:444-487`): Mark unread (N) / Archive (N, desabilitado com running) / Delete (N) + Unpin (N, só se houver pinned) + Regenerate titles. Projeto (legada, `:1671-1790`): Rename / Group into... / Copy Path / Project settings (`/projects/$projectKey`) / Remove (destrutivo; bloqueia com aviso se houver threads, "Delete anyway" opcional).

## Ícones de projeto e de ambiente

- `ProjectFavicon.tsx:98-181`: favicon real do repo quando há; senão ícone determinístico de `selectProjectIcon(nome, workspaceRoot)` — 24 nomes lucide com scoring por tokens + fallback estável (`projectIconModel.ts:1-192`) — mais override de emoji; cor via `projectIconColors`. Superfícies devem passar o **registro do projeto**, nunca só o label (comentário `:98-101` conta um drift já ocorrido na paleta). Picker: lista popular + busca full lucide + ~30 emojis (`projectIconOptions.ts`).
- Ambientes: `EnvironmentMachineIcon` por `resolveEnvironmentMachineKind(serverConfig)` — `server / cloud / linux / desktop / laptop / mac-mini / mac-studio` (as duas Apple desenhadas na gramática lucide). Linha mostra glyph só para remoto; header de grupo mostra badge só quando `environmentPresence === "remote-only"`, com tratamento "Local sandbox" vs "Remote" (`sidebarProjectGrouping.ts:17-27,85-119`).

## Busca e escopo (só sidebar padrão)

- Busca no header: "Search threads or PRs" (título + PRs linkadas, `searchSidebarThreads`), ARIA combobox/listbox completa, ↑/↓ + Enter, Esc limpa, scroll-into-view do ativo; resultados **mantêm a ordem do ciclo de vida** (`Sidebar.logic.ts:878-893`, render `Sidebar.tsx:4555-4612`).
- Escopo de projeto: combobox "All projects / `<nome>`" com busca, empty-state, botão settings por linha, Shift+F10/ContextMenu abre settings, seleção persiste em `sidebarProjectScopeKey`; **trocar de escopo limpa a multi-seleção** para bulk-actions nunca tocarem linhas invisíveis (`Sidebar.tsx:2325-2434`).

## Cobertura das questões abertas 6, 7 e 8 (brief §14)

Texto das questões em `brief.md:1015-1017`. Abaixo só o comportamento observado no T3, sem proposta para o novo produto.

### Q6 — Workspace deve continuar visível na navegação ou virar detalhe contextual?

No T3, **workspace path é detalhe contextual; branch + nome do projeto são os identificadores visíveis**:

- Nenhuma linha de thread exibe `workspaceRoot`/`worktreePath`. O slot de terceira linha do card é **sempre o branch** ("Always the branch… the row lost its most stable identifier" sem ele — `Sidebar.tsx:1901-1913`).
- `workspaceRoot` aparece em: diálogo Rename project ("Update the title for `<workspaceRoot>`", `LegacySidebar.tsx:2512-2516`); rótulos de membros agrupados (`env label — workspaceRoot`, `sidebarProjectGrouping` + `formatProjectMemberActionLabel :251-262`); itens Copy Path; tooltip rica da linha; rota de settings do projeto. `worktreePath` decide env-mode local/worktree e o cwd das queries git (`Sidebar.tsx:1058-1072`), nunca é texto de navegação.
- Draft rows mostram nome do projeto + prompt, sem path.
- Observação para quem decidir: o T3 nunca usa path como identidade primária — a chave física (`environmentId:path`) existe só como chave de agrupamento/ordenação (`projectGrouping.ts:67-87`).

### Q7 — Machine deve aparecer como selector global ou dentro do Project Explorer?

No T3 **não há seletor global de machine na navegação**:

- Verificação: `LegacySidebar.tsx` tem zero combobox (`grep Combobox` = 0); a `Sidebar.tsx` padrão tem exatamente um combobox e ele filtra **projeto** ("All projects", `:4410-4528`), nunca environment. O seletor de environment existente (`BranchToolbarEnvironmentSelector`, usado em `BranchToolbar.tsx`) é do **composer/toolbar da thread aberta**, não da navegação lateral.
- Machine aparece embutida na navegação em três pontos: glyph por linha (só remoto); badge no header de grupo remoto (`environmentPresence === "remote-only"`); labels de ambiente nos tooltips e nos submenus de membros agrupados. Ou seja: o padrão observado é **machine como atributo contextual da linha/grupo**, não como seletor global — com a ressalva de que o escopo-projeto (combobox) é o único "seletor" da sidebar nova.

### Q8 — Como representar múltiplos servidores/machines sem poluir a UI?

Técnicas observadas, da mais estrutural à mais visual:

1. **Refs escopadas em tudo** (`environmentId:id` em rotas, seleção, persistência, menus, chaves de agrupamento/ordenação) — mistura de servidores sem nenhum seletor global; verificado em `threadRoutes.ts`, `threadSelectionStore.ts`, `projectGrouping.ts`, `threadSort.ts`.
2. **Local sem marcador**: o ambiente primário não ganha glyph nem label; só o diferente é marcado (`Sidebar.tsx:1190-1194`). Com hosted app (sem primário), todo glyph aparece — o custo é assumido como o ponto.
3. **Colapso por agrupamento lógico**: mesmo repo em N ambientes vira **uma linha** com badge `N projects` + submenu por membro (legada); na nova, o nome do grupo viaja separado do registro (`projectDisplayNameByKey` vs `projectByKey`, `Sidebar.tsx:2299-2315`).
4. **Capabilities escondem affordances** em vez de errarem: sem `threadSettlement/threadSnooze/threadPinning`, botões e até a classificação somem (`Sidebar.tsx:2510-2558,4669-4680`).
5. **Histórico colapsado por default** (shelves + paginação 10+25) impede cauda settled de dominar; contagens (`Snoozed (N)`) mantêm consciência sem linhas.
6. **Entries de picker com preferido primeiro** (`buildSidebarProjectPickerEntries`, `sidebarProjectGrouping.ts:123-164`): o projeto do contexto atual sobe ao topo em vez de exigir busca.

## Recomendações (não-decisões)

1. Adotar o vocabulário testável deles como ponto de partida: seções por ciclo de vida + `resolveSettledThreadTimestamp` único para sort e label; pills com prioridade documentada; "ready sem rótulo".
2. Copiar o padrão "visível × hover" qualificado acima: título/projeto/tempo-status por variante; ações destrutivas e lifecycle só no hover/focus — nunca remover o timestamp sem substituto (jump-hint conta como substituto).
3. Avaliar a matemática de `pinOrderKeyBetween`/`planPinnedReorder` para ordenação manual multi-servidor: uma chave por item, sem writes em vizinhos (convergência sob concorrência **não** verificada aqui).
4. Manter refs escopadas `(environmentId, id)` em rotas, seleção, persistência e menus — é o que permite multi-servidor sem seletor global.
5. Separar draft (não-enviado) de thread (servidor) na navegação, com promoção explícita.

## O que isto não decide

- Qual sidebar (lifecycle vs árvore) o novo produto adota; se workspace vira visível ou contextual; se machine ganha seletor global ou fica embutida; como o Project Explorer representa multi-servidor. Essas são decisões humanas (brief §14–15).
- A descoberta do modo legado é factual (flag + default + alternância citados acima) e não recomenda remoção nem adoção de nenhum dos dois modelos.

## Limites e lacunas

- Sem validação visual/runtime; densidades, animações (`autoAnimate`, motion) e comportamento mobile avaliados só por leitura.
- Lógica servidor de settle/snooze/pin (validações, `canSnooze`, wake events) vista só pelos call-sites cliente e `client-runtime`; `apps/server` não foi auditado.
- Desktop (`apps/desktop`) e mobile (`apps/mobile`) não foram comparados linha a linha — afirmações de paridade vêm de comentários ("one shared rule on every platform") e da colocação em `client-runtime`, não de verificação cruzada.
- Convergência de ordem entre clientes sob writes concorrentes: não verificada (ver qualificação acima); testes existem mas não foram executados.
- Contagens de linhas medidas no checkout (`Sidebar.tsx` 4931, `LegacySidebar.tsx` 3822, `Sidebar.logic.ts` 1237); números de linha citados podem variar com o editor.
