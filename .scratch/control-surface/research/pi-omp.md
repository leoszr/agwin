# Quais diferenças reais entre Pi e OMP condicionam a integração futura?

Data: 2026-09-11. Pesquisa AFK independente (Etapa F + questões 10–12).
Nenhuma execução visual foi feita (pesquisa de código/docs, sem build, sem rodar produtos).
Nenhum número abaixo foi medido em benchmark; contagens são de arquivos/símbolos no código.

## Revisões consultadas (fontes primárias)

| Projeto | URL | SHA (HEAD em 2026-09-11) |
|---|---|---|
| Pi (`earendil-works/pi`) | https://github.com/earendil-works/pi | `71dca87` (2026-09-11, "fix(ci): Fix a broken test") |
| OMP (`can1357/oh-my-pi`) | https://github.com/can1357/oh-my-pi | `f18f8d7` (2026-09-11, "chore(coding-agent/task)…") |
| PI WEB (`jmfederico/pi-web`) | https://github.com/jmfederico/pi-web | `46579c0` (2026-09-11, "test(sessions): cover preview projection…") |
| Upstream comum | https://github.com/badlogic/pi-mono (Mario Zechner) | marcador histórico citado pelo OMP: `b21b42d` (2026-03-22) |

Documento-chave first-party: `omp/docs/porting-from-pi-mono.md` (guia de porte + §15 "Intentional Divergences",
tabela de divergências assumida pelo próprio OMP). README do OMP (`omp/README.md:22,131,565`)
declara-se "fork of Pi by @mariozechner"; o Pi se apresenta como "Pi Agent Harness"
(`pi/README.md`, pacotes `@earendil-works/*`, site pi.dev).

## TL;DR

1. **Pi e OMP são forks-irmãos do `badlogic/pi-mono`, não versões sucessivas.** Pi segue
   próximo do upstream (0.85.x, Node); OMP divergiu há ~6 meses (último sync 2026-03-22) para
   18.x, Bun, Rust/Python/nativos. Tratar OMP como "Pi mais novo" é o erro central a evitar.
2. **Trocar a dependência não é adapter.** OMP exige Bun (`engines: bun>=1.3.14`, 57 arquivos com
   `bun:` em `coding-agent/src`, `bun:sqlite` na auth), publica fonte TS em vez de `dist`
   (mapa de exports incompatível) e versiona 18.x contra 0.85.x — o `piSdkIntegrity.test.ts`
   do PI WEB falharia em ≥4 pontos antes de qualquer comportamento ser testado.
3. **O acoplamento Pi↔PI WEB é estreito e conhecido.** Só `src/server` (+2 arquivos `shared`
   type-only) importa `@earendil-works/*`: 40 arquivos `pi-coding-agent`, 19 `pi-ai`,
   8 `pi-agent-core`. Browser (`src/client`) importa zero. `sessiond`, terminais, arquivos,
   git e serviços nativos importam zero — são capabilities do **servidor**, não do harness.
4. **Sessões compartilham versão e esqueleto (v3, JSONL por cwd), mas não o resto.**
   Entradas OMP são superconjunto, diretórios-raiz diferem (`~/.pi` vs `~/.omp`),
   storage OMP tem backends extras (sql/redis/blob) e o importador "foreign" do OMP cobre
   só Claude/Codex, não Pi.
5. **O OMP mantém shims de compatibilidade Pi — para extensões legadas, não para hosts.**
   `legacy-pi-coding-agent-shim.ts`, `legacy-pi-ai-shim.ts`, `legacy-pi-tui-shim.ts` e
   `plugins/legacy-pi-compat.ts` reescrevem imports de *plugins*; o próprio guia do OMP diz
   que `SettingsManager`/`DefaultPackageManager`/`DefaultResourceLoader` ali são shims, e a
   arquitetura nativa é capability-based (`loadCapability`), singleton `Settings` e `EventBus`.

## Identidade, versão, licença

