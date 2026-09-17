import { css, html, LitElement } from "lit";
import { property, query } from "lit/decorators.js";
import { DockviewWorkbench } from "./DockviewWorkbench.js";
import type { TerminalPanelRender } from "./TerminalDockviewPanel.js";
import { createGitDiffService, type DiffService } from "./DiffDockviewPanel.js";
import type { WorkspaceContext } from "./types.js";
import type { WorkspacePanelContext, WorkspacePluginBinding } from "../src/plugins/types.js";

export class DockviewWorkbenchPanel extends LitElement {
  @property({ attribute: false }) context: WorkspacePanelContext | undefined;
  @property({ attribute: false }) terminalPanelRender: TerminalPanelRender | undefined;
  @property({ attribute: false }) diffBinding: WorkspacePluginBinding | undefined;
  @query(".workbench-host") private workbenchHost?: HTMLElement;

  private workbench?: DockviewWorkbench | undefined;

  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      min-height: 0;
      overflow: hidden;
      background: var(--pi-bg, #0d1117);
      color: var(--pi-text, #e6edf3);
    }
    .workbench-host {
      flex: 1 1 auto;
      width: 100%;
      height: 100%;
      min-height: 0;
      position: relative;
    }
    .workbench-empty {
      padding: 24px;
      color: var(--pi-muted, #8b949e);
      text-align: center;
    }
  `;

  override disconnectedCallback(): void {
    this.workbench?.dispose();
    this.workbench = undefined;
    super.disconnectedCallback();
  }

  override firstUpdated(): void {
    if (this.context && this.workbenchHost && !this.workbench) {
      this.initWorkbench(this.workbenchHost, this.deriveWorkspaceContext(this.context));
    }
  }

  override updated(changedProperties: Map<string, unknown>): void {
    super.updated(changedProperties);
    if (changedProperties.has("context") && this.context) {
      const wsContext = this.deriveWorkspaceContext(this.context);
      if (this.workbench) {
        this.workbench.setWorkspace(wsContext);
      } else if (this.workbenchHost) {
        this.initWorkbench(this.workbenchHost, wsContext);
      }
    }
  }

  override render() {
    if (!this.context) {
      return html`<div class="workbench-empty">Selecione um Workspace para abrir a bancada.</div>`;
    }
    return html`<div class="workbench-host"></div>`;
  }

  private deriveWorkspaceContext(context: WorkspacePanelContext): WorkspaceContext {
    return {
      environmentId: context.machine.id,
      projectId: context.workspace.projectId,
      workspaceId: context.workspace.id,
      cwd: context.workspace.path,
    };
  }

  private initWorkbench(container: HTMLElement, wsContext: WorkspaceContext): void {
    if (this.workbench) {
      this.workbench.dispose();
      this.workbench = undefined;
    }

    const workbench = new DockviewWorkbench({
      container,
      initialContext: wsContext,
    });
    this.workbench = workbench;

    // Terminal rendering is owned by the terminal plugin; core only hosts it.
    const renderTerminalPanel = this.terminalPanelRender;
    const terminalPanelContext = renderTerminalPanel !== undefined ? this.context : undefined;

    // Resolve diff service from explicit binding if present
    let diffService: DiffService | undefined;
    if (this.diffBinding?.backendRevision !== undefined && this.diffBinding.backendRevision !== "") {
      diffService = createGitDiffService({
        sourcePluginId: this.diffBinding.sourcePluginId,
        backendRevision: this.diffBinding.backendRevision,
      });
    }

    // Resolve file service from context.files
    const fileService = this.context
      ? {
          listFiles: async () => {
            const res = await this.context?.files.listFiles("");
            return res ? res.entries.map((e) => e.path) : [];
          },
          readFile: async (_env: string, _ws: string, path: string) => {
            const res = await this.context?.files.readFile(path);
            return res ? res.content : "";
          },
          writeFile: async (_env: string, _ws: string, path: string, content: string) => {
            await this.context?.files.writeFile(path, content);
          },
          deleteFile: async (_env: string, _ws: string, path: string) => {
            await this.context?.files.deleteFile(path);
          },
        }
      : undefined;

    workbench.addTerminalPanel({
      id: "workbench-term-main",
      context: wsContext,
      panelContext: terminalPanelContext,
      renderPanel: renderTerminalPanel,
    });

    workbench.addFilesPanel({
      id: "workbench-files-main",
      context: wsContext,
      mode: "following",
      fileService,
    });

    workbench.addDiffPanel({
      id: "workbench-diff-main",
      context: wsContext,
      mode: "following",
      diffService,
    });
  }

  getWorkbench(): DockviewWorkbench | undefined {
    return this.workbench;
  }
}

if (typeof customElements !== "undefined" && !customElements.get("dockview-workbench-panel")) {
  customElements.define("dockview-workbench-panel", DockviewWorkbenchPanel);
}
