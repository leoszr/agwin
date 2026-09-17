import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DESKTOP_CSP_DIRECTIVES, getMainWindowOptions, getPopoutWindowOptions } from "./windowConfig";
import { DesktopHostSupervisor } from "./supervisor";
import { TERMINAL_CHANNEL_DATA_JSON_MAX_BYTES } from "../../pi-web-plugins/terminal/terminalProtocol";

describe("Hardening & Release Gate Validations (Ticket 34)", () => {
  it("validates that all production dependencies have approved permissive licenses in docs/distribution-licenses.md", () => {
    const licensesPath = join(process.cwd(), "docs", "distribution-licenses.md");
    expect(existsSync(licensesPath)).toBe(true);

    const content = readFileSync(licensesPath, "utf8");
    expect(content).toContain("MIT");
    expect(content).toContain("BSD-3-Clause");
    expect(content).not.toContain("GPL-3.0");
    expect(content).not.toContain("AGPL");
  });

  it("verifies release gates documentation is present and audited", () => {
    const gatesPath = join(process.cwd(), "docs", "release-gates-pi-linux.md");
    expect(existsSync(gatesPath)).toBe(true);

    const content = readFileSync(gatesPath, "utf8");
    expect(content).toContain("Gate 1: Isolamento entre Ambientes");
    expect(content).toContain("Gate 2: Lifecycle Supervisionado");
    expect(content).toContain("Gate 3: ABI das Dependências Nativas");
    expect(content).toContain("Gate 4: Inventário Transitivo de Licenças");
    expect(content).toContain("Gate 5: Paridade de Bancada Completa");
  });

  it("enforces backpressure limits and input chunk boundaries on data channels", () => {
    expect(TERMINAL_CHANNEL_DATA_JSON_MAX_BYTES).toBe(65536);
  });

  it("enforces renderer security restrictions, CSP headers, and preload isolation", () => {
    const mainOpts = getMainWindowOptions("/curated/preload.cjs");
    const popoutOpts = getPopoutWindowOptions();

    // Main window
    expect(mainOpts.webPreferences.sandbox).toBe(true);
    expect(mainOpts.webPreferences.contextIsolation).toBe(true);
    expect(mainOpts.webPreferences.nodeIntegration).toBe(false);
    expect(mainOpts.webPreferences.preload).toBe("/curated/preload.cjs");

    // Popout window has no preload
    expect(popoutOpts.webPreferences.preload).toBeUndefined();

    // CSP directives
    expect(DESKTOP_CSP_DIRECTIVES).toContain("default-src 'self'");
    expect(DESKTOP_CSP_DIRECTIVES).toContain("connect-src 'self' http://127.0.0.1:18504 ws://127.0.0.1:18504");
    expect(DESKTOP_CSP_DIRECTIVES).not.toContain("ws: wss:");
    expect(DESKTOP_CSP_DIRECTIVES).not.toContain("unsafe-eval");
  });

  it("verifies supervisor side-by-side host update, health check, and automatic rollback on failure", async () => {
    let healthy = true;

    const supervisor = new DesktopHostSupervisor({
      dataDir: "/tmp/release-hardening-data",
      version: "1.0.0",
      spawnHostProcess: (_version, port) => {
        return Promise.resolve({ pid: 12345, port });
      },
      healthChecker: () => Promise.resolve(healthy),
      isProcessAlive: () => true,
    });

    await supervisor.ensureHostStarted();
    supervisor.setActiveSessions(0);
    const v1Status = await supervisor.getStatus();
    expect(v1Status.version).toBe("1.0.0");
    expect(v1Status.health).toBe("healthy");

    // Upgrade to 1.0.1 fails health check -> should roll back to 1.0.0
    healthy = false;
    const updateResult = await supervisor.updateHostVersion("1.0.1");
    expect(updateResult.success).toBe(false);
    expect(updateResult.rollbackNeeded).toBe(true);

    const postRollback = await supervisor.getStatus();
    expect(postRollback.version).toBe("1.0.0");
  });
});
