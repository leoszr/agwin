# Quais restrições de Electron e Tauri importam para o Desktop Linux?

Data: 2026-09-11. Pergunta do ticket `06-desktop.md` (Etapas E e G, questões abertas 13 e 14, tópicos desktop do brief).
Status da apuração: somente leitura de fontes primárias + clones readonly. **Nenhuma execução visual, nenhum build, nenhuma medição de tamanho/memória foi feita** — números de MB/RAM não existem neste relatório por decisão explícita do ticket (só com medições ou dados citados).

## Fontes consultadas (revisões pinadas)

| Fonte | Revisão / versão | Acesso |
|---|---|---|
| `pingdotgg/t3code` (clone readonly `/tmp/wayfinder-src/t3code`) | `7bd7f99e6cab940892ff9240549c507bfd066aee` | 2026-09-11 |
| `jmfederico/pi-web` (clone readonly `/tmp/wayfinder-src/pi-web`) | `46579c049a305b6a146d1028e539ca6d071fbfb4` | 2026-09-11 |
| `electron/electron` (ls-remote HEAD) | `8d381c1dd41a75aced43f671f6a26996129bca50` | 2026-09-11 |
| `tauri-apps/tauri` (ls-remote HEAD) | `d0f38df06a2f4406b388a336694aa18b3c6bf1a9` | 2026-09-11 |
| `electron-userland/electron-builder` (clone esparso docs+updater) | `99b6c7f1efe761bbd3d0582e158a8f1705f652a0` | 2026-09-11 |
| Electron docs (`electronjs.org/docs/latest`, docs-sha `07e460719c75b2ec5ee4893f7d2192ef31c7b8c2`) | process-model, security, sandbox, utility-process, safe-storage | 2026-09-11 |
| Tauri v2 docs (`v2.tauri.app`) | architecture, develop/sidecar, plugin/updater, start/prerequisites | 2026-09-11 |

URLs permanentes das páginas centrais (conteúdo citado acima):

- https://www.electronjs.org/docs/latest/tutorial/process-model
- https://www.electronjs.org/docs/latest/tutorial/security
- https://www.electronjs.org/docs/latest/tutorial/sandbox
- https://www.electronjs.org/docs/latest/api/utility-process
- https://www.electronjs.org/docs/latest/api/safe-storage
- https://v2.tauri.app/concept/architecture/
- https://v2.tauri.app/develop/sidecar/
- https://v2.tauri.app/plugin/updater/
- https://v2.tauri.app/start/prerequisites/
- https://github.com/pingdotgg/t3code/blob/7bd7f99e6cab940892ff9240549c507bfd066aee/apps/desktop/src/backend/DesktopBackendConfiguration.ts
- https://github.com/pingdotgg/t3code/blob/7bd7f99e6cab940892ff9240549c507bfd066aee/apps/desktop/src/window/DesktopWindow.ts
- https://github.com/pingdotgg/t3code/blob/7bd7f99e6cab940892ff9240549c507bfd066aee/apps/desktop/src/preload.ts
- https://github.com/jmfederico/pi-web/blob/46579c049a305b6a146d1028e539ca6d071fbfb4/src/server/index.ts
- https://github.com/electron-userland/electron-builder/blob/99b6c7f1efe761bbd3d0582e158a8f1705f652a0/packages/electron-updater/src/AppUpdater.ts
- https://github.com/electron-userland/electron-builder/blob/99b6c7f1efe761bbd3d0582e158a8f1705f652a0/packages/electron-updater/src/AppImageUpdater.ts

Divergência do brief a registrar: o brief (§6) apresenta o Desktop T3 como "pode incluir o servidor localmente" em tom hipotético. No código atual ele **já inclui**: o backend é um processo-filho gerenciado pelo app (`DesktopBackendManager.ts`), com prova de prontidão HTTP e restart com backoff. Não é hipótese, é o padrão de referência implementado.

---

## 1. Electron: arquitetura Main / Renderer / Preload e o que é restrição real

