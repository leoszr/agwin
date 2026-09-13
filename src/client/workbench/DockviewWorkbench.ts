import { createDockview, type DockviewApi, type IContentRenderer, type SerializedDockview } from "dockview-core";
import { WorkbenchPanelRegistry } from "./panelRegistry.js";
import {
  loadWorkbenchLayoutFromStorage,
  saveWorkbenchLayoutToStorage,
  type SerializedLayoutData,
} from "./layoutStorage.js";
import type { PanelState, WorkspaceContext } from "./types.js";

export interface DockviewWorkbenchOptions {
  container: HTMLElement;
  initialContext: WorkspaceContext;
  onActivePanelChange?: (panelId: string) => void;
}

export class DockviewWorkbench {
  readonly api: DockviewApi;
  readonly registry: WorkbenchPanelRegistry;
  private currentContext: WorkspaceContext;

  constructor(private readonly options: DockviewWorkbenchOptions) {
    this.currentContext = { ...options.initialContext };
    this.registry = new WorkbenchPanelRegistry();
    this.registry.setActiveWorkspace(this.currentContext);

    this.api = createDockview(options.container, {
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
    return {
      element: el,
      init: () => undefined,
      dispose: () => undefined,
    };
  }

  addPanel(state: PanelState, instance?: import("./panelRegistry").IWorkbenchPanelInstance): void {
    this.registry.registerPanel(state, instance);
    this.api.addPanel({
      id: state.id,
      component: state.type,
      title: state.title,
    });
  }

  restoreSavedLayout(): boolean {
    const saved = loadWorkbenchLayoutFromStorage();
    if (saved !== null) {
      try {
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

  dispose(): void {
    this.api.dispose();
  }
}
