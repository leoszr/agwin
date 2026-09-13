export interface AgentRuntimeCapabilities {
  streaming: boolean;
  steer: boolean;
  followUp: boolean;
  abort: boolean;
  thinkingLevels: boolean;
  toolInteractions: boolean;
  attachments: boolean;
  trust: boolean;
  [key: string]: boolean;
}

export interface AgentRuntimeDescriptor {
  id: string; // "pi"
  name: string;
  version: string;
  capabilities: AgentRuntimeCapabilities;
}

export interface AgentModelCatalogEntry {
  id: string;
  name: string;
  provider: string;
  thinkingSupported?: boolean | undefined;
}

export interface AgentSessionInfo {
  id: string;
  runtimeId: string; // Non-portable invariant: bound to creator runtime
  createdAt: string;
  status: "idle" | "streaming" | "waiting" | "aborted" | "error";
  metadata?: Record<string, unknown> | undefined;
}

export type AgentCommand =
  | { type: "prompt"; text: string; attachments?: unknown[] | undefined; model?: string | undefined; thinkingLevel?: string | undefined }
  | { type: "steer"; text: string }
  | { type: "followUp"; text: string }
  | { type: "abort" };

export type AgentRuntimeEvent =
  | { type: "stream"; chunk: string }
  | { type: "status"; status: string }
  | { type: "toolCall"; toolName: string; callId: string; args: unknown }
  | { type: "interactionRequired"; interactionId: string; kind: string; prompt: string }
  | { type: "error"; message: string; fatal?: boolean | undefined }
  | { type: "complete" };

export interface CreateAgentSessionParams {
  sessionId?: string | undefined;
  cwd?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export interface AgentRuntime {
  readonly descriptor: AgentRuntimeDescriptor;
  createSession(params?: CreateAgentSessionParams): Promise<AgentSessionInfo>;
  resumeSession(sessionId: string): Promise<AgentSessionInfo>;
  getModelCatalog(): Promise<AgentModelCatalogEntry[]>;
  getThinkingLevels(): Promise<string[]>;
  submitCommand(sessionId: string, command: AgentCommand): Promise<void>;
  abort(sessionId: string): Promise<void>;
  onEvent(sessionId: string, listener: (event: AgentRuntimeEvent) => void): () => void;
  respondInteraction(sessionId: string, interactionId: string, answer: unknown): Promise<void>;
}
