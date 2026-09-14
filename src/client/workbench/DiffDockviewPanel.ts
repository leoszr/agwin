import type { JsonValue } from "../../shared/apiTypes";
import type { PanelState, WorkspaceContext } from "./types";
import type { IWorkbenchPanelInstance } from "./panelRegistry";
import { requestPluginBackend, type PluginBackendRequestTarget } from "../src/api/pluginBackends";

export interface GitDiffFileSummary {
  path: string;
  status: "modified" | "added" | "deleted";
  insertions?: number | undefined;
  deletions?: number | undefined;
}

export interface DiffService {
  getChangedFiles: (envId: string, workspaceId: string, projectId?: string) => Promise<GitDiffFileSummary[]>;
  getFileDiff: (envId: string, workspaceId: string, path: string, projectId?: string) => Promise<string>;
}

export interface DiffPanelOptions {
  id: string;
  context: WorkspaceContext;
  mode?: "following" | "pinned" | undefined;
  diffService?: DiffService | undefined;
}

export class DiffDockviewPanel implements IWorkbenchPanelInstance {
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
    return this.selectedFile;
  }

  getCurrentDiffText(): string {
    return this.currentDiffText;
  }

  async selectFile(filePath: string): Promise<void> {
    this.selectedFile = filePath;
    this.state.activeFilePath = filePath;
    if (this.options.diffService) {
      try {
        this.currentDiffText = await this.options.diffService.getFileDiff(
          this.state.context.environmentId,
          this.state.context.workspaceId,
          filePath,
          this.state.context.projectId,
        );
      } catch {
        this.currentDiffText = "";
      }
    }
    this.render();
  }

  async reload(): Promise<void> {
    if (this.options.diffService) {
      this.changedFiles = await this.options.diffService.getChangedFiles(
        this.state.context.environmentId,
        this.state.context.workspaceId,
        this.state.context.projectId,
      );
      if (this.selectedFile !== undefined && this.changedFiles.some((f) => f.path === this.selectedFile)) {
        this.currentDiffText = await this.options.diffService.getFileDiff(
          this.state.context.environmentId,
          this.state.context.workspaceId,
          this.selectedFile,
          this.state.context.projectId,
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
      const counts = f.insertions !== undefined && f.deletions !== undefined ? ` (+${String(f.insertions)}, -${String(f.deletions)})` : "";
      item.textContent = `${f.path}${counts}`;
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

  dispose(): void {
    this.element = undefined;
  }
}

/** Registry pieces the shell passes so panels reach the Git plugin's workspace backend. */
export interface GitDiffServiceBinding {
  sourcePluginId: string;
  backendRevision: string;
}

// Operation names of the status/diff contract owned by `pi-web-plugins/git`.
const GIT_STATUS_OPERATION = "status";
const GIT_DIFF_OPERATION = "diff";

/**
 * Production DiffService over the Git plugin backend. Maps only what the panel
 * renders, so contract drift in the plugin fails visibly instead of mis-rendering.
 */
export function createGitDiffService(
  binding: GitDiffServiceBinding,
  request: (target: PluginBackendRequestTarget, operation: string, input: JsonValue) => Promise<JsonValue> = requestPluginBackend,
): DiffService {
  const targetFor = (environmentId: string, workspaceId: string, projectId: string | undefined): PluginBackendRequestTarget => ({
    pluginId: binding.sourcePluginId,
    backendRevision: binding.backendRevision,
    machineId: environmentId,
    projectId: projectId ?? workspaceId,
    workspaceId,
  });
  return {
    async getChangedFiles(environmentId, workspaceId, projectId) {
      return gitChangedFiles(await request(targetFor(environmentId, workspaceId, projectId), GIT_STATUS_OPERATION, null));
    },
    async getFileDiff(environmentId, workspaceId, path, projectId) {
      const response = await request(targetFor(environmentId, workspaceId, projectId), GIT_DIFF_OPERATION, { path });
      return gitDiffText(response);
    },
  };
}

function gitChangedFiles(value: JsonValue): GitDiffFileSummary[] {
  if (!isGitRecord(value) || !Array.isArray(value["files"])) return [];
  const files: readonly JsonValue[] = value["files"];
  const summaries: GitDiffFileSummary[] = [];
  for (const file of files) {
    if (!isGitRecord(file) || typeof file["path"] !== "string") continue;
    const status = gitFileStatus(file["workingTree"]) ?? gitFileStatus(file["index"]);
    if (status === undefined) continue;
    summaries.push({ path: file["path"], status });
  }
  return summaries;
}

function gitFileStatus(state: JsonValue | undefined): GitDiffFileSummary["status"] | undefined {
  if (state === "added") return "added";
  if (state === "deleted") return "deleted";
  if (state === "unmodified" || state === "ignored" || state === undefined) return undefined;
  return typeof state === "string" && state.length > 0 ? "modified" : undefined;
}

function gitDiffText(value: JsonValue): string {
  return isGitRecord(value) && typeof value["diff"] === "string" ? value["diff"] : "";
}

function isGitRecord(value: JsonValue): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
