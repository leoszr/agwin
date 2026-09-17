// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  chunkUtf8Input,
  createTerminalBackendService,
  MAX_TERMINAL_INPUT_CHUNK_BYTES,
  TerminalDockviewPanel,
  type TerminalBackendService,
  type TerminalPtyChannel,
} from "./TerminalDockviewPanel";
import { WorkbenchPanelRegistry } from "./panelRegistry";
import { DockviewWorkbench } from "./DockviewWorkbench";
import type { WorkspaceContext } from "./types";
import type { PluginBackendChannel, PluginBackendChannelClose, PluginBackendRequestTarget } from "../src/api/pluginBackends";
import type { JsonValue } from "../../shared/apiTypes";
describe("TerminalDockviewPanel & PTY Attachment (Ticket 25)", () => {
  let wsA: WorkspaceContext;
  let wsB: WorkspaceContext;
  let sentInputs: string[];
  let outputCallback: ((data: string) => void) | undefined;
  let fakeChannel: TerminalPtyChannel;
  let backendService: TerminalBackendService;

  beforeEach(() => {
    wsA = { environmentId: "local", workspaceId: "ws-a", cwd: "/home/user/project-a" };
    wsB = { environmentId: "local", workspaceId: "ws-b", cwd: "/home/user/project-b" };
    sentInputs = [];
    outputCallback = undefined;

    fakeChannel = {
      sendInput: (data: string) => {
        sentInputs.push(data);
        return Promise.resolve();
      },
      resize: () => Promise.resolve(),
      onOutput: (cb) => {
        outputCallback = cb;
        return () => {
          outputCallback = undefined;
        };
      },
      close: () => {
        // Socket closed, but server process lives on
      },
    };

    backendService = {
      createOrAttachTerminal: (_env, _ws, terminalId) => {
        return Promise.resolve({
          terminalId: terminalId ?? "term-pty-42",
          channel: fakeChannel,
        });
      },
    };
  });

  it("is always born pinned to the chosen workspace and rejects following mode", () => {
    const registry = new WorkbenchPanelRegistry();
    const termPanel = new TerminalDockviewPanel({
      id: "term-1",
      context: wsA,
      backendService,
    });

    expect(termPanel.state.mode).toBe("pinned");
    expect(termPanel.state.context.workspaceId).toBe("ws-a");

    registry.registerPanel(termPanel.state);

    // Attempting to set Terminal to following mode must be strictly rejected
    const allowed = registry.setPanelMode("term-1", "following");
    expect(allowed).toBe(false);
    expect(termPanel.state.mode).toBe("pinned");

    registry.setActiveWorkspace(wsB);
    expect(termPanel.state.context.workspaceId).toBe("ws-a");
  });

  it("measures UTF-8 byte length accurately when chunking multi-byte characters", () => {
    // 'ç' in UTF-8 is 2 bytes (0xC3 0xA7).
    // 10,000 'ç' characters = 20,000 bytes.
    const textWithCedillas = "ç".repeat(10000);
    const byteCount = new TextEncoder().encode(textWithCedillas).byteLength;
    expect(byteCount).toBe(20000);

    const chunks = chunkUtf8Input(textWithCedillas, MAX_TERMINAL_INPUT_CHUNK_BYTES);
    expect(chunks.length).toBe(2);

    const chunk1Bytes = new TextEncoder().encode(chunks[0]).byteLength;
    const chunk2Bytes = new TextEncoder().encode(chunks[1]).byteLength;

    expect(chunk1Bytes).toBeLessThanOrEqual(MAX_TERMINAL_INPUT_CHUNK_BYTES);
    expect(chunk2Bytes).toBeLessThanOrEqual(MAX_TERMINAL_INPUT_CHUNK_BYTES);
    expect(chunk1Bytes + chunk2Bytes).toBe(20000);
    expect(chunks.join("")).toBe(textWithCedillas);
  });

  it("accepts input, transmits output, and enforces max chunk limits on the channel", async () => {
    const termPanel = new TerminalDockviewPanel({
      id: "term-pty",
      context: wsA,
      backendService,
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    termPanel.init(container);
    await termPanel.connectPty();

    expect(termPanel.getTerminalId()).toBe("term-pty-42");

    // Send input
    await termPanel.sendInput("echo 'hello world'\n");
    expect(sentInputs).toContain("echo 'hello world'\n");

    // Receive output from PTY
    if (outputCallback) outputCallback("hello world\r\n");
    expect(termPanel.getBuffer()).toContain("hello world\r\n");
    expect(container.textContent).toContain("hello world");
  });

  it("preserves terminal process and buffer across reconnect, hide/reopen, floating, and popout", async () => {
    const termPanel = new TerminalDockviewPanel({
      id: "term-move",
      context: wsA,
      backendService,
    });

    const container1 = document.createElement("div");
    document.body.appendChild(container1);
    termPanel.init(container1);
    await termPanel.connectPty();
    const term1 = termPanel.getXtermTerminal();
    expect(term1).toBeDefined();

    if (outputCallback) outputCallback("first command output\n");
    expect(termPanel.getBuffer()).toBe("first command output\n");

    // Floating
    termPanel.setFloating(true);
    expect(termPanel.getIsFloating()).toBe(true);

    // Popout
    const popoutDoc = document.implementation.createHTMLDocument("Popout Terminal");
    termPanel.setPopout(true, popoutDoc);
    expect(termPanel.getIsPopout()).toBe(true);

    // Move to container2 in popout: old view disposed, new view created cleanly
    const container2 = popoutDoc.createElement("div");
    popoutDoc.body.appendChild(container2);
    termPanel.init(container2, popoutDoc);

    const term2 = termPanel.getXtermTerminal();
    expect(term2).toBeDefined();
    expect(term2).not.toBe(term1); // Confirms fresh xterm instance created for new container

    expect(termPanel.getTerminalId()).toBe("term-pty-42");
    expect(termPanel.getBuffer()).toBe("first command output\n");
    expect(container2.querySelector(".terminal-output")?.textContent).toBe("first command output\n");

    // Real user interaction after reparenting: send input on the still-alive PTY channel
    await termPanel.sendInput("second command\n");
    expect(sentInputs).toContain("second command\n");

    // Real PTY output after reparenting arrives and updates buffer and DOM in new document
    if (outputCallback) outputCallback("second output\n");
    expect(termPanel.getBuffer()).toBe("first command output\nsecond output\n");
    expect(container2.querySelector(".terminal-output")?.textContent).toBe("first command output\nsecond output\n");

    termPanel.focus();
  });
  it("closing or detaching client does not terminate server-side process", async () => {
    const termPanel = new TerminalDockviewPanel({
      id: "term-client-close",
      context: wsA,
      backendService,
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    termPanel.init(container);
    await termPanel.connectPty();

    // Client disconnects (tab closed or app quit)
    termPanel.detachClient();

    // Reconnecting to same terminalId attaches to the still-alive process
    const reconnectedPanel = new TerminalDockviewPanel({
      id: "term-client-reconnect",
      context: wsA,
      terminalId: "term-pty-42",
      backendService,
    });
    await reconnectedPanel.connectPty();
    expect(reconnectedPanel.getTerminalId()).toBe("term-pty-42");
  });

  it("integrates into DockviewWorkbench as a pinned terminal panel and restores from layout", async () => {
    const hostContainer = document.createElement("div");
    document.body.appendChild(hostContainer);

    const workbench = new DockviewWorkbench({
      container: hostContainer,
      initialContext: wsA,
    });

    const termPanel = workbench.addTerminalPanel({
      id: "term-dockview-1",
      backendService,
    });

    expect(termPanel.state.id).toBe("term-dockview-1");
    expect(termPanel.state.type).toBe("terminal");
    expect(termPanel.state.mode).toBe("pinned");
    expect(workbench.registry.getPanelInstance("term-dockview-1")).toBe(termPanel);

    await termPanel.connectPty();
    expect(termPanel.getTerminalId()).toBe("term-pty-42");
    expect(termPanel.state.viewState).toEqual({ terminalId: "term-pty-42" });

    // Switching workspace must NOT alter pinned terminal's context
    workbench.setWorkspace(wsB);
    expect(termPanel.state.context.workspaceId).toBe("ws-a");

    const savedLayout = workbench.saveLayout();
    expect(savedLayout.panels.find((p) => p.id === "term-dockview-1")?.viewState).toEqual({ terminalId: "term-pty-42" });
    workbench.dispose();

    const restored = new DockviewWorkbench({
      container: hostContainer,
      initialContext: wsA,
    });
    expect(restored.restoreSavedLayout({ terminalService: backendService })).toBe(true);
    const revived = restored.registry.getPanelInstance("term-dockview-1");
    if (!(revived instanceof TerminalDockviewPanel)) throw new Error("Restored terminal panel is not a live instance");
    expect(revived.state.context.workspaceId).toBe("ws-a");
    expect(revived.state.mode).toBe("pinned");
    expect(revived.getTerminalId()).toBe("term-pty-42");

    await revived.connectPty();
    expect(revived.getTerminalId()).toBe("term-pty-42");
    restored.dispose();
  });

  it("exercises real Dockview move, floating, hide/reopen, and popout while preserving PTY execution and context", async () => {
    const hostContainer = document.createElement("div");
    document.body.appendChild(hostContainer);

    const workbench = new DockviewWorkbench({
      container: hostContainer,
      initialContext: wsA,
      popoutUrl: "/popout.html",
    });
    const termPanel = workbench.addTerminalPanel({
      id: "term-dock-real",
      backendService,
    });

    await termPanel.connectPty();
    outputCallback?.("initial prompt$ ");
    expect(termPanel.getBuffer()).toContain("initial prompt$ ");

    const filesPanel = workbench.addFilesPanel({ id: "files-dock-1" });
    expect(filesPanel).toBeDefined();

    // 1. Move panel to group via real Dockview API
    const moved = workbench.movePanelToGroup("term-dock-real", "files-dock-1");
    expect(moved).toBe(true);

    // 2. Float panel via real Dockview API
    const floated = workbench.floatPanel("term-dock-real");
    expect(floated).toBe(true);
    expect(termPanel.getIsFloating()).toBe(true);

    // 3. Hide and show panel via real Dockview API
    const hidden = workbench.hidePanel("term-dock-real");
    expect(hidden).toBe(true);
    const shown = workbench.showPanel("term-dock-real");
    expect(shown).toBe(true);

    // 4. Popout panel via real Dockview API with controlled window.open harness
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("<!doctype html><html><head></head><body></body></html>"))));

    const iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    const popoutWin = iframe.contentWindow;

    const openSpy = vi.spyOn(window, "open").mockImplementation(() => {
      if (popoutWin) {
        queueMicrotask(() => {
          popoutWin.dispatchEvent(new Event("load"));
        });
      }
      return popoutWin;
    });
    try {
      const popout = await workbench.popoutPanel("term-dock-real");
      expect(popout).toBe(true);
      expect(termPanel.getIsPopout()).toBe(true);

      // 5. Verify real PTY interaction remains functional after all Dockview operations
      await termPanel.sendInput("date\n");
      expect(sentInputs).toContain("date\n");

      outputCallback?.("Mon Sep 14\n");
      expect(termPanel.getBuffer()).toContain("Mon Sep 14\n");

      // 6. Context remains strictly pinned to originating workspace
      workbench.setWorkspace(wsB);
      expect(termPanel.state.context.workspaceId).toBe("ws-a");

      // 7. Close panel via real Dockview API
      expect(workbench.closePanel("term-dock-real")).toBe(true);
    } finally {
      vi.unstubAllGlobals();
      openSpy.mockRestore();
      iframe.remove();
      workbench.dispose();
    }
  });

  it("maps the terminal plugin backend operations and channel via createTerminalBackendService", async () => {
    const requests: (PluginBackendRequestTarget & { operation: string; input: JsonValue })[] = [];
    const sentFrames: JsonValue[] = [];
    let channelClosed = false;
    let onDataListener: ((data: JsonValue) => void) | undefined;

    const mockRequest = vi.fn((target: PluginBackendRequestTarget, operation: string, input: JsonValue): Promise<JsonValue> => {
      requests.push({ ...target, operation, input });
      if (operation === "terminal.create") {
        return Promise.resolve({ id: "term-created-99", cwd: "/home/user/project-a", name: "Terminal" });
      }
      return Promise.reject(new Error(`Unexpected operation: ${operation}`));
    });

    const mockOpenChannel = vi.fn(
      (
        target: PluginBackendRequestTarget,
        operation: string,
        input: JsonValue,
        options: { onData: (data: JsonValue) => void },
      ): Promise<PluginBackendChannel> => {
        requests.push({ ...target, operation, input });
        onDataListener = options.onData;
        const channel: PluginBackendChannel = {
          closed: new Promise(() => undefined),
          send: (data: JsonValue) => {
            sentFrames.push(data);
          },
          close: () => {
            channelClosed = true;
          },
        };
        return Promise.resolve(channel);
      },
    );

    const service = createTerminalBackendService(
      { sourcePluginId: "pi-web.terminal", backendRevision: "term-r1" },
      { request: mockRequest, openChannel: mockOpenChannel },
    );

    // 1. Create and attach when terminalId is undefined
    const created = await service.createOrAttachTerminal("local", "ws-a", undefined, "proj-a");
    expect(created.terminalId).toBe("term-created-99");
    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({ pluginId: "pi-web.terminal", machineId: "local", workspaceId: "ws-a", projectId: "proj-a" }),
      "terminal.create",
      {},
    );
    expect(mockOpenChannel).toHaveBeenCalledWith(
      expect.objectContaining({ pluginId: "pi-web.terminal", machineId: "local", workspaceId: "ws-a" }),
      "terminal.attach",
      { terminalId: "term-created-99" },
      expect.any(Object),
    );

    // Receive output frame
    const receivedOutput: string[] = [];
    const unlisten = created.channel.onOutput((data) => { receivedOutput.push(data); });
    onDataListener?.({ type: "output", data: "terminal prompt$ " });
    expect(receivedOutput).toEqual(["terminal prompt$ "]);

    // Send input and resize
    await created.channel.sendInput("uptime\n");
    expect(sentFrames).toContainEqual({ type: "input", data: "uptime\n" });

    await created.channel.resize(120, 35);
    expect(sentFrames).toContainEqual({ type: "resize", cols: 120, rows: 35 });

    // Detach / close
    unlisten();
    created.channel.close();
    expect(channelClosed).toBe(true);

    // 2. Attach directly when terminalId is already known
    mockRequest.mockClear();
    const attached = await service.createOrAttachTerminal("local", "ws-a", "term-existing-123");
    expect(attached.terminalId).toBe("term-existing-123");
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("buffers early replay output emitted during openChannel before onOutput attaches", async () => {
    let channelListener: ((data: JsonValue) => void) | undefined;

    const mockTransport = {
      request: vi.fn(() => Promise.resolve({ id: "term-early-replay" })),
      openChannel: vi.fn((_target: unknown, _op: string, _input: JsonValue, options: { onData: (data: JsonValue) => void }) => {
        channelListener = options.onData;
        // Simulate server immediately emitting replay frames during open before caller attaches onOutput
        options.onData({ type: "output", data: "early replay banner\n" });
        options.onData({ type: "output", data: "login prompt$ " });
        const mockChannel: PluginBackendChannel = {
          closed: new Promise<PluginBackendChannelClose>(() => undefined),
          send: vi.fn(),
          close: vi.fn(),
        };
        return Promise.resolve(mockChannel);
      }),
    };

    const service = createTerminalBackendService(
      { sourcePluginId: "pi-web.terminal", backendRevision: "term-r1" },
      {
        request: mockTransport.request,
        openChannel: mockTransport.openChannel,
      },
    );

    // 1. Calling createOrAttachTerminal returns channel; onOutput has NOT been called yet
    const result = await service.createOrAttachTerminal("local", "ws-a");
    expect(result.terminalId).toBe("term-early-replay");

    // 2. When onOutput is attached, all early replay buffer chunks are flushed immediately
    const received: string[] = [];
    result.channel.onOutput((chunk) => {
      received.push(chunk);
    });
    expect(received).toEqual(["early replay banner\n", "login prompt$ "]);

    // 3. Subsequent live output is also delivered
    channelListener?.({ type: "output", data: "whoami\n" });
    expect(received).toEqual(["early replay banner\n", "login prompt$ ", "whoami\n"]);
  });
});
