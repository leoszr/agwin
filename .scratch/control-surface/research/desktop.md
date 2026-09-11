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
| Electron docs (`electronjs.org/docs/latest`, docs-sha `07e46071…`) | process-model, security, utility-process, safe-storage | 2026-09-11 |
| Tauri v2 docs (`v2.tauri.app`) | architecture, develop/sidecar, plugin/updater, start/prerequisites | 2026-09-11 |

Divergência do brief a registrar: o brief (§6) apresenta o Desktop T3 como "pode incluir o servidor localmente" em tom hipotético. No código atual ele **já inclui**: o backend é um processo-filho gerenciado pelo app (`DesktopBackendManager.ts`), com prova de prontidão HTTP e restart com backoff. Não é hipótese, é o padrão de referência implementado.

---

## 1. Electron: arquitetura Main / Renderer / Preload e o que é restrição real

Modelo oficial (docs `tutorial/process-model`, docs-sha `07e46071…`):

- **Main**: um processo por app, com Node integral. É dono das `BrowserWindow`, do ciclo de vida (`app`) e de todos os módulos nativos (menus, dialogs, tray). Análogo ao "browser process" do Chromium.
- **Renderer**: um por `BrowserWindow` (e por embed). Comporta-se como web padrão; **sem `require`, sem Node** — para usar módulos npm no renderer é preciso bundler, como na web.
- **Preload**: roda no contexto do renderer antes do conteúdo, com acesso a Node, mas **isolado do mundo principal pelo `contextIsolation` (default desde Electron 12)**. Exposição ao renderer só via `contextBridge.exposeInMainWorld`. Comunicação main↔renderer via IPC (`ipcRenderer` exposto pelo preload).
- **UtilityProcess** (`api/utility-process`): filho do main com Node, equivalente ao `child_process.fork` mas lançado pelo Services API do Chromium, com a diferença funcional de poder estabelecer canal com renderers via `MessagePort`. Só pode ser criado após o evento `ready`. `kill()` usa SIGTERM no POSIX. `stdio` configurável só para stdout/stderr (`pipe`/`ignore`/`inherit`); stdin diferente de `ignore` é erro.

Como o T3 Code instancia isso (`apps/desktop/src`, revisão pinada acima):

- `window/DesktopWindow.ts:387-400` — `webPreferences: { preload, backgroundThrottling: false (só até o primeiro paint), contextIsolation: true, nodeIntegration: false, sandbox: true, webviewTag: true }`. Splash posterior (`:869-875`) repete `contextIsolation/nodeIntegration/sandbox`.
- `window/DesktopWindow.ts:585-590, 602-605` — `setWindowOpenHandler` **nega popups** (`{ action: "deny" }`) e abre URLs externas via `shell.openExternal`. Decisão arquitetural reutilizável: popout web nunca vira janela com privilégios; janela nova só via main.
- `window/DesktopWindow.ts:494-506` — convidados `<webview>` (previews de terceiros) têm `webPreferences` re-forçadas em `will-attach-webview` (`sandbox: true`, `nodeIntegration: false`). É o padrão para qualquer conteúdo não empacotado.
- `electron/ElectronProtocol.ts:11-25, 112-135` — renderer servido por **scheme privilegiado próprio** (`t3code://app/`, `t3code-dev://` em dev) registrado com `standard/secure/supportFetchAPI/corsEnabled/stream` **antes do `ready`**, mais CSP própria (`makeDesktopContentSecurityPolicy`, `:67-97`, com `connect-src` aberto por scheme `http/https/ws/wss` porque os environments do usuário não são conhecidos em build-time).
- `preload.ts:1-51, :363` — ponte `desktopBridge` tipada pelo pacote `contracts`, validando eventos na fronteira (ex.: `isSnapShotEvent`). Preload também expõe `process.platform` (única exceção documentada inline).

Restrições que importam (arquiteturais, não opcionais):

1. Todo acesso nativo passa pelo main via ponte preload+IPC validada. Lógica de domínio não mora no main; o main é dono de janelas, processos e OS.
2. `sandbox: true` + `contextIsolation: true` + `nodeIntegration: false` são os defaults modernos (sandbox default desde Electron 20, docs `tutorial/security` itens 3–4) — o T3 confirma na prática. Desviar disso (ex. o `contextIsolation: false` do guest webview em `DesktopWindow.ts:505`) é exceção pontual para conteúdo embedado, não modelo.
3. Conteúdo remoto arbitrário nunca executa com Node (docs `tutorial/security`, itens 1–2). Para nós, "remoto" inclui previews/artefatos de agentes: vão em `<webview>` endurecido, como o T3 faz.
4. Permissões web (ex. `notifications`) são **negadas por default só se houver handler customizado** (`session.setPermissionRequestHandler`); sem handler, o Electron aprova tudo (docs `tutorial/security` item 5). Instalar o handler é obrigação arquitetural desde o dia 1.