Modelo oficial (docs `tutorial/process-model` + `tutorial/sandbox`, docs-sha `07e460719c75b2ec5ee4893f7d2192ef31c7b8c2`):

- **Main**: um processo por app, com Node integral. É dono das `BrowserWindow`, do ciclo de vida (`app`) e de todos os módulos nativos (menus, dialogs, tray). Análogo ao "browser process" do Chromium.
- **Renderer**: um por `BrowserWindow` (e por embed). Comporta-se como web padrão; **sem `require`, sem Node** — para usar módulos npm no renderer é preciso bundler, como na web.
- **Preload**: roda no contexto do renderer antes do conteúdo com um **subconjunto polifilado de Node — não Node integral** (docs `tutorial/sandbox`: só `electron` restrito a `contextBridge/crashReporter/ipcRenderer/nativeImage/webFrame/webUtils`, mais `events/timers/url` e globals `Buffer/process/setImmediate/clearImmediate`; sem CommonJS multifile sem bundler). Ainda assim, o ambiente do preload é mais privilegiado que o renderer, de modo que sem **`contextIsolation` (default desde Electron 12)** há vazamento de APIs privilegiadas para o conteúdo. Exposição ao renderer só via `contextBridge.exposeInMainWorld`; `ipcRenderer` vive confinado no preload.
- **UtilityProcess** (`api/utility-process`): filho do main com Node, equivalente ao `child_process.fork` mas lançado pelo Services API do Chromium, com a diferença funcional de poder estabelecer canal com renderers via `MessagePort`. Só pode ser criado após o evento `ready`. `kill()` usa SIGTERM no POSIX. `stdio` configurável só para stdout/stderr (`pipe`/`ignore`/`inherit`); stdin diferente de `ignore` é erro.

Como o T3 Code instancia isso (`apps/desktop/src`, revisão pinada acima):

- `window/DesktopWindow.ts:387-400` — `webPreferences: { preload, backgroundThrottling: false (só até o primeiro paint), contextIsolation: true, nodeIntegration: false, sandbox: true, webviewTag: true }`. Splash posterior (`:869-875`) repete `contextIsolation/nodeIntegration/sandbox`.
- `window/DesktopWindow.ts:585-590, 602-605` — `setWindowOpenHandler` **nega popups** (`{ action: "deny" }`) e abre URLs externas via `shell.openExternal`. Decisão arquitetural reutilizável: popout web nunca vira janela com privilégios; janela nova só via main.
- `window/DesktopWindow.ts:494-506` — convidados `<webview>` (previews de terceiros) têm `webPreferences` re-forçadas em `will-attach-webview` (`sandbox: true`, `nodeIntegration: false`). É o padrão para qualquer conteúdo não empacotado.
- `electron/ElectronProtocol.ts:11-25, 112-135` — renderer servido por **scheme privilegiado próprio** (`t3code://app/`, `t3code-dev://` em dev) registrado com `standard/secure/supportFetchAPI/corsEnabled/stream` **antes do `ready`**, mais CSP própria (`makeDesktopContentSecurityPolicy`, `:67-97`, com `connect-src` aberto por scheme `http/https/ws/wss` porque os environments do usuário não são conhecidos em build-time).
- `preload.ts:9, 51-363` — `ipcRenderer` é importado **só no escopo do preload** e o mundo principal recebe apenas a ponte curada `desktopBridge` (`satisfies DesktopBridge`): um método por canal IPC, com payloads de entrada validados nos listeners (ex.: `isSnapShotEvent`, checagens de `typeof`). `ipcRenderer` bruto nunca é exposto ao renderer. (A outra ponte, `exposeClerkBridge`, é do SDK Clerk para OAuth — fora do nosso controle.) Preload também lê `process.platform` (única exceção documentada inline).

Restrições que importam (arquiteturais, não opcionais):

