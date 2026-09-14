import type {
  PanelAutoPinnedEvent,
  PanelState,
  PanelType,
  WorkspaceContext,
} from "./types";

export interface IWorkbenchPanelInstance {
  readonly state: PanelState;
  setContext(context: WorkspaceContext): void;
  onAutoPinned?(reason: string): void;
  init?(container: HTMLElement, doc?: Document): void;
  focus?(): void;
  dispose?(): void;
}

export class WorkbenchPanelRegistry {
  private readonly panels = new Map<string, PanelState>();
  private readonly panelInstances = new Map<string, IWorkbenchPanelInstance>();
  private readonly autoPinListeners = new Set<(event: PanelAutoPinnedEvent) => void>();
  private activeWorkspaceContext?: WorkspaceContext;

  setActiveWorkspace(context: WorkspaceContext): void {
    this.activeWorkspaceContext = context;

    for (const [id, panel] of this.panels.entries()) {
      if (panel.mode === "following") {
        if (panel.isUnsafeDirty === true) {
          // Auto-pin to prevent losing unsaved work!
          panel.mode = "pinned";
          const instance = this.panelInstances.get(id);
          const reason = "Painel fixado automaticamente para proteger alterações não salvas.";
          instance?.onAutoPinned?.(reason);
          this.emitAutoPin({
            panelId: panel.id,
            panelType: panel.type,
            previousContext: panel.context,
            reason,
          });
        } else {
          // Safe to follow new context: update state AND coordinate through panel instance
          panel.context = { ...context };
          const instance = this.panelInstances.get(id);
          instance?.setContext({ ...context });
        }
      }
    }
  }

  getActiveWorkspace(): WorkspaceContext | undefined {
    return this.activeWorkspaceContext;
  }

  registerPanel(panel: PanelState, instance?: IWorkbenchPanelInstance): PanelState {
    if (panel.type === "terminal") {
      panel.mode = "pinned"; // Terminals are strictly pinned to creation workspace
    } else if (panel.mode === "following" && this.activeWorkspaceContext !== undefined) {
      panel.context = { ...this.activeWorkspaceContext };
    }

    this.panels.set(panel.id, panel);
    if (instance !== undefined) {
      this.panelInstances.set(panel.id, instance);
    }
    return panel;
  }

  getPanel(id: string): PanelState | undefined {
    return this.panels.get(id);
  }
  getPanelInstance(id: string): IWorkbenchPanelInstance | undefined {
    return this.panelInstances.get(id);
  }


  getAllPanels(): PanelState[] {
    return Array.from(this.panels.values());
  }

  getPanelsByType(type: PanelType): PanelState[] {
    return this.getAllPanels().filter((p) => p.type === type);
  }

  removePanel(id: string): boolean {
    this.panelInstances.delete(id);
    return this.panels.delete(id);
  }

  setPanelMode(id: string, mode: "following" | "pinned"): boolean {
    const panel = this.panels.get(id);
    if (!panel) return false;

    if (panel.type === "terminal" && mode === "following") {
      // Forbidden: Terminals can never be redirected to follow active workspace!
      return false;
    }

    panel.mode = mode;
    if (mode === "following" && this.activeWorkspaceContext !== undefined && panel.isUnsafeDirty !== true) {
      panel.context = { ...this.activeWorkspaceContext };
      const instance = this.panelInstances.get(id);
      instance?.setContext({ ...this.activeWorkspaceContext });
    }
    return true;
  }

  setPanelDirty(id: string, isDirty: boolean): void {
    const panel = this.panels.get(id);
    if (panel) {
      panel.isUnsafeDirty = isDirty;
    }
  }

  onAutoPinned(listener: (event: PanelAutoPinnedEvent) => void): () => void {
    this.autoPinListeners.add(listener);
    return () => {
      this.autoPinListeners.delete(listener);
    };
  }

  private emitAutoPin(event: PanelAutoPinnedEvent): void {
    for (const listener of this.autoPinListeners) {
      listener(event);
    }
  }
}
