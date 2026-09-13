# Control surface modular para coding agents

Status: ready-for-agent

## Problem Statement

Uma pessoa desenvolvedora que trabalha com coding agents não tem uma única interface modular para acompanhar e controlar, com segurança, sessões persistentes executadas em ambientes locais e remotos privados. O PI WEB já oferece execução persistente, projetos, workspaces, arquivos, diff, terminal e acesso remoto, mas sua interface e seus contratos concentram responsabilidades e não sustentam bem múltiplos clientes, docking livre, navegação por threads nem um Desktop de primeira classe.

A pessoa precisa usar Web e Desktop sem duplicar execução, perder contexto ou encerrar agentes ao reiniciar a interface. Também precisa distinguir Ambiente, Project, Workspace, Thread e Session sem uma navegação excessivamente profunda. A evolução deve preservar a infraestrutura madura do PI WEB, em vez de reconstruí-la, e criar fronteiras suficientes para suportar outros agent runtimes no futuro sem antecipar sua implementação.

## Solution

Criar uma control surface derivada do PI WEB, com evolução independente e migração incremental por checkpoints. A primeira entrega terá clientes Web e Electron para Linux, compatíveis com Pi, sobre a mesma fronteira HTTP/JSON e WebSocket. A execução e o estado durável continuarão pertencendo a cada Ambiente e ao seu `sessiond`.

A interface usará Lit/Web Components e Dockview Core para compor Project Explorer, Chat, Files, Diff e Terminal como Painéis. O Client runtime manterá conexões e projeções por Ambiente. Um Gateway same-origin cuidará de autenticação, catálogo e proxy para Ambientes locais e remotos. Um seam server-side mínimo de Agent runtime isolará a integração Pi e deixará OMP preparado, mas não implementado.

A migração seguirá um strangler interno. Cada caminho antigo será removido apenas depois de demonstrar paridade por capacidade no fluxo real correspondente. Após a entrada do Desktop, cada corte de UI também passará por smoke no AppImage. A experiência seguirá a direção visual “The Quiet Workbench”, com paleta estrutural neutra, alta densidade, operação completa por teclado e conformidade WCAG 2.2 AA.

## User Stories

