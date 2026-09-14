import { describe, expect, it } from "vitest";
import {
  CURRENT_PROTOCOL_VERSION,
  checkProtocolCompatibility,
  createProtocolError,
} from "./contracts";

describe("Protocol contracts", () => {
  it("verifies exact match compatibility", () => {
    const res = checkProtocolCompatibility(CURRENT_PROTOCOL_VERSION, { ...CURRENT_PROTOCOL_VERSION });
    expect(res.compatible).toBe(true);
    expect(res.degraded).toBe(false);
  });

  it("detects minor version differences with degradation", () => {
    const res = checkProtocolCompatibility(CURRENT_PROTOCOL_VERSION, { major: 1, minor: 9 });
    expect(res.compatible).toBe(true);
    expect(res.degraded).toBe(true);
    expect(res.reason).toContain("Minor version difference");
  });

  it("blocks incompatible major versions", () => {
    const res = checkProtocolCompatibility(CURRENT_PROTOCOL_VERSION, { major: 2, minor: 0 });
    expect(res.compatible).toBe(false);
    expect(res.degraded).toBe(false);
    expect(res.reason).toContain("Major version mismatch");
  });

  it("creates structured protocol errors", () => {
    const err = createProtocolError("INCOMPATIBLE_VERSION", "Blocked", "remote-1", { version: 2 });
    expect(err.code).toBe("INCOMPATIBLE_VERSION");
    expect(err.environmentId).toBe("remote-1");
  });
});
