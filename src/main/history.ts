import { app, ipcMain, shell, type IpcMainInvokeEvent } from 'electron'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { basename, dirname, join } from 'path'

const maxEntries = 3

let cached: RecentDownload[] | null = null

function historyFile(): string {
  return join(app.getPath('userData'), 'downloads.json')
}

export function loadHistory(): RecentDownload[] {
  if (cached) return cached
  try {
    const parsed = JSON.parse(readFileSync(historyFile(), 'utf8')) as RecentDownload[]
    cached = Array.isArray(parsed)
      ? parsed
          .filter(
            (item) => item && typeof item.name === 'string' && typeof item.timestamp === 'number'
          )
          .slice(0, maxEntries)
      : []
  } catch {
    cached = []
  }
  return cached
}

function persist(entries: RecentDownload[]): void {
  cached = entries
  mkdirSync(app.getPath('userData'), { recursive: true })
  writeFileSync(historyFile(), JSON.stringify(entries, null, 2))
}

export function addHistoryEntry(entry: { name: string; path?: string }): void {
  persist(
    [{ name: entry.name, path: entry.path, timestamp: Date.now() }, ...loadHistory()].slice(
      0,
      maxEntries
    )
  )
}

export function removeHistoryEntry(entry: RecentDownload): RecentDownload[] {
  const next = loadHistory().filter(
    (item) =>
      item.timestamp !== entry.timestamp || item.name !== entry.name || item.path !== entry.path
  )
  persist(next)
  return next
}

function normalizeName(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function findApproximate(dir: string, targetName: string): string | null {
  const want = normalizeName(targetName)
  if (!want) return null
  try {
    const match = readdirSync(dir).find((name) => normalizeName(name) === want)
    return match ? join(dir, match) : null
  } catch {
    return null
  }
}

export function registerHistoryHandlers(): void {
  ipcMain.handle('downloads:list', () => loadHistory())

  ipcMain.handle('downloads:remove', (_event, entry: RecentDownload) => {
    if (!entry || typeof entry.name !== 'string' || typeof entry.timestamp !== 'number') {
      return loadHistory()
    }
    return removeHistoryEntry(entry)
  })

  ipcMain.handle('downloads:open', (_event: IpcMainInvokeEvent, path: string) => {
    if (typeof path !== 'string' || path.length === 0) return
    if (existsSync(path)) {
      shell.showItemInFolder(path)
      return
    }
    const candidate = findApproximate(dirname(path), basename(path))
    if (candidate) {
      shell.showItemInFolder(candidate)
    } else {
      void shell.openPath(dirname(path))
    }
  })
}
