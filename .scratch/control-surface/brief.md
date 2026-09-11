# Plano Investigativo e Arquitetural

## 1. Objetivo

Criar um novo produto derivado do **PI WEB**, preservando principalmente sua capacidade de executar sessões persistentes do Pi em workspaces reais, mas transformando-o em uma **control surface modular para coding agents**, disponível inicialmente como:

* aplicação Web;
* aplicação Desktop;
* interface compatível inicialmente com Pi;
* posteriormente compatível também com OMP e outros runtimes relacionados, caso façam sentido.

O objetivo não é apenas criar um tema ou uma variante visual do PI WEB. A intenção é utilizar o PI WEB como **foundation técnica**, mas permitir que o novo projeto evolua independentemente.

A experiência desejada deve se aproximar mais de uma combinação de:

**PI WEB**
→ runtime, sessões persistentes, workspaces, arquivos, terminal, acesso remoto.

**VS Code**
→ organização livre da interface, docking, painéis movíveis, redimensionáveis e ocultáveis.

**T3 Code**
→ organização visual de projetos e threads, separação entre servidor/runtime e clientes, e arquitetura multi-client.

O T3 Code pode ser usado livremente como **referência arquitetural**, não apenas visual.

---

# 2. Repositórios e referências que devem ser estudados

## PI WEB — base principal

**Repository:** `jmfederico/pi-web`

É a implementação que deve ser considerada como foundation inicial.

Pontos importantes para investigar:

* `src/client/`
* `src/server/`
* `sessiond`
* comunicação UI ↔ servidor ↔ sessões;
* sistema de plugins;
* sistema de temas;
* projetos;
* workspaces;
* sessões;
* máquinas remotas;
* terminal;
* files;
* diff;
* gerenciamento de processos persistentes.

O modelo atual do PI WEB é:

```text
Machine
  └─ Project
      └─ Workspace
          └─ Session
```

Esse modelo deve ser preservado internamente quando fizer sentido, mesmo que a UI passe a apresentá-lo de maneira mais simples.

Também é importante observar que o projeto já separa o proprietário das sessões (`sessiond`) da UI/API. Reiniciar UI/API não necessariamente termina as sessões dos agentes. Essa propriedade deve ser preservada.

---

## T3 Code — principal referência arquitetural e de UX

**Repository:** `pingdotgg/t3code`

Estudar principalmente duas áreas.

### Arquitetura

O T3 Code atualmente possui aplicações separadas:

```text
apps/
├─ web
├─ desktop
├─ mobile
└─ server
```

E pacotes compartilhados como:

```text
packages/
├─ client-runtime
├─ contracts
├─ shared
└─ ...
```

Essa separação é uma das principais referências para o novo projeto.

O princípio arquitetural mais importante do T3 Code é:

> execução pertence ao ambiente que possui o workspace; web, desktop e mobile são clientes desse ambiente.

Provider processes, Git, terminal e arquivos ficam do lado do servidor. Estado de conexão e estado de domínio compartilhável ficam em um `client-runtime`.

O Desktop pode incluir o servidor localmente, mas seu renderer continua obedecendo à mesma fronteira cliente/servidor. Esse conceito deve ser estudado com atenção.

Outro conceito importante é centralizar conexão, reconnect e estado compartilhado fora das views. No T3 Code, Web, Desktop Renderer e Mobile compartilham um connection runtime por environment.

### UI de Projects e Threads

A UI do T3 Code deve ser estudada principalmente como referência para:

```text
Project
 ├─ Thread
 ├─ Thread
 └─ Thread

Project
 ├─ Thread
 └─ Thread
```

Examinar:

* `apps/web/src/components/Sidebar.tsx`
* `Sidebar.logic`
* componentes relacionados a Project;
* componentes relacionados a Thread;
* grouping;
* ordering;
* project icons;
* estados de threads;
* collapsing;
* criação de threads;
* navegação.

Não é necessário copiar a implementação. A intenção é entender **quais decisões de UX tornam Projects + Threads simples de navegar**.

---

## Pi Coding Agent

**Repository:** `earendil-works/pi`

Investigar principalmente o pacote `coding-agent`.

O PI WEB atualmente é explicitamente construído como Web UI para esse Pi Coding Agent.

