# Evidências — Quais limites do Dockview precisam ser validados com Lit?

Ticket: `issues/05-dockview.md` · informa Etapa D e questão aberta 4 do brief.
Validação interativa: fora de escopo aqui; fica no ticket de protótipo próprio (`09-dockview-prototype.md`).

## Fontes primárias (revisões consultadas)

- Dockview monorepo, `https://github.com/mathuo/dockview`, HEAD `3043111` (2026-09-11, merge PR #1641).
  Pacote relevante: `dockview-core@8.3.1`; entrada recomendada: pacote `dockview@8.3.1` (re-export puro do core).
- PI WEB, `https://github.com/jmfederico/pi-web`, HEAD `46579c0` (`@jmfederico/pi-web@1.202609.0`).
- Docs first-party em `packages/docs/docs` do próprio repo Dockview (citadas por caminho abaixo).
- URLs permanentes: `https://github.com/mathuo/dockview/blob/<SHA>/<caminho>` e `https://dockview.dev`.

## Resumo executivo

1. **Dockview não exige React.** O contrato de integração é `IContentRenderer` (`{ element, init, update?, layout?, onShow?, onHide?, toJSON?, focus?, dispose? }`) fornecido por uma fábrica `createComponent` passada a `createDockview(el, opts)`. Um wrapper fino que instancia o custom element Lit e o anexa cobre a integração mecânica. Nenhum impedimento arquitetural aqui.
2. **O limite real está no reparenting de DOM, não no Lit em si.** Ao trocar de aba (modo padrão) ou mover um painel, o Dockview remove e reinsere o *mesmo* elemento (`remove()` + `appendChild`), sem destruir a instância do painel. Para custom elements isso dispara `disconnectedCallback` → `connectedCallback` a cada troca.
3. **Há uma incompatibilidade concreta no PI WEB atual:** `PromptEditor` destrói o `EditorView` do CodeMirror em `disconnectedCallback`, mas só o (re)cria em `firstUpdated` — que o Lit executa **uma única vez** por elemento. Sob o renderer padrão, mover/ocultar o painel do prompt quebra o input até reload. `ChatView` e `SessionList` foram auditados e são reconexão-seguros (idempotentes). Correção é pequena e localizada (recriar no `connectedCallback` ou usar `renderer: 'always'` nesses painéis).
4. **Tudo que a Etapa D lista existe no pacote gratuito MIT:** splits, tabs/groups, DnD (mouse, toque, externo), resize com constraints, floating, popouts, serialização, render modes, temas por CSS variables, a11y baseline. Pagos (enterprise, licença comercial) são apenas: navegação espacial por teclado, keyboard docking, abas fixadas, multi-row tabs, overflow avançado, auto-hide/auto-edge groups, DnD compass, smart guides e histórico de layout (undo/redo).
5. **Popouts são o segundo limite a validar.** Exigem rota same-origin (`/popout.html` por padrão), janela real via `window.open` (sujeita a bloqueador), CSS copiado automaticamente mas estilos injetados fora do pipeline precisam de cuidado, overlays rendem no documento da popout, e código de painel não pode presumir `document`/`window` globais (os componentes pi-web atuais capturam `window` em closures). Comportamento de custom elements através de dois `document`s é o item de maior incerteza e deve ser o centro do protótipo.
6. **Responsividade, estado de domínio e hide/show programático cabem à aplicação** — o Dockview fornece resize observer + `api.layout()`, eventos e `params`/`toJSON` por painel, mas não breakpoints, não stores e não recria subscriptions.

**Não foi encontrado impedimento concreto que justifique outra biblioteca ou layout próprio.** Recomendação técnica: adotar Dockview (pacote gratuito) condicionado ao protótipo validar os 3 itens do roteiro abaixo. A decisão final é humana (ver seção final).

## Versão, pacotes e licença

- `packages/dockview-core/package.json`: `name: dockview-core`, `version: 8.3.1`, descrição "Zero dependency layout manager … for vanilla TypeScript".
- `packages/dockview/src/index.ts`: "`dockview` is the recommended free entry point: a thin re-export of `dockview-core` … This module has no side effects (it's a pure re-export)".
- `LICENCE.md` (raiz): `dockview-core`, `dockview`, `dockview-react`, `dockview-vue`, `dockview-angular` são **MIT**; só `dockview-enterprise` é **proprietário/comercial** (`packages/dockview-enterprise/LICENCE.md`). O gate de licença (`licenseService.ts`) existe apenas no pacote enterprise e só destrava módulos enterprise.
- Tabela oficial core-vs-enterprise: `packages/docs/docs/overview/licence.mdx`. Tudo da Etapa D está marcado ✓ na coluna gratuita, exceto os itens listados no resumo (4).
- Divisão de módulos em código: `packages/dockview-core/src/dockview/allModules.ts` (`AllModules`: Floating, Popout, Watermark, Edge, RootDropTarget, HeaderActions, LiveRegion, AdvancedDnD, TabGroupChips, ContextMenu) vs `packages/dockview-enterprise/src/index.ts` (KeyboardNavigation, KeyboardDocking, LayoutHistory, DndCompass, SmartGuides, AutoHide/AutoEdge, MultiRowTabs, PinnedTabs, AdvancedOverflow, License).

## Integração sem React, com Lit/Web Components

- Uso vanilla documentado em `packages/docs/docs/overview/quickstart.mdx` (aba JavaScript): `createDockview(el, { theme, createComponent: (options) => new MyPanel() })` + `api.addPanel({ id, component, title, position })`. O `dockview` (JS) é a entrada para quem não usa React/Vue/Angular.
- Contrato em `packages/dockview-core/src/dockview/types.ts` (`IContentRenderer`, ~linhas 47–55) e `src/panel/types.ts` (`IPanel`: `init` uma vez; `layout(w,h)`; `update`; `toJSON`; `focus`; `dispose` só ao remover). A fábrica `createComponent` é obrigatória (`src/dockview/options.ts:850`) e é o **mesmo caminho** usado na restauração (`src/dockview/dockviewPanelModel.ts:45,93-99` — o modelo cria o conteúdo via `accessor.options.createComponent({ id, name })` tanto no novo quanto no desserializado).
- Wrapper Lit mínimo (padrão, não código copiado): a fábrica instancia o elemento (`document.createElement('chat-panel')`), atribui propriedades/params, retorna `{ element, init, layout, onShow, onHide, dispose }`. `init(params)` recebe `api: DockviewPanelApi` + `containerApi: DockviewApi` (`GroupPanelPartInitParameters`, `types.ts`), ou seja, o painel Lit ganha acesso total à API sem prop-drilling pelo shell.
- Todos os componentes pi-web usam shadow DOM padrão (nenhum `createRenderRoot` sobrescrito em `src/client/src/components/*.ts`; elementos registrados via `@customElement("pi-web-app")`, `@customElement("chat-view")`, etc.). O core do Dockview atravessa shadow DOM nas checagens de presença em DOM (`src/dom.ts:286-297`, `isInDOM` com `parentNode.host`). Hospedar um custom element com shadow root como `element` do renderer é suportado; o shadow root é interno ao elemento e não é tocado pelo reparenting.
- `layout(width, height)` do renderer é o ponto de encaminhamento para redimensionar conteúdos canvas (xterm via `@xterm/addon-fit ^0.11.0`, dependência presente em `package.json:93-94` do pi-web). **Cabe à aplicação** repassar; o Dockview só notifica.

## Montagem / desmontagem / reparenting e preservação de estado

- Troca de aba = `remove()` + `appendChild()` do mesmo elemento (`src/dockview/components/panel/content.ts:153-154,168-179`, método `renderPanel`). A instância do painel **não** é destruída; só o DOM é movido. `dispose()` do conteúdo só roda em `DockviewPanelModel.dispose` (remoção do layout).
- Dois modos de render (`packages/docs/docs/core/panels/rendering.mdx`):
  - `onlyWhenVisible` (padrão, mais econômico): elemento sai do DOM quando oculto. Perde-se estado puramente DOM (scroll nativo, medidas 0×0, ResizeObservers disparam). Para custom elements: `disconnectedCallback`/`connectedCallback` a cada troca.
  - `always`: elemento mantido vivo (oculto via `visibility: hidden` num container de overlay, `content.ts:181-183` + `src/overlay/overlayRenderContainer.ts:215+`), preserva scroll/state DOM. Custo: animações, `requestAnimationFrame`, `<video>` e iframes continuam rodando ocultos — pausar é app-side via `onDidVisibilityChange`/`isVisible`.
- Ganchos de visibilidade (ambos os modos): `onShow()`/`onHide()` opcionais no `IContentRenderer` (`types.ts:52-53`) + `api.onDidVisibilityChange` / `api.isVisible` (documentados na mesma página, com exemplo JS). É o ponto correto para pausar/retomar trabalho caro em vez de destruir em `disconnectedCallback`.
- Caso especial documentado: **iframes recarregam ao serem reparentados** (comportamento do browser, links para Bugzilla/WHATWG na doc). Solução oficial: `renderer: 'always'`. Relevante como classe de problema; o terminal pi-web é xterm/canvas (sobrevive ao reparent, só precisa de `fit()` via `layout`), não iframe — mas qualquer painel futuro com iframe herda a regra.
- Auditoria dos componentes pi-web atuais (o que quebra / o que é seguro sob reparenting):
  - **Quebra — `PromptEditor.ts:109-113`:** `disconnectedCallback` faz `this.editor?.destroy(); this.editor = undefined`. A (re)criação ocorre só em `firstUpdated()` (`:99-101` → `createEditor()` em `:278`), e `firstUpdated` do Lit roda **uma vez** no ciclo de vida. Mover ou ocultar esse painel sob `onlyWhenVisible` destrói o CodeMirror sem recriá-lo. (O texto do rascunho vive em `this.draft`, então o conteúdo provavelmente sobrevive; foco, seleção e histórico de undo do editor, não.) Correções possíveis, ambas pequenas: recriar em `connectedCallback` quando `editor === undefined`, ou declarar o painel com `renderer: 'always'`.
  - **Seguro — `ChatView.ts:275-307`:** `connectedCallback` adiciona listeners de `window`/`visualViewport`; `disconnectedCallback` salva scroll, dá `dispose()` no `ChatScrollController` (que só limpa um timer pendente — `chatScrollPosition.ts:78-84`), cancela RAFs e remove listeners. Tudo idempotente e reconstruído na reconexão.
  - **Seguro — `SessionList.ts:84-87`:** só remove um listener de `click` em `document` (re-adicionado na conexão, por simetria do ciclo Lit).
  - **Não entra em painel — `PiWebApp.ts:422-465`:** o `disconnectedCallback` da raiz derruba tudo (`realtime.close()`, `sessions.dispose()`, `auth/notifications.dispose()`, timers, listeners globais). Conclusão arquitetural: o Dockview vive **dentro** do shell sucessor (substituindo o esqueleto fixo `aside#navigation-panel | main | workspace-panel` de `PiWebApp.render()`, `:3193+`, hoje dirigido por `PanelCollapseController`/`PanelResizeController` em `src/client/src/appShell/`), nunca o `pi-web-app` dentro de um painel. Os stores/conexões devem subir para uma camada fora dos painéis (tema do ticket de client/server, não deste).
 - Caso especial documentado: **iframes recarregam ao serem reparentados** (comportamento do browser, links para Bugzilla/WHATWG na doc). Solução oficial: `renderer: 'always'`. Relevante como classe de problema; o terminal pi-web é xterm/canvas (`@xterm/addon-fit ^0.11.0` em `package.json:93-94` do pi-web) — sobrevive ao reparent, precisando apenas de `fit()` via `layout` — mas qualquer painel futuro com iframe herda a regra.

## Drag-and-drop, splits, tabs/groups, resize, hide/show

- DnD gratuito e completo (tabela licence.mdx + `docs/core/dnd/*`): arrasto de tabs e de grupos, DnD externo (arquivos do SO para dentro), touch/pen, edge drop zones, overlay customizável, opt-out por feature. iDnD compass e smart guides são enterprise.
- Splits direcionais: `Direction = 'left' | 'right' | 'above' | 'below' | 'within'` (`src/gridview/baseComponentGridview.ts:17`); `api.addPanel({ position: { referencePanel, direction } })` (quickstart) e `panel.api.moveTo(...)` / `group.api.moveTo(...)` para rearranjo programático.
- Resize: splitters arrastáveis, constraints por painel/grupo (`minimumWidth/Height`, `maximumWidth/Height` em `GroupviewPanelState`, `types.ts:56+`; tabela "Sizing" toda ✓ core), auto-resize por `ResizeObserver` por padrão com opt-out `disableAutoResizing` + `api.layout(w, h)` manual (`src/dockview/options.ts:352-355`; `docs/core/sizing.mdx`).
- Grupos: maximizar/restaurar, grupos travados (locked), edge groups e headerless/header positions — core. Auto-hide edge groups e dock-to-edge — enterprise.
- **Hide/show programático não tem `setVisible` no painel** (`DockviewPanelApi` estende `GridviewPanelApi` omitindo `setVisible` — `src/api/dockviewPanelApi.ts:35-41`). Padrões suportados: `panel.close()` + re-`addPanel` (instância nova via fábrica; estado restaurado via `params`/`toJSON` — ver serialização), alternância de renderer, ou colapso em grupo (`group.api.collapse()/expand()` existem em `dockviewGroupPanelApi.ts:106-117`). "Reabrir painel fechado" da UX desejada = re-add pelo registro de painéis da aplicação; o Dockview não mantém galeria de painéis fechados — **cabe à aplicação** (Panel Registry do UI Model).

## Serialização / restauração

- `api.toJSON(): SerializedDockview` + `api.fromJSON(data)`; `api.onDidLayoutChange` (persistir, ex. localStorage) e `api.onDidLayoutFromJSON` (`docs/core/state/save.mdx`, `load.mdx`). Layout inválido/corrompido: erro + reset gracioso, pronto para nova tentativa (load.mdx).
- O JSON carrega estrutura + `params` + `renderer` + constraints + título por painel (`DockviewPanel.toJSON`, `dockviewPanel.ts:159-171`); **instâncias são sempre recriadas pela fábrica** — estado de componente (rascunho, scroll, seleção) só sobrevive se a aplicação o puser em `params` (via `panel.update()`) ou o recuperar via `IPanel.toJSON()` ("Custom panel state" ✓ core na tabela). Sessões/conexões nunca devem morar no layout — pertencem ao client-runtime/servidor.
- Transações de mutação: `onWillMutateLayout`/`onDidMutateLayout` enquadram operações compostas (documentado na página de popouts para `kind: 'popout'`; útil para debounce de persistência).

## Floating e popouts

- Floating groups: core (`FloatingGroupModule` em `allModules.ts`; `dockviewFloatingGroupPanel.ts`; linhas 77–79 da licence). Arrastar para fora da grade cria overlay flutuante com bounds e drag handle próprios.
- Popouts: core (`PopoutWindowModule`; `docs/core/groups/popoutGroups.mdx`; `licence.mdx:80-81`). Fatos:
  - `api.addPopoutGroup(group, { popoutUrl, box })` — **assíncrono**; resolve `false` (sem throw) se o popup foi bloqueado, a janela fechou antes do `load`, ou o item não pode sair (edge group). `onDidOpenPopoutWindowFail` para avisar o usuário; transação de layout mantida aberta até assentar.
  - **Exige rota same-origin `http(s)` servindo um HTML em branco** (padrão `/popout.html`, configurável). Implementação abre `window.open(url)` (`src/popoutWindow.ts`), injeta container, copia as folhas de estilo do documento principal (`addStyles(externalDocument, document.styleSheets)`) e move o grupo para o documento novo. Guarda anti-`javascript:/data:/blob:`/cross-origin roda também no `fromJSON` (`assertSameOriginPopoutUrl`).
  - O grupo continua parte do mesmo layout: `onDidAddPopoutGroup`/`onDidRemovePopoutGroup`, `api.getPopouts()`, `onDidPopoutGroupSizeChange/PositionChange`. Voltar: `moveTo({ position })` ou fechar a janela (o Dockview tenta o local original, senão escolhe outro).
  - **Maximizar é no-op em popout** (doc, caixa `info`).
  - Overlays (indicadores de drop, context menus, chip popovers) rendem **no documento da janela que hospeda o grupo**; componentes customizados de chip/menu são montados no DOM da popout; handlers não podem presumir o `document` principal — usar `element.ownerDocument`. `panel.api.getWindow()` existe para código que precisa da `Window` hospedeira (`dockviewPanelApi.ts`).
- Limites de contexto/documento/eventos em popouts (o que é fato vs. o que o protótipo deve medir):
  - Fato: listeners capturando o `window` global (padrão atual do pi-web: `ChatView` escuta `window.resize`, `visualViewport`; `SessionList` escuta `document.click`) continuam apontando para a janela **principal** depois do move — precisam de re-subscrição via `onShow`/`getWindow()` ou delegação por `ownerDocument`.
  - Fato: `localStorage`/sessão persistem (mesma origem), mas estado em memória por módulo/closure não é compartilhado — cada documento tem seus próprios globals.
  - **A validar no protótipo (incerteza real, não fato):** comportamento de custom elements Lit através de dois documentos (registro por janela, adopted stylesheets por shadow root, `document.adoptedStyleSheets` de tokens globais não acompanha o nó — mitigado porque o Dockview copia as folhas principais, mas estilos injetados preguiçosamente precisam de verificação), foco/teclado entre janelas, e arrasto tab popout→grade. Nenhum achado aqui reprova o Dockview hoje; reprovaria se o protótipo mostrar corrupção de estado.

## Responsividade

- O Dockview **não tem breakpoints responsivos próprios** (nenhuma ocorrência de `responsive/breakpoint/media query` nas docs de core/groups). Responsivo = redimensionamento fluido (ResizeObserver) + aplicação dirigindo a API.
- Precedente no pi-web: `AppShellController` (`src/client/src/appShell/appShellController.ts`) usa `matchMedia("(max-width: 760px)")` → `isMobileNavigationLayout`, e o `render()` troca o esqueleto. O equivalente com Dockview: observar a mesma media query e dirigir `api` (colapsar/fechar grupos, trocar layout via `fromJSON` alternativo). **Cabe à aplicação**; critério de aceite do protótipo deve incluir um teste de estreitamento de viewport.

## Tema / tokens

- Tema Dockview = objeto TS (`DockviewTheme`: `name`, `className`, `gap`, `dndOverlay*`, etc. — `src/dockview/theme.ts:93+`) + classe CSS que define variáveis `--dv-*` (ex.: `--dv-active-sash-color`, `--dv-*-tab-background-color`, dezenas listadas nos `.scss` do core) + `import 'dockview/dist/styles/dockview.css'`.
- PI WEB tem sistema centralizado de tokens: `THEME_TOKENS` (`--pi-bg`, `--pi-surface`, `--pi-accent`, `--pi-terminal-*`, ~35 tokens em `src/client/src/theme.ts:23-58`), temas como contribuições de plugin (`themePackPlugin`, `corePlugin` em `PiWebApp.ts`, preferência em localStorage `pi-web-app-theme`, par claro/escuro + `auto`).
- Mapeamento é mecanicamente simples: uma classe de tema Dockview cujas `--dv-*` apontam para `var(--pi-*)`, + um `DockviewTheme` por tema pi-web (claro/escuro/auto), trocado junto com `pickTheme`. **Cabe à aplicação**; nenhum fork da lib. Atenção em popouts: estilos lazy/injetados fora do pipeline padrão precisam estar disponíveis na popout (doc avisa).

## Acessibilidade / teclado

- Baseline **core**, sem configuração (`docs/advanced/accessibility.mdx`): tabs como widget WAI-ARIA Tabs (`tablist/tab/tabpanel`, `aria-selected/controls/labelledby` reativos a `setTitle`), grupos como `region`, floating como `dialog` não-modal, nomes acessíveis nos botões de fechar, roving tabindex na tab strip (setas/Home/End/Enter/Space), live regions educada + assertiva **por janela** (principal + cada popout; anúncio roteado para a janela com foco), foco `:focus-visible` tematizável.
- Teclado amplo é **enterprise**: navegação espacial (`Ctrl+Shift+setas`, ciclo `F6`, salto para tab strip) e keyboard docking (`licence.mdx:143-144`; `keyboardNavigationService`/`keyboardDockingService` no enterprise). Com o core, shortcuts de app (paleta, alternar painéis) continuam **app-side** — o pi-web já tem `keyboardShortcuts.ts` + `PiWebApp` ouvindo `keydown` global, padrão que sobrevive.
- Gap honesto: DnD por mouse não tem equivalente core por teclado; se foi prometida paridade total de teclado para rearranjo, ou compra-se enterprise ou implementa-se comando app-side via `moveTo`/`addPanel` (viável, pois a API programática é completa no core).

## O que a biblioteca fornece vs. o que cabe à aplicação

| Biblioteca (Dockview core) | Aplicação (nosso shell) |
|---|---|
| grid/splits, tabs, grupos, drag-and-drop, resize, floating, popouts, maximize, lock | registro de painéis (tipos, fábricas, painéis fechados/reabertura), layout default e por contexto |
| `toJSON/fromJSON`, eventos de ciclo de vida e mutação | persistência (onde/quando salvar, versionamento do schema do layout), migração de layouts antigos |
| `IContentRenderer` + `layout(w,h)` + `onShow/onHide` + `isVisible` | wrappers Lit por painel, repasse de resize (xterm `fit()`), pausa de trabalho oculto |
| temas via `--dv-*` + objetos `DockviewTheme`; cópia de CSS p/ popout | mapeamento `--pi-*`→`--dv-*`, troca claro/escuro, estilos lazy na popout |
| a11y baseline (ARIA, live regions, roving tabindex) | shortcuts de app, comandos de rearranjo por teclado, foco inicial por painel |
| `window.open` + guarda same-origin + re-dock | rota `/popout.html`, CSP/nonce (`PopoutWindowOptions.nonce`), UX de fallback a popup bloqueado |
| — | stores, subscriptions, realtime, identidade de thread/sessão (fora dos painéis) |

## Roteiro mínimo de experimento (entrada para o protótipo, Etapa D)

Experimento descartável: página Vite + `dockview` + 3 painéis Lit (`<chat-stub>`, `<editor-stub>` com CodeMirror real, `<term-stub>` com xterm real), sem backend (mocks de texto).

1. **Reparenting Lit (questão crítica):** mover aba entre grupos por DnD e por `moveTo`; alternar abas 20×. Critérios: `connectedCallback`/`disconnectedCallback` disparam sem erro; editor recriado com rascunho intacto (após o fix); scroll do chat preservado com `renderer:'always'` e restaurado via `saveScrollPosition` com `onlyWhenVisible`; nenhum listener duplicado (contar `window.resize` handlers / checar vazamento via segundo ciclo).
2. **Serialização:** `toJSON` → reload → `fromJSON` com a mesma fábrica. Critérios: estrutura idêntica (grupos, splits, tabs ativas); `params` por painel restaurados; layout corrompido cai no reset gracioso sem travar.
3. **Popout:** `addPopoutGroup` com `/popout.html` servido; fechar a janela re-docka. Critérios: conteúdo Lit renderiza e interage na popout; CSS aplicado (sem FOUC além do 1º frame); bloquear popup resolve `false` com grupo intacto na grade + evento de falha observado; `ownerDocument`-aware passa (nenhum handler preso ao `document` principal).
4. **Responsivo + teclado:** estreitar viewport < 760px dirigindo `api` via `matchMedia`. Critérios: layout alternativo aplicado sem exceção; tab strip navegável por setas/Home/End com leitor de tela (smoke manual); `:focus-visible` visível.
5. **Tema:** classe mapeando 5–10 `--dv-*` para `var(--pi-*)`. Critério: trocar tema pi-web re-tema a grade sem reload.

Tempo estimado: horas, não dias. Se (1) ou (3) falharem de forma estrutural (corrupção de estado, não workaround), reabre-se a alternativa "outra lib/layout próprio" — caso contrário, Dockview está validado.

## Limitações deste estudo

- Sem execução visual: nenhuma UI foi rodada; conclusões vêm de código-fonte e docs oficiais, não de observação de comportamento. Comportamento real (DnD, popouts, leitores de tela) só o protótipo confirma.
- Sem build/instalação de dependências:factual sobre API/licença/estrutura; nada sobre tamanho de bundle, performance de render ou custo de integração medido — nenhum número é afirmado neste relatório por esse motivo.
- Auditoria Lit cobriu `PiWebApp`, `ChatView`, `PromptEditor`, `SessionList` (+ `theme.ts`, `appShell/`). Demais componentes (terminal, files, diff, dialogs) não foram auditados para reconexão-segurança; o protótipo + migração devem varrê-los com o mesmo checklist (o padrão problemático é: teardown em `disconnectedCallback` sem reconstrução em `connectedCallback`).
- `firstUpdated`-uma-vez é semântica pública do Lit (ciclo de vida documentado), aplicada ao código lido; a confirmação empírica cabe ao protótipo.
- Afirmações sobre `window.open` em Electron (processo de popout no desktop) são inferência de plataforma, não fato verificado — entraram como critério de validação, não como conclusão.

## Cobertura da pergunta do ticket

- Integração sem React com Lit/Web Components: coberta (contrato, fábrica, shadow DOM, wrapper).
- Montagem/desmontagem/reparenting, estado e subscriptions: cobertos (modos de render, ganchos, auditoria de 4 componentes + raiz).
- DnD, splits, tabs/groups, resize, hide/show: cobertos (APIs concretas + padrão app-side p/ hide/show).
- Serialização/restauração: coberta (formato, fábrica, estado custom, layout inválido).
- Floating, popouts, responsividade: cobertos (APIs + limites + app-side).
- Tema/tokens e a11y/teclado: cobertos (mapeamento + baseline core vs enterprise).
- Versão, licença, APIs concretas, limitações de contexto/documento/eventos em popouts: cobertos.
- Roteiro de experimento + critérios observáveis: entregue acima.
- Outra biblioteca/layout próprio: **não investigados além do necessário** — conforme o ticket, só se houvesse impedimento concreto; não houve.

## Recomendações (técnicas, não decisões)

1. Adotar `dockview` (pacote gratuito, MIT) como layout manager, sem enterprise nesta entrega.
2. Fix pequeno e localizado antes/depois do protótipo: `PromptEditor` recriar o editor em `connectedCallback` (ou `renderer: 'always'` nos painéis com view cara: prompt, terminal, chat).
3. Regra de construção para painéis: nunca destruir em `disconnectedCallback` o que não se reconstrói em `connectedCallback`; usar `onShow/onHide` para pausar/retomar.
4. Servir `/popout.html` desde o início; componentes novos proibidos de capturar `window`/`document` global em closure — usar `ownerDocument`/`getWindow()`.
5. Protótipo cobre os 5 critérios acima antes de qualquer migração de painel real.

## Decisões humanas pendentes (não decidir pelo leo)

- **D1:** Adotar ou não o Dockview (recomendação 1 acima aguarda aceite + protótipo).
- **D2:** Comprar ou não Dockview Enterprise no futuro (só se paridade de teclado/DnD compass/auto-hide virarem requisito).
- **D3:** Ordem da migração dos painéis reais e escopo do fix de reconexão nos demais componentes.
- **D4:** Estratégia de layouts salvos (default, por usuário, versionamento) — insumo para Migration Strategy.
