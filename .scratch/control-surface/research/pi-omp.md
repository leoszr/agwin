# Quais diferenças reais entre Pi e OMP condicionam a integração futura?

Data: 2026-09-11. Pesquisa AFK independente (Etapa F + questões 10–12).
Nenhuma execução visual foi feita (pesquisa de código/docs, sem build, sem rodar produtos).
Nenhum número abaixo foi medido em benchmark; contagens são de arquivos/símbolos no código.
Nada aqui foi executado em runtime: afirmações de (in)compatibilidade são por inspeção
de código/docs nos SHAs citados, e exigem spike executável antes de qualquer decisão.

## Revisões consultadas (fontes primárias, SHAs completos)

| Projeto | HEAD em 2026-09-11 | Links permanentes (amostra central) |
|---|---|---|
| Pi (`earendil-works/pi`) `71dca871bc80b6bc97be37f0ca3189399d651fff` | 2026-09-11, "fix(ci): Fix a broken test" | [coding-agent/package.json](https://github.com/earendil-works/pi/blob/71dca871bc80b6bc97be37f0ca3189399d651fff/packages/coding-agent/package.json), [core/session-manager.ts](https://github.com/earendil-works/pi/blob/71dca871bc80b6bc97be37f0ca3189399d651fff/packages/coding-agent/src/core/session-manager.ts), [agent/src/types.ts](https://github.com/earendil-works/pi/blob/71dca871bc80b6bc97be37f0ca3189399d651fff/packages/agent/src/types.ts), [core/model-runtime.ts](https://github.com/earendil-works/pi/blob/71dca871bc80b6bc97be37f0ca3189399d651fff/packages/coding-agent/src/core/model-runtime.ts) |
| OMP (`can1357/oh-my-pi`) `f18f8d7038c32a0426fadb99079f33f9cef7268c` | 2026-09-11, "chore(coding-agent/task)…" | [porting-from-pi-mono.md](https://github.com/can1357/oh-my-pi/blob/f18f8d7038c32a0426fadb99079f33f9cef7268c/docs/porting-from-pi-mono.md), [legacy-pi-coding-agent-shim.ts](https://github.com/can1357/oh-my-pi/blob/f18f8d7038c32a0426fadb99079f33f9cef7268c/packages/coding-agent/src/extensibility/legacy-pi-coding-agent-shim.ts), [tools/builtin-names.ts](https://github.com/can1357/oh-my-pi/blob/f18f8d7038c32a0426fadb99079f33f9cef7268c/packages/coding-agent/src/tools/builtin-names.ts), [session/session-entries.ts](https://github.com/can1357/oh-my-pi/blob/f18f8d7038c32a0426fadb99079f33f9cef7268c/packages/coding-agent/src/session/session-entries.ts) |
| PI WEB (`jmfederico/pi-web`) `46579c049a305b6a146d1028e539ca6d071fbfb4` | 2026-09-11, "test(sessions): cover preview projection…" | [piSdkIntegrity.test.ts](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/src/server/piSdkIntegrity.test.ts), [piSessionService.ts](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/src/server/sessions/piSessionService.ts) (~4000 linhas), [agentHttpDispatcher.ts](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/src/server/sessiond/agentHttpDispatcher.ts), [package.json](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/package.json) |

Leitura declarada, não genealogia provada: o README do OMP
(`omp/README.md:22,131,565`) declara-se "fork of Pi" (apontando `badlogic/pi-mono`,
de Mario Zechner); o Pi apresenta-se como "Pi Agent Harness" (`pi/README.md`, pacotes
`@earendil-works/*`, site pi.dev). O guia de porte do OMP (`docs/porting-from-pi-mono.md`)
traz um marcador histórico de sync (`b21b42d`, 2026-03-22) que o próprio documento diz
que pode nem existir no object database local — citado aqui como marcador declarado,
não como ponto de sync verificado. A distância entre os dois é evidenciada abaixo por
observáveis (escala, runtime, APIs), sem tese de parentesco.

## TL;DR

1. **OMP não é "Pi mais novo".** Escopos e nomes de pacote distintos
   (`@earendil-works/*` 0.85.1 vs `@oh-my-pi/*` 18.1.17), runtimes distintos (Node vs Bun),
   `coding-agent/src` com 258 vs 1334 `.ts`. Tratar um como continuação do outro é o erro
   central a evitar.
2. **Trocar a dependência não é adapter.** OMP exige Bun (`engines: bun>=1.3.14`,
   57 arquivos com `bun:` em `coding-agent/src`, `bun:sqlite` na auth), publica fonte TS
   em vez de `dist` (mapa de exports incompatível) e expõe APIs nativas diferentes
   (`ModelRegistry+AuthStorage`, `Settings`, fábricas `createTools(session)`). Pela
   inspeção, a superfície OMP é incompatível com as expectativas do
   `piSdkIntegrity.test.ts` do PI WEB em ≥4 pontos — antes de qualquer comportamento
   ser testado. (Nota semver, correção: o peer `>=0.85.1` do PI WEB *admitiria* 18.x se
   os nomes coincidissem; só o caret `^0.85.1` excluiria. O bloqueio real são os nomes
   de pacote distintos + runtime + API — não há "veto semver independente".)
3. **O acoplamento Pi↔PI WEB é conhecido e concentrado — incluindo o daemon.**
   Imports diretos `@earendil-works/*`: `src/server` (+2 arquivos `shared` type-only),
   40 arquivos `pi-coding-agent`, 19 `pi-ai`, 8 `pi-agent-core`. Browser (`src/client`)
   importa zero. Porém o **processo daemon depende do Pi**: `PiSessionService` é composto
   em `src/server/sessiond.ts:189–340` e construído em `sessiond.ts:266` (cruzamento com
   a pesquisa PI WEB), e `src/server/sessiond/agentHttpDispatcher.ts:2` importa
   `SettingsManager` para o "embedded Pi runtime" do daemon. Ou seja: o diretório
   `src/server/sessiond/` (proxies/controle) não é o processo completo — o daemon como
   processo é Pi-acoplado. Terminais, arquivos, git e serviços nativos não têm imports
   diretos (verificado por grep; transitivos não auditados) — são capabilities do
   **servidor**, não do harness. (Contexto da pesquisa irmã: PI WEB referencia sessão
   como `SessionRef={id,cwd}`, sem `session.workspaceId` formal — limite útil ao design.)
4. **Sessões têm mesma versão e esqueleto (v3, JSONL por cwd) — o que não prova
   compatibilidade.** Entradas OMP são superconjunto por inspeção, diretórios-raiz
   diferem (`~/.pi` vs `~/.omp`), storage OMP tem backends extras (sql/redis/blob) e o
   importador "foreign" do OMP cobre só Claude/Codex, não Pi. Leitura cruzada em
   qualquer direção **não foi executada nem verificada** — é hipótese, não fato.
5. **O OMP mantém shims de compatibilidade Pi — para extensões legadas, não para hosts.**
   `legacy-pi-coding-agent-shim.ts`, `legacy-pi-ai-shim.ts`, `legacy-pi-tui-shim.ts` e
   `plugins/legacy-pi-compat.ts` reescrevem imports de *plugins*; o próprio guia do OMP diz
   que `SettingsManager`/`DefaultPackageManager`/`DefaultResourceLoader` ali são shims, e a
   arquitetura nativa é capability-based (`loadCapability`), singleton `Settings` e `EventBus`.

## Identidade, versão, licença

| | Pi | OMP | PI WEB |
|---|---|---|---|
| Pacote coding-agent | `@earendil-works/pi-coding-agent` **0.85.1** (`pi/packages/coding-agent/package.json`) | `@oh-my-pi/pi-coding-agent` **18.1.17** (`omp/packages/coding-agent/package.json`) | deps `^0.85.1` + peer `>=0.84.0` exceto `0.85.0` quebrado (`pi-web/package.json:106-140`, `piSdkIntegrity.test.ts`) |
| agent-core / ai | `@earendil-works/*` **0.85.1**, MIT | `@oh-my-pi/*` **18.1.17**, MIT | mesmos pins |
| Runtime | `engines: node>=22.19.0`, **0** imports `bun:` | `engines: bun>=1.3.14`, **57** arquivos com `from "bun…"` em `coding-agent/src`, `packageManager: bun@1.4.0` | `engines: node>=22.19.0`, `packageManager: npm@11.11.0` |
| Licença | MIT © 2025 Mario Zechner (`pi/LICENSE`) | MIT © Zechner + Can Bölük + Stencil Labs (`omp/LICENSE`) | MIT © 2026 Federico Jaramillo Martinez (`pi-web/LICENSE`) |
| Binário | `pi` → `dist/bundle/cli.js` | `omp` → `src/cli.ts` (fonte, Bun) | `pi-web`, `pi-web-server`, `pi-web-sessiond` |

Escala observada: `coding-agent/src` tem **258** `.ts` no Pi contra **1334** no OMP (~5×).
O OMP soma `crates/` (Rust), `python/`, `packages/natives` (N-API), `collab-web`, `metaharness`.
Pacotes têm nomes distintos, logo ranges semver entre eles são inaplicáveis: não existe
cenário de "resolver OMP via range do Pi".

## O que o PI WEB consome de fato (superfície de contrato)

Fonte normativa: `pi-web/src/server/piSdkIntegrity.test.ts` — o próprio PI WEB lista o que
exige do barrel em runtime:

- `pi-coding-agent` (13, todos `typeof === "function"`): `AgentSession`, `createAgentSession`,
  `CredentialSynchronizationError`, `DefaultPackageManager`, `DefaultResourceLoader`,
  `defineTool`, `formatDimensionNote`, `ModelRuntime`, `ProjectTrustStore`, `resizeImage`,
  `SessionManager`, `SettingsManager`, `Theme` (+ `VERSION` string).
- `pi-ai` (3): `createAssistantMessageEventStream`, `InMemoryCredentialStore`, `modelsAreEqual`.
- `pi-agent-core` (1): `runAgentLoop`.

Censo de imports confirma o uso em produção (`pi-web/src`, sem testes):

- `ModelRuntime`: `SessionManager/ProjectTrustStore/SettingsManager` (construção e sessão em
  `piSessionService.ts`, `sessionModelScope.ts`, `authService.ts`); métodos chamados no
  `session.modelRuntime`: `refresh({allowNetwork:false})`, `getAvailableSnapshot()`,
  `getModel(p, id)`, `hasConfiguredAuth(p)`, `login()/logout()` (via `authService.ts:36-66`,
  que ancora comportamento no "Pi 0.84 … local-only").
- `AgentSession` (via `createAgentSession`): `set/getModel`, `setThinkingLevel`,
  `setDefaultModelAndProvider`, `setDefaultThinkingLevel`, `setEnabledModels`, `setScopedModels`,
  `getBranch`, `getCwd`, `getSessionId/getSessionFile/getSessionStats`, `appendCustomEntry`,
  `setWarnings`, `bindExtensions({uiContext, mode:"rpc"})`,
  `extensionRunner.setUIContext(ctx, "rpc")`,
  `settleWithAnswer/settleWithCancelValue`, `setRebindSession`.
- Ligação headless real (verificada semanticamente, não só nomes): `bindSessionExtensions`
  (`piSessionService.ts:3637-3663`) chama `session.bindExtensions({uiContext, mode:"rpc"})`
  (Pi: `agent-session.ts:2468`); `sessionUiContext` (3666+) é um `Proxy` sobre o contexto
  headless do Pi que o PI WEB possui no browser: `notify`/`confirm`/`select`/`input`
  viram diálogos respondidos pelo browser (`openExtensionDialog`), `theme` vira
  `plainTextTheme`, o resto delega aos defaults headless do Pi "so unsupported surfaces
  cancel safely instead of hanging". `select` do Pi: `(title, options: string[])`.
- `defineTool` + `ExtensionContext/ToolDefinition` (tools próprias: `askUserTool`
  (tool `ask_user`), `spawnSessionTool`, `spawnSubsessionTool`), `Theme`, `ProjectTrustStore`,
  `DefaultPackageManager/DefaultResourceLoader`, `resizeImage/formatDimensionNote`,
  `CredentialSynchronizationError`, tipos `AgentEvent/AgentMessage/AgentTool/StreamFn`,
  `Api/AssistantMessage/Message/Model/Provider/Credential/Auth*`, `ThinkingLevel`.
- Nomes literais de tools em produção (só `src/server/sessions/*.ts` não-teste, por grep):
  `read`×2, `bash`×1, `ask_user`×1. Menções a `ls`/`edit`/`write` aparecem nos arquivos
  de teste do próprio PI WEB — não em produção. (Correção de levantamento anterior.)
- `InMemoryCredentialStore` aparece **só em testes/testSupport**
  (`sessionModelScope.test.ts`, `piSessionService.testSupport.ts`, `promptQueue.test.ts`,
  `modelCatalog.test.ts`) — produção usa `ModelRuntime.create()`; pela inspeção, esses
  arquivos de teste usam um símbolo ausente no OMP.
- `runAgentLoop` idem: só `piSdkIntegrity.test.ts` + 1 teste de integração; produção dirige
  sessões via `AgentSession`, não pelo loop direto.

Onde o Pi **não aparece em imports diretos** (grep; transitivos não auditados):
`src/client` (zero), `src/server/terminals/`, `src/nativeServices/`,
`src/server/workspaceExplorerRoutes.ts`, `src/server/git/`. Onde **aparece dentro do
daemon**: `src/server/sessiond.ts:266` (constrói `PiSessionService`),
`src/server/sessiond.ts:189–340` (compõe service + runtime, cf. pesquisa PI WEB),
`src/server/sessiond/agentHttpDispatcher.ts:2` (`SettingsManager` para timeouts HTTP do
runtime embarcado). Conclusão qualificada: o daemon como **processo** depende do Pi;
o diretório `src/server/sessiond/` (proxies/controle) majoritariamente não importa Pi
direto. Terminal/files/diff/git seguem capabilities do servidor — o futuro `AgentRuntime`
não deve condicioná-las ao harness (resposta à hipótese do brief §3) — com a ressalva
de que a fronteira exata do daemon (o que é framework vs worker Pi) não foi auditada
até dependências transitivas.

## Matriz factual (Etapa F)

Convenção desta matriz (correção metodológica): "mesmo nome" ≠ "mesmo comportamento".
Itens em "Iguais/Compatíveis" significam mesma forma por inspeção e são **candidatos** a
reaproveitamento — cada um exige teste executável antes de virar premissa de design.

### Iguais por inspeção (nome + forma; comportamento não verificado em runtime)

- `CURRENT_SESSION_VERSION = 3` nos dois (`pi/.../core/session-manager.ts:30`,
  `omp/.../session/session-entries.ts:13`); migrações v1→v2→v3 com mesmos nomes
  (`omp/.../session-migrations.ts:63-70`).
- Sessão = árvore append-only em **JSONL** sob `<agent>/sessions/<cwd-codificado>/`,
  arquivo `<timestamp>_<id>.jsonl` (Pi: `session-manager.ts:474-480,846,1549`;
  OMP: `session-manager.ts:2818-2843`, `session-paths.ts`).
- Núcleo `AgentEvent`: `agent_start/end`, `turn_start/end`, `message_start/update/end`,
  `tool_execution_start/update/end` com mesmos nomes
  (`pi/packages/agent/src/types.ts:431` vs `omp/packages/agent/src/types.ts:893`).
- `createAssistantMessageEventStream` existe nos dois (`packages/ai/src/utils/event-stream.ts`).
- `modelsAreEqual` existe no OMP (reexportado pelo ai-shim; usado em `session/*`, `modes/*`).
- Nomes preservados: `SessionManager`, `Theme`, `defineTool`, `ExtensionContext`,
  `ToolDefinition`, `createAgentSession`, `createCodingTools`, `getSessionsDir`,
  env `PI_CODING_AGENT_DIR` (Pi: `config.ts:502-572`; OMP: `utils/src/dirs.ts`, que ainda
  honra `PI_CODING_AGENT_DIR`/`PI_PROFILE` ao lado de `OMP_PROFILE`/XDG).

### Aparentemente compatíveis por inspeção (superconjunto NÃO prova compatibilidade)

- `AgentEvent` OMP adiciona: `telemetry/coverage?` em `agent_end`, `intent?` em
  `tool_execution_start`, novo `tool_stream_update`, e `isError?` opcional onde o Pi
  exige `isError`. Ou seja: o superconjunto quebra consumidores que dependem do campo
  antes obrigatório (ex.: checagem estrita de `isError: boolean`) e switch exaustivo
  precisa do novo ramo. Transcrição Pi→OMP dos ramos comuns é plausível; não provada.
- Entradas de sessão OMP = superconjunto por inspeção (`BranchSummary`, `CredentialPin`,
  `Custom`, `File`, `Label`, `ModeChange`, `ModelUsage`, `ResetBoundary`,
  `ServiceTierChange`, `SessionInit`, `TitleChange`, `TtsrInjection`, `FileMention`,
  `HookMessage`, `PythonExecutionMessage`…). Nenhuma direção de leitura cruzada foi
  executada: arquivo OMP com entradas novas lido pelo Pi, e arquivo Pi lido pelo OMP,
  são ambos **não verificados**.
- `AgentSession`: `setModel`, `setThinkingLevel`, `getBranch`, `appendCustomEntry`,
  `getSessionFile/Stats` têm nomes correspondentes no OMP (`session/agent-session.ts`);
  fork/switch/resume existem nos dois lados por nome. Semântica igual não demonstrada.
- Ferramentas base: Pi tem `read/bash/edit/write/grep/find/ls` (arquivos em
  `core/tools/`, sem `glob.ts`); OMP tem `glob` canônico + aliases `search→grep`,
  `find→glob` (`tools/builtin-names.ts`), sem `ls`. Cobertura por nome: parcial.
- `Settings.get("extensions")`, `getGlobalSettings()/getProjectSettings()` (deep-clone)
  preservados para extensões (guia §15, issue #10397 citada no shim) — escopo: extensões,
  não hosts.

### Adaptáveis (mesma necessidade, forma diferente; porte semântico necessário)

- **Modelos/auth**: `ModelRuntime` (classe Pi: `create({authPath,modelsPath})`,
  `login/logout/refresh/getAvailableSnapshot/hasConfiguredAuth/getApiKey`) sem
  correspondente nominal no OMP → `ModelRegistry` (`config/model-registry.ts:221`) +
  `AuthStorage`/`SqliteAuthCredentialStore` (reexportado de `@oh-my-pi/pi-ai`).
  `sessionModelScope.ts` + `authService.ts` exigiriam re-mapeamento; `auth.json`
  (proper-lockfile, 1 credencial/provedor) vs `agent.db` (bun:sqlite, multi-credencial
  round-robin + afinidade de sessão). Tabela do próprio OMP no guia §15 "Auth Storage".
- **Settings**: classe `SettingsManager` Pi (`settings.json` global + projeto,
  `settings-manager.ts:232-233,358-359`) vs singleton assíncrono `Settings` OMP
  (`config.yml/yaml` + overlays, `Settings.init`) + shim síncrono `SettingsManager.create/
  inMemory()` que resolve a instância da sessão ativa. Chamada síncrona fora de sessão
  cai em `Settings.isolated()` — semântica diferente, não só renomeação. O daemon do
  PI WEB ainda usa `SettingsManager.create(cwd, agentDir).getHttpIdleTimeoutMs()`
  (`agentHttpDispatcher.ts:52`) — esse ponto de acoplamento é concreto e atual.
- **Tools como nomes**: `tools?: string[]` existe nos dois, mas o vocabulário canônico
  mudou (Pi: `read,bash,edit,write,grep,find,ls` + `create*Tool(cwd)`; OMP: 27 builtins em
  `BUILTIN_TOOL_NAMES` + 3 ocultos, fábricas `createTools(session: ToolSession)` via
  registro). `ls` não tem alias; `find` virou `glob`; `powershell`, `search` sumiram como
  nomes canônicos. Produção do PI WEB referencia literalmente `read/bash/ask_user`
  (pouco atrito); testes referenciam `ls/edit/write` (atrito de porte de testes, não
  de runtime).
- **Sessão em disco**: mesma ideia, raízes diferentes (`~/.pi/agent` vs `~/.omp/agent`,
  `sessions/` + codificação de cwd com escopos home/tmp/abs + migração de era hash no OMP).
  Compartilhar diretório entre runtimes **não** tem suporte evidenciado — isolar ou
  migrar explicitamente é o caminho verificável.
- **ExtensionContext em headless** (semântica verificada, mecanismo diferente):
  Pi oferece `bindExtensions({uiContext, mode:"rpc"})` (`agent-session.ts:2468`) e o
  PI WEB injeta um `Proxy` com `select(title, options: string[])`.
  OMP **não** tem `bindExtensions` (zero ocorrências em `session/agent-session.ts` e
  `extensions/runner.ts`); o contexto trafega por `toolContextStore.setUIContext(uiContext,
  hasUI)` (`sdk.ts:3474`) e pelo hook `setToolUIContext` do rpc-mode
  (`modes/rpc/rpc-mode.ts:798,1053-1071`), com `hasUI()` distinguindo
  `noOpUIContext` (`extensions/runner.ts:877-885`). A interface OMP é mais larga:
  `select(title, options: ExtensionUISelectItem[])`, mais `askDialog?`,
  `setFooter/setHeader/setTitle`, `timeoutStartsOnPresentation`. Ou seja: injeção de UI
  pelo host é prevista nos dois (Pi também tem rpc + `experimental/session-worker`
  headless — nada aqui é privilégio OMP), mas o `Proxy` atual do PI WEB (`string[]`)
  não encaixa no `select` do OMP sem porte, e `setUIContext(ctx, "rpc")` do runner não
  tem correspondente nominal. Afirmação anterior corrigida: não se afirma que o caminho
  "exigiria ask/approval nativos" — o `noOpUIContext` é default, não prova de
  impossibilidade; o que se afirma é só a diferença verificada de mecanismo + assinatura.
- **Schemas de tools**: `typebox` puro não é reescrito para escopo OMP; `StringEnum` saiu do
  `pi-ai` (usar `pi.typebox`/`arktype`); `formatSize` virou `formatBytes` em `pi-utils`
  (guia §3/§15). `askUserTool.ts` (importa `typebox` direto) é exemplo vivo do atrito.

### Específicas do OMP (sem equivalente Pi encontrado — candidatas a capabilities, nunca default)

Runtime/subagents: `task/` (executor, isolamento, revive, paralelo), `tools/hub/` (+IRC,
jobs, launch, messaging), `async/` (background jobs), `collab/` + `collab-web`,
`advisor/autolearn/autoresearch/hindsight/sharpshooter`. Observabilidade: `stats`,
OpenTelemetry (`telemetry-export*.ts`). Linguagem/IDE: `lsp/` (servidores, diagnósticos,
writethrough, `LspTool`), `dap/` + `debug/` (profiler, remote-debugger, log-viewer),
`eval/{js,py}` (kernels/executores, `kernel-session-registry`),
`ast-edit/ast-grep`, `computer/`, `browser/`, `exa`, `markit`. Plataforma: `natives`
(N-API) + `crates/` (brush bash embutido, 58 utilitários, ripgrep/glob/find in-process),
`python/robomp`, `browser-relay`, `omptype`, `snapcompact`, `mnemopi`/`memories`,
`capability/` (descoberta nativa), plugins + marketplace, skills, hooks, `modes/rpc`+`acp`,
perfis (`OMP_PROFILE`), XDG, `models.yml` + cache sqlite de modelos, blob store,
storages sql/redis. Docs first-party: `docs/agent-hub.md`, `docs/lsp-config.md`,
`docs/collab.md`, `docs/memory.md`, `docs/mcp-*.md`, etc.

### Específicas do Pi (ausentes ou só-shim no OMP, por inspeção)

`InMemoryCredentialStore` (zero ocorrências em `omp/packages`), `runAgentLoop` (só
`agentLoop/agentLoopContinue/agentLoopDetailed` + classe `Agent`), `ModelRuntime`,
`bindExtensions`, `StringEnum` no `pi-ai`, `formatSize`, `ls`/`find` como tools distintas,
`createLsTool/createFindTool/createPowerShellTool(cwd)`, exports empacotados `./rpc-entry`,
`./client`, `./experimental/plugin`, `footer-data-provider`, `clipboard-image`,
`models.generated.ts` (OMP regenera como `models.json`), teste em vitest pi-web-compatível
(OMP usa `bun:test`).

### Incompatíveis com drop-in (por inspeção; cada uma exige camada própria)

1. **Runtime**: Bun vs Node (engines + 57 arquivos `bun:*` + `bun:sqlite` + `Bun.*` como
   `Bun.SHA256` em `session-paths.ts`, embeds `with {type:"text"}`, `Bun.file`). OMP não
   carrega no processo Node do PI WEB por inspeção das imports.
2. **Empacotamento**: Pi publica `dist` com 4 subpaths; OMP publica **fonte** com dezenas
   de `./x`→`./src/*.ts`. Pela inspeção, a superfície OMP é incompatível com as
   expectativas do teste de integridade do PI WEB em 4 pontos: `SettingsManager` do shim
   é `object` (o teste exige `function`), `InMemoryCredentialStore` ausente,
   `runAgentLoop` ausente, `ModelRuntime` ausente do barrel nativo. (Não executado.)
3. **Persistência**: `~/.pi` (json) vs `~/.omp` (yml + sqlite + blobs); auth e settings
   não são legíveis cruzados por inspeção dos formatos.
4. **Carga de extensões**: `jiti` vs `Bun import()`; manifesto `pkg.pi` vs `pkg.omp`
   (fallback existe, mas é para *plugins*, não para o host).

## Questões abertas do brief

**10. Versionar capabilities (cliente × servidor × Pi × OMP)?**
Hoje o PI WEB ancora o SDK em: pin `^0.85.1` + peer com buraco no `0.85.0` +
`piSdkIntegrity.test.ts` como contrato executável + `VERSION` exportado checado em runtime.
Dimensões de design levantadas (não prescritas): (a) protocolo cliente↔servidor (hoje
WebSocket bridge própria, sem esquema versionado visível — lacuna a fechar);
(b) `AgentRuntime` com `capabilities[]` + `runtime.name/version` (o OMP já tem
`capability/` e operações fork/resume/fresh como modelo); (c) formato de
sessão (`version: 3` no header — estender, nunca reutilizar). Em aberto para leo:
onde vive o registro de capabilities (servidor anuncia por ambiente).

**11. Quais APIs do PI WEB precisam de desacoplamento do Pi?**
Em produção: `src/server/sessions/` inteira (`createAgentSession` e
`CreateAgentSessionOptions`: `modelRuntime/resourceLoader/settingsManager/sessionManager/
tools: string[]`; `SessionManager.create/inMemory`; `ModelRuntime`; `SettingsManager.create`
— incluindo o uso no daemon `agentHttpDispatcher.ts:52`; `DefaultPackageManager/
DefaultResourceLoader`; `defineTool/ExtensionContext` + mecanismo `bindExtensions`/
`extensionRunner.setUIContext`; `Theme`; `ProjectTrustStore`; métodos de `AgentSession`
listados acima; tipos `pi-ai` de auth/modelos) **mais** o acoplamento do processo daemon
(`src/server/sessiond.ts:189–340,266`: composição/construção do `PiSessionService` com
runtime) e os imports type-only em `src/shared`. Fora do desacoplamento: `runAgentLoop`
(só testes), `InMemoryCredentialStore` (só testes), `rpc-entry`/`client` (não usados).
E o ponto arquitetural qualificado: terminal/files/diff/git **não têm imports diretos**
do Pi (transitivos não auditados) — o desacoplamento de runtime é na camada
`sessions/` + daemon, não nessas superfícies.

**12. OMP reaproveita grande parte do adapter Pi ou exige implementação independente?**
Implementação independente, com reutilização pontual de conceitos (sem quantificação —
não há método honesto para percentuais aqui). Candidatos a reaproveitamento: normalização
do núcleo `AgentEvent`, ciclo `SessionManager` (create/continue/fork por cwd), allowlist
de tools por nome (com mapa `find→glob` etc.), forma `defineTool/ToolDefinition`,
streaming de mensagens (`createAssistantMessageEventStream`). Independente por inspeção:
autenticação (sqlite multi-credencial), descoberta de modelos, settings, construção de
sessão (`CreateAgentSessionOptions` sem interseção útil apurada), binding de UI headless,
storage e todo o entorno Bun/nativo. OMP posterior, nunca bloqueador da primeira
entrega Pi — confirmado pelo material.

## Riscos de um adapter (e por que a troca de dependência não prova nada)

1. **Falso-positivo de tipos**: nomes iguais (`SessionManager`, `Theme`, `defineTool`)
   escondem semânticas diferentes (sync vs async, `Settings.isolated()`, contextos no-op).
   Compilar ≠ comportar — nenhum item da matriz dispensa teste executável.
2. **Shim não é contrato de host**: os shims legados existem para *plugins* dentro do
   processo Bun do OMP; consumi-los de fora (Node) herda `bun:sqlite`, `Bun.*`, N-API
   por inspeção das imports.
3. **Deriva**: o guia do OMP manda *pular* features upstream e *preservar* as do fork
   (§15 "Skip These Upstream Features" / "Features We Added") — a distância tende a
   crescer; o marcador histórico de sync citado acima não é base para datar a deriva.
4. **Sessões**: mesma `version: 3` não prova compatibilidade; raízes, entradas novas,
   blob-refs e storages alternativos fazem da leitura cruzada uma hipótese não
   verificada — tratá-la como migração explícita é a posição segura, não um fato.
5. **Segurança/auth**: auth multi-credencial com round-robin + `credential_disabled`
   events + `auth-broker-gateway` não tem análogo no Pi por inspeção; `auth.json` vs
   `agent.db` jamais deveriam ser mesclados automaticamente (posição de segurança, não
   fato observado).

## Recomendações (técnicas, não decisões)

- R1. Primeira entrega só Pi; OMP como segundo runtime atrás de `AgentRuntime` com
  capabilities anunciadas (`subagents/hub`, `lsp`, `debugger`, `kernels`, `collab`…).
- R2. Fronteira de design na camada `sessions/` + processo daemon (o acoplamento
  apurado): `createSession`, `modelRegistry`, `settings`, `toolVocabulary`, `uiContext` —
  terminal/files/diff ficam fora, no servidor. Dimensões, não implementação.
- R3. Para Q10: três eixos de versão independentes (protocolo cliente↔servidor,
  `runtime.name/version/capabilities`, formato de sessão) como insumo ao desenho do
  contrato — sem prescrever onde implementar agora.
- R4. Para sessões: isolamento por runtime e migração explícita como opções de design
  (o `foreign-session-*` do OMP serve de modelo de operação), nunca leitura cruzada
  silenciosa como default.

## Decisões que ficam com leo (não decidir aqui)

- D1. Formato do `AgentRuntime` e onde o registro de capabilities vive.
- D2. Se `~/.pi` e `~/.omp` coexistem na mesma máquina servidora e quem migra o quê.
- D3. Topologia do OMP (corrigida): Bun nunca roda *dentro* do processo Node — as
  opções são (a) processo Bun separado (sidecar) **no mesmo servidor/ambiente**,
  conversando com o servidor Node, ou (b) OMP como ambiente/servidor separado.
  Runtime Bun não força, por si só, a escolha (b) nem a separa dela.
- D4. Quais capabilities OMP entram no escopo pós-Phase 8 (hub? lsp? kernels?) e sua
  ordem.

## Limitações e cobertura

- Cobre: Etapa F integral (APIs, comandos/eventos, sessões, extensões, tools,
  modelos/providers, configuração, lifecycle, recursos OMP, subagents/hub, LSP, debugger,
  kernels) + Q10/Q11/Q12, com caminhos `arquivo:linha`, SHAs completos e URLs
  permanentes na tabela de revisões.
- Não cobre com profundidade de implementação: assinaturas completas de
  `CreateAgentSessionOptions` OMP (interface com 60+ campos — lida a cabeça e os grupos),
  catálogo de providers (ambos têm dezenas; OMP adiciona cursor/devin/gitlab-duo/
  antigravity/pi-native — listados por diretório), nem UI TUI (fora do escopo: PI WEB
  não a usa).
- Dependências transitivas do PI WEB sobre o Pi (o que `dist/` puxa para dentro do
  daemon) não foram auditadas — só imports diretos por grep.
- Correções incorporadas após revisão do coordenador: semver (peer `>=0.85.1` admitiria
  18.x se nomes coincidissem — sem veto independente), sem tese de parentesco além da
  declarada, sem percentuais, superconjunto≠compatível, vocabulário de tools corrigido
  (Pi tem `find`/`ls`, sem `glob`; produção referencia `read/bash/ask_user`), mecanismo
  headless verificado (`bindExtensions` vs seams OMP), acoplamento do daemon incluído,
  linguagem de teste ("pela inspeção", nunca "falhou"), D3 topologicamente correto.
- Tudo acima é verificável nos SHAs citados; comportamento em runtime (ex.: ler um
  `session.jsonl` Pi real dentro do OMP) não foi executado — seria o primeiro teste de
  um futuro ticket de spike, não desta pesquisa.