Objetivos da investigação:

* descobrir quais APIs do Pi o PI WEB consome diretamente;
* identificar quais conceitos realmente pertencem ao Pi;
* identificar quais conceitos pertencem ao PI WEB;
* descobrir quais dependências precisarão ser encapsuladas para permitir outros runtimes no futuro.

---

## Oh My Pi / OMP

**Repository:** `can1357/oh-my-pi`

OMP é um fork do Pi e distribui seu próprio coding-agent como:

```text
@oh-my-pi/pi-coding-agent
```

Não tentar tornar o projeto compatível com OMP simplesmente substituindo dependências do Pi.

A investigação deve descobrir:

* diferenças relevantes entre APIs;
* formatos de sessões;
* extensões;
* tools;
* eventos;
* modelos;
* configurações;
* recursos adicionais do OMP;
* o que pode ser normalizado por um adapter;
* quais funcionalidades devem aparecer apenas quando o runtime anunciar suporte.

Compatibilidade OMP é uma meta importante, mas não deve bloquear o primeiro redesign da aplicação.

---

## Dockview

**Referência:** Dockview.

Investigar como candidato principal para o layout manager.

Dockview foi criado especificamente para interfaces no estilo IDE e já suporta:

* docking;
* tabs;
* groups;
* drag-and-drop;
* floating panels;
* popout windows;
* persistência/restauração do layout;
* JavaScript sem dependência obrigatória de React.

A investigação deve responder:

> É melhor adaptar os Web Components atuais do PI WEB ao Dockview ou construir um docking system próprio?

A hipótese inicial é **usar Dockview**, salvo descoberta de incompatibilidade significativa.

---

## Electron

Electron é atualmente a opção preferida para o primeiro Desktop Client.

Investigar:

* arquitetura Main / Renderer / Preload;
* como executar ou iniciar o servidor local;
* lifecycle do servidor;
* atualizações;
* filesystem;
* notificações;
* deep links;
* menus nativos;
* tray;
* protocolos;
* segurança do preload.

Isso combina naturalmente com o stack atual do PI WEB.

---

## Tauri / Rust

Tauri deve ser investigado, mas **não é atualmente a opção principal para a primeira versão desktop**.

A investigação deve responder:

* quais vantagens reais Tauri ofereceria neste projeto;
* como funcionaria mantendo o servidor Node existente;
* necessidade de sidecar;
* custo operacional e de distribuição;
* quais funcionalidades realmente justificariam Rust.

Não portar o backend para Rust apenas para utilizar Tauri.

Tauri deve continuar sendo uma possibilidade futura caso haja benefício claro.

---

# 3. Conceitos fundamentais do novo projeto

## Control Surface

O produto deve ser entendido principalmente como uma **control surface para coding agents**.

A interface não deve ser responsável pela execução do agente.

Ela controla um runtime que executa no ambiente em que estão:

```text
repository
filesystem
git
terminal
credentials
tools
agent
```

---

## Server-owned execution

O servidor/environment deve ser proprietário de:

```text
agent processes
sessions
terminal
git
project files
workspaces
provider credentials
```

Clientes não devem tentar reproduzir esse estado localmente.

---

## Multi-client

Web e Desktop devem existir desde o começo como **dois clientes da mesma plataforma**.

Pensar desde o início em:

```text
                Runtime / Server
                       │
              shared protocol
                       │
          ┌────────────┴────────────┐
          │                         │
         Web                     Desktop
```

O Desktop não deve se tornar uma implementação paralela da aplicação.

---

## Shared Client Runtime

Investigar a criação de uma camada semelhante ao `client-runtime` do T3 Code.

Responsabilidades possíveis:

```text
connection
reconnection
sessions
server state
subscriptions
caching
runtime capabilities
environment state
```

UI Web e UI Desktop devem compartilhar essa camada.

Evitar lógica de conexão diferente para cada interface.

---

## Platform Layer

Funcionalidades específicas da plataforma devem possuir uma fronteira explícita.

Exemplos:

```text
Web Platform
Desktop Platform
```

Responsabilidades possíveis:

```text
filesystem dialogs
notifications
open external URL
clipboard
credentials
app lifecycle
updates
native menus
window management
```