## 2. Iniciar e encontrar o servidor Node local; lifecycle e preservação de agentes

Padrão T3 (a referência mais próxima do que o brief pede na Etapa E):

- `backend/DesktopBackendConfiguration.ts:502-505` — spawn com `executablePath: process.execPath` (o Node embutido no Electron) + `args: [backendEntryPath, "--bootstrap-fd", "3"]`. Ou seja: **não precisa de Node instalado no sistema**; o runtime é o do próprio Electron.
- `app/DesktopEnvironment.ts:165-170, 212-214` — `backendEntryPath = <serverRoot>/apps/server/dist/bin.mjs`; empacotado no Windows via `resources/server.asar`; `backendCwd = homeDirectory` quando empacotado (nunca o dir de instalação — gravável pelo usuário).
- `backend/DesktopBackendManager.ts:64-69` — prontidão por **sonda HTTP** (`/.well-known/t3/environment`, timeout 1 min, intervalo 100 ms) e **restart com backoff** (500 ms → 10 s; após N falhas fatais de preflight, para e表面a o motivo em vez de girar para sempre). Logs por instância em arquivo rotativo.
- `backend/DesktopLocalEnvironmentAuth.ts:46-91` — o backend nasce com um **token de bootstrap** (envelope via fd3/stdin); o main troca esse credencial por uma **sessão bearer via HTTP** (`bootstrapRemoteBearerSession`) e o renderer usa bearer. Loopback também é autenticado — mesma fronteira lógica do cliente remoto.
- `backend/DesktopServerExposure.ts:104-136, 409-412` — modos `local-only` (default, `127.0.0.1`) vs `network-accessible` + `tailscaleServe` opcional; trocar porta/bind exige **relaunch do backend**.

Alternativa documentada ao filho via `child_process`: `utilityProcess.fork(modulePath, args, { env, cwd, stdio })` (docs `api/utility-process`). Troca equivalente para um servidor HTTP puro; o diferencial real (MessagePort direto com renderer) **não interessa** se o renderer falar com o servidor só por HTTP/WS — que é o desenho multi-client do brief. Recomendação separada no §8.

O que o pi-web impõe a esse desenho (revisão pinada):

- `src/server/index.ts:7` — `app.listen({ port: config.port ?? 8504, host: config.host ?? "127.0.0.1" })`: loopback por default, porta/host configuráveis via `--host/--port` (`src/cli.ts:208-219`). Empacotar = embutir `dist/server/index.js` + `dist/server/sessiond.js` (bins `pi-web-server`, `pi-web-sessiond` no `package.json`) e passar host/porta por argv/env.
- `src/sessiond/sessionDaemonClient.ts:6, 28-74` — servidor fala com o **sessiond por socket Unix** (`sessiondSocketPath()`), não TCP. O sessiond é o dono dos processos de agente; o servidor é proxy (`src/server/app.ts:15-17`).
- `src/server/sessiond.ts:116-128, 143-154` — shutdown gracioso em SIGINT/SIGTERM; restarts com sobreposição breve.
- `src/cli.ts:112-139` + `src/nativeServices/` — o pi-web já instala serviços por usuário (**systemd user services / LaunchAgents**) com renderização de unit/plist e `serviceDoctor/serviceProbe`.

Consequência para lifecycle no Desktop (questão 13 do brief + ticket 12):

