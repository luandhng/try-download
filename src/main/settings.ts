import { app, BrowserWindow, dialog, ipcMain, type OpenDialogOptions } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

type ThemeMode = 'system' | 'light' | 'dark'

const themeModes = new Set<ThemeMode>(['system', 'light', 'dark'])

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

interface Settings {
  downloadDir: string | null
  theme: ThemeMode
  background: boolean
  backgroundStyle: BackgroundStyle
  accentColor: string
  cookiesMode: CookiesMode
  cookiesBrowser: CookiesBrowser
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
      background: typeof parsed.background === 'boolean' ? parsed.background : true,
      backgroundStyle: parsed.backgroundStyle === 'rays' ? 'rays' : 'gradient',
      accentColor:
        accentCandidate && colorPattern.test(accentCandidate) ? accentCandidate : '#B566FF',
      cookiesMode: cookieModes.has(parsed.cookiesMode as CookiesMode)
        ? (parsed.cookiesMode as CookiesMode)
        : 'none',
      cookiesBrowser: cookieBrowsers.has(parsed.cookiesBrowser as CookiesBrowser)
        ? (parsed.cookiesBrowser as CookiesBrowser)
        : 'chrome'
    }
  } catch {
    cached = {
      downloadDir: null,
      theme: 'system',
      background: true,
      backgroundStyle: 'gradient',
      accentColor: '#B566FF',
      cookiesMode: 'none',
      cookiesBrowser: 'chrome'
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

export function cookieArgs(): string[] {
  const settings = loadSettings()
  if (settings.cookiesMode === 'browser') {
    return ['--cookies-from-browser', settings.cookiesBrowser]
  }
  return []
}

function settingsPayload(): {
  downloadDir: string
  theme: ThemeMode
  background: boolean
  backgroundStyle: BackgroundStyle
  accentColor: string
  cookiesMode: CookiesMode
  cookiesBrowser: CookiesBrowser
} {
  const settings = loadSettings()
  return {
    downloadDir: defaultDownloadDir(),
    theme: settings.theme,
    background: settings.background,
    backgroundStyle: settings.backgroundStyle,
    accentColor: settings.accentColor,
    cookiesMode: settings.cookiesMode,
    cookiesBrowser: settings.cookiesBrowser
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
    saveSettings(next)
    return settingsPayload()
  })

  ipcMain.handle('settings:set-theme', (_event, theme: ThemeMode) => {
    const next = themeModes.has(theme) ? theme : 'system'
    saveSettings({ ...loadSettings(), theme: next })
    return next
  })

  ipcMain.handle('settings:choose-download-dir', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const options: OpenDialogOptions = {
      title: 'Choose download folder',
      properties: ['openDirectory', 'createDirectory']
    }
    const { canceled, filePaths } = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options)
    if (canceled || !filePaths[0]) return null
    saveSettings({ ...loadSettings(), downloadDir: filePaths[0] })
    return filePaths[0]
  })
}
