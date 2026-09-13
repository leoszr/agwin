# 26: Persistir e restaurar a bancada com segurança

**What to build:** Persistir localmente a composição visual dos Painéis e restaurá-la sem controlar execução nem perder estado transitório.

**Blocked by:** 24/Usar Diff como Painel contextual; 25/Usar Terminal como Painel fixo ao Workspace

**Status:** ready-for-agent

- [ ] Somente geometria e configuração visual segura são persistidas no Cliente.
- [ ] Contextos indisponíveis restauram como placeholders recuperáveis, sem retargeting automático.
- [ ] A largura reduzida compacta e reexpande o layout sem perder seleção ou configuração.
- [ ] Restaurar o default recompõe a geometria sem apagar rascunhos, buffers, mensagens ou processos.
- [ ] Layout inválido falha de forma recuperável e não interfere na execução server-side.
