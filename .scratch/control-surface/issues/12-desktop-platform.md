# Como Electron integra servidor local e recursos nativos sem duplicar o Web?

Type: grilling
Labels: wayfinder:grilling
Mode: HITL
Status: resolved
Assignee: leo
Parent: ../map.md
Blocked by: 18

## Question

Definir a arquitetura Desktop Linux: quem inicia/encontra o servidor local, quem possui seu lifecycle, como sessões sobrevivem ao fechamento/reinício do cliente e como o renderer usa a mesma interface lógica do Web.

Resolver questões abertas 13 e 14: empacotamento/distribuição/updates e quais recursos realmente precisam da Platform API — dialogs/filesystem, notificações, abrir URLs, clipboard, credenciais, lifecycle, menus, deep links, tray e janelas. Classificar cada recurso como necessário inicialmente ou posterior; não tornar todos os tópicos investigados features obrigatórias.

Definir isolamento e segurança de preload/renderer, conexão a servidores remotos privados e interação com popouts. Electron permanece o default; impedimento relevante pode abrir nova decisão, não autoriza troca silenciosa para Tauri.

Usar os resultados de [O empacotamento Electron Linux preserva terminal, sessões e popouts?](18-desktop-prototype.md) para fechar a topologia e as restrições de distribuição. Não tratar modo Node, ABI nativa ou sobrevivência do daemon como garantias obtidas apenas pela leitura do código.

## Comments

- 2026-09-12 (Wayfinder, HITL; responsável: leo): decisão confirmada em quatro rodadas interativas.
- 2026-09-12 (revisão documental, correções solicitadas por leo): esclarecida a separação entre bootstrap/preparação de versões pelo Main e lifecycle persistente/ativação/health check/rollback pelo supervisor, conforme [Recomendações de alteração do plano](../recommendations.md). Mantidas as garantias e os limites aprovados.

## Answer

### Topologia e lifecycle

Electron é um **cliente fino** do mesmo gateway HTTP/WS usado pelo Web. O Main faz o bootstrap: instala o runtime versionado, encontra o supervisor existente ou o inicia sob demanda, consulta seu estado e encaminha comandos de lifecycle. Não supervisiona gateway Web/API ou `sessiond` diretamente. O runtime do host é extraído do AppImage para uma versão estável sob `XDG_DATA_HOME`, porque um processo persistente não pode depender do mount temporário do AppImage. O host inicia sob demanda na primeira abertura do app em cada login e continua após fechar janelas ou usar Quit.

O supervisor possui gateway Web/API e `sessiond` e é o único responsável por seu lifecycle persistente: início, status, encerramento limpo e recuperação. Também coordena a ativação de versões do host, o health check e o rollback, sem depender da janela aberta. Não instala nem descobre o próprio host; essas tarefas de bootstrap pertencem ao Main. É expressamente proibido que o supervisor se expanda para orquestração genérica de processos, plugins de supervisão ou gerenciamento de frotas.

A garantia inicial é deliberadamente limitada: agentes ativos sobrevivem ao fechamento/reinício de Electron e do gateway, mas não a logout, reboot ou `Stop Host`. Sessions persistidas continuam retomáveis depois. Settings mostra estado e oferece Start/Stop/Restart; Stop pede confirmação quando há agentes ativos. Não haverá tray usado apenas para manter processos vivos.

```text
AppImage / Electron Main
  ├─ instala/descobre host versionado em XDG_DATA_HOME
  ├─ bootstrap local + Platform API curada
  └─ Renderer / popouts ── HTTP/WS + cookie HttpOnly ── Gateway
                                                        └─ sessiond ─ Pi
                    supervisor próprio possui ──────────┘
```

### Segurança e autenticação