1. Todo acesso nativo passa pelo main via ponte preload+IPC validada. Lógica de domínio não mora no main; o main é dono de janelas, processos e OS.
2. `sandbox: true` + `contextIsolation: true` + `nodeIntegration: false` são os defaults modernos (sandbox default desde Electron 20, docs `tutorial/security` itens 3–4) — o T3 confirma na prática. `nodeIntegration: true` desliga o sandbox do processo (docs `tutorial/sandbox`), de modo que desviar disso (ex. o `contextIsolation: false` do guest webview em `DesktopWindow.ts:505`) é exceção pontual para conteúdo embedado, não modelo.
3. Conteúdo remoto arbitrário nunca executa com Node (docs `tutorial/security`, itens 1–2). Para nós, "remoto" inclui previews/artefatos de agentes: vão em `<webview>` endurecido, como o T3 faz.
4. Permissões web (ex. `notifications`) são **negadas por default só se houver handler customizado** (`session.setPermissionRequestHandler`); sem handler, o Electron aprova tudo (docs `tutorial/security` item 5). Instalar o handler é obrigação arquitetural desde o dia 1.

## 2. Iniciar e encontrar o servidor Node local; lifecycle e preservação de agentes

Padrão T3 (a referência mais próxima do que o brief pede na Etapa E):

- `backend/DesktopBackendConfiguration.ts:502-510` — spawn com `executablePath: process.execPath` + `args: [backendEntryPath, "--bootstrap-fd", "3"]` + **`ELECTRON_RUN_AS_NODE: "1"` no env** (assertido em `DesktopBackendConfiguration.test.ts:234, 294`). O modo Node vem da variável de ambiente, não do `execPath` sozinho: sem ela, o binário Electron trataria o entry como app. Nenhum uso de `@electron/fuses` foi encontrado na árvore — o mecanismo citado é só o env. Efeito prático igual: **não precisa de Node instalado no sistema**; o runtime é o do próprio Electron.
- `app/DesktopEnvironment.ts:165-170, 212-214` — `backendEntryPath = <serverRoot>/apps/server/dist/bin.mjs`; empacotado no Windows via `resources/server.asar`; `backendCwd = homeDirectory` quando empacotado (nunca o dir de instalação — gravável pelo usuário).
- `backend/DesktopBackendManager.ts:64-69` — prontidão por **sonda HTTP** (`/.well-known/t3/environment`, timeout 1 min, intervalo 100 ms) e **restart com backoff** (500 ms → 10 s; após N falhas fatais de preflight, para e expõe o motivo em vez de girar para sempre). Logs por instância em arquivo rotativo.
- `backend/DesktopLocalEnvironmentAuth.ts:46-91` — o backend nasce com um **token de bootstrap** (envelope via fd3/stdin); o main troca esse credencial por uma **sessão bearer via HTTP** (`bootstrapRemoteBearerSession`) e o renderer usa bearer. Loopback também é autenticado — mesma fronteira lógica do cliente remoto.
- `backend/DesktopServerExposure.ts:104-136, 409-412` — modos `local-only` (default, `127.0.0.1`) vs `network-accessible` + `tailscaleServe` opcional; trocar porta/bind exige **relaunch do backend**.

Alternativa documentada ao filho via `child_process`: `utilityProcess.fork(modulePath, args, { env, cwd, stdio })` (docs `api/utility-process`). Troca equivalente para um servidor HTTP puro; o diferencial real (MessagePort direto com renderer) **não interessa** se o renderer falar com o servidor só por HTTP/WS — que é o desenho multi-client do brief. Recomendação separada no §8.

O que o pi-web impõe a esse desenho (revisão pinada):

- `src/server/index.ts:7` — `app.listen({ port: config.port ?? 8504, host: config.host ?? "127.0.0.1" })`: loopback por default, porta/host configuráveis via `--host/--port` (`src/cli.ts:208-219`). Empacotar = embutir `dist/server/index.js` + `dist/server/sessiond.js` (bins `pi-web-server`, `pi-web-sessiond` no `package.json`) e passar host/porta por argv/env.
- `src/sessiond/sessionDaemonClient.ts:6, 28-74` — servidor fala com o **sessiond por socket Unix** (`sessiondSocketPath()`), não TCP. O sessiond é o dono dos processos de agente; o servidor é proxy (`src/server/app.ts:15-17`).
- `src/server/sessiond.ts:116-128, 143-154` — shutdown gracioso em SIGINT/SIGTERM; restarts com sobreposição breve.
- `src/cli.ts:112-139` + `src/nativeServices/` — o pi-web já instala serviços por usuário (**systemd user services / LaunchAgents**) com renderização de unit/plist e `serviceDoctor/serviceProbe`.

