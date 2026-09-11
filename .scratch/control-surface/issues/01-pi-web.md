# O que o PI WEB já resolve e onde estão seus acoplamentos?

Type: research
Labels: wayfinder:research
Mode: AFK
Status: resolved
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

Entregar evidências com commit e caminhos/linhas, um mapa factual da arquitetura atual do PI WEB e candidatos de reutilização/extração com riscos. Não escolher a arquitetura futura nem implementar migração.

## Comments

2026-09-11: Resolvido com evidências estáticas da revisão `46579c049a305b6a146d1028e539ca6d071fbfb4`; relatório completo em [research/pi-web.md](../research/pi-web.md). A pesquisa separa fatos do código, recomendações e decisões humanas pendentes; não implementa migração nem escolhe a arquitetura futura.

## Answer

O PI WEB já separa Web/API e `sessiond`: o daemon possui processos/sessões e estado durável, com posse exclusiva do diretório e comunicação HTTP/WebSocket via socket Unix/TCP; a UI pode reiniciar sem terminar sessões. `ProjectStore`, máquina/proxy remoto, workspace providers, path-safety, `SessionEventHub`, Files/Git-Diff/Terminal e tokens de tema são bons ativos para preservar. Files, Git/Diff e Terminal já são as melhores candidatas a painéis, enquanto Chat e Project Explorer continuam acoplados ao estado/navegação de `PiWebApp`. O acoplamento Pi é server-side e profundo em `PiSessionService`, gateway, auth/model/trust/attachments/tools; o nome real é `@earendil-works/pi-coding-agent`, portanto remover/trocar o pacote exige adapter, não substituição textual. PI WEB e Pi declaram MIT, com preservação de avisos e inventário transitivo ainda necessário.

Relatório: [Evidências — O que o PI WEB já resolve e onde estão seus acoplamentos?](../research/pi-web.md)
