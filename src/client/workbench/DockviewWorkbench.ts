import { createDockview, type DockviewApi, type IContentRenderer, type SerializedDockview } from "dockview-core";
import { WorkbenchPanelRegistry, type IWorkbenchPanelInstance } from "./panelRegistry.js";
import { THEME_TOKENS } from "../src/theme.js";
import {
  environmentWorkspaceKey,
  loadWorkbenchLayoutFromStorage,
  parseWorkbenchLayout,
  restoreWorkbenchPanels,
  ResponsiveLayoutManager,
  saveWorkbenchLayoutToStorage,
  type SerializedLayoutData,
  type SerializedPanelConfig,
} from "./layoutStorage.js";
import {
  PlaceholderDockviewPanel,
} from "./PlaceholderDockviewPanel.js";
import type { PanelState, WorkspaceContext } from "./types.js";
import type { WorkspacePanelContext } from "../src/plugins/types.js";
import { FilesDockviewPanel, type FilesPanelOptions } from "./FilesDockviewPanel.js";
import { DiffDockviewPanel, type DiffService } from "./DiffDockviewPanel.js";
import {
  TerminalDockviewPanel,
  type TerminalPanelRender,
} from "./TerminalDockviewPanel.js";
import { resolveAppUrl } from "../src/appUrl.js";


/**
 * Shared workbench chrome: Dockview adapter (--dv-* maps to --pi-*) plus the
 * neutral panel chrome. Applied to the shadow-tree shell and mirrored into
 * popout documents so both follow the active theme.
 */
export const WORKBENCH_CHROME_CSS = `
.workbench-host, .workbench-popout-theme {
  --dv-group-view-background-color: var(--pi-bg);
  --dv-tabs-and-actions-container-background-color: var(--pi-surface);
  --dv-activegroup-visiblepanel-tab-background-color: var(--pi-surface);
  --dv-activegroup-visiblepanel-tab-color: var(--pi-text);
  --dv-activegroup-hiddenpanel-tab-background-color: var(--pi-surface);
  --dv-activegroup-hiddenpanel-tab-color: var(--pi-text-secondary);
  --dv-inactivegroup-visiblepanel-tab-background-color: var(--pi-surface);
  --dv-inactivegroup-visiblepanel-tab-color: var(--pi-text-secondary);
  --dv-inactivegroup-hiddenpanel-tab-background-color: var(--pi-bg);
  --dv-inactivegroup-hiddenpanel-tab-color: var(--pi-muted);
  --dv-tab-divider-color: var(--pi-border-muted);
  --dv-separator-border: var(--pi-border-muted);
  --dv-sash-color: var(--pi-border-muted);
  --dv-paneview-header-border-color: var(--pi-border-muted);
  --dv-paneview-active-outline-color: var(--pi-accent);
  --dv-floating-group-border: var(--pi-border);
  --dv-floating-box-shadow: var(--pi-shadow-strong);
  --dv-scrollbar-background-color: var(--pi-border-muted);
  --dv-icon-hover-background-color: var(--pi-surface-hover);
  --dv-drag-over-background-color: var(--pi-surface-hover);
  --dv-drag-over-border-color: var(--pi-accent-border);
}
.files-panel-header, .diff-panel-header, .chat-header {
  background: var(--pi-surface);
  color: var(--pi-text-secondary);
  border-bottom: 1px solid var(--pi-border-muted);
  padding: 6px 10px;
  font: 12px system-ui, sans-serif;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.files-list, .diff-file-list, .chat-transcript {
  margin: 0;
  padding: 4px;
  background: var(--pi-bg);
  color: var(--pi-text);
}
.files-list { list-style: none; }
.files-list li, .diff-file-item, .chat-message {
  padding: 5px 8px;
  border-radius: 6px;
  border-left: 2px solid transparent;
}
.files-list li.selected, .diff-file-item.selected {
  background: var(--pi-surface-hover);
  border-left-color: var(--pi-text-secondary);
  color: var(--pi-text-bright);
}
.diff-viewer {
  margin: 4px;
  padding: 8px;
  border: 1px solid var(--pi-border-muted);
  border-radius: 6px;
  background: var(--pi-bg);
  color: var(--pi-text-secondary);
  overflow: auto;
}
.chat-composer { display: flex; gap: 6px; padding: 6px; border-top: 1px solid var(--pi-border-muted); background: var(--pi-surface); }
.chat-input {
  flex: 1 1 auto;
  min-width: 0;
  border: 1px solid var(--pi-border);
  border-radius: 6px;
  background: var(--pi-bg);
  color: var(--pi-text);
  padding: 6px 8px;
  font: 13px system-ui, sans-serif;
}
.chat-composer button {
  border: 1px solid var(--pi-border);
  border-radius: 6px;
  background: var(--pi-surface-hover);
  color: var(--pi-text);
  padding: 6px 10px;
  cursor: pointer;
}
.terminal-panel-unavailable {
  padding: 24px;
  color: var(--pi-muted);
  text-align: center;
}
:focus-visible { outline: 2px solid var(--pi-accent); outline-offset: 1px; }
@media (prefers-reduced-motion: reduce) {
  .workbench-host *, .workbench-popout-theme * { transition: none !important; animation: none !important; }
}
`;
/** Re-run `onChange` whenever the active theme changes on the source root. */
export function observeDocumentTheme(source: Element, onChange: () => void): () => void {
  const observer = new MutationObserver(() => { onChange(); });
  observer.observe(source, { attributes: true, attributeFilter: ["style", "data-pi-web-theme"] });
  return () => { observer.disconnect(); };
}

