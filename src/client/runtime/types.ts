import type {
  EnvironmentDescriptor,
  EnvironmentId,
  EnvironmentState,
  ProtocolError,
  ProtocolVersion,
} from "../../shared/protocol/contracts";

export interface SessionRef {
  id: string;
  cwd: string;
  path?: string | undefined;
  environmentId?: EnvironmentId | undefined;
}

export interface SessionSnapshot {
  sessionId: string;
  environmentId: EnvironmentId;
  status?: string | undefined;
  /** Size of the environment's full transcript, including entries outside this snapshot page. */
  messageCount: number;
  /** Committed projection content captured together with `seq`; events at or below `seq` are already reflected here. */
  messages: unknown[];
  seq: number;
  /** Index of `messages[0]` within the full transcript; 0 when the snapshot starts at the beginning. */
  pageStart?: number | undefined;
  /** In-flight partial captured together with `seq`, when the environment reports one. */
  partial?: unknown;
}

export interface EnvironmentProjection {
  environmentId: EnvironmentId;
  status: EnvironmentState;
  /** True when the connection works under a minor version difference or a missing non-blocking capability. */
  degraded: boolean;
  descriptor?: EnvironmentDescriptor | undefined;
  sessions: SessionRef[];
  /** Session whose snapshot the projection keeps current across reconnects. */
  activeSession?: SessionRef | undefined;
  snapshots: Map<string, SessionSnapshot>;
  error?: ProtocolError | undefined;
}

/** Connection state a client surface renders for one environment. */
export interface EnvironmentStatus {
  environmentId: EnvironmentId;
  state: EnvironmentState;
  degraded: boolean;
  error?: ProtocolError | undefined;
}

export interface EnvironmentConnectionOptions {
  environmentId: EnvironmentId;
  clientVersion?: ProtocolVersion | undefined;
  descriptorFetcher: (envId: EnvironmentId) => Promise<EnvironmentDescriptor>;
  sessionSnapshotFetcher?: ((envId: EnvironmentId, session: SessionRef) => Promise<SessionSnapshot>) | undefined;
}

/**
 * Capabilities this protocol version assumes for its core operations. A
 * connected environment that does not advertise them keeps working under a
 * declared degradation instead of failing mid-operation.
 */
export const REQUIRED_ENVIRONMENT_CAPABILITIES: readonly string[] = ["streaming", "transcriptSnapshot"];