A UI não deve espalhar verificações de `isElectron` por toda a aplicação.

---

## Runtime / Harness Adapter

Pi não deve continuar permanentemente acoplado ao restante da aplicação.

Conceitualmente:

```text
                     Agent Runtime
                    /             \
                  Pi              OMP
```

A interface deve trabalhar com conceitos normalizados sempre que possível.

Cada runtime pode anunciar capabilities.

Exemplos:

```text
terminal
files
diff
subagents
agent hub
LSP
debugger
persistent Python
persistent JavaScript
```

A UI deve poder esconder funcionalidades que não são suportadas pelo runtime atual.

---

# 4. Nova filosofia de UI

## UI completamente modular

Abandonar o conceito rígido:

```text
Left Sidebar | Chat | Right Sidebar
```

A aplicação deve trabalhar com **panels**.

Exemplos:

```text
Projects / Threads
Chat
Files
Diff
Terminal
Tasks
Agent Hub
Debug
Logs
```

O usuário decide onde esses componentes ficam.

---

## Docking estilo VS Code

Objetivo de UX:

* mover painéis com o mouse;
* colocar painel à esquerda;
* direita;
* acima;
* abaixo;
* transformar painéis em tabs;
* reorganizar tabs;
* redimensionar;
* esconder;
* reabrir;
* salvar layout;
* restaurar layout.

Exemplo:

```text
┌───────────────┬──────────────────────────┐
│ Projects      │                          │
│ + Threads     │          Chat            │
│               │                          │
└───────────────┴──────────────────────────┘
```

Outro usuário poderia preferir:

```text
┌───────────────┬──────────────────────────┐
│ Projects      │          Chat            │
│ + Threads     ├──────────────────────────┤
│               │        Terminal          │
└───────────────┴──────────────────────────┘
```

Outro:

```text
┌──────────┬──────────────────┬────────────┐
│ Projects │ Chat             │ Files      │
│ Threads  │                  │ Diff       │
│          │                  │ Terminal   │
└──────────┴──────────────────┴────────────┘
```

Nenhum desses deve ser tratado como a estrutura obrigatória.

---

## Painéis opcionais

Um dos requisitos explícitos é permitir uma interface mínima.

O usuário deve poder utilizar:

```text
Projects / Threads | Chat
```

e simplesmente esconder:

```text
Files
Diff
Terminal
Workspace Inspector
etc.
```

O atual painel direito do PI WEB não deve ser obrigatório.

---

## Project Explorer inspirado no T3 Code

A sidebar principal deve priorizar a compreensão humana:

```text
Project
  ├─ Thread
  ├─ Thread
  └─ Thread
```

e não obrigatoriamente expor:

```text
Machine
Project
Workspace
Session
```

como quatro níveis permanentes da interface.

Machine e Workspace continuam existindo no modelo, mas podem aparecer de formas mais contextuais.

Investigar no T3 Code especialmente:

* project grouping;
* project rows;
* thread rows;
* thread states;
* ordering;
* pinned/recent threads;
* criação rápida de thread;
* estados running/completed;
* collapse/expand;
* menus contextuais.

---

# 5. Sistema de temas

Temas devem ser uma funcionalidade first-class.

O PI WEB já possui um sistema de tokens CSS centralizado, o que torna essa evolução relativamente natural.

Objetivos:

* mudar tema pelas configurações;
* temas independentes da lógica da aplicação;
* fácil criação de novos temas;
* fácil importação/exportação, se viável;
* suporte dark/light;
* possibilidade futura de theme packs;
* nenhuma necessidade de modificar dezenas de componentes apenas para criar um esquema visual novo.

Investigar se o sistema atual de tokens é suficiente ou se precisa ser transformado em um design-token system mais completo.

---

# 6. Desktop first-class

## Decisão inicial

O primeiro Desktop Client deve ser **Electron**.

Motivos:

* stack atual fortemente baseado em TypeScript/Node;
* reutilização direta da UI Web;
* integração natural com o backend existente;
* menor distância arquitetural até o PI WEB atual;
* T3 Code já demonstra uma arquitetura web + desktop + server semelhante.

Electron deve ser tratado como cliente de primeira classe, não simplesmente como:

```text
BrowserWindow → URL do PI WEB
```

