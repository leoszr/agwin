import type { PanelState, PanelType, WorkspaceContext } from "./types";

export interface SerializedPanelConfig {
  id: string;
  type: PanelType;
  title: string;
  mode: "following" | "pinned";
  context: WorkspaceContext;
  viewState?: Record<string, unknown> | undefined;
}

export interface SerializedLayoutData {
  version: 1;
  gridGeometry: Record<string, unknown>;
  panels: SerializedPanelConfig[];
}

export interface RestoredPanel {
  panel: PanelState;
  isPlaceholder?: boolean | undefined;
  unavailableReason?: string | undefined;
}

export const LAYOUT_STORAGE_KEY = "pi-web:workbench:layout:v1";

export function environmentWorkspaceKey(envId: string, wsId: string): string {
  return `${envId}:${wsId}`;
}

export function serializeWorkbenchLayout(
  gridGeometry: Record<string, unknown>,
  panels: PanelState[],
): string {
  // Only safe visual configuration and geometry are persisted!
  // No drafts, messages, terminal pty buffers or credentials!
  const safePanels: SerializedPanelConfig[] = panels.map((p) => ({
    id: p.id,
    type: p.type,
    title: p.title,
    mode: p.mode,
    context: { ...p.context },
    ...(p.viewState !== undefined ? { viewState: { ...p.viewState } } : {}),
  }));

  const data: SerializedLayoutData = {
    version: 1,
    gridGeometry,
    panels: safePanels,
  };

  return JSON.stringify(data);
}

export function parseWorkbenchLayout(rawJson: string): SerializedLayoutData | null {
  try {
    const parsed: unknown = JSON.parse(rawJson);
    if (!isRecord(parsed)) return null;
    if (parsed["version"] !== 1) return null;
    if (!isRecord(parsed["gridGeometry"]) || !Array.isArray(parsed["panels"])) return null;

    const panels: SerializedPanelConfig[] = [];
    for (const item of parsed["panels"]) {
      if (!isRecord(item)) return null;
      if (
        typeof item["id"] !== "string" ||
        typeof item["type"] !== "string" ||
        typeof item["title"] !== "string" ||
        (item["mode"] !== "following" && item["mode"] !== "pinned") ||
        !isRecord(item["context"])
      ) {
        return null;
      }
      const ctx = item["context"];
      if (typeof ctx["environmentId"] !== "string" || typeof ctx["workspaceId"] !== "string") {
        return null;
      }

      const panelType = item["type"];
      if (panelType !== "files" && panelType !== "diff" && panelType !== "terminal" && panelType !== "chat" && panelType !== "explorer") {
        return null;
      }

      const rawVs = item["viewState"];
      const viewState = isRecord(rawVs) ? rawVs : undefined;
      panels.push({
        id: item["id"],
        type: panelType,
        title: item["title"],
        mode: item["mode"],
        context: {
          environmentId: ctx["environmentId"],
          workspaceId: ctx["workspaceId"],
          cwd: typeof ctx["cwd"] === "string" ? ctx["cwd"] : "",
        },
        ...(viewState !== undefined ? { viewState } : {}),
      });
    }
    return {
      version: 1,
      gridGeometry: parsed["gridGeometry"],
      panels,
    };
  } catch {
    return null;
  }
}

export function restoreWorkbenchPanels(
  layoutData: SerializedLayoutData,
  availableContextKeys: Set<string>, // Formatted as environmentWorkspaceKey(envId, wsId)
): RestoredPanel[] {
  return layoutData.panels.map((config) => {
    const key = environmentWorkspaceKey(config.context.environmentId, config.context.workspaceId);
    const isAvailable = availableContextKeys.has(key);
    if (!isAvailable) {
      return {
        panel: {
          ...config,
          title: `${config.title} (indisponível)`,
        },
        isPlaceholder: true,
        unavailableReason: `Ambiente '${config.context.environmentId}' ou Workspace '${config.context.workspaceId}' está offline.`,
      };
    }
    return {
      panel: {
        ...config,
      },
      isPlaceholder: false,
    };
  });
}

export function getDefaultLayout(defaultContext: WorkspaceContext): SerializedLayoutData {
  return {
    version: 1,
    gridGeometry: {
      orientation: "horizontal",
      proportions: [0.25, 0.75],
    },
    panels: [
      {
        id: "explorer-default",
        type: "explorer",
        title: "Explorer",
        mode: "following",
        context: defaultContext,
      },
      {
        id: "chat-default",
        type: "chat",
        title: "Chat",
        mode: "following",
        context: defaultContext,
      },
    ],
  };
}

export function saveWorkbenchLayoutToStorage(data: SerializedLayoutData, key = LAYOUT_STORAGE_KEY): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(key, JSON.stringify(data));
    }
  } catch {
    // ignore
  }
}

export function loadWorkbenchLayoutFromStorage(key = LAYOUT_STORAGE_KEY): SerializedLayoutData | null {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(key);
      if (raw !== null && raw.length > 0) {
        return parseWorkbenchLayout(raw);
      }
    }
    return null;
  } catch {
    return null;
  }
}

export class ResponsiveLayoutManager {
  private isCompacted = false;
  private savedGeometryBeforeCompact?: Record<string, unknown> | undefined;

  adjustForWidth(
    width: number,
    currentGeometry: Record<string, unknown>,
  ): { compacted: boolean; geometry: Record<string, unknown> } {
    if (width < 768) {
      if (!this.isCompacted) {
        this.savedGeometryBeforeCompact = currentGeometry;
        this.isCompacted = true;
      }
      return {
        compacted: true,
        geometry: { mode: "single-column", activeTab: "primary" },
      };
    }

    // Re-expanding
    if (this.isCompacted) {
      this.isCompacted = false;
      const restored = this.savedGeometryBeforeCompact ?? currentGeometry;
      delete this.savedGeometryBeforeCompact;
      return {
        compacted: false,
        geometry: restored,
      };
    }

    return {
      compacted: false,
      geometry: currentGeometry,
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
