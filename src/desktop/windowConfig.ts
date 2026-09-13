export interface BrowserWindowOptions {
  webPreferences: {
    sandbox: boolean;
    contextIsolation: boolean;
    nodeIntegration: boolean;
    webSecurity: boolean;
    preload?: string | undefined;
  };
}

export function getDesktopCsp(gatewayOrigin = "http://127.0.0.1:18504"): string {
  const wsOrigin = gatewayOrigin.replace(/^http/, "ws");
  return [
    "default-src 'self'",
    `connect-src 'self' ${gatewayOrigin} ${wsOrigin}`,
    "img-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
  ].join("; ");
}

export const DESKTOP_CSP_DIRECTIVES = getDesktopCsp();

export function getMainWindowOptions(preloadPath: string): BrowserWindowOptions {
  return {
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      preload: preloadPath,
    },
  };
}

export function getPopoutWindowOptions(): BrowserWindowOptions {
  return {
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      preload: undefined, // Popouts strictly have NO preload
    },
  };
}

export function validateExternalUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
