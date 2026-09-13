# Qual sequência de migração entrega Web e Desktop preservando a infraestrutura?

Type: grilling
Labels: wayfinder:grilling
Mode: HITL
Status: resolved
Assignee: leo
Parent: ../map.md
Blocked by: 07, 10, 11, 12, 13, 14, 15

## Question

Com base nas decisões anteriores, definir uma estratégia de migração fundamentada por módulos/caminhos reais: o que reutilizar, extrair, refatorar, substituir e descartar do PI WEB, e em qual ordem.

Confrontar as fases 1–9 do roadmap com dependências técnicas reais sem transformá-las em implementação durante o mapa. Preservar sessiond, persistência, workspaces, projetos, máquinas, remoto, terminal, arquivos, diff, plugins, integração Pi e realtime sempre que razoável; qualquer perda relevante precisa de decisão explícita e evidência. A instalação nova não exige migrar dados de usuários antigos.

Estabelecer checkpoints verificáveis, riscos, reversibilidade, licenças/atribuição, limites do primeiro produto Pi/Linux e preparação mínima para OMP posterior. Consolidar Migration Strategy e os vínculos necessários a Current Architecture Map, Target Architecture e UI Model, sem duplicar as resoluções canônicas dos tickets.
## Comments

- 2026-09-12 (Wayfinder, HITL; responsável: leo): estratégia confirmada em quatro rodadas. Leo aprovou strangler interno, Web antes do gate AppImage, paridade por capacidade, Files/Diff/Terminal antes de layout/temas e Explorer, AgentRuntime Pi antes do Chat, schema novo sem importador legado e rollback por checkpoint.

## Answer

Adotar um **strangler interno** com checkpoints executáveis e reversíveis. A ordem aprovada é: foundation de contratos/client runtime e shell mínimo no Web; Electron/AppImage consumindo a mesma API; Files/Diff/Terminal em Dockview; persistência de layout e temas; Project Explorer e novo schema Thread–Session–Workspace; `AgentRuntime` com adapter/testes Pi; Chat; corte final de `PiWebApp`; hardening/release Pi + Web + Electron Linux.

Cada caminho antigo só é removido após paridade de capacidade comprovada por testes direcionados e fluxo real; depois da entrada do Desktop, todo corte também passa por smoke no AppImage. Reversão ocorre por versão/checkpoint, com flags apenas locais e temporárias. Instalações antigas não são importadas; migrações de schema começam no primeiro release novo.

`sessiond`, stores, Projects/Workspaces, máquinas/proxy remoto, Files, Git/Diff, Terminal, plugins, path safety, integração Pi e realtime são preservados atrás das novas fronteiras. OMP não é implementado: a primeira entrega prepara apenas o seam `AgentRuntime`, capabilities, identidade de runtime por Session e matriz/testes do adapter Pi.

Artefatos: [Current Architecture Map](../artifacts/current-architecture-map.md), [Target Architecture](../artifacts/target-architecture.md), [UI Model](../artifacts/ui-model.md) e [Migration Strategy](../artifacts/migration-strategy.md).

**Alternativas recusadas:** branch de reescrita, duas UIs duradouras, Desktop tardio, paridade big-bang, flags permanentes, schema legado, AgentRuntime depois do Chat e implementação antecipada de OMP.

**Riscos:** dependências ocultas em `PiWebApp`, lifecycle em reparenting/popout, ABI de `node-pty`, lifecycle/update do host, segurança/backpressure do gateway e inventário de licenças redistribuídas.
