# Product

## Register

product

## Users

Pessoa desenvolvedora que trabalha sozinha e acompanha coding agents em ambientes locais e remotos privados. Usa clientes Web e Desktop para navegar entre projetos e threads, observar execução persistente e operar arquivos, diffs e terminais sem perder o contexto do workspace.

## Product Purpose

Oferecer uma control surface modular para coding agents. A interface reúne threads de múltiplos ambientes, preserva sessões executadas pelo servidor e permite organizar painéis conforme o trabalho. O primeiro produto atende Pi em Web e Electron para Linux; a arquitetura deve permitir OMP depois sem duplicar clientes nem reescrever a infraestrutura madura do PI WEB.

## Brand Personality

Precisa, calma e confiável. A interface deve transmitir controle técnico e permanecer discreta durante sessões longas de trabalho.

## Anti-references

Evitar dashboards SaaS decorativos, excesso de cards, glassmorphism, animação ornamental e hierarquias que escondam o estado operacional. Não copiar a aparência do VS Code ou do T3 Code sem adaptar seus padrões ao domínio deste produto.

## Design Principles

- Manter a execução e seu estado visíveis sem transformar a interface em ruído.
- Usar padrões familiares de IDE para docking, foco e teclado.
- Simplificar a navegação de Projects e Threads sem esconder Ambiente e Workspace quando forem necessários para evitar ambiguidade.
- Permitir que cada pessoa componha o espaço de trabalho com painéis, sem impor sidebars fixas.
- Preservar uma experiência coerente entre Web e Desktop; recursos nativos aparecem apenas onde agregam capacidade real.

## Accessibility & Inclusion

Atender WCAG 2.2 AA. Garantir contraste, navegação completa por teclado, foco visível, semântica para leitores de tela, alvos operáveis e respeito a `prefers-reduced-motion`. Não depender somente de cor para comunicar estado.