export interface DockviewWorkbenchOptions {
  container: HTMLElement;
  initialContext: WorkspaceContext;
  onActivePanelChange?: (panelId: string) => void;
  popoutUrl?: string | undefined;
}

export interface RestoredPanelServices {
  files?: FilesPanelOptions["files"];
  api?: FilesPanelOptions["api"];
  fileService?: FilesPanelOptions["fileService"];
  diffService?: DiffService | undefined;
  terminalPanelContext?: WorkspacePanelContext | undefined;
  renderTerminalPanel?: TerminalPanelRender | undefined;
}

export interface RestoreSavedLayoutOptions extends RestoredPanelServices {
  isContextAvailable?: ((context: WorkspaceContext) => boolean) | undefined;
}

export class DockviewWorkbench {
  readonly api: DockviewApi;
  readonly registry: WorkbenchPanelRegistry;
  private currentContext: WorkspaceContext;
  private readonly responsive = new ResponsiveLayoutManager();
  private lastRestoreServices: RestoreSavedLayoutOptions | undefined;
  constructor(private readonly options: DockviewWorkbenchOptions) {
    this.currentContext = { ...options.initialContext };
    this.registry = new WorkbenchPanelRegistry();
    this.registry.setActiveWorkspace(this.currentContext);

    const popoutUrl = options.popoutUrl ?? (typeof window !== "undefined" && typeof document !== "undefined" && window.location.href.startsWith("http") ? resolveAppUrl("popout.html") : "/popout.html");

    this.api = createDockview(options.container, {
      popoutUrl,
      createComponent: (options) => {
        return this.createRenderer(options.name);
      },
    });
    this.api.onDidActivePanelChange(() => {
      const panel = this.api.activePanel;
      if (panel !== undefined && this.options.onActivePanelChange !== undefined) {
        this.options.onActivePanelChange(panel.id);
      }
    });

    // Persiste somente geometria + configuração visual segura no Cliente.
    this.api.onDidLayoutChange(() => {
      this.persistQuietly();
    });
  }

  private createRenderer(name: string): IContentRenderer {
    const el = document.createElement("div");
    el.className = `dockview-panel-content panel-${name}`;
    let panelId: string | undefined;

    return {
      element: el,
      init: (parameters: { api: { id: string } }) => {
        panelId = parameters.api.id;
        const instance = this.registry.getPanelInstance(panelId);
        if (instance !== undefined && typeof instance.init === "function") {
          instance.init(el);
        }
      },
      focus: () => {
        if (panelId !== undefined) {
          const instance = this.registry.getPanelInstance(panelId);
          if (instance !== undefined && typeof instance.focus === "function") {
            instance.focus();
          }
        }
      },
      dispose: () => {
        if (panelId !== undefined) {
          const instance = this.registry.getPanelInstance(panelId);
          if (instance !== undefined && typeof instance.dispose === "function") {
            instance.dispose();
          }
        }
      },
    };
  }

  addPanel(state: PanelState, instance?: IWorkbenchPanelInstance): void {
    this.registry.registerPanel(state, instance);
    this.api.addPanel({
      id: state.id,
      component: state.type,
      title: state.title,
    });
    this.persistQuietly();
  }

