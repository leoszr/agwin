# Control surface para coding agents

Vocabulário do produto em planejamento. Termos ainda não decididos não são definidos aqui.

## Language

**Control surface**:
Interface pela qual uma pessoa acompanha e controla coding agents que executam em seus ambientes.

**Ambiente**:
Servidor no qual o agente executa, local ou remoto. Não é sinônimo de workspace nem implica um workspace exclusivo.
_Avoid_: usar ambiente como sinônimo de workspace.

**Thread**:
Registro durável de interação apresentado na navegação. Cada thread pertence a um único ambiente, referencia exatamente uma session e mantém vínculo imutável com um workspace. Várias threads podem compartilhar o mesmo workspace; usar workspace isolado é uma escolha explícita. Retomar uma thread retoma a mesma session. Ramificar cria outra thread e outra session ligadas ao ponto de origem; ambas seguem independentes.
_Avoid_: tratar thread como mero nome de UI para session, trocar seu workspace durante a conversa ou substituir sua session ao retomar.

**Session**:
Conversa e execução mantidas por um agent runtime. Cada session é referenciada por exatamente uma thread.
_Avoid_: guardar em session metadados de navegação próprios da thread.

**Agent runtime**:
Módulo server-side que mantém sessions e executa comandos de um harness de coding agent. Cada session pertence ao runtime que a criou; capabilities específicas não implicam capacidades de ambiente ou plataforma.
_Avoid_: presumir portabilidade de sessions entre runtimes ou atribuir filesystem, Git e terminal ao agent runtime.

**Project**:
Agrupador de workspaces dentro de um ambiente. Cópias do mesmo repositório em ambientes diferentes são projects distintos, embora a UI possa agrupá-las quando houver evidência de equivalência.
_Avoid_: presumir uma identidade global de project entre ambientes.

**Workspace**:
Contexto de arquivos e execução pertencente a um project. Pode representar o diretório principal ou um contexto isolado, como um worktree, e pode ser compartilhado por várias threads. Quando fica indisponível, suas threads permanecem legíveis em estado degradado e não são redirecionadas automaticamente.
_Avoid_: criar um workspace ou worktree exclusivo para toda thread.

**Cliente**:
Aplicação Web ou Desktop pela qual a pessoa acessa seus ambientes. Uma mesma janela pode apresentar threads de ambientes diferentes.

**Gateway**:
Ponto de acesso server-side no qual um cliente se autentica para alcançar o ambiente local e ambientes remotos. Um gateway encaminha acesso, mas não se torna dono da execução remota.

**Client runtime**:
Parte compartilhada pelos clientes que mantém projeções e estado de conexão de cada ambiente. Não executa agentes nem possui o estado durável dos ambientes.

**Painel**:
Área funcional da interface que a pessoa pode posicionar, agrupar, redimensionar, ocultar e reabrir.
