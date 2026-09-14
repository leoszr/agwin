import { describe, expect, it } from "vitest";
import type { PiWebRuntimeResponse } from "../../shared/apiTypes.js";
import { CURRENT_PROTOCOL_VERSION } from "../../shared/protocol/contracts.js";
import { environmentCapabilitiesFromRuntime, LEGACY_PROTOCOL_VERSION, legacyEnvironmentDescriptor, localEnvironmentDescriptor } from "./environmentDescriptor.js";

function runtime(overrides: {
  sessiondAvailable?: boolean;
  sessiondPiVersion?: string | undefined;
} = {}): PiWebRuntimeResponse {
  const sessiond = {
    component: "sessiond" as const,
    label: "PI WEB Session Daemon",
    available: overrides.sessiondAvailable ?? true,
    capabilities: [],
    ...(overrides.sessiondPiVersion === undefined ? {} : { piVersion: overrides.sessiondPiVersion }),
  };
  return {
    packageName: "@jmfederico/pi-web",
    generatedAt: "2026-09-13T00:00:00.000Z",
    components: {
      web: { component: "web", label: "PI WEB", available: true, capabilities: [] },
      sessiond,
    },
    capabilities: [],
  };
}

describe("environment descriptor", () => {
  it("publishes the current protocol version and the capabilities the live runtime can honour", () => {
    const descriptor = localEnvironmentDescriptor(runtime({ sessiondPiVersion: "1.2.3" }));

    expect(descriptor).toEqual({
      id: "local",
      name: "Local",
      kind: "local",
      protocolVersion: CURRENT_PROTOCOL_VERSION,
      capabilities: { streaming: true, replayCursor: true, transcriptSnapshot: true, agentRuntime: "pi" },
      status: "connected",
    });
  });

  it("omits the agent runtime capability when the session daemon is unavailable or reports no Pi version", () => {
    expect(environmentCapabilitiesFromRuntime(runtime({ sessiondAvailable: false }))).toEqual({ streaming: true, replayCursor: true, transcriptSnapshot: true });
    expect(environmentCapabilitiesFromRuntime(runtime())).toEqual({ streaming: true, replayCursor: true, transcriptSnapshot: true });
    expect(environmentCapabilitiesFromRuntime(runtime({ sessiondPiVersion: "2.0.0" }))).toMatchObject({ agentRuntime: "pi" });
  });

  it("describes a server without a versioned descriptor as legacy instead of pretending it is current", () => {
    expect(legacyEnvironmentDescriptor({ id: "old-remote", name: "Old Remote" })).toEqual({
      id: "old-remote",
      name: "Old Remote",
      kind: "remote",
      protocolVersion: LEGACY_PROTOCOL_VERSION,
      capabilities: {},
      status: "offline",
    });
  });
});
