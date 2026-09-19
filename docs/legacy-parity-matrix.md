# Matriz de Paridade Funcional e Corte de Caminhos Legados

> Evidência parcial: as verificações abaixo usam Gateway/mocks em memória
> (`sessionParity.test.ts` usa Gateway em memória). Não contam como smoke real.
> O corte de cada caminho legado exige smoke real no Web e no AppImage instalado
> (ver Gate 5 em `docs/release-gates-pi-linux.md`).

| Capacidade | Fluxo relevante | Comportamento preservado | Verificação executada |
|---|---|---|---|
| **Conexão e Catálogo Multi-Ambiente** | Seleção de ambiente na UI -> Gateway -> sessiond | O cliente Web e Desktop obtêm catálogo sem receber credenciais remotas. Falha de um ambiente não invalida outros. | `src/client/runtime/ClientRuntime.test.ts` |
| **Persistência de Execução Server-Side** | Iniciar comando longo -> Fechar/reiniciar UI ou Gateway | A execução e os processos continuam ativos no `sessiond` do Ambiente; reconexão restaura transcript. | `src/desktop/sessionParity.test.ts`, `src/client/runtime/ClientRuntime.test.ts` |
| **Navegação Project & Thread** | Project Explorer -> Selecionar ou criar Thread | Árvore compacta por Project e buckets de estado, com Workspace sempre visível e disambiguação de homônimos. | `src/client/explorer/ProjectExplorer.test.ts` |
| **Identidade de Thread e Retomada** | Retomar / Ramificar Thread | Relação 1:1 com Session, vínculo imutável com Workspace; ramificação cria nova Session sem alterar histórico pai. | `src/client/domain/thread.test.ts` |
| **Painel Files** | Abrir arquivos no Workspace | Operações via serviço server-side sem acesso a filesystem local pelo cliente; preservação de estado em move/popout. | `src/client/workbench/FilesDockviewPanel.test.ts` |
| **Painel Diff** | Revisão de mudanças Git no Workspace | Múltiplas instâncias seguidoras/fixas; auto-fixação preventiva em mudanças inseguras com aviso à pessoa usuária. | `src/client/workbench/DiffDockviewPanel.test.ts` |
| **Painel Terminal** | Linha de comando com PTY | Terminal nasce fixo ao Workspace de criação; respeita limites do canal; encerramento do cliente não mata o PTY. | `src/client/workbench/TerminalDockviewPanel.test.ts` |
| **Persistência de Layout** | Fechar e reabrir bancada / viewports estreitos | Apenas geometria e configuração visual segura são persistidas localmente; compactação reversível; recuperação segura. | `src/client/workbench/layoutStorage.test.ts` |
| **Temas e Acessibilidade** | Troca claro/escuro/auto e navegação por teclado | Paleta estritamente neutra; isolamento de cores semânticas; atalhos e menus alternativos a arrasto; WCAG 2.2 AA. | `src/client/src/theme.test.ts`, `src/client/src/plugins/registry.test.ts`, `src/client/workbench/accessibleActions.test.ts` |
| **AgentRuntime Seam (Pi)** | Execução de prompts, steer, follow-up, abort, modelos | Adapter Pi encapsula ciclo de vida com gravação de runtime criador; sem acoplamento a fs/git/terminal; sem adapter OMP falso. | `src/server/agent/piAgentRuntimeAdapter.test.ts` |
| **Chat Modular** | Conversa contínua no centro da bancada | Segue a Thread ativa por padrão; preserva rascunho do composer ao alternar contexto; suporta execução longa compartilhada. | `src/client/workbench/ModularChatPanel.test.ts` |
| **Host Desktop Linux** | AppImage inicia/encontra host persistente | Supervisor versionado com health check e rollback; sandbox, contextIsolation, CSP estrita e preload curado; popouts isolados. | `src/desktop/supervisor.test.ts`, `src/desktop/desktopSecurity.test.ts` |
