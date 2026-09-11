# Quais padrões multi-client do T3 Code são comprovados pelo código?

Type: research
Labels: wayfinder:research
Mode: AFK
Status: resolved
Assignee: leo
Parent: ../map.md
Blocked by:
Research branch: research/t3-architecture
Research asset: [Evidências — Quais padrões multi-client do T3 Code são comprovados pelo código?](../research/t3-architecture.md)

## Question

Investigar `pingdotgg/t3code`, começando pela arquitetura, não pela aparência. Cobrir toda a Etapa B e informar as questões abertas 2, 3, 9 e 10.

Identificar a estrutura real de apps e packages na revisão consultada, inclusive quando divergir do brief. Rastrear UI compartilhada, server-owned execution, client-runtime, contracts, provider abstraction, conexão por environment, descoberta, reconexão, subscriptions, caching, estado e versionamento/capabilities. Explicar como Desktop inicia/encontra o servidor e mantém o renderer na mesma interface lógica do Web.


## Comments

- 2026-09-11 (Wayfinder, AFK): resolvido contra `pingdotgg/t3code@7bd7f99e` (2026-09-11). Etapa B completa e questões 2, 3, 9, 10 informadas; divergências do brief registradas (apps têm também `marketing`; packages têm também `effect-acp`, `effect-codex-app-server`, `ssh`, `tailscale`; servidor é o pacote `t3@0.0.40` em lockstep com web/desktop; mobile também consome o client-runtime). Achado central: renderer Desktop em produção é o próprio bundle web servido pelo backend local (`DesktopApp.ts` → `backendConfig.httpBaseUrl` via protocolo `t3code://app`), logo mesma fronteira lógica do Web por construção. Protocolo: Effect Rpc/RpcGroup + Schemas (`WS_METHODS` ~110 + 8 de orquestração), WS quente + HTTP frio + IPC Electron em contrato separado. Reconnect por supervisor/environment com replay de config e cache de snapshots; versionamento por descriptor + capabilities opcionais + decode tolerante + skew advisory (sem gate duro). Licença MIT (T3 Tools Inc, 2026), sem copyleft. Limites: sem execução visual/build; mobile e SSH/tailscale superficiais; sem comparação PI WEB (ticket 01) nem sidebar UX (ticket 03).

## Answer

Resposta factual concisa: monorepo com `apps/{desktop,marketing,mobile,server,web}` e `packages/{client-runtime,contracts,effect-acp,effect-codex-app-server,shared,ssh,tailscale}`; servidor é o pacote `t3` dono de toda execução (providers/threads/terminais/git/arquivos) e serve o bundle web; `client-runtime` (sem export raiz) centraliza conexão por environment (targets primary/bearer/relay/ssh, supervisor com backoff, registry multi-environment), sessões RPC com replay/projeção, estado por domínio com cache de snapshots e descoberta via relay/rede-local/SSH; Desktop é só casca Electron que gera `DesktopBackendBootstrap`, inicia o `t3` como filho e carrega o mesmo client web pelo backend local, expondo nativo via `DesktopBridge` (IPC); protocolo em `contracts` (Effect Schema + Rpc, `domínio.verbo`, unário/subscription/stream, WS + HTTPS); providers abstraídos server-side (drivers por vendor + eventos canônicos + catálogo com capabilities); compatibilidade por descriptor+`serverVersion`, capabilities opcionais (ausente = não suportar/não sondar), `ForwardCompatible*` decoders e banner advisory de skew. Portável sem copiar monorepo/React/Effect: registry+supervisor, sessão com replay, cache-store, contrato único, renderer=web-local, capabilities+skew, drivers server-side, descoberta como streams. Custo principal: tudo é Effect v4-RC (`effect 4.0.0-rc.112`, Rpc instável, Atoms) — adotar o código é adotar o Effect. Evidências completas em [Evidências — Quais padrões multi-client do T3 Code são comprovados pelo código?](../research/t3-architecture.md). Decisões de arquitetura seguem humanas (tickets 07, 12, 13).
Distinguir fatos, padrões possivelmente aproveitáveis e custos de transplantá-los para PI WEB. Incluir licença e condições de reutilização. Não recomendar copiar monorepo, React ou camadas sem evidência de necessidade. A decisão de arquitetura ficará em ticket humano.
