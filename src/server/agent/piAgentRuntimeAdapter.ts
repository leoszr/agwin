import type {
  AgentCommand,
  AgentModelCatalogEntry,
  AgentRuntime,
  AgentRuntimeDescriptor,
  AgentRuntimeEvent,
  AgentSessionInfo,
  CreateAgentSessionParams,
} from "./types";

export const PI_RUNTIME_DESCRIPTOR: AgentRuntimeDescriptor = {
  id: "pi",
  name: "Pi Coding Agent",
  version: "1.0.0",
  capabilities: {
    streaming: true,
    steer: true,
    followUp: true,
    abort: true,
    thinkingLevels: true,
    toolInteractions: true,
    attachments: true,
    trust: true,
  },
};

export interface PiUnderlyingService {
  startSession: (params?: { id?: string | undefined; cwd?: string | undefined }) => Promise<{ id: string }>;
  getSession: (id: string) => Promise<{ id: string; runtime?: string | undefined; status?: string | undefined } | undefined>;
  sendPrompt: (id: string, text: string, options?: unknown) => Promise<void>;
  steer: (id: string, text: string) => Promise<void>;
  followUp: (id: string, text: string) => Promise<void>;
  abort: (id: string) => Promise<void>;
  listModels: () => Promise<{ id: string; name: string; provider: string; thinking?: boolean | undefined }[]>;
  getThinkingLevels: () => Promise<string[]>;
  answerDialog?: ((id: string, dialogId: string, answer: unknown) => Promise<void>) | undefined;
}

export class PiAgentRuntimeAdapter implements AgentRuntime {
  readonly descriptor: AgentRuntimeDescriptor = PI_RUNTIME_DESCRIPTOR;
  private readonly sessions = new Map<string, AgentSessionInfo>();
  private readonly eventListeners = new Map<string, Set<(event: AgentRuntimeEvent) => void>>();

  constructor(private readonly service: PiUnderlyingService) {}

  async createSession(params?: CreateAgentSessionParams): Promise<AgentSessionInfo> {
    const startOpts: { id?: string | undefined; cwd?: string | undefined } = {};
    if (params?.sessionId !== undefined && params.sessionId.length > 0) startOpts.id = params.sessionId;
    if (params?.cwd !== undefined && params.cwd.length > 0) startOpts.cwd = params.cwd;

    const res = await this.service.startSession(startOpts);
    const id = res.id;

    const session: AgentSessionInfo = {
      id,
      runtimeId: "pi", // Registration of creator runtime
      createdAt: new Date().toISOString(),
      status: "idle",
      metadata: params?.metadata,
    };

    this.sessions.set(id, session);
    return session;
  }

  async resumeSession(sessionId: string): Promise<AgentSessionInfo> {
    let session = this.sessions.get(sessionId);
    if (session === undefined) {
      const underlying = await this.service.getSession(sessionId);
      if (underlying) {
        if (underlying.runtime !== undefined && underlying.runtime !== "pi") {
          throw new Error(
            `Cannot resume session '${sessionId}' created by runtime '${underlying.runtime}' with Pi adapter.`,
          );
        }
        session = {
          id: underlying.id,
          runtimeId: "pi",
          createdAt: new Date().toISOString(),
          status: (underlying.status === "idle" || underlying.status === "streaming" || underlying.status === "waiting" || underlying.status === "aborted" || underlying.status === "error") ? underlying.status : "idle",
        };
        this.sessions.set(sessionId, session);
      }
    }

    if (!session) {
      throw new Error(`Session '${sessionId}' not found.`);
    }

    if (session.runtimeId !== "pi") {
      throw new Error(
        `Incompatible runtime: session '${sessionId}' belongs to '${session.runtimeId}', not 'pi'.`,
      );
    }

    return session;
  }

  async getModelCatalog(): Promise<AgentModelCatalogEntry[]> {
    const models = await this.service.listModels();
    return models.map((m) => ({
      id: m.id,
      name: m.name,
      provider: m.provider,
      thinkingSupported: m.thinking,
    }));
  }

  async getThinkingLevels(): Promise<string[]> {
    return this.service.getThinkingLevels();
  }

  async submitCommand(sessionId: string, command: AgentCommand): Promise<void> {
    const session = await this.resumeSession(sessionId);

    switch (command.type) {
      case "prompt":
        session.status = "streaming";
        this.emit(sessionId, { type: "status", status: "streaming" });
        await this.service.sendPrompt(sessionId, command.text, {
          attachments: command.attachments,
          model: command.model,
          thinkingLevel: command.thinkingLevel,
        });
        break;

      case "steer":
        if (!this.descriptor.capabilities.steer) {
          throw new Error("Steering is not supported by this runtime capability configuration.");
        }
        await this.service.steer(sessionId, command.text);
        break;

      case "followUp":
        if (!this.descriptor.capabilities.followUp) {
          throw new Error("FollowUp is not supported by this runtime capability configuration.");
        }
        await this.service.followUp(sessionId, command.text);
        break;

      case "abort":
        await this.abort(sessionId);
        break;
    }
  }

  async abort(sessionId: string): Promise<void> {
    const session = await this.resumeSession(sessionId);
    session.status = "aborted";
    await this.service.abort(sessionId);
    this.emit(sessionId, { type: "status", status: "aborted" });
  }

  onEvent(sessionId: string, listener: (event: AgentRuntimeEvent) => void): () => void {
    let set = this.eventListeners.get(sessionId);
    if (!set) {
      set = new Set();
      this.eventListeners.set(sessionId, set);
    }
    set.add(listener);
    return () => {
      set.delete(listener);
    };
  }

  async respondInteraction(sessionId: string, interactionId: string, answer: unknown): Promise<void> {
    await this.resumeSession(sessionId);
    if (this.service.answerDialog !== undefined) {
      await this.service.answerDialog(sessionId, interactionId, answer);
    }
  }

  emit(sessionId: string, event: AgentRuntimeEvent): void {
    const set = this.eventListeners.get(sessionId);
    if (set) {
      for (const l of set) {
        l(event);
      }
    }
  }
}
