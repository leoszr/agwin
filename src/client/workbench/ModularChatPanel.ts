import type { PanelState, WorkspaceContext } from "./types";
import type { Thread } from "../domain/thread";
import type { AgentCommand, AgentRuntime } from "../../server/agent/types";

export interface ChatMessageEntry {
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls?: { name: string; args: unknown }[] | undefined;
  attachments?: unknown[] | undefined;
}

export interface ModularChatPanelOptions {
  id: string;
  context: WorkspaceContext;
  runtime?: AgentRuntime | undefined;
  draftStorage?: {
    loadDraft: (threadId: string) => string | undefined;
    saveDraft: (threadId: string, text: string) => void;
  } | undefined;
}

export class ModularChatPanel {
  readonly state: PanelState;
  private element: HTMLElement | undefined;
  private mountedInDocument: Document | undefined;
  private activeThread?: Thread | undefined;
  private activeSessionId?: string | undefined;
  private transcript: ChatMessageEntry[] = [];
  private composerDraft = "";

  constructor(private readonly options: ModularChatPanelOptions) {
    this.state = {
      id: options.id,
      type: "chat",
      title: "Chat",
      mode: "following",
      context: { ...options.context },
    };
  }

  getActiveThreadId(): string | undefined {
    return this.activeThread?.id;
  }

  getActiveSessionId(): string | undefined {
    return this.activeSessionId;
  }

  getTranscript(): ChatMessageEntry[] {
    return this.transcript;
  }

  setContext(context: { environmentId: string; workspaceId: string; cwd: string }): void {
    this.state.context = { ...this.state.context, ...context };
  }

  getComposerDraft(): string {
    return this.composerDraft;
  }

  setComposerDraft(text: string): void {
    this.composerDraft = text;
    this.state.isUnsafeDirty = text.trim().length > 0;
    if (this.activeThread !== undefined && this.options.draftStorage !== undefined) {
      this.options.draftStorage.saveDraft(this.activeThread.id, text);
    }
  }

  attachThread(thread: Thread, initialTranscript: ChatMessageEntry[] = []): void {
    const switchingThreads = this.activeThread !== undefined && this.activeThread.id !== thread.id;
    const wasDirty = this.state.isUnsafeDirty === true;
    // Preserve current draft if switching threads
    if (switchingThreads && this.activeThread !== undefined && this.composerDraft.length > 0) {
      this.options.draftStorage?.saveDraft(this.activeThread.id, this.composerDraft);
    }

    this.activeThread = thread;
    this.activeSessionId = thread.sessionId;
    // Sincroniza a identidade completa da thread (issue 08). Thread nao carrega cwd;
    // deriva como em ModularWorkbenchApp.selectThread para nao deixar cwd/projectId obsoletos.
    this.state.context = {
      environmentId: thread.environmentId,
      projectId: thread.projectId,
      workspaceId: thread.workspaceId,
      cwd: `/repos/${thread.workspaceId}`,
    };
    // Troca insegura fixa o painel no novo contexto: proximos follows nao o arrancam da thread.
    if (switchingThreads && wasDirty) this.state.mode = "pinned";
    this.transcript = [...initialTranscript];

    // Restore draft for new thread if any
    const savedDraft = this.options.draftStorage?.loadDraft(thread.id);
    this.composerDraft = savedDraft ?? "";
    this.state.isUnsafeDirty = this.composerDraft.trim().length > 0;

    this.render();
  }

  async sendPrompt(text: string, options?: { model?: string | undefined; attachments?: unknown[] | undefined; thinkingLevel?: string | undefined }): Promise<void> {
    if (this.activeSessionId === undefined) throw new Error("No active session attached to Chat");

    const message: ChatMessageEntry = {
      role: "user",
      content: text,
      attachments: options?.attachments,
    };
    const prevDraft = this.composerDraft;
    const optimisticIndex = this.transcript.length;
    this.transcript.push(message);

    // Clear composer optimistically; restore on submit failure below.
    this.composerDraft = "";
    this.state.isUnsafeDirty = false;
    if (this.activeThread !== undefined && this.options.draftStorage !== undefined) {
      this.options.draftStorage.saveDraft(this.activeThread.id, "");
    }

    this.render();

    if (this.options.runtime !== undefined) {
      const cmd: AgentCommand = {
        type: "prompt",
        text,
        model: options?.model,
        attachments: options?.attachments,
        thinkingLevel: options?.thinkingLevel,
      };
      try {
        await this.options.runtime.submitCommand(this.activeSessionId, cmd);
      } catch (err) {
        // Submit rejected: remove optimistic message and restore draft.
        this.transcript.splice(optimisticIndex, 1);
        this.composerDraft = text.length > 0 ? text : prevDraft;
        this.state.isUnsafeDirty = this.composerDraft.trim().length > 0;
        if (this.activeThread !== undefined && this.options.draftStorage !== undefined) {
          this.options.draftStorage.saveDraft(this.activeThread.id, this.composerDraft);
        }
        this.render();
        throw err;
      }
    }
  }

