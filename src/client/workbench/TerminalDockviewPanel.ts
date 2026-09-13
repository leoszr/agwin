import type { PanelState, WorkspaceContext } from "./types";

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
  ): Promise<{ terminalId: string; channel: TerminalPtyChannel }>;
}

export interface TerminalPanelOptions {
  id: string;
  context: WorkspaceContext;
  terminalId?: string | undefined;
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

export class TerminalDockviewPanel {
  readonly state: PanelState;
  private element: HTMLElement | undefined;
  private mountedInDocument: Document | undefined;
  private channel?: TerminalPtyChannel | undefined;
  private terminalId?: string | undefined;
  private buffer = "";
  private isFloating = false;
  private isPopout = false;
  private removeOutputListener?: (() => void) | undefined;

  constructor(private readonly options: TerminalPanelOptions) {
    this.terminalId = options.terminalId;
    // Terminal panels are ALWAYS pinned to their originating workspace
    this.state = {
      id: options.id,
      type: "terminal",
      title: "Terminal",
      mode: "pinned",
      context: { ...options.context },
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
    if (!this.options.backendService) return;
    const { terminalId, channel } = await this.options.backendService.createOrAttachTerminal(
      this.state.context.environmentId,
      this.state.context.workspaceId,
      this.terminalId,
    );
    this.terminalId = terminalId;
    this.channel = channel;

    this.removeOutputListener = channel.onOutput((data) => {
      this.buffer += data;
      this.appendOutput(data);
    });
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
    this.element.innerHTML = "";

    const doc = this.mountedInDocument ?? document;
    const header = doc.createElement("div");
    header.className = "terminal-panel-header";
    header.textContent = `Terminal (${this.state.context.cwd}) [pinned]`;

    const termOutput = doc.createElement("pre");
    termOutput.className = "terminal-output";
    termOutput.tabIndex = 0;
    termOutput.textContent = this.buffer;

    this.element.appendChild(header);
    this.element.appendChild(termOutput);
  }

  private appendOutput(data: string): void {
    if (!this.element) return;
    const outputEl = this.element.querySelector(".terminal-output");
    if (outputEl) {
      outputEl.textContent += data;
    }
  }

  focus(): void {
    if (this.element) {
      const termOutput = this.element.querySelector<HTMLElement>(".terminal-output");
      termOutput?.focus();
    }
  }
}