---

## Desktop + servidor local

Investigar o padrão:

```text
Desktop Application
       │
       ├─ Renderer/UI
       │
       └─ local Server
               │
             Agent
```

O renderer deve continuar conversando com o servidor através da mesma fronteira lógica usada pelo cliente Web.

Isso mantém:

```text
local desktop
remote web
future mobile
```

compatíveis com o mesmo modelo.

---

# 7. O que deve ser reutilizado do PI WEB

A investigação deve procurar preservar, sempre que razoável:

```text
session daemon
session persistence
workspace management
projects
machines
remote machines
terminal support
file support
diff support
plugins
Pi integration
realtime communication
remote-first behavior
```

Não reescrever funcionalidades maduras simplesmente para reorganizar o projeto.

---

# 8. O que provavelmente deve mudar

Avaliar principalmente:

```text
estrutura do frontend
PiWebApp excessivamente central
layout fixo
navegação
Project/Workspace/Session presentation
separação UI/client-runtime
platform abstraction
runtime abstraction
monorepo/application boundaries
desktop integration
```

Não assumir que a estrutura atual precisa ser preservada apenas porque o código veio de um fork.

---

# 9. Estratégia de produto

Não tratar o resultado simplesmente como:

> PI WEB com UI nova.

Tratar como:

> Uma control surface modular, Web e Desktop, para Pi e runtimes relacionados.

O PI WEB será a foundation inicial.

Isso permite que o projeto adquira identidade própria e evolua sem precisar manter compatibilidade arquitetural absoluta com upstream.

---

# 10. Guia investigativo — ordem recomendada

## Etapa A — entender completamente o PI WEB

Responder:

1. Onde vivem as sessões?
2. Quem é proprietário dos processos do agente?
3. Como navegador e servidor se comunicam?
4. Como `sessiond` participa?
5. Como Projects, Workspaces e Sessions se relacionam?
6. Como remote machines funcionam?
7. Como Files, Diff e Terminal são expostos?
8. Como plugins adicionam funcionalidades?
9. Quais partes da UI podem ser isoladas como panels?
10. Quais partes estão fortemente acopladas ao componente principal?
11. Onde Pi é importado diretamente?
12. O que quebraria caso `@earendil-works/pi-coding-agent` deixasse de existir?

Resultado esperado:

**mapa arquitetural atual do PI WEB.**

---

## Etapa B — estudar a arquitetura do T3 Code

Não começar pela aparência.

Primeiro estudar:

```text
apps/web
apps/desktop
apps/server
packages/client-runtime
packages/contracts
```

Responder:

1. Qual código é compartilhado por Web e Desktop?
2. O que pertence ao servidor?
3. O que pertence ao client-runtime?
4. O que pertence apenas ao Desktop?
5. Como o Desktop inicia/encontra o servidor?
6. Como clients descobrem environments?
7. Como reconnect funciona?
8. Como o RPC contract separa client/server?
9. Como providers são abstraídos?
10. Como capabilities/version compatibility funcionam?

Resultado esperado:

**lista dos padrões arquiteturais do T3 Code que vale adaptar ao novo projeto.**

---

## Etapa C — estudar a UI do T3 Code

Agora estudar especificamente:

```text
Sidebar
Project grouping
Threads
Thread status
Thread navigation
Project selection
```

Responder:

1. O que deixa a sidebar mais simples que a atual do PI WEB?
2. Quais informações realmente precisam ficar visíveis?
3. Como representar Machine sem ocupar constantemente espaço?
4. Como representar Workspace sem adicionar um nível visual desnecessário?
5. Como threads ativas são diferenciadas?
6. Como múltiplos projects são organizados?

Resultado:

**especificação conceitual do novo Project Explorer.**

---

## Etapa D — validar Dockview

Construir um pequeno estudo técnico, não a aplicação inteira.

Validar:

* Lit/Web Components dentro de Dockview;
* lifecycle dos components;
* drag-and-drop;
* splits;
* tab groups;
* resize;
* esconder/reabrir;
* serialization;
* floating;
* popouts;
* responsividade.

Decisão esperada:

```text
Dockview
ou
outra biblioteca
ou
layout próprio
```

Dockview deve ser considerado a opção padrão até existir motivo técnico para rejeitá-lo.

