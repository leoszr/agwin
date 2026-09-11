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
Distinguir fatos, padrões possivelmente aproveitáveis e custos de transplantá-los para PI WEB. Incluir licença e condições de reutilização. Não recomendar copiar monorepo, React ou camadas sem evidência de necessidade. A decisão de arquitetura ficará em ticket humano.

## Comments

- 2026-09-11: resolvido contra `pingdotgg/t3code@7bd7f99e`; Etapa B e Q2, 3, 9, 10 cobertas no relatório abaixo.

## Answer

- Estrutura real: `apps/{desktop,marketing,mobile,server,web}`, `packages/{client-runtime,contracts,effect-acp,effect-codex-app-server,shared,ssh,tailscale}`; servidor `t3@0.0.40` dono da execução e serve o bundle web; licença MIT (copyright + aviso de permissão).
- Desktop = casca Electron que inicia o `t3` local e carrega o mesmo client web (mesma fronteira lógica); nativo via `DesktopBridge` (IPC).
- Runtime por environment (conexão supervisionada + replay + cache), RPC schemaeado (WS + HTTPS), providers server-side, compat por capabilities opcionais + decode tolerante + skew advisory.
- Custo: código inseparável do Effect v4-RC (client-runtime não depende de React; React 19 é do app web) — portar o desenho, não o código.
- Evidências: [Evidências — Quais padrões multi-client do T3 Code são comprovados pelo código?](../research/t3-architecture.md). Decisões humanas seguem nos tickets linkados no relatório.
