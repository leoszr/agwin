# Quais padrões multi-client do T3 Code são comprovados pelo código?

Type: research
Labels: wayfinder:research
Mode: AFK
Status: claimed
Assignee: leo
Parent: ../map.md
Blocked by:
Research branch: research/t3-architecture
Research asset: [Evidências — Quais padrões multi-client do T3 Code são comprovados pelo código?](../research/t3-architecture.md)

## Question

Investigar `pingdotgg/t3code`, começando pela arquitetura, não pela aparência. Cobrir toda a Etapa B e informar as questões abertas 2, 3, 9 e 10.

Identificar a estrutura real de apps e packages na revisão consultada, inclusive quando divergir do brief. Rastrear UI compartilhada, server-owned execution, client-runtime, contracts, provider abstraction, conexão por environment, descoberta, reconexão, subscriptions, caching, estado e versionamento/capabilities. Explicar como Desktop inicia/encontra o servidor e mantém o renderer na mesma interface lógica do Web.

Distinguir fatos, padrões possivelmente aproveitáveis e custos de transplantá-los para PI WEB. Incluir licença e condições de reutilização. Não recomendar copiar monorepo, React ou camadas sem evidência de necessidade. A decisão de arquitetura ficará em ticket humano.
