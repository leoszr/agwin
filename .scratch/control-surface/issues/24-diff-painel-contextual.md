# 24: Usar Diff como Painel contextual

**What to build:** Permitir que a pessoa abra e organize múltiplos Painéis Diff, seguidores ou fixos, sem confundir mudanças entre Workspaces.

**Blocked by:** 23/Usar Files como primeiro Painel Dockview

**Status:** ready-for-human

- [x] Diff exibe mudanças Git do Workspace correto usando o serviço existente.
- [x] Instâncias seguidoras acompanham a seleção segura e instâncias fixas mantêm seu contexto.
- [x] Uma mudança insegura auto-fixa o Painel e informa a pessoa.
- [x] Move, hide/reopen, floating e popout preservam o estado relevante.
- [ ] O fluxo passa em smoke no Web e no AppImage (validação de ponta a ponta com servidor ativo e AppImage empacotado pendente de verificação no ambiente operacional).

## Comments

### 2026-09-14 — Implementação (agente AFK; responsável: leo)

`DiffDockviewPanel` alcança a paridade da entrega de Files (23): `implements IWorkbenchPanelInstance` com `setMode`/`setDirty`/`onAutoPinned`/`dispose`; modo seguidor recarrega do Workspace novo ao trocar contexto, modo fixado ignora trocas sem consultar o serviço, auto-pin em mudança insegura fixa o painel e anuncia no cabeçalho, e seleção/diff sobrevivem a move, hide/reopen, floating e popout. O serviço real é `createGitDiffService`: consome o backend do plugin Git existente (operações `status`/`diff` via `requestPluginBackend`, alvo escopado por `machineId`/`projectId`/`workspaceId`, com fallback de projectId ao workspace), e o shell injeta o serviço por `ModularWorkbenchAppOptions.diffService`. `DockviewWorkbench` ganhou `addDiffPanel` e instancia painéis Diff vivos ao restaurar layout salvo.

Verificação em 2026-09-14: `vitest run src/client/workbench` — 8 arquivos, 44 testes passaram, cobrindo seguidor/fixado/auto-pin com aviso visível, integração e restauração no DockviewWorkbench e o mapeamento status/diff do backend Git; `npm run typecheck` e `eslint` dos arquivos alterados passaram. Sem changeset: o painel ainda não está montado no cliente publicado (mesma convenção da entrega de Files).

O smoke de Web/AppImage permanece pendente de ambiente operacional; nota de risco: o host do AppImage herda `~/.pi-web` como data dir e disputa o `sessiond` systemd ativo (`pi-web-sessiond.service`), então a validação empacotada fica como decisão do operador.
