import { describe, expect, it } from "vitest";
import {
  ResponsiveLayoutManager,
  environmentWorkspaceKey,
  getDefaultLayout,
  parseWorkbenchLayout,
  restoreWorkbenchPanels,
  serializeWorkbenchLayout,
} from "./layoutStorage";
import type { PanelState } from "./types";

describe("Workbench Layout Persistence & Recovery (Ticket 26)", () => {
  const wsLocal = { environmentId: "local", workspaceId: "ws-main", cwd: "/home/user/app" };
  const wsRemote = { environmentId: "remote-1", workspaceId: "ws-main", cwd: "/srv/backend" }; // Same workspaceId "ws-main" but in remote-1!

  it("persists only safe visual configuration and geometry, without execution state or credentials", () => {
    const panels: PanelState[] = [
      {
        id: "files-1",
        type: "files",
        title: "Files",
        mode: "following",
        context: wsLocal,
        activeFilePath: "src/index.ts",
        isUnsafeDirty: true,
      },
      {
        id: "term-1",
        type: "terminal",
        title: "Terminal",
        mode: "pinned",
        context: wsRemote,
      },
    ];

    const grid = { root: { type: "split", orientation: "vertical" } };
    const serialized = serializeWorkbenchLayout(grid, panels);

    // Verify it doesn't leak secrets or transient state
    expect(serialized).not.toContain("password");
    expect(serialized).not.toContain("token");
    expect(serialized).not.toContain("buffer");

    const parsed = parseWorkbenchLayout(serialized);
    expect(parsed).not.toBeNull();
    expect(parsed?.version).toBe(1);
    expect(parsed?.panels).toHaveLength(2);
    expect(parsed?.panels[0]?.id).toBe("files-1");
    expect(parsed?.panels[1]?.mode).toBe("pinned");
  });

  it("distinguishes contexts by both Environment and Workspace and treats remote context as offline even if local has same workspaceId", () => {
    const layout = getDefaultLayout(wsRemote);
    layout.panels.push({
      id: "diff-remote",
      type: "diff",
      title: "Diff Remote",
      mode: "pinned",
      context: wsRemote, // remote-1:ws-main
    });

    // Only local:ws-main is available! remote-1 is offline.
    const availableContexts = new Set([environmentWorkspaceKey("local", "ws-main")]);
    const restored = restoreWorkbenchPanels(layout, availableContexts);

    const placeholder = restored.find((r) => r.panel.id === "diff-remote");
    expect(placeholder).toBeDefined();
    expect(placeholder?.isPlaceholder).toBe(true);
    expect(placeholder?.unavailableReason).toContain("Ambiente 'remote-1' ou Workspace 'ws-main' está offline");

    // Context is PRESERVED, NEVER retargeted to local:ws-main!
    expect(placeholder?.panel.context.environmentId).toBe("remote-1");
    expect(placeholder?.panel.context.workspaceId).toBe("ws-main");
  });

  it("compacts and reversibly re-expands layout on narrow viewport without losing configuration", () => {
    const manager = new ResponsiveLayoutManager();
    const originalGeometry = { type: "branch", splits: [30, 70] };

    // Resize to narrow mobile width (400px)
    const narrow = manager.adjustForWidth(400, originalGeometry);
    expect(narrow.compacted).toBe(true);
    expect(narrow.geometry["mode"]).toBe("single-column");

    // Re-expand to desktop width (1200px)
    const wide = manager.adjustForWidth(1200, narrow.geometry);
    expect(wide.compacted).toBe(false);
    expect(wide.geometry).toEqual(originalGeometry);
  });

  it("restoring default recomposes geometry without deleting drafts, buffers, or processes", () => {
    const localDrafts = new Map([["chat-default", "Pending unsent prompt text..."]]);
    const termBuffers = new Map([["term-1", "Running tail -f logs..."]]);

    // Restore default layout
    const def = getDefaultLayout(wsLocal);
    expect(def.panels.map((p) => p.type)).toEqual(["explorer", "chat"]);

    // In-memory / storage client-side drafts and buffers remain completely intact
    expect(localDrafts.get("chat-default")).toBe("Pending unsent prompt text...");
    expect(termBuffers.get("term-1")).toBe("Running tail -f logs...");
  });

  it("fails recoverably on invalid layout data without crashing or impacting server-side execution", () => {
    expect(parseWorkbenchLayout("")).toBeNull();
    expect(parseWorkbenchLayout("not a json")).toBeNull();
    expect(parseWorkbenchLayout(JSON.stringify({ version: 2 }))).toBeNull();
    expect(parseWorkbenchLayout(JSON.stringify({ version: 1, gridGeometry: "bad", panels: [] }))).toBeNull();
    expect(
      parseWorkbenchLayout(
        JSON.stringify({ version: 1, gridGeometry: {}, panels: [{ id: 123 }] }),
      ),
    ).toBeNull();
  });
});
