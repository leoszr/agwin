import { describe, expect, it, vi } from "vitest";
import { WorkbenchPanelRegistry, type IWorkbenchPanelInstance } from "./panelRegistry";
import type { PanelState, WorkspaceContext } from "./types";

describe("WorkbenchPanelRegistry (Ticket 23-25)", () => {
  const ws1: WorkspaceContext = { environmentId: "local", workspaceId: "ws-1", cwd: "/repo/1" };
  const ws2: WorkspaceContext = { environmentId: "local", workspaceId: "ws-2", cwd: "/repo/2" };

  it("coordinates workspace changes through panel component setContext lifecycle", () => {
    const registry = new WorkbenchPanelRegistry();
    registry.setActiveWorkspace(ws1);

    const panelState: PanelState = {
      id: "files-1",
      type: "files",
      title: "Files",
      mode: "following",
      context: ws1,
    };

    let componentReceivedContext: WorkspaceContext | undefined;
    const panelInstance: IWorkbenchPanelInstance = {
      state: panelState,
      setContext: (ctx) => {
        componentReceivedContext = ctx;
      },
    };

    registry.registerPanel(panelState, panelInstance);

    // Switch workspace
    registry.setActiveWorkspace(ws2);
    expect(panelState.context.workspaceId).toBe("ws-2");
    expect(componentReceivedContext?.workspaceId).toBe("ws-2");
  });

  it("strictly forbids setting Terminal to following mode and keeps it pinned", () => {
    const registry = new WorkbenchPanelRegistry();
    registry.setActiveWorkspace(ws1);

    const termState: PanelState = {
      id: "term-1",
      type: "terminal",
      title: "Terminal",
      mode: "pinned",
      context: ws1,
    };

    registry.registerPanel(termState);
    expect(termState.mode).toBe("pinned");

    const changed = registry.setPanelMode("term-1", "following");
    expect(changed).toBe(false);
    expect(termState.mode).toBe("pinned");

    // Switching workspace does NOT touch terminal context
    registry.setActiveWorkspace(ws2);
    expect(termState.context.workspaceId).toBe("ws-1");
  });

  it("auto-pins a dirty following panel and calls component onAutoPinned", () => {
    const registry = new WorkbenchPanelRegistry();
    registry.setActiveWorkspace(ws1);

    const dirtyPanelState: PanelState = {
      id: "diff-dirty",
      type: "diff",
      title: "Diff",
      mode: "following",
      context: ws1,
      isUnsafeDirty: true,
    };

    let autoPinReason = "";
    const dirtyPanelInstance: IWorkbenchPanelInstance = {
      state: dirtyPanelState,
      setContext: vi.fn(),
      onAutoPinned: (reason) => {
        autoPinReason = reason;
      },
    };

    registry.registerPanel(dirtyPanelState, dirtyPanelInstance);
    registry.setActiveWorkspace(ws2);

    expect(dirtyPanelState.mode).toBe("pinned");
    expect(dirtyPanelState.context.workspaceId).toBe("ws-1"); // Retained previous context!
    expect(autoPinReason).toContain("alterações não salvas");
  });
});