1. Como pessoa desenvolvedora, quero acessar a mesma control surface pela Web e pelo Desktop, para escolher o cliente adequado sem mudar meu modelo de trabalho.
2. Como pessoa desenvolvedora, quero que a execução permaneça no Ambiente que possui o Workspace, para evitar execução duplicada ou no destino errado.
3. Como pessoa desenvolvedora, quero fechar ou reiniciar um cliente sem encerrar agentes ativos, para não perder trabalhos longos.
4. Como pessoa desenvolvedora, quero retomar uma Thread na mesma Session, para preservar a continuidade da conversa e da execução.
5. Como pessoa desenvolvedora, quero que cada Thread permaneça vinculada ao mesmo Workspace, para manter seu contexto de arquivos previsível.
6. Como pessoa desenvolvedora, quero criar uma ramificação como nova Thread e nova Session ligadas à origem, para explorar uma alternativa sem alterar a conversa original.
7. Como pessoa desenvolvedora, quero permitir que várias Threads compartilhem um Workspace, para não criar isolamento desnecessário.
8. Como pessoa desenvolvedora, quero escolher explicitamente um Workspace isolado quando necessário, para conter mudanças concorrentes.
9. Como pessoa desenvolvedora, quero navegar por Projects, estados e Threads em uma árvore compacta, para localizar trabalho rapidamente.
10. Como pessoa desenvolvedora, quero ver o Workspace de cada Thread, para distinguir destinos mesmo quando nomes se repetirem.
11. Como pessoa desenvolvedora, quero ver o Ambiente quando ele for remoto ou ambíguo, para não executar ações no servidor errado.
12. Como pessoa desenvolvedora, quero criar uma Thread globalmente ou dentro de um Project, para iniciar trabalho com pouco atrito.
13. Como pessoa desenvolvedora, quero identificar Threads em execução, esperando intervenção, concluídas recentemente, com erro ou offline, para priorizar minha atenção.
14. Como pessoa desenvolvedora, quero que estados sejam comunicados por texto e ícones além de cor, para compreendê-los de forma acessível.
15. Como pessoa desenvolvedora, quero usar Ambientes locais e remotos na mesma janela, para acompanhar todo o trabalho sem alternar aplicações.
16. Como pessoa desenvolvedora, quero que a falha de um Ambiente não indisponibilize os demais, para continuar trabalhando parcialmente.
17. Como pessoa desenvolvedora, quero que uma Thread permaneça legível quando seu Workspace ou Ambiente estiver indisponível, para consultar seu histórico e recuperar seu contexto depois.
18. Como pessoa desenvolvedora, quero que contextos indisponíveis sejam restaurados como placeholders recuperáveis, para evitar redirecionamento ou reset silencioso.
19. Como pessoa desenvolvedora, quero organizar Painéis por docking, abas, divisões, floating e popout, para adaptar a bancada à tarefa atual.
20. Como pessoa desenvolvedora, quero ocultar e reabrir Painéis sem perder estado relevante, para controlar a densidade da interface.
21. Como pessoa desenvolvedora, quero usar um Project Explorer global e um Chat que segue a Thread ativa por padrão, para começar com uma composição simples.
22. Como pessoa desenvolvedora, quero abrir múltiplos Painéis Files e Diff, fixos ou seguidores, para comparar contextos quando necessário.
23. Como pessoa desenvolvedora, quero abrir múltiplos Terminais fixados ao Workspace, para operar comandos sem retargeting acidental.
24. Como pessoa desenvolvedora, quero fixar um Painel antes de mudar de contexto quando houver estado inseguro, para não perder trabalho transitório.
25. Como pessoa desenvolvedora, quero receber aviso quando um Painel for fixado automaticamente por segurança, para entender por que ele deixou de seguir a seleção.
26. Como pessoa desenvolvedora, quero restaurar manualmente o layout padrão sem perder rascunhos, buffers, mensagens ou processos, para recuperar uma interface utilizável com segurança.
27. Como pessoa desenvolvedora, quero operar docking, foco, reordenação, floating e popout por teclado ou menus acessíveis, para não depender de drag and drop.
28. Como pessoa desenvolvedora, quero navegar por toda a interface com teclado e foco visível, para operar com rapidez e acessibilidade.
29. Como pessoa desenvolvedora, quero que o layout se adapte de forma reversível a viewports estreitos, para preservar seleção e contexto sem corromper minha configuração.
30. Como pessoa desenvolvedora, quero tooltips e nomes acessíveis para conteúdo truncado, para recuperar toda a informação em espaços compactos.
31. Como pessoa desenvolvedora, quero que meu layout seja persistido localmente, para recuperar minha bancada sem transferir estado visual ao servidor.
32. Como pessoa desenvolvedora, quero que apenas geometria e configuração visual segura sejam persistidas, para não restaurar execução ou estado transitório incorretamente.
33. Como pessoa desenvolvedora, quero conversar com o Pi, enviar prompt, steer e follow-up e abortar execução, para controlar uma Session completa.
34. Como pessoa desenvolvedora, quero recuperar transcript e replay após reconexão, para continuar acompanhando uma execução sem lacunas.
35. Como pessoa desenvolvedora, quero usar modelos, attachments, tools, trust e interações tipadas do Pi, para preservar as capacidades maduras do PI WEB.
36. Como pessoa desenvolvedora, quero acompanhar uma execução longa no Web e no Desktop sem criar outra Session, para alternar clientes com segurança.
37. Como pessoa desenvolvedora, quero explorar arquivos do Workspace pelo Painel Files, para consultar e selecionar conteúdo do Ambiente correto.
38. Como pessoa desenvolvedora, quero visualizar Git e Diff pelo Painel Diff, para revisar mudanças no Workspace correto.
39. Como pessoa desenvolvedora, quero usar um PTY real pelo Painel Terminal, para executar comandos no Ambiente sem expor filesystem ao cliente.
40. Como pessoa desenvolvedora, quero que Terminal, Files e Diff reconectem sem trocar de Workspace, para preservar a integridade operacional.
41. Como pessoa desenvolvedora, quero que o Desktop inicie ou encontre o host local persistente, para começar sem administrar processos manualmente.
42. Como pessoa desenvolvedora, quero consultar, parar ou reiniciar o host pelas Settings com aviso sobre agentes ativos, para controlar seu lifecycle conscientemente.
43. Como pessoa desenvolvedora, quero que Quit encerre apenas o cliente Desktop, para manter as execuções server-side.
44. Como pessoa desenvolvedora, quero receber atualização segura do cliente e do host com health check e rollback, para evitar uma instalação inutilizável.
45. Como pessoa desenvolvedora, quero que a atualização do host espere agentes ativos terminarem, para não interromper execução.
46. Como pessoa desenvolvedora, quero abrir links externos, usar clipboard seguro e dialogs de importação ou exportação no Desktop, para acessar integrações nativas essenciais.
47. Como pessoa desenvolvedora, quero que Files e Workspaces continuem representando o filesystem do Ambiente, para não confundir arquivos locais do Desktop com o destino remoto.
48. Como pessoa desenvolvedora, quero autenticação uniforme no Web, renderer principal e popouts, para manter uma topologia de segurança compreensível.
49. Como pessoa desenvolvedora, quero que credenciais de Ambientes remotos permaneçam no Gateway, para não expô-las ao browser ou renderer.
50. Como pessoa desenvolvedora, quero que versões incompatíveis sejam bloqueadas e versões compatíveis degradem por capabilities, para receber comportamento previsível durante atualizações.
51. Como pessoa desenvolvedora, quero temas claro, escuro e automático com superfícies neutras, para usar a interface por períodos longos sem ruído visual.
52. Como pessoa desenvolvedora, quero que terminal ANSI, realce de sintaxe e diff preservem suas cores semânticas, para interpretar conteúdo técnico corretamente.
53. Como pessoa desenvolvedora, quero que tema inválido seja rejeitado com diagnóstico e fallback, para não tornar a interface inutilizável.
54. Como autora de plugin, quero contribuir um tema declarativo versionado com tokens conhecidos, para estender a aparência sem CSS arbitrário.
55. Como pessoa desenvolvedora, quero que movimento comunique somente ação ou mudança de estado e respeite `prefers-reduced-motion`, para evitar distração e desconforto.
56. Como mantenedora, quero preservar `sessiond`, stores, acesso remoto, plugins, path safety e serviços maduros, para reduzir regressões e trabalho duplicado.
57. Como mantenedora, quero substituir caminhos antigos apenas após provar paridade funcional, para evitar perdas escondidas durante a migração.
58. Como mantenedora, quero registrar requisito, evidência disponível e verificação pendente em cada gate, para não confundir decisão arquitetural com validação executada.
59. Como mantenedora, quero manter o Agent runtime limitado a sessões, comandos, eventos, catálogo e interações, para não acoplar filesystem, Git, Terminal, Project ou Workspace ao runtime do agente.
60. Como mantenedora, quero registrar o runtime criador em cada Session, para não presumir portabilidade entre Pi e runtimes futuros.
61. Como mantenedora, quero um adapter Pi cobrindo todas as capacidades atuais, para concluir a primeira entrega sem implementar OMP.
62. Como distribuidora, quero preservar avisos de copyright e produzir inventário transitivo de licenças, para distribuir Web e AppImage de forma compatível.
63. Como distribuidora, quero validar ABI de dependências nativas e execução no AppImage, para entregar um Desktop Linux funcional.
64. Como operadora de ambiente privado, quero proteção de origin, CSRF, isolamento e backpressure no Gateway, para evitar acesso cruzado e abuso de recursos.
65. Como pessoa desenvolvedora, quero uma experiência coerente no Web e Desktop, para aprender uma única control surface.

