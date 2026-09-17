import { Terminal, type ITerminalOptions } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import type { JsonValue } from "../../shared/apiTypes";
import type { PanelState, WorkspaceContext } from "./types";
import type { IWorkbenchPanelInstance } from "./panelRegistry";
import type { PairedWorkspaceBackendV1 } from "../src/plugins/types.js";
import {
  openPairedPluginBackendChannel,
  requestPairedPluginBackend,
  type PluginBackendRequestTarget,
} from "../src/api/pluginBackends";

export interface TerminalPtyChannel {
  sendInput(data: string): Promise<void>;
  resize(cols: number, rows: number): Promise<void>;
  onOutput(callback: (data: string) => void): () => void;
  close(): void;
}

export interface TerminalBackendService {
  createOrAttachTerminal(
    envId: string,
    workspaceId: string,
    terminalId?: string,
    projectId?: string,
  ): Promise<{ terminalId: string; channel: TerminalPtyChannel }>;
}

export interface TerminalPanelOptions {
  id: string;
  context: WorkspaceContext;
  terminalId?: string | undefined;
  viewState?: Record<string, unknown> | undefined;
  backendService?: TerminalBackendService | undefined;
}
export const MAX_TERMINAL_INPUT_CHUNK_BYTES = 16 * 1024; // 16KB channel boundary limit

export function chunkUtf8Input(text: string, maxBytes = MAX_TERMINAL_INPUT_CHUNK_BYTES): string[] {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(text);
  if (encoded.byteLength <= maxBytes) {
    return [text];
  }

  const chunks: string[] = [];
  let offset = 0;
  const decoder = new TextDecoder("utf-8");

  while (offset < encoded.byteLength) {
    let end = Math.min(offset + maxBytes, encoded.byteLength);
    if (end < encoded.byteLength) {
      // In UTF-8, continuation bytes match 10xxxxxx (0x80 to 0xBF)
      while (end > offset && ((encoded[end] ?? 0) & 0xc0) === 0x80) {
        end--;
      }
      if (end === offset) {
        end = Math.min(offset + maxBytes, encoded.byteLength);
      }
    }

    const chunkBytes = encoded.subarray(offset, end);
    chunks.push(decoder.decode(chunkBytes));
    offset = end;
  }

  return chunks;
}

export class TerminalDockviewPanel implements IWorkbenchPanelInstance {
  readonly state: PanelState;
  private element: HTMLElement | undefined;
  private mountedInDocument: Document | undefined;
  private channel?: TerminalPtyChannel | undefined;
  private terminalId?: string | undefined;
  private buffer = "";
  private isFloating = false;
  private isPopout = false;
  private removeOutputListener?: (() => void) | undefined;
  private terminal?: Terminal | undefined;
  private fitAddon?: FitAddon | undefined;
  private resizeObserver?: ResizeObserver | undefined;
  private termHost?: HTMLElement | undefined;
  constructor(private readonly options: TerminalPanelOptions) {
    const savedTermId = options.viewState !== undefined && typeof options.viewState["terminalId"] === "string"
      ? options.viewState["terminalId"]
      : undefined;
    this.terminalId = options.terminalId ?? savedTermId;
    // Terminal panels are ALWAYS pinned to their originating workspace
    this.state = {
      id: options.id,
      type: "terminal",
      title: "Terminal",
      mode: "pinned",
      context: { ...options.context },
      ...(this.terminalId !== undefined ? { viewState: { terminalId: this.terminalId } } : {}),
    };
  }

  getTerminalId(): string | undefined {
    return this.terminalId;
  }

  getBuffer(): string {
    return this.buffer;
  }

  setContext(): void {
    // Terminals are strictly bound to their creator workspace; context change is forbidden
  }

  init(container: HTMLElement, doc: Document = document): void {
    this.element = container;
    this.mountedInDocument = doc;
    this.render();
    if (this.channel === undefined) {
      void this.connectPty();
    }
  }

  async connectPty(): Promise<void> {
    const backendService = this.options.backendService;
    if (!backendService) return;
    const { terminalId, channel } = await backendService.createOrAttachTerminal(
      this.state.context.environmentId,
      this.state.context.workspaceId,
      this.terminalId,
      this.state.context.projectId,
    );
    this.terminalId = terminalId;
    this.state.viewState = { ...(this.state.viewState ?? {}), terminalId };
    this.channel = channel;
    this.removeOutputListener = channel.onOutput((data) => {
      this.buffer += data;
      this.appendOutput(data);
    });

    this.fitAndResize();
  }

