import { css, html, LitElement, unsafeCSS } from "lit";
import { property, query } from "lit/decorators.js";
import { DockviewWorkbench, observeDocumentTheme, WORKBENCH_CHROME_CSS } from "./DockviewWorkbench.js";
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
  private resizeObserver: ResizeObserver | undefined;
  private disconnectThemeObserver: (() => void) | undefined;
  static override styles = [css`
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
  `, unsafeCSS(WORKBENCH_CHROME_CSS)];

  override connectedCallback(): void {
    super.connectedCallback();
    if (typeof document !== "undefined" && this.disconnectThemeObserver === undefined) {
      this.disconnectThemeObserver = observeDocumentTheme(document.documentElement, () => {
        this.workbench?.mirrorThemeToPopouts();
      });
    }
  }

  override disconnectedCallback(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.disconnectThemeObserver?.();
    this.disconnectThemeObserver = undefined;
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

    // Tenta restaurar o layout salvo (placeholders para contextos indisponíveis,
    // sem retargeting); inválido ou ausente cai para a composição padrão.
    let restored = false;
    try {
      restored = workbench.restoreSavedLayout({
        ...(fileService !== undefined ? { fileService } : {}),
        ...(diffService !== undefined ? { diffService } : {}),
        ...(terminalPanelContext !== undefined ? { terminalPanelContext } : {}),
        ...(renderTerminalPanel !== undefined ? { renderTerminalPanel } : {}),
        isContextAvailable: (ctx) => ctx.environmentId === wsContext.environmentId,
      });
    } catch {
      // Layout inválido: cai para a composição padrão abaixo.
    }
    if (!restored) {
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
    this.observeContainerWidth(container);
  }

  private observeContainerWidth(container: HTMLElement): void {
    this.resizeObserver?.disconnect();
    if (typeof ResizeObserver === "undefined") return;
    this.resizeObserver = new ResizeObserver((entries) => {
      const width = entries[entries.length - 1]?.contentRect.width;
      if (typeof width === "number") this.workbench?.handleContainerWidth(width);
    });
    this.resizeObserver.observe(container);
  }

  /** Recompõe a geometria padrão sem apagar rascunhos, buffers ou processos. */
  resetLayout(): void {
    this.workbench?.resetToDefaultLayout();
  }

  getWorkbench(): DockviewWorkbench | undefined {
    return this.workbench;
  }
}

if (typeof customElements !== "undefined" && !customElements.get("dockview-workbench-panel")) {
  customElements.define("dockview-workbench-panel", DockviewWorkbenchPanel);
}
