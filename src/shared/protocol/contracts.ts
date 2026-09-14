export interface ProtocolVersion {
  major: number;
  minor: number;
}

export const CURRENT_PROTOCOL_VERSION: Readonly<ProtocolVersion> = Object.freeze({
  major: 1,
  // 1.1 adds the atomic transcript snapshot (`transcriptSnapshot` capability).
  minor: 1,
});

export type EnvironmentId = string;
export type EnvironmentKind = "local" | "remote";
export type EnvironmentState = "connecting" | "connected" | "offline" | "blocked";

export interface EnvironmentCapabilities {
  /** Optional on the wire: an older environment may not declare streaming support at all. */
  streaming?: boolean | undefined;
  replayCursor?: boolean | undefined;
  /** Atomic join snapshot: committed page, stream watermark, and partial in one read. */
  transcriptSnapshot?: boolean | undefined;
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

const ENVIRONMENT_KINDS: readonly EnvironmentKind[] = ["local", "remote"];
const ENVIRONMENT_STATES: readonly EnvironmentState[] = ["connecting", "connected", "offline", "blocked"];

/**
 * Validate a descriptor crossing the wire. Unknown fields are ignored so a
 * newer server can add data without breaking an older client, but every field
 * this protocol version relies on must be well formed.
 */
export function parseEnvironmentDescriptor(value: unknown): EnvironmentDescriptor {
  if (!isRecord(value)) throw new Error("Environment descriptor must be an object");
  return {
    id: requireString(value["id"], "id"),
    name: requireString(value["name"], "name"),
    kind: requireOneOf(value["kind"], ENVIRONMENT_KINDS, "kind"),
    protocolVersion: parseProtocolVersion(value["protocolVersion"]),
    capabilities: parseEnvironmentCapabilities(value["capabilities"]),
    status: requireOneOf(value["status"], ENVIRONMENT_STATES, "status"),
  };
}

export function parseProtocolVersion(value: unknown): ProtocolVersion {
  if (!isRecord(value)) throw new Error("Protocol version must be an object");
  return {
    major: requireNumber(value["major"], "protocolVersion.major"),
    minor: requireNumber(value["minor"], "protocolVersion.minor"),
  };
}

export function parseEnvironmentCapabilities(value: unknown): EnvironmentCapabilities {
  if (!isRecord(value)) throw new Error("Environment capabilities must be an object");
  const capabilities: EnvironmentCapabilities = {};
  for (const key of ["streaming", "replayCursor", "transcriptSnapshot", "pty", "diff"] as const) {
    const entry = value[key];
    if (entry !== undefined) capabilities[key] = requireBoolean(entry, `capabilities.${key}`);
  }
  const agentRuntime = value["agentRuntime"];
  if (agentRuntime !== undefined) capabilities.agentRuntime = requireString(agentRuntime, "capabilities.agentRuntime");
  return capabilities;
}

/** Capabilities this descriptor does not advertise as enabled. */
export function missingEnvironmentCapabilities(
  capabilities: EnvironmentCapabilities | undefined,
  required: readonly string[],
): string[] {
  return required.filter((capability) => capabilities?.[capability] !== true);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value === "") throw new Error(`Environment descriptor ${field} must be a non-empty string`);
  return value;
}

function requireNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`Environment descriptor ${field} must be a number`);
  return value;
}

function requireBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") throw new Error(`Environment descriptor ${field} must be a boolean`);
  return value;
}

function requireOneOf<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  const match = typeof value === "string" ? allowed.find((candidate) => candidate === value) : undefined;
  if (match === undefined) throw new Error(`Environment descriptor ${field} must be one of: ${allowed.join(", ")}`);
  return match;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
