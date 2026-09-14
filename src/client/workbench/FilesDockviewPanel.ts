import type { PanelState, WorkspaceContext } from "./types.js";
import type { IWorkbenchPanelInstance } from "./panelRegistry.js";
import { workspacesApi } from "../src/api/clients.js";
import { createWorkspaceFiles, type WorkspaceFilesApi } from "../src/plugins/workspaceFiles.js";
import type { WorkspaceFiles, WorkspaceFilesCapabilityV1 } from "../src/plugins/types.js";
import type {
  DeleteWorkspaceFileResponse,
  FileContentResponse,
  FileTreeEntry,
  MoveWorkspaceFileResponse,
  WriteWorkspaceFileResponse,
} from "../src/api.js";

export interface FilesPanelOptions {
  id: string;
  context: WorkspaceContext;
  mode?: "following" | "pinned" | undefined;
  files?: (WorkspaceFilesCapabilityV1 | WorkspaceFiles) | undefined;
  api?: WorkspaceFilesApi | undefined;
  fileService?: {
    listFiles: (envId: string, workspaceId: string, projectId?: string) => Promise<string[]>;
    readFile: (envId: string, workspaceId: string, path: string, projectId?: string) => Promise<string>;
    writeFile?: ((envId: string, workspaceId: string, path: string, content: string, projectId?: string) => Promise<void>) | undefined;
    deleteFile?: ((envId: string, workspaceId: string, path: string, projectId?: string) => Promise<void>) | undefined;
  } | undefined;
}

export class FilesDockviewPanel implements IWorkbenchPanelInstance {
  readonly state: PanelState;
  private element: HTMLElement | undefined;
  private mountedInDocument: Document | undefined;
  private selectedPath?: string | undefined;
  private selectedFileContent?: string | undefined;
  private fileEntries: FileTreeEntry[] = [];
  private isFloating = false;
  private isPopout = false;
  private filesCapability: WorkspaceFilesCapabilityV1 | WorkspaceFiles;

  constructor(private readonly options: FilesPanelOptions) {
    this.state = {
      id: options.id,
      type: "files",
      title: "Files",
      mode: options.mode ?? "following",
      context: { ...options.context },
    };
    this.filesCapability = this.resolveFilesCapability(this.state.context);
  }

  private resolveFilesCapability(context: WorkspaceContext): WorkspaceFilesCapabilityV1 | WorkspaceFiles {
    if (this.options.files !== undefined) {
      return this.options.files;
    }
    if (this.options.fileService !== undefined) {
      const fs = this.options.fileService;
      return {
        listFiles: async () => {
          const paths = await fs.listFiles(context.environmentId, context.workspaceId, context.projectId);
          return {
            path: "",
            entries: paths.map((p) => ({
              name: p.split("/").pop() ?? p,
              path: p,
              type: "file" as const,
            })),
            scannedAt: new Date().toISOString(),
            truncated: false,
          };
        },
        readFile: async (path: string): Promise<FileContentResponse> => {
          const content = await fs.readFile(context.environmentId, context.workspaceId, path, context.projectId);
          return {
            path,
            content,
            encoding: "utf8",
            size: content.length,
            modifiedAt: new Date().toISOString(),
            truncated: false,
            binary: false,
          };
        },
        writeFile: async (path: string, content: string | Uint8Array): Promise<WriteWorkspaceFileResponse> => {
          if (fs.writeFile) {
            const str = typeof content === "string" ? content : new TextDecoder().decode(content);
            await fs.writeFile(context.environmentId, context.workspaceId, path, str, context.projectId);
          }
          const size = typeof content === "string" ? content.length : content.byteLength;
          return { path, size, modifiedAt: new Date().toISOString(), created: true };
        },
        deleteFile: async (path: string): Promise<DeleteWorkspaceFileResponse> => {
          if (fs.deleteFile) {
            await fs.deleteFile(context.environmentId, context.workspaceId, path, context.projectId);
          }
          return { path, existed: true };
        },
        moveFile: (): Promise<MoveWorkspaceFileResponse> =>
          Promise.resolve({
            fromPath: "",
            toPath: "",
            size: 0,
            modifiedAt: new Date().toISOString(),
          }),
      };
    }
    return createWorkspaceFiles(
      this.options.api ?? workspacesApi,
      {
        id: context.workspaceId,
        projectId: context.projectId ?? context.workspaceId,
      },
      context.environmentId,
      { defaultUploadFolder: ".pi-web/uploads" },
    );
  }

