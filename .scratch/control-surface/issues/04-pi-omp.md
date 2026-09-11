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
(pi `71dca87`, omp `f18f8d7`, pi-web `46579c0`). Achado central: OMP declara-se fork
do Pi mas diverge em escopo de pacote (`@oh-my-pi/*` 18.x vs `@earendil-works/*`
0.85.x), runtime (Bun vs Node) e APIs nativas — não é drop-in para o Pi que o PI WEB
consome em `src/server` e no processo daemon. Revisado após feedback do coordenador
(semver, genealogia, semântica headless, acoplamento do daemon).
Evidência completa em `../research/pi-omp.md`.
## Answer

Pi (`@earendil-works/*` 0.85.1, Node, MIT) e OMP (`@oh-my-pi/*` 18.1.17, Bun, MIT;
OMP declara-se fork do Pi de Mario Zechner) têm pacotes, runtimes e APIs distintos:
`coding-agent/src` com 258 vs 1334 arquivos. Iguais por inspeção: `SESSION_VERSION = 3`,
JSONL append-only por cwd, núcleo `AgentEvent`, `createAssistantMessageEventStream`,
nomes `SessionManager/Theme/defineTool/createAgentSession` (mesmo nome ≠ mesmo
comportamento — exige spike). Superconjunto OMP não prova compatibilidade (ex.:
`isError` virou opcional; leitura cruzada de sessões não verificada). Adaptáveis:
`ModelRuntime→ModelRegistry+AuthStorage` (`auth.json`→`agent.db`/bun:sqlite),
`SettingsManager→Settings` (`settings.json`→`config.yml`), vocabulário de tools (Pi
tem `find`/`ls` sem `glob`; OMP tem `glob` canônico), binding headless
(`bindExtensions`+`select(string[])` vs seams OMP sem `bindExtensions` e
`select(ExtensionUISelectItem[])`). Específico OMP (capabilities futuras): `task`/
subagents+`hub`, `lsp`, `dap`/`debug`, kernels `eval/{js,py}`, collab, memories,
nativos. Incompatíveis com drop-in por inspeção: runtime Bun vs Node, `dist` vs
exports de fonte (superfície OMP incompatível com as expectativas do
`piSdkIntegrity.test.ts` em 4 pontos, não executado), persistência `~/.pi` vs
`~/.omp` (nota: peer `>=0.85.1` admitiria 18.x se os nomes coincidissem — sem veto
semver independente). O daemon do PI WEB depende do Pi (`PiSessionService` composto
em `sessiond.ts:189–340,266`; `agentHttpDispatcher.ts` usa `SettingsManager`);
terminal/files/diff/git não têm imports diretos (transitivos não auditados) e ficam
fora do futuro adapter. OMP exige implementação independente atrás de `AgentRuntime`
com capabilities, nunca bloqueador do Pi.
Relatório: [Evidências — Quais diferenças reais entre Pi e OMP condicionam a
integração futura?](../research/pi-omp.md).
