# Os cinco artefatos deixam o caminho de implementação suficientemente claro?

Type: grilling
Labels: wayfinder:grilling
Mode: HITL
Status: resolved
Assignee: leo
Parent: ../map.md
Blocked by: 16, 19

## Question

Revisar com leo os cinco artefatos consolidados: Current Architecture Map, Target Architecture, UI Model, Migration Strategy e Decision Report. Cada decisão deve apontar para seu ticket com opções consideradas, evidências, decisão, motivo e riscos; os documentos sintetizam e referenciam, não criam fontes concorrentes.

Verificar a cobertura de todas as etapas A–G, questões abertas 1–15, funcionalidades e defaults do brief e os limites aprovados nesta sessão. Resolver lacunas explícitas via novos tickets antes de declarar o mapa concluído; não reduzir escopo silenciosamente nem esconder questões em “depois”.

A resposta humana decide se a rota está clara para iniciar a implementação. A documentação é autorizada como parte da resolução; construir o produto não é. Só encerrar o mapa quando não restar ticket aberto nem fog em escopo.

## Comments

### 2026-09-12 — Resolução com leo

Em duas rodadas HITL, leo escolheu fixar operação acessível/restauração como gates neste handoff, manter licenças como gate de distribuição e aprovou explicitamente encerrar o mapa sem iniciar a implementação. Preferiu não abrir uma decisão adicional de UI nem antecipar o inventário transitivo para bloquear o planejamento.

## Answer

### Handoff aprovado

A rota está suficientemente clara para iniciar a implementação em outro esforço. Os cinco artefatos são sínteses com fontes canônicas: [Current Architecture Map](../artifacts/current-architecture-map.md), [Target Architecture](../artifacts/target-architecture.md), [UI Model](../artifacts/ui-model.md), [Migration Strategy](../artifacts/migration-strategy.md) e [Decision Report](../artifacts/decision-report.md). A revisão conferiu sua existência, links locais, etapas A–G, questões 1–15, funcionalidades e defaults do [Plano Investigativo e Arquitetural](../brief.md), considerando os limites já aprovados.

### Classificação das pendências

- **Operação acessível do layout:** o shell deve oferecer operação por teclado e alternativas acessíveis ao arrasto. Dockview Core permanece; seu baseline não equivale a rearranjo por teclado pronto. O gate exige verificar as operações de layout, foco e semântica no Web e AppImage, incluindo popouts. A escolha dos controles específicos fica para a implementação, sem reduzir a exigência de acessibilidade.
- **Restaurar default:** ação manual que recompõe o layout inicial sem perder rascunhos ou outro estado transitório, apagar histórico ou encerrar execução de agentes/terminais. O reset não pode concluir com perda de estado. Continua proibido reset total automático para contexto indisponível ou entrada inválida; permanece a restauração recuperável decidida em [Como painéis e layouts compartilham contexto sem controlar a execução?](14-panels-layout.md).
- **Licenças e incompatibilidades:** o inventário transitivo do conteúdo efetivamente redistribuído e seus avisos são obrigatórios antes da distribuição, não antes de encerrar o planejamento. Os estudos consultados não registram impedimento de licença, mas não auditam toda a distribuição. Uma incompatibilidade concreta exige decisão antes de distribuir; não autoriza troca silenciosa de arquitetura ou perda funcional.

Interação, acessibilidade, restauração e licenças deixam de ser fog porque agora têm tratamento explícito, não porque foram validadas em produção ou retiradas do escopo. Não é necessário criar outro ticket para essas classificações.

### Evidências, alternativas e limites

A [pesquisa Dockview](../research/dockview.md), seção “Acessibilidade / teclado”, distingue o baseline Core de keyboard docking Enterprise e identifica comandos app-side como caminho possível. [Product](../../../PRODUCT.md) exige operação por teclado; o brief inclui `restore defaults`. A [pesquisa PI WEB](../research/pi-web.md), seção “Licença e redistribuição”, explicita a ausência de inventário transitivo. A direção visual neutra já aceita em [Dockview preserva comportamento e estado dos painéis reais do PI WEB?](09-dockview-prototype.md) permanece no UI Model; não é uma nova escolha de tema.

**Separação entre aprovação arquitetural e evidência executada:** A aprovação de um ticket ou documento de arquitetura NÃO equivale a evidência executada. Relatórios estáticos, links de rastreabilidade e protótipos exploratórios comprovam direção técnica e viabilidade, não funcionamento integral em produção:
- Os estudos Dockview não certificam todos os painéis finais;
- O protótipo Electron validou Session e shell reais, mas não um prompt completo com modelo externo;
- A comparação Pi/OMP não é prova de interoperabilidade em execução;
- Acessibilidade, segurança e empacotamento exigem verificações próprias em código real.

**Critérios e registro formal dos gates de implementação:** Nenhum gate é marcado como atendido apenas por ter seu ticket de arquitetura correspondente encerrado ou links válidos. Cada gate nos checkpoints de implementação deve registrar formalmente:
1. *(a) Requisito aprovado:* contrato e critério arquitetural definido;
2. *(b) Evidência disponível / estudos:* referências e protótipos preliminares existentes;
3. *(c) Verificação pendente a ser executada:* cenário/comando executável, revisão testada e resultado formal registrado.

**Licenças e distribuição:** O inventário transitivo de licenças do conteúdo efetivamente redistribuído é gate incondicional antes de distribuir qualquer pacote ou artefato (Web ou Desktop).

**Alternativas não escolhidas:** manter o handoff bloqueado por uma nova decisão de UI ou pelo inventário prévio de dependências. O motivo é que os contratos e gates acima bastam para orientar a implementação sem reabrir escolhas vigentes.

**Limites da validação:** esta sessão revisou documentos e evidências existentes, não executou novos testes de produto nem certificou WCAG, licenças transitivas, segurança ou empacotamento. A checagem independente não executou por limite de uso do modelo; a revisão foi feita diretamente na sessão principal. Os gates de migração continuam obrigatórios com suas verificações em código real. Não houve implementação.

Encerrar o mapa: nenhum ticket ou decisão em escopo permanece aberto após esta resolução.
