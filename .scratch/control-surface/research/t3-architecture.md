# Evidências — Quais padrões multi-client do T3 Code são comprovados pelo código?

Ticket: `../issues/02-t3-architecture.md` · Etapa B + questões abertas 2, 3, 9, 10.
Revisão consultada: `pingdotgg/t3code` @ `7bd7f99e6cab940892ff9240549c507bfd066aee`
(2026-09-11 12:04 −0700, `perf(mobile): reuse completed code lines while streaming (#11211)`).
Leitura direta do código (clone readonly fora da worktree); sem execução visual ou build —
nenhuma afirmação abaixo depende de runtime observado.

URLs permanentes usam `?plain=1` na revisão fixada, ex.:
`https://github.com/pingdotgg/t3code/blob/7bd7f99e6cab940892ff9240549c507bfd066aee/packages/contracts/src/rpc.ts?plain=1`

## 1. Estrutura real e divergências do brief

O brief (§2, Etapa B) hipotetizava `apps/{web,desktop,mobile,server}` e
`packages/{client-runtime,contracts,shared,…}`. Confirmado, com adições:

- `apps/`: `desktop`, `marketing`, `mobile`, `server`, `web` — há também `marketing`
  (fora do escopo multi-client).
- `packages/`: `client-runtime`, `contracts`, `effect-acp`, `effect-codex-app-server`,
  `shared`, `ssh`, `tailscale` — quatro pacotes além do hipotetizado.
- O servidor chama-se pacote **`t3`** versão **`0.0.40`**, em lockstep com
  `@t3tools/web 0.0.40` e `@t3tools/desktop 0.0.40`
  (`apps/*/package.json`); mobile está em `0.0.0` (não versionado junto).
- Stack: `effect 4.0.0-rc.112` (RC, catálogo `pnpm-workspace.yaml:50`), TypeScript/Node ≥ 24,
  React 19 no web, Electron 44 no desktop. Todo o protocolo e o runtime são
  construídos sobre **Effect** (`effect/Schema`, `effect/unstable/rpc/*`,
  `effect/unstable/reactivity` Atoms). Esse acoplamento é o principal custo de
  transplante (ver §9).
- Licença: **MIT**, © 2026 T3 Tools Inc. (`LICENSE`, raiz). Permite usar, copiar,
  modificar, mesclar, publicar, distribuir, sublicenciar e vender, exigindo apenas
  preservar o aviso de copyright. Sem copyleft; sem obrigação de abrir o derivado.
  Ressalvas: `apps/web/THIRD_PARTY_NOTICES.md` (dependências do bundle web),
  `native/libghostty-vt/LICENSE` (licença própria do componente nativo de terminal) e
  marca/produto (`productName: "T3 Code (Alpha)"` em `apps/desktop/package.json`) —
  padrões e ideias são livres; copiar arquivos exige manter os avisos.

## 2. Etapa B — respostas por questão

### B1. Qual código é compartilhado por Web e Desktop?

Três pacotes workspace, dependidos igualmente por `apps/web` e `apps/desktop`
(e mobile também depende dos três — prova de que o compartilhamento é real e
tri-client, não promessa):

- `packages/contracts` — todos os schemas Effect (`environment`, `server`,
  `orchestration`, `provider*`, `terminal`, `vcs`, `git`, `filesystem`,
  `preview`, `relay`, `auth`, `ipc`, …) e os grupos RPC. É a única fonte de
  verdade do protocolo.
- `packages/client-runtime` — sem export raiz proposital; API por subpath
  (`packages/client-runtime/README.md:1-37`): `connection` (targets, catálogo,
  supervisão, retries, registry, onboarding), `environment` (identidade,
  descritores, endpoints, chaves escopadas), `rpc` (client HTTP/RPC, protocolo,
  sessões, subscriptions), `relay` (relay gerenciado + descoberta),
  `authorization` (Bearer/DPoP + persistência de tokens), `platform`
  (contratos de capability e persistência **providos pelos apps**), `state/<domínio>`
  (estado focado, reducers, retenção, construtores de Atoms), `operations`
  (workflows multi-passo), `errors`, `voice-input`.
- `packages/shared` — utilidades puras (semver, fusão de uso, temas, JWT de relay,
  `httpReadiness`, tracing…).

Direção de dependência (README, `Dependency direction`): aplicações provêm
serviços `platform`; `connection` compõe `platform` + `authorization` + `relay` +
`rpc` para supervisionar sessões por environment; módulos `state` consomem o
registry e expõem estado/Atoms. Ou seja: **views nunca tocam rede; o runtime
central possui conexão e estado; a plataforma injeta o que é nativo**.

