# Issue tracker: Local Markdown

Issues and specs for this repo live as markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The spec is `.scratch/<feature-slug>/spec.md`
- Implementation issues are one file per ticket at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`, never a single combined tickets file
- Triage state is recorded as a `Status:` line near the top of each issue file (see `triage-labels.md` for the role strings)
- Comments and conversation history append to the bottom of the file under a `## Comments` heading

## When a skill says "publish to the issue tracker"

Create a new file under `.scratch/<feature-slug>/` (creating the directory if needed).

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass the path or the issue number directly.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a file with one **child** file per ticket.

- **Map**: `.scratch/<effort>/map.md` (the Notes / Decisions-so-far / Fog body).
- **Child ticket**: `.scratch/<effort>/issues/NN-<slug>.md`, numbered from `01`, with the question in the body. A `Type:` line records the ticket type (`research`/`prototype`/`grilling`/`task`); a `Status:` line records `claimed`/`resolved`.
- **Blocking**: a `Blocked by: NN, NN` line near the top. A ticket is unblocked when every file it lists is `resolved`.
- **Frontier**: scan `.scratch/<effort>/issues/` for files that are open, unblocked, and unclaimed; first by number wins.
- **Claim**: set `Status: claimed` and save before any work.
- **Resolve**: append the answer under an `## Answer` heading, set `Status: resolved`, then append a context pointer (gist + link) to the map's Decisions-so-far in `map.md`.

## Convenções deste mapa

- Mapa ativo: `.scratch/control-surface/map.md`.
- Títulos são os nomes públicos dos mapas e tickets; sempre usar links com o título, não números soltos.
- Mapas e tickets registram `Labels: wayfinder:map` ou `Labels: wayfinder:<type>`.
- Tickets novos: `Status: open`, `Assignee:` vazio, `Parent: ../map.md`.
- Claim: preencher `Assignee: leo` e mudar para `Status: claimed` antes de qualquer trabalho. A pessoa responsável é leo; o agente executor pode ser registrado separadamente.
- Dependências usam `Blocked by: NN, NN`; vazio significa sem bloqueios. Só tickets `Status: resolved` liberam dependentes.
- `Status: closed` com resolução de fora de escopo encerra o ticket, mas exige revisar seus dependentes; não fingir que a pergunta foi respondida.
- Resolução: comentário em `## Comments` com data e resposta; `Status: resolved`. A seção `## Answer` abaixo do comentário é o registro da resposta, não parte da pergunta.
- Pesquisas usam branches `research/<nome>` e relatórios em `.scratch/control-surface/research/`. O ticket aponta para branch e relatório; a resposta é resumida no mapa somente após a pesquisa estar resolvida.
- Apenas um ticket HITL por sessão. Pesquisa AFK pode resolver vários tickets em paralelo. Não representar respostas do humano.
- Antes de mudar um arquivo do tracker, reler seu estado para preservar edições concorrentes.
