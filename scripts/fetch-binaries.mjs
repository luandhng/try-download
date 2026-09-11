import {
  chmodSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
  statSync
} from 'fs'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { execFileSync } from 'child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const force = args.includes('--force')
const dirArg = args.find((arg) => arg.startsWith('--dir='))
const outputDir = resolve(dirArg ? dirArg.slice('--dir='.length) : join(root, 'resources'))
const ffmpegTag = process.env.FFMPEG_STATIC_TAG ?? 'b6.1.1'

const { platform, arch } = process

const ffmpegAsset = {
  win32: { x64: 'ffmpeg-win32-x64', arm64: 'ffmpeg-win32-x64' },
  darwin: { x64: 'ffmpeg-darwin-x64', arm64: 'ffmpeg-darwin-arm64' },
  linux: { x64: 'ffmpeg-linux-x64', arm64: 'ffmpeg-linux-arm64' }
}[platform]?.[arch]

const ytDlpAsset = {
  win32: 'yt-dlp.exe',
  darwin: 'yt-dlp_macos',
  linux: arch === 'x64' ? 'yt-dlp_linux' : arch === 'arm64' ? 'yt-dlp_linux_aarch64' : undefined
}[platform]

const targets = [
  {
    name: 'ffmpeg',
    file: platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg',
    url: ffmpegAsset
      ? `https://github.com/eugeneware/ffmpeg-static/releases/download/${ffmpegTag}/${ffmpegAsset}`
      : undefined
  },
  {
    name: 'yt-dlp',
    file: platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp',
    url: ytDlpAsset
      ? `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${ytDlpAsset}`
      : undefined
  }
]

function isUsableBinary(file) {
  return existsSync(file) && statSync(file).size > 1024
}

function adhocSign(file) {
  if (platform !== 'darwin') return
  try {
    execFileSync('codesign', ['--force', '--sign', '-', file], { stdio: 'ignore' })
  } catch {
    console.warn(`Warning: could not ad-hoc sign ${file}; macOS may refuse to run it`)
  }
}

function prepareBinary(file) {
  if (platform === 'win32') return
  chmodSync(file, 0o755)
  adhocSign(file)
}

async function download(url, destination) {
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok || !response.body) {
    throw new Error(`Request failed with status ${response.status}`)
  }
  const total = Number(response.headers.get('content-length') ?? 0)
  const temporary = `${destination}.part`
  await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary))
  renameSync(temporary, destination)
  return total
}

mkdirSync(outputDir, { recursive: true })

let failed = false
for (const target of targets) {
  const destination = join(outputDir, target.file)

  if (!target.url) {
    console.error(`Cannot fetch ${target.name}: no prebuilt binary for ${platform}-${arch}`)
    console.error(`Download it manually and place it at ${destination}`)
    failed = true
    continue
  }

  if (!force && isUsableBinary(destination)) {
    console.log(`${target.file} already present, skipping (use --force to re-download)`)
    prepareBinary(destination)
    continue
  }

  process.stdout.write(`Downloading ${target.file} for ${platform}-${arch}... `)
  try {
    const bytes = await download(target.url, destination)
    prepareBinary(destination)
    console.log(`done${bytes ? ` (${(bytes / 1024 / 1024).toFixed(1)} MB)` : ''}`)
  } catch (error) {
    rmSync(`${destination}.part`, { force: true })
    console.error('failed')
    console.error(error instanceof Error ? error.message : String(error))
    failed = true
  }
}

if (failed) process.exitCode = 1
