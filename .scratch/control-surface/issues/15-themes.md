# Qual contrato de temas torna a aparência substituível sem acoplar componentes?

Type: grilling
Labels: wayfinder:grilling
Mode: HITL
Status: resolved
Assignee: leo
Parent: ../map.md
Blocked by: 01, 10, 14

## Question

Determinar se os tokens CSS atuais do PI WEB bastam ou quais mudanças mínimas são necessárias para temas first-class no modelo de UI escolhido.

Cobrir tema por configurações, separação de lógica, criação simples de temas, dark/light, cobertura dos painéis e Dockview, acessibilidade e importação/exportação se viável. Definir a relação com temas/plugins reutilizados e com UI nativa. Theme packs são possibilidade futura, não obrigação antecipada.

Decidir o contrato e limites da primeira entrega sem construir um design-token system maior que a necessidade. Produzir contribuição ao UI Model e critérios de validação.

## Comments

### 2026-09-12 — Resolução com leo

Leo fechou o contrato em quatro rodadas HITL e confirmou o entendimento final. A decisão amplia o sistema existente somente onde há lacunas comprovadas; não implementa temas.

## Answer

- **Base:** preservar o conjunto semântico `--pi-*` atual e adicionar somente tokens exigidos pelas superfícies reais. Componentes consomem tokens, nunca IDs ou valores de temas concretos. Não criar camadas `primitive/semantic/component` antecipadamente.
- **Descriptor:** `Theme` declarativo e versionado contém ID qualificado, nome, modo (`light` ou `dark`), par opcional da outra variante e valores para tokens conhecidos. Valores são validados por categoria CSS; temas não injetam seletores, regras, scripts ou URLs arbitrárias.
- **Registro:** core e plugins podem contribuir temas pelo registro reutilizado, sem compatibilidade com plugins antigos. ID duplicado, versão incompatível, token ausente ou valor inválido rejeita a contribuição inteira, emite diagnóstico e seleciona o tema core correspondente.
- **Seleção:** configurações oferecem `auto` e temas explícitos. `auto` segue `prefers-color-scheme` e resolve um par light/dark declarado. A preferência é local por Cliente, coerente com a propriedade local do layout.
- **Cobertura:** shell, painéis, diálogos, Dockview, CodeMirror, xterm e popouts usam os mesmos tokens ou adapters explícitos. Dockview mapeia `--dv-*` para `--pi-*`; integrações não exigem fork. Conteúdo ANSI do terminal preserva sua semântica própria.
- **Desktop:** Electron recebe somente o modo light/dark e, quando suportado, cor base de janela/titlebar. Diálogos e controles nativos seguem o sistema; não se promete paridade visual integral.
- **Acessibilidade:** um tema suportado precisa preservar foco visível, estados que não dependem só de cor e contraste WCAG 2.2 AA. Checks automatizados cobrem combinações críticas; revisão manual percorre todas as superfícies, incluindo popouts.
- **Evolução:** o contrato tem versão simples. Mudanças aditivas podem usar fallback core; remoções ou renomes exigem versão maior e diagnóstico claro.
- **Fora da primeira entrega:** importação/exportação, arquivos de tema do usuário, theme packs, marketplace, CSS arbitrário e um design-token system em camadas.

Critérios de validação: alternar tema sem reload atualiza todas as superfícies e popouts; `auto` reage ao sistema; nenhum componente depende de tema concreto; tema inválido cai integralmente no core sem UI parcial; adapters mantêm Dockview/editor/terminal coerentes; checks críticos e revisão manual confirmam WCAG 2.2 AA.