---

## Etapa E — validar Web + Electron

Criar o desenho arquitetural, ainda sem implementar o produto completo.

Determinar fronteiras entre:

```text
shared UI
client runtime
web platform
desktop platform
server
```

Estudar no T3 Code como Desktop e Web compartilham domínio sem tornar Electron o centro da arquitetura.

Resultado:

**arquitetura multi-client proposta.**

---

## Etapa F — investigar Pi versus OMP

Fazer comparação específica entre:

```text
Pi Coding Agent
Oh My Pi
```

Classificar APIs em:

```text
iguais
compatíveis
adaptáveis
específicas
incompatíveis
```

Depois definir quais conceitos pertencem ao futuro `AgentRuntime`.

Resultado:

**design conceitual do runtime adapter**, sem ainda migrar toda a aplicação.

---

## Etapa G — investigar Tauri apenas como alternativa futura

Comparar objetivamente:

```text
Electron
vs
Tauri + Node server
vs
Tauri + backend reescrito
```

A menos que exista uma vantagem forte e imediata, manter:

**Electron = primeira implementação.**

---

# 11. Roadmap após a investigação

A ordem inicial recomendada para desenvolvimento é:

### Fase 1 — Foundation

Reorganizar as fronteiras arquiteturais necessárias para que Web e Desktop possam compartilhar a aplicação.

Preservar o máximo possível do backend funcional do PI WEB.

### Fase 2 — Web + Desktop first-class

Fazer Web e Electron consumirem o mesmo modelo de aplicação/client runtime.

### Fase 3 — Docking Workspace

Transformar os elementos principais em painéis gerenciáveis.

Prioridade inicial:

```text
Project Explorer
Chat
Files
Diff
Terminal
```

### Fase 4 — Project Explorer

Redesenhar Projects + Threads inspirado no T3 Code.

### Fase 5 — Layout customization

Adicionar:

```text
move
dock
resize
tabs
hide/show
layout persistence
restore defaults
```

### Fase 6 — Theme System

Transformar temas em feature pública e facilmente extensível.

### Fase 7 — Runtime abstraction

Remover gradualmente a dependência conceitual direta do Pi do restante da aplicação.

### Fase 8 — OMP

Adicionar OMP como segundo runtime real.

Esse será o teste de que a abstração criada anteriormente realmente funciona.

### Fase 9 — expansão

Depois considerar:

```text
outros runtimes
mobile client
Tauri
additional panels
Agent Hub
debugging
LSP interfaces
etc.
```

---

# 12. Prioridades funcionais

## Prioridade 1 — Workspace/UI

É o elemento diferenciador principal.

A interface deve ser:

```text
modular
dockable
resizable
customizable
persistent
```

## Prioridade 2 — Project/Thread UX

A navegação deve ficar muito mais simples que a atual hierarquia explícita do PI WEB.

Referência principal: T3 Code.

## Prioridade 3 — Themes

Aparência deve ser facilmente substituível.

## Prioridade 4 — Multi-client

Web e Desktop devem ser produtos first-class sobre o mesmo runtime.

## Prioridade 5 — Multi-runtime

Pi primeiro.

OMP depois.

Outros runtimes posteriormente, se houver valor claro.

---

# 13. Decisões já tomadas

Estas decisões devem ser consideradas **defaults**, não questões que precisam ser rediscutidas do zero, salvo se a investigação encontrar um impedimento técnico relevante.

| Questão                                  | Decisão atual                    |
| ---------------------------------------- | -------------------------------- |
| Começar do zero?                         | **Não**                          |
| Base inicial                             | **PI WEB**                       |
| Produto pode divergir do PI WEB?         | **Sim**                          |
| Criar identidade/repositório próprio?    | **Provavelmente sim**            |
| UI                                       | **Modular e dockável**           |
| Referência de docking                    | **VS Code**                      |
| Project/Thread UI                        | **Inspirada no T3 Code**         |
| Arquitetura pode se inspirar no T3 Code? | **Sim**                          |
| Web first-class                          | **Sim**                          |
| Desktop first-class                      | **Sim**                          |
| Desktop inicial                          | **Electron**                     |
| Tauri                                    | **Possibilidade futura**         |
| Reescrever backend em Rust agora         | **Não**                          |
| Docking library inicial                  | **Investigar Dockview primeiro** |
| Sidebar direita obrigatória              | **Não**                          |
| Files/Diff/Terminal obrigatórios         | **Não**                          |
| Layout salvo                             | **Sim**                          |
| Temas extensíveis                        | **Sim**                          |
| Runtime inicial                          | **Pi**                           |
| Segundo runtime                          | **OMP**                          |
| Pi acoplado permanentemente ao produto   | **Não**                          |

