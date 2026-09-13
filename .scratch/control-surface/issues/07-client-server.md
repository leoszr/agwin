# Qual interface separa clientes, estado compartilhado e execução?

Type: grilling
Labels: wayfinder:grilling
Mode: HITL
Status: resolved
Assignee: leo
Parent: ../map.md
Blocked by: 01, 02

## Question

Qual deve ser a arquitetura multi-client e o protocolo entre UI, client runtime, server e sessiond, usando o que PI WEB já resolve e apenas padrões justificados do T3 Code?

Resolver questões abertas 2, 3, 8, 9 e a parte cliente/servidor da 10. Considerar vários servidores simultâneos na mesma janela, identidade por ambiente, acesso privado autenticado, propriedade de estado e credenciais, subscriptions, desconexão/reconexão e compatibilidade de versões. Web e Desktop devem compartilhar a lógica pertinente, sem cliente paralelo nem camada de passagem sem responsabilidade real.

Decidir módulos/interfaces necessários e organização de aplicações/pacotes somente após avaliar o código. Preservar a execução ao reiniciar UI/API. Registrar alternativas, evidências, tradeoffs e impacto na arquitetura proposta; não implementar.

Confrontar as topologias encontradas em [O que o PI WEB já resolve e onde estão seus acoplamentos?](01-pi-web.md) e [Quais padrões multi-client do T3 Code são comprovados pelo código?](02-t3-architecture.md): gateway PI WEB que encaminha acesso a máquinas remotas versus conexões dos clientes por ambiente. Escolher onde ficam credenciais de conexão, descoberta e estado compartilhável, considerando alcance de rede/origem do navegador. Distinguir esse client runtime browser-side de SessionDaemonClient, que liga backend e daemon; não mover socket Unix ou autoridade do servidor para o renderer.

## Comments

2026-09-12 (Wayfinder): leo aprovou em duas rodadas interativas o gateway único, propriedade de estado por responsabilidade, HTTP/JSON + WebSocket, cache offline somente leitura, identidade persistente com cadastro manual, sessão HttpOnly, compatibilidade por capabilities com major gate e módulos internos na árvore atual.

## Answer

### Decisão

Adotar uma **topologia de gateway único**, preservando a separação madura do PI WEB:

```text
Web / Electron renderer
        │ mesma origem HTTP/WS
        ▼
Client runtime
        │ contratos por environmentId
        ▼
Gateway Web/API
  ├─ Ambiente local ─ SessionDaemonClient ─ socket Unix ─ sessiond ─ Pi
  └─ Ambiente remoto ─ HTTP/WS autenticado ─ Web/API remoto ─ sessiond ─ Pi
```

O gateway é o único endpoint conhecido pelo Cliente. Ele oferece catálogo e rotas escopadas por `environmentId`, mantém uma conexão supervisionada por Ambiente remoto e usa o `SessionDaemonClient` existente apenas entre processos server-side. O renderer não recebe socket Unix, autoridade de execução nem credenciais remotas.

Cada servidor gera um `environmentId` opaco e persistente. O gateway cadastra endpoints remotos manualmente e inclui seu Ambiente local no bootstrap. Referências que atravessam Ambientes carregam `environmentId`; IDs internos do próprio Ambiente continuam locais. Descoberta automática por rede, SSH ou conta não entra nesta entrega.

### Propriedade

| Responsável | Estado que possui |
|---|---|
| Ambiente / `sessiond` | execução, processos, sessões, transcripts, Projects, Workspaces, unread/archive e credenciais do agente |
| Gateway | catálogo de Ambientes, endpoints, credenciais de conexão remota, supervisão dos proxies e autenticação do Cliente |
| Client runtime | projeções e subscriptions escopadas por Ambiente, cache descartável e estado de conexão |
| UI | seleção e estado visual local; não executa nem acessa filesystem diretamente |

