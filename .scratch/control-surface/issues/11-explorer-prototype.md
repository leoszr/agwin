# Qual navegação apresenta Projects e Threads sem esconder contexto necessário?

Type: prototype
Labels: wayfinder:prototype
Mode: HITL
Status: resolved
Assignee: leo
Parent: ../map.md
Blocked by: 03, 08

## Question

Criar um protótipo descartável de navegação para reação de leo, orientado pelo domínio resolvido. Comparar apresentações de Project/Thread e contexto de ambiente/workspace sem impor quatro níveis permanentes.

A pesquisa [O que torna Projects e Threads do T3 Code simples de navegar?](03-t3-explorer.md) distinguiu a árvore do modo legado e a lista por ciclo de vida da sidebar padrão atual. Usar a árvore solicitada no brief como referência inicial e discutir o que aproveitar da outra variante, sem substituir o modelo de produto automaticamente.

Incluir threads locais/remotas na mesma janela, múltiplos projetos, ordering/grouping, ícones, estados ativos/concluídos, collapse/expand, criação rápida, menus e seleção. Mostrar onde ambiente e workspace ficam claros, incluindo situações de nomes iguais e conexão indisponível. Usar a evidência do T3 Code, não copiar sua implementação.

Resolver com feedback humano as questões abertas 6, 7 e 8 no plano de UX; produzir asset do UI Model e registrar as escolhas no ticket, sem implementar o Explorer final.

## Comments

### 2026-09-12 — Resolução com leo

Leo comparou as três variantes do protótipo e escolheu a árvore compacta. Na rodada seguinte, definiu buckets de estado dentro de cada Project e Workspace sempre visível em cada Thread. O protótipo descartável está preservado na branch `prototype/explorer-navigation`, commit `802aca2`.

## Answer

- **Estrutura:** árvore compacta `Project → bucket de estado → Thread`. Os buckets ficam dentro de cada Project, não duplicam Threads e cobrem ao menos execução, espera e recentes/concluídas.
- **Ação primária:** criar Thread deve ser a operação mais rápida. Há ação global e ação contextual por Project; o fluxo solicita apenas escolhas ainda necessárias de Workspace e Ambiente.
- **Workspace:** aparece sempre na segunda linha de cada Thread. Não vira um quarto nível da árvore. Isso mantém visível o contexto compartilhado ou isolado e reduz erro em nomes iguais.
- **Ambiente:** local fica sem marcador quando inequívoco; remoto usa badge nominal. Nomes iguais, desconexão ou indisponibilidade tornam o marcador obrigatório. Não existe seletor global que esconda Threads de outros Ambientes.
- **Estados e ordenação:** execução e espera têm prioridade sobre recentes/concluídas dentro do mesmo Project. Estado usa texto/ícone além de cor. Buckets e Projects podem recolher; a Thread selecionada continua encontrável.
- **Seleção e ações:** uma Thread selecionada abre seu contexto sem alterar o Ambiente globalmente. Criação, rename, retomada, ramificação e ações destrutivas ficam em affordances contextuais; indisponibilidade desabilita execução sem apagar histórico.
- **Referência validada:** variante A, combinada somente com os buckets de estado. As variantes de lista global por ciclo de vida e agrupamento permanente por Workspace foram recusadas como estrutura principal.
- **Asset:** [UI Model](../artifacts/ui-model.md). Protótipo na branch `prototype/explorer-navigation`, commit `802aca2`; capturas A/B/C e DOM foram validados em Chromium headless isolado a 1440×900.

**Riscos a carregar:** Workspace sempre visível aumenta densidade; implementação deve truncar sem ocultar o valor completo de tecnologias assistivas. Agrupar Projects equivalentes é apresentação, não identidade global.
