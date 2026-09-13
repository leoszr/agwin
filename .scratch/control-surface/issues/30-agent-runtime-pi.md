# 30: Executar Pi pelo seam Agent runtime

**What to build:** Operar Sessions Pi por um seam server-side mínimo, preservando todas as capacidades atuais e deixando runtimes futuros desacoplados.

**Blocked by:** 29/Preservar identidade e retomada de Threads

**Status:** ready-for-agent

- [ ] O adapter Pi cobre criação e retomada de Session, comandos, eventos, catálogo e interações.
- [ ] Cada Session registra o runtime que a criou e não presume portabilidade.
- [ ] Filesystem, Git, Diff, Terminal, Project e Workspace permanecem fora do Agent runtime.
- [ ] Capabilities específicas degradam de forma explícita sem contaminar o contrato base.
- [ ] A matriz do adapter prova paridade Pi antes de qualquer remoção do acoplamento legado.
- [ ] Nenhum adapter OMP funcional é introduzido.