| | Pi | OMP | PI WEB |
|---|---|---|---|
| Pacote coding-agent | `@earendil-works/pi-coding-agent` **0.85.1** (`pi/packages/coding-agent/package.json`) | `@oh-my-pi/pi-coding-agent` **18.1.17** (`omp/packages/coding-agent/package.json`) | consome `^0.85.1` + peer `>=0.84.0` exceto `0.85.0` quebrado (`pi-web/package.json:106-140`, `piSdkIntegrity.test.ts`) |
| agent-core / ai | `@earendil-works/*` **0.85.1**, MIT | `@oh-my-pi/*` **18.1.17**, MIT | mesmos pins |
| Runtime | `engines: node>=22.19.0`, **0** imports `bun:` | `engines: bun>=1.3.14`, **57** arquivos com `from "bun…"` em `coding-agent/src`, `packageManager: bun@1.4.0` | `engines: node>=22.19.0`, `packageManager: npm@11.11.0` |
| Licença | MIT © 2025 Mario Zechner (`pi/LICENSE`) | MIT © Zechner + Can Bölük + Stencil Labs (`omp/LICENSE`) | MIT © 2026 Federico Jaramillo Martinez (`pi-web/LICENSE`) |
| Binário | `pi` → `dist/bundle/cli.js` | `omp` → `src/cli.ts` (fonte, Bun) | `pi-web`, `pi-web-server`, `pi-web-sessiond` |

Escala do fork: `coding-agent/src` tem **258** `.ts` no Pi contra **1334** no OMP (~5×).
O OMP soma `crates/` (Rust), `python/`, `packages/natives` (N-API), `collab-web`, `metaharness`.

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
  `setWarnings`, `setUIContext`, `settleWithAnswer/settleWithCancelValue`, `setRebindSession`.
- `defineTool` + `ExtensionContext/ToolDefinition` (tools próprias: `askUserTool`,
  `spawnSessionTool`, `spawnSubsessionTool`), `Theme`, `ProjectTrustStore`,
  `DefaultPackageManager/DefaultResourceLoader`, `resizeImage/formatDimensionNote`,
  `CredentialSynchronizationError`, tipos `AgentEvent/AgentMessage/AgentTool/StreamFn`,
  `Api/AssistantMessage/Message/Model/Provider/Credential/Auth*`, `ThinkingLevel`.
- `InMemoryCredentialStore` aparece **só em testes/testSupport**
  (`sessionModelScope.test.ts`, `piSessionService.testSupport.ts`, `promptQueue.test.ts`,
  `modelCatalog.test.ts`) — produção usa `ModelRuntime.create()`. Nuance: trocar o runtime
  quebra os testes mesmo onde a produção não quebraria.
- `runAgentLoop` idem: só `piSdkIntegrity.test.ts` + 1 teste de integração; produção dirige
  sessões via `AgentSession`, não pelo loop direto.

Onde o Pi **não** entra: `src/client` (zero imports), `src/server/sessiond/`,
`src/server/terminals/`, `src/nativeServices/`, `src/server/workspaceExplorerRoutes.ts`,
`src/server/git/` (zero imports — verificado por grep). **Terminal, files, diff, git,
serviços nativos e sessiond são capabilities do servidor PI WEB**, e o futuro
`AgentRuntime` NÃO deve condicioná-las ao harness (resposta direta à hipótese do brief §3).

## Matriz factual (Etapa F)

### Iguais (nome + forma preservados; comportamento a confirmar por teste)

- `CURRENT_SESSION_VERSION = 3` nos dois (`pi/.../core/session-manager.ts:30`,
  `omp/.../session/session-entries.ts:13`); migrações v1→v2→v3 compartilhadas
  (`omp/.../session-migrations.ts:63-70`).
- Sessão = árvore append-only em **JSONL** sob `<agent>/sessions/<cwd-codificado>/`,
  arquivo `<timestamp>_<id>.jsonl` (Pi: `session-manager.ts:474-480,846,1549`;
  OMP: `session-manager.ts:2818-2843`, `session-paths.ts`).
