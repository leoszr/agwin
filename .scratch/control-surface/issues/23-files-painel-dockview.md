# 23: Usar Files como primeiro Painel Dockview

**What to build:** Disponibilizar Files como primeiro Painel real da bancada, preservando seu serviço server-side e seu contexto no Web e Desktop.

**Blocked by:** 22/Operar a mesma Session no Desktop Linux

**Status:** ready-for-human

- [x] Files mostra e opera arquivos do Workspace selecionado sem acessar filesystem pelo cliente.
- [x] O Painel pode seguir ou fixar contexto sem retargeting silencioso.
- [x] Move, hide/reopen, floating e popout preservam contexto e estado relevante.
- [x] Foco e lifecycle continuam corretos após reparenting.
- [ ] O fluxo passa em smoke no Web e no AppImage (validação de ponta a ponta com servidor ativo e AppImage empacotado pendente de verificação no ambiente operacional).

### 2026-09-16 — Smoke Web parcial (Bancada montada em 25)

Painel Files renderiza a árvore real no browser (`Files (/home/leo/Projects) [following]`, entradas do workspace listadas; `GET .../tree` 200). Header-click esconde o painel, Enter do teclado expande. Observação: clique de mouse no header removeu o painel da vista sem erro no console (sem perda de dados; reload restaura); Enter funciona — semântica exata do clique a esclarecer em follow-up, não bloqueia o smoke.
AppImage: repackado com a Bancada no bundle (asar contém o painel), shell abre; interação GUI empacotada pendente de ambiente com display.

### 2026-09-17 — Smoke AppImage diferido (decisão: leo)

Foco total no webapp até conclusão; AppImage fica em segundo plano e seu smoke permanece pendente sem bloquear as próximas issues.
