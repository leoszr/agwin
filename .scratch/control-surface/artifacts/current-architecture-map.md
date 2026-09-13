# Current Architecture Map

Base factual: PI WEB `46579c049a305b6a146d1028e539ca6d071fbfb4`. Evidências completas em [O que o PI WEB já resolve e onde estão seus acoplamentos?](../issues/01-pi-web.md).

```text
Browser ── HTTP/WS ── src/server/index.ts / app.ts (Web/API)
                              │
                       SessionDaemonClient
                              │ Unix socket ou TCP
                              ▼
                    src/server/sessiond.ts
                 ┌────────────┼─────────────┐
          PiSessionService  ProjectStore  plugins server-side
                 │              │             │
             Pi SDK         Projects /     Workspace providers,
                            Workspaces      Files, Git/Diff, Terminal
```

## Fronteiras que já funcionam

- Web/API e `sessiond` são processos separados. O daemon possui sessões, processos e estado durável; reiniciar UI/API não precisa encerrar agentes.
- `SessionDaemonClient`, `SessionEventHub`, `ProjectService`/`ProjectStore`, `WorkspaceProviderRegistry`, `MachineService`, path safety, serviços de Files/Git/Terminal e HTTP/WebSocket são ativos preserváveis.
- Ambientes remotos já passam por `MachineService`, `machineClient` e proxy HTTP/WS server-side; credenciais não precisam chegar ao browser.
- Plugins têm contribuições client e server. Files, Diff e Terminal já possuem componentes e backends separáveis.
- Tokens semânticos ficam em `src/client/src/theme.ts`; o realtime usa `sessionSocket.ts` e `chatTranscriptStore.ts`.

## Acoplamentos que a migração precisa cortar

- `src/client/src/components/PiWebApp.ts` concentra composição, navegação, seleção, controllers, plugins, diálogos e contexto.
- O protocolo existente não explicita `environmentId`, versão e capabilities como contrato multi-client.
- `src/server/sessions/` e serviços auxiliares importam diretamente `@earendil-works/pi-coding-agent`, `@earendil-works/pi-agent-core` e `@earendil-works/pi-ai`.
- A relação atual de Session com cwd não expressa o modelo durável Thread–Session–Workspace decidido para o produto.
- Electron e o supervisor persistente do host ainda não existem na base; o protótipo apenas validou viabilidade.

## Limites

Este mapa descreve a revisão pesquisada, não promete que caminhos posteriores permaneçam iguais. Licença PI WEB/Pi: MIT, com avisos preservados; dependências redistribuídas pelo AppImage exigem inventário de licenças próprio.
