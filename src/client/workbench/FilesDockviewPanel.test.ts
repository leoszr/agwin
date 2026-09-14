// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { FilesDockviewPanel } from "./FilesDockviewPanel";
import { DockviewWorkbench } from "./DockviewWorkbench";
import { WorkbenchPanelRegistry } from "./panelRegistry";
import type { WorkspaceContext } from "./types";
import type { WorkspaceFilesApi } from "../src/plugins/workspaceFiles";

describe("FilesDockviewPanel & Panel Registry (Ticket 23)", () => {
  let workspaceA: WorkspaceContext;
  let workspaceB: WorkspaceContext;
  let fileStorage: Record<string, string>;
  let fileServiceMock: {
    listFiles: (envId: string, workspaceId: string) => Promise<string[]>;
    readFile: (envId: string, workspaceId: string, path: string) => Promise<string>;
    writeFile: (envId: string, workspaceId: string, path: string, content: string) => Promise<void>;
    deleteFile: (envId: string, workspaceId: string, path: string) => Promise<void>;
  };
  beforeEach(() => {
    workspaceA = { environmentId: "local", workspaceId: "ws-a", cwd: "/repos/project-a" };
    workspaceB = { environmentId: "local", workspaceId: "ws-b", cwd: "/repos/project-b" };
    fileStorage = {
      "src/index.ts": "console.log('hello');",
      "package.json": '{"name": "test"}',
    };
    fileServiceMock = {
      listFiles: (_env, wsId) =>
        Promise.resolve(
          wsId === "ws-a" ? Object.keys(fileStorage) : ["main.py", "requirements.txt"],
        ),
      readFile: (_env, _wsId, path) => Promise.resolve(fileStorage[path] ?? ""),
      writeFile: (_env, _wsId, path, content) => {
        fileStorage[path] = content;
        return Promise.resolve();
      },
      deleteFile: (_env, _wsId, path) => {
        fileStorage = Object.fromEntries(
          Object.entries(fileStorage).filter(([key]) => key !== path),
        );
        return Promise.resolve();
      },
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

    // Client select file and loads content
    panel.selectFile("src/index.ts");
    expect(panel.getSelectedFile()).toBe("src/index.ts");
    await vi.waitFor(() => {
      expect(panel.getSelectedFileContent()).toBe("console.log('hello');");
      expect(container.textContent).toContain("console.log('hello');");
    });

    // Write file through server-side service
    await panel.writeFile("src/new.ts", "export const x = 1;");
    expect(container.textContent).toContain("src/new.ts");

    // Delete file through server-side service
    await panel.deleteFile("src/new.ts");
    expect(container.textContent).not.toContain("src/new.ts");
  });

  it("operates files directly via WorkspaceFilesApi and WorkspaceFilesCapabilityV1 contract", async () => {
    const workspaceTree = vi.fn<WorkspaceFilesApi["workspaceTree"]>(() =>
      Promise.resolve({
        path: "",
        entries: [
          { name: "server.ts", path: "src/server.ts", type: "file" as const },
          { name: "package.json", path: "package.json", type: "file" as const },
        ],
        scannedAt: "2026-09-14",
        truncated: false,
      }),
    );
    const workspaceFile = vi.fn<WorkspaceFilesApi["workspaceFile"]>((_projectId, _workspaceId, path) =>
      Promise.resolve({
        path,
        content: "export const server = true;",
        encoding: "utf8" as const,
        size: 28,
        modifiedAt: "2026-09-14",
        truncated: false,
        binary: false,
      }),
    );
    const writeWorkspaceFile = vi.fn<WorkspaceFilesApi["writeWorkspaceFile"]>((_projectId, _workspaceId, path, content) => {
      const size = typeof content === "string" ? content.length : content.byteLength;
      return Promise.resolve({
        path,
        size,
        modifiedAt: "2026-09-14",
        created: true,
      });
    });
    const deleteWorkspaceFile = vi.fn<WorkspaceFilesApi["deleteWorkspaceFile"]>((_projectId, _workspaceId, path) =>
      Promise.resolve({
        path,
        existed: true,
      }),
    );
    const moveWorkspaceFile = vi.fn<WorkspaceFilesApi["moveWorkspaceFile"]>((_projectId, _workspaceId, fromPath, toPath) =>
      Promise.resolve({
        fromPath,
        toPath,
        size: 0,
        modifiedAt: "2026-09-14",
      }),
    );
    const apiMock: WorkspaceFilesApi = {
      workspaceTree,
      workspaceFile,
      writeWorkspaceFile,
      deleteWorkspaceFile,
      moveWorkspaceFile,
    };

    const panel = new FilesDockviewPanel({
      id: "files-api-test",
      context: workspaceA,
      api: apiMock,
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    panel.init(container);

    await panel.reload();

    expect(workspaceTree).toHaveBeenCalledWith(
      workspaceA.workspaceId,
      workspaceA.workspaceId,
      "",
      workspaceA.environmentId,
      undefined,
    );
    expect(container.textContent).toContain("src/server.ts");
    expect(container.textContent).toContain("package.json");

    panel.selectFile("src/server.ts");
    await vi.waitFor(() => {
      expect(workspaceFile).toHaveBeenCalledWith(
        workspaceA.workspaceId,
        workspaceA.workspaceId,
        "src/server.ts",
        workspaceA.environmentId,
        undefined,
      );
      expect(panel.getSelectedFileContent()).toBe("export const server = true;");
      expect(container.textContent).toContain("export const server = true;");
    });

    await panel.writeFile("src/server.ts", "export const server = false;");
    expect(writeWorkspaceFile).toHaveBeenCalled();

    await panel.deleteFile("src/server.ts");
    expect(deleteWorkspaceFile).toHaveBeenCalled();
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

  it("integrates seamlessly into DockviewWorkbench as the first-class Files panel", async () => {
    const hostContainer = document.createElement("div");
    document.body.appendChild(hostContainer);

    const workbench = new DockviewWorkbench({
      container: hostContainer,
      initialContext: workspaceA,
    });

    const filesPanel = workbench.addFilesPanel({
      id: "files-dockview-1",
      mode: "following",
      fileService: fileServiceMock,
    });

    expect(filesPanel.state.id).toBe("files-dockview-1");
    expect(filesPanel.state.type).toBe("files");
    expect(workbench.registry.getPanel("files-dockview-1")).toBeDefined();

    await filesPanel.reload();
    expect(filesPanel.getSelectedFile()).toBeUndefined();

    // Selecting file updates selection
    filesPanel.selectFile("package.json");
    expect(filesPanel.getSelectedFile()).toBe("package.json");

    // Updating workspace on workbench updates following files panel
    workbench.setWorkspace(workspaceB);
    expect(filesPanel.state.context.workspaceId).toBe("ws-b");

    workbench.dispose();
  });
});
