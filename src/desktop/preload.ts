import { contextBridge, ipcRenderer } from "electron";

// Curated platform API exposed exclusively in main window
contextBridge.exposeInMainWorld("platformApi", {
  getHostStatus: () => ipcRenderer.invoke("platform:getHostStatus"),
  stopHost: (options?: { force?: boolean }) => ipcRenderer.invoke("platform:stopHost", options),
  restartHost: (options?: { force?: boolean }) => ipcRenderer.invoke("platform:restartHost", options),
  openExternal: (url: string) => ipcRenderer.invoke("platform:openExternal", url),
  readClipboard: () => ipcRenderer.invoke("platform:readClipboard"),
  writeClipboard: (text: string) => ipcRenderer.invoke("platform:writeClipboard", text),
  showOpenDialog: (options?: { title?: string; properties?: string[] }) => ipcRenderer.invoke("platform:showOpenDialog", options),
  showSaveDialog: (options?: { title?: string; defaultPath?: string }) => ipcRenderer.invoke("platform:showSaveDialog", options),
});
