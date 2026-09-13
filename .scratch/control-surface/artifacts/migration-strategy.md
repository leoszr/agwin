# Migration Strategy

Decisão canônica: [Qual sequência de migração entrega Web e Desktop preservando a infraestrutura?](../issues/16-migration.md). Arquitetura de partida: [Current Architecture Map](current-architecture-map.md). Destino: [Target Architecture](target-architecture.md) e [UI Model](ui-model.md).

## Estratégia

Aplicar um **strangler interno** na árvore atual. Cada checkpoint fica executável e substitui um caminho antigo por paridade de capacidade. Não manter duas aplicações completas, não criar monorepo e não importar dados, plugins ou temas de instalações antigas.

Preservar `sessiond`, stores, Projects/Workspaces, máquinas/proxy remoto, Files, Git/Diff, Terminal, plugins, path safety, integração Pi e realtime. Refatorar somente as fronteiras que impedem o destino. Remover o caminho antigo assim que seu substituto passar pelo gate; flags locais são temporárias e só existem quando o corte não puder ser atômico.

## Sequência e checkpoints

0. **Preparação e base de código**
   - Estabelecer a base de código derivada de `jmfederico/pi-web`, preservando integralmente avisos de copyright e proveniência MIT.
   - Registrar o commit utilizado e sua relação com a revisão pesquisada: `46579c049a305b6a146d1028e539ca6d071fbfb4`. Se outra revisão for adotada, registrar as diferenças materiais.
   - Verificar que os fluxos relevantes funcionam na base antes de iniciar a reorganização.
   - Não criar uma aplicação vazia para reimplementar capacidades existentes nem importar dados de instalações antigas.
   - Critério de aceite: implementador consegue identificar o código de partida, executá-lo e distinguir comportamento preexistente de mudanças da migração.

1. **Foundation Web**
   - Introduzir contratos versionados em `src/shared/protocol/` com `environmentId`, descriptor, capabilities e erros.
   - Extrair conexões, snapshots, subscriptions e projeções de `sessionSocket.ts`/`chatTranscriptStore.ts` para `src/client/runtime/`.
   - Manter `SessionDaemonClient`, gateway, `sessiond` e stores como autoridades atuais.
   - Criar shell Lit mínimo; `PiWebApp` ainda delega para caminhos antigos durante o corte.
   - Gate: bootstrap/autenticação, catálogo multi-Ambiente, snapshot/reconexão e uma Session real funcionam no Web sem terminar execução ao reiniciar a UI/API.

2. **Desktop first-class**
   - Adicionar Electron como cliente fino da mesma origem e API; instalar host versionado sob `XDG_DATA_HOME` com supervisor próprio.
   - Manter renderer sandboxed, preload curado, cookie HttpOnly e AppImage autocontido.
   - Gate: AppImage inicia/encontra o host, Web e Desktop controlam a mesma Session, PTY nativo carrega, restart do renderer/gateway reconecta e rollback de host passa no health check.
   - A partir daqui, todo corte de UI exige smoke Web e AppImage.

3. **Painéis de infraestrutura**
   - Instalar Dockview Core e o registro mínimo de painéis.
   - Migrar, nesta ordem prática, Files, Diff e Terminal, reutilizando `pi-web-plugins/files`, Git e terminal server-side; corrigir lifecycle apenas onde o painel real exigir.
   - Gate por painel: seguir/fixar Workspace, hide/reopen, move/floating/popout, foco e estado transitório; Terminal inclui PTY e reconexão reais.
   - Marco antecipado de bancada funcional (cenário integrado em 5 passos usando Chat e navegação existentes durante a transição):
     1. Selecionar um Workspace e operar uma Session real.
     2. Enviar prompt pelo Chat existente e acompanhar resposta.
     3. Usar pelo menos um painel real de infraestrutura em Dockview.
     4. Mover, ocultar e reabrir o painel sem perder contexto ou estado relevante.
     5. Observar a mesma Session no Web e Desktop sem duplicar execução.
   - Critério de aceite: bancada funcional para trabalho real antes do corte final de PiWebApp, sem depender apenas de caixas ou mensagens simuladas.

4. **Layout e temas**
   - Persistir apenas geometria, tipo, modo seguir/fixo, vínculos e estado visual seguro; restaurar entradas inválidas como placeholders.
   - Consolidar tokens `--pi-*`, descriptors e adapters de Dockview/CodeMirror/xterm antes dos painéis mais acoplados.
   - Gate: restauração versionada, compactação reversível, popout e troca `auto`/light/dark sem reload; foco, estados não dependentes de cor e WCAG 2.2 AA nas combinações críticas.
   - Gate adicional de handoff: operação por teclado, alternativas ao arrasto e restauração manual segura do default no Web/AppImage, conforme [Os cinco artefatos deixam o caminho de implementação suficientemente claro?](../issues/17-handoff.md).

5. **Project Explorer**
   - Extrair navegação e seleção de `PiWebApp`; implementar Project → buckets de estado → Threads com Workspace visível e Ambiente contextual.
   - Introduzir diretamente o novo schema durável de Thread–Session–Workspace para instalações novas. Migrações passam a existir somente a partir do primeiro release desta aplicação.
   - Gate: criar, selecionar, retomar e ramificar Thread; lidar com Ambiente/Workspace indisponível sem perder histórico ou retarget automático.

