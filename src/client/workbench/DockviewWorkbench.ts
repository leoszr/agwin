import { createDockview, type DockviewApi, type IContentRenderer, type SerializedDockview } from "dockview-core";
import { WorkbenchPanelRegistry, type IWorkbenchPanelInstance } from "./panelRegistry.js";
import {
  loadWorkbenchLayoutFromStorage,
  saveWorkbenchLayoutToStorage,
  type SerializedLayoutData,
} from "./layoutStorage.js";
import type { PanelState, WorkspaceContext } from "./types.js";
import { FilesDockviewPanel, type FilesPanelOptions } from "./FilesDockviewPanel.js";
import { DiffDockviewPanel, type DiffService } from "./DiffDockviewPanel.js";
import {
  TerminalDockviewPanel,
  type TerminalBackendService,
} from "./TerminalDockviewPanel.js";
import { resolveAppUrl } from "../src/appUrl.js";

export interface DockviewWorkbenchOptions {
  container: HTMLElement;
  initialContext: WorkspaceContext;
  onActivePanelChange?: (panelId: string) => void;
  popoutUrl?: string | undefined;
}

export class DockviewWorkbench {
  readonly api: DockviewApi;
  readonly registry: WorkbenchPanelRegistry;
  private currentContext: WorkspaceContext;

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
    terminalId?: string | undefined;
    backendService?: TerminalBackendService | undefined;
  }): TerminalDockviewPanel {
    const panelId = options?.id ?? `term-${String(Date.now())}`;
    const panel = new TerminalDockviewPanel({
      id: panelId,
      context: options?.context ?? this.currentContext,
      terminalId: options?.terminalId,
      backendService: options?.backendService,
    });
    this.addPanel(panel.state, panel);
    return panel;
  }

  restoreSavedLayout(options?: {
    files?: FilesPanelOptions["files"];
    api?: FilesPanelOptions["api"];
    fileService?: FilesPanelOptions["fileService"];
    diffService?: DiffService | undefined;
    terminalService?: TerminalBackendService | undefined;
  }): boolean {
    const saved = loadWorkbenchLayoutFromStorage();
    if (saved !== null) {
      try {
        for (const p of saved.panels) {
          if (!this.registry.getPanel(p.id)) {
            let instance: IWorkbenchPanelInstance | undefined;
            if (p.type === "files") {
              instance = new FilesDockviewPanel({
                id: p.id,
                context: p.context,
                mode: p.mode,
                files: options?.files,
                api: options?.api,
                fileService: options?.fileService,
              });
            } else if (p.type === "diff") {
              instance = new DiffDockviewPanel({
                id: p.id,
                context: p.context,
                mode: p.mode,
                diffService: options?.diffService,
              });
            } else if (p.type === "terminal") {
              const savedTermId = p.viewState !== undefined && typeof p.viewState["terminalId"] === "string"
                ? p.viewState["terminalId"]
                : undefined;
              instance = new TerminalDockviewPanel({
                id: p.id,
                context: p.context,
                terminalId: savedTermId,
                backendService: options?.terminalService,
              });
            }
            this.registry.registerPanel(p, instance);
          }
        }
        const rawJson = JSON.stringify(saved.gridGeometry);
        const parsed: unknown = JSON.parse(rawJson);
        if (typeof parsed === "object" && parsed !== null) {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          this.api.fromJSON(parsed as SerializedDockview);
          return true;
        }
      } catch {
        return false;
      }
    }
    return false;
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
    }
    return success;
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
    return true;
  }

  dispose(): void {
    const popouts = this.api.getPopouts();
    for (const p of popouts) {
      p.window.close();
    }
    this.api.dispose();
  }
}
