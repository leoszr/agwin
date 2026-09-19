import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { Machine, Project, SessionActivity, SessionInfo, SessionStatus, Workspace } from "../api";
import type { WebEnvironmentStatus } from "../controlSurface/webEnvironmentRuntime";
import { ProjectExplorer } from "../../explorer/ProjectExplorer";
import { bridgeSessionsToThreads, type SessionThreadBridgeResult } from "../../explorer/sessionThreadBridge";

@customElement("project-explorer-view")
export class ProjectExplorerView extends LitElement {
  @property({ attribute: false }) projects: Project[] = [];
  @property({ attribute: false }) workspaces: Workspace[] = [];
  @property({ attribute: false }) sessions: SessionInfo[] = [];
  @property({ attribute: false }) selectedSession?: SessionInfo;
  @property({ attribute: false }) selectedProject?: Project;
  @property({ attribute: false }) selectedWorkspace?: Workspace;
  @property({ attribute: false }) selectedMachine?: Machine;
  @property({ attribute: false }) machines: Machine[] = [];
  @property({ attribute: false }) sessionStatuses: Record<string, SessionStatus> = {};
  @property({ attribute: false }) sessionActivities: Record<string, SessionActivity> = {};
  @property({ attribute: false }) sendingPrompts: Record<string, true> = {};
  @property({ attribute: false }) environmentStatuses: Record<string, WebEnvironmentStatus> = {};
  @property({ attribute: false }) unreadSessionIds: ReadonlySet<string> = new Set();
  @property({ type: Boolean, reflect: true }) compact = false;

  @property({ attribute: false }) onSelectSession?: (
    session: SessionInfo,
    workspace?: Workspace,
    project?: Project,
  ) => void;
  @property({ attribute: false }) onStartSession?: (projectId?: string) => void;

