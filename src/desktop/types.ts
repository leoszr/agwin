export interface HostStatus {
  running: boolean;
  version: string;
  previousVersion?: string | undefined;
  gatewayPort?: number | undefined;
  pid?: number | undefined;
  activeSessionsCount: number;
  activeSessionsUnknown?: boolean | undefined;
  health: "healthy" | "unhealthy" | "stopped";
}

export interface SupervisorOptions {
  dataDir?: string | undefined;
  version: string;
  port?: number | undefined;
  spawnHostProcess?: ((version: string, port: number) => Promise<{ pid: number; port: number }>) | undefined;
  healthChecker?: ((port: number) => Promise<boolean>) | undefined;
  isProcessAlive?: ((pid: number) => boolean) | undefined;
}

export interface CuratedPlatformApi {
  getHostStatus(): Promise<HostStatus>;
  stopHost(options?: { force?: boolean }): Promise<{ stopped: boolean; error?: string | undefined }>;
  restartHost(options?: { force?: boolean }): Promise<{ restarted: boolean; status?: HostStatus | undefined; error?: string | undefined }>;
  openExternal(url: string): Promise<boolean>;
  readClipboard(): Promise<string>;
  writeClipboard(text: string): Promise<void>;
  showOpenDialog?(options?: { title?: string; properties?: string[] }): Promise<string[]>;
  showSaveDialog?(options?: { title?: string; defaultPath?: string }): Promise<string | undefined>;
}
