# 23: Usar Files como primeiro Painel Dockview

**What to build:** Disponibilizar Files como primeiro Painel real da bancada, preservando seu serviço server-side e seu contexto no Web e Desktop.

**Blocked by:** 22/Operar a mesma Session no Desktop Linux

**Status:** ready-for-human

- [x] Files mostra e opera arquivos do Workspace selecionado sem acessar filesystem pelo cliente.
- [x] O Painel pode seguir ou fixar contexto sem retargeting silencioso.
- [x] Move, hide/reopen, floating e popout preservam contexto e estado relevante.
- [x] Foco e lifecycle continuam corretos após reparenting.
- [ ] O fluxo passa em smoke no Web e no AppImage (validação de ponta a ponta com servidor ativo e AppImage empacotado pendente de verificação no ambiente operacional).
