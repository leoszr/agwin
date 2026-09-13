import type { CuratedPlatformApi, HostStatus } from "./types";
import { validateExternalUrl } from "./windowConfig";
import type { DesktopHostSupervisor } from "./supervisor";

export class DesktopPlatformApi implements CuratedPlatformApi {
  private clipboardContent = "";

  constructor(
    private readonly supervisor: DesktopHostSupervisor,
    private readonly externalOpener?: (url: string) => Promise<void>,
  ) {}

  async getHostStatus(): Promise<HostStatus> {
    return this.supervisor.getStatus();
  }

  async stopHost(options?: { force?: boolean }): Promise<{ stopped: boolean; error?: string | undefined }> {
    return this.supervisor.stop(options);
  }

  async restartHost(options?: { force?: boolean }): Promise<{ restarted: boolean; status?: HostStatus | undefined; error?: string | undefined }> {
    const stopResult = await this.supervisor.stop(options);
    if (!stopResult.stopped) {
      return { restarted: false, error: stopResult.error };
    }
    const status = await this.supervisor.ensureHostStarted();
    return { restarted: true, status };
  }

  async openExternal(url: string): Promise<boolean> {
    if (!validateExternalUrl(url)) {
      return false;
    }
    if (this.externalOpener) {
      await this.externalOpener(url);
    }
    return true;
  }

  readClipboard(): Promise<string> {
    return Promise.resolve(this.clipboardContent);
  }

  writeClipboard(text: string): Promise<void> {
    this.clipboardContent = text;
    return Promise.resolve();
  }
}