1. **Fechar o Desktop mata o backend-filho e, com ele, o servidor local** — mas os agentes sobrevivem **se e somente se** o sessiond for um processo separado do backend-filho (é o modelo pi-web: sessiond em socket Unix, com ou sem unit systemd). O T3 confirma a gravidade: `window/QuitHold.ts` (hold-to-quit de 1200 ms) existe porque quit acidental derruba sessões em andamento.
2. Sequência de quit importa: `app/DesktopLifecycle.ts:225-263` — `before-quit` com trava, flush de bounds, `window-all-closed → quit` fora do macOS, sinais SIGINT/SIGTERM tratados, e caminho especial `onBeforeQuitForUpdate` para não quebrar o relaunch do updater.
3. Três topologias possíveis, da mais simples à mais robusta (decisão humana; ver §8): (a) Desktop spawna servidor+sessiond como filhos e tudo morre junto — inadequado para "sessões persistentes"; (b) Desktop spawna servidor-filho, sessiond como serviço de usuário pré-instalado (systemd/LaunchAgents, reaproveitando `nativeServices/`) — agentes sobrevivem ao quit; (c) Desktop nem spawna: conecta num servidor local já rodando como serviço. (b) é o que preserva a propriedade do brief §2 ("reiniciar UI/API não termina sessões") com menor custo.

## 3. Empacotamento, distribuição e updates no Linux (questão 13)

Evidência no T3: `apps/desktop/package.json` — `electron 44.1.0`, `electron-builder 26.15.6`, `electron-updater ^6.6.2`; release Linux x64 com **target AppImage** (`.github/workflows/release.yml:420-426`) mais **pacote AUR** (`publish-aur.yml`); helpers Rust nativos só para captura de tela (`release.yml:490-499`: `t3-kde-snap-shot`, `t3-hyprland-snap-shot`) — Rust aparece na borda (portal de screenshot), nunca no backend.

Evidência no electron-builder / electron-updater (revisão pinada, `packages/electron-updater/src`):

- Alvos Linux suportados pelo updater: **AppImage, deb, rpm** (`README.md:11`) mais `PacmanUpdater.ts`; alvos de build incluem ainda snap e flatpak (`app-builder-lib/src/targets/linux/`).
- `AppImageUpdater.ts:19-21, 44-46, 84-89` — auto-update AppImage **só funciona rodando do próprio AppImage** (`APPIMAGE` env presente e caminho absoluto válido); com diferencial por blockmap embutido (`:49-77`).
- `AppUpdater.ts:75-92, 128+` — `deb/rpm/pacman` sempre elevam via **pkexec/sudo**; só AppImage (e NSIS per-user) instalam sem prompt de elevação; updates pendentes nesses alvos exigem chamada explícita (`installPendingUpdateIfAvailable`).
- `AppUpdater.ts:170-191` — `allowUnverifiedLinuxPackages = true` por default: **pacotes Linux do electron-builder não são assinados**; verificação do AppImage é só checksum do manifesto. Contraste direto com o Tauri (§5), cuja assinatura do updater é obrigatória.

Restrições Linux específicas do Electron a levar para o desenho:

1. **Sandbox setuid**: `scripts/electron-launcher.mjs` (`isLinuxSetuidSandboxConfigured`/`resolveLinuxSandboxArgs`) — `chrome-sandbox` precisa ser root `4755`; senão, fallback `--no-sandbox` com warning. Pacotes mal instalados degradam o sandbox silenciosamente se ninguém checar.
2. **Credenciais**: `safeStorage` no Linux usa `kwallet/kwallet5/kwallet6/gnome-libsecret` conforme o desktop, e cai para `basic_text` (senha hardcoded, i.e. **sem proteção**) quando não há secret store (docs `api/safe-storage`; `getSelectedStorageBackend()` detecta). O T3 não confia no default: `src/linuxSecretStorage.ts:39-53` força `--password-store=gnome-libsecret` quando o ambiente não prova backend protegido — e loga o backend em `app/DesktopApp.ts:293-295`. Regra a copiar: exigir backend real, detectar `basic_text`, nunca guardar token em plaintext silenciosamente.
3. **Deep links no Linux são frágeis**: `app/DesktopLinuxUrlHandler.ts:16-20` — `app.setAsDefaultProtocolClient` não alcança AppImages (o `.desktop` `appimagekit_<hash>-…` foge ao controle), então o T3 escreve o próprio handler apontando para o AppImage atual (usado nos callbacks OAuth). Somar: `second-instance` + single-instance lock (`DesktopClerk.ts:139-165`, testes em `DesktopClerk.test.ts:145-165`).
4. Formato Раском: AppImage = um arquivo, update sem elevação, porém sem integração com gerenciador de pacotes; deb/rpm = integração + elevação por update; AUR = distribuição comunitária Arch sem auto-update pelo app. Decisão de formato é humana (§8).

## 4. Recursos nativos: necessidade arquitetural vs feature (questão 14)