## Implementation Decisions

- A base será derivada do PI WEB na revisão pesquisada ou em outra revisão cuja diferença material seja registrada. Avisos MIT e proveniência serão preservados.
- A implementação começará pela base funcional existente. Não será criada uma aplicação vazia para reconstruir capacidades maduras.
- A migração usará strangler interno com checkpoints executáveis, reversíveis e com remoção do caminho antigo após paridade.
- Execução e estado durável pertencem ao Ambiente. O Gateway encaminha acesso, mas não se torna proprietário da execução remota.
- `sessiond`, stores, Projects, Workspaces, máquinas e proxy remoto, Files, Git/Diff, Terminal, plugins, path safety, integração Pi e realtime serão preservados atrás das novas fronteiras.
- Web e Electron renderer usarão a mesma origem e os mesmos contratos HTTP/JSON e WebSocket versionados.
- O Gateway será same-origin e possuirá catálogo de Ambientes, autenticação e proxies. Credenciais remotas não chegarão aos clientes.
- Os contratos incluirão identidade do Ambiente, descriptors, versão, capabilities e erros estruturados. Major incompatível bloqueará; diferenças compatíveis degradarão por capability.
- O Client runtime manterá conexão, reconexão, snapshots, subscriptions e projeções separadas por Ambiente. Views não possuirão conexão nem estado compartilhado durável.
- Contratos e Client runtime começarão como módulos internos. Não serão extraídos para packages independentes sem necessidade demonstrada.
- Thread será um registro durável de navegação, ligado exatamente a uma Session e imutavelmente a um Workspace.
- Retomar uma Thread retomará a mesma Session. Ramificar criará outra Thread e outra Session ligadas ao ponto de origem.
- Project pertencerá a um Ambiente. Equivalência visual entre repositórios em Ambientes distintos não criará identidade global.
- Workspace poderá ser compartilhado por várias Threads. Isolamento será uma escolha explícita.
- Session pertencerá ao Agent runtime que a criou e não será portátil entre runtimes.
- O seam `AgentRuntime` será server-side e mínimo, cobrindo sessões, comandos, eventos, catálogo e interações. Filesystem, Git, Diff, Terminal, Project e Workspace ficarão fora dele.
- A primeira entrega implementará somente o adapter Pi. OMP será preparado por contrato e capabilities, sem adapter funcional.
- Lit/Web Components será mantido. `PiWebApp` será reduzido gradualmente a uma casca fina e removido somente após os cortes aprovados.
- Dockview Core será usado para docking. Não haverá layout próprio nem dependência Enterprise.
- Um registro mínimo de Painéis descreverá criação e configuração visual sem conceder propriedade sobre execução.
- Project Explorer será global por padrão. Chat será único e seguirá a Thread ativa. Files e Diff poderão ter múltiplas instâncias seguidoras ou fixas. Terminal nascerá fixo ao Workspace.
- Seleção no Explorer ou foco no Chat definirá a Thread ativa. Mudança insegura auto-fixará o Painel afetado e apresentará aviso.
- Layout será local ao Cliente e persistirá apenas geometria e configuração visual segura. Estado transitório e execução não serão serializados no layout.
- Contexto indisponível restaurará como placeholder recuperável. Não haverá retargeting nem reset total automático.
- Uma ação manual restaurará o default sem apagar rascunhos, buffers, mensagens, histórico ou processos.
- Floating e popout entram na primeira entrega. Popouts usarão a mesma origem HTTP/WS e não receberão preload Electron.
- O Desktop será um cliente fino. O Electron Main instalará o runtime versionado, encontrará ou iniciará o supervisor e encaminhará comandos de lifecycle.
- O supervisor será o único responsável pelo lifecycle persistente do Gateway e do `sessiond`. Ele não será um orquestrador genérico.
- A garantia inicial de persistência cobre fechar e reiniciar o app, não logout ou reboot.
- O renderer Electron usará sandbox, context isolation, Node integration desabilitada e CSP restritiva. O preload da janela principal exporá apenas operações nativas curadas.
- Bootstrap local usará cookie HttpOnly/Secure com proteção CSRF e origin unificada.
- AppImage será o canal Desktop inicial. Cliente e host suportarão versões lado a lado, health check, ativação coordenada e rollback.
- A Platform API inicial será limitada a lifecycle/update, janelas, `openExternal`, clipboard, `safeStorage` e dialogs para import/export.
- A direção visual seguirá “The Quiet Workbench”: superfícies, ações, foco e estados estruturais usarão paleta estritamente neutra.
- Cores de domínio de ANSI, syntax highlighting e diff permanecerão isoladas dos tokens estruturais.
- O contrato de temas expandirá tokens semânticos existentes apenas quando Painéis reais revelarem lacunas. Temas serão descriptors declarativos versionados e validados.
- Tema inválido será rejeitado integralmente com diagnóstico e fallback core. O modo automático seguirá `prefers-color-scheme`.
- WCAG 2.2 AA, foco visível, navegação completa por teclado, alternativas ao arrasto e `prefers-reduced-motion` são requisitos de entrega, não melhorias opcionais.
- A ordem dos checkpoints será: preparação da base; Foundation Web; Desktop first-class; Painéis Files/Diff/Terminal; layout e temas; Project Explorer e domínio Thread; AgentRuntime Pi; Chat; hardening e release.
- Antes do corte final do Chat, haverá uma bancada funcional antecipada usando Session real, Chat existente, um Painel real, manipulação de layout e observação da mesma Session no Web e Desktop.
- Flags serão locais e temporárias apenas quando um corte não puder ser atômico. Não haverá flags permanentes nem duas aplicações completas.
- Cada gate registrará requisito aprovado, evidência disponível e verificação ainda pendente, incluindo revisão testada, comando ou cenário e resultado.
- Qualquer perda de capacidade relevante exigirá decisão explícita antes do corte.