  async sendInput(text: string): Promise<void> {
    if (this.channel === undefined) return;
    const chunks = chunkUtf8Input(text, MAX_TERMINAL_INPUT_CHUNK_BYTES);
    for (const chunk of chunks) {
      await this.channel.sendInput(chunk);
    }
  }

  setFloating(floating: boolean): void {
    this.isFloating = floating;
  }

  getIsFloating(): boolean {
    return this.isFloating;
  }

  setPopout(popout: boolean, targetDoc?: Document): void {
    this.isPopout = popout;
    if (targetDoc) {
      this.mountedInDocument = targetDoc;
    }
  }

  getIsPopout(): boolean {
    return this.isPopout;
  }

  detachClient(): void {
    if (this.removeOutputListener !== undefined) {
      this.removeOutputListener();
      delete this.removeOutputListener;
    }
    if (this.channel !== undefined) {
      this.channel.close();
      delete this.channel;
    }
  }

  render(): void {
    if (!this.element) return;
    this.disposeTerminalView();
    this.element.innerHTML = "";

    const doc = this.mountedInDocument ?? document;
    const header = doc.createElement("div");
    header.className = "terminal-panel-header";
    header.textContent = `Terminal (${this.state.context.cwd}) [pinned]`;

    const termHost = doc.createElement("div");
    termHost.className = "terminal-xterm-host";
    termHost.style.display = "flex";
    termHost.style.flexDirection = "column";
    termHost.style.flex = "1 1 auto";
    termHost.style.minHeight = "0";
    termHost.style.width = "100%";
    termHost.style.height = "100%";
    termHost.style.overflow = "hidden";
    this.termHost = termHost;

    const termOutput = doc.createElement("pre");
    termOutput.className = "terminal-output";
    termOutput.tabIndex = 0;
    termOutput.style.display = "none";
    termOutput.textContent = this.buffer;

    this.element.appendChild(header);
    this.element.appendChild(termHost);
    this.element.appendChild(termOutput);

    this.setupXterm(termHost);
  }

  private setupXterm(termHost: HTMLElement): void {
    const termOptions: ITerminalOptions = {
      cursorBlink: true,
      convertEol: true,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
      fontSize: 13,
      theme: {
        background: "#05070a",
        foreground: "#e6edf3",
        cursor: "#e6edf3",
        selectionBackground: "#264f78",
      },
    };
    const terminal = new Terminal(termOptions);
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    terminal.onData((data) => {
      void this.sendInput(data);
    });

    this.terminal = terminal;
    this.fitAddon = fitAddon;

    try {
      terminal.open(termHost);
      if (this.buffer.length > 0) {
        terminal.write(this.buffer);
      }
      if (typeof ResizeObserver !== "undefined") {
        this.resizeObserver = new ResizeObserver(() => {
          this.fitAndResize();
        });
        this.resizeObserver.observe(termHost);
      }
      this.fitAndResize();
    } catch {
      // In test or headless environments without full canvas, open handles gracefully
    }
  }

  disposeTerminalView(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    if (this.terminal) {
      try {
        this.terminal.dispose();
      } catch {
        // Safe disposal
      }
      this.terminal = undefined;
    }
    this.fitAddon = undefined;
    this.termHost = undefined;
  }

  fitAndResize(): void {
    if (!this.fitAddon || !this.terminal || !this.channel) return;
    try {
      this.fitAddon.fit();
      const cols = this.terminal.cols;
      const rows = this.terminal.rows;
      if (cols > 0 && rows > 0) {
        void this.channel.resize(cols, rows);
      }
    } catch {
      // FitAddon may throw if host has 0 dimensions
    }
  }

  getXtermTerminal(): Terminal | undefined {
    return this.terminal;
  }

  private appendOutput(data: string): void {
    if (this.terminal) {
      try {
        this.terminal.write(data);
      } catch {
        // Safe write fallback
      }
    }
    if (!this.element) return;
    const outputEl = this.element.querySelector(".terminal-output");
    if (outputEl) {
      outputEl.textContent += data;
    }
  }

  focus(): void {
    try {
      this.terminal?.focus();
    } catch {
      // Fallback
    }
    if (this.element) {
      const termOutput = this.element.querySelector<HTMLElement>(".terminal-output");
      termOutput?.focus();
    }
  }

  dispose(): void {
    this.disposeTerminalView();
    this.detachClient();
    this.element = undefined;
  }
}
export interface TerminalBackendTransport {
  request(operation: string, input: JsonValue): Promise<JsonValue>;
  openChannel(
    operation: string,
    input: JsonValue,
    options: { onData: (data: JsonValue) => void; signal?: AbortSignal },
  ): Promise<{ send(data: JsonValue): void; close(reason?: string): void }>;
}

