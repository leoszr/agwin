# Qual sequência de migração entrega Web e Desktop preservando a infraestrutura?

Type: grilling
Labels: wayfinder:grilling
Mode: HITL
Status: open
Assignee:
Parent: ../map.md
Blocked by: 07, 10, 11, 12, 13, 14, 15

## Question

Com base nas decisões anteriores, definir uma estratégia de migração fundamentada por módulos/caminhos reais: o que reutilizar, extrair, refatorar, substituir e descartar do PI WEB, e em qual ordem.

Confrontar as fases 1–9 do roadmap com dependências técnicas reais sem transformá-las em implementação durante o mapa. Preservar sessiond, persistência, workspaces, projetos, máquinas, remoto, terminal, arquivos, diff, plugins, integração Pi e realtime sempre que razoável; qualquer perda relevante precisa de decisão explícita e evidência. A instalação nova não exige migrar dados de usuários antigos.

Estabelecer checkpoints verificáveis, riscos, reversibilidade, licenças/atribuição, limites do primeiro produto Pi/Linux e preparação mínima para OMP posterior. Consolidar Migration Strategy e os vínculos necessários a Current Architecture Map, Target Architecture e UI Model, sem duplicar as resoluções canônicas dos tickets.
