import { WorkbenchPanelRegistry } from "./panelRegistry";
import { serializeWorkbenchLayout } from "./layoutStorage";
import { AccessibleWorkbenchController } from "./accessibleActions";
import { FilesDockviewPanel, type FilesPanelOptions } from "./FilesDockviewPanel";
import { DiffDockviewPanel } from "./DiffDockviewPanel";
import { TerminalDockviewPanel } from "./TerminalDockviewPanel";
import { ModularChatPanel } from "./ModularChatPanel";
import { ProjectExplorer, type ProjectExplorerProject } from "../explorer/ProjectExplorer";
import { createThread as createDomainThread, type Thread } from "../domain/thread";
import type { DockviewWorkbench } from "./DockviewWorkbench";
import type { WorkspaceContext } from "./types";
import type { ClientRuntime } from "../runtime/ClientRuntime";
import type { AgentRuntime } from "../../server/agent/types";
import type { ModularChatPanelOptions } from "./ModularChatPanel";

export interface OpenFilesPanelOptions {
  files?: FilesPanelOptions["files"];
  api?: FilesPanelOptions["api"];
  fileService?: FilesPanelOptions["fileService"];
}

export interface ModularWorkbenchAppOptions {
  container: HTMLElement;
  runtime: ClientRuntime;
  agentRuntime?: AgentRuntime | undefined;
  draftStorage?: ModularChatPanelOptions["draftStorage"] | undefined;
  files?: FilesPanelOptions["files"];
  api?: FilesPanelOptions["api"];
  fileService?: FilesPanelOptions["fileService"] | undefined;
  initialWorkspace: WorkspaceContext;
  projects: ProjectExplorerProject[];
  threads: Thread[];
}

export class ModularWorkbenchApp {
  readonly registry: WorkbenchPanelRegistry;
  readonly accessibleController: AccessibleWorkbenchController;
  readonly explorer: ProjectExplorer;
  readonly chat: ModularChatPanel;
  private activeWorkspace: WorkspaceContext;
  private readonly detachAccessibleKeyboard: () => void;

  constructor(private readonly options: ModularWorkbenchAppOptions) {
    this.activeWorkspace = { ...options.initialWorkspace };
    this.registry = new WorkbenchPanelRegistry();
    this.accessibleController = new AccessibleWorkbenchController();

    this.registry.setActiveWorkspace(this.activeWorkspace);

    // Explorer container
    const explorerEl = document.createElement("div");
    explorerEl.className = "workbench-explorer-container";
    options.container.appendChild(explorerEl);

    this.explorer = new ProjectExplorer({
      container: explorerEl,
      projects: options.projects,
      threads: options.threads,
      onSelectThread: (thread) => {
        this.selectThread(thread);
      },
      onCreateThread: (projectId) => {
        this.createThread(projectId);
      },
    });

    // Chat container
    const chatEl = document.createElement("div");
    chatEl.className = "workbench-chat-container";
    options.container.appendChild(chatEl);

    this.chat = new ModularChatPanel({
      id: "chat-main",
      context: this.activeWorkspace,
      ...(options.agentRuntime !== undefined ? { runtime: options.agentRuntime } : {}),
      ...(options.draftStorage !== undefined ? { draftStorage: options.draftStorage } : {}),
    });
    this.chat.init(chatEl);
    this.registry.registerPanel(this.chat.state, this.chat);

    const firstThread = options.threads[0];
    if (firstThread !== undefined) {
      this.selectThread(firstThread);
    }

    // Atalhos acessiveis Alt+1..3 / Alt+M registrados no app (nao so no controller isolado).
    this.detachAccessibleKeyboard = this.attachAccessibleKeyboard();
  }

  handleAccessibleKeyDown(event: KeyboardEvent): boolean {
    return this.accessibleController.handleKeyDown(event, {
      onJumpToExplorer: () => {
        this.options.container
          .querySelector<HTMLElement>(".workbench-explorer-container button, .workbench-explorer-container [tabindex]")
          ?.focus();
      },
      onJumpToChat: () => {
        this.chat.focus();
      },
      onJumpToTerminal: () => {
        this.options.container.querySelector<HTMLElement>("[data-panel-id^=term]")?.focus();
      },
      onOpenActionsMenu: () => {
        this.options.container.dispatchEvent(new CustomEvent("workbench:open-actions-menu", { bubbles: true }));
      },
    });
  }

  getAccessiblePanelHandlers(workbench?: Pick<DockviewWorkbench, "moveToNextGroup">): {
    closePanel: (id: string) => void;
    focusPanel: (id: string) => void;
    moveToNextGroup: (id: string) => void;
  } {
    return {
      closePanel: (id) => {
        this.registry.removePanel(id);
      },
      focusPanel: (id) => {
        if (id === this.chat.state.id) {
          this.chat.focus();
          return;
        }
        this.options.container.querySelector<HTMLElement>(`[data-panel-id="${id}"]`)?.focus();
      },
      moveToNextGroup: (id) => {
        workbench?.moveToNextGroup(id);
      },
    };
  }

  attachAccessibleKeyboard(target?: HTMLElement): () => void {
    const el = target ?? this.options.container;
    const listener = (event: Event): void => {
      if (event instanceof KeyboardEvent) this.handleAccessibleKeyDown(event);
    };
    el.addEventListener("keydown", listener);
    return () => {
      el.removeEventListener("keydown", listener);
    };
  }

  dispose(): void {
    this.detachAccessibleKeyboard();
  }

  selectThread(thread: Thread): void {
    const nextWs: WorkspaceContext = {
      environmentId: thread.environmentId,
      projectId: thread.projectId,
      workspaceId: thread.workspaceId,
      cwd: `/repos/${thread.workspaceId}`,
    };
    this.activeWorkspace = nextWs;
    this.registry.setActiveWorkspace(nextWs);
    this.chat.attachThread(thread);
  }

  createThread(projectId?: string): Thread {
    const newThread = createDomainThread({
      title: "Nova Conversa",
      projectId: projectId ?? this.activeWorkspace.projectId ?? "default-project",
      workspaceId: this.activeWorkspace.workspaceId,
      environmentId: this.activeWorkspace.environmentId,
    });
    this.selectThread(newThread);
    return newThread;
  }

  openFilesPanel(
    id?: string,
    mode: "following" | "pinned" = "following",
    options?: OpenFilesPanelOptions,
  ): FilesDockviewPanel {
    const panelId = id ?? `files-${String(Date.now())}`;
    const panel = new FilesDockviewPanel({
      id: panelId,
      context: this.activeWorkspace,
      mode,
      files: options?.files ?? this.options.files,
      api: options?.api ?? this.options.api,
      fileService: options?.fileService ?? this.options.fileService,
    });
    this.registry.registerPanel(panel.state, panel);
    return panel;
  }

  openDiffPanel(id?: string, mode: "following" | "pinned" = "following"): DiffDockviewPanel {
    const panelId = id ?? `diff-${String(Date.now())}`;
    const panel = new DiffDockviewPanel({
      id: panelId,
      context: this.activeWorkspace,
      mode,
    });
    this.registry.registerPanel(panel.state, panel);
    return panel;
  }

  openTerminalPanel(id?: string): TerminalDockviewPanel {
    const panelId = id ?? `term-${String(Date.now())}`;
    const panel = new TerminalDockviewPanel({
      id: panelId,
      context: this.activeWorkspace,
    });
    this.registry.registerPanel(panel.state, panel);
    return panel;
  }

  saveLayout(): string {
    const currentGeometry = { type: "workbench-default" };
    return serializeWorkbenchLayout(currentGeometry, this.registry.getAllPanels());
  }
}
