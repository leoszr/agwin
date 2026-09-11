# Quais diferenças reais entre Pi e OMP condicionam a integração futura?

Type: research
Labels: wayfinder:research
Mode: AFK
Status: resolved
Assignee: leo
Parent: ../map.md
Blocked by:
Research branch: research/pi-omp
Research asset: [Evidências — Quais diferenças reais entre Pi e OMP condicionam a integração futura?](../research/pi-omp.md)

## Question

Comparar `earendil-works/pi` e `can1357/oh-my-pi`, especialmente coding-agent, com os usos efetivos de Pi em `jmfederico/pi-web`. Trabalhar de forma independente: consultar os três códigos, sem esperar outra pesquisa.

Cobrir a Etapa F e questões abertas 10, 11 e 12: APIs, comandos/eventos, formatos de sessão, extensões, tools, modelos/providers, configuração, lifecycle, recursos próprios do OMP, subagents/hub, LSP, debugger e kernels persistentes quando existirem na revisão.

Classificar APIs relevantes em iguais, compatíveis, adaptáveis, específicas e incompatíveis, com evidência. Separar capability do servidor/plataforma de capability do runtime: terminal/files/diff não devem ser atribuídos automaticamente ao harness. Indicar riscos de reaproveitar um adapter e por que trocar dependências não prova compatibilidade.

Verificar nomes reais de pacotes, versões e licenças. Produzir matriz factual e pontos que exigem decisão; não construir adapter nem transformar OMP em bloqueador da primeira entrega Pi.

## Comments

Resolved 2026-09-11 — pesquisa AFK independente concluída contra HEADs do dia
(pi `71dca87`, omp `f18f8d7`, pi-web `46579c0`). Achado central: Pi e OMP são
forks-irmãos do `badlogic/pi-mono` (sync OMP→upstream parado em 2026-03-22), não
versões sucessivas — OMP (18.x, Bun, `bun:sqlite`, exports de fonte) não é drop-in
para o Pi (0.85.x, Node, `dist`) que o PI WEB consome só em `src/server`.
Evidência completa em `../research/pi-omp.md`.

## Answer

Pi (`@earendil-works/*` 0.85.1, Node, MIT) e OMP (`@oh-my-pi/*` 18.1.17, Bun, MIT)
são forks-irmãos do `badlogic/pi-mono` com ~6 meses de deriva (1334 vs 258 arquivos
em `coding-agent/src`). Iguais: `CURRENT_SESSION_VERSION = 3`, JSONL append-only por
cwd, núcleo `AgentEvent`, `createAssistantMessageEventStream`, nomes
`SessionManager/Theme/defineTool/createAgentSession`. Compatíveis (superconjunto OMP):
eventos com `telemetry/intent/tool_stream_update`, entradas de sessão extras, aliases
`find→glob`/`search→grep`. Adaptáveis: `ModelRuntime→ModelRegistry+AuthStorage`
(`auth.json`→`agent.db`/bun:sqlite), `SettingsManager→Settings` (`settings.json`→
`config.yml`), vocabulário de tools, `ExtensionContext` com stubs no-op em headless.
Específico OMP (capabilities futuras): `task`/subagents+`hub`, `lsp`, `dap`/`debug`,
kernels `eval/{js,py}`, collab, memories, capability system, nativos Rust/N-API.
Incompatíveis para drop-in: runtime Bun vs Node, `dist` vs exports de fonte (o
`piSdkIntegrity.test.ts` falha: `SettingsManager` shim é objeto, faltam
`InMemoryCredentialStore`/`runAgentLoop`/`ModelRuntime`), semver 0.x vs 18.x, e
persistência `~/.pi` vs `~/.omp`. Terminal/files/diff/git/sessiond do PI WEB não
importam Pi — são do servidor, fora do futuro adapter. OMP exige implementação
independente atrás de `AgentRuntime` com capabilities, nunca bloqueador do Pi.
Relatório: [Evidências — Quais diferenças reais entre Pi e OMP condicionam a
integração futura?](../research/pi-omp.md).