O renderer principal e os popouts utilizam a mesma topologia e origem HTTP/WS do gateway local aprovada em [Qual interface separa clientes, estado compartilhado e execução?](07-client-server.md), sem schemes privilegiados adicionais que alterem a topologia de segurança. O renderer principal mantém `sandbox: true`, `contextIsolation: true` e `nodeIntegration: false`, com CSP rigorosa. O preload expõe apenas métodos curados por operação estrita (nunca `ipcRenderer`, Node ou filesystem bruto) exclusivamente na janela principal; popouts não recebem preload.

A autenticação é unificada: o Main obtém do host um bootstrap local de curta duração, guarda apenas o material necessário em `safeStorage` e o troca por sessão com cookie `Secure`/`HttpOnly` e proteção CSRF/origem compartilhada entre renderer e popouts. Ações nativas não justificam ampliar o privilégio de cada janela. Credenciais de Ambientes remotos continuam exclusivamente no gateway. Conexões privadas remotas seguem sempre pelo gateway; Electron não ganha uma segunda topologia nem recebe segredos remotos.

### Platform API inicial

Entram apenas:

- lifecycle e status do host, atualização e política de janelas;
- `openExternal`, clipboard e `safeStorage` por métodos estreitos;
- dialogs de arquivo/pasta para importação, exportação, upload ou download explícitos;
- criação/controle seguro de janela principal e popouts.

Arquivos e Workspaces de qualquer Ambiente continuam acessados pelo gateway. Um caminho escolhido no cliente nunca é interpretado como caminho de Ambiente remoto. Notificações OS, tray, deep links, atalhos globais e menus nativos avançados permanecem explicitamente fora da primeira entrega; menus padrão mínimos do sistema não viram framework de comandos.

### Distribuição e atualização

A primeira entrega usa AppImage, o formato validado por [O empacotamento Electron Linux preserva terminal, sessões e popouts?](18-desktop-prototype.md), com verificação de atualização e confirmação antes de baixar/aplicar/reiniciar. O pacote inclui explicitamente runtime Node, dependências Pi e módulos nativos reconstruídos; a implementação deve escolher bundle autocontido ou árvore runtime desempacotada, sem depender de Node global.

Electron e host são versionados separadamente dentro de uma faixa de protocolo compatível. O Main coordena a atualização do cliente Electron e prepara novas versões do host lado a lado, com as confirmações de download/aplicação previstas acima. O supervisor coordena a ativação da versão do host, o health check e o rollback; o Main apenas solicita a troca e acompanha seu resultado, sem substituir gateway/`sessiond` diretamente. A troca do host é adiada enquanto houver agentes ativos. Atualização crítica oferece interrupção explícita com aviso, nunca mata agentes silenciosamente. Releases devem validar integridade e origem antes da ativação e preservar a versão anterior até o novo host ficar pronto. Se o health check falhar, o supervisor reverte para a versão anterior.

### Alternativas e limites

- `systemd --user` daria supervisão nativa, mas foi rejeitado em favor de supervisor próprio; portanto logout/reboot não fazem parte da garantia inicial.
- Processo `detached` sem supervisor foi rejeitado: o protótipo provou sobrevivência básica, não restart, health check ou ownership confiável.
- Supervisor com escopo estrito: limita-se ao lifecycle persistente de gateway/`sessiond` e à ativação de versões do host, health check e rollback; bootstrap e preparação de versões pertencem ao Main. Orquestração genérica de processos, plugins de supervisão ou gerenciamento de frotas foram expressamente proibidos.
- Recursos nativos postergados: notificações OS, tray e menus avançados permanecem explicitamente fora da primeira entrega.
- Possuir processos pelo Electron encerraria acesso Web e sessões no Quit.
- Pacotes por distro e update silencioso ampliariam o primeiro canal sem evidência de necessidade.
- Tauri permanece alternativa futura; nenhum impedimento justifica trocar o default Electron.

A decisão fecha a topologia Desktop e libera a estratégia de migração. Não surgiu novo ticket: detalhes executáveis de protocolo de controle, layout em XDG e empacotamento pertencem à implementação, não a outra decisão arquitetural.