Consequência para lifecycle no Desktop (questão 13 do brief + ticket 12):

1. **Fechar o Desktop mata o backend-filho e, com ele, o servidor local.** Separar o sessiond do filho do servidor é **necessário mas não suficiente** para os agentes sobreviverem: é preciso ainda (i) política de encerramento que não derrube o sessiond no `before-quit` (não propagar SIGTERM/SIGKILL ao grupo do sessiond), e (ii) escopo de processo próprio — na prática, sessiond como serviço de usuário (modelo pi-web: sessiond em socket Unix + unit systemd/LaunchAgents), cujo ciclo de vida não pertence à árvore do app. Órfão por acidente não é estratégia. O T3 confirma a gravidade do quit acidental: `window/QuitHold.ts` (hold-to-quit de 1200 ms).
2. Sequência de quit importa: `app/DesktopLifecycle.ts:225-263` — `before-quit` com trava, flush de bounds, `window-all-closed → quit` fora do macOS, sinais SIGINT/SIGTERM tratados, e caminho especial `onBeforeQuitForUpdate` para não quebrar o relaunch do updater.
3. Três topologias possíveis (decisão humana; ver §8): (a) Desktop spawna servidor+sessiond como filhos e tudo morre junto — inadequado para "sessões persistentes"; (b) Desktop spawna servidor-filho, sessiond como serviço de usuário instalado pelo próprio produto (systemd/LaunchAgents, reaproveitando `nativeServices/`) — compatível com instalação nova independente e favorece a sobrevivência ao quit, desde que a política de encerramento preserve o serviço; (c) Desktop nem spawna: conecta num servidor local já rodando como serviço. (b) é a recomendação técnica para preservar a propriedade do brief §2 ("reiniciar UI/API não termina sessões") com menor custo.

## 3. Empacotamento, distribuição e updates no Linux (questão 13)

Evidência no T3: `apps/desktop/package.json` — `electron 44.1.0`, `electron-builder 26.15.6`, `electron-updater ^6.6.2`; release Linux x64 com **target AppImage** (`.github/workflows/release.yml:420-426`) mais **pacote AUR** (`publish-aur.yml`); helpers Rust nativos só para captura de tela (`release.yml:490-499`: `t3-kde-snap-shot`, `t3-hyprland-snap-shot`) — Rust aparece na borda (portal de screenshot), nunca no backend.

Evidência no electron-builder / electron-updater (revisão pinada, `packages/electron-updater/src`). Vale para o updater consultado (era electron-builder 26.x); não é incapacidade universal de atualizar no Linux — atualização pelo gerenciador do sistema continua sendo via do formato escolhido:

- Alvos Linux suportados pelo updater: **AppImage, deb, rpm** (`README.md:11`) mais `PacmanUpdater.ts`; alvos de build incluem ainda snap e flatpak (`app-builder-lib/src/targets/linux/`).
- `AppImageUpdater.ts:19-21, 44-46, 84-89` — auto-update AppImage **só funciona rodando do próprio AppImage** (`APPIMAGE` env presente e caminho absoluto válido); com diferencial por blockmap embutido (`:49-77`).
- `AppUpdater.ts:75-92, 128+` — `deb/rpm/pacman` sempre elevam via **pkexec/sudo**; só AppImage (e NSIS per-user) instalam sem prompt de elevação; updates pendentes nesses alvos exigem chamada explícita (`installPendingUpdateIfAvailable`).
- `AppUpdater.ts:170-191` — `allowUnverifiedLinuxPackages = true` por default porque **o electron-builder não assina pacotes Linux**; verificação do AppImage é só checksum do manifesto. Contraste com o plugin updater do Tauri (§5), que exige assinatura ("cannot be disabled", docs `plugin/updater`).