6. **AgentRuntime Pi**
   - Encapsular os imports em `src/server/sessions/` e serviços de auth/model/trust/attachments/tools no seam server-side `AgentRuntime`.
   - Entregar adapter Pi, descriptor/capabilities, identidade de runtime por Session, erros explícitos e testes de conformidade/matriz de versões.
   - Não implementar adapter OMP, worker Bun, conversão de Sessions ou abstrações para outros agentes.
   - Gate: todos os fluxos Pi existentes passam pelo adapter; incompatibilidade bloqueia startup/nova Session e capability ausente não gera fallback falso.

7. **Chat e corte do shell antigo**
   - Migrar Chat/Prompt após AgentRuntime e mover o estado compartilhado restante para client runtime/contextos pequenos.
   - Reduzir `PiWebApp` à composição e então removê-lo quando não possuir mais estado ou fluxo exclusivo.
   - Gate: prompt, steer/follow-up, abort, transcript/replay, tools, attachments, trust, modelos, interações tipadas, reconexão e execução longa em Web/AppImage.

8. **Hardening e release Pi/Linux**
   - Exercitar falha isolada por Ambiente, atualização lado a lado, rollback, segurança do gateway/preload, acessibilidade e atribuições.
   - Encerrar a primeira entrega com Web, Electron Linux/AppImage, Pi, Explorer, Chat, Files, Diff, Terminal, layout e temas.

## Regra de corte e reversão

### Paridade funcional por capacidade
Antes de cada corte, registrar obrigatoriamente uma lista curta com:
- **Capacidade:** recurso ou funcionalidade afetada.
- **Fluxo relevante:** caminho de execução no produto.
- **Comportamento a preservar:** garantia funcional esperada.
- **Verificação correspondente:** teste ou prova direta de validação.

Exemplos de capacidades a cobrir a partir dos caminhos reais afetados: reconexão, identidade de Session, rascunhos, attachments, trust, interações de tools/extensões, limites do canal de terminal e isolamento entre Ambientes. Ausência de compatibilidade legada não autoriza perda de capacidade; qualquer perda relevante exige decisão explícita antes do corte.

Critério de aceite: toda remoção de código tem evidência documentada de substituição funcional equivalente.

### Execução de corte e reversão
Cada remoção exige testes direcionados de contrato/estado e o fluxo real correspondente. Depois do checkpoint Desktop, exige também smoke no AppImage. Reversão é por versão/checkpoint; preservar a versão anterior do host até health check. Não manter flags permanentes nem schemas legados sem requisito.

### Registro e validação de gates
No registro de cada gate, distinguir explicitamente:
1. **Requisito aprovado:** especificação arquitetural ou contrato aceito.
2. **Evidência disponível:** testes, builds ou artefatos já gerados nesta revisão.
3. **Verificação ainda pendente:** comando/cenário de teste, revisão Git e resultado esperado a executar.

Regras de governança dos gates:
- Nenhum gate é considerado atendido apenas porque o ticket de arquitetura foi resolvido.
- Estudos e protótipos prévios (como Dockview isolado ou protótipo Electron) comprovam viabilidade técnica, mas não substituem os gates de integração real (ex: prompt completo com modelo externo, lifecycle completo de painéis).
- Acessibilidade (WCAG 2.2 AA), segurança (isolamento, CSP, tokens) e inventário de licenças de dependências redistribuídas exigem verificações executadas próprias antes da liberação.

## Roadmap original reordenado

- Fases 1 e 2 viram checkpoints 1–2.
- Fases 3, 5 e 6 viram checkpoints 3–4 porque layout e temas dependem de painéis reais.
- Fase 4 vira checkpoint 5.
- Fase 7 entra antes do Chat, entre Explorer e o corte final da UI.
- Fase 8 (OMP) e Fase 9 (expansão) ficam posteriores à primeira entrega; a preparação de OMP termina no seam e nos testes Pi.

## Riscos e limites

- `PiWebApp` pode esconder dependências não inventariadas: cortar por capacidade, não por contagem de arquivos.
- Reparenting/popout pode revelar lifecycle assimétrico: corrigir localmente, sem trocar Lit/Dockview sem impedimento reproduzível.
- ABI de `node-pty`, mount temporário do AppImage e lifecycle do host são gates de release.
- Gateway obrigatório concentra acesso: testar isolamento, backpressure, CSRF/origin e falha por Ambiente.
- Preservar avisos MIT de PI WEB/Pi/Dockview e gerar inventário das licenças de todas as dependências redistribuídas. É gate obrigatório de distribuição, ainda não executado; incompatibilidade concreta exige decisão antes de distribuir, conforme [Os cinco artefatos deixam o caminho de implementação suficientemente claro?](../issues/17-handoff.md).

Fora desta estratégia: importador do PI WEB antigo, compatibilidade com extensões antigas, OMP implementado, Tauri, macOS/Windows, colaboração multiusuário e exposição pública direta.
