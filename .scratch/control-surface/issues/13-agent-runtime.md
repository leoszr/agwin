# Qual interface mínima acomoda Pi agora e OMP depois?

Type: grilling
Labels: wayfinder:grilling
Mode: HITL
Status: open
Assignee:
Parent: ../map.md
Blocked by: 01, 04, 07

## Question

Definir o design conceitual de AgentRuntime com base em usos reais do PI WEB e diferenças concretas Pi/OMP, sem implementar o segundo runtime ou inventar abstração genérica para agentes hipotéticos.

Resolver questões abertas 10, 11 e 12: acoplamentos a encapsular, normalização de comandos/eventos/sessões/modelos/tools/extensões, partes reaproveitáveis entre adapters versus implementações distintas e funcionalidades específicas anunciadas por capabilities. Separar capacidades de ambiente/plataforma e de agente.

Definir contrato e política de compatibilidade entre versões de cliente, servidor e runtime, incluindo recursos ausentes sem falsos fallbacks. Registrar o que precisa ser preparado na primeira entrega Pi e o que fica para integração OMP posterior.

Decidir o local de execução do adapter OMP sem confundir processo com ambiente: um worker/sidecar pode pertencer ao mesmo servidor de uma thread. Avaliar os requisitos Node/Bun, a separação de credenciais e sessões e o caminho de UI interativa do host; nomes de APIs e versão JSONL iguais não bastam como prova de compatibilidade.
