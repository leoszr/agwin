// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ModularWorkbenchApp } from "./ModularWorkbenchApp";
import { ClientRuntime } from "../runtime/ClientRuntime";
import { CURRENT_PROTOCOL_VERSION } from "../../shared/protocol/contracts";
import type { WorkspaceFilesApi } from "../src/plugins/workspaceFiles";
import type { WorkspaceContext } from "./types";
import type { Thread } from "../domain/thread";

describe("ModularWorkbenchApp Integration & Legacy Path Cut (Ticket 33)", () => {
  let container: HTMLElement;
  let clientRuntime: ClientRuntime;
  let initialWs: WorkspaceContext;
  let testThread: Thread;
  let fakeFilesApi: WorkspaceFilesApi;
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);

    initialWs = { environmentId: "local", workspaceId: "ws-primary", cwd: "/repo/main" };
    testThread = {
      id: "thread-1",
      sessionId: "session-1",
      workspaceId: "ws-primary",
      projectId: "proj-1",
      environmentId: "local",
      title: "Main Development Thread",
      state: "running",
      createdAt: "now",
    };

    clientRuntime = new ClientRuntime({
      catalogFetcher: () => Promise.resolve([{ id: "local", name: "Local Machine" }]),
      descriptorFetcher: () => Promise.resolve({
        id: "local",
        name: "Local Machine",
        kind: "local",
        protocolVersion: CURRENT_PROTOCOL_VERSION,
        capabilities: { streaming: true, pty: true },
        status: "connected",
      }),
    });

    fakeFilesApi = {
      workspaceTree: vi.fn(() => Promise.resolve({ path: "", entries: [{ name: "index.ts", path: "src/index.ts", type: "file" as const }], scannedAt: "", truncated: false })),
      workspaceFile: vi.fn(() => Promise.resolve({ path: "src/index.ts", content: "console.log('hi');", encoding: "utf8" as const, size: 18, modifiedAt: "", truncated: false, binary: false })),
      writeWorkspaceFile: vi.fn(() => Promise.resolve({ path: "src/index.ts", size: 18, modifiedAt: "", created: true })),
      deleteWorkspaceFile: vi.fn(() => Promise.resolve({ path: "src/index.ts", existed: true })),
      moveWorkspaceFile: vi.fn(() => Promise.resolve({ fromPath: "", toPath: "", size: 0, modifiedAt: "" })),
    };
  });

  afterEach(() => {
    document.body.replaceChildren();
    localStorage.clear();
  });

  it("composes Explorer, Chat, and demand panels into a single cohesive control surface", async () => {
    await clientRuntime.loadCatalog();

    const app = new ModularWorkbenchApp({
      container,
      runtime: clientRuntime,
      initialWorkspace: initialWs,
      projects: [{ id: "proj-1", name: "Main Project", environmentId: "local" }],
      threads: [testThread],
      api: fakeFilesApi,
    });

    // Explorer and Chat initialized
    expect(container.querySelector(".project-explorer")).toBeDefined();
    expect(container.querySelector(".chat-composer")).toBeDefined();
    expect(app.chat.getActiveSessionId()).toBe("session-1");

    // Open Files panel
    const files = app.openFilesPanel("files-panel-1");
    expect(files.state.type).toBe("files");
    expect(app.registry.getPanel("files-panel-1")).toBeDefined();

    // Open Diff panel
    const diff = app.openDiffPanel("diff-panel-1");
    expect(diff.state.type).toBe("diff");
    expect(app.registry.getPanel("diff-panel-1")).toBeDefined();

    // Open Terminal panel
    const terminal = app.openTerminalPanel("terminal-panel-1");
    expect(terminal.state.type).toBe("terminal");
    expect(terminal.state.mode).toBe("pinned");

    // Switch thread updates following panels without retargeting pinned terminal
    const secondThread: Thread = {
      id: "thread-2",
      sessionId: "session-2",
      workspaceId: "ws-secondary",
      projectId: "proj-1",
      environmentId: "local",
      title: "Second Task",
      state: "running",
      createdAt: "now",
    };
    app.selectThread(secondThread);

    expect(app.chat.getActiveSessionId()).toBe("session-2");
    expect(files.state.context.workspaceId).toBe("ws-secondary");
    // Terminal remains pinned to ws-primary!
    expect(terminal.state.context.workspaceId).toBe("ws-primary");
  });

  it("serializes layout safely and restores configuration without deleting execution state", () => {
    const app = new ModularWorkbenchApp({
      container,
      runtime: clientRuntime,
      initialWorkspace: initialWs,
      projects: [{ id: "proj-1", name: "Main Project", environmentId: "local" }],
      threads: [testThread],
      api: fakeFilesApi,
    });

    app.openFilesPanel("files-saved");
    const savedLayout = app.saveLayout();

    expect(savedLayout).toContain("files-saved");
    expect(savedLayout).not.toContain("password");
    expect(savedLayout).not.toContain("token");
  });

  it("registers accessible shortcuts and routes moveToNextGroup to the workbench", () => {
    const app = new ModularWorkbenchApp({
      container,
      runtime: clientRuntime,
      initialWorkspace: initialWs,
      projects: [{ id: "proj-1", name: "Main Project", environmentId: "local" }],
      threads: [testThread],
      api: fakeFilesApi,
    });

    // Alt+2 foca o chat via controller conectado a composicao.
    const handled = app.handleAccessibleKeyDown(new KeyboardEvent("keydown", { key: "2", altKey: true }));
    expect(handled).toBe(true);
    expect(document.activeElement?.className).toContain("chat-input");

    // moveToNextGroup chega ao DockviewWorkbench em vez de sucesso silencioso.
    let movedId: string | undefined;
    const handlers = app.getAccessiblePanelHandlers({ moveToNextGroup: (id: string) => { movedId = id; } });
    const result = app.accessibleController.executePanelAction(
      { panelId: "chat-main", type: "chat", title: "Chat", isFloating: false, isPopout: false },
      "moveToNextGroup",
      handlers,
    );
    expect(result.success).toBe(true);
    expect(movedId).toBe("chat-main");

    app.dispose();
  });

  it("routes the workspace diff service into opened diff panels", async () => {
    const getChangedFiles = vi.fn(() => Promise.resolve([]));
    const app = new ModularWorkbenchApp({
      container,
      runtime: clientRuntime,
      initialWorkspace: initialWs,
      projects: [{ id: "proj-1", name: "Main Project", environmentId: "local" }],
      threads: [testThread],
      diffService: { getChangedFiles, getFileDiff: vi.fn() },
    });

    const diff = app.openDiffPanel("diff-wired");
    await diff.reload();

    expect(getChangedFiles).toHaveBeenCalledWith("local", "ws-primary", "proj-1");
    app.dispose();
  });
});
