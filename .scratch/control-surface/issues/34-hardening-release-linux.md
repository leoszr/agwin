# 34: Endurecer e distribuir a primeira versão Pi/Linux

**What to build:** Produzir a primeira entrega Web e AppImage para Pi/Linux com segurança, atualização, rollback, acessibilidade e obrigações de distribuição verificadas.

**Blocked by:** 33/Cortar caminhos legados com paridade comprovada

**Status:** ready-for-agent

- [ ] Isolamento entre Ambientes, autenticação, origin, CSRF, backpressure, CSP e preload passam por verificações próprias.
- [ ] Cliente e host atualizam lado a lado com health check, adiamento para agentes ativos e rollback funcional.
- [ ] ABI das dependências nativas, PTY e execução no AppImage são validados no artefato final.
- [ ] O inventário transitivo de licenças e todos os avisos exigidos acompanham a distribuição.
- [ ] Web e AppImage entregam Pi, Explorer, Chat, Files, Diff, Terminal, layout e temas com os gates registrados.
- [ ] Cada gate separa requisito aprovado, evidência disponível e verificação executada com revisão e resultado.
