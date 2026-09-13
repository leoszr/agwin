# Dockview preserva comportamento e estado dos painéis reais do PI WEB?

Type: prototype
Labels: wayfinder:prototype
Mode: HITL
Status: resolved
Assignee: leo
Parent: ../map.md
Blocked by: 01, 05

## Question

Construir e usar com leo um estudo descartável de Dockview com os Lit/Web Components atuais, não a aplicação inteira. Validar a Etapa D com critérios observáveis: lifecycle, drag-and-drop, splits, grupos/tabs, resize, esconder/reabrir, serialization/restauração, floating, popouts e responsividade; observar preservação de estado/subscriptions, terminal e chat, teclado e foco.

O protótipo precisa usar integrações reais suficientes para descobrir incompatibilidades, não apenas caixas coloridas. Registrar resultados por cenário, limitações de execução e asset/branch. A aceitação de comportamento é HITL: só resolver após reação do humano; a decisão final de biblioteca/stack usa estas evidências no ticket correspondente.

Confrontar o risco estático de teardown/reconexão do PromptEditor apontado em [Quais limites do Dockview precisam ser validados com Lit?](05-dockview.md): observar rascunho, seleção, undo, foco e subscriptions ao ocultar, mover e reabrir. Não tratar renderer always como prova de correção do lifecycle. Verificar também adoção de DOM, estilos e listeners no documento de popout; a validação empacotada do Electron fica em [O empacotamento Electron Linux preserva terminal, sessões e popouts?](18-desktop-prototype.md).
## Comments

- 2026-09-12 (Wayfinder, HITL; responsável: leo): protótipo pronto para reação humana na branch `prototype/dockview-lit`, commit `613995d`, diretório `prototype/`. Build TypeScript/Vite passou. Smoke test em Chromium headless isolado carregou Chat, Editor CodeMirror e Terminal xterm e observou ciclos connected/disconnected; screenshot temporário: `/tmp/agwin-dockview-prototype.png`. A inspeção automática da imagem falhou no worker do parser, então nenhuma conclusão visual foi presumida. O ticket permanece claimed: popout, DnD, seleção/undo, foco/teclado e aceite de comportamento exigem uso e reação de leo.

- 2026-09-12 (leo, HITL): o Dockview está bom no nível deste protótipo; o produto real terá mais conteúdo. Ajuste exigido e aplicado: tema claro somente com branco e tons de branco; tema escuro somente com preto e tons de cinza escuro. Branch `prototype/dockview-lit`, ajuste no commit `25ca262`.

## Answer

O estudo foi aceito por leo como evidência suficiente no nível de protótipo. Dockview, Lit, CodeMirror e xterm funcionaram juntos no estudo; não apareceu impedimento estrutural para seguir à decisão de frontend. O requisito visual confirmado é estritamente neutro: tema claro em branco/off-whites e tema escuro em preto/cinzas escuros. O protótipo não valida backend/sessiond nem Electron empacotado, que continuam nos tickets próprios.
