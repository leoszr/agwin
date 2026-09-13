export type PanelType = "files" | "diff" | "terminal" | "chat" | "explorer";
export type PanelContextMode = "following" | "pinned";

export interface WorkspaceContext {
  environmentId: string;
  projectId?: string | undefined;
  workspaceId: string;
  cwd: string;
}

export interface PanelState {
  id: string;
  type: PanelType;
  title: string;
  mode: PanelContextMode;
  context: WorkspaceContext;
  isUnsafeDirty?: boolean | undefined;
  activeFilePath?: string | undefined;
  viewState?: Record<string, unknown> | undefined;
}

export interface PanelAutoPinnedEvent {
  panelId: string;
  panelType: PanelType;
  previousContext: WorkspaceContext;
  reason: string;
}