## Testing Decisions

- Bons testes verificarão comportamento observável nos seams mais altos disponíveis. Não testarão detalhes internos de Lit, Dockview, Electron ou stores quando o mesmo risco puder ser coberto por contrato ou fluxo real.
- O seam principal será o fluxo cliente–Gateway–Ambiente com uma Session real. Ele verificará identidade, snapshot, eventos, reconexão, autenticação, isolamento e ausência de execução duplicada.
- O segundo seam será a mesma Session observada pelo Web e pelo AppImage. Ele cobrirá paridade entre clientes, persistência server-side e retomada após restart do renderer ou Gateway.
- Testes de contrato cobrirão versionamento, capabilities, erros, isolamento por Ambiente e bloqueio de major incompatível.
- Testes do Client runtime cobrirão projeções independentes por Ambiente, reconexão, replay e falha isolada sem testar implementação das views.
- Testes de domínio cobrirão Thread 1:1 com Session, vínculo imutável com Workspace, ramificação e indisponibilidade degradada.
- Testes do adapter Pi cobrirão sessões, prompt, steer/follow-up, abort, transcript/replay, catálogo, modelos, tools, attachments, trust e interações tipadas pela interface pública do Agent runtime.
- Files, Diff e Terminal serão validados como Painéis reais contra seus serviços existentes. Cada fluxo cobrirá seguir/fixar contexto, hide/reopen, move, floating/popout, foco e preservação de estado relevante.
- Terminal terá probe com PTY real, limites do canal, reconexão e fixação ao Workspace.
- O layout será testado pela API pública da bancada e por cenários de usuário: persistência segura, contexto inválido recuperável, compactação reversível e restauração manual sem perda.
- A acessibilidade será validada por checks automatizados críticos e revisão manual no Web e AppImage. Serão cobertos teclado, foco, semântica, contraste, truncamento acessível, leitores de tela, reduced motion e alternativas a drag and drop.
- O Project Explorer será exercitado com múltiplos Projects, Threads homônimas, Ambientes locais e remotos e estados simultâneos heterogêneos.
- Temas serão testados por aplicação de variantes, validação de tokens, rejeição integral, fallback, popouts e isolamento das cores de ANSI, CodeMirror e diff.
- Segurança terá testes próprios para autenticação, origin, CSRF, isolamento entre Ambientes, backpressure, CSP, preload e ausência de credenciais remotas no cliente.
- Desktop terá smoke no AppImage para bootstrap, host existente ou novo, PTY nativo, popouts, Quit sem encerrar host, restart, update, health check e rollback.
- Depois do checkpoint Desktop, todo corte de UI exigirá smoke no Web e no AppImage.
- Cada remoção de caminho antigo exigirá uma matriz curta de capacidade, fluxo, comportamento preservado e verificação correspondente.
- A base de testes existente do PI WEB será prior art para sessões, serviços server-side, plugins, Files, Git/Diff, Terminal, path safety e realtime. Os protótipos existentes de Dockview e Electron são evidência de viabilidade, não substitutos dos testes integrados.
- O prompt completo com modelo externo deverá ser validado no fluxo real antes do corte do Chat; o protótipo Electron anterior não satisfaz esse gate.
- O release exigirá inventário transitivo de licenças e avisos do conteúdo redistribuído, verificação de ABI de dependências nativas e execução no AppImage.
- Nenhum gate será considerado atendido apenas por existir uma decisão arquitetural, um link, um relatório estático ou um protótipo.

