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

  interface DownloadApi {
    startQueue: (items: QueueRequestItem[], options: DownloadOptions) => Promise<{ queued: number }>
    probeDownload: (url: string) => Promise<ProbeResult>
    onQueueItem: (callback: (item: QueueItemEvent) => void) => () => void
  }

  type ThemeMode = 'system' | 'light' | 'dark'

  type BackgroundStyle = 'gradient' | 'rays'

  type CookiesMode = 'none' | 'browser'

  type CookiesBrowser = 'chrome' | 'edge' | 'firefox' | 'brave' | 'chromium' | 'vivaldi' | 'opera'

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
    isDefault: boolean
    theme: ThemeMode
    background: boolean
    backgroundStyle: BackgroundStyle
    accentColor: string
    cookiesMode: CookiesMode
    cookiesBrowser: CookiesBrowser
  }

  interface SettingsPatch {
    background?: boolean
    backgroundStyle?: BackgroundStyle
    accentColor?: string
    cookiesMode?: CookiesMode
    cookiesBrowser?: CookiesBrowser
  }

  interface SettingsApi {
    getSettings: () => Promise<AppSettings>
    updateSettings: (patch: SettingsPatch) => Promise<AppSettings>
    chooseDownloadDir: () => Promise<string | null>
    resetDownloadDir: () => Promise<string>
    setTheme: (theme: ThemeMode) => Promise<ThemeMode>
  }

  interface Window {
    electron: ElectronAPI
    api: DownloadApi & SettingsApi & HistoryApi
  }
}
