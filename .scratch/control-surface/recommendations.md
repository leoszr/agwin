# Recomendações de alteração do plano

**Situação:** recomendações P0 e P1 aprovadas e incorporadas às fontes e sínteses correspondentes (`artifacts/migration-strategy.md`, `artifacts/target-architecture.md`, `artifacts/ui-model.md`, `DESIGN.md`, `issues/12-desktop-platform.md` e `issues/17-handoff.md`), incluindo os esclarecimentos desta revisão. P2 permanece como opções futuras fora da entrega inicial. A incorporação é documental; os gates de implementação continuam pendentes.

Base: comparação do [Plano Investigativo e Arquitetural](brief.md) com as decisões de [Arquitetura e migração da control surface baseada no PI WEB](map.md), os cinco artefatos e as evidências locais. Esta revisão não refez a auditoria dos repositórios upstream nem executou novos testes de produto.

Este documento não é um sexto artefato canônico, não reabre o mapa e não substitui decisões aprovadas. As propostas aceitas foram incorporadas às fontes pertinentes, sem criar versões concorrentes da decisão.

**Leitura do registro:** as constatações das seções P0/P1 descrevem a situação anterior à incorporação. As propostas abaixo incluem os esclarecimentos desta revisão; as fontes vinculadas registram o plano vigente.

## Avaliação geral

Manter a direção arquitetural. O plano preserva a ideia de um produto independente sobre a infraestrutura madura do PI WEB, com execução server-side, UI modular, Web e Electron compartilhados e Pi antes de OMP.

As alterações recomendadas concentram-se em tornar o início da implementação inequívoco, entregar uma experiência integrada cedo e impedir que simplificações removam capacidades. O principal risco é investir demais na infraestrutura Desktop antes de demonstrar o diferencial de UI.

## Prioridades

- **P0:** esclarecer antes de implementar o trecho afetado; não bloqueia todo trabalho independente.
- **P1:** incorporar ao planejamento executivo e aos critérios de aceitação dos checkpoints.
- **P2:** considerar mudança de produto somente com decisão explícita; não adicionar automaticamente à primeira entrega.

| Prioridade | Recomendação | Destino das recomendações |
|---|---|---|
| P0 | Fixar a base de código e o ponto de partida | Migration Strategy, antes de Foundation Web |
| P0 | Conciliar origem do renderer, autenticação e popouts | Decisão Desktop e Target Architecture |
| P0 | Eliminar ambiguidade sobre a paleta neutra | DESIGN.md e UI Model |
| P1 | Definir um marco antecipado de bancada funcional | Migration Strategy, checkpoint de painéis |
| P1 | Limitar o supervisor às responsabilidades já aprovadas | Planejamento executivo do Desktop |
| P1 | Tornar paridade funcional verificável por capacidade | Critérios de corte de cada checkpoint |
| P1 | Testar legibilidade e operação da UI com cenários reais | UI Model e critérios de aceitação |
| P1 | Separar aprovação arquitetural de evidência executada | Registro dos gates de implementação |
| P2 | Reavaliar seletivamente notificações e customização | Novas decisões, somente se houver interesse |

## P0 — Esclarecimentos antes dos trechos afetados

### Fixar a base de código e o ponto de partida

**Constatação:** a árvore principal consultada contém documentação, não a aplicação PI WEB. A [Migration Strategy](artifacts/migration-strategy.md) fala em um strangler interno na “árvore atual”, expressão que pode confundir o próximo implementador.

**Alteração proposta:** acrescentar uma preparação curta antes de Foundation Web:

- estabelecer a base derivada de `jmfederico/pi-web`, preservando os avisos e a proveniência;
- registrar o commit utilizado e sua relação com a revisão pesquisada, `46579c049a305b6a146d1028e539ca6d071fbfb4`;
- verificar que os fluxos relevantes funcionam na base antes de reorganizá-los;
- registrar diferenças materiais se for adotada outra revisão.

Não criar uma aplicação vazia para reimplementar capacidades existentes. Incorporar código de origem não significa importar dados de instalações antigas.

**Critério de aceite:** o implementador consegue identificar o código de partida, executá-lo e distinguir comportamento preexistente de mudanças da migração.

### Conciliar origem do renderer, autenticação e popouts

**Constatação:** [Como Electron integra servidor local e recursos nativos sem duplicar o Web?](issues/12-desktop-platform.md) menciona “scheme privilegiado”, enquanto [Qual interface separa clientes, estado compartilhado e execução?](issues/07-client-server.md) estabelece mesma origem HTTP/WS. A função desse scheme não está explícita. Isso é uma ambiguidade documental, não prova de falha em execução.