Restrições Linux específicas do Electron a levar para o desenho:

1. **Sandbox no Linux**: `scripts/electron-launcher.mjs` (`isLinuxSetuidSandboxConfigured`/`resolveLinuxSandboxArgs`) verifica `chrome-sandbox` root `4755` e, se ausente, relança com `--no-sandbox` + warning. Tratar como **condição do launcher lido, não requisito universal do Electron no Linux** (modos de sandbox do Chromium fora desse arquivo não foram verificados aqui). E o guia oficial é explícito — `--no-sandbox` é só para teste, **nunca em produção** (docs `tutorial/sandbox`): recomendação técnica é converter esse fallback em erro fatal no nosso launcher, não em warning silencioso.
2. **Credenciais**: `safeStorage` no Linux usa `kwallet/kwallet5/kwallet6/gnome-libsecret` conforme o desktop, e cai para `basic_text` (senha hardcoded, i.e. **sem proteção**) quando não há secret store (docs `api/safe-storage`; `getSelectedStorageBackend()` detecta). O T3 não confia no default: `src/linuxSecretStorage.ts:39-53` força `--password-store=gnome-libsecret` quando o ambiente não prova backend protegido — e loga o backend em `app/DesktopApp.ts:293-295`. Regra a copiar: exigir backend real, detectar `basic_text`, nunca guardar token em plaintext silenciosamente.
3. **Deep links no Linux são frágeis**: `app/DesktopLinuxUrlHandler.ts:16-20` — `app.setAsDefaultProtocolClient` não alcança AppImages (o `.desktop` `appimagekit_<hash>-…` foge ao controle), então o T3 escreve o próprio handler apontando para o AppImage atual (usado nos callbacks OAuth). Somar: `second-instance` + single-instance lock (`DesktopClerk.ts:139-165`, testes em `DesktopClerk.test.ts:145-165`).
4. Formato de pacote: AppImage = um arquivo, update sem elevação, porém sem integração com gerenciador de pacotes; deb/rpm = integração + elevação por update; AUR = distribuição comunitária Arch sem auto-update pelo app. Nada disto é decisão — ver recomendações explícitas no §8.

## 4. Recursos nativos: necessidade arquitetural vs feature (questão 14)

Base: uso real no main do T3 (grep em `apps/desktop/src`, revisão pinada) + APIs citadas na página oficial `tutorial/process-model` ("menus, dialogs, and tray icons" como módulos do main). A coluna Classificação é **recomendação técnica explícita, não fato nem decisão** — a classificação final é do ticket [Como Electron integra servidor local e recursos nativos sem duplicar o Web?](../issues/12-desktop-platform.md) (HITL).

