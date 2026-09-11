# Como painéis e layouts compartilham contexto sem controlar a execução?

Type: grilling
Labels: wayfinder:grilling
Mode: HITL
Status: open
Assignee:
Parent: ../map.md
Blocked by: 08, 09, 10

## Question

Definir o modelo mínimo de painéis e layout: Project Explorer, Chat, Files, Diff e Terminal inicialmente, todos movíveis, agrupáveis em tabs, redimensionáveis, ocultáveis e reabríveis, sem sidebar direita obrigatória.

Decidir como cada painel segue ou fixa thread/ambiente/workspace, como múltiplas instâncias se comportam e como estado visual se separa de execução e estado de domínio. Definir registro de painéis e o necessário para extensões sem framework especulativo.

Decidir escopo e persistência de layout, restauração/defaults, migração do formato quando necessária, comportamento de painéis indisponíveis por capability e expectativas para floating/popouts/responsividade com base no protótipo. Alimentar UI Model; não implementar docking.
