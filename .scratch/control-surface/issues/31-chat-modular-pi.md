# 31: Substituir o Chat legado pelo Chat modular

**What to build:** Entregar um único Chat seguidor em Painel que controla uma Session Pi completa e recupera seu estado após reconexão no Web e Desktop.

**Blocked by:** 26/Persistir e restaurar a bancada com segurança; 27/Aplicar temas neutros acessíveis à bancada; 30/Executar Pi pelo seam Agent runtime

**Status:** ready-for-agent

- [ ] Prompt, steer/follow-up e abort funcionam em uma Session real.
- [ ] Transcript e replay permanecem consistentes após reconexão ou troca de cliente.
- [ ] Modelos, attachments, tools, trust e interações tipadas mantêm paridade com o caminho anterior.
- [ ] Uma troca insegura de Thread preserva rascunho e fixa contexto quando necessário.
- [ ] Uma execução longa pode ser acompanhada no Web e AppImage sem criar outra Session.
- [ ] Um prompt completo com modelo externo é validado no fluxo real.