  async steer(text: string): Promise<void> {
    if (this.activeSessionId === undefined) throw new Error("No active session");
    if (this.options.runtime !== undefined) {
      await this.options.runtime.submitCommand(this.activeSessionId, { type: "steer", text });
    }
    this.transcript.push({ role: "user", content: `[Steer] ${text}` });
    this.render();
  }

  async followUp(text: string): Promise<void> {
    if (this.activeSessionId === undefined) throw new Error("No active session");
    if (this.options.runtime !== undefined) {
      await this.options.runtime.submitCommand(this.activeSessionId, { type: "followUp", text });
    }
    this.transcript.push({ role: "user", content: `[Follow-up] ${text}` });
    this.render();
  }

  async abort(): Promise<void> {
    if (this.activeSessionId === undefined) return;
    if (this.options.runtime !== undefined) {
      await this.options.runtime.abort(this.activeSessionId);
    }
    this.render();
  }

  applyReconnectionSnapshot(snapshotMessages: ChatMessageEntry[]): void {
    // Replay/merge snapshot after reconnect
    this.transcript = [...snapshotMessages];
    this.render();
  }

  appendAssistantChunk(chunk: string): void {
    const last = this.transcript[this.transcript.length - 1];
    if (last?.role === "assistant") {
      last.content += chunk;
    } else {
      this.transcript.push({ role: "assistant", content: chunk });
    }
    this.render();
  }

  init(container: HTMLElement, doc: Document = document): void {
    this.element = container;
    this.mountedInDocument = doc;
    this.render();
  }

  render(): void {
    if (!this.element) return;
    // Preserve composer focus/selection and transcript scroll: render() rebuilds DOM.
    const prevInput = this.element.querySelector<HTMLTextAreaElement>(".chat-input");
    const hadFocus = prevInput !== null && this.mountedInDocument?.activeElement === prevInput;
    const selStart = prevInput?.selectionStart ?? null;
    const selEnd = prevInput?.selectionEnd ?? null;
    const prevScroll = this.element.querySelector(".chat-transcript")?.scrollTop ?? null;
    this.element.innerHTML = "";

    const doc = this.mountedInDocument ?? document;
    const header = doc.createElement("div");
    header.className = "chat-header";
    header.textContent = this.activeThread !== undefined
      ? `Chat: ${this.activeThread.title} (${this.activeThread.workspaceId})`
      : "Chat: Nenhuma thread selecionada";

    const transcriptEl = doc.createElement("div");
    transcriptEl.className = "chat-transcript";
    transcriptEl.setAttribute("role", "log");
    transcriptEl.setAttribute("aria-live", "polite");

    for (const msg of this.transcript) {
      const msgItem = doc.createElement("div");
      msgItem.className = `chat-message message-${msg.role}`;
      msgItem.textContent = `${msg.role === "user" ? "You" : "Assistant"}: ${msg.content}`;
      transcriptEl.appendChild(msgItem);
    }

    const composerEl = doc.createElement("div");
    composerEl.className = "chat-composer";

    const input = doc.createElement("textarea");
    input.className = "chat-input";
    input.value = this.composerDraft;
    input.placeholder = "Envie uma mensagem...";
    input.oninput = () => {
      this.setComposerDraft(input.value);
    };

    const sendBtn = doc.createElement("button");
    sendBtn.className = "btn-send-prompt";
    sendBtn.textContent = "Enviar";
    sendBtn.onclick = () => { void this.sendPrompt(input.value); };

    const abortBtn = doc.createElement("button");
    abortBtn.className = "btn-abort";
    abortBtn.textContent = "Parar";
    abortBtn.onclick = () => { void this.abort(); };

    composerEl.appendChild(input);
    composerEl.appendChild(sendBtn);
    composerEl.appendChild(abortBtn);

    this.element.appendChild(header);
    this.element.appendChild(transcriptEl);
    this.element.appendChild(composerEl);
    if (prevScroll !== null) {
      transcriptEl.scrollTop = prevScroll;
    }
    if (hadFocus) {
      const nextInput = this.element.querySelector<HTMLTextAreaElement>(".chat-input");
      nextInput?.focus();
      if (nextInput !== null && selStart !== null && selEnd !== null) {
        try { nextInput.setSelectionRange(selStart, selEnd); } catch { /* noop */ }
      }
    }
  }

  focus(): void {
    if (this.element) {
      const input = this.element.querySelector<HTMLTextAreaElement>("textarea");
      input?.focus();
    }
  }
}