  init(container: HTMLElement, doc?: Document): void {
    this.element = container;
    this.mountedInDocument = doc ?? container.ownerDocument;
    this.render();
  }

  setContext(context: WorkspaceContext): void {
    if (this.state.mode === "pinned") return; // Never retarget if pinned
    this.state.context = { ...context };
    delete this.selectedPath;
    delete this.state.activeFilePath;
    this.selectedFileContent = undefined;
    this.filesCapability = this.resolveFilesCapability(this.state.context);
    void this.reload().catch(() => undefined);
  }

  setMode(mode: "following" | "pinned"): void {
    this.state.mode = mode;
    this.render();
  }

  setDirty(dirty: boolean): void {
    this.state.isUnsafeDirty = dirty;
  }

  onAutoPinned(): void {
    this.state.mode = "pinned";
    this.render();
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

  getSelectedFileContent(): string | undefined {
    return this.selectedFileContent;
  }

  getFileEntries(): FileTreeEntry[] {
    return this.fileEntries;
  }

  getFileList(): string[] {
    return this.fileEntries.map((e) => e.path);
  }

  selectFile(filePath: string): void {
    this.selectedPath = filePath;
    this.state.activeFilePath = filePath;
    void this.filesCapability
      .readFile(filePath)
      .then((res) => {
        if (this.selectedPath === filePath) {
          this.selectedFileContent = res.content;
          this.render();
        }
      })
      .catch(() => {
        if (this.selectedPath === filePath) {
          this.selectedFileContent = undefined;
        }
      });
    this.render();
  }

  async writeFile(filePath: string, content: string | Uint8Array): Promise<void> {
    await this.filesCapability.writeFile(filePath, content);
    if (this.selectedPath === filePath) {
      this.selectedFileContent = typeof content === "string" ? content : new TextDecoder().decode(content);
    }
    await this.reload();
  }

  async deleteFile(filePath: string): Promise<void> {
    await this.filesCapability.deleteFile(filePath);
    if (this.selectedPath === filePath) {
      delete this.selectedPath;
      delete this.state.activeFilePath;
      this.selectedFileContent = undefined;
    }
    await this.reload();
  }

  async reload(): Promise<void> {
    try {
      const res = await this.filesCapability.listFiles("");
      this.fileEntries = res.entries;
    } catch {
      this.fileEntries = [];
    }
    this.render();
  }
  render(): void {
    if (!this.element) return;
    this.element.innerHTML = "";

    const doc = this.mountedInDocument ?? this.element.ownerDocument;
    const header = doc.createElement("div");
    header.className = "files-panel-header";
    header.textContent = `Files (${this.state.context.cwd}) [${this.state.mode}]`;

    const list = doc.createElement("ul");
    list.className = "files-list";

    for (const entry of this.fileEntries) {
      const item = doc.createElement("li");
      item.textContent = entry.path;
      item.tabIndex = 0;
      if (entry.path === this.selectedPath) {
        item.className = "selected";
      }
      item.onclick = () => {
        this.selectFile(entry.path);
      };
      list.appendChild(item);
    }

    this.element.appendChild(header);
    this.element.appendChild(list);

    if (this.selectedPath !== undefined && this.selectedFileContent !== undefined) {
      const preview = doc.createElement("pre");
      preview.className = "file-preview-content";
      preview.textContent = this.selectedFileContent;
      this.element.appendChild(preview);
    }
  }

  focus(): void {
    if (this.element) {
      const selectedOrFirst = this.element.querySelector<HTMLElement>(".selected") ??
        this.element.querySelector<HTMLElement>("li");
      selectedOrFirst?.focus();
    }
  }

  dispose(): void {
    this.element = undefined;
  }
}
