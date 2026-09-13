# Qual interface mínima acomoda Pi agora e OMP depois?

Type: grilling
Labels: wayfinder:grilling
Mode: HITL
Status: resolved
Assignee: leo
Parent: ../map.md
Blocked by: 01, 04, 07

## Question

Definir o design conceitual de AgentRuntime com base em usos reais do PI WEB e diferenças concretas Pi/OMP, sem implementar o segundo runtime ou inventar abstração genérica para agentes hipotéticos.

Resolver questões abertas 10, 11 e 12: acoplamentos a encapsular, normalização de comandos/eventos/sessões/modelos/tools/extensões, partes reaproveitáveis entre adapters versus implementações distintas e funcionalidades específicas anunciadas por capabilities. Separar capacidades de ambiente/plataforma e de agente.

Definir contrato e política de compatibilidade entre versões de cliente, servidor e runtime, incluindo recursos ausentes sem falsos fallbacks. Registrar o que precisa ser preparado na primeira entrega Pi e o que fica para integração OMP posterior.

Decidir o local de execução do adapter OMP sem confundir processo com ambiente: um worker/sidecar pode pertencer ao mesmo servidor de uma thread. Avaliar os requisitos Node/Bun, a separação de credenciais e sessões e o caminho de UI interativa do host; nomes de APIs e versão JSONL iguais não bastam como prova de compatibilidade.

## Comments

2026-09-12 (Wayfinder): leo aprovou em três rodadas interativas a interface mínima de AgentRuntime, o núcleo normalizado com extensões por capability, worker Bun no Ambiente, matriz de compatibilidade testada, sessões não portáveis, interação tipada e stores de credenciais separados.

## Answer

Adotar um seam server-side **AgentRuntime**, orientado aos conceitos usados pelo produto e implementado agora por um adapter Pi. O adapter OMP será uma implementação independente posterior; não haverá fachada genérica para outros agentes.

A superfície conceitual aprovada contém:

- **descriptor:** identidade e versão do adapter/runtime, schema e capabilities tipadas;
- **sessions:** criar, retomar, ramificar, ler e encerrar;
- **commands:** prompt, steer/follow-up e abort;
- **events:** subscription ordenada, com cursor quando suportado;
- **catalog:** modelos, tools e extensões disponíveis;
- **interaction:** pedidos e respostas tipados para input, confirmação e seleção.

O contrato normaliza somente o núcleo necessário: lifecycle, mensagens, prompts, cancelamento, erros, modelos, tools e interações. Recursos específicos usam payloads tipados condicionados por capability. Hub/subagents, LSP, debugger e kernels não ganham equivalentes falsos. Filesystem, Git, Diff, Terminal, Project, Workspace e capacidades de plataforma permanecem fora de AgentRuntime.

Cada adapter publica uma matriz testada de versões do runtime e schemas suportados. Combinação incompatível falha no startup ou bloqueia novas Sessions com erro explícito. Capability ausente remove a ação da UI e rejeita o comando; não há fallback implícito nem detecção heurística por nomes de APIs.

Cada Session pertence imutavelmente ao runtime que a criou. Pi não retoma Session OMP e OMP não lê Session Pi. Trocar runtime cria nova Thread e nova Session com proveniência; importação/conversão de histórico não faz parte da primeira entrega.

O futuro adapter OMP executa em worker Bun supervisionado server-side dentro do mesmo Ambiente da Thread. O renderer e o gateway não recebem credenciais nem autoridade de execução. Pi e OMP mantêm seus stores nativos separados; o produto usa referências opacas para modelos/perfis e não copia segredos entre runtimes.

Interações suportadas de extensões/tools são convertidas pelo adapter para pedidos tipados e correlacionadas pelo servidor com respostas do Cliente. UI arbitrária do runtime não é transmitida; forma não representável exige capability específica ou falha clara.

Na primeira entrega, encapsular os acoplamentos reais de `PiSessionService`, gateway, auth/model, trust, attachments, tools, extensões e host UI no adapter Pi. Preservar `sessiond`, persistência e protocolo server-side existentes. OMP fica fora da implementação inicial; entram agora apenas o seam mínimo, identidade persistida do runtime por Session, descriptor/capabilities e erros que tornam o segundo adapter possível sem contaminar UI e protocolo com tipos Pi.

**Alternativas recusadas:** encapsular Pi sem interface; contrato amplo comum; normalização total; tentativa e erro para capabilities; retomada cruzada por JSONL v3; vault único; OMP dentro do sessiond Node ou no gateway.