**Alteração proposta:** explicitar a origem efetiva da UI principal e dos popouts. Recomendo preservar a topologia same-origin aprovada e remover a menção genérica a scheme privilegiado se ela não tiver função necessária. Um scheme adicional não deve introduzir silenciosamente outra topologia de autenticação ou acesso.

**Critério de aceite:** o desenho e a configuração concordam sobre origem, cookies, CSP e proteção de origem/CSRF. O pacote real autentica janela principal e popouts sem retirar sandbox, expor IPC bruto ou enfraquecer os controles aprovados.

### Eliminar ambiguidade sobre a paleta neutra

**Constatação:** [Dockview preserva comportamento e estado dos painéis reais do PI WEB?](issues/09-dockview-prototype.md) registra a preferência estritamente neutra. [DESIGN.md](../../DESIGN.md) ainda deixa acento e cores semânticas para resolução durante a implementação.

**Alteração proposta:** alinhar a redação de DESIGN.md à preferência aprovada. Não deixar placeholders que pareçam autorizar uma nova paleta. Diferenciar superfícies da UI de conteúdo com semântica própria, como ANSI do terminal, já ressalvado em [Qual contrato de temas torna a aparência substituível sem acoplar componentes?](issues/15-themes.md).

**Critério de aceite:** criar um componente ou adapter não exige reinterpretar a direção visual. O tratamento preserva contraste, foco e estados que não dependem somente de cor.

## P1 — Ajustes no planejamento executivo

### Definir um marco antecipado de bancada funcional

**Risco:** foundation, empacotamento, supervisão e updates podem ocupar o esforço antes de aparecer o principal diferencial do produto: operar agentes em uma interface modular.

**Alteração proposta:** acrescentar ao checkpoint de painéis um cenário integrado, usando o Chat e a navegação existentes durante a transição:

1. Selecionar um Workspace e operar uma Session real.
2. Enviar um prompt pelo Chat existente e acompanhar sua resposta.
3. Usar pelo menos um painel real de infraestrutura em Dockview.
4. Mover, ocultar e reabrir o painel sem perder contexto ou estado relevante.
5. Observar a mesma Session no Web e Desktop sem duplicar execução.

Isso não antecipa a migração definitiva do Chat, não altera a ordem aprovada e não reduz o escopo final. Acrescenta uma demonstração de produto aos gates técnicos já existentes.

**Critério de aceite:** a bancada permite trabalho real antes do corte final de PiWebApp, sem depender apenas de caixas ou mensagens simuladas.

### Limitar o supervisor às responsabilidades já aprovadas

**Constatação:** o supervisor próprio foi escolhido em [Como Electron integra servidor local e recursos nativos sem duplicar o Web?](issues/12-desktop-platform.md), com rejeição explícita de `systemd --user`. É uma decisão válida, mas cria manutenção própria.

**Alteração proposta, esclarecida nesta revisão:** o Main instala o runtime, encontra ou inicia o supervisor e prepara versões do host. O supervisor possui gateway/`sessiond` e responde sozinho por seu lifecycle persistente, ativação de versões do host, health check e rollback. O Main solicita operações e acompanha resultados, sem supervisionar ou substituir esses processos diretamente. Não expandir o supervisor para orquestração genérica, plugins de supervisão ou gerenciamento de frotas.

Não recomendo trocar a decisão nesta revisão. Se a implementação revelar custo desproporcional, registrar evidências e submeter uma alternativa antes de alterar a arquitetura.

**Critério de aceite:** as garantias aprovadas funcionam, inclusive sobrevivência ao Quit e adiamento de updates com agentes ativos, sem prometer execução contínua após logout ou reboot.

### Tornar paridade funcional verificável por capacidade

**Risco:** “preservar plugins”, “preservar Pi” e “preservar Terminal” podem ser interpretados como manter apenas uma superfície visual equivalente.

**Alteração proposta:** antes de cada corte, registrar uma lista curta com capacidade, fluxo relevante, comportamento a preservar e verificação correspondente. Reutilizar testes existentes; acrescentar somente os necessários para o risco da mudança.

Exemplos relevantes: reconexão, identidade de Session, rascunhos, attachments, trust, interações de tools/extensões, limites do canal de terminal e isolamento entre Ambientes. A lista deve vir dos caminhos reais afetados, não de uma tentativa antecipada de testar tudo.

**Critério de aceite:** cada remoção de código tem evidência de substituição funcional. Ausência de compatibilidade legada não autoriza perda de capacidade. Uma perda relevante exige decisão explícita antes do corte.

