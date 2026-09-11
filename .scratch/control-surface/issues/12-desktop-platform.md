# Como Electron integra servidor local e recursos nativos sem duplicar o Web?

Type: grilling
Labels: wayfinder:grilling
Mode: HITL
Status: open
Assignee:
Parent: ../map.md
Blocked by: 06, 07

## Question

Definir a arquitetura Desktop Linux: quem inicia/encontra o servidor local, quem possui seu lifecycle, como sessões sobrevivem ao fechamento/reinício do cliente e como o renderer usa a mesma interface lógica do Web.

Resolver questões abertas 13 e 14: empacotamento/distribuição/updates e quais recursos realmente precisam da Platform API — dialogs/filesystem, notificações, abrir URLs, clipboard, credenciais, lifecycle, menus, deep links, tray e janelas. Classificar cada recurso como necessário inicialmente ou posterior; não tornar todos os tópicos investigados features obrigatórias.

Definir isolamento e segurança de preload/renderer, conexão a servidores remotos privados e interação com popouts. Electron permanece o default; impedimento relevante pode abrir nova decisão, não autoriza troca silenciosa para Tauri.
