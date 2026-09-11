# Arquitetura e migração da control surface baseada no PI WEB

Labels: wayfinder:map
Status: open

## Destination

Fechar decisões fundamentadas no código real e entregar cinco artefatos: Current Architecture Map, Target Architecture, UI Model, Migration Strategy e Decision Report. Ao concluir, a implementação deve poder começar sem lacunas arquiteturais relevantes; este mapa não implementa o produto.

## Notes

- Brief original preservado em [Plano Investigativo e Arquitetural](brief.md). As afirmações sobre os projetos são pontos de partida para a pesquisa, não evidências verificadas.
- Decisões de escopo confirmadas com leo: instalação nova independente, sem obrigação de importar dados ou manter compatibilidade com extensões de instalações antigas; isso não autoriza remover funcionalidades maduras da base sem avaliação. Desktop inicial somente Linux; uso individual multi-client; acesso remoto autenticado por rede privada ou túnel, sem exposição pública direta nesta entrega.
- Cada thread pertence a um único ambiente, entendido como servidor. A mesma janela reúne threads locais e remotas, sem exigir alternância global de servidor. O vínculo entre thread, workspace e sessão permanece aberto. Vocabulário canônico em [CONTEXT.md](../../CONTEXT.md).
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

## Not yet specified

- Detalhamento dos contratos e das operações de migração que só aparecerá quando as interfaces propostas forem confrontadas com os acoplamentos reais da base.
- Ajustes de interação, acessibilidade e restauração de estado revelados pelo uso dos protótipos de docking e navegação, ainda sem inventariar antecipadamente cada caso.
- Consequências de incompatibilidades ou restrições de licença descobertas nas referências: poderão abrir novas decisões, sem presumir que a solução seja reescrever.

## Out of scope

- Implementar o produto, reorganizar o backend de produção ou executar as fases de desenvolvimento do roadmap durante este mapa.
- Migrar instalações antigas do PI WEB ou garantir compatibilidade com seus plugins e temas. A entrega é uma instalação nova independente.
- Desktop para macOS ou Windows nesta primeira entrega; mobile, implementação Tauri, backend Rust e runtimes além de Pi/OMP.
- Implementar OMP, Agent Hub, debugger, LSP UI e painéis adicionais nesta investigação; capacidades futuras podem informar as decisões, sem gerar builds antecipados.
- Colaboração multiusuário, identidades distintas em um servidor compartilhado e publicação direta na Internet nesta primeira entrega. Autenticação para uso remoto privado continua em escopo.
