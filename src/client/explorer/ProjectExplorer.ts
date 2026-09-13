import {
  getThreadDisambiguation,
  groupThreadsByState,
  type Thread,
  type ThreadState,
} from "../domain/thread";

export interface ProjectExplorerProject {
  id: string;
  name: string;
  environmentId: string;
}

export interface ProjectExplorerOptions {
  container: HTMLElement;
  projects: ProjectExplorerProject[];
  threads: Thread[];
  onSelectThread: (thread: Thread) => void;
  onCreateThread: (projectId?: string) => void;
}

export class ProjectExplorer {
  private element: HTMLElement;
  private projects: ProjectExplorerProject[];
  private threads: Thread[];
  private selectedThreadId?: string;
  private isCompactViewport = false;

  constructor(private readonly options: ProjectExplorerOptions) {
    this.element = options.container;
    this.projects = [...options.projects];
    this.threads = [...options.threads];
    this.render();
  }

  setCompactViewport(compact: boolean): void {
    this.isCompactViewport = compact;
    this.render();
  }

  updateData(projects: ProjectExplorerProject[], threads: Thread[]): void {
    this.projects = [...projects];
    this.threads = [...threads];
    this.render();
  }

  selectThread(threadId: string): void {
    this.selectedThreadId = threadId;
    const thread = this.threads.find((t) => t.id === threadId);
    if (thread !== undefined) {
      this.options.onSelectThread(thread);
    }
    this.render();
  }

  render(): void {
    this.element.innerHTML = "";
    this.element.className = `project-explorer ${this.isCompactViewport ? "compact" : "regular"}`;
    this.element.setAttribute("role", "tree");
    this.element.setAttribute("aria-label", "Project Explorer");

    // Global Create Thread button
    const globalHeader = document.createElement("div");
    globalHeader.className = "explorer-global-actions";

    const createGlobalBtn = document.createElement("button");
    createGlobalBtn.className = "btn-create-thread-global";
    createGlobalBtn.textContent = "+ Nova Thread";
    createGlobalBtn.setAttribute("aria-label", "Criar nova Thread globalmente");
    createGlobalBtn.onclick = () => {
      this.options.onCreateThread();
    };
    globalHeader.appendChild(createGlobalBtn);
    this.element.appendChild(globalHeader);

    for (const project of this.projects) {
      const projectNode = document.createElement("div");
      projectNode.className = "explorer-project-node";
      projectNode.setAttribute("role", "treeitem");
      projectNode.setAttribute("aria-expanded", "true");

      const projectHeader = document.createElement("div");
      projectHeader.className = "project-header";

      const projectTitle = document.createElement("span");
      projectTitle.className = "project-title";
      projectTitle.textContent = project.name;

      if (project.environmentId !== "local") {
        const envBadge = document.createElement("span");
        envBadge.className = "badge-environment";
        envBadge.textContent = `[${project.environmentId}]`;
        projectHeader.appendChild(envBadge);
      }

      projectHeader.appendChild(projectTitle);

      const addProjectThreadBtn = document.createElement("button");
      addProjectThreadBtn.className = "btn-create-thread-project";
      addProjectThreadBtn.textContent = "+";
      addProjectThreadBtn.setAttribute("aria-label", `Criar Thread no projeto ${project.name}`);
      addProjectThreadBtn.onclick = (e) => {
        e.stopPropagation();
        this.options.onCreateThread(project.id);
      };
      projectHeader.appendChild(addProjectThreadBtn);
      projectNode.appendChild(projectHeader);

      // Project threads grouped by state buckets
      const projectThreads = this.threads.filter(
        (t) => t.projectId === project.id && t.environmentId === project.environmentId,
      );
      const buckets = groupThreadsByState(projectThreads);

      const stateList = document.createElement("div");
      stateList.className = "project-state-buckets";
      stateList.setAttribute("role", "group");

      const stateLabels: Record<ThreadState, { label: string; icon: string }> = {
        running: { label: "Em execução", icon: "▶" },
        waiting: { label: "Aguardando", icon: "⏳" },
        completed: { label: "Concluído", icon: "✓" },
        error: { label: "Com erro", icon: "✕" },
        offline: { label: "Offline", icon: "⚠" },
      };

      const states: ThreadState[] = ["running", "waiting", "completed", "error", "offline"];
      for (const st of states) {
        const list = buckets[st];
        if (list.length === 0) continue;

        const bucketHeader = document.createElement("div");
        bucketHeader.className = `bucket-header state-${st}`;
        bucketHeader.textContent = `${stateLabels[st].icon} ${stateLabels[st].label} (${String(list.length)})`;
        stateList.appendChild(bucketHeader);

        for (const thread of list) {
          const threadItem = document.createElement("div");
          threadItem.className = `thread-item state-${thread.state}`;
          threadItem.setAttribute("role", "treeitem");
          threadItem.setAttribute("tabindex", "0");

          if (thread.id === this.selectedThreadId) {
            threadItem.classList.add("selected");
            threadItem.setAttribute("aria-selected", "true");
          }

          const disambiguation = getThreadDisambiguation(thread, this.threads);

          const threadIcon = document.createElement("span");
          threadIcon.className = "thread-state-icon";
          threadIcon.textContent = stateLabels[thread.state].icon;
          threadIcon.setAttribute("aria-hidden", "true");

          const threadText = document.createElement("span");
          threadText.className = "thread-title";
          threadText.textContent = thread.title;

          const wsBadge = document.createElement("span");
          wsBadge.className = "badge-workspace";
          wsBadge.textContent = thread.workspaceId;
          wsBadge.title = `Workspace: ${thread.workspaceId}`;

          threadItem.appendChild(threadIcon);
          threadItem.appendChild(threadText);
          threadItem.appendChild(wsBadge);

          if (disambiguation.showEnvironmentTag) {
            const envTag = document.createElement("span");
            envTag.className = "badge-environment";
            envTag.textContent = thread.environmentId;
            envTag.title = `Ambiente: ${thread.environmentId}`;
            threadItem.appendChild(envTag);
          }

          threadItem.setAttribute(
            "aria-label",
            `Thread ${thread.title}, estado ${stateLabels[thread.state].label}, workspace ${thread.workspaceId}, ambiente ${thread.environmentId}`,
          );

          threadItem.onclick = () => {
            this.selectThread(thread.id);
          };
          threadItem.onkeydown = (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              this.selectThread(thread.id);
            }
          };

          stateList.appendChild(threadItem);
        }
      }

      projectNode.appendChild(stateList);
      this.element.appendChild(projectNode);
    }
  }
}
