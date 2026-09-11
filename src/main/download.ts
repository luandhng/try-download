import { app, ipcMain, type WebContents } from 'electron'
import { spawn, type ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import { basename, dirname, extname, join } from 'path'
import { addHistoryEntry } from './history'
import { cookieArgs, defaultDownloadDir } from './settings'

function bundledBinary(name: string): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'app.asar.unpacked', 'resources', name)
    : join(__dirname, '../../resources', name)
}

const ffmpegPath = bundledBinary('ffmpeg.exe')

const ytDlpPath = bundledBinary('yt-dlp.exe')

const directMediaPattern = /\.(mp4|m4v|mkv|webm|mov|avi|ts|m3u8|mpd|mp3|m4a|aac|flac|wav|ogg)$/i

const audioOnlyPattern = /\.(mp3|m4a|aac|flac|wav|ogg)$/i

const qualityHeights: Record<string, string> = {
  best: '',
  '2160': '[height<=2160]',
  '1440': '[height<=1440]',
  '1080': '[height<=1080]',
  '720': '[height<=720]',
  '480': '[height<=480]',
  '360': '[height<=360]'
}

const videoFormats = new Set(['mp4', 'mkv', 'webm'])

function validVideoFormat(format?: string): string {
  return format && videoFormats.has(format) ? format : 'mp4'
}

function videoFormatSelector(quality: string | undefined, container: string): string {
  const height = qualityHeights[quality ?? 'best'] ?? ''
  const fallback = `bv*${height}+ba/b${height}`
  if (container === 'mp4') return `bv*${height}+ba[ext=m4a]/bv*${height}+ba/b${height}`
  if (container === 'webm') return `bv*${height}[ext=webm]+ba[ext=webm]/${fallback}`
  return fallback
}

const audioFormats = new Set(['mp3', 'm4a'])

const audioQualities = new Set(['best', '128', '192', '256', '320'])

const streamingExtensions = new Set(['.m3u8', '.mpd'])

function validAudioFormat(format?: string): string {
  return format && audioFormats.has(format) ? format : 'mp3'
}

function validAudioQuality(quality?: string): string {
  return quality && audioQualities.has(quality) ? quality : '192'
}

function audioCodecArgs(format: string, quality: string): string[] {
  if (format === 'm4a') {
    return ['-c:a', 'aac', '-b:a', quality === 'best' ? '320k' : `${quality}k`]
  }
  return quality === 'best'
    ? ['-c:a', 'libmp3lame', '-q:a', '0']
    : ['-c:a', 'libmp3lame', '-b:a', `${quality}k`]
}

function suggestedFilename(url: string): string {
  let name = ''
  try {
    name = basename(new URL(url).pathname)
  } catch {
    name = ''
  }
  if (!name || streamingExtensions.has(extname(name).toLowerCase())) {
    return 'download.mp4'
  }
  return decodeURIComponent(name)
}

function isDirectMediaUrl(url: URL): boolean {
  return directMediaPattern.test(url.pathname)
}

function withExtension(filePath: string, extension: string): string {
  const current = extname(filePath)
  if (current.toLowerCase() === extension) return filePath
  return current ? filePath.slice(0, -current.length) + extension : filePath + extension
}

