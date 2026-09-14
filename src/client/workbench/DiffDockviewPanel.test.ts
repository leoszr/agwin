// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JsonValue } from "../../shared/apiTypes";
import { createGitDiffService, DiffDockviewPanel, type DiffService } from "./DiffDockviewPanel";
import type { PluginBackendRequestTarget } from "../src/api/pluginBackends";
import { WorkbenchPanelRegistry } from "./panelRegistry";
import { DockviewWorkbench } from "./DockviewWorkbench";
import type { PanelAutoPinnedEvent, WorkspaceContext } from "./types";

describe("DiffDockviewPanel & Contextual Management (Ticket 24)", () => {
  let workspace1: WorkspaceContext;
  let workspace2: WorkspaceContext;
  let diffServiceMock: DiffService;

  beforeEach(() => {
    workspace1 = { environmentId: "local", workspaceId: "ws-1", cwd: "/repo/one" };
    workspace2 = { environmentId: "local", workspaceId: "ws-2", cwd: "/repo/two" };

    diffServiceMock = {
      getChangedFiles: (_env, wsId) => {
        if (wsId === "ws-1") {
          return Promise.resolve([{ path: "src/app.ts", status: "modified", insertions: 10, deletions: 2 }]);
        }
        return Promise.resolve([{ path: "docs/readme.md", status: "modified", insertions: 5, deletions: 0 }]);
      },
      getFileDiff: (_env, wsId, path) => {
        return Promise.resolve(`diff for ${path} in ${wsId}`);
      },
    };
  });

  afterEach(() => {
    document.body.replaceChildren();
    localStorage.clear();
  });

  it("displays git changes of the correct workspace using the diff service", async () => {
    const panel = new DiffDockviewPanel({
      id: "diff-1",
      context: workspace1,
      diffService: diffServiceMock,
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    panel.init(container);
    await panel.reload();

    expect(panel.getSelectedFile()).toBe("src/app.ts");
    expect(panel.getCurrentDiffText()).toBe("diff for src/app.ts in ws-1");
    expect(container.textContent).toContain("src/app.ts (+10, -2)");
  });

  it("follower instances track safe workspace selection, pinned instances retain context", async () => {
    const registry = new WorkbenchPanelRegistry();
    const follower = new DiffDockviewPanel({
      id: "diff-follower",
      context: workspace1,
      mode: "following",
      diffService: diffServiceMock,
    });
    const pinned = new DiffDockviewPanel({
      id: "diff-pinned",
      context: workspace1,
      mode: "pinned",
      diffService: diffServiceMock,
    });

    registry.registerPanel(follower.state);
    registry.registerPanel(pinned.state);
    registry.setActiveWorkspace(workspace1);

    // Switch workspace in registry
    registry.setActiveWorkspace(workspace2);
    const followerPanel = registry.getPanel("diff-follower");
    const pinnedPanel = registry.getPanel("diff-pinned");
    if (!followerPanel || !pinnedPanel) throw new Error("Panels not registered");

    follower.setContext(followerPanel.context);
    pinned.setContext(pinnedPanel.context);

    await follower.reload();
    await pinned.reload();

    // Follower has switched to ws-2
    expect(follower.state.context.workspaceId).toBe("ws-2");
    expect(follower.getSelectedFile()).toBe("docs/readme.md");

    // Pinned remains in ws-1
    expect(pinned.state.context.workspaceId).toBe("ws-1");
    expect(pinned.getSelectedFile()).toBe("src/app.ts");
  });

  it("auto-pins a follower and notifies user when an unsafe/dirty change occurs during context switch", () => {
    const registry = new WorkbenchPanelRegistry();
    const panelState = registry.registerPanel({
      id: "diff-staging",
      type: "diff",
      title: "Diff",
      mode: "following",
      context: workspace1,
      isUnsafeDirty: true,
    });

    const events: PanelAutoPinnedEvent[] = [];
    registry.onAutoPinned((event) => {
      events.push(event);
    });

    registry.setActiveWorkspace(workspace2);

    expect(events.length).toBe(1);
    const ev = events[0];
    expect(ev?.panelId).toBe("diff-staging");
    expect(panelState.mode).toBe("pinned");
    expect(panelState.context.workspaceId).toBe("ws-1");
  });

  it("preserves state across move, hide/reopen, floating, and popout", async () => {
    const panel = new DiffDockviewPanel({
      id: "diff-multiview",
      context: workspace1,
      diffService: diffServiceMock,
    });

    const container1 = document.createElement("div");
    document.body.appendChild(container1);
    panel.init(container1);
    await panel.reload();

    panel.setFloating(true);
    expect(panel.getIsFloating()).toBe(true);

    const popoutDoc = document.implementation.createHTMLDocument("Popout Window");
    panel.setPopout(true, popoutDoc);
    expect(panel.getIsPopout()).toBe(true);

    const container2 = popoutDoc.createElement("div");
    popoutDoc.body.appendChild(container2);
    panel.init(container2, popoutDoc);

    expect(panel.getSelectedFile()).toBe("src/app.ts");
    expect(panel.getCurrentDiffText()).toBe("diff for src/app.ts in ws-1");
    expect(container2.querySelector(".diff-viewer")?.textContent).toBe("diff for src/app.ts in ws-1");

    panel.focus();
  });

  it("following panels reload from the new workspace when the registry switches context", async () => {
    const getChangedFiles = vi.fn((envId: string, workspaceId: string) =>
      Promise.resolve(workspaceId === "ws-1"
        ? [{ path: "src/app.ts", status: "modified" as const, insertions: 10, deletions: 2 }]
        : [{ path: "docs/readme.md", status: "modified" as const }]));
    const follower = new DiffDockviewPanel({
      id: "diff-live-follower",
      context: workspace1,
      mode: "following",
      diffService: { getChangedFiles, getFileDiff: vi.fn(() => Promise.resolve("diff body")) },
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    follower.init(container);
    await follower.reload();
    expect(container.querySelector(".diff-file-item")?.textContent).toBe("src/app.ts (+10, -2)");

    const registry = new WorkbenchPanelRegistry();
    registry.setActiveWorkspace(workspace1);
    registry.registerPanel(follower.state, follower);
    registry.setActiveWorkspace(workspace2);

    expect(follower.state.context.workspaceId).toBe("ws-2");
    await vi.waitFor(() => {
      expect(getChangedFiles).toHaveBeenCalledWith("local", "ws-2", undefined);
    });
    await vi.waitFor(() => {
      expect(container.querySelector(".diff-file-item")?.textContent).toBe("docs/readme.md");
    });
  });

  it("pinned panels keep context and skip the diff service when the workspace switches", () => {
    const getChangedFiles = vi.fn(() => Promise.resolve([]));
    const pinned = new DiffDockviewPanel({
      id: "diff-live-pinned",
      context: workspace1,
      mode: "pinned",
      diffService: { getChangedFiles, getFileDiff: vi.fn() },
    });

    const registry = new WorkbenchPanelRegistry();
    registry.setActiveWorkspace(workspace1);
    registry.registerPanel(pinned.state, pinned);
    registry.setActiveWorkspace(workspace2);

    expect(pinned.state.context.workspaceId).toBe("ws-1");
    expect(getChangedFiles).not.toHaveBeenCalled();
  });

  it("auto-pins the real panel and announces the protection when a dirty follower meets a workspace switch", () => {
    const registry = new WorkbenchPanelRegistry();
    registry.setActiveWorkspace(workspace1);
    const panel = new DiffDockviewPanel({ id: "diff-dirty-live", context: workspace1, mode: "following" });
    const container = document.createElement("div");
    document.body.appendChild(container);
    panel.init(container);
    registry.registerPanel(panel.state, panel);
    panel.setDirty(true);

    const events: PanelAutoPinnedEvent[] = [];
    registry.onAutoPinned((event) => { events.push(event); });
    registry.setActiveWorkspace(workspace2);

    expect(events.map((event) => event.panelId)).toEqual(["diff-dirty-live"]);
    expect(panel.state.mode).toBe("pinned");
    expect(panel.state.context.workspaceId).toBe("ws-1");
    expect(container.textContent).toContain("[pinned]");
  });

  it("adds a live diff panel to the DockviewWorkbench and restores it as a working instance", async () => {
    const hostContainer = document.createElement("div");
    document.body.appendChild(hostContainer);

    const workbench = new DockviewWorkbench({
      container: hostContainer,
      initialContext: workspace1,
    });

    const diffPanel = workbench.addDiffPanel({
      id: "diff-dockview-1",
      mode: "following",
      diffService: diffServiceMock,
    });

    expect(diffPanel.state.id).toBe("diff-dockview-1");
    expect(diffPanel.state.type).toBe("diff");
    expect(workbench.registry.getPanelInstance("diff-dockview-1")).toBe(diffPanel);

    await diffPanel.reload();
    expect(diffPanel.getSelectedFile()).toBe("src/app.ts");

    workbench.setWorkspace(workspace2);
    expect(diffPanel.state.context.workspaceId).toBe("ws-2");

    workbench.saveLayout();
    workbench.dispose();

    const restored = new DockviewWorkbench({
      container: hostContainer,
      initialContext: workspace1,
    });
    expect(restored.restoreSavedLayout({ diffService: diffServiceMock })).toBe(true);
    const revived = restored.registry.getPanelInstance("diff-dockview-1");
    if (!(revived instanceof DiffDockviewPanel)) throw new Error("Restored diff panel is not a live instance");
    expect(revived.state.context.workspaceId).toBe("ws-2");
    restored.dispose();
  });

  it("maps the git plugin backend status and diff onto the panel service", async () => {
    const requests: (PluginBackendRequestTarget & { operation: string })[] = [];
    const service = createGitDiffService(
      { sourcePluginId: "git", backendRevision: "git-r1" },
      (target, operation) => {
        requests.push({ ...target, operation });
        const statusPayload: JsonValue = {
          isGitRepo: true,
          hash: "abc",
          branch: "main",
          files: [
            { path: "src/app.ts", index: "modified", workingTree: "modified" },
            { path: "new.ts", index: "unmodified", workingTree: "added" },
            { path: "gone.ts", index: "unmodified", workingTree: "deleted" },
            { path: "clean.ts", index: "unmodified", workingTree: "unmodified" },
          ],
          submodules: [],
        };
        const diffPayload: JsonValue = { path: "src/app.ts", staged: false, hash: "abc", diff: "diff --git a/src/app.ts", truncated: false };
        return Promise.resolve(operation === "status" ? statusPayload : diffPayload);
      },
    );

    const files = await service.getChangedFiles("local", "ws-1");
    const diff = await service.getFileDiff("local", "ws-1", "src/app.ts", "proj-1");

    expect(files).toEqual([
      { path: "src/app.ts", status: "modified" },
      { path: "new.ts", status: "added" },
      { path: "gone.ts", status: "deleted" },
    ]);
    expect(diff).toBe("diff --git a/src/app.ts");
    expect(requests).toEqual([
      { pluginId: "git", backendRevision: "git-r1", machineId: "local", projectId: "ws-1", workspaceId: "ws-1", operation: "status" },
      { pluginId: "git", backendRevision: "git-r1", machineId: "local", projectId: "proj-1", workspaceId: "ws-1", operation: "diff" },
    ]);
  });
});
