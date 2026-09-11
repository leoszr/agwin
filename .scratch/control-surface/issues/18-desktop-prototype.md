# O empacotamento Electron Linux preserva terminal, sessões e popouts?

Type: prototype
Labels: wayfinder:prototype
Mode: HITL
Status: open
Assignee:
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