### B2. O que pertence ao servidor?

Tudo que executa ou persiste (`apps/server/src/`): sessões/turnos de providers e
seus drivers (`provider/Drivers/`, `Layers/`, `Services/`), orquestração de
threads/shells, terminais (`terminal/Manager.ts`, adaptadores pty `BunPtyAdapter`/
`NodePtyAdapter`), git/VCS e worktrees (`vcs/`, `git/`), arquivos e projetos
(`project/`, `workspace/`), preview e automação, dispositivos, relay client,
pull-requests, medição de uso, auth/emissão de tokens, auto-update, escaneamento
de sessões de agentes. O servidor também **serve o bundle web estático**
(`apps/server/src/http.ts:456-532`, `staticDir` + `manifest.json`, fallback a
`index.html`) — fato que sustenta B5.

### B3. O que pertence ao client-runtime?

Conexão, sessão e estado compartilhável — nunca execução (§1 + evidências):

- `connection/`: quatro kinds de target (`model.ts:9-56` —
  `Primary` direto, `Bearer`, `Relay`, `Ssh`), catálogo persistido, `resolver`
  (prepara URL de socket `…/ws` + auth por target, `resolver.ts:38-60`),
  `supervisor` por environment (fases `available|offline|connecting|backoff|
  connected|blocked`, `model.ts:128-147`), `registry` multi-environment
  (`entries: Map<EnvironmentId, …>`, `registry.ts:62-129`) com reconciliação de
  ambientes gerenciados pela plataforma (`registerPlatform/reconcilePlatform`).
- `rpc/`: `protocol.ts` tem 8 linhas — o client tipado deriva-se do grupo de
  contratos (`RpcClient.make(WsRpcGroup)`); `session.ts` abre o socket (timeout
  15 s), roda `serverProbe`, lê `initialConfig` e mantém `subscribeServerConfig`
  com **replay/projeção** (`serverConfigReplayEvents`, `applyServerConfigProjection`
  em `state/serverConfigProjection.ts`); `client.ts` classifica cada método em
  unário, subscription ou comando-stream (`EnvironmentRpcTag`,
  `EnvironmentSubscriptionRpcTag`, `EnvironmentStreamCommandRpcTag`).
- `state/<domínio>`: ~40 módulos (threads, shell, terminal, vcs, preview,
  pullRequests, server, models, …). Ex.: `state/threads.ts` pagina turnos
  (10 iniciais + 20 por página, comentário de dimensionamento por gzip),
  aplica eventos via `threadReducer`, retém snapshots com TTL
  (`THREAD_SNAPSHOT_IDLE_TTL_MS`, `threadRetention.ts`) e persiste via
  `EnvironmentCacheStore`.
- `platform/persistence.ts:58-123` (`EnvironmentCacheStore`): snapshots de shell,
  thread, **server config completa (inclui catálogo de providers para criação
  offline)**, refs VCS — primeira pintura e sobrevivência a reconnect vêm daqui,
  não de refetch cego.
- `relay/discovery.ts`: descoberta de environments da conta com validação de
  status e estado reativo (`RelayEnvironmentDiscovery`).

### B4. O que pertence apenas ao Desktop?

Só casca nativa + supervisionamento do backend (`apps/desktop/src/`):
`main.ts` (bootstrap Effect), `app/` (lifecycle, ativação, identidade, catálogo de
conexões, Clerk, shutdown), `backend/` (pool e ciclo de vida do processo servidor),
`electron/` (janela, menu, diálogo, protocolo, safeStorage, updater, tema, shell),
`ipc/` (handlers expostos ao renderer), `preload.ts` (ponte `contextBridge` —
`desktopBridge` + Clerk), `settings/`, `shell/`, `ssh/`, `wsl/`, `updates/`
(electron-updater), `telemetry/`, `preview/` (import de browsers, BrowserSession),
`snapShot/`, `window/`. **Nenhum componente de domínio/chat/threads vive aqui**:
o desktop não duplica UI.

### B5. Como o Desktop inicia/encontra o servidor?

- O main gera `DesktopBackendBootstrap` (`contracts/src/desktopBootstrap.ts:5-22`:
  `mode:"desktop"`, `port`, `host`, `desktopBootstrapToken`, tailscale/telemetria)
  e inicia o pacote `t3` como **processo filho** (`backend/DesktopBackendManager.ts`,
  fábrica por instância com restart loop; `DesktopBackendPool.ts` registra
  instâncias — hoje primary + WSL).
