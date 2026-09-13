# 27: Aplicar temas neutros acessíveis à bancada

**What to build:** Aplicar temas claro, escuro, automático e de plugin a shell, Painéis e popouts, mantendo a bancada neutra e o conteúdo técnico legível.

**Blocked by:** 24/Usar Diff como Painel contextual; 25/Usar Terminal como Painel fixo ao Workspace

**Status:** ready-for-agent

- [ ] Superfícies, ações, foco e estados estruturais usam somente a paleta neutra aprovada.
- [ ] ANSI, realce de sintaxe e marcadores de diff preservam suas cores semânticas isoladas.
- [ ] Tema declarativo válido aplica variantes pareáveis em shell, Painéis e popouts.
- [ ] Tema inválido é rejeitado integralmente com diagnóstico e fallback core.
- [ ] O modo automático segue a preferência do sistema e respeita `prefers-reduced-motion`.
- [ ] Controles e estados críticos atendem contraste WCAG 2.2 AA e não dependem apenas de cor.
