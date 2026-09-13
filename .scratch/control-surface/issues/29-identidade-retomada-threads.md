# 29: Preservar identidade e retomada de Threads

**What to build:** Tornar Thread o registro durável de navegação que retoma sua Session e conserva seu vínculo com Workspace mesmo em estados degradados.

**Blocked by:** 28/Navegar por Projects e Threads em múltiplos Ambientes

**Status:** ready-for-agent

- [ ] Cada Thread referencia exatamente uma Session e mantém vínculo imutável com um Workspace.
- [ ] Retomar uma Thread retoma a mesma Session sem duplicar execução.
- [ ] Ramificar cria nova Thread e nova Session ligadas ao ponto de origem.
- [ ] Várias Threads podem compartilhar um Workspace sem isolamento implícito.
- [ ] Thread indisponível permanece legível e recuperável sem redirecionamento automático.
- [ ] Project continua pertencendo ao seu Ambiente, sem identidade global presumida.
