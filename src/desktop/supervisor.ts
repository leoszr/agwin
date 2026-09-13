import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { fileURLToPath as __supFileUrl } from "node:url";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { spawn } from "node:child_process";
import type { HostStatus, SupervisorOptions } from "./types";

interface StoredHostState {
  pid: number;
  port: number;
  version: string;
  startedAt: string;
}

function isStoredState(value: unknown): value is StoredHostState {
  if (typeof value !== "object" || value === null) return false;
  if (!("pid" in value) || !("port" in value)) return false;
  const pid = Reflect.get(value, "pid");
  const port = Reflect.get(value, "port");
  return typeof pid === "number" && typeof port === "number";
}

function errnoCode(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  if (!("code" in err)) return undefined;
  const code: unknown = Reflect.get(err, "code");
  return typeof code === "string" ? code : undefined;
}

export class DesktopHostSupervisor {
  // Absolute host entry — never relative to process.cwd().
  // Production (dist/desktop/supervisor.js): module-relative ../server/index.js exists and is used.
  // Dev/test (src via tsx/vitest): module-relative points at TS sources, so fall back to the built dist entry.
  private resolveHostEntry(): string {
    const candidates: string[] = [];
    try {
      candidates.push(join(dirname(__supFileUrl(import.meta.url)), "..", "server", "index.js"));
    } catch {
      // ignore; cwd fallback below
    }
    candidates.push(join(process.cwd(), "dist", "server", "index.js"));
    for (const candidate of candidates) {
      try {
        if (existsSync(candidate)) return candidate;
      } catch {
        // ignore and try next
      }
    }
    return candidates[0] ?? join(process.cwd(), "dist", "server", "index.js");
  }

  private currentVersion: string;
  private previousVersion?: string | undefined;
  private readonly stateDir: string;
  private readonly stateFilePath: string;
  private gatewayPort: number;
  private pid?: number | undefined;
  private mockActiveSessions?: number | undefined;

  constructor(private readonly options?: SupervisorOptions) {
    this.currentVersion = options?.version ?? "1.0.0";
    this.gatewayPort = options?.port ?? 18504;

    const envDataDir = process.env["XDG_DATA_HOME"];
    const baseDataDir = options?.dataDir ?? (envDataDir !== undefined && envDataDir.length > 0 ? envDataDir : join(homedir(), ".local", "share"));
    this.stateDir = join(baseDataDir, "pi-web", "host");
    this.stateFilePath = join(this.stateDir, "host.json");

    if (!existsSync(this.stateDir)) {
      try {
        mkdirSync(this.stateDir, { recursive: true });
      } catch {
        // directory creation failure ignored if already created
      }
    }
  }

  private readStoredState(): StoredHostState | undefined {
    if (!existsSync(this.stateFilePath)) return undefined;
    try {
      const raw = readFileSync(this.stateFilePath, "utf8");
      const parsed: unknown = JSON.parse(raw);
      if (isStoredState(parsed)) {
        return parsed;
      }
    } catch {
      return undefined;
    }
    return undefined;
  }

  private writeStoredState(state: StoredHostState): void {
    try {
      writeFileSync(this.stateFilePath, JSON.stringify(state, null, 2), "utf8");
    } catch {
      // ignore write errors
    }
  }

