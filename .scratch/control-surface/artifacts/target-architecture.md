# Target Architecture

Documento incremental. As decisões completas vivem nos tickets canônicos.

## Fronteira Cliente–Ambiente

Decisão: [Qual interface separa clientes, estado compartilhado e execução?](../issues/07-client-server.md).

```text
Web / Electron renderer
        │
        ▼
Client runtime ── HTTP/JSON + WebSocket ── Gateway Web/API
                                             ├─ Ambiente local ─ sessiond ─ Pi
                                             └─ Ambiente remoto ─ Web/API ─ sessiond ─ Pi
```

- Uma origem para Web e Electron; conexões e projeções são escopadas por Ambiente.
- O gateway possui catálogo, autenticação e proxies; cada Ambiente possui execução e estado durável.
- `SessionDaemonClient` e socket Unix permanecem server-side.
- Contratos e client runtime começam como módulos internos, não packages independentes.
- Capabilities permitem degradação entre versões; major incompatível bloqueia.

## Desktop Linux

Decisão: [Como Electron integra servidor local e recursos nativos sem duplicar o Web?](../issues/12-desktop-platform.md).

- Electron é cliente fino. O Main instala o runtime versionado sob `XDG_DATA_HOME`, encontra o supervisor existente ou o inicia sob demanda, consulta seu estado e encaminha comandos de lifecycle; não supervisiona gateway ou `sessiond` diretamente.
- O supervisor possui gateway e `sessiond` e é o único responsável por seu lifecycle persistente: início, status, encerramento limpo e recuperação, independentemente do Quit da UI. Não se expande para orquestração genérica de processos, plugins de supervisão ou gerenciamento de frotas.
- A garantia inicial cobre fechar/reiniciar o app, não logout ou reboot. Settings controla o host e avisa antes de interromper agentes.
- Renderer principal e popouts utilizam a mesma origem e topologia HTTP/WS do gateway local definidas em [Qual interface separa clientes, estado compartilhado e execução?](../issues/07-client-server.md), sem schemes privilegiados adicionais que alterem a topologia de segurança. O renderer mantém isolamento rigoroso (`sandbox: true`, `contextIsolation: true`, `nodeIntegration: false` e CSP restritiva); o preload expõe apenas operações nativas curadas na janela principal, enquanto popouts não recebem preload.
- Bootstrap local vira cookie HttpOnly/Secure com proteção CSRF/origem unificada; credenciais remotas permanecem exclusivamente no gateway.
- AppImage é o canal inicial. O Main coordena a atualização do cliente Electron e prepara versões do host lado a lado. O supervisor coordena a ativação da versão do host, o health check e o rollback; a troca é adiada enquanto houver agentes ativos.
- Platform API inicial cobre exclusivamente lifecycle/update, janelas, `openExternal`, clipboard, `safeStorage` e dialogs para import/export; filesystem de Ambiente continua server-side. Notificações OS, tray e menus avançados permanecem explicitamente fora da primeira entrega.
## Frontend e Agent Runtime

Decisões: [Qual frontend e estratégia de docking preservam mais valor com menos mudança?](../issues/10-frontend.md), [Como painéis e layouts compartilham contexto sem controlar a execução?](../issues/14-panels-layout.md) e [Qual interface mínima acomoda Pi agora e OMP depois?](../issues/13-agent-runtime.md).

- Lit/Web Components permanece; Dockview Core compõe painéis registrados. `PiWebApp` deixa de possuir navegação, conexões e estado compartilhado.
- O client runtime possui projeções por Ambiente; painéis possuem apenas estado visual e contexto seguir/fixo.
- `AgentRuntime` é um seam server-side mínimo. O adapter Pi implementa sessões, comandos, eventos, catálogo e interações; capabilities carregam extensões específicas.
- Session pertence ao runtime que a criou. Filesystem, Git, Diff, Terminal, Project e Workspace ficam fora de `AgentRuntime`.
- OMP futuro usa adapter próprio e worker Bun supervisionado no Ambiente; não entra na primeira implementação.

## Caminho de transição

A ordem e os gates estão em [Migration Strategy](migration-strategy.md). O corte é incremental dentro da árvore atual, sem segunda aplicação permanente.
