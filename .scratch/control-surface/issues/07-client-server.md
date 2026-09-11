# Qual interface separa clientes, estado compartilhado e execução?

Type: grilling
Labels: wayfinder:grilling
Mode: HITL
Status: open
Assignee:
Parent: ../map.md
Blocked by: 01, 02

## Question

Qual deve ser a arquitetura multi-client e o protocolo entre UI, client runtime, server e sessiond, usando o que PI WEB já resolve e apenas padrões justificados do T3 Code?

Resolver questões abertas 2, 3, 8, 9 e a parte cliente/servidor da 10. Considerar vários servidores simultâneos na mesma janela, identidade por ambiente, acesso privado autenticado, propriedade de estado e credenciais, subscriptions, desconexão/reconexão e compatibilidade de versões. Web e Desktop devem compartilhar a lógica pertinente, sem cliente paralelo nem camada de passagem sem responsabilidade real.

Decidir módulos/interfaces necessários e organização de aplicações/pacotes somente após avaliar o código. Preservar a execução ao reiniciar UI/API. Registrar alternativas, evidências, tradeoffs e impacto na arquitetura proposta; não implementar.

Confrontar as topologias encontradas em [O que o PI WEB já resolve e onde estão seus acoplamentos?](01-pi-web.md) e [Quais padrões multi-client do T3 Code são comprovados pelo código?](02-t3-architecture.md): gateway PI WEB que encaminha acesso a máquinas remotas versus conexões dos clientes por ambiente. Escolher onde ficam credenciais de conexão, descoberta e estado compartilhável, considerando alcance de rede/origem do navegador. Distinguir esse client runtime browser-side de SessionDaemonClient, que liga backend e daemon; não mover socket Unix ou autoridade do servidor para o renderer.
