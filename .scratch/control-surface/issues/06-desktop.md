# Quais restrições de Electron e Tauri importam para o Desktop Linux?

Type: research
Labels: wayfinder:research
Mode: AFK
Status: claimed
Assignee: leo
Parent: ../map.md
Blocked by:
Research branch: research/desktop
Research asset: [Evidências — Quais restrições de Electron e Tauri importam para o Desktop Linux?](../research/desktop.md)

## Question

Investigar fontes oficiais Electron e Tauri e o código de `pingdotgg/t3code`/`jmfederico/pi-web` quando pertinente. Cobrir Etapas E e G, as questões abertas 13 e 14 e os tópicos desktop do brief.

Electron já é o default da primeira entrega Linux. Documentar Main/Renderer/Preload, segurança/context isolation/sandbox, protocolo local, iniciar/encontrar o servidor Node, propriedade/lifecycle dos processos e preservação de agentes ao fechar ou reiniciar clientes. Investigar empacotamento, distribuição/updates, filesystem/dialogs, credenciais, notificações, clipboard, abrir URLs, deep links, menus nativos, tray e janelas, distinguindo necessidade arquitetural de feature a implementar.

Comparar objetivamente Electron versus Tauri + Node sidecar versus Tauri + backend reescrito: tamanho/memória só com medições ou dados citados e limites explícitos, custos operacionais/distribuição, WebView no Linux, popouts e justificativas reais para Rust. Não recomendar reescrever o backend apenas para usar Tauri. Explicar como acesso privado autenticado e multi-client afetam os desenhos, sem fechar a decisão humana da Platform API.