  addFilesPanel(options?: {
    id?: string;
    mode?: "following" | "pinned";
    context?: WorkspaceContext;
    files?: FilesPanelOptions["files"];
    api?: FilesPanelOptions["api"];
    fileService?: FilesPanelOptions["fileService"];
  }): FilesDockviewPanel {
    const panelId = options?.id ?? `files-${String(Date.now())}`;
    const panel = new FilesDockviewPanel({
      id: panelId,
      context: options?.context ?? this.currentContext,
      mode: options?.mode ?? "following",
      files: options?.files,
      api: options?.api,
      fileService: options?.fileService,
    });
    this.addPanel(panel.state, panel);
    return panel;
  }

  addDiffPanel(options?: {
    id?: string;
    mode?: "following" | "pinned";
    context?: WorkspaceContext;
    diffService?: DiffService | undefined;
  }): DiffDockviewPanel {
    const panelId = options?.id ?? `diff-${String(Date.now())}`;
    const panel = new DiffDockviewPanel({
      id: panelId,
      context: options?.context ?? this.currentContext,
      mode: options?.mode ?? "following",
      diffService: options?.diffService,
    });
    this.addPanel(panel.state, panel);
    return panel;
  }

  addTerminalPanel(options?: {
    id?: string;
    context?: WorkspaceContext;
    panelContext?: WorkspacePanelContext | undefined;
    renderPanel?: TerminalPanelRender | undefined;
  }): TerminalDockviewPanel {
    const panelId = options?.id ?? `term-${String(Date.now())}`;
    const panel = new TerminalDockviewPanel({
      id: panelId,
      context: options?.context ?? this.currentContext,
      panelContext: options?.panelContext,
      renderPanel: options?.renderPanel,
    });
    this.addPanel(panel.state, panel);
    return panel;
  }
  restoreSavedLayout(options?: RestoreSavedLayoutOptions): boolean {
    const saved = loadWorkbenchLayoutFromStorage();
    if (saved === null || saved.panels.length === 0) return false;
    const isAvailable = options?.isContextAvailable ?? (() => true);
    const pendingServices = options === undefined ? undefined : { ...options };
    // Reutiliza o helper testado: contextos fora do conjunto viram placeholders, sem retargeting.
    const availableKeys = new Set<string>();
    const bases = new Map<string, PanelState>();
    for (const p of saved.panels) {
      const base = unwrapPersistedPanel(p);
      bases.set(p.id, base);
      if (isAvailable(base.context)) {
        availableKeys.add(environmentWorkspaceKey(base.context.environmentId, base.context.workspaceId));
      }
    }
    // Registros encenados: se o fromJSON rejeitar a geometria, tudo é desfeito
    // para o fallback padrão partir de um registry limpo.
    const stagedIds: string[] = [];
    const stagedInstances: IWorkbenchPanelInstance[] = [];
    const rollback = (): void => {
      for (const id of stagedIds) this.registry.removePanel(id);
      for (const instance of stagedInstances) {
        try {
          instance.dispose?.();
        } catch {
          // Descarte best-effort; o registry já está limpo.
        }
      }
      stagedIds.length = 0;
      stagedInstances.length = 0;
    };
    try {
      let restoredAny = false;
      for (const p of saved.panels) {
        if (this.registry.getPanel(p.id) !== undefined) continue;
        const base = bases.get(p.id);
        if (base === undefined) continue;
        const key = environmentWorkspaceKey(base.context.environmentId, base.context.workspaceId);
        if (!availableKeys.has(key)) {
          const [entry] = restoreWorkbenchPanels(
            { version: 1, gridGeometry: {}, panels: [toSerializedConfig(base)] },
            availableKeys,
          );
          const placeholder = new PlaceholderDockviewPanel({
            id: base.id,
            type: base.type,
            title: base.title,
            context: base.context,
            reason: entry?.unavailableReason ?? "Contexto indisponível.",
            original: base,
            onRetry: (id) => {
              this.retryPlaceholder(id);
            },
          });
          this.registry.registerPanel({ ...placeholder.state }, placeholder);
          stagedIds.push(base.id);
          stagedInstances.push(placeholder);
          restoredAny = true;
          continue;
        }
        const live = this.createLiveInstance(base, options);
        this.registerRestoredPanel(base, live);
        stagedIds.push(base.id);
        if (live !== undefined) stagedInstances.push(live);
        restoredAny = true;
      }
      if (!restoredAny) return false;
      const rawJson = JSON.stringify(saved.gridGeometry);
      const parsed: unknown = JSON.parse(rawJson);
      if (typeof parsed === "object" && parsed !== null) {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        this.api.fromJSON(parsed as SerializedDockview);
        this.lastRestoreServices = pendingServices;
        return true;
      }
    } catch {
      rollback();
      return false;
    }
    rollback();
    return false;
  }

