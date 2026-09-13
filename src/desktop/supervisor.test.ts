import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DesktopHostSupervisor } from "./supervisor";

function createTestDir(): string {
  return mkdtempSync(join(tmpdir(), "pi-web-test-sup-"));
}

describe("DesktopHostSupervisor (Ticket 22)", () => {
  it("installs, starts, or finds the versioned host", async () => {
    const dataDir = createTestDir();
    try {
      let spawned = false;
      const supervisor = new DesktopHostSupervisor({
        dataDir,
        version: "1.0.0",
        port: 18504,
        spawnHostProcess: (_version, port) => {
          spawned = true;
          return Promise.resolve({ pid: 4242, port });
        },
        healthChecker: () => Promise.resolve(true),
        isProcessAlive: () => true,
      });

      const initialStatus = await supervisor.getStatus();
      expect(initialStatus.running).toBe(false);

      const startedStatus = await supervisor.ensureHostStarted();
      expect(spawned).toBe(true);
      expect(startedStatus.running).toBe(true);
      expect(startedStatus.pid).toBe(4242);
      expect(startedStatus.version).toBe("1.0.0");
      expect(startedStatus.health).toBe("healthy");
    } finally {
      rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it("defers host version update when active sessions are running", async () => {
    const dataDir = createTestDir();
    try {
      const supervisor = new DesktopHostSupervisor({
        dataDir,
        version: "1.0.0",
        healthChecker: () => Promise.resolve(true),
        isProcessAlive: () => true,
      });
      await supervisor.ensureHostStarted();
      supervisor.setActiveSessions(2);

      const updateRes = await supervisor.updateHostVersion("1.1.0");
      expect(updateRes.success).toBe(false);
      expect(updateRes.error).toContain("Cannot update host version while 2 active sessions are running");

      const status = await supervisor.getStatus();
      expect(status.version).toBe("1.0.0");
    } finally {
      rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it("keeps state and version consistent when spawnHostProcess fails during update", async () => {
    const dataDir = createTestDir();
    try {
      const supervisor = new DesktopHostSupervisor({
        dataDir,
        version: "1.0.0",
        spawnHostProcess: (version, port) => {
          if (version === "2.0.0") {
            return Promise.reject(new Error("Executable binary missing"));
          }
          return Promise.resolve({ pid: 5555, port });
        },
        healthChecker: () => Promise.resolve(true),
        isProcessAlive: () => true,
      });

      await supervisor.ensureHostStarted();
      supervisor.setActiveSessions(0);
      const beforeStatus = await supervisor.getStatus();
      expect(beforeStatus.version).toBe("1.0.0");
      expect(beforeStatus.pid).toBe(5555);

      // Attempt update that fails to spawn
      const updateRes = await supervisor.updateHostVersion("2.0.0");
      expect(updateRes.success).toBe(false);
      expect(updateRes.error).toContain("Executable binary missing");

      // Version must NOT have changed to 2.0.0!
      const afterStatus = await supervisor.getStatus();
      expect(afterStatus.version).toBe("1.0.0");
      expect(afterStatus.pid).toBe(5555);
    } finally {
      rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it("rolls back to previous version if new version fails health check", async () => {
    const dataDir = createTestDir();
    try {
      let healthState = true;
      const supervisor = new DesktopHostSupervisor({
        dataDir,
        version: "1.0.0",
        spawnHostProcess: (_v, port) => Promise.resolve({ pid: 7777, port }),
        healthChecker: () => Promise.resolve(healthState),
        isProcessAlive: () => true,
      });
      await supervisor.ensureHostStarted();
      supervisor.setActiveSessions(0);

      // Now update to 1.1.0, but health check fails
      healthState = false;
      const updateRes = await supervisor.updateHostVersion("1.1.0");
      expect(updateRes.success).toBe(false);
      expect(updateRes.rollbackNeeded).toBe(true);

      const status = await supervisor.getStatus();
      expect(status.version).toBe("1.0.0");
    } finally {
      rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it("fails closed when the session count is unknown", async () => {
    const dataDir = createTestDir();
    try {
      const supervisor = new DesktopHostSupervisor({
        dataDir,
        version: "1.0.0",
        port: 18999,
        spawnHostProcess: (_v, port) => Promise.resolve({ pid: 4242, port }),
        healthChecker: () => Promise.resolve(true),
        isProcessAlive: () => true,
      });
      await supervisor.ensureHostStarted();
      // No mock count and nothing listening on 18999 -> count unknown.
      const status = await supervisor.getStatus();
      expect(status.activeSessionsUnknown).toBe(true);
      const stopRes = await supervisor.stop();
      expect(stopRes.stopped).toBe(false);
      const updateRes = await supervisor.updateHostVersion("9.9.9");
      expect(updateRes.success).toBe(false);
    } finally {
      rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it("closing or restarting renderer does not stop host process", async () => {
    const dataDir = createTestDir();
    try {
      const supervisor = new DesktopHostSupervisor({
        dataDir,
        version: "1.0.0",
        spawnHostProcess: (_v, port) => Promise.resolve({ pid: 9999, port }),
        healthChecker: () => Promise.resolve(true),
        isProcessAlive: () => true,
      });
      await supervisor.ensureHostStarted();

      const status = await supervisor.getStatus();
      expect(status.running).toBe(true);
      expect(status.pid).toBe(9999);
    } finally {
      rmSync(dataDir, { recursive: true, force: true });
    }
  });
});
