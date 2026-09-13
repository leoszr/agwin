// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from "vitest";
import { FilesDockviewPanel } from "./FilesDockviewPanel";
import { WorkbenchPanelRegistry } from "./panelRegistry";
import type { WorkspaceContext } from "./types";

describe("FilesDockviewPanel & Panel Registry (Ticket 23)", () => {
  let workspaceA: WorkspaceContext;
  let workspaceB: WorkspaceContext;
  let fileServiceMock: {
    listFiles: (envId: string, workspaceId: string) => Promise<string[]>;
    readFile: (envId: string, workspaceId: string, path: string) => Promise<string>;
  };

  beforeEach(() => {
    workspaceA = { environmentId: "local", workspaceId: "ws-a", cwd: "/repos/project-a" };
    workspaceB = { environmentId: "local", workspaceId: "ws-b", cwd: "/repos/project-b" };
    fileServiceMock = {
      listFiles: (_env, wsId) => Promise.resolve(wsId === "ws-a" ? ["src/index.ts", "package.json"] : ["main.py", "requirements.txt"]),
      readFile: () => Promise.resolve("console.log('hello');"),
    };
  });

  it("operates files via server-side fileService without client-side filesystem access", async () => {
    const panel = new FilesDockviewPanel({
      id: "files-1",
      context: workspaceA,
      fileService: fileServiceMock,
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    panel.init(container);
    await panel.reload();

    expect(container.textContent).toContain("src/index.ts");
    expect(container.textContent).toContain("package.json");

    // Client select file
    panel.selectFile("src/index.ts");
    expect(panel.getSelectedFile()).toBe("src/index.ts");
  });

  it("follows active workspace context when in following mode", async () => {
    const registry = new WorkbenchPanelRegistry();
    const panel = new FilesDockviewPanel({
      id: "files-following",
      context: workspaceA,
      mode: "following",
      fileService: fileServiceMock,
    });

    registry.registerPanel(panel.state);
    registry.setActiveWorkspace(workspaceA);

    // Switch workspace in registry
    registry.setActiveWorkspace(workspaceB);
    const p = registry.getPanel("files-following");
    if (!p) throw new Error("Panel not found");
    panel.setContext(p.context);
    await panel.reload();

    expect(panel.state.context.workspaceId).toBe("ws-b");
  });

  it("retains context and prevents silent retargeting when in pinned mode", () => {
    const registry = new WorkbenchPanelRegistry();
    const panel = new FilesDockviewPanel({
      id: "files-pinned",
      context: workspaceA,
      mode: "pinned",
      fileService: fileServiceMock,
    });

    registry.registerPanel(panel.state);
    registry.setActiveWorkspace(workspaceB);

    // Context should NOT have changed for pinned panel
    const p = registry.getPanel("files-pinned");
    if (!p) throw new Error("Panel not found");
    panel.setContext(p.context);
    expect(panel.state.context.workspaceId).toBe("ws-a");
  });

  it("auto-pins a following panel and notifies when workspace changes while dirty", () => {
    const registry = new WorkbenchPanelRegistry();
    const panelState = registry.registerPanel({
      id: "files-dirty",
      type: "files",
      title: "Files",
      mode: "following",
      context: workspaceA,
      isUnsafeDirty: true,
    });

    let autoPinNotified = false;
    registry.onAutoPinned((event) => {
      autoPinNotified = true;
      expect(event.panelId).toBe("files-dirty");
      expect(event.previousContext.workspaceId).toBe("ws-a");
    });

    registry.setActiveWorkspace(workspaceB);

    expect(autoPinNotified).toBe(true);
    expect(panelState.mode).toBe("pinned");
    expect(panelState.context.workspaceId).toBe("ws-a");
  });

  it("preserves context, selected file, and focus across move, hide/reopen, floating, and popout", async () => {
    const panel = new FilesDockviewPanel({
      id: "files-persist",
      context: workspaceA,
      fileService: fileServiceMock,
    });

    const container1 = document.createElement("div");
    document.body.appendChild(container1);
    panel.init(container1);
    await panel.reload();
    panel.selectFile("package.json");

    // Floating
    panel.setFloating(true);
    expect(panel.getIsFloating()).toBe(true);
    expect(panel.getSelectedFile()).toBe("package.json");

    // Popout
    const fakePopoutDoc = document.implementation.createHTMLDocument("Popout");
    panel.setPopout(true, fakePopoutDoc);
    expect(panel.getIsPopout()).toBe(true);

    // Reparenting / Move into container 2
    const container2 = fakePopoutDoc.createElement("div");
    fakePopoutDoc.body.appendChild(container2);
    panel.init(container2, fakePopoutDoc);

    expect(panel.getSelectedFile()).toBe("package.json");
    expect(panel.state.context.workspaceId).toBe("ws-a");
    expect(container2.querySelector(".selected")?.textContent).toBe("package.json");

    // Focus lifecycle
    panel.focus();
    expect(fakePopoutDoc.activeElement).toBe(container2.querySelector(".selected"));
  });
});