  private isProcessAlive(pid: number): boolean {
    if (this.options?.isProcessAlive !== undefined) {
      return this.options.isProcessAlive(pid);
    }
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  async getStatus(): Promise<HostStatus> {
    const stored = this.readStoredState();
    if (!stored || !this.isProcessAlive(stored.pid)) {
      if (stored && !this.isProcessAlive(stored.pid)) {
        try {
          unlinkSync(this.stateFilePath);
        } catch {
          // unlink failure ignored
        }
      }
      return {
        running: false,
        version: this.currentVersion,
        previousVersion: this.previousVersion,
        activeSessionsCount: 0,
        health: "stopped",
      };
    }

    const healthy = await this.checkHealth(stored.port);
    const activeCount = await this.queryActiveSessionsCount(stored.port);

    return {
      running: true,
      version: stored.version.length > 0 ? stored.version : this.currentVersion,
      previousVersion: this.previousVersion,
      pid: stored.pid,
      gatewayPort: stored.port,
      // Unknown count surfaces as 0 + unknown flag; stop/update must treat unknown as blocking.
      activeSessionsCount: activeCount ?? 0,
      ...(activeCount === undefined ? { activeSessionsUnknown: true } : {}),
      health: healthy ? "healthy" : "unhealthy",
    };
  }

  async ensureHostStarted(): Promise<HostStatus> {
    const existing = await this.getStatus();
    if (existing.running && existing.health === "healthy") {
      return existing;
    }

    let pid: number;
    let port = this.gatewayPort;

    if (this.options?.spawnHostProcess !== undefined) {
      const proc = await this.options.spawnHostProcess(this.currentVersion, port);
      pid = proc.pid;
      port = proc.port;
    } else {
      const child = spawn(
        process.execPath,
        [this.resolveHostEntry()],
        {
          detached: true,
          stdio: "ignore",
          env: {
            ...process.env,
            PI_WEB_PORT: String(port),
          },
        },
      );
      child.unref();
      if (child.pid === undefined) {
        throw new Error("Failed to spawn persistent host process");
      }
      pid = child.pid;
    }

    this.writeStoredState({
      pid,
      port,
      version: this.currentVersion,
      startedAt: new Date().toISOString(),
    });

    const isHealthy = await this.checkHealth(port);
    if (!isHealthy && this.previousVersion !== undefined && this.previousVersion.length > 0) {
      await this.rollback();
    }

    return this.getStatus();
  }

  async updateHostVersion(newVersion: string): Promise<{ success: boolean; rollbackNeeded?: boolean | undefined; error?: string | undefined }> {
    const current = await this.getStatus();
    if (current.activeSessionsCount > 0 || current.activeSessionsUnknown === true) {
      const reason = current.activeSessionsUnknown === true
        ? "active session count is unknown; refusing update without confirmation"
        : "Cannot update host version while " + String(current.activeSessionsCount) + " active sessions are running. Please wait or terminate sessions first.";
      return { success: false, error: reason };
    }

    // No versioned installer injected: refuse explicitly instead of fake success.
    if (this.options?.spawnHostProcess === undefined) {
      return {
        success: false,
        error: "Host update requires a versioned runtime installer (spawnHostProcess); refusing to fake a version switch without spawning a new process.",
      };
    }

    const previousVersion = this.currentVersion;
    let newPid: number;
    let newPort: number;
    try {
      const proc = await this.options.spawnHostProcess(newVersion, this.gatewayPort);
      newPid = proc.pid;
      newPort = proc.port;
    } catch (err) {
      return {
        success: false,
        error: "Failed to spawn new host version " + newVersion + ": " + (err instanceof Error ? err.message : String(err)),
      };
    }

    const healthy = await this.checkHealth(newPort);
    if (!healthy) {
      try {
        const fallbackProc = await this.options.spawnHostProcess(previousVersion, this.gatewayPort);
        this.pid = fallbackProc.pid;
        this.gatewayPort = fallbackProc.port;
      } catch (err) {
        return {
          success: false,
          rollbackNeeded: true,
          error: "New host version failed health check and rollback spawn also failed: " + (err instanceof Error ? err.message : String(err)),
        };
      }
      return {
        success: false,
        rollbackNeeded: true,
        error: "New host version failed health check; rolled back to previous version.",
      };
    }

    this.previousVersion = previousVersion;
    this.currentVersion = newVersion;
    this.writeStoredState({
      pid: newPid,
      port: newPort,
      version: newVersion,
      startedAt: new Date().toISOString(),
    });

    return { success: true };
  }

  async rollback(): Promise<void> {
    if (this.previousVersion === undefined || this.previousVersion.length === 0) return;
    const fallback = this.previousVersion;
    delete this.previousVersion;
    this.currentVersion = fallback;

    if (this.options?.spawnHostProcess !== undefined) {
      try {
        const proc = await this.options.spawnHostProcess(this.currentVersion, this.gatewayPort);
        this.writeStoredState({
          pid: proc.pid,
          port: proc.port,
          version: this.currentVersion,
          startedAt: new Date().toISOString(),
        });
      } catch (err) {
        throw new Error("Rollback to host version " + fallback + " failed", { cause: err });
      }
    }
  }

  stop(options?: { force?: boolean }): Promise<{ stopped: boolean; error?: string | undefined }> {
    return this.getStatus().then((status) => {
      if (!status.running || status.pid === undefined) {
        return { stopped: true };
      }

      if ((status.activeSessionsCount > 0 || status.activeSessionsUnknown === true) && options?.force !== true) {
        const reason = status.activeSessionsUnknown === true
          ? "Cannot stop host: active session count is unknown without confirmation (use force to override)."
          : "Cannot stop host with " + String(status.activeSessionsCount) + " active sessions without confirmation.";
        return { stopped: false, error: reason };
      }

      try {
        process.kill(status.pid, "SIGTERM");
      } catch (err) {
        const code = errnoCode(err);
        if (code !== "ESRCH") {
          return { stopped: false, error: "Failed to signal host pid " + String(status.pid) + ": " + (err instanceof Error ? err.message : String(err)) };
        }
      }

      try {
        unlinkSync(this.stateFilePath);
      } catch (err) {
        const code = errnoCode(err);
        if (code !== undefined && code !== "ENOENT") {
          return { stopped: false, error: "Host signaled but state file could not be removed: " + (err instanceof Error ? err.message : String(err)) };
        }
      }

      return { stopped: true };
    });
  }

  setActiveSessions(count: number): void {
    this.mockActiveSessions = count;
  }

  private async checkHealth(port: number): Promise<boolean> {
    if (this.options?.healthChecker !== undefined) {
      return this.options.healthChecker(port);
    }
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 1500);
      const res = await fetch(`http://127.0.0.1:${String(port)}/api/sessiond/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return res.ok;
    } catch {
      return false;
    }
  }

  private async queryActiveSessionsCount(port: number): Promise<number | undefined> {
    if (this.mockActiveSessions !== undefined) return this.mockActiveSessions;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 1500);
      // Canonical source: sessiond /health exposes numeric activeSessions.
      // /api/status returns a MachineStatusSnapshot (flags per workspace), not a session list.
      const res = await fetch("http://127.0.0.1:" + String(port) + "/api/sessiond/health", {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const body: unknown = await res.json();
        if (typeof body === "object" && body !== null && "activeSessions" in body) {
          const sessionsVal = Reflect.get(body, "activeSessions");
          if (typeof sessionsVal === "number" && Number.isFinite(sessionsVal) && sessionsVal >= 0) {
            return Math.floor(sessionsVal);
          }
        }
      }
      // Fail-closed: unknown count, caller must block destructive ops.
      return undefined;
    } catch {
      return undefined;
    }
  }
}
