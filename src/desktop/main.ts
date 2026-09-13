import { app, BrowserWindow, session, ipcMain, shell, dialog, clipboard } from "electron";
import { join } from "node:path";
import { DesktopHostSupervisor } from "./supervisor.js";
import { getDesktopCsp, getMainWindowOptions, getPopoutWindowOptions, validateExternalUrl } from "./windowConfig.js";

const DEFAULT_GATEWAY_PORT = 18504;
const supervisor = new DesktopHostSupervisor({
  version: app.getVersion(),
  port: DEFAULT_GATEWAY_PORT,
});

let mainWindow: BrowserWindow | undefined;
let gatewayOriginForIpc = "http://127.0.0.1:18504";

function isGatewayOrigin(url: string, gatewayOrigin: string): boolean {
  try {
    return new URL(url).origin === new URL(gatewayOrigin).origin;
  } catch {
    return false;
  }
}

function isGatewayFrame(event: { senderFrame?: { url?: string } | null }, gatewayOrigin: string): boolean {
  const frameUrl = event.senderFrame?.url;
  if (typeof frameUrl !== "string" || frameUrl.length === 0) return false;
  return isGatewayOrigin(frameUrl, gatewayOrigin);
}

async function createWindow(): Promise<BrowserWindow> {
  const status = await supervisor.ensureHostStarted();
  const gatewayPort = status.gatewayPort ?? DEFAULT_GATEWAY_PORT;
  const gatewayOrigin = `http://127.0.0.1:${String(gatewayPort)}`;

  // Set CSP headers for all responses in the default session
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [getDesktopCsp(gatewayOrigin)],
      },
    });
  });

  const preloadPath = join(__dirname, "preload.cjs");
  const winOpts = getMainWindowOptions(preloadPath);

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "PI WEB Control Surface",
    webPreferences: {
      sandbox: winOpts.webPreferences.sandbox,
      contextIsolation: winOpts.webPreferences.contextIsolation,
      nodeIntegration: winOpts.webPreferences.nodeIntegration,
      webSecurity: winOpts.webPreferences.webSecurity,
      preload: preloadPath,
    },
  });

  // Open external links securely
  // Restrict all navigations to the gateway origin; anything else must go via shell.openExternal.
  win.webContents.on("will-navigate", (event, url) => {
    if (!isGatewayOrigin(url, gatewayOrigin)) {
      event.preventDefault();
    }
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isGatewayOrigin(url, gatewayOrigin)) {
      // Internal popout: allow with strict popout window options (no preload)
      const popout = getPopoutWindowOptions();
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          webPreferences: {
            sandbox: popout.webPreferences.sandbox,
            contextIsolation: popout.webPreferences.contextIsolation,
            nodeIntegration: popout.webPreferences.nodeIntegration,
            webSecurity: popout.webPreferences.webSecurity,
          },
        },
      };
    }
    if (validateExternalUrl(url)) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  await win.loadURL(gatewayOrigin + "/app");
  gatewayOriginForIpc = gatewayOrigin;
  return win;
}

// IPC Platform API handlers — every handler is authorized by sender frame origin.
// Only the gateway origin may invoke privileged host/clipboard/dialog APIs.
ipcMain.handle("platform:getHostStatus", async (event) => {
  if (!isGatewayFrame(event, gatewayOriginForIpc)) throw new Error("Rejected: foreign frame");
  return supervisor.getStatus();
});

ipcMain.handle("platform:stopHost", async (event, options?: { force?: boolean }) => {
  if (!isGatewayFrame(event, gatewayOriginForIpc)) throw new Error("Rejected: foreign frame");
  return supervisor.stop(options);
});

ipcMain.handle("platform:restartHost", async (event, options?: { force?: boolean }) => {
  if (!isGatewayFrame(event, gatewayOriginForIpc)) throw new Error("Rejected: foreign frame");
  const stopResult = await supervisor.stop(options);
  if (!stopResult.stopped) {
    return { restarted: false, error: stopResult.error };
  }
  const status = await supervisor.ensureHostStarted();
  return { restarted: true, status };
});

ipcMain.handle("platform:openExternal", async (event, url: string) => {
  if (!isGatewayFrame(event, gatewayOriginForIpc)) throw new Error("Rejected: foreign frame");
  if (!validateExternalUrl(url)) return false;
  await shell.openExternal(url);
  return true;
});

ipcMain.handle("platform:readClipboard", (event) => {
  if (!isGatewayFrame(event, gatewayOriginForIpc)) throw new Error("Rejected: foreign frame");
  return clipboard.readText();
});


ipcMain.handle("platform:writeClipboard", async (event, text: string) => {
  if (!isGatewayFrame(event, gatewayOriginForIpc)) throw new Error("Rejected: foreign frame");
  await clipboard.writeText(text);
});


ipcMain.handle("platform:showOpenDialog", async (event, opts?: { title?: string; properties?: ("openFile" | "openDirectory" | "multiSelections")[] }) => {
  if (!isGatewayFrame(event, gatewayOriginForIpc)) throw new Error("Rejected: foreign frame");
  if (!mainWindow) return [];
  const dialogOpts: { title?: string; properties?: ("openFile" | "openDirectory" | "multiSelections")[] } = {};
  if (opts?.title !== undefined) dialogOpts.title = opts.title;
  if (opts?.properties !== undefined) dialogOpts.properties = opts.properties;
  const result = await dialog.showOpenDialog(mainWindow, dialogOpts);
  return result.filePaths;
});

ipcMain.handle("platform:showSaveDialog", async (event, opts?: { title?: string; defaultPath?: string }) => {
  if (!isGatewayFrame(event, gatewayOriginForIpc)) throw new Error("Rejected: foreign frame");
  if (!mainWindow) return undefined;
  const dialogOpts: { title?: string; defaultPath?: string } = {};
  if (opts?.title !== undefined) dialogOpts.title = opts.title;
  if (opts?.defaultPath !== undefined) dialogOpts.defaultPath = opts.defaultPath;
  const result = await dialog.showSaveDialog(mainWindow, dialogOpts);
  return result.filePath;
});

// App Lifecycle
void app.whenReady().then(async () => {
  mainWindow = await createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow().then((w) => {
        mainWindow = w;
      });
    }
  });
});

app.on("window-all-closed", () => {
  app.quit();
});
