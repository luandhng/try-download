import { app, clipboard, ipcMain, shell } from 'electron'
import { cpSync, mkdirSync } from 'fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'http'
import { dirname, join } from 'path'
import { queueExternalDownload } from './download'

const port = 38472

function bundledExtensionDir(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'chrome-extension')
    : join(__dirname, '../../resources/chrome-extension')
}

export function extensionDir(): string {
  return join(app.getPath('userData'), 'extension', 'chrome-ext (Drag this folder into Chrome)')
}

function prepareExtensionFolder(): string {
  const destination = extensionDir()
  try {
    mkdirSync(dirname(destination), { recursive: true })
    cpSync(bundledExtensionDir(), destination, { recursive: true, force: true })
  } catch {
    // keep any existing copy if the bundled folder is unavailable
  }
  return destination
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = ''
    req.setEncoding('utf8')
    req.on('data', (chunk: string) => {
      body += chunk
      if (body.length > 1_000_000) req.destroy()
    })
    req.on('end', () => resolve(body))
    req.on('error', () => resolve(''))
  })
}

async function requestTargetUrl(req: IncomingMessage, requestUrl: URL): Promise<string> {
  let target = requestUrl.searchParams.get('url') ?? ''
  if (req.method === 'POST') {
    const body = await readBody(req)
    try {
      const parsed = JSON.parse(body) as { url?: unknown }
      if (typeof parsed.url === 'string') target = parsed.url
    } catch {
      const params = new URLSearchParams(body)
      if (params.get('url')) target = params.get('url') ?? target
    }
  }
  return target
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  const requestUrl = new URL(req.url ?? '/', `http://127.0.0.1:${port}`)

  if (req.method === 'GET' && requestUrl.pathname === '/ping') {
    json(res, 200, { ok: true, app: 'Cheepli Download' })
    return
  }

  if (requestUrl.pathname === '/download') {
    try {
      const target = await requestTargetUrl(req, requestUrl)
      const result = await queueExternalDownload(target)
      if (result.canceled) {
        json(res, 409, { ok: false, error: 'Canceled' })
        return
      }
      json(res, 200, { ok: true, queued: result.queued })
    } catch (error) {
      json(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) })
    }
    return
  }

  json(res, 404, { ok: false, error: 'Not found' })
}

export function registerExtensionServer(): void {
  prepareExtensionFolder()

  ipcMain.handle('extension:get-dir', () => prepareExtensionFolder())

  ipcMain.handle('extension:open-folder', () => {
    const dir = prepareExtensionFolder()
    shell.showItemInFolder(dir)
    return dir
  })

  ipcMain.handle('extension:copy-chrome-url', () => {
    clipboard.writeText('chrome://extensions')
    return true
  })

  const server = createServer((req, res) => {
    void handleRequest(req, res)
  })
  server.on('error', () => undefined)
  server.listen(port, '127.0.0.1')
  app.on('before-quit', () => server.close())
}
