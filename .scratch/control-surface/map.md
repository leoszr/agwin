# Arquitetura e migração da control surface baseada no PI WEB

Labels: wayfinder:map
Status: resolved

## Destination

Fechar decisões fundamentadas no código real e entregar cinco artefatos: Current Architecture Map, Target Architecture, UI Model, Migration Strategy e Decision Report. Ao concluir, a implementação deve poder começar sem lacunas arquiteturais relevantes; este mapa não implementa o produto.

## Notes

- Brief original preservado em [Plano Investigativo e Arquitetural](brief.md). As afirmações sobre os projetos são pontos de partida para a pesquisa, não evidências verificadas.
- Decisões de escopo confirmadas com leo: instalação nova independente, sem obrigação de importar dados ou manter compatibilidade com extensões de instalações antigas; isso não autoriza remover funcionalidades maduras da base sem avaliação. Desktop inicial somente Linux; uso individual multi-client; acesso remoto autenticado por rede privada ou túnel, sem exposição pública direta nesta entrega.
- Cada thread pertence a um único ambiente, entendido como servidor. A mesma janela reúne threads locais e remotas, sem exigir alternância global de servidor. Vocabulário canônico em [CONTEXT.md](../../CONTEXT.md).
- Defaults do brief permanecem: PI WEB como base com evolução independente; execução e sessões persistentes do lado do servidor; Web e Electron first-class; Dockview investigado primeiro; navegação inspirada no T3 Code; painéis opcionais e layout persistente; temas extensíveis; Pi inicial, OMP posterior; não reescrever backend em Rust nem frontend em React por preferência.
- OMP entra nesta investigação como comparação e design conceitual de integração, não implementação. Tauri entra somente como comparação fundamentada para uma alternativa futura.
- Skills por sessão: `wayfinder`, `grilling` e `domain-modeling`. Pesquisa: `research`; protótipos: `prototype`; arquitetura: `codebase-design` e `ponytail`; discussão/protótipo de UI: `impeccable`.
- Tracker: [convenções locais](../../docs/agents/issue-tracker.md). Pessoa responsável: leo. Consultar filhos abertos, desbloqueados e não atribuídos, por ordem numérica. Não listar tickets abertos neste índice.
- Este esforço autoriza a consolidação dos cinco documentos como parte das resoluções, além de protótipos descartáveis necessários a decisões. Não autoriza implementar a aplicação. Usar `artifacts/` para os cinco documentos e `research/` para evidências; documentos citam os tickets canônicos, sem duplicar decisões.
- Pesquisas são independentes e podem resolver em paralelo; os demais tickets precisam de participação real de leo, no máximo um por sessão. Não converter recomendações dos pesquisadores em decisões humanas.

## Decisions so far

- [Quais padrões multi-client do T3 Code são comprovados pelo código?](issues/02-t3-architecture.md): UI Web compartilhada e conexão por ambiente são comprovadas; copiar o código também traz o acoplamento a Effect.
- [O que torna Projects e Threads do T3 Code simples de navegar?](issues/03-t3-explorer.md): A árvore Project → Threads está no modo legado; a sidebar padrão atual agrupa por ciclo de vida e mantém referências por ambiente.
- [Quais limites do Dockview precisam ser validados com Lit?](issues/05-dockview.md): Integração vanilla disponível; reparenting, lifecycle de componentes e popouts exigem protótipo antes da escolha.
- [Quais restrições de Electron e Tauri importam para o Desktop Linux?](issues/06-desktop.md): Electron segue candidato inicial; runtime embarcado, dependências nativas e sobrevivência de sessiond precisam de validação empacotada.
- [Quais diferenças reais entre Pi e OMP condicionam a integração futura?](issues/04-pi-omp.md): Bun, APIs de sessão, credenciais e UI do host exigem integração explícita; nomes e JSONL v3 não provam compatibilidade.
- [O que o PI WEB já resolve e onde estão seus acoplamentos?](issues/01-pi-web.md): Web/API e sessiond têm lifecycles separados; backend/plugins são reutilizáveis, mas estado do shell e integração Pi ainda exigem interfaces explícitas.
- [Qual interface separa clientes, estado compartilhado e execução?](issues/07-client-server.md): Um gateway same-origin concentra acesso e credenciais; Ambientes mantêm execução, enquanto o Cliente usa projeções por Ambiente sobre HTTP/WS versionado.

