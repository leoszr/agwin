# Decision Report

Este documento é um índice auditável. As respostas completas e as evidências vivem nos tickets vinculados; aqui ficam apenas a síntese e a cobertura do brief.

## Decisões principais

| Tema | Fonte canônica e evidências | Decisão e motivo | Alternativas recusadas | Riscos mantidos |
|---|---|---|---|---|
| Base técnica | [O que o PI WEB já resolve e onde estão seus acoplamentos?](../issues/01-pi-web.md) | Evoluir o PI WEB por fronteiras, preservando `sessiond`, stores, máquinas/proxy, Files, Git/Diff, Terminal, plugins, path safety e realtime. Esses ativos já resolvem execução persistente e remota. | Reescrever backend; trocar dependências Pi por texto; tratar toda a UI atual como descartável. | Acoplamentos ocultos em `PiWebApp`; inventário transitivo de licenças. |
| Cliente–Ambiente | [Qual interface separa clientes, estado compartilhado e execução?](../issues/07-client-server.md), apoiada por [padrões do T3 Code](../issues/02-t3-architecture.md) | Um gateway same-origin guarda catálogo, autenticação e proxies. O client runtime mantém conexão e projeções por Ambiente sobre HTTP/JSON e WebSocket versionados. A execução continua no Ambiente. Preserva o proxy maduro sem duplicar estado durável. | Browser direto por Ambiente; topologia híbrida; copiar Effect/RPC; gateway dono de todo estado; comandos offline. | Gateway vira ponto obrigatório de controle; isolamento, backpressure, CSRF/origin e falha por Ambiente precisam de testes. |
| Domínio | [Como Thread, Session, Workspace, Project e Ambiente se relacionam?](../issues/08-thread-workspace.md) | Thread é 1:1 com Session e fixa a um Workspace; Project pertence a um Ambiente. Retomada preserva identidade; ramificação cria Thread e Session novas com proveniência. Evita inferência por cwd e retarget silencioso. | Thread como rename; várias Sessions por Thread; Workspace por turno ou exclusivo; Project global entre Ambientes. | Concorrência no mesmo Workspace; equivalência visual não pode virar identidade. |
| Frontend e docking | [Qual frontend e estratégia de docking preservam mais valor com menos mudança?](../issues/10-frontend.md), apoiada por [limites do Dockview](../issues/05-dockview.md) e [protótipo Lit/Dockview](../issues/09-dockview-prototype.md) | Manter Lit/Web Components e usar Dockview Core. Tornar `PiWebApp` uma casca fina e migrar Files/Diff/Terminal antes de Chat/Explorer. O protótipo não revelou impedimento estrutural. | React; Dockview Enterprise; layout próprio; transplante do runtime Effect. | Lifecycle assimétrico, foco, reparenting e popouts devem ser validados em painéis reais. |
| Navegação | [Qual navegação apresenta Projects e Threads sem esconder contexto necessário?](../issues/11-explorer-prototype.md), apoiada pela [pesquisa do T3 Code](../issues/03-t3-explorer.md) | Árvore compacta Project → buckets de estado → Threads; Workspace sempre visível; Ambiente aparece quando remoto ou ambíguo. Mantém várias origens na mesma janela sem seletor global. | Lista global por ciclo de vida; agrupamento permanente por Workspace; quatro níveis sempre visíveis. | Densidade e truncamento acessível; agrupamento visual não altera identidade. |
| Painéis e layout | [Como painéis e layouts compartilham contexto sem controlar a execução?](../issues/14-panels-layout.md) | Explorer global e Chat seguidor formam o default; demais painéis seguem ou fixam contexto. O layout local guarda apenas estado visual seguro e restaura contexto inválido como placeholder. Separa composição de execução. | Contexto sempre global/fixo; múltiplos Chats; layout no servidor; snapshots amplos; retarget/reset automático. | Compactação reversível, foco e restauração degradada exigem validação de uso. |
| Temas | [Qual contrato de temas torna a aparência substituível sem acoplar componentes?](../issues/15-themes.md) | Expandir os tokens `--pi-*` somente por lacunas reais; temas declarativos versionados, fallback core e adapters para Dockview/CodeMirror/xterm. É o menor contrato que cobre UI e WCAG 2.2 AA. | CSS arbitrário; design tokens em camadas; marketplace/theme packs e import/export na primeira entrega. | Cobertura manual de superfícies e combinações críticas de contraste. |
| Agent Runtime | [Qual interface mínima acomoda Pi agora e OMP depois?](../issues/13-agent-runtime.md), apoiada pela [comparação Pi/OMP](../issues/04-pi-omp.md) | Um seam server-side normaliza somente sessões, comandos, eventos, catálogo e interações necessárias. Pi entra agora; OMP futuro usa adapter e worker Bun próprios, capabilities explícitas e stores separados. | Drop-in de pacote; contrato comum amplo; normalização total; tentativa e erro; retomada cruzada; vault único. | Compatibilidade de versões, UI não representável e matriz de conformidade do adapter Pi. |
| Desktop Linux | [Como Electron integra servidor local e recursos nativos sem duplicar o Web?](../issues/12-desktop-platform.md), apoiada pela [pesquisa Electron/Tauri](../issues/06-desktop.md) e pelo [protótipo empacotado](../issues/18-desktop-prototype.md) | Electron é cliente fino; host persistente versionado vive sob `XDG_DATA_HOME` e tem supervisor próprio. Renderer usa a mesma API, preload mínimo e AppImage inicial. Preserva sessões após Quit sem tornar Electron dono da execução. | Filho do Electron; `detached` como produção; `systemd --user`; Tauri agora; vários formatos iniciais. | ABI de `node-pty`, runtime fora do ASAR, pacote Pi explícito, update/rollback e garantia limitada a fechar/reiniciar app. |
| Migração | [Qual sequência de migração entrega Web e Desktop preservando a infraestrutura?](../issues/16-migration.md) | Strangler interno por paridade: Web foundation; Desktop; Files/Diff/Terminal; layout/temas; Explorer; AgentRuntime Pi; Chat/corte do shell; hardening. Cada checkpoint é executável e reversível. | Rewrite branch; duas UIs permanentes; Desktop tardio; big-bang; flags permanentes; schema legado; OMP antecipado. | Dependências ocultas, segurança do gateway, lifecycle, empacotamento e licenças são gates, não trabalho opcional. |

