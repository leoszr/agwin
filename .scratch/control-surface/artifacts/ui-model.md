# UI Model

Síntese da interface aprovada para handoff. As decisões canônicas vivem nos tickets vinculados.

## Project Explorer

A navegação segue a decisão [Qual navegação apresenta Projects e Threads sem esconder contexto necessário?](../issues/11-explorer-prototype.md).

- Estrutura base: árvore compacta Project → buckets de estado → Threads.
- Contexto por Thread: Workspace sempre visível; Ambiente identificado quando remoto ou quando necessário distinguir destinos.
- Ação prioritária: criar Thread, disponível globalmente e no Project, com escolha do contexto aplicável.
- Estados mínimos do estudo: execução, espera, recente/concluído e Ambiente indisponível.
- O protótipo comparativo permanece na branch `prototype/explorer-navigation` (commit `802aca2`).

## Painéis e layout

O contrato transversal segue [Como painéis e layouts compartilham contexto sem controlar a execução?](../issues/14-panels-layout.md).

- Default: Project Explorer global à esquerda e um único Chat seguidor no centro; os demais painéis abrem sob demanda.
- Files e Diff podem ter múltiplas instâncias seguidoras ou fixas; Terminal pode ter múltiplas instâncias e nasce fixo ao Workspace; Explorers adicionais podem fixar Ambiente ou Project.
- Seleção no Explorer ou foco no Chat define a Thread ativa. Uma troca insegura auto-fixa o painel afetado e avisa, sem bloquear navegação.
- O layout fica no Cliente e persiste somente geometria e configuração visual segura. Contextos indisponíveis restauram como placeholders recuperáveis.
- Um único layout adapta-se reversivelmente à largura. Floating e popout são iniciais; no Electron, popouts usam a mesma origem HTTP/WS e não recebem preload.
- O registro usa descriptors mínimos e não concede a painéis propriedade sobre execução.
- Operação por teclado, alternativas ao arrasto e restauração manual segura do default são gates obrigatórios. Contrato final em [Os cinco artefatos deixam o caminho de implementação suficientemente claro?](../issues/17-handoff.md).

## Temas e acessibilidade

O contrato transversal segue [Qual contrato de temas torna a aparência substituível sem acoplar componentes?](../issues/15-themes.md).

- Direção visual estritamente neutra: superfícies estruturais, fundos, painéis e bordas usam tons neutros (branco/off-whites no tema claro e preto/cinzas escuros no tema escuro), conforme [Dockview preserva comportamento e estado dos painéis reais do PI WEB?](../issues/09-dockview-prototype.md). Proibida a introdução de paletas decorativas ou acentos arbitrários.
- Ações primárias, seleção ativa, indicador de foco e indicadores de status operacional (execução, erro, espera, offline) usam exclusivamente a mesma paleta neutra, sem acentos coloridos. Contraste tonal, ícones e rótulos distinguem ação e estado.
- Separação mandatória entre superfícies estruturais da UI e conteúdo com semântica própria: saídas de terminal (sequências ANSI no xterm), realce de sintaxe e marcadores de diff de código (CodeMirror) preservam suas cores semânticas isoladas dos tokens estruturais da bancada, sem colisões ou contaminações mútuas.
- O conjunto semântico `--pi-*` existente continua como base e cresce apenas por lacunas reais; componentes não conhecem temas concretos.
- Temas core ou de plugins usam descriptor declarativo versionado, variantes `light`/`dark` pareáveis e valores CSS validados para tokens conhecidos.
- Tema inválido é rejeitado integralmente com diagnóstico e fallback core. `auto` segue `prefers-color-scheme`; a preferência fica local ao Cliente.
- Adapters cobrem Dockview, CodeMirror e xterm; shell, painéis, diálogos e popouts participam do mesmo contrato.
- Electron sincroniza modo e cor base, sem prometer tematização integral de UI nativa.
- Suporte exige foco visível, estados operacionais comunicados além de cor e contraste WCAG 2.2 AA em todos os controles, com checks críticos automatizados e revisão manual das superfícies.
- Import/export, theme packs, marketplace, CSS arbitrário e tokens em múltiplas camadas ficam fora da primeira entrega.

## Critérios de aceitação e gates operacionais

A validação da interface exige testes contra cenários reais de uso contínuo, cobrindo legibilidade, acessibilidade e integridade operacional:

- **Múltiplos Projects e Threads homônimas:** Operação simultânea com múltiplos Projects carregados e Threads de mesmo nome em projetos distintos; Workspace visível e identificação de Ambiente mantêm o destino de execução inequívoco e a seleção encontrável.
- **Ambientes locais e remotos concorrentes:** Identificação clara e instantânea do destino de execução com Ambientes locais e remotos operando simultaneamente, tanto no Explorer quanto na criação rápida de Thread.
- **Estados simultâneos heterogêneos:** Apresentação simultânea de Threads em execução ativa, em espera de input/aprovação, com erro de execução e com Ambiente offline. A distinção visual deve ser imediata e nunca depender unicamente de cor (uso obrigatório de ícones, rótulos textuais e marcadores acessíveis com contraste WCAG 2.2 AA).
- **Largura reduzida e viewport restrito:** Compactação reversível da árvore de navegação e dos painéis com truncamento acessível (tooltips sem perda de texto, foco navegável e leitor de tela), preservando seleção e legibilidade do contexto ativo sem quebra de layout.
- **Operação completa por teclado:** Navegação estrutural, alternância entre Explorer, Chat e painéis secundários, criação de Threads e acionamento de ações sem dependência de ponteiro. Anéis de foco visíveis em conformidade WCAG 2.2 AA e ausência de armadilhas de foco.
- **Alternativas ao arrasto (drag & drop):** Todas as operações de docking, divisão, reordenação de abas, floating e popout dispõem de comandos diretos via teclado ou menus de contexto acessíveis.
- **Restauração manual segura do default:** Redefinição de layout para o default recupera a geometria padrão de fábrica sem perda de rascunhos, buffers de terminal, mensagens não enviadas ou estado transitório de painéis, e sem interferir nos processos em execução no host.

## Desktop Linux

A superfície nativa segue [Como Electron integra servidor local e recursos nativos sem duplicar o Web?](../issues/12-desktop-platform.md).

- Fechar ou usar Quit encerra o cliente, não o host persistente. Settings mostra estado e oferece Stop/Restart com aviso para agentes ativos.
- Popouts são janelas sem preload e usam a mesma origem HTTP/WS; a janela principal mantém uma Platform API mínima e curada.
- Dialogs locais servem apenas a importação/exportação, upload/download. Files e Workspaces continuam representando o filesystem do Ambiente.
- Notificações OS, deep links, tray, atalhos globais e menus avançados não entram na primeira entrega.