---

# 14. Questões que continuam abertas

O agente investigador deve responder principalmente:

1. Quanto do PI WEB pode ser reorganizado sem reescrever backend?
2. Qual é a melhor fronteira entre UI, client runtime e server?
3. Quanto da arquitetura do `client-runtime` do T3 Code é aplicável?
4. Dockview funciona adequadamente com os Lit/Web Components atuais?
5. Quais componentes atuais podem virar panels sem mudanças profundas?
6. Workspace deve continuar visível na navegação ou virar detalhe contextual?
7. Machine deve aparecer como selector global ou dentro do Project Explorer?
8. Como representar múltiplos servidores/machines sem poluir a UI?
9. Qual deve ser o protocolo estável entre clients e server?
10. Como versionar capabilities entre versões diferentes de cliente, servidor, Pi e OMP?
11. Quais APIs atuais do PI WEB precisam ser desacopladas do Pi?
12. OMP pode utilizar grande parte do adapter Pi ou precisa de implementação independente?
13. Como empacotar server + Electron de maneira limpa?
14. Quais funcionalidades Desktop realmente precisam de uma Platform API?
15. Vale manter Lit ou uma eventual reorganização justificaria outra solução frontend?

A última questão deve ser investigada, **não assumida**. Não reescrever em React apenas porque o T3 Code usa React.

---

# 15. Resultado esperado da pesquisa

Antes de começar implementação significativa, o agente deve produzir cinco artefatos conceituais:

### A. Current Architecture Map

Como o PI WEB funciona hoje.

### B. Target Architecture

Como ficará:

```text
Web ────────┐
            │
Desktop ────┼── Client Runtime ── Protocol ── Server ── Agent Runtime
            │                                      ├─ Pi
Future ─────┘                                      └─ OMP
```

### C. UI Model

Como:

```text
Panel Registry
Docking Layout
Project Explorer
Themes
Platform UI
```

se relacionam.

### D. Migration Strategy

O que:

```text
reutilizar
extrair
refatorar
substituir
descartar
```

do PI WEB.

### E. Decision Report

Para cada grande decisão:

```text
opções consideradas
evidências encontradas
decisão
motivo
riscos
```

---

# 16. Princípio orientador

Sempre que existir dúvida entre:

> reescrever algo existente

e:

> estabelecer uma fronteira melhor em volta da implementação existente

preferir inicialmente **estabelecer a fronteira**.

O PI WEB já resolveu grande parte dos problemas difíceis relacionados a manter agentes rodando em workspaces reais.

O novo projeto deve investir energia principalmente em:

```text
arquitetura multi-client
experiência de interface
customização
separação de runtime
extensibilidade
```

e não em reconstruir desnecessariamente a infraestrutura que já funciona.

---

## Visão resumida

```text
                 ┌─────────────────────┐
                 │     Shared UI       │
                 │                     │
                 │ Docking / Themes    │
                 │ Projects / Threads  │
                 │ Panels              │
                 └──────────┬──────────┘
                            │
                ┌───────────┴───────────┐
                │                       │
              Web                    Desktop
                                      Electron
                │                       │
                └───────────┬───────────┘
                            │
                      Client Runtime
                            │
                       Protocol/RPC
                            │
                          Server
                            │
                     Agent Runtime API
                       ┌────┴────┐
                       │         │
                       Pi       OMP
```

Essa deve ser a direção inicial da investigação.

O trabalho do próximo agente não é começar imediatamente a implementar essa arquitetura. O primeiro trabalho é **validar esse modelo contra PI WEB, T3 Code, Pi, OMP, Dockview e Electron; identificar as diferenças importantes; e transformar essa hipótese em um plano de migração fundamentado no código real dos projetos.**
