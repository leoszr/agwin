import type { PanelState, WorkspaceContext } from "./types";
import type { IWorkbenchPanelInstance } from "./panelRegistry";
import type { WorkspacePanelContext } from "../src/plugins/types.js";

/**
 * Package-owned terminal renderer injected by the plugin layer. The workbench
 * core never implements terminal behavior; it only hosts the element the
 * terminal plugin renders for a workspace.
 */
export type TerminalPanelRender = (container: HTMLElement, context: WorkspacePanelContext) => void;

export interface TerminalPanelOptions {
  id: string;
  context: WorkspaceContext;
  /** Full plugin context handed to the injected renderer; never serialized. */
  panelContext?: WorkspacePanelContext | undefined;
  renderPanel?: TerminalPanelRender | undefined;
}

export class TerminalDockviewPanel implements IWorkbenchPanelInstance {
  readonly state: PanelState;
  private element: HTMLElement | undefined;
  private mountedInDocument: Document | undefined;
  private isFloating = false;
  private isPopout = false;
  constructor(private readonly options: TerminalPanelOptions) {
    // Terminal panels are ALWAYS pinned to their originating workspace
    this.state = {
      id: options.id,
      type: "terminal",
      title: "Terminal",
      mode: "pinned",
      context: { ...options.context },
    };
  }

  setContext(context: WorkspaceContext): void {
    // Terminals are strictly bound to their creator workspace; incoming context is acknowledged but never adopted.
    void context;
  }

  init(container: HTMLElement, doc: Document = document): void {
    this.element = container;
    this.mountedInDocument = doc;
    this.render();
  }

  render(): void {
    if (!this.element) return;
    this.element.innerHTML = "";
    const { renderPanel, panelContext } = this.options;
    if (renderPanel !== undefined && panelContext !== undefined) {
      renderPanel(this.element, panelContext);
      return;
    }
    const doc = this.mountedInDocument ?? document;
    const empty = doc.createElement("div");
    empty.className = "terminal-panel-unavailable";
    empty.textContent = "Terminal is unavailable: the Terminal plugin is not loaded for this workspace.";
    this.element.appendChild(empty);
  }

  setFloating(floating: boolean): void {
    this.isFloating = floating;
  }

  getIsFloating(): boolean {
    return this.isFloating;
  }

  setPopout(popout: boolean, targetDoc?: Document): void {
    this.isPopout = popout;
    if (targetDoc) {
      this.mountedInDocument = targetDoc;
    }
  }

  getIsPopout(): boolean {
    return this.isPopout;
  }

  focus(): void {
    const root = this.element;
    if (!root) return;
    const target = root.querySelector<HTMLElement>(
      "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
    );
    target?.focus();
  }

  dispose(): void {
    if (this.element) this.element.innerHTML = "";
    this.element = undefined;
  }
}