export interface PairedBackendLike {
  request?: ((operation: string, input: JsonValue) => Promise<JsonValue>) | undefined;
  openChannel?: ((
    operation: string,
    input: JsonValue,
    options: { onData: (data: JsonValue) => void; signal?: AbortSignal },
  ) => Promise<{ send(data: JsonValue): void; close(reason?: string): void }>) | undefined;
}

export function createTerminalBackendServiceFromTransport(
  getTransport: (envId: string, workspaceId: string, projectId?: string) => TerminalBackendTransport,
): TerminalBackendService {
  return {
    async createOrAttachTerminal(envId, workspaceId, terminalId, projectId) {
      const transport = getTransport(envId, workspaceId, projectId);
      let activeTerminalId = terminalId;
      if (activeTerminalId === undefined || activeTerminalId === "") {
        const createRes = await transport.request("terminal.create", {});
        if (typeof createRes === "object" && createRes !== null && "id" in createRes && typeof createRes["id"] === "string") {
          activeTerminalId = createRes["id"];
        } else {
          throw new Error("Failed to create terminal: missing terminal id in response");
        }
      }

      const listeners = new Set<(data: string) => void>();
      const earlyReplayBuffer: string[] = [];
      let initialListenerAttached = false;

      const channel = await transport.openChannel(
        "terminal.attach",
        { terminalId: activeTerminalId },
        {
          onData(raw) {
            if (
              typeof raw === "object" &&
              raw !== null &&
              "type" in raw &&
              raw["type"] === "output" &&
              "data" in raw &&
              typeof raw["data"] === "string"
            ) {
              const text = raw["data"];
              if (!initialListenerAttached) {
                earlyReplayBuffer.push(text);
              } else {
                for (const listener of listeners) {
                  listener(text);
                }
              }
            }
          },
        },
      );

      const ptyChannel: TerminalPtyChannel = {
        sendInput(data: string): Promise<void> {
          channel.send({ type: "input", data });
          return Promise.resolve();
        },
        resize(cols: number, rows: number): Promise<void> {
          channel.send({ type: "resize", cols, rows });
          return Promise.resolve();
        },
        onOutput(callback: (data: string) => void) {
          listeners.add(callback);
          if (!initialListenerAttached) {
            initialListenerAttached = true;
            for (const chunk of earlyReplayBuffer) {
              callback(chunk);
            }
            earlyReplayBuffer.length = 0;
          }
          return () => {
            listeners.delete(callback);
          };
        },
        close() {
          channel.close();
        },
      };

      return {
        terminalId: activeTerminalId,
        channel: ptyChannel,
      };
    },
  };
}

export interface TerminalServiceBinding {
  sourcePluginId: string;
  backendRevision: string;
}

export function createTerminalBackendService(
  binding: TerminalServiceBinding,
  options?: {
    request?: (target: PluginBackendRequestTarget, operation: string, input: JsonValue) => Promise<JsonValue>;
    openChannel?: typeof openPairedPluginBackendChannel;
  },
): TerminalBackendService {
  const req = options?.request ?? requestPairedPluginBackend;
  const opener = options?.openChannel ?? openPairedPluginBackendChannel;
  return createTerminalBackendServiceFromTransport((envId, workspaceId, projectId) => {
    const target: PluginBackendRequestTarget = {
      pluginId: binding.sourcePluginId,
      backendRevision: binding.backendRevision,
      machineId: envId,
      projectId: projectId ?? workspaceId,
      workspaceId,
    };
    return {
      request: (op, inp) => req(target, op, inp),
      openChannel: (op, inp, channelOpts) => opener(target, op, inp, channelOpts),
    };
  });
}

export function createTerminalBackendServiceFromPairedBackend(
  pairedBackend: PairedWorkspaceBackendV1 | PairedBackendLike,
): TerminalBackendService {
  if (!pairedBackend.request || typeof pairedBackend.openChannel !== "function") {
    throw new Error("Terminal backend transport capabilities are unavailable");
  }
  const transport: TerminalBackendTransport = {
    request: (op, inp) => {
      if (!pairedBackend.request) throw new Error("Terminal request capability unavailable");
      return pairedBackend.request(op, inp);
    },
    openChannel: (op, inp, opts) => {
      if (!pairedBackend.openChannel) throw new Error("Terminal channel capability unavailable");
      return pairedBackend.openChannel(op, inp, opts);
    },
  };
  return createTerminalBackendServiceFromTransport(() => transport);
}
