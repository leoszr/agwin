# Dockview preserva comportamento e estado dos painéis reais do PI WEB?

Type: prototype
Labels: wayfinder:prototype
Mode: HITL
Status: open
Assignee:
Parent: ../map.md
Blocked by: 01, 05

## Question

Construir e usar com leo um estudo descartável de Dockview com os Lit/Web Components atuais, não a aplicação inteira. Validar a Etapa D com critérios observáveis: lifecycle, drag-and-drop, splits, grupos/tabs, resize, esconder/reabrir, serialization/restauração, floating, popouts e responsividade; observar preservação de estado/subscriptions, terminal e chat, teclado e foco.

O protótipo precisa usar integrações reais suficientes para descobrir incompatibilidades, não apenas caixas coloridas. Registrar resultados por cenário, limitações de execução e asset/branch. A aceitação de comportamento é HITL: só resolver após reação do humano; a decisão final de biblioteca/stack usa estas evidências no ticket correspondente.

Confrontar o risco estático de teardown/reconexão do PromptEditor apontado em [Quais limites do Dockview precisam ser validados com Lit?](05-dockview.md): observar rascunho, seleção, undo, foco e subscriptions ao ocultar, mover e reabrir. Não tratar renderer always como prova de correção do lifecycle. Verificar também adoção de DOM, estilos e listeners no documento de popout; a validação empacotada do Electron fica em [O empacotamento Electron Linux preserva terminal, sessões e popouts?](18-desktop-prototype.md).
