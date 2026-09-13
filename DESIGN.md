---
name: Control surface para coding agents
description: Interface modular e precisa para acompanhar coding agents locais e remotos.
---

<!-- SEED: re-run /impeccable document once there's code to capture the actual tokens and components. -->

# Design System: Control surface para coding agents

## 1. Overview

**Creative North Star: "The Quiet Workbench"**

Uma bancada operacional precisa e calma. A interface usa densidade de IDE, hierarquia clara e superfícies neutras para manter threads, painéis e estados legíveis durante sessões longas. VS Code orienta docking e affordances; T3 Code orienta navegação; Zed orienta contenção e foco no conteúdo.

O movimento responde a ações e mudanças de estado, sem coreografia ornamental. O sistema rejeita dashboards SaaS decorativos e a estética Cyberpunk HUD.

**Key Characteristics:**
- Densa sem parecer congestionada.
- Neutra sem apagar estados importantes.
- Familiar para quem usa IDEs.
- Responsiva nas interações, nunca cenográfica.

## 2. Colors

A interface adota uma paleta estritamente neutra, alinhada às decisões [Dockview preserva comportamento e estado dos painéis reais do PI WEB?](.scratch/control-surface/issues/09-dockview-prototype.md) e [Qual contrato de temas torna a aparência substituível sem acoplar componentes?](.scratch/control-surface/issues/15-themes.md): fundo, superfícies, bordas e estados estruturais usam tons neutros (branco e off-whites no tema claro; preto e cinzas escuros no tema escuro). O sistema não admite paletas decorativas nem acentos coloridos na UI.

Ações primárias, seleção atual, anel de foco e indicadores de status operacional (execução, erro, espera, offline) usam exclusivamente a mesma paleta neutra, sem acentos coloridos. A comunicação de estados nunca depende exclusivamente de cor, preservando contraste WCAG 2.2 AA e foco visível em todos os controles.

Superfícies estruturais da bancada são claramente separadas de conteúdo com semântica própria: saídas como sequências ANSI do terminal, realces sintáticos e diffs de código preservam suas cores de domínio em camadas isoladas, sem contaminar nem sofrer interferência dos tokens neutros da UI.

### Primary
- **Neutral Emphasis:** Contraste entre tons da paleta neutra destaca ações primárias, seleção ativa e indicador de foco, sem introduzir outra cor.

### Neutral
- **Light Whites:** Branco puro e off-whites neutros para fundo, superfícies, divisores e estados inativos do tema claro.
- **Dark Grays and Black:** Preto e cinzas escuros neutros para fundo, superfícies, divisores e estados inativos do tema escuro.

### Named Rules

**The Neutral Workbench Rule.** Superfícies, ações, foco e indicadores de estado da UI permanecem estritamente neutros. Conteúdo com semântica própria (ANSI, realces sintáticos e diffs) preserva suas cores de domínio, sem estender essa exceção aos indicadores da bancada.

## 3. Typography

**Display Font:** [technical sans to be chosen at implementation]
**Body Font:** [same technical sans to be chosen at implementation]
**Label/Mono Font:** [mono font to be chosen for code and terminal only]

**Character:** Uma única sans técnica sustenta labels, navegação e conteúdo. Monoespaçada fica restrita a código, terminal e identificadores que exigem alinhamento.

### Named Rules

**The One UI Voice Rule.** Não misturar famílias de display na interface operacional.

## 4. Elevation

Superfícies ficam planas por padrão. Divisores e variações tonais explicam estrutura; sombras aparecem apenas quando floating, popout ou drag exige separação espacial.

### Named Rules

**The State Earns Motion Rule.** Transições servem feedback, foco, abertura e reposicionamento; não existem para decorar carregamento.

## 5. Components

Os componentes serão documentados após o primeiro protótipo e a extração dos tokens reais.

## 6. Do's and Don'ts

### Do:
- **Do** usar affordances familiares de VS Code para docking, foco e teclado.
- **Do** manter Projects, Threads e estados operacionais legíveis em alta densidade.
- **Do** respeitar `prefers-reduced-motion` em toda transição.

### Don't:
- **Don't** criar dashboards SaaS decorativos, excesso de cards ou hierarquias que escondam o estado operacional.
- **Don't** usar glassmorphism ou animação ornamental.
- **Don't** copiar a aparência do VS Code ou do T3 Code sem adaptar seus padrões ao domínio.
- **Don't** adotar estética Cyberpunk HUD: neon, glow, ornamentação técnica e informação cenográfica são proibidos.