  /**
   * Tenta reviver um placeholder como painel real, preservando o contexto original.
   * Retorna false quando o contexto segue indisponível ou o id não é um placeholder.
   */
  retryPlaceholder(id: string, services?: RestoreSavedLayoutOptions): boolean {
    const current = this.registry.getPanelInstance(id);
    if (!(current instanceof PlaceholderDockviewPanel)) return false;
    const effective = services ?? this.lastRestoreServices;
    if (effective?.isContextAvailable !== undefined && !effective.isContextAvailable(current.original.context)) {
      return false;
    }
    // Estado anterior para rollback: se o addPanel do painel real falhar, o
    // placeholder recuperável volta ao registry (sem virar órfão).
    const prevState = this.registry.getPanel(id);
    const prevCopy: PanelState =
      prevState !== undefined
        ? { ...prevState, context: { ...prevState.context } }
        : { ...current.state, context: { ...current.state.context } };
    const restoreVisiblePlaceholder = (): void => {
      try {
        if (this.api.getPanel(prevCopy.id) === undefined) {
          this.api.addPanel({ id: prevCopy.id, component: prevCopy.type, title: prevCopy.title });
        }
      } catch {
        // Registry segue íntegro; a visibilidade se resolve no próximo restore/retry.
      }
    };
    try {
      this.api.getPanel(id)?.api.close();
    } catch {
      return false;
    }
    let live: IWorkbenchPanelInstance | undefined;
    try {
      live = this.createLiveInstance(current.original, effective);
    } catch {
      restoreVisiblePlaceholder();
      return false;
    }
    this.registerRestoredPanel(current.original, live);
    try {
      this.api.addPanel({
        id: current.original.id,
        component: current.original.type,
        title: current.original.title,
      });
    } catch {
      this.registry.removePanel(current.original.id);
      if (live !== undefined) {
        try {
          live.dispose?.();
        } catch {
          // Descarte best-effort; o registry já voltou ao placeholder.
        }
      }
      this.registry.registerPanel(prevCopy, current);
      restoreVisiblePlaceholder();
      return false;
    }
    return true;
  }

  /**
   * Recompõe a geometria padrão sem tocar no registry: rascunhos, buffers,
   * mensagens e processos vivem nas instâncias/serviços e sobrevivem.
   */
  resetToDefaultLayout(): void {
    const activeId = this.api.activePanel?.id;
    const states = this.registry.getAllPanels();
    for (const s of states) {
      try {
        this.api.getPanel(s.id)?.api.close();
      } catch {
        // Segue recompondo os demais painéis.
      }
    }
    for (const s of states) {
      if (this.api.getPanel(s.id) !== undefined) continue;
      try {
        this.api.addPanel({ id: s.id, component: s.type, title: s.title });
      } catch {
        // Segue recompondo os demais painéis.
      }
    }
    if (activeId !== undefined) {
      try {
        this.api.getPanel(activeId)?.api.setActive();
      } catch {
        // Seleção anterior não existe mais; mantém o foco atual.
      }
    }
    this.saveLayout();
  }

  /**
   * Compacta em largura reduzida e reexpande sem perder seleção ou configuração.
   * Retorna true quando compactado (<768px).
   */
  handleContainerWidth(width: number): boolean {
    const activeId = this.api.activePanel?.id;
    const currentGeometry: Record<string, unknown> =
      activeId === undefined ? {} : { activePanelId: activeId };
    const result = this.responsive.adjustForWidth(width, currentGeometry);
    if (result.compacted) {
      this.options.container.classList.add("workbench-compact");
      return true;
    }
    this.options.container.classList.remove("workbench-compact");
    const savedActive = result.geometry["activePanelId"];
    const restoredId = (typeof savedActive === "string" ? savedActive : undefined) ?? activeId;
    if (restoredId !== undefined) {
      try {
        this.api.getPanel(restoredId)?.api.setActive();
      } catch {
        // Mantém o foco atual quando o painel anterior sumiu.
      }
    }
    return false;
  }

