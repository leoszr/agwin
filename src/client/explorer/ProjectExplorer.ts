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
  private searchQuery = "";
  private collapsedProjectIds = new Set<string>();
  private collapsedBucketKeys = new Set<string>();

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

  setSearchQuery(query: string): void {
    this.searchQuery = query;
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

  toggleProject(projectId: string): void {
    if (this.collapsedProjectIds.has(projectId)) {
      this.collapsedProjectIds.delete(projectId);
    } else {
      this.collapsedProjectIds.add(projectId);
    }
    this.render();
  }

  toggleBucket(bucketKey: string): void {
    if (this.collapsedBucketKeys.has(bucketKey)) {
      this.collapsedBucketKeys.delete(bucketKey);
    } else {
      this.collapsedBucketKeys.add(bucketKey);
    }
    this.render();
  }

  private filterThreads(threads: Thread[]): Thread[] {
    const q = this.searchQuery.trim().toLowerCase();
    if (q === "") return threads;
    return threads.filter((t) => {
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchWs = (t.workspaceLabel ?? t.workspaceId).toLowerCase().includes(q);
      const matchEnv = t.environmentId.toLowerCase().includes(q);
      const matchProj = (t.projectName ?? "").toLowerCase().includes(q);
      return matchTitle || matchWs || matchEnv || matchProj;
    });
  }

  render(): void {
    this.element.innerHTML = "";
    this.element.className = `project-explorer ${this.isCompactViewport ? "compact" : "regular"}`;
    this.element.setAttribute("role", "tree");
    this.element.setAttribute("aria-label", "Project Explorer");

    // Header actions: Nova Thread global
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

    // Search filter input
    const searchWrapper = document.createElement("div");
    searchWrapper.className = "explorer-search-wrapper";

    const searchInput = document.createElement("input");
    searchInput.type = "search";
    searchInput.className = "explorer-search-input";
    searchInput.placeholder = "Filtrar Projects e Threads…";
    searchInput.setAttribute("aria-label", "Filtrar Projects e Threads");
    searchInput.value = this.searchQuery;
    searchInput.oninput = (e) => {
      const target = e.target;
      if (target instanceof HTMLInputElement) {
        this.searchQuery = target.value;
        this.render();
        const newInput = this.element.querySelector<HTMLInputElement>(".explorer-search-input");
        if (newInput) {
          newInput.focus();
          newInput.setSelectionRange(newInput.value.length, newInput.value.length);
        }
      }
    };
    searchWrapper.appendChild(searchInput);
    this.element.appendChild(searchWrapper);

    const filteredThreads = this.filterThreads(this.threads);
    const hasSearch = this.searchQuery.trim() !== "";

    for (const project of this.projects) {
      // If searching, only render project if it has matching threads or matches project name
      const projectThreads = filteredThreads.filter(
        (t) => t.projectId === project.id && t.environmentId === project.environmentId,
      );

      const matchesProjectName = hasSearch && project.name.toLowerCase().includes(this.searchQuery.trim().toLowerCase());
      if (hasSearch && projectThreads.length === 0 && !matchesProjectName) {
        continue;
      }

      const isProjectCollapsed = !hasSearch && this.collapsedProjectIds.has(project.id);

      const projectNode = document.createElement("div");
      projectNode.className = "explorer-project-node";
      projectNode.setAttribute("role", "treeitem");
      projectNode.setAttribute("aria-expanded", isProjectCollapsed ? "false" : "true");

      const projectHeader = document.createElement("div");
      projectHeader.className = "project-header";
      projectHeader.setAttribute("tabindex", "0");
      projectHeader.setAttribute("role", "button");
      projectHeader.setAttribute(
        "aria-label",
        `Projeto ${project.name}, ambiente ${project.environmentId}, ${String(projectThreads.length)} threads`,
      );

      const projectChevron = document.createElement("span");
      projectChevron.className = "project-chevron";
      projectChevron.textContent = isProjectCollapsed ? "▸" : "▾";
      projectChevron.setAttribute("aria-hidden", "true");
      projectHeader.appendChild(projectChevron);

      const projectTitle = document.createElement("span");
      projectTitle.className = "project-title";
      projectTitle.textContent = project.name;
      projectTitle.title = project.name;

      if (project.environmentId !== "local") {
        const envBadge = document.createElement("span");
        envBadge.className = "badge-environment";
        envBadge.textContent = `[${project.environmentId}]`;
        envBadge.title = `Ambiente: ${project.environmentId}`;
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

      projectHeader.onclick = () => {
        this.toggleProject(project.id);
      };
      projectHeader.onkeydown = (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          this.toggleProject(project.id);
        } else if (e.key === "ArrowRight" && isProjectCollapsed) {
          e.preventDefault();
          this.toggleProject(project.id);
        } else if (e.key === "ArrowLeft" && !isProjectCollapsed) {
          e.preventDefault();
          this.toggleProject(project.id);
        } else {
          this.handleTreeKeyNavigation(e, projectHeader);
        }
      };

      projectNode.appendChild(projectHeader);

      if (!isProjectCollapsed) {
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

          const bucketKey = `${project.id}:${st}`;
          const isBucketCollapsed = !hasSearch && this.collapsedBucketKeys.has(bucketKey);

          const bucketHeader = document.createElement("div");
          bucketHeader.className = `bucket-header state-${st}`;
          bucketHeader.setAttribute("role", "treeitem");
          bucketHeader.setAttribute("tabindex", "0");
          bucketHeader.setAttribute("aria-expanded", isBucketCollapsed ? "false" : "true");

          const bucketChevron = document.createElement("span");
          bucketChevron.className = "bucket-chevron";
          bucketChevron.textContent = isBucketCollapsed ? "▸ " : "▾ ";
          bucketChevron.setAttribute("aria-hidden", "true");

          bucketHeader.appendChild(bucketChevron);
          bucketHeader.appendChild(document.createTextNode(`${stateLabels[st].icon} ${stateLabels[st].label} (${String(list.length)})`));

          bucketHeader.onclick = () => {
            this.toggleBucket(bucketKey);
          };
          bucketHeader.onkeydown = (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              this.toggleBucket(bucketKey);
            } else if (e.key === "ArrowRight" && isBucketCollapsed) {
              e.preventDefault();
              this.toggleBucket(bucketKey);
            } else if (e.key === "ArrowLeft" && !isBucketCollapsed) {
              e.preventDefault();
              this.toggleBucket(bucketKey);
            } else {
              this.handleTreeKeyNavigation(e, bucketHeader);
            }
          };

          stateList.appendChild(bucketHeader);

          if (!isBucketCollapsed) {
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

              // Line 1: State Icon + Title + Environment Badge
              const line1 = document.createElement("div");
              line1.className = "thread-line-1";

              const threadIcon = document.createElement("span");
              threadIcon.className = "thread-state-icon";
              threadIcon.textContent = stateLabels[thread.state].icon;
              threadIcon.setAttribute("aria-hidden", "true");
              line1.appendChild(threadIcon);

              const threadText = document.createElement("span");
              threadText.className = "thread-title";
              threadText.textContent = thread.title;
              threadText.title = thread.title;
              line1.appendChild(threadText);

              if (disambiguation.showEnvironmentTag) {
                const envTag = document.createElement("span");
                envTag.className = "badge-environment";
                envTag.textContent = thread.environmentId;
                envTag.title = `Ambiente: ${thread.environmentId}`;
                line1.appendChild(envTag);
              }

              if (thread.unread === true) {
                const unreadDot = document.createElement("span");
                unreadDot.className = "badge-unread";
                unreadDot.setAttribute("aria-label", "Mensagem não lida");
                unreadDot.title = "Mensagens não lidas";
                line1.appendChild(unreadDot);
              }

              threadItem.appendChild(line1);

              // Line 2: Workspace Label (ALWAYS visible!)
              const line2 = document.createElement("div");
              line2.className = "thread-line-2";

              const wsLabelText = thread.workspaceLabel ?? thread.workspaceId;
              const wsBadge = document.createElement("span");
              wsBadge.className = "badge-workspace thread-workspace-label";
              wsBadge.textContent = wsLabelText;
              wsBadge.title = `Workspace: ${wsLabelText}`;
              line2.appendChild(wsBadge);

              threadItem.appendChild(line2);

              threadItem.setAttribute(
                "aria-label",
                `Thread ${thread.title}, estado ${stateLabels[thread.state].label}, workspace ${wsLabelText}, ambiente ${thread.environmentId}`,
              );

              threadItem.onclick = () => {
                this.selectThread(thread.id);
              };
              threadItem.onkeydown = (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  this.selectThread(thread.id);
                } else {
                  this.handleTreeKeyNavigation(e, threadItem);
                }
              };

              stateList.appendChild(threadItem);
            }
          }
        }

        projectNode.appendChild(stateList);
      }

      this.element.appendChild(projectNode);
    }
  }

  private handleTreeKeyNavigation(e: KeyboardEvent, currentEl: HTMLElement): void {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const focusables = Array.from(
        this.element.querySelectorAll<HTMLElement>(
          '.project-header[tabindex="0"], .bucket-header[tabindex="0"], .thread-item[tabindex="0"]',
        ),
      );
      const currentIndex = focusables.indexOf(currentEl);
      if (currentIndex === -1) return;

      const nextIndex = e.key === "ArrowDown" ? currentIndex + 1 : currentIndex - 1;
      if (nextIndex >= 0 && nextIndex < focusables.length) {
        focusables[nextIndex]?.focus();
      }
    }
  }
}