## Out of Scope

- Implementação do OMP ou de qualquer Agent runtime além do Pi.
- Portabilidade de Sessions entre runtimes.
- macOS, Windows, mobile e Tauri/Rust.
- Importação de dados de instalações antigas do PI WEB.
- Compatibilidade obrigatória com plugins ou temas antigos.
- Marketplace, theme packs, CSS arbitrário, import/export de temas e tokens em múltiplas camadas.
- Exposição pública direta dos Ambientes, colaboração multiusuário e gestão de frotas.
- Notificações do sistema operacional, tray, deep links, atalhos globais e menus nativos avançados.
- Garantia de persistência do host após logout ou reboot.
- Múltiplos Chats simultâneos.
- Agent Hub, debugger, LSP UI e Painéis adicionais.
- Reescrita em React, monorepo obrigatório, packages compartilhados prematuros ou substituição da infraestrutura madura do PI WEB.
- Sincronização server-side do layout ou do tema preferido do Cliente.

## Further Notes

- A spec consolida decisões já aprovadas no planejamento da control surface. Os artefatos de arquitetura, UI, migração e decisão continuam sendo a rastreabilidade das evidências e alternativas consideradas.
- A árvore atual contém documentação. Antes da implementação, deve ser estabelecida a base derivada do PI WEB e registrada sua revisão exata.
- Os seams esperados foram sintetizados das decisões aprovadas: fluxo real cliente–Ambiente como seam principal e smoke Web/AppImage sobre a mesma Session como seam de paridade. Não foi criado um seam adicional apenas para facilitar testes.
- Aprovação arquitetural não comprova comportamento executado. Segurança, acessibilidade, licenças, empacotamento e fluxos reais continuam como gates pendentes até sua validação em código.
