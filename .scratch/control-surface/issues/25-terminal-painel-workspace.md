# 25: Usar Terminal como Painel fixo ao Workspace

**What to build:** Permitir múltiplos Terminais com PTY real, cada um fixado ao Workspace em que foi criado, no Web e Desktop.

**Blocked by:** 23/Usar Files como primeiro Painel Dockview

**Status:** ready-for-human

- [x] Cada Terminal nasce fixado ao Workspace escolhido e nunca troca silenciosamente de destino.
- [x] O PTY real aceita entrada, transmite saída e respeita os limites do canal existente.
- [x] Reconexão, hide/reopen, move, floating e popout preservam o processo e seu contexto.
- [x] Fechar o cliente não encerra indevidamente processos pertencentes ao host.
- [ ] O fluxo passa em smoke no Web e no AppImage (validação de ponta a ponta bloqueada no ambiente operacional: o serviço `pi-web-sessiond.service` em execução utiliza o binário instalado em `~/.local/bin/pi-web-sessiond`, que não possui suporte a requisições de backend pareado do checkout; atualizar o binário/unidade e reiniciar exige autorização explícita).

## Comments

### 2026-09-14 — Implementação (agente AFK; responsável: leo)

`TerminalDockviewPanel` implementa `IWorkbenchPanelInstance` e integra UI terminal funcional com `@xterm/xterm` e `@xterm/addon-fit`:
- **UI Terminal funcional:** Em vez de container estático ou texto simulado, instancia `Terminal` real com cursor piscante, conversão EOL, tipografia monospace e tema escuro neutro (`--pi-terminal-bg`/`--pi-terminal-text`). O input de teclado do usuário via `terminal.onData` envia dados fatiados em blocos de até 16KB (`chunkUtf8Input`) pelo canal PTY real. A saída recebida escreve diretamente no terminal (`terminal.write(data)`) e atualiza o buffer de replay.
- **Redimensionamento dinâmico:** `ResizeObserver` observa o container do xterm e aciona `fitAddon.fit()`, notificando o canal PTY sobre alterações de colunas e linhas (`channel.resize(cols, rows)`).
- **Isolamento e fixação ao Workspace:** O painel nasce estritamente em modo `pinned` (`mode: "pinned"`) e rejeita qualquer tentativa de transição para modo seguidor (`following`). Alterações de Workspace ativo no registry ou workbench preservam o contexto original sem retargeting.
- **Ciclo de vida, reparenting e popout sem perda de processo:** Movimentação entre grupos (`movePanelToGroup`), modo flutuante (`floatPanel`), ocultação/reabertura (`hidePanel`/`showPanel` por desativação/ativação de abas e visibilidade sem destruição) e popout (`popoutPanel` assíncrono com `popoutUrl` e cópia segura de estilos para `popout.html`) preservam a conexão e o processo do host. Reparenting de documento descarta a view do DOM anterior (`disposeTerminalView`) e recria a instância do xterm no novo documento, reproduzindo o buffer acumulado e reconectando os listeners ao canal PTY aberto.
- **Sobrevivência do host no fechamento do cliente:** O fechamento do cliente ou chamada de `dispose()` no renderer apenas desconecta o canal do cliente (`detachClient()`), mantendo os processos pertencentes ao host intactos e recuperáveis por reconexão via `terminalId`.
- **Integração e montagem na bancada:** `DockviewWorkbench` expõe `addTerminalPanel`, `floatPanel`, `popoutPanel`, `hidePanel`, `showPanel`, `movePanelToGroup` e `closePanel`, além de restaurar terminais salvos via `restoreSavedLayout`. `ModularWorkbenchApp` injeta `terminalService` em `openTerminalPanel`. O componente `DockviewWorkbenchPanel` e o plugin `workbenchPlugin` montam a bancada no cliente publicado e derivam os backends pareados a partir das capacidades autoritativas do host.

Verificação executada:
- `vitest run src/client/workbench`: 8 arquivos, 49 testes passaram com zero falhas, cobrindo chunking UTF-8, bufferização de replay inicial, fixação estrita ao Workspace, persistência de terminalId no layout, PTY real, reconexão de processo após detach, preservação de xterm e buffer após reparenting/popout, operações reais de Dockview (`movePanelToGroup`, `floatPanel`, `hidePanel`, `showPanel`, `popoutPanel` assíncrono com `popout.html`, `closePanel`) sem erros de rede ou tarefas assíncronas abortadas, e roteamento de serviços.
- `npm run typecheck` (`tsc --noEmit`): passou sem erros.
- `eslint`: passou com zero warnings e zero errors em todos os arquivos tocados.

