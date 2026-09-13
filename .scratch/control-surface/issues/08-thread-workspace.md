# Como Thread, Session, Workspace, Project e Ambiente se relacionam?

Type: grilling
Labels: wayfinder:grilling
Mode: HITL
Status: resolved
Assignee: leo
Parent: ../map.md
Blocked by: 01, 03

## Question

Qual é o modelo de domínio do produto, distinguindo a linguagem da UI dos conceitos internos reutilizados?

Já decidido: Ambiente significa servidor; cada thread pertence a um único ambiente; uma janela pode reunir threads de diferentes ambientes. Ainda é preciso decidir a relação Thread/Session, o vínculo e eventual troca de workspace, compartilhamento versus isolamento, identidade/agrupamento de projetos em ambientes diferentes e comportamento ao retomar ou ramificar uma conversa.

Testar cenários concretos com leo, não assumir que Thread é apenas um rename de Session nem que cada thread ganha um worktree. Cobrir as questões abertas 6, 7 e 8 sem restabelecer um seletor global obrigatório. Atualizar o glossário apenas com termos efetivamente resolvidos.

## Comments

### 2026-09-12 — Resolução com leo

Modelo confirmado em duas rodadas HITL e registrado no glossário em [CONTEXT.md](../../../CONTEXT.md). A decisão preserva a execução server-side comprovada no PI WEB, mas deixa de tratar o vínculo Session/Workspace como mera inferência por cwd.

## Answer

- **Ambiente → Project:** cada Project pertence a um Ambiente. Cópias do mesmo repositório em Ambientes diferentes são Projects distintos. A UI pode agrupá-las por evidência de equivalência, sem criar identidade global nem usar path como identidade.
- **Project → Workspace:** cada Workspace pertence a um Project e representa um contexto de arquivos/execução, principal ou isolado.
- **Workspace → Thread:** cada Thread mantém vínculo imutável com um Workspace. Várias Threads podem compartilhar e executar no mesmo Workspace; isolamento por worktree é escolha explícita, não default automático. Concorrência e possíveis conflitos devem ficar visíveis, não ser evitados por um lock global implícito.
- **Thread ↔ Session:** Thread é o registro durável do produto e referencia exatamente uma Session do agent runtime. Metadados de navegação pertencem à Thread; conversa e execução pertencem à Session. Ambas são escopadas ao mesmo Ambiente.
- **Retomada:** reabrir uma Thread retoma/reconecta a mesma Session. A Session não é substituída silenciosamente. Se não puder ser retomada, a Thread permanece legível em estado degradado.
- **Ramificação:** cria uma nova Thread e uma nova Session, registra a Thread/ponto de origem e deixa os ramos independentes. O Workspace atual é o default, com escolha explícita de outro Workspace; usar branch/fork nativo depende da capability do runtime.
- **Workspace indisponível:** remover, mover ou perder acesso ao Workspace não apaga nem redireciona Threads. Elas preservam o vínculo indisponível e o histórico; executar novamente exige restaurar o Workspace ou ramificar para outro.

**Alternativas recusadas:** Thread como mero rename de Session; múltiplas Sessions dentro da mesma Thread; troca de Workspace por turno ou retarget automático; Workspace exclusivo por Thread; Project global entre Ambientes.

**Riscos a carregar:** Threads concorrentes no mesmo Workspace podem produzir conflitos; equivalência visual entre Projects não pode virar identidade implícita; runtimes sem branch nativo precisam declarar a ausência da capability em vez de fingir o mesmo comportamento.
