# Quais restrições de Electron e Tauri importam para o Desktop Linux?

Type: research
Labels: wayfinder:research
Mode: AFK
Status: resolved
Assignee: leo
Parent: ../map.md
Blocked by:
Research branch: research/desktop
Research asset: [Evidências — Quais restrições de Electron e Tauri importam para o Desktop Linux?](../research/desktop.md)

## Question

Investigar fontes oficiais Electron e Tauri e o código de `pingdotgg/t3code`/`jmfederico/pi-web` quando pertinente. Cobrir Etapas E e G, as questões abertas 13 e 14 e os tópicos desktop do brief.

Electron já é o default da primeira entrega Linux. Documentar Main/Renderer/Preload, segurança/context isolation/sandbox, protocolo local, iniciar/encontrar o servidor Node, propriedade/lifecycle dos processos e preservação de agentes ao fechar ou reiniciar clientes. Investigar empacotamento, distribuição/updates, filesystem/dialogs, credenciais, notificações, clipboard, abrir URLs, deep links, menus nativos, tray e janelas, distinguindo necessidade arquitetural de feature a implementar.

Comparar objetivamente Electron versus Tauri + Node sidecar versus Tauri + backend reescrito: tamanho/memória só com medições ou dados citados e limites explícitos, custos operacionais/distribuição, WebView no Linux, popouts e justificativas reais para Rust. Não recomendar reescrever o backend apenas para usar Tauri. Explicar como acesso privado autenticado e multi-client afetam os desenhos, sem fechar a decisão humana da Platform API.


## Comments

- 2026-09-11 (leo, via pesquisador AFK): pesquisa concluída contra fontes primárias (Electron docs, Tauri v2 docs, electron-updater source, código `pingdotgg/t3code@7bd7f99e` e `jmfederico/pi-web@46579c0`). Sem execução visual, build ou medições — nenhum número de tamanho/memória é afirmado. Relatório em `../research/desktop.md`.

## Answer

Electron segue default sem impedimento encontrado: Main/Renderer/Preload com `contextIsolation`+`sandbox`+`nodeIntegration:false`, ponte preload+IPC validada e renderer em scheme privilegiado com CSP (padrão T3 Code). Servidor local como processo-filho do main (`process.execPath`, alternativa documentada `utilityProcess.fork`), sonda HTTP de prontidão, restart com backoff e bootstrap-token trocado por bearer — loopback também autenticado. Agentes sobrevivem ao quit somente com sessiond fora do filho do servidor (socket Unix no pi-web; topologia recomendada: servidor-filho + sessiond em serviço de usuário). No Linux: AppImage com update sem elevação (deb/rpm/pacman elevam via pkexec/sudo e não são assinados), `chrome-sandbox` setuid ou `--no-sandbox`, `safeStorage` com `--password-store` forçado e detecção de `basic_text`, deep links exigindo handler `.desktop` próprio para AppImage. Platform API mínima inicial: openExternal, clipboard, dialogs, safeStorage, lifecycle/updates, seleção de environment e política de janelas; tray, notificações OS e atalhos globais são posteriores. Tauri+sidecar paga duas toolchains sem remover o Node embarcado e troca Chromium fixo por WebKitGTK do sistema; Tauri+rewrite descartado (brief + custo). Único uso de Rust com evidência são helpers nativos pontuais sob Electron. Risco aberto: compatibilidade de `node-pty` com o Node embutido no AppImage (sugere-se spike). Detalhes, evidências e decisões humanas pendentes: `../research/desktop.md`.
