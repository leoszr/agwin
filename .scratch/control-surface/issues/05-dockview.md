# Quais limites do Dockview precisam ser validados com Lit?

Type: research
Labels: wayfinder:research
Mode: AFK
Status: resolved
Assignee: leo
Parent: ../map.md
Blocked by:
Research branch: research/dockview
Research asset: [Evidências — Quais limites do Dockview precisam ser validados com Lit?](../research/dockview.md)

## Question

Investigar documentação e código oficiais do Dockview como primeira opção, confrontando as integrações necessárias com o frontend real do PI WEB. Informar Etapa D e questão aberta 4; a validação interativa fica em ticket de protótipo próprio.

Cobrir integração sem React e com Lit/Web Components, montagem/desmontagem/reparenting, preservação de estado e subscriptions, drag-and-drop, splits, tabs/groups, resize, hide/show, serialization/restauração, floating, popouts e responsividade. Examinar suporte a tema/tokens e acessibilidade/teclado. Distinguir o que a biblioteca fornece do que cabe à aplicação.

## Comments

- 2026-09-11 (leo): pesquisa concluída contra código e docs oficiais (Dockview `3043111`, pi-web `46579c0`). Sem impedimento concreto para Dockview gratuito (MIT); um bug real de reconexão no `PromptEditor` e os limites de popout viraram critérios do protótipo. Detalhes no relatório.

## Answer

Dockview (`dockview-core@8.3.1`, MIT, via pacote `dockview`) integra-se ao Lit sem React pelo contrato `IContentRenderer` + fábrica `createComponent`; reparenting move o mesmo elemento (dispara `disconnectedCallback`→`connectedCallback`), o que quebra concretamente o `PromptEditor` atual (destrói o CodeMirror no disconnect e só recria em `firstUpdated`, que roda uma vez) — fix pequeno e localizado. `ChatView`/`SessionList` são reconexão-seguros; `PiWebApp` raiz nunca vai para dentro de painel. Tudo da Etapa D (splits, tabs/groups, DnD, resize, floating, popouts, serialização, temas `--dv-*`, a11y baseline) está no pacote gratuito; enterprise (comercial) só adiciona teclado espacial/docking, abas fixadas/multi-row, auto-hide, compass, smart guides e histórico. Popouts exigem rota same-origin `/popout.html`, têm overlays por janela e proíbem presumir `window`/`document` global — comportamento cross-document de custom elements é a principal incerteza e ancora o roteiro de experimento. Responsividade, stores e hide/show programático cabem à aplicação. Roteiro mínimo de 5 critérios observáveis entregue para o protótipo. Evidência completa em [research/dockview.md](../research/dockview.md).

Identificar versão, licença, APIs concretas e limitações de contexto/documento/eventos em popouts. Entregar roteiro mínimo de experimento e critérios observáveis para o protótipo. Só investigar outra biblioteca ou layout próprio se houver impedimento concreto; não rejeitar ou aprovar Dockview com base apenas em lista de features.