- Núcleo `AgentEvent`: `agent_start/end`, `turn_start/end`, `message_start/update/end`,
  `tool_execution_start/update/end` idênticos (`pi/packages/agent/src/types.ts:431` vs
  `omp/packages/agent/src/types.ts:893`).
- `createAssistantMessageEventStream` existe nos dois (`packages/ai/src/utils/event-stream.ts`).
- `modelsAreEqual` existe no OMP (reexportado pelo ai-shim; usado em `session/*`, `modes/*`).
- Nomes preservados: `SessionManager`, `Theme`, `defineTool`, `ExtensionContext`,
  `ToolDefinition`, `createAgentSession`, `createCodingTools`, `getSessionsDir`,
  env `PI_CODING_AGENT_DIR` (Pi: `config.ts:502-572`; OMP: `utils/src/dirs.ts`, que ainda
  honra `PI_CODING_AGENT_DIR`/`PI_PROFILE` ao lado de `OMP_PROFILE`/XDG).

### Compatíveis (superconjunto tolerante; consumidor Pi típico continua funcionando)

- `AgentEvent` OMP adiciona: `telemetry/coverage?` em `agent_end`, `intent?` em
  `tool_execution_start`, novo `tool_stream_update`, `isError?` (era obrigatório).
  Switch exaustivo precisa do novo ramo; o resto passa ileso.
- Entradas de sessão OMP = superconjunto (`BranchSummary`, `CredentialPin`, `Custom`,
  `File`, `Label`, `ModeChange`, `ModelUsage`, `ResetBoundary`, `ServiceTierChange`,
  `SessionInit`, `TitleChange`, `TtsrInjection`, `FileMention`, `HookMessage`,
  `PythonExecutionMessage`…). Leitura cruzada Pi→OMP de arquivos v3 puros tende a funcionar;
  o inverso (arquivo OMP com entradas novas lido pelo Pi) **não** foi verificado — sem
  garantia.
- `AgentSession`: `setModel`, `setThinkingLevel`, `getBranch`, `appendCustomEntry`,
  `getSessionFile/Stats` existem no OMP (`session/agent-session.ts`); fork/switch/resume
  existem nos dois lados.
- Ferramentas base `read/bash/edit/write/grep/glob` existem nos dois; aliases OMP
  `search→grep`, `find→glob` (`tools/builtin-names.ts`) cobrem 2 dos 3 nomes legados.