- Backoff de restart `500 ms → 10 s`, até 5 falhas fatais de preflight antes de
  superficiar o erro; prontidão por HTTP em `/.well-known/t3/environment`
  (`waitForHttpReadyShared`); porta por scan sequencial desde a default
  (`DesktopApp.ts:160-175`).
- Em produção o renderer carrega **o próprio backend local como origem da UI**:
  `rendererTarget = backendConfig.httpBaseUrl` (`DesktopApp.ts:183-191`), servido
  pelo `t3code://app` via proxy de protocolo (`ElectronProtocol.ts:145-222`,
  com CSP própria); em dev, aponta ao dev-server web. Comentário em
  `window/DesktopWindow.ts:92`: o renderer "sempre carrega a URL local do cliente
  e conecta" — **a fronteira renderer↔servidor é a mesma do web** (HTTP+WS), não
  há SDK nativo paralelo; o que o web não alcança vai pelo `DesktopBridge` (IPC).
- Identidade local estável `PRIMARY_LOCAL_ENVIRONMENT_ID = "primary"`
  (`contracts/src/ipc.ts:435`); o main entrega bootstraps
  (`getLocalEnvironmentBootstraps`: id, label, http/ws URLs, token) e bearer
  (`getLocalEnvironmentBearerToken`); reload do renderer reidrata do backend
  (`DesktopWindow.ts:755-779`, recuperação limitada contra OOM).
- Servidores remotos usam o mesmo registry/abstração (targets bearer/relay/SSH);
  SSH é provisionado pelo desktop (`ensureSshEnvironment`, descoberta via
  ssh-config/known-hosts) mas, uma vez com URL+credencial, vira um environment
  comum no runtime.

### B6. Como clients descobrem environments?

Quatro vias convergindo ao catálogo do registry (persistido + reconciliado):

1. Local embutido (desktop): bootstraps IPC acima.
2. Rede local: `subscribeDiscoveredLocalServers` — o servidor escaneia portas
   (`portDiscovery.scan/subscribe`, `apps/server/src/ws.ts:2806-2830`) e publica
   `DiscoveredLocalServerList` (`contracts/src/preview.ts` + teste dedicado).
3. Relay/conta: `RelayEnvironmentDiscovery` lista environments da conta e valida
   disponibilidade antes de exibir.
4. SSH: `discoverSshHosts`/`resolveSshHost` no bridge; credencial vira sessão
   bearer via `bootstrapSshBearerSession` + tickets de WebSocket
   (`issueSshWebSocketTicket`).

### B7. Como reconnect funciona?

Supervisão por environment, não um socket global: `supervisor.ts` (799 linhas)
com sinais (Connect/Disconnect/Retry/NetworkChanged/Wakeup), tentativa em estágios
(`preparing|opening|synchronizing`), timeouts de 15 s (estabelecimento, probe de
desktop 15 s / mobile 3 s), retries `3/4/8/16 s` com reset após 30 s estável, e
distinção **transiente vs bloqueado** (`ConnectionTransientError` retrya;
`ConnectionBlockedError` — auth/rede bloqueada com dica — não).
Ao reconectar: `serverProbe` → `serverGetConfig` → reinscrição
`subscribeServerConfig` com replay (snapshot + eventos de temas/uso separados, de
modo que downgrade limpa estado que o servidor antigo jamais atualizaria) →
reinscrição por domínio. Cache local cobre o intervalo (B3).

### B8. Como o RPC contract separa client/server?

Três canais, dois contratos, um dono (`packages/contracts`):

- **WS-RPC** (quente): `WS_METHODS` (~110 nomes `domínio.verbo`, `rpc.ts:255-412`)
  + `ORCHESTRATION_WS_METHODS` (8 métodos, `orchestration.ts:34-43`:
  `dispatchCommand`, `getWorkflowScript`, `getTurnDiff`, `getFullThreadDiff`,
  `searchThreads`, `getArchivedShellSnapshot`, `subscribeShell`,
  `subscribeThread`). Cada entrada é `Rpc.make(método, {payload, error, stream})`
  com schemas Effect; o grupo `WsRpcGroup` (`rpc.ts:1279-1412`) é consumido dos
  dois lados: client via `RpcClient.make` (tipo derivado, sem Drift), servidor
  via `WsRpcGroup.toLayer/of` servido em `/ws` por `RpcServer.toHttpEffectWebsocket`
  com auth de upgrade (`ws.ts:482, 3057-3121`).
