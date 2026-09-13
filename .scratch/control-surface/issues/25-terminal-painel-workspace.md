# 25: Usar Terminal como Painel fixo ao Workspace

**What to build:** Permitir múltiplos Terminais com PTY real, cada um fixado ao Workspace em que foi criado, no Web e Desktop.

**Blocked by:** 23/Usar Files como primeiro Painel Dockview

**Status:** ready-for-agent

- [ ] Cada Terminal nasce fixado ao Workspace escolhido e nunca troca silenciosamente de destino.
- [ ] O PTY real aceita entrada, transmite saída e respeita os limites do canal existente.
- [ ] Reconexão, hide/reopen, move, floating e popout preservam o processo e seu contexto.
- [ ] Fechar o cliente não encerra indevidamente processos pertencentes ao host.
- [ ] O fluxo passa em smoke no Web e no AppImage.