Base: uso real no main do T3 (grep em `apps/desktop/src`, revisão pinada) + APIs citadas na página oficial `tutorial/process-model` ("menus, dialogs, and tray icons" como módulos do main).

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

Síntese: a Platform API mínima inicial cobre **openExternal, clipboard, dialogs, safeStorage, ciclo de vida/updates, seleção de environment local-vs-remoto e política de janelas**. Todo o resto (tray, notificações OS, atalhos globais, menus ricos) é feature posterior sem custo de adiamento — exatamente o que o ticket 12 precisa classificar.

## 5. Tauri: comparação objetiva (Etapa G)

Modelo oficial (docs `concept/architecture`, `develop/sidecar`, `plugin/updater`, `start/prerequisites`, acesso em 2026-09-11):

- Núcleo Rust + webview do SO via **WRY** + janelas via **TAO**; JS↔Rust por message passing; sem runtime embutido ("do not ship a runtime… use the OS's webview").
- **Permissões por capability**: cada API (shell, fs, dialog, notification…) é um plugin com `allow/deny` declarados em `capabilities/*.json`, inclusive validadores de argumentos. É o análogo declarativo da nossa ponte preload+IPC — modelo bom, mas reescreve a fronteira que no Electron já é TypeScript direto.
- **Linux = WebKitGTK do sistema**: pré-requisitos listam `libwebkit2gtk-4.1-dev` (+ build-essential, libxdo, libssl, ayatana-appindicator, librsvg2). Risco concreto: skew de versão do WebKit entre distros, codecs e bugs de render fora do nosso controle — Chromium do Electron é o mesmo em toda distro.

Três desenhos, sem eufemismo:

| Eixo | Electron (default) | Tauri + sidecar Node | Tauri + backend reescrito (Rust) |
|---|---|---|---|
| Servidor | Filho via `process.execPath` ou `utilityProcess.fork`; zero dependência de sistema | `externalBin` com sufixo `-$TARGET_TRIPLE` (ex. `-x86_64-unknown-linux-gnu`), spawn via `shell` plugin com `shell:allow-execute` + allowlist de args (docs `develop/sidecar`) | Reescrever servidor+sessiond+node-pty+plugins em Rust |
| Custo do sidecar | — | **Node continua embarcado** (o sidecar é o Node + `dist/`); IPC webview↔servidor continua HTTP/loopback; soma-se toolchain Rust + matriz de triples + permissões por comando | Proibido pelo brief ("não portar o backend para Rust apenas para usar Tauri") e sem benefício mapeado |
| Updates Linux | electron-updater: AppImage sem elevação (exige rodar do AppImage, `APPIMAGE` env), deb/rpm/pacman com pkexec/sudo, pacotes **não assinados** | Plugin updater com **assinatura obrigatória** ("cannot be disabled"), artefato Linux = AppImage + `.sig`, endpoints `{{target}}/{{arch}}/{{current_version}}`, TLS enforced, Rust ≥ 1.77.2 | Idem |
| Distribuição | AppImage/deb/rpm/snap/flatpak/AUR (T3 usa AppImage+AUR) | AppImage/deb/rpm via `tauri-bundler` | Idem |
| Segurança da ponte | Preload TS + `contextBridge` + IPC validado contra `contracts` (código T3) | Capabilities JSON + comandos Rust (fronteira em duas linguagens) | Idem, maior |
| Tamanho/memória | **Sem números**: nada medido aqui; docs oficiais não publicam MB. Estruturalmente: Chromium+Node embutidos vs webview do sistema — mas nosso bundle carrega o servidor Node + `node-pty` de qualquer jeito, o que corrói a vantagem | Idem: o sidecar Node anula a maior parte da economia | — |
| Justificativas reais p/ Rust | Captura de tela por portal (o T3 já usa helpers Rust `t3-kde-snap-shot`/`t3-hyprland-snap-shot` **dentro do Electron**), global shortcuts de baixo nível | Mesmas, sem trocar de framework | Nenhuma encontrada nesta investigação |

Conclusão factual: **Tauri + sidecar paga o preço das duas stacks** (toolchain Rust, matriz de triples, capabilities, WebKitGTK do sistema) **sem remover o Node**, que continua embarcado como sidecar. Tauri + rewrite é descartado pelo brief e por custo/benefício. A única adoção de Rust com evidência (T3) é em **helpers nativos pontuais** (screenshot portals), que funcionam igualmente sob Electron. Nenhum número de tamanho/memória é citado porque nenhum foi medido ou publicado pelas fontes — registrar como lacuna a medir, não como argumento.