- **HTTPS** (frio/auth/snapshots): `environmentHttp.ts` (622 linhas, `HttpApi`):
  troca de tokens, sessões, descriptor, snapshots de thread/shell, diffs de PR,
  saúde de relay. Transporte direto, sem streaming.
- **IPC Electron** (main↔renderer, separado do protocolo servidor):
  `contracts/src/ipc.ts` (1599 linhas) — `DesktopBridge` (bootstraps, tokens,
  pickers, menus, updates, WSL/SSH, exposição de rede…), com membros opcionais
  para skew ("opcional enquanto shells antigos hospedam clients novos").
- Erros são valores schemaeados por método (`TaggedError`s), e subscriptions são
  cidadãos de primeira classe (`subscribe*`), não polling.

### B9. Como providers são abstraídos?

Abstração **server-side**, não no client-runtime:

- `ProviderDriver<Config>` (`apps/server/src/provider/ProviderDriver.ts:134`):
  metadados, `supportsMultipleInstances`, materialização por `instanceId`
  (`providerInstance.ts`: kinds `codex|claudeAgent|cursor|grok|opencode|…`,
  env por instância, `defaultInstanceIdForDriver`).
- Eventos normalizados: `providerRuntime.ts` define estados canônicos
  (sessão/thread/turno), tipos de item e de request — o client renderiza o
  canônico, nunca o dialeto do vendor.
- Catálogo publicado ao client: `ServerProviderModel/…/Skill/SlashCommand`
  (`server.ts:60-160`) com `ModelCapabilities` por modelo
  (`model.ts:125-128`, hoje `optionDescriptors`) + overrides customizados;
  fluxos de auth/instalação via RPC com subscribe de progresso
  (`provider.auth.*`, `provider.install.*`); limites de uso como fontes
  streamadas (`providerUsageLimits.ts`, `usage.ts`).
- Execução (processos do agente, credenciais, arquivos, terminal, git) jamais
  sai do servidor — o client só despacha comandos e assina eventos.

### B10. Como capabilities/version compatibility funcionam?

Quatro mecanismos combinados, todos por capability explícita:

1. **Descriptor por environment** (`environment.ts:162-169`):
   `{environmentId, label, platform, serverVersion, capabilities}` — identidade e
   versão viajam juntas; refs escopadas (`ScopedProjectRef/ScopedThreadRef/
   ScopedThreadSessionRef`, `environment.ts:197-213`) carregam o environment.
2. **Capabilities opcionais com contrato "ausente = não suportado"**
   (`ExecutionEnvironmentCapabilities`, `environment.ts:78-159`): ~20 flags
   (`pullRequests`, `threadSettlement/Snooze/Pin/Reorder`, `environmentThemes`,
   `usageLimitSources/PriceOverrides`, `fileAttachments`, `serverSelfUpdate(+)`,
   `serverUpdateThreadContinuation`, `desktopAppUpdate`, …), cada uma documentando
   que o client **não deve sondar nem enviar** o comando sob skew.
3. **Decodificação tolerante**: `ForwardCompatibleOptional/Nullable/Array`
   (`baseSchemas.ts:51-95`) descartam valores desconhecidos em vez de quebrar o
   struct — permite servidor novo ↔ client antigo sem falha de decode
   (ex. `ServerConfigIssues`).
4. **Skew advisory, não gate**: `apps/web/src/versionSkew.ts:55-85` compara núcleo
   semver (nightly compara full; servidor à frente não reclama; resto cai em
   desigualdade de string), exibe banner com `npx t3@<versão>` ou capability de
   self-update (`boot-service|respawn|desktop-app|desktop-managed`), dispensável
   por environment+versões. Não há recusa dura de conexão por versão encontrada —
   o client degrada por capability. Semver helpers em `packages/shared/src/semver.ts`.

## 3. Cobertura das questões abertas (2, 3, 9, 10)

- **Q2 (fronteira UI / client-runtime / server)** — informada por B1–B5, B8:
  fronteira comprovada é *views → runtime por environment (conexão+estado) →
  protocolo em contratos → servidor dono da execução*, com serviços de plataforma
  injetados via interfaces (`Context.Service`), nunca `isDesktop` espalhado.
  Multi-servidor simultâneo é o caso normal (registry é um mapa), não exceção.
