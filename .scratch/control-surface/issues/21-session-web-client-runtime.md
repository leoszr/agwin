# 21: Operar uma Session Web pelo Client runtime

**What to build:** Permitir que o cliente Web autentique, selecione um Ambiente e acompanhe uma Session real por contratos versionados e projeções mantidas pelo Client runtime.

**Blocked by:** 20/Estabelecer a base funcional do PI WEB

**Status:** done

- [x] O Web obtém o catálogo e conecta ao Ambiente selecionado sem receber credenciais remotas.
- [x] Snapshot, eventos e identidade da Session permanecem consistentes após reconexão.
- [x] Reiniciar UI/API não encerra a execução mantida pelo Ambiente.
- [x] Versão, capabilities e erros incompatíveis produzem degradação ou bloqueio previsível.
- [x] A falha de um Ambiente não invalida projeções de outros Ambientes.

## Resultado

Implementação entregue no commit `efa794d` junto do Desktop (22) e Files (23): `src/client/runtime/` (`ClientRuntime`, `EnvironmentConnection`), `src/client/src/controlSurface/` (`WebEnvironmentRuntime`, `RuntimeSessionSocket`), descriptor versionado em `src/server/machines/environmentDescriptor.ts` e contratos em `src/shared/protocol/contracts.ts`. Credenciais remotas permanecem no gateway via `MachineService`.

Verificação executada em 2026-09-14: `vitest run` sobre `src/client/src/controlSurface`, `src/client/runtime`, `PiWebApp.environmentRuntime.test.ts`, `environmentDescriptor.test.ts` e `contracts.test.ts` — 6 arquivos, 44 testes passaram. Catalogo/conexão independente, bloqueio por major incompatível, isolamento de falha por Ambiente e consistência snapshot/eventos são fixados nesses testes; persistência da execução no reinício da UI/API é o probe registrado em [`docs/baseline.md`](../../../docs/baseline.md).

## Comments

### 2026-09-14 — Verificação server-side complementar (agente AFK; responsável: leo)

Complemento do registro acima: os gates server-side dos critérios 1 e 4 também foram executados. `vitest run` sobre `machineService.test.ts`, `machineClient.test.ts`, `app.machines.test.ts`, `sessionRoutes.test.ts`, `environmentDescriptor.test.ts` e `contracts.test.ts` — 6 arquivos, 87 testes passaram. Sem credenciais no browser: `publicMachine` omite `token`/`headers` das respostas públicas (fixado pelos testes "omits secrets from public responses" e "without exposing stored secrets"), o Bearer remoto é injetado apenas no `RemoteMachineClient` server-side e `validateBaseUrl` rejeita URLs com credenciais. Rotas de descriptor: `GET /api/descriptor` (self) e `GET /api/machines/:machineId/descriptor` servem versão/capabilities sem expor segredos.