Fonte: [Qual sequência de migração entrega Web e Desktop preservando a infraestrutura?](issues/16-migration.md).

### Testar legibilidade e operação da UI com cenários reais

**Risco:** grupos de estado e Workspace sempre visível aumentam contexto, mas também densidade. O protótipo aceito não demonstra todos os casos de uso prolongado.

**Alteração proposta:** detalhar os gates do [UI Model](artifacts/ui-model.md) com múltiplos Projects, Threads de nomes iguais, Ambientes locais/remotos, estados simultâneos e largura reduzida. Verificar seleção encontrável, truncamento acessível, criação rápida e compreensão do destino de execução.

Exercitar também operação por teclado, alternativas ao arrasto e restauração manual do default com estado transitório real. São obrigações já aprovadas no handoff, não funcionalidades opcionais.

**Critério de aceite:** a navegação continua rápida sem esconder contexto; reorganizar ou restaurar a interface não perde estado nem controla indevidamente a execução. Falha de legibilidade não autoriza trocar a estrutura do Explorer sem avaliação.

### Separar aprovação arquitetural de evidência executada

**Constatação:** relatórios estáticos, protótipos e testes de produção têm alcances diferentes. Links válidos comprovam rastreabilidade, não funcionamento integral.

**Alteração proposta:** no registro de cada gate, distinguir requisito aprovado, evidência disponível e verificação ainda pendente. Registrar comando/cenário, revisão e resultado quando a implementação executar a verificação. Não criar outro catálogo paralelo de decisões.

Manter explícito que:

- os estudos Dockview não certificam todos os painéis finais;
- o protótipo Electron validou Session e shell reais, mas não um prompt completo com modelo externo;
- a comparação Pi/OMP não é prova de interoperabilidade;
- acessibilidade, segurança e licenças transitivas exigem seus checks próprios.

**Critério de aceite:** nenhum gate é marcado como atendido apenas porque seu ticket de arquitetura foi resolvido. O inventário de licenças continua obrigatório antes de distribuir.

Fonte: [Os cinco artefatos deixam o caminho de implementação suficientemente claro?](issues/17-handoff.md).

## P2 — Possíveis mudanças de produto, não recomendadas como bloqueio

| Tema | Recomendação | Limite e decisão necessária |
|---|---|---|
| Notificações OS | Priorizar sua avaliação entre as integrações nativas adiadas: conclusão, erro ou necessidade de intervenção podem ter valor com a janela fechada. | Antecipá-las muda o recorte aprovado. Definir se devem funcionar após Quit e quem as emite; não presumir renderer ativo nem criar tray apenas para isso. |
| Criação de temas | Na implementação do contrato atual, incluir um exemplo mínimo de contribuição declarativa por plugin. Avaliar arquivo de tema/importação somente se esse caminho não atender ao uso desejado. | Não implementar marketplace nem ampliar o formato. Arquivos de tema do usuário e import/export continuam fora da primeira entrega até nova decisão. |
| Múltiplos Chats | Manter um Chat inicialmente. Reavaliar somente se o uso real exigir comparação ou controle simultâneo de conversas lado a lado. | Permitir múltiplos Chats muda o modelo de contexto aprovado; não é apenas ajustar a multiplicidade no registro de painéis. |

Fontes: [Como Electron integra servidor local e recursos nativos sem duplicar o Web?](issues/12-desktop-platform.md), [Qual contrato de temas torna a aparência substituível sem acoplar componentes?](issues/15-themes.md) e [Como painéis e layouts compartilham contexto sem controlar a execução?](issues/14-panels-layout.md).

## O que não recomendo alterar

- PI WEB como base, com evolução independente e preservação de infraestrutura madura.
- Lit, Dockview Core, Electron Linux/AppImage e o uso seletivo dos padrões do T3 Code.
- Execução e estado durável nos Ambientes; gateway e client runtime sem duplicar essa autoridade.
- Pi primeiro, OMP posterior por adapter próprio; sem portabilidade presumida de Sessions.
- Migração incremental por paridade, sem duas aplicações permanentes.
- Recorte de instalação nova, acesso remoto privado e ausência de compatibilidade legada obrigatória.

## Encaminhamento após incorporação

P0 e P1 estão incorporados documentalmente ao plano. O próximo passo é executar os checkpoints e registrar as verificações previstas, sem tratar aprovação arquitetural como teste executado. P2 permanece como opções de produto, sem virar dependência ou funcionalidade implícita da primeira entrega.

Não refazer a investigação inteira nem reabrir todos os tickets. Se uma alteração aceita contrariar uma decisão canônica, registrar explicitamente a substituição, seu motivo e seus efeitos antes de implementar.