  private explorer?: ProjectExplorer;
  private containerEl?: HTMLElement;
  private lastBridgeResult?: SessionThreadBridgeResult;

  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      overflow-x: hidden;
      color: var(--pi-text);
      font-family: var(--pi-control-font-family, system-ui, sans-serif);
      font-size: 13px;
    }

    .project-explorer-mount {
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      min-height: 0;
    }

    .project-explorer {
      display: flex;
      flex-direction: column;
      padding: 8px;
      gap: 6px;
    }

    .explorer-global-actions {
      display: flex;
      align-items: center;
      margin-bottom: 4px;
    }

    .btn-create-thread-global {
      width: 100%;
      padding: 6px 10px;
      border: 1px solid var(--pi-border);
      border-radius: 6px;
      background: var(--pi-surface);
      color: var(--pi-text);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: background 0.1s ease;
    }

    .btn-create-thread-global:hover {
      background: var(--pi-surface-hover);
    }

    .btn-create-thread-global:focus-visible {
      outline: 2px solid var(--pi-accent);
      outline-offset: 1px;
    }

    .explorer-search-wrapper {
      margin-bottom: 8px;
    }

    .explorer-search-input {
      width: 100%;
      box-sizing: border-box;
      padding: 5px 8px;
      border: 1px solid var(--pi-border);
      border-radius: 6px;
      background: var(--pi-bg);
      color: var(--pi-text);
      font-size: 12px;
    }

    .explorer-search-input:focus {
      outline: 2px solid var(--pi-accent);
      outline-offset: -1px;
      border-color: var(--pi-accent);
    }

    .explorer-project-node {
      display: flex;
      flex-direction: column;
      border-radius: 6px;
      margin-bottom: 4px;
    }

    .project-header {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 8px;
      border-radius: 6px;
      cursor: pointer;
      user-select: none;
      font-weight: 600;
      color: var(--pi-text);
    }

    .project-header:hover {
      background: var(--pi-surface-hover);
    }

    .project-header:focus-visible {
      outline: 2px solid var(--pi-accent);
      outline-offset: -1px;
    }

    .project-chevron {
      color: var(--pi-muted);
      font-size: 11px;
      width: 12px;
    }

    .project-title {
      flex: 1 1 auto;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .btn-create-thread-project {
      border: none;
      background: transparent;
      color: var(--pi-muted);
      font-size: 14px;
      line-height: 1;
      padding: 2px 6px;
      border-radius: 4px;
      cursor: pointer;
    }

    .btn-create-thread-project:hover {
      background: var(--pi-surface-hover);
      color: var(--pi-text);
    }

    .btn-create-thread-project:focus-visible {
      outline: 2px solid var(--pi-accent);
    }

    .project-state-buckets {
      display: flex;
      flex-direction: column;
      padding-left: 10px;
      gap: 2px;
    }

    .bucket-header {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 6px;
      font-size: 11px;
      font-weight: 600;
      color: var(--pi-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      cursor: pointer;
      border-radius: 4px;
      user-select: none;
    }

    .bucket-header:hover {
      background: var(--pi-surface-hover);
      color: var(--pi-text);
    }

    .bucket-header:focus-visible {
      outline: 2px solid var(--pi-accent);
    }

    .bucket-chevron {
      font-size: 9px;
      width: 10px;
    }

    .thread-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 5px 8px;
      margin-left: 6px;
      border-radius: 6px;
      cursor: pointer;
      border: 1px solid transparent;
      transition: background 0.1s ease;
    }

    .thread-item:hover {
      background: var(--pi-surface-hover);
    }

    .thread-item.selected {
      background: var(--pi-surface-hover);
      border-color: var(--pi-border);
    }

    .thread-item:focus-visible {
      outline: 2px solid var(--pi-accent);
      outline-offset: -1px;
    }

    .thread-line-1 {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
    }

    .thread-state-icon {
      font-size: 10px;
      line-height: 1;
      color: var(--pi-muted);
      flex: 0 0 auto;
    }

    .thread-item.state-running .thread-state-icon {
      color: var(--pi-accent);
    }

    .thread-item.state-error .thread-state-icon {
      color: var(--pi-danger, #ef8d8d);
    }

    .thread-item.state-offline .thread-state-icon {
      color: var(--pi-muted);
    }

    .thread-title {
      flex: 1 1 auto;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 500;
    }

    .badge-environment {
      flex: 0 0 auto;
      font-size: 10px;
      padding: 1px 5px;
      border-radius: 4px;
      background: var(--pi-surface);
      border: 1px solid var(--pi-border);
      color: var(--pi-muted);
    }

    .badge-unread {
      flex: 0 0 auto;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--pi-accent);
    }

    .thread-line-2 {
      display: flex;
      align-items: center;
      min-width: 0;
      padding-left: 16px;
    }

    .thread-workspace-label {
      font-size: 11px;
      color: var(--pi-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    :host([compact]) .thread-item {
      padding: 4px 6px;
    }

    :host([compact]) .thread-title {
      font-size: 12px;
    }
  `;

  override render() {
    return html`<div class="project-explorer-mount"></div>`;
  }

  protected override firstUpdated(): void {
    const mount = this.renderRoot.querySelector<HTMLElement>(".project-explorer-mount");
    if (!mount) return;
    this.containerEl = mount;
    this.initExplorer();
  }

  protected override updated(): void {
    if (this.explorer && this.containerEl) {
      const bridgeResult = bridgeSessionsToThreads({
        sessions: this.sessions,
        workspaces: this.workspaces,
        projects: this.projects,
        machines: this.machines,
        selectedMachineId: this.selectedMachine?.id,
        sessionStatuses: this.sessionStatuses,
        sessionActivities: this.sessionActivities,
        sendingPrompts: this.sendingPrompts,
        environmentStatuses: this.environmentStatuses,
        unreadSessionIds: this.unreadSessionIds,
      });

      this.lastBridgeResult = bridgeResult;
      this.explorer.updateData(bridgeResult.projects, bridgeResult.threads);
      this.explorer.setCompactViewport(this.compact);
      if (this.selectedSession) {
        this.explorer.selectThread(this.selectedSession.id);
      }
    }
  }

  private initExplorer(): void {
    if (!this.containerEl) return;

    const bridgeResult = bridgeSessionsToThreads({
      sessions: this.sessions,
      workspaces: this.workspaces,
      projects: this.projects,
      machines: this.machines,
      selectedMachineId: this.selectedMachine?.id,
      sessionStatuses: this.sessionStatuses,
      sessionActivities: this.sessionActivities,
      sendingPrompts: this.sendingPrompts,
      environmentStatuses: this.environmentStatuses,
      unreadSessionIds: this.unreadSessionIds,
    });

    this.lastBridgeResult = bridgeResult;

    this.explorer = new ProjectExplorer({
      container: this.containerEl,
      projects: bridgeResult.projects,
      threads: bridgeResult.threads,
      onSelectThread: (thread) => {
        const session = this.lastBridgeResult?.sessionByThreadId.get(thread.id);
        const workspace = this.lastBridgeResult?.workspaceByThreadId.get(thread.id);
        const project = this.lastBridgeResult?.projectByThreadId.get(thread.id);
        if (session) {
          this.onSelectSession?.(session, workspace, project);
        }
      },
      onCreateThread: (projectId) => {
        this.onStartSession?.(projectId);
      },
    });

    if (this.selectedSession) {
      this.explorer.selectThread(this.selectedSession.id);
    }
  }
}