## 6. Acesso privado autenticado e multi-client (vale para os dois desenhos)

- Loopback não é autorização: o T3 autentica até o servidor local (bootstrap token → bearer, `DesktopLocalEnvironmentAuth.ts`), com metadados de cliente (`label`, `deviceType`). Copiar o princípio: **toda conexão client→server leva credencial**, local ou via túnel.
- Exposição em camadas (`DesktopServerExposure.ts`): `local-only` default → opt-in `network-accessible` / Tailscale Serve. Para o escopo ("rede privada/túnel, sem exposição pública"), o app precisa no máximo de bind configurável + documentação de túnel; UPnP/relay público estão fora.
- Multi-client preservado pelo protocolo, não pelo framework: renderer do Desktop e Web falam o mesmo HTTP/WS + bearer; o custom scheme (`t3code://app`) é detalhe de origem do Desktop, com `connect-src` por scheme. **Sem fechar a decisão da Platform API** (humana, ticket 12): o contrato a estabilizar é `ClientRuntime → HTTP/WS + auth`, idêntico nos dois shells.

## 7. Cobertura explícita da pergunta do ticket

- Main/Renderer/Preload, context isolation, sandbox, protocolo local → §1 (docs oficiais + `DesktopWindow.ts`, `preload.ts`, `ElectronProtocol.ts`).
- Iniciar/encontrar servidor, propriedade/lifecycle, preservação de agentes → §2 (spawn `process.execPath` + `utilityProcess.fork` como alternativa documentada; readiness/backoff; bootstrap→bearer; sessiond em socket Unix; topologias a/b/c).
- Empacotamento/distribuição/updates (questão 13) → §3 (AppImage+AUR no T3; updater por alvo com elevação; pacotes Linux não assinados; sandbox setuid; `--password-store`; handler `.desktop` próprio).
- Filesystem/dialogs, credenciais, notificações, clipboard, URLs, deep links, menus, tray, janelas (questão 14) → §4, classificado em arquitetural vs posterior.
- Electron vs Tauri+sidecar vs Tauri+rewrite; tamanho/memória só com dados; custos; WebView Linux; popouts; justificativas p/ Rust; sem recomendar rewrite → §5.
- Acesso privado autenticado + multi-client sem fechar a Platform API → §6.

## 8. Recomendações (técnicas, não-decisões) — vs Decisões humanas

Recomendo tecnicamente: manter **Electron como default** (nenhum impedimento encontrado; alternativa Tauri+sidecar soma toolchain sem remover o Node); spawn do servidor via filho do main com sonda HTTP + backoff + bootstrap-token→bearer (padrão T3, adaptado ao `dist/server` + sessiond do pi-web); sessiond fora do processo-filho do servidor (topologia b, §2) para preservar agentes no quit; Platform API mínima do §4; scheme privilegiado + CSP + handler de permissões desde o dia 1; formato inicial **AppImage** (update sem elevação) com deb posterior; `--password-store` forçado + detecção de `basic_text`; Rust restrito a helpers pontuais se um dia preciso (screenshot/global-shortcut), nunca rewrite.

Decisões que permanecem humanas (não tomadas aqui): formato(s) de distribuição e canais de update; topologia a/b/c do sessiond local; contrato final da Platform API (ticket 12, HITL, bloqueado por este); política de quit (hold-to-quit? confirmação?); estratégia de assinatura/GPG dos pacotes Linux; qualquer meta de tamanho/memória (exige medição futura, fora de escopo AFK).

## 9. Limitações e novas perguntas precisas

- Sem execução: nada foi rodado, empacotado ou medido; `node-pty` (dependência nativa do terminal pi-web, cf. `src/server/diagnostics/nodePty*`) **não teve sua compatibilidade com o Node embutido do Electron verificada** — é o maior risco técnico aberto deste ticket (o T3 precisou buildar `pty.node` para Linux no CI: `release.yml:328-377`).
- Proposta: spike futuro (fora deste mapa) empacota `dist/server` mínimo no Electron e valida `node-pty` + socket sessiond no AppImage — 1–2 dias, responde a incógnita real.
- Perguntas para o coordenador: (1) a topologia (b) com systemd user service conflita com "instalação nova independente"? (2) OAuth/social login (que forçaria deep links Linux) entra na primeira entrega? (3) há metas de tamanho de download que justifiquem medir Electron vs Tauri+sidecar?
