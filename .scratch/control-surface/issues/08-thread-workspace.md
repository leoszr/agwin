# Como Thread, Session, Workspace, Project e Ambiente se relacionam?

Type: grilling
Labels: wayfinder:grilling
Mode: HITL
Status: open
Assignee:
Parent: ../map.md
Blocked by: 01, 03

## Question

Qual é o modelo de domínio do produto, distinguindo a linguagem da UI dos conceitos internos reutilizados?

Já decidido: Ambiente significa servidor; cada thread pertence a um único ambiente; uma janela pode reunir threads de diferentes ambientes. Ainda é preciso decidir a relação Thread/Session, o vínculo e eventual troca de workspace, compartilhamento versus isolamento, identidade/agrupamento de projetos em ambientes diferentes e comportamento ao retomar ou ramificar uma conversa.

Testar cenários concretos com leo, não assumir que Thread é apenas um rename de Session nem que cada thread ganha um worktree. Cobrir as questões abertas 6, 7 e 8 sem restabelecer um seletor global obrigatório. Atualizar o glossário apenas com termos efetivamente resolvidos.