- **Q3 (quanto do client-runtime é aplicável)** — informada por B1, B3, B7, B10:
  o portátil é o *desenho* (registry+supervisor por environment, sessão RPC com
  replay/projeção, cache-store com snapshots, chamadas gated por capability);
  o *código* é inseparável do Effect v4-RC + Rpc instável + Atoms
  (`@effect/atom-react`) + React 19. Ver §9 para o recorte recomendado.
- **Q9 (protocolo estável clients↔server)** — informada por B8, B6, B7:
  padrão comprovado = métodos `domínio.verbo` schemaeados; unário vs subscription
  vs comando-stream como kinds distintos; HTTP para auth/snapshots, WS para o
  quente; identidade por environment em toda ref; descoberta como streams. É
  copiável como formato mesmo sobre outro transporte.
- **Q10 (versionamento de capabilities)** — informada por B10, B9:
  descriptor + capabilities opcionais + decode tolerante + skew advisory cobre
  client↔servidor e, por construção, estende-se a Pi/OMP se capabilities de
  *runtime* viajarem em namespace próprio, separadas das de *environment/
  plataforma* (hoje o T3 só tem um ator de execução; a separação runtime×ambiente
  é recomendação nossa, §9, não fato observado).

## 4. Recomendações (padrões aproveitáveis) — não são decisões

1. **Registry por environment com supervisão e fases explícitas** (B3/B7):
   adotar o modelo fases + transiente/bloqueado + backoff com reset; é o que
   permite vários servidores na mesma janela sem estado global.
2. **Sessão = probe + config inicial + subscription com replay/projeção**
   (B3/B7): copiar a semântica (snapshot + eventos voláteis separados; downgrade
   limpa), não o código Effect.
3. **Cache-store de snapshots por environment** (B3): shell/thread/server-config/
   refs com TTL — primeira pintura instantânea e modo degradado offline.
4. **Contrato único versionado do protocolo** (B8): um módulo de schemas +
   tabela `domínio.verbo` + kinds (unário/subscription/stream); IPC nativo em
   contrato separado do protocolo servidor.
5. **Renderer desktop = mesmo client web servido pelo backend local** (B5):
   valida o default Electron-sem-duplicação; o nativo expõe-se por bridge mínima
   e opcional (membros opcionais toleram skew shell↔client).
6. **Capabilities opcionais + decode tolerante + skew advisory** (B10):
   nunca sondar ausente; banner com caminho de update, nunca gate duro —
   transportável direto para client/servidor/runtime.
7. **Providers como drivers server-side com eventos canônicos** (B9): registry por
   `instanceId`, catálogo publicado com capabilities por modelo; client não conhece
   vendors.
8. **Descoberta como streams no registry** (B6): local-scan, relay e SSH convergem
   ao mesmo catálogo — cobre "múltiplos servidores sem poluir a UI" no nível de
   dados (a apresentação é do ticket de explorer).

Custos de transplante a registrar: Effect v4-RC + Rpc instável atravessam
contratos, runtime, servidor e web (`@effect/atom-react`); adotar o código exige
adotar o Effect. Alternativa é reimplementar a *forma* sobre o transporte atual
do PI WEB. **Não copiar monorepo, React ou camadas sem necessidade** — o valor
está nos 8 padrões acima, não na árvore de pacotes.

## 5. Decisões humanas (não tomadas aqui)

Vão aos tickets próprios (client-server, desktop-platform, agent-runtime):
escolha do transporte do protocolo; adotar ou não Effect no novo produto;
namespace de capabilities de runtime (Pi/OMP) separado das de environment;
formato do catálogo de environments; política de self-update do servidor;
escopo do `DesktopBridge`/Platform API. Este relatório alimenta
`07-client-server.md` (Q 2, 3, 8, 9, parte cliente/servidor da 10),
`12-desktop-platform.md` (boot/lifecycle/renderer) e `13-agent-runtime.md`
(parte capabilities da 10).

## 6. Limitações

- Sem execução visual/build/testes: afirmações sobre comportamento em runtime
  (timings de backoff, pintura, OOM-recovery) vêm de código/comentários, não de
  medição — sem números de performance neste relatório.
- Mobile coberto só via dependências e README; SSH/tailscale/`effect-acp` lidos
  superficialmente (suficiente para Etapa B, insuficientes para detalhar túneis).
- Wire-format do Effect RPC não inspecionado byte a byte; a separação
  client/server está provada no nível de contratos + wiring, não em captura de
  tráfego.
- Comparação com PI WEB deliberadamente ausente (ticket 01); UX de sidebar
  deliberadamente ausente (ticket 03).
