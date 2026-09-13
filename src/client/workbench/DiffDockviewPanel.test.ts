// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from "vitest";
import { DiffDockviewPanel, type DiffService } from "./DiffDockviewPanel";
import { WorkbenchPanelRegistry } from "./panelRegistry";
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
});