  private createLiveInstance(
    base: PanelState,
    services: RestoredPanelServices | undefined,
  ): IWorkbenchPanelInstance | undefined {
    if (base.type === "files") {
      return new FilesDockviewPanel({
        id: base.id,
        context: base.context,
        mode: base.mode,
        files: services?.files,
        api: services?.api,
        fileService: services?.fileService,
      });
    }
    if (base.type === "diff") {
      return new DiffDockviewPanel({
        id: base.id,
        context: base.context,
        mode: base.mode,
        diffService: services?.diffService,
      });
    }
    if (base.type === "terminal") {
      return new TerminalDockviewPanel({
        id: base.id,
        context: base.context,
        panelContext: services?.terminalPanelContext,
        renderPanel: services?.renderTerminalPanel,
      });
    }
    return undefined;
  }

  private registerRestoredPanel(base: PanelState, instance: IWorkbenchPanelInstance | undefined): void {
    const copy: PanelState = { ...base, context: { ...base.context } };
    this.registry.registerPanel(copy, instance);
    // registerPanel aproxima seguidores do workspace ativo; restore preserva o
    // contexto salvo (sem retargeting silencioso) e os seguidores acompanham as
    // próximas trocas normalmente.
    const stored = this.registry.getPanel(copy.id);
    if (stored !== undefined) stored.context = { ...base.context };
  }

  saveLayout(): SerializedLayoutData {
    const jsonStr = JSON.stringify(this.api.toJSON());
    const parsed: unknown = JSON.parse(jsonStr);
    const gridGeometry: Record<string, unknown> = {};
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      for (const [k, v] of Object.entries(parsed)) {
        gridGeometry[k] = v;
      }
    } 
    const panels = this.registry.getAllPanels();
    const layoutData: SerializedLayoutData = {
      version: 1,
      gridGeometry,
      panels: panels.map((p) => ({
        id: p.id,
        type: p.type,
        title: p.title,
        mode: p.mode,
        context: { ...p.context },
        ...(p.viewState !== undefined ? { viewState: { ...p.viewState } } : {}),
      })),
    };
    saveWorkbenchLayoutToStorage(layoutData);
    return layoutData;
  }

  setWorkspace(context: WorkspaceContext): void {
    this.currentContext = { ...context };
    this.registry.setActiveWorkspace(context);
  }

  moveToNextGroup(panelId: string): void {
    const panel = this.api.getPanel(panelId);
    if (!panel) return;
    const groups = this.api.groups;
    if (groups.length <= 1) return;

    const currentGroup = panel.group;
    const currentIndex = groups.indexOf(currentGroup);
    const nextGroup = groups[(currentIndex + 1) % groups.length];
    if (nextGroup) {
      nextGroup.model.openPanel(panel);
    }
  }

  movePanelToGroup(panelId: string, targetPanelId: string): boolean {
    const panel = this.api.getPanel(panelId);
    const target = this.api.getPanel(targetPanelId);
    if (!panel || !target) return false;
    panel.api.moveTo({ group: target.group });
    return true;
  }

  floatPanel(panelId: string, options?: { x?: number; y?: number; width?: number; height?: number }): boolean {
    const panel = this.api.getPanel(panelId);
    if (!panel) return false;
    this.api.addFloatingGroup(panel, options);
    this.registry.getPanelInstance(panelId)?.setFloating?.(true);
    return true;
  }

  async popoutPanel(panelId: string): Promise<boolean> {
    const panel = this.api.getPanel(panelId);
    if (!panel) return false;
    let success: boolean;
    try {
      success = await this.api.addPopoutGroup(panel);
    } catch {
      return false;
    }
    if (success) {
      const popouts = this.api.getPopouts();
      const popout = popouts[popouts.length - 1];
      const targetDoc = popout?.window.document;
      this.registry.getPanelInstance(panelId)?.setPopout?.(true, targetDoc);
      this.mirrorThemeToPopouts();
    }
    return success;
  }

  /** Re-apply the active theme vars and chrome CSS to every open popout. */
  mirrorThemeToPopouts(): void {
    for (const popout of this.api.getPopouts()) {
      try {
        this.mirrorThemeToDocument(popout.window.document);
      } catch {
        // A closed or unreachable popout keeps no theme; nothing to mirror.
      }
    }
  }

  /** Copy the active theme into a popout document (vars plus chrome CSS). */
  mirrorThemeToDocument(targetDoc: Document): void {
    const sourceRoot = this.options.container.ownerDocument.documentElement;
    const targetRoot = targetDoc.documentElement;
    const computed = sourceRoot.ownerDocument.defaultView?.getComputedStyle(sourceRoot);
    for (const token of THEME_TOKENS) {
      const value = (computed?.getPropertyValue(token) ?? sourceRoot.style.getPropertyValue(token)).trim();
      if (value !== "") targetRoot.style.setProperty(token, value);
    }
    const colorScheme = sourceRoot.style.colorScheme;
    if (colorScheme !== "") targetRoot.style.colorScheme = colorScheme;
    if (targetDoc.getElementById("pi-workbench-chrome") === null) {
      targetRoot.classList.add("workbench-popout-theme");
      const style = targetDoc.createElement("style");
      style.id = "pi-workbench-chrome";
      style.textContent = WORKBENCH_CHROME_CSS;
      targetDoc.head.appendChild(style);
    }
  }

  hidePanel(panelId: string): boolean {
    const panel = this.api.getPanel(panelId);
    if (!panel) return false;
    const group = panel.group;
    const other = group.panels.find((p) => p.id !== panelId);
    if (other) {
      other.api.setActive();
    }
    const instance = this.registry.getPanelInstance(panelId);
    if (instance && "element" in instance && instance.element instanceof HTMLElement) {
      instance.element.style.display = "none";
    }
    return true;
  }

  showPanel(panelId: string): boolean {
    const panel = this.api.getPanel(panelId);
    if (!panel) return false;
    panel.api.setActive();
    const instance = this.registry.getPanelInstance(panelId);
    if (instance && "element" in instance && instance.element instanceof HTMLElement) {
      instance.element.style.display = "";
    }
    return true;
  }

  closePanel(panelId: string): boolean {
    const panel = this.api.getPanel(panelId);
    if (!panel) return false;
    panel.api.close();
    this.registry.removePanel(panelId);
    this.persistQuietly();
    return true;
  }

  dispose(): void {
    this.persistQuietly();
    const popouts = this.api.getPopouts();
    for (const p of popouts) {
      p.window.close();
    }
    this.api.dispose();
  }

  private persistQuietly(): void {
    try {
      this.saveLayout();
    } catch {
      // Layout em memória continua válido; falha de storage não derruba a bancada.
    }
  }
}