- [Como Thread, Session, Workspace, Project e Ambiente se relacionam?](issues/08-thread-workspace.md): Thread é 1:1 com Session e fixa a um Workspace compartilhável; Projects são próprios de cada Ambiente, e retomada/ramificação preservam identidade e proveniência.

- [Dockview preserva comportamento e estado dos painéis reais do PI WEB?](issues/09-dockview-prototype.md): O estudo com Lit, CodeMirror e xterm foi aceito sem impedimento estrutural; temas devem ser estritamente neutros, claros em brancos e escuros em preto/cinzas.
- [Qual frontend e estratégia de docking preservam mais valor com menos mudança?](issues/10-frontend.md): Lit e Dockview Core ficam; PiWebApp vira casca fina, plugins preservam capacidades e os painéis migram em duas ondas, sem Effect agora.
- [Qual navegação apresenta Projects e Threads sem esconder contexto necessário?](issues/11-explorer-prototype.md): A árvore compacta agrupa Threads por estado dentro de cada Project, mantém Workspace sempre visível e identifica Ambientes remotos ou ambíguos.
- [Qual interface mínima acomoda Pi agora e OMP depois?](issues/13-agent-runtime.md): AgentRuntime normaliza apenas o núcleo, isola Pi agora e OMP depois por capabilities, processos, sessões e credenciais próprias.
- [Como painéis e layouts compartilham contexto sem controlar a execução?](issues/14-panels-layout.md): Um Chat e o Explorer global orientam o contexto; demais painéis seguem ou fixam Workspace, e o layout local restaura configuração segura sem possuir execução.
- [Qual contrato de temas torna a aparência substituível sem acoplar componentes?](issues/15-themes.md): Tokens semânticos mínimos e temas declarativos versionados cobrem toda UI Web via adapters, com fallback core, preferência local e validação WCAG 2.2 AA.\n
- [O empacotamento Electron Linux preserva terminal, sessões e popouts?](issues/18-desktop-prototype.md): O pacote real validou runtime embutido, PTY, reconexão de Session e popout sandboxed; sessiond precisa de lifecycle supervisionado, não apenas processo detached.
- [Como Electron integra servidor local e recursos nativos sem duplicar o Web?](issues/12-desktop-platform.md): Electron é cliente fino de um host próprio persistente; AppImage, ponte nativa mínima e updates adiados preservam sessões sem duplicar o Web.

- [Qual sequência de migração entrega Web e Desktop preservando a infraestrutura?](issues/16-migration.md): Um strangler interno corta por paridade verificável, leva Web à mesma API antes do AppImage e migra painéis, layout, Explorer, AgentRuntime Pi e Chat sem implementar OMP.
- [Qual síntese torna as decisões auditáveis sem duplicar os tickets?](issues/19-decision-report.md): O Decision Report indexa decisões, evidências, alternativas e riscos e confirma cobertura das etapas A–G e questões abertas 1–15.

- [Os cinco artefatos deixam o caminho de implementação suficientemente claro?](issues/17-handoff.md): Leo aprovou o handoff; operação acessível/restauração segura e licenças ficam como gates obrigatórios, sem decisões restantes neste mapa.

## Not yet specified

## Out of scope

- Implementar o produto, reorganizar o backend de produção ou executar as fases de desenvolvimento do roadmap durante este mapa.
- Migrar instalações antigas do PI WEB ou garantir compatibilidade com seus plugins e temas. A entrega é uma instalação nova independente.
- Desktop para macOS ou Windows nesta primeira entrega; mobile, implementação Tauri, backend Rust e runtimes além de Pi/OMP.
- Implementar OMP, Agent Hub, debugger, LSP UI e painéis adicionais nesta investigação; capacidades futuras podem informar as decisões, sem gerar builds antecipados.
- Colaboração multiusuário, identidades distintas em um servidor compartilhado e publicação direta na Internet nesta primeira entrega. Autenticação para uso remoto privado continua em escopo.
