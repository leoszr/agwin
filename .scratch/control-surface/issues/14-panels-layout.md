# Como painéis e layouts compartilham contexto sem controlar a execução?

Type: grilling
Labels: wayfinder:grilling
Mode: HITL
Status: resolved
Assignee: leo
Parent: ../map.md
Blocked by: 08, 09, 10

## Question

Definir o modelo mínimo de painéis e layout: Project Explorer, Chat, Files, Diff e Terminal inicialmente, todos movíveis, agrupáveis em tabs, redimensionáveis, ocultáveis e reabríveis, sem sidebar direita obrigatória.

Decidir como cada painel segue ou fixa thread/ambiente/workspace, como múltiplas instâncias se comportam e como estado visual se separa de execução e estado de domínio. Definir registro de painéis e o necessário para extensões sem framework especulativo.

Decidir escopo e persistência de layout, restauração/defaults, migração do formato quando necessária, comportamento de painéis indisponíveis por capability e expectativas para floating/popouts/responsividade com base no protótipo. Alimentar UI Model; não implementar docking.


## Comments

### 2026-09-12 — Resolução com leo

Leo fechou o modelo em cinco rodadas HITL e confirmou o resumo final. A decisão separa contexto visual, estado de domínio e execução; não implementa docking.

## Answer

- **Composição inicial:** Project Explorer global à esquerda e um único Chat no centro. Files, Diff e Terminal abrem sob demanda. Não há sidebar direita obrigatória.
- **Contexto ativo:** selecionar uma Thread no Explorer ou focar o Chat define explicitamente a Thread ativa, com indicação visível. Painéis seguidores derivam dela o Workspace e o Ambiente.
- **Instâncias e vínculos:** há uma única instância de Chat, que segue a Thread ativa. Files e Diff aceitam múltiplas instâncias, seguem o Workspace e podem ser fixados. Terminal aceita múltiplas instâncias e nasce fixo ao Workspace. O Explorer principal permanece global; Explorers adicionais podem ser fixados a um Ambiente ou Project.
- **Troca protegida:** se um painel não puder trocar com segurança por causa de estado transitório, ele se auto-fixa ao contexto atual e mostra aviso acionável; não bloqueia a navegação nem descarta estado silenciosamente.
- **Propriedade do estado:** o client runtime fornece projeções de domínio por Ambiente; cada painel mantém apenas seu estado visual. Geometria, tipo, modo seguir/fixo, IDs de vínculo e estado visual serializável podem ser persistidos. Execução, sessão de terminal, credenciais e segredos nunca entram no layout.
- **Persistência e restauração:** o layout é local a cada Cliente. Um formato versionado recebe migrações simples. Contexto/capability indisponível ou entrada inválida vira placeholder recuperável na mesma posição, sem retarget nem reset total automático.
- **Responsividade:** um único layout salvo é compactado de modo reversível quando falta espaço. Floating no mesmo documento é requisito inicial; popout externo depende da validação empacotada em [O empacotamento Electron Linux preserva terminal, sessões e popouts?](18-desktop-prototype.md).
- **Registro mínimo:** descriptor com ID de tipo, título/ícone, factory Lit, contextos e capabilities aceitos, multiplicidade e serialização. O registro serve painéis internos e extensões, sem expor execução nem antecipar um SDK amplo.

**Alternativas recusadas:** contexto sempre global ou sempre fixo; múltiplos Chats; estado ativo por grupo Dockview; sincronizar layout no servidor; snapshots amplos; retarget automático; reset automático; SDK completo e compatibilidade eterna de formato.
