import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api: DownloadApi & SettingsApi & HistoryApi & ExtensionApi = {
  startQueue: (items, options) => ipcRenderer.invoke('download:startQueue', items, options),
  probeDownload: (url) => ipcRenderer.invoke('download:probe', url),
  onQueueItem: (callback) => {
    const listener = (_event: IpcRendererEvent, item: QueueItemEvent): void => callback(item)
    ipcRenderer.on('queue:item', listener)
    return () => {
      ipcRenderer.removeListener('queue:item', listener)
    }
  },
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (patch) => ipcRenderer.invoke('settings:update', patch),
  chooseDownloadDir: () => ipcRenderer.invoke('settings:choose-download-dir'),
  setTheme: (theme) => ipcRenderer.invoke('settings:set-theme', theme),
  getLaunchAtLogin: () => ipcRenderer.invoke('settings:get-launch-at-login'),
  setLaunchAtLogin: (enabled) => ipcRenderer.invoke('settings:set-launch-at-login', enabled),
  getExtensionDir: () => ipcRenderer.invoke('extension:get-dir'),
  openExtensionFolder: () => ipcRenderer.invoke('extension:open-folder'),
  copyChromeUrl: () => ipcRenderer.invoke('extension:copy-chrome-url'),
  getRecentDownloads: () => ipcRenderer.invoke('downloads:list'),
  removeRecentDownload: (entry) => ipcRenderer.invoke('downloads:remove', entry),
  openDownload: (path) => ipcRenderer.invoke('downloads:open', path)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