function sanitizeFilename(name: string): string {
  const cleaned = name
    .split('')
    .map((char) => (char.charCodeAt(0) < 32 ? '_' : char))
    .join('')
    .replace(/[<>:"/\\|?*]/g, '_')
    .trim()
  return cleaned && cleaned !== '.' && cleaned !== '..' ? cleaned : `download-${Date.now()}.mp4`
}

function formatSpeed(bytesPerSecond: number): string {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return ''
  const units = ['B/s', 'KiB/s', 'MiB/s', 'GiB/s']
  let value = bytesPerSecond
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`
}

interface QueueEntry {
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

let queue: QueueEntry[] = []
let queueOptions: DownloadOptions = { mode: 'video' }
let processing = false
let currentProc: ChildProcess | null = null

function probeUrl(parsed: URL): Promise<ProbeResult> {
  return new Promise((resolve) => {
    if (isDirectMediaUrl(parsed)) {
      resolve({ direct: true })
      return
    }

    const args = [
      '--no-playlist',
      '--skip-download',
      '--dump-single-json',
      '--no-warnings',
      '--encoding',
      'utf-8',
      ...cookieArgs(),
      parsed.toString()
    ]
    const proc = spawn(ytDlpPath, args, {
      windowsHide: true,
      env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' }
    })
    let output = ''
    const timer = setTimeout(() => {
      if (!proc.killed) proc.kill()
    }, 25000)

    proc.stdout.setEncoding('utf8')
    proc.stdout.on('data', (chunk: string) => {
      output += chunk
    })

    proc.on('error', () => {
      clearTimeout(timer)
      resolve({ direct: false })
    })

    proc.on('close', () => {
      clearTimeout(timer)
      try {
        const json = output.slice(output.indexOf('{'))
        const info = JSON.parse(json) as {
          title?: string
          formats?: { height?: number | null }[]
        }
        const heights = (info.formats ?? [])
          .map((format) => format.height)
          .filter((height): height is number => typeof height === 'number' && height > 0)
        resolve({
          direct: false,
          title: info.title,
          maxHeight: heights.length > 0 ? Math.max(...heights) : undefined
        })
      } catch {
        resolve({ direct: false })
      }
    })
  })
}

function sendItem(sender: WebContents, entry: QueueEntry): void {
  if (sender.isDestroyed()) return
  sender.send('queue:item', {
    id: entry.id,
    url: entry.url,
    status: entry.status,
    name: entry.name,
    note: entry.note,
    percent: entry.percent,
    timeMs: entry.timeMs,
    speed: entry.speed,
    etaSeconds: entry.etaSeconds,
    error: entry.error,
    outputPath: entry.outputPath
  })
}

export function registerDownloadHandlers(): void {
  ipcMain.handle('download:probe', async (_event, url: string) => {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Only http(s) URLs are supported')
    }
    return probeUrl(parsed)
  })

  ipcMain.handle(
    'download:startQueue',
    (event, items: QueueRequestItem[], options: DownloadOptions = { mode: 'video' }) => {
      queue = items.map((item) => ({ id: item.id, url: item.url, status: 'queued' }))
      queueOptions = options
      event.sender.once('destroyed', () => {
        if (currentProc && !currentProc.killed) currentProc.kill()
      })
      if (!processing) {
        void processQueue(event.sender)
      }
      return { queued: queue.length }
    }
  )
}

async function processQueue(sender: WebContents): Promise<void> {
  processing = true
  try {
    for (;;) {
      const entry = queue.find((item) => item.status === 'queued')
      if (!entry) break

      if (sender.isDestroyed()) {
        entry.status = 'error'
        entry.error = 'Window closed'
        continue
      }

      entry.status = 'downloading'
      sendItem(sender, entry)

      try {
        const parsed = new URL(entry.url)
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          throw new Error('Only http(s) URLs are supported')
        }

        const onProgress = (progress: DownloadProgress): void => {
          entry.percent = progress.percent
          entry.speed = progress.speed
          entry.etaSeconds = progress.etaSeconds
          entry.timeMs = progress.timeMs
          sendItem(sender, entry)
        }

        if (isDirectMediaUrl(parsed)) {
          const outputPath = directOutputPath(parsed, queueOptions)
          if (existsSync(outputPath)) {
            entry.status = 'skipped'
            entry.name = basename(outputPath)
            entry.outputPath = outputPath
          } else {
            const audioOnly = queueOptions.mode === 'audio'
            entry.name = basename(outputPath)
            sendItem(sender, entry)
            await runFfmpegDownload(
              entry.url,
              outputPath,
              audioOnly,
              validAudioQuality(queueOptions.audioQuality),
              onProgress
            )
            entry.status = 'done'
            entry.outputPath = outputPath
            addHistoryEntry({ name: entry.name ?? basename(outputPath), path: outputPath })
          }
        } else {
          const result = await runYtDlpDownload(entry.url, queueOptions, onProgress, (info) => {
            if (info.name) entry.name = info.name
            if (info.path) entry.outputPath = info.path
            if (info.note) entry.note = info.note
            sendItem(sender, entry)
          })
          entry.status = result
          if (result === 'done') {
            addHistoryEntry({ name: entry.name ?? entry.url, path: entry.outputPath })
          }
        }
      } catch (err) {
        entry.status = 'error'
        entry.error = err instanceof Error ? err.message : String(err)
      }

      sendItem(sender, entry)
    }
  } finally {
    processing = false
    currentProc = null
  }
}

function directOutputPath(url: URL, options: DownloadOptions): string {
  const base = sanitizeFilename(suggestedFilename(url.toString()))
  const name =
    options.mode === 'audio'
      ? withExtension(base, `.${validAudioFormat(options.audioFormat)}`)
      : withExtension(base, `.${validVideoFormat(options.videoFormat)}`)
  return join(defaultDownloadDir(), name)
}

function runFfmpegDownload(
  url: string,
  outputPath: string,
  audioOnly: boolean,
  audioQuality: string,
  onProgress: (progress: DownloadProgress) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = ['-y', '-hide_banner', '-progress', 'pipe:1', '-nostats', '-i', url]

    if (audioOnly) {
      args.push('-vn')
      const targetFormat = extname(outputPath).slice(1).toLowerCase()
      const sourceExtension = extname(new URL(url).pathname).toLowerCase()
      if (audioOnlyPattern.test(sourceExtension) && sourceExtension === `.${targetFormat}`) {
        args.push('-c:a', 'copy')
      } else {
        args.push(...audioCodecArgs(targetFormat, audioQuality))
      }
    } else {
      args.push('-c', 'copy')
    }

    args.push(outputPath)

    const proc = spawn(ffmpegPath, args, { windowsHide: true })
    currentProc = proc
    let durationMs = 0
    let totalSizeKb = 0
    let stdoutBuffer = ''
    let stderrTail = ''
    let block: Record<string, string> = {}

    const emitProgress = (): void => {
      const timeMs = Number(block.out_time_us ?? block.out_time_ms ?? 0) / 1000
      totalSizeKb = Math.round(Number(block.total_size ?? 0) / 1024)
      onProgress({
        percent: durationMs > 0 ? Math.min(100, (timeMs / durationMs) * 100) : 0,
        timeMs,
        totalSizeKb,
        speed: block.speed ?? ''
      })
      block = {}
    }

    proc.stdout.setEncoding('utf8')
    proc.stdout.on('data', (chunk: string) => {
      stdoutBuffer += chunk
      const lines = stdoutBuffer.split('\n')
      stdoutBuffer = lines.pop() ?? ''
      for (const line of lines) {
        const separator = line.indexOf('=')
        if (separator === -1) continue
        const key = line.slice(0, separator)
        const value = line.slice(separator + 1)
        if (key === 'progress') {
          emitProgress()
        } else {
          block[key] = value
        }
      }
    })

    proc.stderr.setEncoding('utf8')
    proc.stderr.on('data', (chunk: string) => {
      stderrTail = (stderrTail + chunk).slice(-4096)
      const match = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderrTail)
      if (match) {
        durationMs = (Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])) * 1000
      }
    })

    proc.on('error', (error) => {
      currentProc = null
      reject(error)
    })

    proc.on('close', (code) => {
      currentProc = null
      if (code === 0) {
        onProgress({ percent: 100, timeMs: durationMs, totalSizeKb, speed: '' })
        resolve()
        return
      }
      const detail = stderrTail.trim().split('\n').pop() ?? ''
      reject(new Error(detail || `ffmpeg exited with code ${code}`))
    })
  })
}

function runYtDlpDownload(
  url: string,
  options: DownloadOptions,
  onProgress: (progress: DownloadProgress) => void,
  onInfo: (info: { name?: string; path?: string; note?: string }) => void
): Promise<'done' | 'skipped'> {
  return new Promise((resolve, reject) => {
    const audioOnly = options.mode === 'audio'
    const audioFormat = audioOnly ? validAudioFormat(options.audioFormat) : null
    const audioQuality = validAudioQuality(options.audioQuality)
    const args = [
      '--newline',
      '--no-playlist',
      '--encoding',
      'utf-8',
      '--print',
      'before_dl:TITLE:%(title)s',
      '--print',
      'before_dl:FMT:%(height)s',
      '--print',
      'after_move:PATH:%(filepath)s',
      ...cookieArgs(),
      '--progress-template',
      'download:PROGRESS|%(progress.downloaded_bytes)s|%(progress.total_bytes)s|%(progress.total_bytes_estimate)s|%(progress.speed)s|%(progress.eta)s',
      '--ffmpeg-location',
      dirname(ffmpegPath),
      '-o',
      join(defaultDownloadDir(), '%(title)s.%(ext)s')
    ]

    if (audioFormat) {
      args.push(
        '-x',
        '--audio-format',
        audioFormat,
        '--audio-quality',
        audioQuality === 'best' ? '0' : `${audioQuality}K`,
        '--embed-metadata',
        '-f',
        'ba/b'
      )
      if (options.embedThumbnail) {
        args.push('--embed-thumbnail')
      }
    } else {
      const container = validVideoFormat(options.videoFormat)
      args.push(
        '-f',
        videoFormatSelector(options.quality, container),
        '--merge-output-format',
        container
      )
    }

    args.push(url)

    const proc = spawn(ytDlpPath, args, {
      windowsHide: true,
      env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' }
    })
    currentProc = proc
    let totalSizeKb = 0
    let stdoutBuffer = ''
    let stderrTail = ''
    let skipped = false
    let title: string | null = null
    const requestedHeight =
      options.mode === 'video' && options.quality && /^\d+$/.test(options.quality)
        ? Number(options.quality)
        : 0

    const handleLine = (line: string): void => {
      if (line.startsWith('FMT:')) {
        const height = Number(line.slice('FMT:'.length).trim())
        if (
          requestedHeight > 0 &&
          Number.isFinite(height) &&
          height > 0 &&
          height < requestedHeight
        ) {
          onInfo({
            note: `Requested ${requestedHeight}p, but this site only provided ${height}p. Signing in may unlock higher quality.`
          })
        }
      } else if (line.startsWith('PATH:')) {
        const filePath = line.slice('PATH:'.length).trim()
        if (filePath) onInfo({ name: title ?? basename(filePath), path: filePath })
      } else if (line.startsWith('TITLE:')) {
        const value = line.slice('TITLE:'.length).trim()
        if (value) {
          title = value
          onInfo({ name: value })
        }
      } else {
        const destination = /^\[download\] Destination:\s*(.+)$/.exec(line)
        if (destination && !title) onInfo({ name: basename(destination[1].trim()) })
        const alreadyDownloaded = /^\[download\] (.+) has already been downloaded$/.exec(line)
        if (alreadyDownloaded) {
          skipped = true
          if (!title) onInfo({ name: basename(alreadyDownloaded[1].trim()) })
        }
      }
      if (!line.startsWith('PROGRESS|')) return
      const [, downloaded, total, estimate, speed, eta] = line.split('|')
      const downloadedBytes = Number(downloaded)
      const totalBytes =
        [total, estimate].map(Number).find((value) => Number.isFinite(value) && value > 0) ?? 0
      totalSizeKb = Math.round(downloadedBytes / 1024)
      const etaSeconds = Number(eta)
      onProgress({
        percent: totalBytes > 0 ? Math.min(100, (downloadedBytes / totalBytes) * 100) : 0,
        timeMs: 0,
        totalSizeKb,
        speed: formatSpeed(Number(speed)),
        etaSeconds: Number.isFinite(etaSeconds) ? etaSeconds : undefined
      })
    }

    proc.stdout.setEncoding('utf8')
    proc.stdout.on('data', (chunk: string) => {
      stdoutBuffer += chunk
      const lines = stdoutBuffer.split('\n')
      stdoutBuffer = lines.pop() ?? ''
      for (const line of lines) handleLine(line)
    })

    proc.stderr.setEncoding('utf8')
    proc.stderr.on('data', (chunk: string) => {
      stderrTail = (stderrTail + chunk).slice(-4096)
      for (const line of chunk.split('\n')) handleLine(line)
    })

    proc.on('error', (error) => {
      currentProc = null
      reject(error)
    })

    proc.on('close', (code) => {
      currentProc = null
      if (code === 0) {
        onProgress({ percent: 100, timeMs: 0, totalSizeKb, speed: '' })
        resolve(skipped ? 'skipped' : 'done')
        return
      }
      const detail = stderrTail
        .split('\n')
        .map((line) => line.trim())
        .filter(
          (line) =>
            line.length > 0 && !line.startsWith('PROGRESS|') && !line.startsWith('[download]')
        )
        .slice(-3)
        .join('\n')
      reject(new Error(detail || `yt-dlp exited with code ${code}`))
    })
  })
}
