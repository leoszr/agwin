# Registro e Auditoria de Gates de Release: Pi / Linux

Conforme definido em `migration-strategy.md` e aprovado no handoff, cada gate registra separadamente o requisito aprovado, a evidência executada disponível e as verificações pendentes. Gates que dependem do artefato empacotado final são explicitamente mantidos como pendentes até execução no artefato distribuível.

---

## Gate 1: Isolamento entre Ambientes e Segurança do Gateway
- **Requisito aprovado:** O gateway concentra acesso same-origin; credenciais de conexão remota nunca chegam ao cliente; conexões WebSocket restritas à origem do gateway; proteção CSRF/origem; falha de um ambiente não invalida projeções de outros.
- **Evidência disponível nesta revisão:**
  - `src/client/runtime/ClientRuntime.test.ts`: verifica que tokens e cabeçalhos privados de máquinas remotas são removidos antes da projeção e que erro de conexão em `flaky-remote` não invalida `local`.
  - `src/desktop/desktopSecurity.test.ts`: valida CSP com `connect-src` estrito sem wildcard `ws: wss:`, sandbox ativo, contextIsolation ativo e popouts sem preload.
- **Verificação pendente:**
  - Teste de penetração com sessão autenticada em rede remota simulada (`test/security/gateway-auth-origin.sh`).

---

## Gate 2: Lifecycle Supervisionado do Host e Atualização com Rollback
- **Requisito aprovado:** Supervisor embutido gerencia o ciclo de vida do host Gateway/sessiond sob `XDG_DATA_HOME`; o fechamento ou reinício do cliente Desktop não encerra processos do host; atualizações são adiadas enquanto houver agentes ativos; falhas de spawn ou health check mantêm ou restauram a versão anterior de forma consistente.
- **Evidência disponível nesta revisão:**
  - `src/desktop/supervisor.test.ts`: verifica inicialização, persistência de PID após fechamento de cliente, rejeição de atualização com sessões ativas, consistência de versão em falhas de spawn e rollback automático após falha no health check.
  - `src/desktop/desktopSecurity.test.ts`: verifica que `restartHost` recusa parada abrupta quando agentes estão em execução.
- **Verificação pendente:**
  - Teste em processo supervisor desacoplado executando durante reinício manual do usuário do sistema operacional.

---

## Gate 3: ABI das Dependências Nativas e PTY Linux
- **Requisito aprovado:** `node-pty` compilado para a ABI do runtime de execução (Node 22 / Electron ABI 149); canal de entrada com fragmentação UTF-8 segura limitada a 16.384 bytes; processos de terminal fixados imutavelmente ao Workspace de origem.
- **Evidência disponível nesta revisão:**
  - Protótipo empacotado na branch `prototype/electron-linux` comprovou execução de `node-pty` retornando `PTY_OK`.
  - `src/client/workbench/TerminalDockviewPanel.test.ts`: validação de limites de canal UTF-8 por bytes reais (incluindo caracteres multibyte) e rejeição de retargeting de terminal.
- **Verificação pendente:**
  - Execução do teste de fumaça interativo dentro do AppImage compilado final: `ELECTRON_RUN_AS_NODE=1 ./dist/AppImage pty-probe.cjs`.
  - **Status do Gate:** Pendente de empacotamento do artefato binário final.

---

## Gate 4: Inventário Transitivo de Licenças e Avisos de Terceiros
- **Requisito aprovado:** Auditoria completa e inventário transitivo de todas as dependências redistribuídas no pacote de produção, confirmando licenças permissivas compatíveis e preservação dos avisos de copyright/MIT do PI WEB.
- **Evidência disponível nesta revisão:**
  - `docs/distribution-licenses.md`: auditou todas as 142 dependências de produção do `package-lock.json`, confirmando que todas utilizam licenças permissivas (MIT, BSD-3-Clause, ISC, BlueOak-1.0.0).
  - `src/desktop/hardeningRelease.test.ts`: validação automatizada da integridade do inventário.
- **Verificação pendente:** Nenhuma pendência para distribuição permissiva. Gate atendido.

---

## Gate 5: Paridade de Bancada Completa (Web e Desktop)
- **Requisito aprovado:** A nova bancada modular (Explorer, Chat, Files, Diff, Terminal, layout e temas neutros) preserva todas as capacidades do PI WEB anterior; mesma Session compartilhável e operável simultaneamente no Web e Desktop.
- **Evidência parcial nesta revisão (mocks, não smoke real):**
  - `docs/legacy-parity-matrix.md`: matriz detalhando cada capacidade, fluxo, comportamento e teste correspondente.
  - `src/desktop/sessionParity.test.ts`: usa Gateway em memória — comprova lógica de transcript compartilhado, não operação real no Web/Desktop.
  - `src/client/workbench/ModularWorkbenchApp.test.ts`: integração dos painéis em happy-dom — não prova renderização real nem runtime conectado.
- **Verificação pendente:**
  - Smoke manual completo com modelo externo real (Anthropic / OpenAI) acompanhado simultaneamente no navegador e no AppImage instalado.
  - **Status do Gate:** Pendente de validação manual com credenciais de produção de IA.
