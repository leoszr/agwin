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
  messageCount: number;
  messages: unknown[];
  seq: number;
}

export interface EnvironmentProjection {
  environmentId: EnvironmentId;
  status: EnvironmentState;
  descriptor?: EnvironmentDescriptor | undefined;
  sessions: SessionRef[];
  activeSessionId?: string | undefined;
  snapshots: Map<string, SessionSnapshot>;
  error?: ProtocolError | undefined;
}

export interface EnvironmentConnectionOptions {
  environmentId: EnvironmentId;
  clientVersion?: ProtocolVersion | undefined;
  descriptorFetcher: (envId: EnvironmentId) => Promise<EnvironmentDescriptor>;
  sessionSnapshotFetcher?: ((envId: EnvironmentId, sessionId: string) => Promise<SessionSnapshot>) | undefined;
  socketFactory?: ((envId: EnvironmentId) => unknown) | undefined;
}
