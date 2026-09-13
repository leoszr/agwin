# O empacotamento Electron Linux preserva terminal, sessões e popouts?

Type: prototype
Labels: wayfinder:prototype
Mode: HITL
Status: resolved
Assignee: leo
Parent: ../map.md
Blocked by: 06, 07, 10

## Question

Validar, em um protótipo descartável e com reação de leo, os riscos de empacotamento e janelas apontados por [Quais restrições de Electron e Tauri importam para o Desktop Linux?](06-desktop.md) e [Quais limites do Dockview precisam ser validados com Lit?](05-dockview.md). Não implementar a aplicação inteira nem assumir que executar em desenvolvimento prova o pacote distribuído.

Usar as interfaces propostas para clientes/servidor e o frontend/docking escolhido. Exercitar o servidor real do PI WEB, seu terminal e sessiond; um shell mínimo de teste basta.

- Iniciar o servidor no runtime Node efetivamente distribuído pelo Electron, com modo de execução explícito; verificar carregamento de dependências nativas como node-pty, terminal interativo e disponibilidade dos assets no pacote Linux escolhido para o estudo.
- Executar uma sessão real, fechar/reiniciar renderer, UI/API e app, e observar o que permanece vivo e pode ser retomado. Distinguir PID, árvore/grupo de processos, serviço/cgroup, persistência em disco e agente ainda executando. Não presumir que separar processos basta para sobreviver ao encerramento.
- Exercitar reconexão pelo Web e Desktop ao mesmo servidor autenticado, sem duplicar execução nem exigir Node instalado globalmente sem declarar esse pré-requisito.
- Confrontar popouts do layout com origem/scheme, política de window.open, preload e isolamento. Validar interação, estilos, foco e retorno ao layout sem desabilitar sandbox, afrouxar indiscriminadamente permissões ou expor IPC bruto. Um impedimento pode informar o recorte da feature, não autoriza um contorno inseguro.

A resposta registra cenários executados, evidências, limites e reação humana; alimenta a decisão de arquitetura Desktop. O protótipo integra a investigação autorizada e não é uma fase de implementação do produto. Não impor AppImage, systemd, custom scheme ou uma política de quit antes de comparar a hipótese técnica com os requisitos e os resultados.

## Comments

- 2026-09-12 (Wayfinder, HITL; responsável: leo): protótipo empacotado validado tecnicamente e em uso humano. Assets e instruções no branch `prototype/electron-linux`, commit `2dabca1`.

## Answer

### Resultado

O protótipo no branch `prototype/electron-linux` confirmou que Electron permanece viável para o Desktop Linux, com limites explícitos:

- AppImage real com Electron `44.1.0` e Node `24.19.0`, sem exigir Node global.
- PI WEB pinado em `46579c049a305b6a146d1028e539ca6d071fbfb4`; Web/API e `sessiond` iniciaram pelo próprio `process.execPath` com `ELECTRON_RUN_AS_NODE=1`.
- `node-pty@1.1.0` foi reconstruído para ABI `149` e executou `/bin/sh` em PTY real, retornando `PTY_OK`.
- O gateway de prova respondeu `200` com bearer/cookie e `401` sem credencial; Web e Desktop podem alcançar a mesma execução sem duplicá-la.
- Uma Session real foi criada no `sessiond`, aceitou comando shell, permaneceu ativa enquanto Web/API mudou de PID (`124230` → `124706`) e aceitou novo comando após a reconexão. O PID do `sessiond` permaneceu `120256` e `activeSessions: 1` antes e depois.
- leo abriu o pacote, destacou o painel, interagiu, retornou ao layout e confirmou restauração de foco. O renderer principal permaneceu com `sandbox: true`, `contextIsolation: true` e `nodeIntegration: false`; nenhuma IPC bruta foi exposta.

### Achados de empacotamento e lifecycle

Desempacotar apenas PI WEB e `node-pty` não basta na árvore npm atual: o processo Node externo ao ASAR não resolve dependências hoisted mantidas dentro de `app.asar`. O pacote funcional deixou a árvore runtime de `node_modules` fora do ASAR. A implementação deve escolher entre servidor autocontido/bundled ou recursos runtime integralmente desempacotados.

Os pacotes Pi são peer dependencies do PI WEB, mas imports de runtime. O shell precisa declará-los e empacotá-los explicitamente; sem isso, Web/API e `sessiond` falham com `ERR_MODULE_NOT_FOUND`.

O popout funcionou sem preload próprio. Isso reduz privilégio e é suficiente enquanto painéis usam HTTP/WS e Web APIs; qualquer Platform API futura deve receber ponte mínima e validada, nunca `ipcRenderer` bruto.

Separação por `detached` provou sobrevivência ao fechamento do shell, mas não é política de produção: não dá supervisão, restart, cgroup nem sobrevivência garantida a logout/reboot. A decisão Desktop deve escolher serviço de usuário para `sessiond` ou assumir explicitamente que agentes terminam com o app.

### Limites

Não foi enviado prompt a modelo externo: a Session e o comando shell foram reais, mas offline, evitando custo e credenciais. AppImage foi usado como formato do experimento, não escolhido como formato final. O proxy autenticado é harness de fronteira, não implementação do gateway. Evidência detalhada e código descartável: branch `prototype/electron-linux`, commits `ca35d8a` e `ba94cc1` e `2dabca1`.
