import type { PiWebRuntimeResponse } from "../../shared/apiTypes.js";
import {
  CURRENT_PROTOCOL_VERSION,
  type EnvironmentCapabilities,
  type EnvironmentDescriptor,
} from "../../shared/protocol/contracts.js";

/**
 * Version attributed to a PI WEB server that answers no versioned descriptor.
 * Older than every versioned client, so the major gate blocks the environment
 * instead of feeding it operations it cannot honour.
 */
export const LEGACY_PROTOCOL_VERSION = Object.freeze({ major: 0, minor: 0 });

/**
 * Capabilities this server can honour, derived from the live runtime facts:
 * sessions stream through the session event hub, its join snapshot carries the
 * replay watermark, the atomic transcript snapshot serves a coherent join, and
 * a Pi-capable session daemon is the agent runtime. Terminal and diff features
 * are intentionally not advertised here; nothing consumes those flags yet, so
 * claiming them would be unverified.
 */
export function environmentCapabilitiesFromRuntime(runtime: PiWebRuntimeResponse): EnvironmentCapabilities {
  const sessiond = runtime.components.sessiond;
  return {
    streaming: true,
    replayCursor: true,
    transcriptSnapshot: true,
    ...(sessiond.available && sessiond.piVersion !== undefined ? { agentRuntime: "pi" } : {}),
  };
}

export function localEnvironmentDescriptor(runtime: PiWebRuntimeResponse): EnvironmentDescriptor {
  return {
    id: "local",
    name: "Local",
    kind: "local",
    protocolVersion: CURRENT_PROTOCOL_VERSION,
    capabilities: environmentCapabilitiesFromRuntime(runtime),
    status: "connected",
  };
}

export function legacyEnvironmentDescriptor(machine: { id: string; name: string }): EnvironmentDescriptor {
  return {
    id: machine.id,
    name: machine.name,
    kind: "remote",
    protocolVersion: LEGACY_PROTOCOL_VERSION,
    capabilities: {},
    status: "offline",
  };
}