function toSerializedConfig(base: PanelState): SerializedPanelConfig {
  return {
    id: base.id,
    type: base.type,
    title: base.title,
    mode: base.mode,
    context: { ...base.context },
    ...(base.viewState !== undefined ? { viewState: { ...base.viewState } } : {}),
  };
}

function stripPlaceholderSuffix(title: string): string {
  const suffix = " (indisponível)";
  return title.endsWith(suffix) ? title.slice(0, -suffix.length) : title;
}
/**
 * Desempacota um painel salvo: placeholders de sessões anteriores voltam à
 * configuração original para reavaliar disponibilidade (sem sufixo duplicado).
 * Wrapper ilegível cai para o próprio painel, já validado no parse do layout.
 */
function unwrapPersistedPanel(p: SerializedPanelConfig): PanelState {
  const viewState = p.viewState;
  const raw = viewState?.["placeholder"] === true ? viewState["original"] : undefined;
  if (raw !== undefined) {
    const reparsed = parseWorkbenchLayout(JSON.stringify({ version: 1, gridGeometry: {}, panels: [raw] }));
    const first = reparsed?.panels[0];
    if (first !== undefined) {
      return {
        id: first.id,
        type: first.type,
        title: first.title,
        mode: first.mode,
        context: { ...first.context },
        ...(first.viewState !== undefined ? { viewState: { ...first.viewState } } : {}),
      };
    }
  }
  return {
    id: p.id,
    type: p.type,
    title: stripPlaceholderSuffix(p.title),
    mode: p.mode,
    context: { ...p.context },
    ...(viewState?.["placeholder"] !== true && viewState !== undefined ? { viewState: { ...viewState } } : {}),
  };
}
