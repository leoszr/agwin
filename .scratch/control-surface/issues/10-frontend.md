# Qual frontend e estratégia de docking preservam mais valor com menos mudança?

Type: grilling
Labels: wayfinder:grilling
Mode: HITL
Status: resolved
Assignee: leo
Parent: ../map.md
Blocked by: 01, 02, 09

## Question

Decidir se manter Lit/Web Components, como decompor PiWebApp, como reutilizar plugins e quais componentes podem virar painéis sem reescrita profunda. Escolher Dockview, outra biblioteca ou layout próprio com base no protótipo, mantendo Dockview e preservação de Lit como hipóteses prioritárias, não conclusões sem evidência.

Cobrir questões abertas 1, 4, 5 e 15 e a reutilização/mudança das seções 7 e 8 do brief. A instalação é independente e não exige compatibilidade com plugins antigos; isso não justifica descartar funcionalidades maduras sem avaliar custo e valor. Não migrar para React por imitação do T3 Code. Registrar recorte e critérios de substituição, sem implementar.


## Comments

- 2026-09-12 (Wayfinder, HITL; responsável: leo): resolução confirmada em rodada interativa.

## Answer

Mantemos **Lit/Web Components** e adotamos **Dockview Core** (MIT) como gerenciador de layout da primeira entrega. Não adotamos Effect agora: aproveitamos os padrões úteis do T3 Code sobre as interfaces HTTP/WS e stores existentes, sem copiar seu client-runtime acoplado a Effect v4 RC.

**PiWebApp** passa a ser uma casca fina de composição. O client runtime possui conexões e projeções compartilhadas; contextos pequenos expõem seleção e comandos; cada Painel possui seu estado visual. O sistema atual de plugins será aproveitado pelas capacidades maduras que oferece, sem contrato de compatibilidade com plugins ou instalações antigas.

A migração ocorre em duas ondas: primeiro **Files, Diff e Terminal**; depois **Chat e Project Explorer**, após extrair estado e navegação de PiWebApp e corrigir lifecycles assimétricos. Dockview fornece docking, mas registro de painéis, persistência do produto, hide/show, responsividade e correções de lifecycle pertencem à aplicação.

Lit ou Dockview só serão reconsiderados diante de bloqueio reproduzível sem correção localizada razoável. Dockview Enterprise, layout próprio, React e transplante do runtime Effect ficam fora da primeira escolha por não resolverem requisito comprovado.