- `Settings.get("extensions")`, `getGlobalSettings()/getProjectSettings()` (deep-clone)
  preservados para extensões (guia §15, issue #10397 citada no shim).

### Adaptáveis (mesma necessidade, forma diferente; adapter resolve com trabalho real)

- **Modelos/auth**: `ModelRuntime` (classe rica Pi: `create({authPath,modelsPath})`,
  `login/logout/refresh/getAvailableSnapshot/hasConfiguredAuth/getApiKey`) some no OMP →
  `ModelRegistry` (`config/model-registry.ts:221`) + `AuthStorage`/`SqliteAuthCredentialStore`
  (reexportado de `@oh-my-pi/pi-ai`). Todo `sessionModelScope.ts` + `authService.ts` precisa de
  re-mapeamento; `auth.json` (proper-lockfile, 1 credencial/provedor) vira `agent.db`
  (bun:sqlite, multi-credencial round-robin + afinidade de sessão). Tabela do próprio OMP
  no guia §15 "Auth Storage".
- **Settings**: classe `SettingsManager` Pi (`settings.json` global + projeto,
  `settings-manager.ts:232-233,358-359`) → singleton assíncrono `Settings` OMP
  (`config.yml/yaml` + overlays, `Settings.init`) + shim síncrono `SettingsManager.create/
  inMemory()` que resolve a instância da sessão ativa. Chamada síncrona fora de sessão
  cai em `Settings.isolated()` — semântica diferente, não só renomeação.
- **Tools como nomes**: `tools?: string[]` existe nos dois, mas o vocabulário mudou
  (Pi: `read,bash,edit,write,grep,find,ls` + `create*Tool(cwd)`; OMP: 27 builtins em
  `BUILTIN_TOOL_NAMES` + 3 ocultos, fábricas `createTools(session: ToolSession)` via
  registro). `ls` não tem alias; `find` virou `glob`; `powershell`, `search` sumiram como
  nomes canônicos. `spawnSessionTool/delegationTools` do PI WEB precisam de re-mapeamento.
- **Sessão em disco**: mesma ideia, raízes diferentes (`~/.pi/agent` vs `~/.omp/agent`,
  `sessions/` + codificação de cwd com escopos home/tmp/abs + migração de era hash no OMP).
  Compartilhar diretório entre runtimes **não** é suportado — adapter teria que isolar ou migrar.
- **ExtensionContext em headless**: OMP mantém o tipo, mas fora do TUI interativo entrega
  stubs no-op (`noOpUIContext` em `session/agent-session.ts:405,6676`; guia §15: `setHeader/
  setFooter/setEditorComponent/addAutocompleteProvider` são no-op em ACP/RPC/headless).
  O PI WEB chama `session.setUIContext(...)` e define tools de interação (`askUserTool`,
  `pendingAskStore`) — sob OMP esse caminho precisaria do `approval.ts`/`ask.ts` nativos
  ou de harness próprio. Comportamento observável muda mesmo com tipos iguais.
- **Schemas de tools**: `typebox` puro não é reescrito para escopo OMP; `StringEnum` saiu do
  `pi-ai` (usar `pi.typebox`/`arktype`); `formatSize` virou `formatBytes` em `pi-utils`
  (guia §3/§15). `askUserTool.ts` (importa `typebox` direto) é exemplo vivo do atrito.

### Específicas do OMP (sem equivalente Pi — viram capabilities anunciadas, nunca default)

Runtime/subagents: `task/` (executor, isolamento, revive, paralelo), `tools/hub/` (+IRC,
jobs, launch, messaging), `async/` (background jobs), `collab/` + `collab-web`,
`advisor/autolearn/autoresearch/hindsight/sharpshooter`. Observabilidade: `stats`,
OpenTelemetry (`telemetry-export*.ts`). Linguagem/IDE: `lsp/` (servidores, diagnósticos,
writethrough, `LspTool`), `dap/` + `debug/` (profiler, remote-debugger, log-viewer),
`eval/{js,py}` (kernels/executores persistentes, `kernel-session-registry`),
`ast-edit/ast-grep`, `computer/`, `browser/`, `exa`, `markit`. Plataforma: `natives`
(N-API) + `crates/` (brush bash embutido, 58 utilitários, ripgrep/glob/find in-process),
`python/robomp`, `browser-relay`, `omptype`, `snapcompact`, `mnemopi`/`memories`,
`capability/` (descoberta nativa), plugins + marketplace, skills, hooks, `modes/rpc`+`acp`,
perfis (`OMP_PROFILE`), XDG, `models.yml` + cache sqlite de modelos, blob store,
storages sql/redis. Docs first-party: `docs/agent-hub.md`, `docs/lsp-config.md`,
`docs/collab.md`, `docs/memory.md`, `docs/mcp-*.md`, etc.

### Específicas do Pi (ausentes ou só-shim no OMP)

`InMemoryCredentialStore` (zero ocorrências em `omp/packages`), `runAgentLoop` (só
`agentLoop/agentLoopContinue/agentLoopDetailed` + classe `Agent`), `ModelRuntime`,
`StringEnum` no `pi-ai`, `formatSize`, `ls`/`find` como tools distintas, `createLsTool/
createFindTool/createPowerShellTool(cwd)`, exports empacotados `./rpc-entry`,
`./client`, `./experimental/plugin`, `footer-data-provider`, `clipboard-image`,
`models.generated.ts` (OMP regenera como `models.json`), teste em vitest pi-web-compatível
(OMP usa `bun:test`).

### Incompatíveis (impedem drop-in; cada uma sozinha já veta "trocar a dependência")

1. **Runtime**: Bun vs Node (engines + 57 arquivos `bun:*` + `bun:sqlite` + `Bun.*` como
   `Bun.SHA256` em `session-paths.ts`, embeds `with {type:"text"}`, `Bun.file`). OMP não
   carrega no processo Node do PI WEB.
2. **Empacotamento**: Pi publica `dist` com 4 subpaths; OMP publica **fonte** com dezenas
   de `./x`→`./src/*.ts`. O teste de integridade do PI WEB falha de cara: `SettingsManager`
   do shim é `object` (exige `function`), `InMemoryCredentialStore` não existe,
   `runAgentLoop` não existe, `ModelRuntime` não existe no barrel nativo.
3. **Versões**: `0.85.1` vs `18.1.17` — nenhum range semver cobre os dois; peer do PI WEB
   (`>=0.84.0 … || >=0.85.1`) exclui 18.x por construção.
4. **Persistência**: `~/.pi` (json) vs `~/.omp` (yml + sqlite + blobs); auth e settings
   não são legíveis cruzados.
5. **Carga de extensões**: `jiti` vs `Bun import()`; manifesto `pkg.pi` vs `pkg.omp`
   (fallback existe, mas é para *plugins*, não para o host).

## Questões abertas do brief

**10. Versionar capabilities (cliente × servidor × Pi × OMP)?**
Hoje o PI WEB já versiona o SDK na marra: pin `^0.85.1` + peer com buraco no `0.85.0` +
`piSdkIntegrity.test.ts` como contrato executável + `VERSION` exportado checado em runtime.
Para o futuro: versionar 3 eixos independentes — (a) protocolo cliente↔servidor (hoje
WebSocket bridge própria, sem esquema versionado visível — lacuna a fechar);
(b) `AgentRuntime` com `capabilities[]` + `runtime.name/version` (o OMP já tem
`capability/` e `session-operations` com fork/resume/fresh como modelo); (c) formato de
sessão (`version: 3` no header — estender, nunca reutilizar). Decisão humana pendente:
onde vive o registro de capabilities (servidor anuncia por ambiente).

**11. Quais APIs do PI WEB precisam de desacoplamento do Pi?**
Exatamente as usadas em produção em `src/server/sessions/`: `createAgentSession` (+
`CreateAgentSessionOptions`: `modelRuntime/resourceLoader/settingsManager/sessionManager/
tools: string[]`), `SessionManager.create/inMemory`, `ModelRuntime` inteira,
`SettingsManager.create`, `DefaultPackageManager/DefaultResourceLoader`,
`defineTool/ExtensionContext`, `Theme`, `ProjectTrustStore`, `AgentSession` (métodos
listados acima), tipos `pi-ai` (auth/modelos). Não precisam: `runAgentLoop`
(só testes), `InMemoryCredentialStore` (só testes), `rpc-entry`/`client` (não usados).
E o ponto arquitetural: terminal/files/diff/git/sessiond **já são** desacoplados —
o desacoplamento é só na camada `sessions/`.

**12. OMP reaproveita grande parte do adapter Pi ou exige implementação independente?**
Independente, com reutilização pontual. Reaproveitável: normalização de `AgentEvent`
base, ciclo `SessionManager` (create/continue/fork por cwd), allowlist de tools por nome
(com mapa `find→glob` etc.), `defineTool/ToolDefinition` via forma do shim, streaming de
mensagens (`createAssistantMessageEventStream`). Independente: autenticação (sqlite
multi-credencial), descoberta de modelos, settings, construção de sessão
(`CreateAgentSessionOptions` sem interseção útil), UI contexts headless, storage, e todo
o entorno Bun/nativo. Estimativa honesta: um "adapter Pi" cobre talvez 30% do caminho
para OMP (conceitos), e 0% como código drop-in. OMP posterior, nunca bloqueador da
primeira entrega Pi — confirmado pelo material.

## Riscos de um adapter (e por que a troca de dependência não prova nada)

1. **Falso-positivo de tipos**: nomes iguais (`SessionManager`, `Theme`, `defineTool`)
   escondem semânticas diferentes (sync vs async, `Settings.isolated()`, stubs no-op).
   Compilar ≠ comportar.
2. **Shim não é contrato de host**: os shims legados existem para *plugins* dentro do
   processo Bun do OMP; consumi-los de fora (Node) herda `bun:sqlite`, `Bun.*`, N-API.
3. **Deriva silenciosa**: último sync upstream→OMP em 2026-03-22; o guia manda *pular*
   features upstream e *preservar* as do fork — a distância só cresce.
4. **Sessões parecem compatíveis e não são**: mesmo `version: 3`, raízes, entradas novas,
   blob-refs e storages alternativos tornam leitura cruzada um projeto de migração,
   não um fallback.
5. **Segurança/auth**: auth multi-credencial com round-robin + `credential_disabled`
   events + `auth-broker-gateway` não tem análogo no Pi; um adapter ingênuo vaza ou
   perde credenciais entre os dois mundos (`auth.json` vs `agent.db` jamais devem ser
   mesclados automaticamente).

## Recomendações (técnicas, não decisões)

- R1. Primeira entrega só Pi; OMP como segundo runtime atrás de `AgentRuntime` com
  capabilities anunciadas (`subagents/hub`, `lsp`, `debugger`, `kernels`, `collab`…).
- R2. Extrair a fronteira em `src/server/sessions/` (o único acoplamento real):
  `createSession`, `modelRegistry`, `settings`, `toolVocabulary`, `uiContext` — terminal/
  files/diff ficam fora do adapter, no servidor.
- R3. Promover `piSdkIntegrity.test.ts` a contrato de runtime: um `runtime-manifest`
  (`name/version/capabilities`) checado em runtime por ambiente (responde Q10).
- R4. Sessões: isolar por runtime (`sessions/<runtime>/…` ou raízes distintas); migração
  Pi→OMP como operação explícita (usar `foreign-session-*` do OMP como modelo), nunca
  leitura cruzada silenciosa.
- R5. Testes novos do PI WEB devem evitar `InMemoryCredentialStore`/`runAgentLoop`
  (usar fakes próprios) para não cimentar a superfície que o adapter vai remover.

## Decisões que ficam com leo (não decidir aqui)

- D1. Formato do `AgentRuntime` e onde o registro de capabilities vive.
- D2. Se `~/.pi` e `~/.omp` coexistem na mesma máquina servidora e quem migra o quê.
- D3. Se OMP roda no mesmo processo Node do servidor (exigiria Bun sidecar — custo
  operacional) ou como ambiente remoto separado (alinhado ao modelo "thread↔ambiente").
- D4. Quais capabilities OMP entram no escopo pós-Phase 8 (hub? lsp? kernels?) e sua
  ordem.

## Limitações e cobertura

- Cobre: Etapa F integral (APIs, comandos/eventos, sessões, extensões, tools,
  modelos/providers, configuração, lifecycle, recursos OMP, subagents/hub, LSP, debugger,
  kernels) + Q10/Q11/Q12, com caminhos `arquivo:linha` e SHAs acima.
- Não cobre com profundidade de implementação: assinaturas completas de
  `CreateAgentSessionOptions` OMP (interface com 60+ campos — lida a cabeça e os grupos),
  catálogo de providers (ambos têm dezenas; OMP adiciona cursor/devin/gitlab-duo/
  antigravity/pi-native — listados por diretório), nem UI TUI (fora do escopo: PI WEB
  não a usa).
- Fontes que falharam e rotas alternativas: `glob`/`read` do harness não enxergavam
  `/tmp` a princípio — contornado com `bash`+`cwd`; nenhum fato depende de fonte única
  indisponível.
- Tudo acima é verificável nos SHAs citados; comportamento em runtime (ex.: ler um
  `session.jsonl` Pi real dentro do OMP) não foi executado — seria o primeiro teste de
  um futuro ticket de spike, não desta pesquisa.
