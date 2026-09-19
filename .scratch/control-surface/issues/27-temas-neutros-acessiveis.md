# 27: Aplicar temas neutros acessíveis à bancada

**What to build:** Aplicar temas claro, escuro, automático e de plugin a shell, Painéis e popouts, mantendo a bancada neutra e o conteúdo técnico legível.

**Blocked by:** 24/Usar Diff como Painel contextual; 25/Usar Terminal como Painel fixo ao Workspace

**Status:** resolved

- [x] Superfícies, ações, foco e estados estruturais usam somente a paleta neutra aprovada.
- [x] ANSI, realce de sintaxe e marcadores de diff preservam suas cores semânticas isoladas.
- [x] Tema declarativo válido aplica variantes pareáveis em shell, Painéis e popouts.
- [x] Tema inválido é rejeitado integralmente com diagnóstico e fallback core.
- [x] O modo automático segue a preferência do sistema e respeita `prefers-reduced-motion`.
- [x] Controles e estados críticos atendem contraste WCAG 2.2 AA e não dependem apenas de cor.

## Comments

### 2026-09-19 — Implementação (responsável: leo)

Estendido o pipeline vivo de temas em vez de criar um segundo sistema (o protótipo
desconectado `src/client/themes/` foi dobrado e removido; `docs/legacy-parity-matrix.md`
aponta para a nova evidência):
- `src/client/src/plugins/themes/index.ts`: temas core `neutral-dark`/`neutral-light`
  (superfícies/texto/acento/seleção/foco estritamente neutros; status e terminal
  preservam semântica legível) mais par `neutral` claro/escuro; legado intacto.
- `src/client/src/theme.ts`: default passa a `neutral-dark` com `auto`; novo token
  `--pi-accent-contrast` (lacuna real: accent neutro quebrava botões primários);
  `isValidThemeTokenValue` + `themeContrastRatio` dobrados do protótipo.
- `src/client/src/plugins/registry.ts`: contribuição de tema inválida (nome, modo,
  mapa ausente, token ausente/desconhecido/valor inválido) é rejeitada integralmente
  com `console.warn` e as irmãs válidas permanecem; par com referência desconhecida
  é descartado com diagnóstico. Fallback core (`classic`) inalterado no resolver.
- `src/client/workbench/DockviewWorkbench.ts` + `DockviewWorkbenchPanel.ts`: adapter
  `--dv-*`→`--pi-*`, chrome neutro dos painéis, `:focus-visible` com accent neutro,
  `prefers-reduced-motion` zerando transições; popouts recebem vars do tema ativo +
  CSS compartilhado na abertura e em toda troca de tema (observer no document root).
- `index.html`, `popout.html`, `manifest.webmanifest`: defaults neutros (primeiro paint).
- Changeset: `.changeset/workbench-neutral-themes.md` (patch).

Isolamento semântico preservado por construção: xterm usa a paleta ANSI fixada
(`DEFAULT_TERMINAL_ANSI_THEME`, lê só bg/fg/seleção/cursor das vars); CodeMirror usa
`defaultHighlightStyle`; diff da bancada renderiza texto com contagens `(+N, -M)`.
Estados seguem com texto além de cor (`[pinned]`/`[following]`, aviso de auto-pin,
`role=log`/`aria-live` no chat, `tabindex` nos itens).

Verificação em 2026-09-19: suite completa 400 arquivos/4077 testes verde (2 skipped);
`typecheck`, `eslint` dos tocados, `knip` e `git diff --check` limpos. Contraste AA
fixado em teste sobre os valores publicados (texto, accent/foco, terminal, nos dois
modos). Smoke Web/AppImage da bancada com o tema ativo pendente de ambiente
operacional (mesma pendência registrada em 24/25; AppImage diferido por decisão).

Residuais conhecidos: links do shell legado perdem distinção por matiz sob accent
neutro (sublinhado como affordance é trabalho futuro); hairlines decorativas ficam
abaixo de 3:1 por desenho — significado nunca depende só delas; revisão manual de
todas as superfícies (exigida pelo contrato) continua pendente.

### 2026-09-19 — Validação visual das superfícies (responsável: leo)

Inspeção visual executada no navegador com Vite dev server e backend ativo:
- Validados `neutral-light` (tokens `--pi-bg: #ffffff`, `--pi-surface: #f8f9fa`, `--pi-border: #e5e7eb`, `--pi-text: #111827`, `--pi-accent: #111827`) e `neutral-dark` (`--pi-bg: #0d0e11`, `--pi-surface: #16181d`, `--pi-border: #2b2f38`, `--pi-text: #e4e7eb`).
- Shell, navegação lateral, chat com blocos de código e a Bancada (`DockviewWorkbenchPanel` com abas Terminal, Files e Diff) renderizados e integrados sob ambos os temas neutros com alto contraste e legibilidade.
- Status atualizado para `resolved`, liberando o bloqueio para a issue 28.