Web e Electron autenticam no gateway por sessão `Secure`, `HttpOnly` e `SameSite`, criada após bootstrap/login. Requisições mutáveis exigem proteção de origem/CSRF. Segredos de Ambientes permanecem no servidor e não aparecem em respostas, logs ou armazenamento do browser. O mecanismo nativo de bootstrap e armazenamento seguro do Desktop continua para [Como Electron integra servidor local e recursos nativos sem duplicar o Web?](12-desktop-platform.md).

### Protocolo e client runtime

Evoluir o HTTP/JSON + WebSocket existente, sem transplantar Effect e sem criar RPC próprio:

- HTTP para descriptor, catálogo, snapshots, autenticação e comandos unários;
- WebSocket para subscriptions e command streams;
- contratos wire em `src/shared/protocol/`, com descriptor, `environmentId`, versão, capabilities, payloads e erros validados;
- estado/conexão em `src/client/runtime/`, consumido pelas views Lit;
- registry, autenticação e proxy permanecem em `src/server/`; `sessiond` e seus stores continuam autoridades separadas.

Não criar monorepo nem packages publicados agora. Essas fronteiras só viram packages quando houver build ou distribuição independente real.

### Desconexão e compatibilidade

Cada Ambiente tem estado explícito (`connecting`, `connected`, `offline`, `blocked`) e backoff independente no gateway; o client runtime mantém projeções separadas e reflete esse estado. Ao reconectar: probe, snapshot atual e reinscrição. Se o servidor anunciar replay por cursor/watermark, ele pode fechar o intervalo; sem essa capability, o Cliente descarta a projeção volátil e aplica snapshot completo. Cache offline é somente leitura, identificado como desatualizado; comandos não são enfileirados.

UI/API e gateway podem reiniciar sem terminar sessões porque `sessiond` continua dono dos processos e do estado durável. A reconexão apenas recompõe projeções.

O descriptor publica `protocolVersion` e capabilities opcionais. Campos desconhecidos são ignorados de forma tolerante e operações só são oferecidas quando sua capability existe. Diferenças minor geram aviso e degradação funcional; major incompatível ou requisito de segurança não atendido bloqueia a conexão.

### Alternativas descartadas e tradeoffs

- **Conexão direta Cliente → Ambiente:** reduziria o proxy, mas colocaria CORS, TLS, alcance de rede e segredos por origem no browser. Não aproveita o gateway maduro do PI WEB.
- **Modo híbrido direto/proxy:** flexibilidade sem necessidade atual e duas topologias para testar.
- **RPC/Effect do T3 Code:** desenho útil, código acoplado a Effect v4 RC; portar conceitos custa menos que migrar a base.
- **Gateway como autoridade de todo estado:** simplificaria leituras agregadas, mas duplicaria dados dos Ambientes e ampliaria o impacto de falhas.
- **Comandos offline e descoberta automática:** exigiriam idempotência, conflitos e novas superfícies de credencial sem necessidade comprovada.

O custo aceito é que o gateway se torna ponto de acesso obrigatório e precisa preservar isolamento, backpressure e falhas por Ambiente. Ele não se torna dono da execução: uma falha do gateway interrompe controle e visualização, não as sessões em `sessiond`.

### Evidências e impacto

A decisão preserva o proxy, `SessionDaemonClient`, `SessionEventHub`, stores e lifecycle separados comprovados em [O que o PI WEB já resolve e onde estão seus acoplamentos?](01-pi-web.md). Do [T3 Code](02-t3-architecture.md), adota identidade, registry, supervisão, snapshot/subscription e capabilities por Ambiente, mas não seu código Effect nem a conexão browser direta.

Esta fronteira desbloqueia as decisões sobre relação Thread/Workspace, frontend, Agent Runtime, painéis, Desktop e migração. Nenhum ticket novo é necessário: os contratos de Agent Runtime, layout e bootstrap nativo permanecem nos filhos já existentes.