## Cobertura do guia investigativo

| Etapa | Cobertura |
|---|---|
| A — PI WEB | [O que o PI WEB já resolve e onde estão seus acoplamentos?](../issues/01-pi-web.md) e [Current Architecture Map](current-architecture-map.md) |
| B — T3 Code arquitetura | [Quais padrões multi-client do T3 Code são comprovados pelo código?](../issues/02-t3-architecture.md) e [Qual interface separa clientes, estado compartilhado e execução?](../issues/07-client-server.md) |
| C — T3 Code UI | [O que torna Projects e Threads do T3 Code simples de navegar?](../issues/03-t3-explorer.md) e [Qual navegação apresenta Projects e Threads sem esconder contexto necessário?](../issues/11-explorer-prototype.md) |
| D — Dockview | [Quais limites do Dockview precisam ser validados com Lit?](../issues/05-dockview.md), [Dockview preserva comportamento e estado dos painéis reais do PI WEB?](../issues/09-dockview-prototype.md) e [Qual frontend e estratégia de docking preservam mais valor com menos mudança?](../issues/10-frontend.md) |
| E — Web + Electron | [Qual interface separa clientes, estado compartilhado e execução?](../issues/07-client-server.md), [O empacotamento Electron Linux preserva terminal, sessões e popouts?](../issues/18-desktop-prototype.md) e [Como Electron integra servidor local e recursos nativos sem duplicar o Web?](../issues/12-desktop-platform.md) |
| F — Pi versus OMP | [Quais diferenças reais entre Pi e OMP condicionam a integração futura?](../issues/04-pi-omp.md) e [Qual interface mínima acomoda Pi agora e OMP depois?](../issues/13-agent-runtime.md) |
| G — Tauri futuro | [Quais restrições de Electron e Tauri importam para o Desktop Linux?](../issues/06-desktop.md) e [Como Electron integra servidor local e recursos nativos sem duplicar o Web?](../issues/12-desktop-platform.md) |

## Cobertura das questões abertas

| Questão | Resolução canônica |
|---|---|
| 1, 4, 5 e 15 | [Qual frontend e estratégia de docking preservam mais valor com menos mudança?](../issues/10-frontend.md) |
| 2, 3 e 9 | [Qual interface separa clientes, estado compartilhado e execução?](../issues/07-client-server.md) |
| 6, 7 e 8 | [Como Thread, Session, Workspace, Project e Ambiente se relacionam?](../issues/08-thread-workspace.md) e [Qual navegação apresenta Projects e Threads sem esconder contexto necessário?](../issues/11-explorer-prototype.md) |
| 10 | [Qual interface separa clientes, estado compartilhado e execução?](../issues/07-client-server.md) e [Qual interface mínima acomoda Pi agora e OMP depois?](../issues/13-agent-runtime.md) |
| 11 e 12 | [Qual interface mínima acomoda Pi agora e OMP depois?](../issues/13-agent-runtime.md) |
| 13 e 14 | [Como Electron integra servidor local e recursos nativos sem duplicar o Web?](../issues/12-desktop-platform.md) |

## Escopo funcional e defaults

- **Preservados:** sessões e processos em `sessiond`; persistência; Projects/Workspaces; máquinas e acesso remoto; Files, Git/Diff e Terminal; plugins como ativos sem compatibilidade legada; Pi; realtime; path safety.
- **Primeira entrega:** Web e Electron Linux/AppImage; Pi; Explorer, Chat, Files, Diff e Terminal; docking, floating/popout, layout local persistente e temas extensíveis; acesso remoto autenticado por rede privada ou túnel.
- **Preparado, não implementado:** OMP por `AgentRuntime` e capabilities.
- **Fora do esforço:** importação de instalações antigas; compatibilidade com plugins/temas antigos; macOS, Windows e mobile; Tauri/Rust; outros runtimes; colaboração multiusuário; exposição pública direta; Agent Hub, debugger, LSP UI e painéis adicionais.

## Handoff aprovado

Leo aprovou o encerramento em [Os cinco artefatos deixam o caminho de implementação suficientemente claro?](../issues/17-handoff.md). A resolução classifica operação acessível/restauração segura como gates de UI e licenças como gate de distribuição, sem novo ticket nem mudança de arquitetura.

Os cinco artefatos, etapas A–G, questões 1–15 e links locais foram conferidos. Não restam decisões em escopo neste mapa; os gates continuam obrigatórios e não foram certificados nesta revisão documental. Implementação e distribuição não ocorreram nesta sessão.