| Recurso | API Electron | Uso no T3 (evidência) | Classificação |
|---|---|---|---|
| Abrir URLs externas | `shell.openExternal` | `ElectronShell.ts:82-94`, via ponte IPC (`ipc/methods/window.ts:297-310`); `setWindowOpenHandler` nega e delega | **Arquitetural**: todo link externo sai do sandbox pelo main com allowlist de scheme |
| Clipboard | `clipboard.writeText` | `ElectronShell.ts:96-97` via ponte | **Arquitetural (mínimo)**: expor escrita/leitura pela Platform API; o resto é Web API |
| Diálogos filesystem | `dialog.showOpenDialog`, `showMessageBox`, `showErrorBox` | `ElectronDialog.ts:124-185` (pick folder/files, mensagens) | **Arquitetural**: workflows do produto precisam "abrir pasta" nativo; o resto do FS é server-owned |
| Credenciais/segredos | `safeStorage` + `--password-store` | `ElectronSafeStorage.ts:73-98`, `linuxSecretStorage.ts`, catálogo cifrado (`DesktopConnectionCatalogStore.ts:386-405`), tokens de env (`DesktopSavedEnvironments.ts:440-502`) | **Arquitetural**: tokens/bearers de environments em keyring, com detecção de `basic_text` |
| Janelas | `BrowserWindow` | `DesktopWindow.ts` (principal + splash `loadURL` data-URL em `:885`), boot oculta + `ready-to-show` | **Arquitetural**: política de criação de janelas no main (uma principal; popouts futuros = novas `BrowserWindow` com mesmo preload) |
| Menus nativos | `Menu` | `ElectronMenu.ts`, `DesktopApplicationMenu.ts` | Feature inicial útil (atalhos/quit), não bloqueante |
| Deep links + single-instance | `setAsDefaultProtocolClient`, `second-instance` | `ElectronApp.ts:170-177`, `DesktopLinuxUrlHandler.ts`, `DesktopClerk.ts:139` | **Arquitetural se houver OAuth/callback** (T3 precisou para Clerk); senão, posterior |
| Notificações OS | (Web Notifications via `session`) | **Nenhum uso de `Notification` no main** (grep em `src/` só acha `dismissedProviderUpdateNotificationKeys`, setting de UI in-app); permissão passa pelo handler de sessão (docs security item 5) | Feature posterior; quando vier, com handler de permissão + fallback in-app |
| Tray | (`Tray`) | **Nenhum uso** (grep `new Tray|Tray\(` vazio em `src/`) | Posterior ou nunca nesta entrega; docs oficiais listam como módulo padrão do main, sem custo arquitetural em adiar |
| Atalhos globais | `globalShortcut` | Só no feature snapshot (`snapShot/DesktopSnapShot.ts:692-813`) | Posterior, por feature (ex. push-to-talk), não base |
| Energia/suspensão | `powerMonitor` | Só telemetria (`telemetry/DesktopTelemetryPublisher.ts:186-218`) | Posterior; relevante um dia para pausar polling em idle |
| Popouts de painel | `BrowserWindow` extra | **Não encontrado**: `window.open` é negado; previews são `<webview>` (`preview/GuestProtocol.ts`, `PickPreload.ts`) | Decisão de layout do ticket Dockview; Electron não impede (nova janela + mesma ponte), mas exige roteamento de layout multi-janela na Platform API |

Síntese (recomendação; decisão no ticket linkado acima): a Platform API mínima inicial cobre **openExternal, clipboard, dialogs, safeStorage, ciclo de vida/updates, seleção de environment local-vs-remoto e política de janelas**. Todo o resto (tray, notificações OS, atalhos globais, menus ricos) é feature posterior sem custo de adiamento — exatamente o que o ticket 12 precisa classificar.

## 5. Tauri: comparação objetiva (Etapa G)

Modelo oficial (docs `concept/architecture`, `develop/sidecar`, `plugin/updater`, `start/prerequisites`, acesso em 2026-09-11):

- Núcleo Rust + webview do SO via **WRY** + janelas via **TAO**; JS↔Rust por message passing; sem runtime embutido ("do not ship a runtime… use the OS's webview").
- **Permissões por capability**: cada API (shell, fs, dialog, notification…) é um plugin com `allow/deny` declarados em `capabilities/*.json`, inclusive validadores de argumentos. É o análogo declarativo da nossa ponte preload+IPC — modelo bom, mas reescreve a fronteira que no Electron já é TypeScript direto.
- **Linux = WebKitGTK do sistema**: pré-requisitos listam `libwebkit2gtk-4.1-dev` (+ build-essential, libxdo, libssl, ayatana-appindicator, librsvg2). Risco concreto: skew de versão do WebKit entre distros, codecs e bugs de render fora do nosso controle — Chromium do Electron é o mesmo em toda distro.

Três desenhos, sem eufemismo:

