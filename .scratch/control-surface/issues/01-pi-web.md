# O que o PI WEB já resolve e onde estão seus acoplamentos?

Type: research
Labels: wayfinder:research
Mode: AFK
Status: claimed
Assignee: leo
Parent: ../map.md
Blocked by:
Research branch: research/pi-web
Research asset: [Evidências — O que o PI WEB já resolve e onde estão seus acoplamentos?](../research/pi-web.md)

## Question

Investigar `jmfederico/pi-web` em revisão identificada: quais partes podem ser preservadas ou extraídas sem reescrever a infraestrutura madura?

Cobrir integralmente a Etapa A e as questões abertas 1, 5 e 11 do brief:
- `src/client/`, `src/server/`, `sessiond`: propriedade de processos, persistência, reinício de UI/API, canais UI ↔ servidor ↔ daemon ↔ Pi e dependências de execução.
- Machine → Project → Workspace → Session, máquinas remotas e relação com filesystem, Git, credenciais e processos reais.
- Files, Diff, Terminal, plugins, temas/tokens, comunicação em tempo real e remote-first.
- Centralização em PiWebApp, lifecycle de Lit/Web Components, candidatas a painéis e acoplamentos que impedem movê-los ou remontá-los.
- Imports diretos do Pi e o que depende de `@earendil-works/pi-coding-agent`; separar conceitos do produto e do agente. Confrontar o nome do pacote com o código real, sem assumir o nome do brief.
- Licença e restrições relevantes para derivação e redistribuição independente.

Entregar evidências com commit e caminhos/linhas, um mapa factual da arquitetura atual e candidatos de reutilização/extração com riscos. Não escolher a arquitetura futura nem implementar migração.
