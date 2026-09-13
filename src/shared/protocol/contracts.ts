export interface ProtocolVersion {
  major: number;
  minor: number;
}

export const CURRENT_PROTOCOL_VERSION: Readonly<ProtocolVersion> = Object.freeze({
  major: 1,
  minor: 0,
});

export type EnvironmentId = string;
export type EnvironmentKind = "local" | "remote";
export type EnvironmentState = "connecting" | "connected" | "offline" | "blocked";

export interface EnvironmentCapabilities {
  streaming: boolean;
  replayCursor?: boolean | undefined;
  pty?: boolean | undefined;
  diff?: boolean | undefined;
  agentRuntime?: string | undefined;
  [key: string]: unknown;
}

export interface EnvironmentDescriptor {
  id: EnvironmentId;
  name: string;
  kind: EnvironmentKind;
  protocolVersion: ProtocolVersion;
  capabilities: EnvironmentCapabilities;
  status: EnvironmentState;
}

export interface CompatibilityResult {
  compatible: boolean;
  degraded: boolean;
  reason?: string | undefined;
}

export type ProtocolErrorCode =
  | "INCOMPATIBLE_VERSION"
  | "ENVIRONMENT_OFFLINE"
  | "ENVIRONMENT_BLOCKED"
  | "SESSION_NOT_FOUND"
  | "UNAUTHORIZED"
  | "PROTOCOL_VIOLATION";

export interface ProtocolError {
  code: ProtocolErrorCode;
  message: string;
  environmentId?: EnvironmentId | undefined;
  details?: unknown;
}

export function checkProtocolCompatibility(
  client: ProtocolVersion,
  server: ProtocolVersion,
): CompatibilityResult {
  if (client.major !== server.major) {
    return {
      compatible: false,
      degraded: false,
      reason: `Major version mismatch: client is ${String(client.major)}.${String(client.minor)}, server is ${String(server.major)}.${String(server.minor)}`,
    };
  }
  if (client.minor !== server.minor) {
    return {
      compatible: true,
      degraded: true,
      reason: `Minor version difference: client is ${String(client.major)}.${String(client.minor)}, server is ${String(server.major)}.${String(server.minor)}`,
    };
  }
  return {
    compatible: true,
    degraded: false,
  };
}

export function createProtocolError(
  code: ProtocolErrorCode,
  message: string,
  environmentId?: EnvironmentId,
  details?: unknown,
): ProtocolError {
  return { code, message, environmentId, details };
}