Smoke operacional bloqueado: O teste manual de ponta a ponta com o servidor ativo (`pi-web-sessiond.service`) foi tentado, mas o daemon de sessão em execução na máquina é a versão instalada em `~/.local/bin/pi-web-sessiond`, que responde `daemon-protocol-error: Session daemon does not support plugin backend requests`. Atualizar o binário ou unidade e executar restart manual do daemon interromperia as sessões em execução no host e requer intervenção/autorização explícita do operador.

### 2026-09-16 — Probe preliminar do daemon (operador autorizou update + restart do sessiond)

Binário global sincronizado com o `dist` completo do checkout (`diff -rq` idêntico, bit `+x` restaurado nos entrypoints). Sequência real no serviço: restart → crash-loop (cópia seletiva inicial deixou `dist/shared` de fora) → stop → sync completo → start → falha 126 (bit de execução perdido no `tsc`) → stop → `chmod +x` → start saudável. Daemon novo ativa os server plugins `pi-web.terminal` e `git` e escuta em `~/.pi-web/sessiond.sock`.
Probes diretos no socket com revisões reais do catálogo (`sha256:8915…` terminal, `sha256:734d…` git):
- `POST /paired-plugin-backends/pi-web.terminal/.../terminal.create` → `terminal.list` (1 PTY `smoke-25`) → `terminal.close` → `terminal.list` (`[]`): ciclo PTY real completo, sem resíduo. O `daemon-protocol-error` que bloqueava este ticket não ocorre mais.
- `POST /plugin-backends/git/.../status` (coleção não-pareada, a mesma que `createGitDiffService` usa; reexecutado em 16-09 e confirmado) despacha até o backend (handshake de revisão OK) e responde `owner-mismatch`: o projeto `Projects` está fora do escopo de ownership do plugin git na camada de dispatch, antes de qualquer invocação git.
- Files (`GET /api/.../tree`) retorna entradas reais do Workspace.
Isto foi probe preliminar do daemon. Atualização em 16-09 (autorização do operador): `pi-web.service` (unidade supervisora correta, enabled) relançada com o `dist` novo (`+x`/shebang conferidos; processo hub temporário intermediário desligado); verificado via web: `/api/descriptor` em JSON, `POST /api/paired-plugin-backends/pi-web.terminal/.../terminal.list` → `[]`, `POST /api/plugin-backends/git/.../status` → `owner-mismatch`. A montagem da Bancada foi autorizada e executada em seguida — ver comentário seguinte; o limite de montagem descrito aqui está superado.

### 2026-09-16 — Montagem da Bancada + smoke Web (autorização do operador)

Mudança de produto: `workbenchPlugin` registrado nos built-ins do `PiWebApp` (`createPluginRegistry` agora recebe a Bancada com getters de binding por máquina selecionada: terminal via `requiredTerminalByMachine`, diff via novo `gitDiffBindingByMachine` populado no loop de load a partir do registro `git` com revisão publicada pelo servidor). `createWorkbenchPlugin` aceita `getDiffBinding` e repassa `.diffBinding` ao elemento; removido o export isolado `workbenchPlugin` sem uso.
Efeito visível intencional: a Bancada (order 25) passa a ser o primeiro painel visível e o destino de fallback (antes: terminal); 5 testes de fallback tiveram expectativas atualizadas para a nova topologia.
Testes: 2 novos (`Bancada registrada`, `bindings repassados ao elemento`, ambos com red-check), suite cliente 176 arquivos/1625 testes verde; `typecheck`, `eslint`, `knip`, `git diff --check` limpos.
 Smoke Web no browser real: Bancada monta Terminal+Files+Diff; Terminal fixado (`Terminal (/home/leo/Projects) [pinned]`) com PTY interativo (`echo smoke-bancada` → saída no xterm); Diff seguidor; Files com árvore real. Nota: reloads acumulam sessões PTY no host (sobrevivência é o contrato do ticket), badge `Terminal N` cresce — acompanhar se virar ruído.
AppImage: repackado do `dist` atual (asar contém `dockview-workbench-panel` + painéis); shell abre headless e tenta o backend `:18504`; interação GUI pendente de display. Processo de probe limpo, sem resíduo, sem tocar no `sessiond` vivo (data dir isolada).

### 2026-09-17 — Smoke AppImage diferido (decisão: leo)

Foco total no webapp até conclusão; smoke do AppImage permanece pendente sem bloquear as próximas issues.
