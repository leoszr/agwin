import type { PanelState, WorkspaceContext } from "./types";

export interface GitDiffFileSummary {
  path: string;
  status: "modified" | "added" | "deleted";
  insertions: number;
  deletions: number;
}

export interface DiffService {
  getChangedFiles: (envId: string, workspaceId: string) => Promise<GitDiffFileSummary[]>;
  getFileDiff: (envId: string, workspaceId: string, path: string) => Promise<string>;
}

export interface DiffPanelOptions {
  id: string;
  context: WorkspaceContext;
  mode?: "following" | "pinned" | undefined;
  diffService?: DiffService | undefined;
}

export class DiffDockviewPanel {
  readonly state: PanelState;
  private element: HTMLElement | undefined;
  private mountedInDocument: Document | undefined;
  private selectedFile?: string | undefined;
  private changedFiles: GitDiffFileSummary[] = [];
  private currentDiffText = "";
  private isFloating = false;
  private isPopout = false;

  constructor(private readonly options: DiffPanelOptions) {
    this.state = {
      id: options.id,
      type: "diff",
      title: "Diff",
      mode: options.mode ?? "following",
      context: { ...options.context },
    };
  }

  init(container: HTMLElement, doc: Document = document): void {
    this.element = container;
    this.mountedInDocument = doc;
    this.render();
  }

  setContext(context: WorkspaceContext): void {
    if (this.state.mode === "pinned") return; // Never retarget pinned
    this.state.context = { ...context };
    delete this.selectedFile;
    delete this.state.activeFilePath;
    this.currentDiffText = "";
    void this.reload();
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

  getSelectedFile(): string | undefined {
    return this.selectedFile;
  }

  getCurrentDiffText(): string {
    return this.currentDiffText;
  }

  async selectFile(filePath: string): Promise<void> {
    this.selectedFile = filePath;
    this.state.activeFilePath = filePath;
    if (this.options.diffService) {
      this.currentDiffText = await this.options.diffService.getFileDiff(
        this.state.context.environmentId,
        this.state.context.workspaceId,
        filePath,
      );
    }
    this.render();
  }

  async reload(): Promise<void> {
    if (this.options.diffService) {
      this.changedFiles = await this.options.diffService.getChangedFiles(
        this.state.context.environmentId,
        this.state.context.workspaceId,
      );
      if (this.selectedFile !== undefined && this.changedFiles.some((f) => f.path === this.selectedFile)) {
        this.currentDiffText = await this.options.diffService.getFileDiff(
          this.state.context.environmentId,
          this.state.context.workspaceId,
          this.selectedFile,
        );
      } else if (this.changedFiles.length > 0) {
        const first = this.changedFiles[0];
        if (first) {
          await this.selectFile(first.path);
        }
      }
    }
    this.render();
  }

  render(): void {
    if (!this.element) return;
    this.element.innerHTML = "";

    const doc = this.mountedInDocument ?? document;
    const header = doc.createElement("div");
    header.className = "diff-panel-header";
    header.textContent = `Diff (${this.state.context.cwd}) [${this.state.mode}]`;

    const fileListEl = doc.createElement("div");
    fileListEl.className = "diff-file-list";

    for (const f of this.changedFiles) {
      const item = doc.createElement("div");
      item.className = "diff-file-item";
      item.tabIndex = 0;
      if (f.path === this.selectedFile) {
        item.classList.add("selected");
      }
      item.textContent = `${f.path} (+${String(f.insertions)}, -${String(f.deletions)})`;
      item.onclick = () => { void this.selectFile(f.path); };
      fileListEl.appendChild(item);
    }

    const diffContent = doc.createElement("pre");
    diffContent.className = "diff-viewer";
    diffContent.textContent = this.currentDiffText.length > 0 ? this.currentDiffText : "No diff selected";

    this.element.appendChild(header);
    this.element.appendChild(fileListEl);
    this.element.appendChild(diffContent);
  }

  focus(): void {
    if (this.element) {
      const selectedOrFirst = this.element.querySelector<HTMLElement>(".diff-file-item.selected") ??
        this.element.querySelector<HTMLElement>("li");
      selectedOrFirst?.focus();
    }
  }
}
