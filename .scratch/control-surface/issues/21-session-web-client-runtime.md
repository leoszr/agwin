# 21: Operar uma Session Web pelo Client runtime

**What to build:** Permitir que o cliente Web autentique, selecione um Ambiente e acompanhe uma Session real por contratos versionados e projeções mantidas pelo Client runtime.

**Blocked by:** 20/Estabelecer a base funcional do PI WEB

**Status:** ready-for-agent

- [ ] O Web obtém o catálogo e conecta ao Ambiente selecionado sem receber credenciais remotas.
- [ ] Snapshot, eventos e identidade da Session permanecem consistentes após reconexão.
- [ ] Reiniciar UI/API não encerra a execução mantida pelo Ambiente.
- [ ] Versão, capabilities e erros incompatíveis produzem degradação ou bloqueio previsível.
- [ ] A falha de um Ambiente não invalida projeções de outros Ambientes.
