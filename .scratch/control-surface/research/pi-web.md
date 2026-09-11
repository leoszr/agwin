# Evidências — O que o PI WEB já resolve e onde estão seus acoplamentos?

**Pergunta investigada:** quais partes de `jmfederico/pi-web` podem ser preservadas ou extraídas sem reescrever a infraestrutura madura?

## Escopo, revisão e fontes

A revisão do PI WEB foi fixada em commit [`46579c049a305b6a146d1028e539ca6d071fbfb4`](https://github.com/jmfederico/pi-web/tree/46579c049a305b6a146d1028e539ca6d071fbfb4), 2026-09-11 (`test(sessions): cover preview projection and archive preservation`). As URLs desta nota usam esse SHA, salvo onde indicado. Linhas referem-se à revisão consultada. A inspeção foi estática; nenhum servidor, navegador ou painel foi executado visualmente.

Fontes primárias adicionais:

* [PI WEB `package.json`](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/package.json) e [`LICENSE`](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/LICENSE).
* [Pi upstream `packages/coding-agent/package.json`](https://github.com/earendil-works/pi/blob/71dca871bc80b6bc97be37f0ca3189399d651fff/packages/coding-agent/package.json), revisão `71dca871bc80b6bc97be37f0ca3189399d651fff`, linhas 1–12: identidade `@earendil-works/pi-coding-agent`, versão 0.85.1 e entrada principal.
* [Pi upstream `LICENSE`](https://github.com/earendil-works/pi/blob/71dca871bc80b6bc97be37f0ca3189399d651fff/LICENSE), mesma revisão, linhas 1–5: declara MIT e copyright Mario Zechner (2025).
## Resposta curta

O PI WEB já tem uma fronteira operacional correta para preservar: o processo Web/API é uma borda HTTP/WebSocket e o `sessiond` é um daemon separado que possui sessões ativas, arquivos de sessão, projetos, máquinas, estados de unread/archive, plugins de servidor e terminais. O `sessiond` normaliza a configuração do agente no ambiente dos processos filhos, reivindica posse exclusiva do diretório de estado e pode sobreviver à reinicialização da UI/API. O servidor encaminha `/api` para o daemon por socket Unix por padrão (ou HTTP TCP configurado), e máquinas remotas são proxies autenticados pelo servidor.

A maior parte do backend maduro pode ser mantida atrás de uma fronteira futura de servidor/protocolo: `SessionEventHub`, `SessionDaemonClient`, `ProjectService/ProjectStore`, `WorkspaceProviderRegistry`, `MachineService`, serviços de arquivos, git, terminal e as APIs compartilhadas. O frontend já contém componentes Lit separados e contribuições de plugins, mas `PiWebApp` ainda é o compositor e dono de quase todo o estado, navegação, registro de plugins, contexto de workspace, seleção de painel e layout fixo. Portanto, esses componentes são bons candidatos a painéis somente depois de extrair contexto/estado do app; não são módulos independentes prontos para serem remontados.

O acoplamento de runtime é real e concentrado principalmente em `src/server/sessions/` e serviços Pi auxiliares: o código de sessão importa `@earendil-works/pi-coding-agent`, `@earendil-works/pi-agent-core` e `@earendil-works/pi-ai`; usa `SessionManager`, `SettingsManager`, criação de sessões, trust, modelos, credenciais, ferramentas, temas de texto e recursos de imagem. O navegador não importa Pi. O nome informado no brief corresponde ao pacote real no commit examinado: `@earendil-works/pi-coding-agent` (dependência runtime na linha 108 e peer dependency na linha 140 de `package.json`); não há evidência nesta revisão de uma abstração `AgentRuntime`.

## Mapa factual da arquitetura atual

```text
                     systemd user service / LaunchAgent
                              │
               ┌──────────────┴──────────────┐
               │                             │
       pi-web-server (Web/API)       pi-web-sessiond (daemon)
               │                             │
       static Vite client              Fastify + websocket
               │                             │
 Browser ─ HTTP/WS ─┘       Unix socket (default) / TCP (optional)
               │                             │
       SessionDaemonClient ─────── Session daemon routes
                                             │
               ┌─────────────────────────────┼───────────────────────┐
               │                             │                       │
         PiSessionService               ProjectStore          plugin runtime
               │                             │                       │
 SessionManager / Pi SDK               projects.json       workspace providers,
 agent processes + session files                              backends, terminal
               │                             │                       │
     workspace cwd / files / git / terminal / credentials / Pi extensions
```

### Processos, propriedade e reinício

* `src/server/index.ts` é a entrada pequena da UI/API: importa `buildApp`, cria o app, escuta `PI_WEB_PORT`/host e fecha no sinal ([fonte](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/src/server/index.ts), linhas 1–7). `buildApp` instala compressão, Fastify WebSocket, estáticos, rotas de projeto/workspace/máquina e proxies de sessão; suas dependências padrão incluem `SessionDaemonClient` e `SessionDaemonWorkspaceCatalog` ([`src/server/app.ts`](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/src/server/app.ts#L173-L284), linhas 173–284).
* `src/server/sessiond.ts` executa o daemon separado. No startup ele captura o ambiente, resolve o perfil do agente e exporta `PI_CODING_AGENT_DIR`/eventual `PI_CODING_AGENT_SESSION_DIR` antes de qualquer processo agente; também marca processos descendentes com `PI_WEB_SESSION` ([fonte](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/src/server/sessiond.ts#L63-L86), linhas 63–86). O comentário e o scrub de ambiente deixam explícito que bash, terminais e subsessões nascem desse daemon e herdam o ambiente ([linhas 130–138]).
* Antes de construir stores/runtime, o daemon chama `claimSessiondStateOwnership`; só o daemon reivindica o diretório de dados, enquanto a UI/API da mesma instância compartilha-o sem reivindicá-lo ([`sessiond.ts`](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/src/server/sessiond.ts#L140-L148), linhas 140–148; [`sessiondStateOwnership.ts`](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/src/server/sessiond/sessiondStateOwnership.ts#L1-L24), linhas 1–24). A marca inclui PID/start-time e endpoint; isso evita dois daemons escreverem o mesmo estado e tem fallback de probe, com a limitação declarada de namespaces PID distintos ([`sessiondStateOwnership.ts`](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/src/server/sessiond/sessiondStateOwnership.ts#L1-L24)).
* O runtime do daemon cria `SessionEventHub`, autenticação, refresh de catálogo de modelos, `ProjectService(ProjectStore)`, providers de workspace, registry de backends, status, `PiSessionService`, terminal e remoções ([`sessiond.ts`](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/src/server/sessiond.ts#L189-L340), linhas 189–340). No shutdown, quiesce plugins, para catalog refresher/auth/sessões/unread/backends, fecha o servidor e só então libera a posse ([linhas 317–339]).
* O script de instalação gera dois executáveis nativos, `pi-web-sessiond` e `pi-web-server`, e aceita `PI_WEB_SESSIOND_EXEC`/`PI_WEB_SERVER_EXEC` para substituição controlada ([`src/cli.ts`](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/src/cli.ts#L611-L635), linhas 611–635). O CLI detecta systemd user services no Linux e LaunchAgents no macOS; o escopo pedido é Linux. Isso é evidência concreta da separação de lifecycle, não apenas uma intenção de documentação.
* `SessionDaemonClient` usa `PI_WEB_SESSIOND_URL` quando configurado; sem URL usa `PI_WEB_SESSIOND_SOCKET`, default `<PI_WEB_DATA_DIR>/sessiond.sock`, e também pode falar por host/porta configurados ([`src/sessiond/config.ts`](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/src/sessiond/config.ts#L4-L20), linhas 4–20; [`src/sessiond/sessionDaemonClient.ts`](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/src/sessiond/sessionDaemonClient.ts#L26-L70), linhas 26–70). O processo Web, portanto, não possui o processo agente nem chama o SDK de sessão por request.

### Persistência de sessões e estado

* O gateway de sessões resolve o diretório nesta precedência: `PI_WEB_AGENT_SESSION_DIR`/`PI_CODING_AGENT_SESSION_DIR`, `SettingsManager.getSessionDir()` por cwd, ou default Pi por cwd/perfil ([`src/server/sessions/piSessionManagerGateway.ts`](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/src/server/sessions/piSessionManagerGateway.ts#L1-L42), linhas 1–42). Isso vincula sessão ao cwd real, mas permite override global ou por configuração do projeto.
* A leitura de transcript é compatível com o formato do SDK: stream de objetos JSON, uma entrada por linha; linhas inválidas são ignoradas ([`src/server/sessions/sessionFileFormat.ts`](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/src/server/sessions/sessionFileFormat.ts#L1-L25), linhas 1–25). O gateway mantém scanner/cache de sumários e cache de branches ([`piSessionManagerGateway.ts`](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/src/server/sessions/piSessionManagerGateway.ts#L40-L70)).
* Arquivos duráveis próprios ficam em `PI_WEB_DATA_DIR`: `projects.json` (ou `PI_WEB_PROJECTS_FILE`), `archived-sessions.json` e `session-unread.json` ([`src/config.ts`](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/src/config.ts#L152-L158), linhas 152–158; [`projectStore.ts`](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/src/server/storage/projectStore.ts#L35-L50), linhas 35–50; [`sessionArchiveStore.ts`](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/src/server/sessions/sessionArchiveStore.ts#L35-L45), linhas 35–45; [`sessionUnreadStore.ts`](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/src/server/sessions/sessionUnreadStore.ts#L488-L495), linhas 488–495). O daemon carrega unread durante startup e constrói `SessionArchiveStore`; reiniciar a UI não passa por esse caminho do daemon ([`sessiond.ts`](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/src/server/sessiond.ts#L199-L227), linhas 199–227 e 266–301).
* A sessão ativa é mantida por `PiSessionService`, que recebe `SessionEventHub`, dependências Pi, `SessionArchiveStore`, `SessionManager` gateway, atividade, configurações e stores de unread/notificações ([`sessiond.ts`](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/src/server/sessiond.ts#L264-L301)). Isso é a parte madura que deve ser preservada; trocar a UI não exige reimplementar o processo agente nem o formato de sessão.

### Canal UI ↔ servidor ↔ daemon ↔ agente

* Navegador → Web/API: HTTP JSON e WebSocket. O app registra `fastifyWebsocket`, limita canais de plugin e registra proxies HTTP/WS de sessão ([`app.ts`](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/src/server/app.ts#L173-L184), linhas 173–184; 245–266). O browser usa `SessionSocket`, que conecta a `/sessions/:id/events` ou variantes machine-scoped e reconecta com atraso inicial de 500 ms ([`src/client/src/sessionSocket.ts`](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/src/client/src/sessionSocket.ts#L1-L60), linhas 1–60).
* Web/API → daemon: `registerSessionProxyRoutes` encaminha `/sessiond/health`, `/sessiond/runtime`, `/status`, `/notices`, `/auth`, `/sessions` e `/events`; WS é conectado ao daemon e ligado por `bridgeSockets` ([`sessionProxyRoutes.ts`](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/src/server/sessiond/sessionProxyRoutes.ts#L1-L47), linhas 1–47). O daemon registra rotas de auth/sessão/workspace/plugin backend e fornece `/health` com contagem de sessões e `/runtime` ([`sessiond.ts`](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/src/server/sessiond.ts#L351-L393), linhas 351–393).
* Dentro do daemon, `SessionEventHub` mantém sockets por sessão e globais, atribui sequência por sessão, envia frame de join global e publica eventos JSON; falhas de envio removem/terminam somente o socket ruim ([`sessionEventHub.ts`](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/src/server/realtime/sessionEventHub.ts#L1-L84), linhas 1–84). O `seq`/watermark fecha a corrida de snapshot + eventos ao entrar ([linhas 42–60]). É uma unidade reutilizável do protocolo, mas seu formato atual é específico do PI WEB.
* Agente → daemon: `PiSessionService` cria e opera sessões via APIs importadas do coding-agent; bash, terminais e subsessões nascem em processos descendentes do daemon e recebem seu ambiente ([`piSessionService.ts`](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/src/server/sessions/piSessionService.ts#L1-L30), linhas 1–30; [`sessiond.ts`](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/src/server/sessiond.ts#L130-L138), linhas 130–138).

## Machine → Project → Workspace → Session e execução real

* A representação wire de `Project` é mínima: `id`, `name`, `path`, `createdAt`; `Workspace` acrescenta `projectId`, `path`, `label`, `isMain`, metadados de provider, remoção e configuração efetiva ([`src/shared/apiTypes.ts`](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/src/shared/apiTypes.ts#L355-L434), linhas 355–434). `SessionRef` é apenas `{ id, cwd }`; `SessionInfo` estende a referência ([linhas 432–434 e 605–606]). Assim, o tipo não declara uma relação formal `session.workspaceId`: a associação atual é derivada pelo cwd/workspace e pelos endpoints/estado de seleção.
* `Machine` distingue local/remota; `MachineService.list()` sempre inclui a máquina local e armazena as remotas. Adicionar/atualizar valida nome, URL e headers; local não pode ser alterada/removida ([`machineService.ts`](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/src/server/machines/machineService.ts#L1-L78), linhas 1–78). A máquina remota tem health/runtime cache e um cliente separado.
* O cliente remoto envia `Authorization: Bearer <token>` quando configurado e headers permitidos; abre HTTP e WebSocket contra `baseUrl`, rejeita credenciais embutidas na URL e filtra headers sensíveis/host-controlled ([`machineClient.ts`](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/src/server/machines/machineClient.ts#L50-L83), linhas 50–83 e 120–160). `MachineProxyRoutes` aplica as tabelas de rotas federadas a HTTP/WS e faz a ponte de sockets ([`machineProxyRoutes.ts`](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/src/server/machines/machineProxyRoutes.ts#L1-L50), linhas 1–50). Isso já suporta uma janela cliente única alcançando máquinas distintas, sem misturar o estado de execução.
* Workspace é uma autoridade provider-neutral. `WorkspaceProviderRegistry` resolve para cada projeto um provider primário/fallback, com timeouts, diagnósticos `probe-failed`, `claim-conflict` e `list-failed`, e retorna resolução `provider`/`folder`/`degraded` ([`workspaceProviderRegistry.ts`](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/src/server/workspaces/workspaceProviderRegistry.ts#L1-L60), linhas 1–60). O plugin Git implementa provider de worktrees/branches e executa Git no lado servidor ([`pi-web-plugins/git/server-plugin.ts`](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/pi-web-plugins/git/server-plugin.ts#L1-L50), linhas 1–50). A camada de workspace deve ser preservada como servidor-owned; o cliente recebe snapshots.
* O filesystem é protegido por políticas de cwd/path: o serviço de arquivos lê/escreve/move/deleta dentro do workspace, com preview e limites; a lista de arquivos é plugin/contribuição do workspace. A existência de `pathSafety.ts`, `effectivePathAccess.ts`, `fileContentService.ts`, `fileTreeService.ts` e `workspaceExplorerRoutes.ts`, mais o contrato de arquivos no plugin API, é evidência da separação de autoridade; a UI não acessa o filesystem diretamente. O conteúdo e os limites são servidor-side.
* Terminal é explicitamente servidor-side. O plugin terminal importa `node-pty`, faz `pty.spawn`, resize, shells interativos e runs de comando; a composição privilegiada `RequiredTerminalService` expõe `closeForCwd`, `runCommand` e activity sink ao runtime, não ao contrato browser ([`pi-web-plugins/terminal/server/terminalService.ts`](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/pi-web-plugins/terminal/server/terminalService.ts#L1-L20), linhas 1–20 e 233–303; [`requiredTerminalService.ts`](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/src/server/terminals/requiredTerminalService.ts#L1-L43), linhas 1–43). O daemon liga atividade do terminal ao `WorkspaceActivityService` ([`sessiond.ts`](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/src/server/sessiond.ts#L303-L308), linhas 303–308).

## Files, Diff, Terminal, plugins, temas e tempo real

* **Files:** o plugin `pi-web-plugins/files` fornece `FilesPanel`, `FilesViewer`, `FilesCodeViewer`, runtime de arquivos e loader de viewer. O painel recebe o contexto de workspace/plugin em vez de abrir paths arbitrários. A superfície pública `WorkspaceFiles`/`WorkspaceBackend`/`WorkspaceHost` está definida em [`src/plugin-api.ts`](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/src/plugin-api.ts#L138-L218), linhas 138–218.
* **Diff:** o plugin Git fornece rota/contrato no browser (`git-panel.ts`, `gitRoute.ts`, `unifiedDiff.ts`) e backend Git no servidor (`server-plugin.ts`). Portanto, diff não é uma primitiva Pi: é feature de plugin/workspace Git e pode ser omitida quando o provider/capability não existir. Essa separação é compatível com painéis opcionais.
* **Terminal:** o plugin terminal possui `TerminalPanel`, runtime Browser xterm e server `node-pty`; o pacote lista `@xterm/xterm`, `@xterm/addon-fit` e `node-pty` como dependências. A ponte de canal paired/backend impõe limites de frame, fila e timeout em [`shared/pluginBackendProtocol.ts`](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/src/shared/pluginBackendProtocol.ts), e `webSocketBridge.ts` impõe limites antes de o `ws` alocar receiver ([`webSocketBridge.ts`](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/src/server/webSocketBridge.ts#L1-L75), linhas 1–75). Preservar esses limites é requisito de segurança, não detalhe de UI.
* **Plugins:** existem dois lados. `PiWebPlugin` contribui UI/painéis/ações/temas; `PiWebServerPlugin` contribui providers e backends no servidor. O daemon carrega plugins de servidor, inspeciona saúde, congela contribuições globais antes de sessões reais e registra providers/backends; a UI carrega `core`, `themes` e plugins externos no `PluginRegistry` ([`sessiond.ts`](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/src/server/sessiond.ts#L191-L243), linhas 191–243; [`PiWebApp.ts`](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/src/client/src/components/PiWebApp.ts#L3239-L3244), linhas 3239–3244). O contrato server plugin está em [`src/server-plugin-api.ts`](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/src/server-plugin-api.ts), e o browser plugin em [`src/plugin-api.ts`](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/src/plugin-api.ts#L42-L71), linhas 42–71.
* **Temas/tokens:** `src/client/src/theme.ts` centraliza IDs qualificados, preferência local, dark/light automático e uma lista de `THEME_TOKENS` CSS (`--pi-bg`, `--pi-surface`, `--pi-text`, terminal, estados, shadows etc.) ([`theme.ts`](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/src/client/src/theme.ts#L1-L61), linhas 1–61). Componentes usam as variáveis, por exemplo `appStyles` usa `var(--pi-*)` no host e controles ([`components/shared.ts`](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/src/client/src/components/shared.ts#L90-L120), linhas 90–120). O sistema já permite trocar tema sem editar dezenas de componentes; a lacuna é produto/distribuição de theme packs, não a ausência de tokens.
* **Tempo real:** o caminho de sessão por WS e o global de eventos/notificações estão separados no `SessionEventHub`; o frontend faz projeção/cache do transcript, join snapshot e reconexão (`sessionSocket.ts`, `chatTranscriptStore.ts`). A camada está pronta para ser extraída como client runtime, mas ainda depende de rotas e tipos PI WEB, não de um protocolo versionado cross-runtime.

## Centralização em `PiWebApp` e candidatas a painéis

`PiWebApp` tem 3.450 linhas na revisão. Seu header importa APIs, estado, todos os controllers, plugin registry, tema, route, componentes e estilos; declara estado de seleção e diálogo e instancia controllers (`src/client/src/components/PiWebApp.ts`, linhas 1–40 e 139–261). O render ainda monta navegação, chat, prompt, status, workspace panel e todos os modais num único template ([`PiWebApp.ts`](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/src/client/src/components/PiWebApp.ts#L3193-L3231), linhas 3193–3231).

A centralização não é apenas visual: `createWorkspacePanelContext()` injeta `machine`, `workspace`, `state`, files, backends, prompt, terminal, navigation e host; contexto e callbacks capturam o app ([`PiWebApp.ts`](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/src/client/src/components/PiWebApp.ts#L1990-L2035), linhas 1990–2035). A seleção de painel chama `visibleWorkspacePanels`, `effectiveWorkspaceTool` e depende de `state.mainView`/`workspaceTool`; a visibilidade é predicado no contexto ([linhas 1880–1915]). `WorkspacePanel` em si é um Lit element pequeno, mas recebe workspace/context/panels/tool e delega a renderização aos painéis ([`WorkspacePanel.ts`](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/src/client/src/components/WorkspacePanel.ts#L1-L22), linhas 1–22).

**Candidatas de extração, por menor risco:**

| Candidato | Já isolado? | Preservar/extrair | Risco/acoplamento |
|---|---:|---|---|
| Chat/transcript + `SessionSocket` | parcialmente | preservar daemon/protocolo atual; extrair controller/store para client runtime | tipos `SessionUiEvent`, rotas `/api`, seleção de machine e handlers de `PiWebApp` |
| Files | sim, plugin | preservar plugin/files e contratos workspace; montar como panel | depende de `WorkspacePanelContext`, backend federado e query/navigation do app |
| Git/diff | sim, plugin | preservar server provider/backend e browser panel sob capability Git | pressupõe Git/worktree e contrato plugin; não é universal |
| Terminal | sim, plugin + server composition port | preservar `node-pty`, xterm, limites e serviço server-side | activity, cwd, paired backend e navigation são fornecidos pelo app/daemon |
| Project/Workspace/Session navigation | não | refatorar `ProjectList`, `WorkspaceList`, `SessionList`, controllers em explorer/runtime | seleção, URL, machine memory, unread, cleanup e modais atravessam `PiWebApp` |
| Themes | parcialmente | preservar `theme.ts`, tokens e plugin theme pack | preferência usa localStorage; registry e aplicação de CSS estão no app |
| Modais/settings/status | componentes separados, host-owned | manter como contribuições/views; extrair só depois de contrato de estado | callbacks de auth/config/model/shortcut e estado privado do app |

A conclusão para a pergunta 5 é concreta: **Files, Diff e Terminal são as melhores primeiras panels**, porque já são plugins/contribuições com host context. **Chat** também é uma área visual identificável, mas é mais acoplada à seleção/session controller e prompt. **Project Explorer** é importante para a direção, mas não é um painel plugável pronto: navegação e seleção são infraestrutura do app. Não mover `PiWebApp` inteiro para um docking manager sem primeiro extrair estado, contexto e navegação.

## Imports diretos do Pi e impacto de remover o pacote

Não há imports de Pi no código do browser (`src/client`); os imports são server-side. No código de produção (excluindo testes), a revisão contém imports diretos de (a lista abaixo é um inventário factual da busca na árvore `src/`):

* `@earendil-works/pi-coding-agent`: `piSessionService.ts`, `piSessionManagerGateway.ts`, `authService.ts`, `globalProviderPolicy.ts`, `sessionModelScope.ts`, `askUserTool.ts`, `spawnSessionTool.ts`, `spawnSubsessionTool.ts`, `attachmentService.ts`, `plainTextTheme.ts`, `modelCatalogRefresher.ts`, `oauthLoginFlowService.ts`, `projectTrustRoutes.ts`, `agentHttpDispatcher.ts`, `piWebStatus.ts`, `piWebPluginCatalog.ts`, `piPackageService.ts` e `sessionNameGenerator.ts` (busca de imports na árvore `src/`; os caminhos individuais e a linha principal estão no source).
* `@earendil-works/pi-agent-core`: tipos/`StreamFn` em `piSessionService.ts`.
* `@earendil-works/pi-ai`: tipos `ImageContent` em `piSessionService.ts` e APIs de imagem em serviços de attachment.

O acoplamento mais profundo está em `PiSessionService`: seu import de 20+ símbolos inclui criação de runtime/services/sessão, trust, credencial, `SessionManager`, `SettingsManager`, tool definitions, `ModelRuntime`, UI context e diagnósticos ([`piSessionService.ts`](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/src/server/sessions/piSessionService.ts#L1-L30), linhas 1–30). `piSessionManagerGateway.ts` também instancia `SessionManager`/`SettingsManager` para localizar/listar transcripts ([fonte](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/src/server/sessions/piSessionManagerGateway.ts#L1-L42)). `authService.ts` usa `ModelRuntime` e sincronização de credenciais; `projectTrustRoutes.ts` usa `ProjectTrustStore`/`SettingsManager`; attachment usa resize/format do agente; os tools de spawn/ask usam `defineTool`/`ExtensionContext`.

Logo, se `@earendil-works/pi-coding-agent` deixar de existir, quebram compilação e runtime de sessão/auth/trust/modelos/attachments/plugins — não apenas uma camada de UI. O corte correto é um adapter server-side que encapsule: lifecycle de sessão, resolução/listagem de arquivos de sessão, credenciais/model catalog, trust, tools/contextos de extensão, attachments e diagnósticos. Não substituir o pacote por outro nome sem comparar exports/semântica: o package name atual é verificado nas linhas 106–108 e peer range na 138–140 de [`package.json`](https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/package.json#L100-L150). O código não demonstra hoje compatibilidade com OMP nem um adapter substituível.

## Licença e redistribuição

O PI WEB declara MIT em `package.json` e fornece o texto MIT no `LICENSE`; o texto exige conservar copyright e licença em cópias/substantial portions e inclui isenção de garantia. O Pi upstream também declara MIT no LICENSE consultado. Isso permite fork/derivação/redistribuição independente sob as condições MIT, mas a nova distribuição precisa conservar os avisos do PI WEB e do Pi (e de outras dependências/plug-ins que tenham avisos próprios). A revisão não fez inventário de licenças transitivas npm nem de cada pacote incluído; isso deve ser checado no empacotamento, especialmente `node-pty`, xterm, CodeMirror, Fastify e plugins.

## O que preservar, extrair, refatorar e não prometer

### Preservar sem reescrever

1. `sessiond` separado, posse de estado, shutdown ordenado e service split.
2. `PiSessionService`/gateway, formato e localização de transcripts, archive/unread e activity.
3. `SessionDaemonClient` + proxy HTTP/WS, `SessionEventHub` e limites de WebSocket.
4. `ProjectStore/Service`, `MachineService`/remote proxy, workspace provider registry e path-safety.
5. Plugins server/browser Files, Git/Diff, Terminal e o sistema de tokens/theme.

### Extrair/refatorar em torno da implementação existente

1. Um client runtime compartilhado deve possuir conexão, reconexão, snapshots, subscriptions e seleção por machine/environment; as views Lit devem consumir esse runtime em vez de criar acesso próprio.
2. Uma camada de protocolo deve estabilizar os tipos hoje em `shared/apiTypes.ts` e as rotas federadas; manter os endpoints durante a primeira reorganização reduz risco.
3. Um runtime adapter server-side deve envolver o conjunto de imports Pi, começando por `PiSessionService`, gateway, auth/model/trust/attachments e tools.
4. Extrair do `PiWebApp` o registro de panels, criação de contexto e layout; manter os componentes Lit. O novo docking system não deve virar novo dono de processos, filesystem ou sessões.
5. Manter Machine/Project/Workspace/Session no domínio, mas deixar a apresentação do explorer decidir quanto fica visível; o código atual não justifica afirmar uma relação formal thread↔workspace↔session.

### Não está demonstrado pela revisão

* compatibilidade OMP, equivalência de exports ou formatos de sessão entre Pi e OMP;
* protocolo versionado/capabilities cross-client além das capacidades internas PI WEB;
* que todos os componentes Lit são remontáveis sem lifecycle adicional;
* execução visual do browser, Electron ou Dockview;
* inventário completo de licenças transitivas.

## Recomendações (não decisões humanas)

* **Recomendação:** fazer primeiro um corte de boundary no servidor: `AgentRuntime`/ports por trás do daemon, sem alterar `sessiond`/stores/protocolos maduros. Validar com o Pi atual antes de introduzir OMP.
* **Recomendação:** tratar `Files`, `Git/Diff` e `Terminal` como primeiros painéis, porque o plugin API já possui host/context/backend e o Files/Git/Terminal têm browser/server halves. Tratar Chat e Project Explorer como painéis de segunda etapa após extrair estado/navigation.
* **Recomendação:** compartilhar `SessionDaemonClient`/event parser/store entre Web e Electron; um renderer Electron deve ser apenas outro cliente. O servidor local pode ser iniciado pelo main process, mas não deve ser reimplementado no renderer.
* **Recomendação:** preservar a segurança existente (server-owned cwd/files/credentials/processes, auth Bearer remoto, path policy, frame/body bounds) durante qualquer montagem de docking ou proxy.
* **Recomendação:** licenciar o derivado preservando avisos MIT e produzir SBOM/NOTICE no empacotamento; a presente pesquisa não substitui o inventário transitivo.

Estas são recomendações baseadas no código, não decisões sobre arquitetura futura. A decisão humana ainda precisa escolher a forma exata do protocolo/adapter e a apresentação do vínculo workspace/session.

## Cobertura explícita da pergunta

* **Etapa A 1–4:** sessões, proprietário de processos/estado, canais navegador-servidor e papel do `sessiond`: cobertos em Processos, Persistência e Canal.
* **Etapa A 5–6:** Project/Workspace/Session e máquinas remotas: cobertos na seção Machine → Project → Workspace → Session.
* **Etapa A 7–8:** Files/Diff/Terminal e plugins: cobertos na seção de superfícies.
* **Etapa A 9–10:** candidatos a panels e acoplamento a `PiWebApp`: cobertos com tabela e análise de 3.450 linhas.
* **Etapa A 11–12 / questão aberta 11:** imports diretos, pacote real, impacto de remoção e adapter necessário: cobertos em Imports diretos.
* **Licença/restrições:** cobertas em Licença e redistribuição.
* **Questões abertas 1 e 5:** preservação sem reescrita e componentes que podem virar panels: cobertas em Resposta curta, tabela e plano de corte.

## Limitações

A fonte PI WEB foi clonada somente para leitura fora da worktree; não foram instaladas dependências nem executados produto, browser, testes ou builds. As linhas foram levantadas na revisão SHA indicada, cujo conteúdo pode avançar upstream depois da pesquisa. A fonte Pi foi consultada na revisão `71dca871bc80b6bc97be37f0ca3189399d651fff`, com caminhos permanentes para código e LICENSE. Não foram inferidas métricas de runtime, latência ou robustez além do que o código implementa/documenta.
