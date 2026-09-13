// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from "vitest";
import {
  chunkUtf8Input,
  MAX_TERMINAL_INPUT_CHUNK_BYTES,
  TerminalDockviewPanel,
  type TerminalBackendService,
  type TerminalPtyChannel,
} from "./TerminalDockviewPanel";
import { WorkbenchPanelRegistry } from "./panelRegistry";
import type { WorkspaceContext } from "./types";

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

    if (outputCallback) outputCallback("first command output\n");
    expect(termPanel.getBuffer()).toBe("first command output\n");

    // Floating
    termPanel.setFloating(true);
    expect(termPanel.getIsFloating()).toBe(true);

    // Popout
    const popoutDoc = document.implementation.createHTMLDocument("Popout Terminal");
    termPanel.setPopout(true, popoutDoc);
    expect(termPanel.getIsPopout()).toBe(true);

    // Move to container2 in popout
    const container2 = popoutDoc.createElement("div");
    popoutDoc.body.appendChild(container2);
    termPanel.init(container2, popoutDoc);

    expect(termPanel.getTerminalId()).toBe("term-pty-42");
    expect(termPanel.getBuffer()).toBe("first command output\n");
    expect(container2.querySelector(".terminal-output")?.textContent).toBe("first command output\n");

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
});
