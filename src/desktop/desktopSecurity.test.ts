import { describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getDesktopCsp,
  getMainWindowOptions,
  getPopoutWindowOptions,
  validateExternalUrl,
} from "./windowConfig";
import { DesktopPlatformApi } from "./platformApi";
import { DesktopHostSupervisor } from "./supervisor";

describe("Desktop Security & Window Configuration (Ticket 22)", () => {
  it("enforces strict sandbox, context isolation, disabled node integration, and curated preload on main window", () => {
    const mainOpts = getMainWindowOptions("/path/to/curated/preload.cjs");
    expect(mainOpts.webPreferences.sandbox).toBe(true);
    expect(mainOpts.webPreferences.contextIsolation).toBe(true);
    expect(mainOpts.webPreferences.nodeIntegration).toBe(false);
    expect(mainOpts.webPreferences.webSecurity).toBe(true);
    expect(mainOpts.webPreferences.preload).toBe("/path/to/curated/preload.cjs");
  });

  it("popouts strictly have NO preload and maintain full isolation", () => {
    const popoutOpts = getPopoutWindowOptions();
    expect(popoutOpts.webPreferences.sandbox).toBe(true);
    expect(popoutOpts.webPreferences.contextIsolation).toBe(true);
    expect(popoutOpts.webPreferences.nodeIntegration).toBe(false);
    expect(popoutOpts.webPreferences.preload).toBeUndefined();
  });

  it("validates external URLs and blocks dangerous protocols", () => {
    expect(validateExternalUrl("https://github.com/example")).toBe(true);
    expect(validateExternalUrl("http://localhost:3000")).toBe(true);
    expect(validateExternalUrl("javascript:alert(1)")).toBe(false);
    expect(validateExternalUrl("file:///etc/passwd")).toBe(false);
    expect(validateExternalUrl("data:text/html,bad")).toBe(false);
  });

  it("platform API exposes only curated methods and rejects dangerous external URLs", async () => {
    let openedUrl = "";
    const supervisor = new DesktopHostSupervisor({ dataDir: "/tmp", version: "1.0.0" });
    const api = new DesktopPlatformApi(supervisor, (url) => {
      openedUrl = url;
      return Promise.resolve();
    });

    const badResult = await api.openExternal("file:///etc/hosts");
    expect(badResult).toBe(false);
    expect(openedUrl).toBe("");

    const goodResult = await api.openExternal("https://example.com");
    expect(goodResult).toBe(true);
    expect(openedUrl).toBe("https://example.com");
  });

  it("restricts CSP connect-src strictly to Gateway origin and WebSocket endpoint without wildcards", () => {
    const csp = getDesktopCsp("http://127.0.0.1:18504");
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("connect-src 'self' http://127.0.0.1:18504 ws://127.0.0.1:18504");
    expect(csp).not.toContain("ws: wss:"); // No wildcard WebSocket origins!
    expect(csp).toContain("object-src 'none'");
  });

  it("refuses restart when active sessions are running unless force is explicitly confirmed", async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "pi-web-test-sec-"));
    try {
      const supervisor = new DesktopHostSupervisor({
        dataDir,
        version: "1.0.0",
        spawnHostProcess: (_v, port) => Promise.resolve({ pid: 31337, port }),
        healthChecker: () => Promise.resolve(true),
        isProcessAlive: () => true,
      });
      await supervisor.ensureHostStarted();
      supervisor.setActiveSessions(3);

    const api = new DesktopPlatformApi(supervisor);
    // Attempt restart without force confirmation
    const restartResult = await api.restartHost();
    expect(restartResult.restarted).toBe(false);
    expect(restartResult.error).toContain("Cannot stop host with 3 active sessions without confirmation");

    // Force restart with confirmation succeeds
    const forceResult = await api.restartHost({ force: true });
    expect(forceResult.restarted).toBe(true);
    } finally {
      rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it("verifies that the built preload artifact exposes only curated platformApi without leaking node or ipc", () => {
    const preloadDistPath = join(process.cwd(), "dist", "desktop", "preload.cjs");
    if (!existsSync(preloadDistPath)) return;

    const content = readFileSync(preloadDistPath, "utf8");
    expect(content).toContain('exposeInMainWorld("platformApi"');
    expect(content).not.toContain('exposeInMainWorld("ipcRenderer"');
    expect(content).not.toContain('exposeInMainWorld("require"');
    expect(content).not.toContain("process.binding");

    // All curated methods present
    const curatedMethods = [
      "getHostStatus",
      "stopHost",
      "restartHost",
      "openExternal",
      "readClipboard",
      "writeClipboard",
      "showOpenDialog",
      "showSaveDialog",
    ];
    for (const method of curatedMethods) {
      expect(content).toContain(method);
    }
  });
});
