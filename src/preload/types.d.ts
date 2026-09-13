import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface DownloadProgress {
    percent: number
    timeMs: number
    totalSizeKb: number
    speed: string
    etaSeconds?: number
  }

  type DownloadMode = 'video' | 'audio'

  interface DownloadOptions {
    mode: DownloadMode
    quality?: string
    videoFormat?: string
    audioFormat?: string
    audioQuality?: string
    embedThumbnail?: boolean
  }

  type QueueItemStatus = 'queued' | 'downloading' | 'done' | 'error' | 'skipped'

  interface QueueRequestItem {
    id: string
    url: string
  }

  interface QueueItemEvent {
    id: string
    url: string
    status: QueueItemStatus
    name?: string
    note?: string
    percent?: number
    timeMs?: number
    speed?: string
    etaSeconds?: number
    error?: string
    outputPath?: string
  }

  interface ProbeResult {
    direct: boolean
    title?: string
    maxHeight?: number
  }

  interface StartQueueResult {
    queued: number
    canceled?: boolean
  }

  interface DownloadApi {
    startQueue: (items: QueueRequestItem[], options: DownloadOptions) => Promise<StartQueueResult>
    probeDownload: (url: string) => Promise<ProbeResult>
    onQueueItem: (callback: (item: QueueItemEvent) => void) => () => void
  }

  type ThemeMode = 'system' | 'light' | 'dark'

  type BackgroundStyle = 'gradient' | 'rays'

  type CookiesMode = 'none' | 'browser'

  type CookiesBrowser = 'chrome' | 'edge' | 'firefox' | 'brave' | 'chromium' | 'vivaldi' | 'opera'

  type SaveMode = 'folder' | 'ask'

  interface RecentDownload {
    name: string
    path?: string
    timestamp: number
  }

  interface HistoryApi {
    getRecentDownloads: () => Promise<RecentDownload[]>
    removeRecentDownload: (entry: RecentDownload) => Promise<RecentDownload[]>
    openDownload: (path: string) => Promise<void>
  }

  interface AppSettings {
    downloadDir: string
    theme: ThemeMode
    background: boolean
    backgroundStyle: BackgroundStyle
    accentColor: string
    cookiesMode: CookiesMode
    cookiesBrowser: CookiesBrowser
    saveMode: SaveMode
    quality: string
  }

  interface SettingsPatch {
    background?: boolean
    backgroundStyle?: BackgroundStyle
    accentColor?: string
    cookiesMode?: CookiesMode
    cookiesBrowser?: CookiesBrowser
    saveMode?: SaveMode
    quality?: string
  }

  interface SettingsApi {
    getSettings: () => Promise<AppSettings>
    updateSettings: (patch: SettingsPatch) => Promise<AppSettings>
    chooseDownloadDir: () => Promise<string | null>
    setTheme: (theme: ThemeMode) => Promise<ThemeMode>
    getLaunchAtLogin: () => Promise<boolean>
    setLaunchAtLogin: (enabled: boolean) => Promise<boolean>
  }

  interface ExtensionApi {
    getExtensionDir: () => Promise<string>
    openExtensionFolder: () => Promise<string>
    copyChromeUrl: () => Promise<boolean>
  }

  interface Window {
    electron: ElectronAPI
    api: DownloadApi & SettingsApi & HistoryApi & ExtensionApi
  }
}