| Eixo | Electron (default) | Tauri + sidecar Node | Tauri + backend reescrito (Rust) |
|---|---|---|---|
| Servidor | Filho via `process.execPath` + `ELECTRON_RUN_AS_NODE=1` (mecanismo citado no T3) ou `utilityProcess.fork`; zero dependência de sistema | `externalBin` com sufixo `-$TARGET_TRIPLE` (ex. `-x86_64-unknown-linux-gnu`), spawn via `shell` plugin com `shell:allow-execute` + allowlist de args (docs `develop/sidecar`) | Reescrever servidor+sessiond+node-pty+plugins em Rust |
| Custo do sidecar | — | O runtime Node continua no bundle (o sidecar é o binário do servidor); IPC webview↔servidor continua HTTP/loopback; somam-se fatos novos: toolchain Rust, matriz de triples por plataforma, permissões por comando (docs `develop/sidecar`) | Proibido pelo brief ("não portar o backend para Rust apenas para usar Tauri") e sem benefício mapeado |
| Updates Linux | electron-updater: AppImage sem elevação (exige rodar do AppImage, `APPIMAGE` env), deb/rpm/pacman com pkexec/sudo, pacotes **não assinados** | Plugin updater com **assinatura obrigatória** ("cannot be disabled"), artefato Linux = AppImage + `.sig`, endpoints `{{target}}/{{arch}}/{{current_version}}`, TLS enforced, Rust ≥ 1.77.2 | Idem |
| Distribuição | AppImage/deb/rpm/snap/flatpak/AUR (T3 usa AppImage+AUR) | AppImage/deb/rpm via `tauri-bundler` | Idem |
| Segurança da ponte | Preload TS + `contextBridge` + IPC validado contra `contracts` (código T3) | Capabilities JSON + comandos Rust (fronteira em duas linguagens) | Idem, maior |
| Tamanho/memória | **Sem números**: nada medido aqui; docs oficiais não publicam MB, e este relatório não conclui nada quantitativo. Diferença estrutural registrada sem conclusão: Chromium+Node embutidos vs webview do sistema — com o servidor Node + `node-pty` presentes no bundle em qualquer desenho | Idem: sem medição, sem conclusão | — |
| Justificativas reais p/ Rust | Exemplo do T3, não obrigação nossa: helpers de captura por portal (`t3-kde-snap-shot`/`t3-hyprland-snap-shot` **dentro do Electron**); candidatos genéricos: global shortcuts de baixo nível | Mesmas, sem trocar de framework | Nenhuma encontrada nesta investigação |

Leitura dos fatos: Tauri + sidecar exige as duas toolchains (Rust + Node, que segue embarcado como sidecar) e troca Chromium fixo por WebKitGTK do sistema. Tauri + rewrite é descartado pelo brief e por custo/benefício. A única adoção de Rust com evidência (código do T3, exemplo a avaliar — não obrigação) são **helpers nativos pontuais** (screenshot portals), que funcionam igualmente sob Electron. Nenhum número de tamanho/memória é citado porque nenhum foi medido ou publicado pelas fontes — lacuna a medir, não argumento.

## 6. Acesso privado autenticado e multi-client (vale para os dois desenhos)

- Loopback não é autorização: o T3 autentica até o servidor local (bootstrap token → bearer, `DesktopLocalEnvironmentAuth.ts`), com metadados de cliente (`label`, `deviceType`). Princípio a copiar (recomendação): **toda conexão client→server leva credencial**, local ou via túnel.
- Exposição em camadas (`DesktopServerExposure.ts`): `local-only` default → opt-in `network-accessible` / Tailscale Serve. Para o escopo ("rede privada/túnel, sem exposição pública"), o app precisa no máximo de bind configurável + documentação de túnel; UPnP/relay público estão fora. (Exemplo do T3, não obrigação: Tailscale Serve é feature deles.)
- Multi-client preservado pelo protocolo, não pelo framework: renderer do Desktop e Web falam o mesmo HTTP/WS + bearer; o custom scheme (`t3code://app`) é detalhe de origem do Desktop, com `connect-src` por scheme. **Sem fechar a decisão da Platform API** (humana, [Como Electron integra servidor local e recursos nativos sem duplicar o Web?](../issues/12-desktop-platform.md)): o contrato a estabilizar é `ClientRuntime → HTTP/WS + auth`, idêntico nos dois shells.

