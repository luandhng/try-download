import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  type OpenDialogOptions,
  type WebContents
} from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

type ThemeMode = 'system' | 'light' | 'dark'

const themeModes = new Set<ThemeMode>(['system', 'light', 'dark'])

const saveModes = new Set<SaveMode>(['folder', 'ask'])

const cookieModes = new Set<CookiesMode>(['none', 'browser'])

const cookieBrowsers = new Set<CookiesBrowser>([
  'chrome',
  'edge',
  'firefox',
  'brave',
  'chromium',
  'vivaldi',
  'opera'
])

const videoQualities = new Set(['best', '2160', '1440', '1080', '720', '480', '360'])

interface Settings {
  downloadDir: string | null
  theme: ThemeMode
  background: boolean
  backgroundStyle: BackgroundStyle
  accentColor: string
  cookiesMode: CookiesMode
  cookiesBrowser: CookiesBrowser
  saveMode: SaveMode
  quality: string
}

const colorPattern = /^#[0-9a-fA-F]{6}$/

let cached: Settings | null = null

function settingsFile(): string {
  return join(app.getPath('userData'), 'settings.json')
}

function loadSettings(): Settings {
  if (cached) return cached
  try {
    const parsed = JSON.parse(readFileSync(settingsFile(), 'utf8')) as Partial<Settings> & {
      mistColor?: string
    }
    const accentCandidate =
      typeof parsed.accentColor === 'string'
        ? parsed.accentColor
        : typeof parsed.mistColor === 'string'
          ? parsed.mistColor
          : null
    cached = {
      downloadDir: typeof parsed.downloadDir === 'string' ? parsed.downloadDir : null,
      theme: themeModes.has(parsed.theme as ThemeMode) ? (parsed.theme as ThemeMode) : 'system',
      background: typeof parsed.background === 'boolean' ? parsed.background : false,
      backgroundStyle: parsed.backgroundStyle === 'rays' ? 'rays' : 'gradient',
      accentColor:
        accentCandidate && colorPattern.test(accentCandidate) ? accentCandidate : '#B566FF',
      cookiesMode: cookieModes.has(parsed.cookiesMode as CookiesMode)
        ? (parsed.cookiesMode as CookiesMode)
        : 'none',
      cookiesBrowser: cookieBrowsers.has(parsed.cookiesBrowser as CookiesBrowser)
        ? (parsed.cookiesBrowser as CookiesBrowser)
        : 'chrome',
      saveMode: saveModes.has(parsed.saveMode as SaveMode)
        ? (parsed.saveMode as SaveMode)
        : 'folder',
      quality:
        typeof parsed.quality === 'string' && videoQualities.has(parsed.quality)
          ? parsed.quality
          : 'best'
    }
  } catch {
    cached = {
      downloadDir: null,
      theme: 'system',
      background: false,
      backgroundStyle: 'gradient',
      accentColor: '#B566FF',
      cookiesMode: 'none',
      cookiesBrowser: 'chrome',
      saveMode: 'folder',
      quality: 'best'
    }
  }
  return cached
}

function saveSettings(settings: Settings): void {
  cached = settings
  mkdirSync(app.getPath('userData'), { recursive: true })
  writeFileSync(settingsFile(), JSON.stringify(settings, null, 2))
}

export function defaultDownloadDir(): string {
  const settings = loadSettings()
  if (settings.downloadDir && existsSync(settings.downloadDir)) {
    return settings.downloadDir
  }
  return app.getPath('downloads')
}

export function saveMode(): SaveMode {
  return loadSettings().saveMode
}

export function qualitySetting(): string {
  return loadSettings().quality
}

export async function pickDownloadDir(webContents: WebContents | null): Promise<string | null> {
  const window = webContents ? BrowserWindow.fromWebContents(webContents) : null
  const options: OpenDialogOptions = {
    title: 'Choose download folder',
    properties: ['openDirectory', 'createDirectory']
  }
  const { canceled, filePaths } = window
    ? await dialog.showOpenDialog(window, options)
    : await dialog.showOpenDialog(options)
  if (canceled || !filePaths[0]) return null
  return filePaths[0]
}

export function cookieArgs(): string[] {
  const settings = loadSettings()
  if (settings.cookiesMode === 'browser') {
    return ['--cookies-from-browser', settings.cookiesBrowser]
  }
  return []
}

function loginItemOptions(): { path: string; args: string[] } {
  return {
    path: process.execPath,
    args: !app.isPackaged && process.platform === 'win32' ? [app.getAppPath()] : []
  }
}

function settingsPayload(): {
  downloadDir: string
  theme: ThemeMode
  background: boolean
  backgroundStyle: BackgroundStyle
  accentColor: string
  cookiesMode: CookiesMode
  cookiesBrowser: CookiesBrowser
  saveMode: SaveMode
  quality: string
} {
  const settings = loadSettings()
  return {
    downloadDir: defaultDownloadDir(),
    theme: settings.theme,
    background: settings.background,
    backgroundStyle: settings.backgroundStyle,
    accentColor: settings.accentColor,
    cookiesMode: settings.cookiesMode,
    cookiesBrowser: settings.cookiesBrowser,
    saveMode: settings.saveMode,
    quality: settings.quality
  }
}

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:get', () => settingsPayload())

  ipcMain.handle('settings:update', (_event, patch: SettingsPatch = {}) => {
    const settings = loadSettings()
    const next: Settings = { ...settings }
    if (typeof patch.background === 'boolean') next.background = patch.background
    if (patch.backgroundStyle === 'gradient' || patch.backgroundStyle === 'rays') {
      next.backgroundStyle = patch.backgroundStyle
    }
    if (typeof patch.accentColor === 'string' && colorPattern.test(patch.accentColor)) {
      next.accentColor = patch.accentColor
    }
    if (patch.cookiesMode && cookieModes.has(patch.cookiesMode)) {
      next.cookiesMode = patch.cookiesMode
    }
    if (patch.cookiesBrowser && cookieBrowsers.has(patch.cookiesBrowser)) {
      next.cookiesBrowser = patch.cookiesBrowser
    }
    if (patch.saveMode && saveModes.has(patch.saveMode)) {
      next.saveMode = patch.saveMode
    }
    if (typeof patch.quality === 'string' && videoQualities.has(patch.quality)) {
      next.quality = patch.quality
    }
    saveSettings(next)
    return settingsPayload()
  })

  ipcMain.handle('settings:set-theme', (_event, theme: ThemeMode) => {
    const next = themeModes.has(theme) ? theme : 'system'
    saveSettings({ ...loadSettings(), theme: next })
    return next
  })

  ipcMain.handle('settings:choose-download-dir', async (event) => {
    const dir = await pickDownloadDir(event.sender)
    if (!dir) return null
    saveSettings({ ...loadSettings(), downloadDir: dir })
    return dir
  })

  ipcMain.handle('settings:get-launch-at-login', () => {
    return app.getLoginItemSettings(loginItemOptions()).openAtLogin
  })

  ipcMain.handle('settings:set-launch-at-login', (_event, enabled: boolean) => {
    app.setLoginItemSettings({ openAtLogin: enabled === true, ...loginItemOptions() })
    return app.getLoginItemSettings(loginItemOptions()).openAtLogin
  })
}
