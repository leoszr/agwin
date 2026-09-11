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

Identificar versão, licença, APIs concretas e limitações de contexto/documento/eventos em popouts. Entregar roteiro mínimo de experimento e critérios observáveis para o protótipo. Só investigar outra biblioteca ou layout próprio se houver impedimento concreto; não rejeitar ou aprovar Dockview com base apenas em lista de features.

## Comments

- 2026-09-11 (Wayfinder, AFK; responsável: leo): pesquisa concluída contra código e docs oficiais (Dockview `3043111`, pi-web `46579c0`). Sem impedimento concreto para Dockview gratuito (MIT); risco de reconexão no `PromptEditor` [INFERENCE, a reproduzir] e limites de popout viraram critérios do protótipo. Refinado pós-revisão: permalinks com SHA, realm cross-document corrigido, condição Desktop (T3 scheme × `window.open`). Detalhes no relatório.

## Answer

Dockview (`dockview-core@8.3.1`, MIT, via pacote `dockview`) integra-se ao Lit sem React pelo contrato `IContentRenderer` + fábrica `createComponent`; reparenting move o mesmo elemento (dispara `disconnectedCallback`→`connectedCallback`). Risco [INFERENCE de lifecycle, a reproduzir no protótipo]: o `PromptEditor` atual destrói o CodeMirror no disconnect e só o cria em `firstUpdated` (uma vez por elemento) — `renderer:'always'` atenua, não corrige; recriar perde seleção/undo. `ChatView`/`SessionList` têm ciclo simétrico (leitura); `PiWebApp` raiz nunca vai para dentro de painel. Tudo da Etapa D está no pacote gratuito; enterprise (comercial) só adiciona teclado espacial/docking, abas fixadas/multi-row, auto-hide, compass, smart guides e histórico. Popouts exigem rota same-origin `/popout.html`; nó adotado conserva realm da principal (usar `ownerDocument`/`getWindow()`); cross-document de custom elements é a principal incerteza. Condição Desktop explícita: conflito `window.open` × custom scheme do T3 virou aceite do protótipo Desktop, sem adotar esquema. Hipótese condicionada (não decisão): adotar Dockview se o protótipo validar os 5 critérios + condição Desktop. Evidência completa em [research/dockview.md](../research/dockview.md).