## 7. Cobertura explícita da pergunta do ticket

- Main/Renderer/Preload, context isolation, sandbox, protocolo local → §1 (docs oficiais + `DesktopWindow.ts`, `preload.ts`, `ElectronProtocol.ts`).
- Iniciar/encontrar servidor, propriedade/lifecycle, preservação de agentes → §2 (spawn `process.execPath` + `ELECTRON_RUN_AS_NODE=1`, `utilityProcess.fork` como alternativa documentada; readiness/backoff; bootstrap→bearer; sessiond em socket Unix; separado-necessário-mas-não-suficiente; topologias a/b/c).
- Empacotamento/distribuição/updates (questão 13) → §3 (AppImage+AUR no T3; updater consultado por alvo com elevação; pacotes Linux não assinados no electron-builder; setuid como condição do launcher lido; `--password-store`; handler `.desktop` próprio).
- Filesystem/dialogs, credenciais, notificações, clipboard, URLs, deep links, menus, tray, janelas (questão 14) → §4, com proposta de classificação em arquitetural vs posterior (recomendação; decisão no ticket linkado no §6).
- Electron vs Tauri+sidecar vs Tauri+rewrite; tamanho/memória só com dados; custos; WebView Linux; popouts; justificativas p/ Rust; sem recomendar rewrite → §5.
- Acesso privado autenticado + multi-client sem fechar a Platform API → §6.

## 8. Recomendações (técnicas, não-decisões) — vs Decisões humanas

Recomendo tecnicamente (recomendações explícitas, nenhuma decidida aqui): manter **Electron como default** (nenhum impedimento encontrado); spawn do servidor via filho do main com sonda HTTP + backoff + bootstrap-token→bearer (padrão T3, adaptado ao `dist/server` + sessiond do pi-web); sessiond fora do processo-filho do servidor (topologia b, §2) com política de encerramento que o preserve; Platform API mínima do §4; scheme privilegiado + CSP + handler de permissões desde o dia 1; formato inicial **AppImage** (update sem elevação no updater consultado) com deb posterior; `--password-store` forçado + detecção de `basic_text` (e fallback `--no-sandbox` convertido em erro fatal, nunca warning); Rust restrito a helpers pontuais se um dia preciso (screenshot/global-shortcut), nunca rewrite.

Decisões que permanecem humanas (não tomadas aqui): formato(s) de distribuição e canais de update; topologia a/b/c do sessiond local; contrato final da Platform API ([Como Electron integra servidor local e recursos nativos sem duplicar o Web?](../issues/12-desktop-platform.md), HITL, bloqueado por este); política de quit (hold-to-quit? confirmação?); estratégia de assinatura/GPG dos pacotes Linux; qualquer meta de tamanho/memória (exige medição futura).

## 9. Limitações e novas perguntas precisas

- Sem execução: nada foi rodado, empacotado ou medido; `node-pty` (dependência nativa do terminal pi-web, cf. `src/server/diagnostics/nodePty*`) **não teve sua compatibilidade com o Node embutido do Electron verificada** — é o maior risco técnico aberto deste ticket (o T3 precisou buildar `pty.node` para Linux no CI: `release.yml:328-377`).
- Proposta: protótipo de decisão (autorizado pelo mapa para fundar decisões) que empacota `dist/server` mínimo no Electron e valida `node-pty` + socket sessiond no AppImage — responde a incógnita real. Sem estimativa aqui.
- Condicionais registradas (não são gates nem requisitos novos): instalação nova independente **permite** provisionar serviço de usuário próprio, logo a topologia (b) com systemd user service não conflita com o escopo; **se** OAuth/social login entrar em escopo um dia, deep links Linux viram arquiteturais (§3 item 3); **se** houver meta de tamanho de download, aí sim medir Electron vs Tauri+sidecar — hoje não há tal requisito.
