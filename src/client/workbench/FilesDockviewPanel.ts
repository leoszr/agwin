import type { PanelState, WorkspaceContext } from "./types";

export interface FilesPanelOptions {
  id: string;
  context: WorkspaceContext;
  mode?: "following" | "pinned" | undefined;
  fileService?: {
    listFiles: (envId: string, workspaceId: string) => Promise<string[]>;
    readFile: (envId: string, workspaceId: string, path: string) => Promise<string>;
  } | undefined;
}

export class FilesDockviewPanel {
  readonly state: PanelState;
  private element: HTMLElement | undefined;
  private mountedInDocument: Document | undefined;
  private selectedPath?: string | undefined;
  private fileList: string[] = [];
  private isFloating = false;
  private isPopout = false;

  constructor(private readonly options: FilesPanelOptions) {
    this.state = {
      id: options.id,
      type: "files",
      title: "Files",
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
    if (this.state.mode === "pinned") return; // Never retarget if pinned
    this.state.context = { ...context };
    delete this.selectedPath;
    delete this.state.activeFilePath;
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
    return this.selectedPath;
  }

  selectFile(filePath: string): void {
    this.selectedPath = filePath;
    this.state.activeFilePath = filePath;
    this.render();
  }

  async reload(): Promise<void> {
    if (this.options.fileService) {
      this.fileList = await this.options.fileService.listFiles(
        this.state.context.environmentId,
        this.state.context.workspaceId,
      );
    }
    this.render();
  }

  render(): void {
    if (!this.element) return;
    this.element.innerHTML = "";

    const doc = this.mountedInDocument ?? document;
    const header = doc.createElement("div");
    header.className = "files-panel-header";
    header.textContent = `Files (${this.state.context.cwd}) [${this.state.mode}]`;

    const list = doc.createElement("ul");
    list.className = "files-list";

    for (const f of this.fileList) {
      const item = doc.createElement("li");
      item.textContent = f;
      item.tabIndex = 0;
      if (f === this.selectedPath) {
        item.className = "selected";
      }
      item.onclick = () => {
        this.selectFile(f);
      };
      list.appendChild(item);
    }

    this.element.appendChild(header);
    this.element.appendChild(list);
  }

  focus(): void {
    if (this.element) {
      const selectedOrFirst = this.element.querySelector<HTMLElement>(".selected") ??
        this.element.querySelector<HTMLElement>("li");
      selectedOrFirst?.focus();
    }
  }
}
