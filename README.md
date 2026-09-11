# TryDownload

![TryDownload icon](build/icon.png)

Desktop app for downloading video and audio from thousands of sites. Built with Electron, React,
and TypeScript, powered by [yt-dlp](https://github.com/yt-dlp/yt-dlp) and
[FFmpeg](https://ffmpeg.org/).

## Features

- **Video downloads** as MP4, MKV, or WEBM, up to 2160p
- **Audio extraction** as MP3 or M4A, with optional cover art embedding
- **Batch downloads**: paste one URL per line
- **Live progress** with speed, size, and ETA where available
- **Recent downloads** with open-in-folder and remove actions
- **Quality check**: warns when a site cannot provide the requested resolution
- **Browser cookies** for members-only or higher-quality streams
- **Customizable**: download folder, light/dark/system theme, animated background and accent color

## Supported sites

TryDownload works with anything yt-dlp supports, including: YouTube, YouTube Music, Vimeo,
Dailymotion, TikTok, Instagram, Facebook, X (Twitter), Reddit, Twitch, SoundCloud, Bandcamp,
Mixcloud, Bilibili, Niconico, Rumble, Odysee, VK, Loom, Streamable, Archive.org, BBC iPlayer, TED,
and direct media URLs.

DRM services (Netflix, Disney+, Spotify, Apple Music, and similar) are not supported.

## Requirements

- [Node.js](https://nodejs.org/) 20.19 or newer
- [Git LFS](https://git-lfs.com/) — the bundled Windows binaries (`resources/ffmpeg.exe`,
  `resources/yt-dlp.exe`) are stored with Git LFS. Without Git LFS you get pointer files instead of
  executables.

Windows is the supported platform out of the box. The app also runs on macOS and Linux, but you must
provide the binaries yourself (see [Binaries](#binaries)).

## Getting started

```bash
git clone https://github.com/luandhng/try-download.git
cd try-download
npm install
npm run dev
```

### Binaries

The app looks for FFmpeg and yt-dlp in `resources/`, with the `.exe` suffix on Windows:

| Platform | FFmpeg       | yt-dlp       |
| -------- | ------------ | ------------ |
| Windows  | `ffmpeg.exe` | `yt-dlp.exe` |
| macOS    | `ffmpeg`     | `yt-dlp`     |
| Linux    | `ffmpeg`     | `yt-dlp`     |

Only the Windows binaries are committed (via Git LFS). On macOS and Linux, download your own and
place them in `resources/`, then make them executable:

```bash
# yt-dlp: https://github.com/yt-dlp/yt-dlp/releases
#   macOS: yt-dlp_macos   Linux: yt-dlp_linux
# ffmpeg: any static build from https://ffmpeg.org/download.html
chmod +x resources/ffmpeg resources/yt-dlp
```

Keep other-platform binaries out of git unless you intend to store them with Git LFS.

## Scripts

| Command               | Description                                                    |
| --------------------- | -------------------------------------------------------------- |
| `npm run dev`         | Start the app in development mode with hot reload              |
| `npm run typecheck`   | Type-check the main/preload (`node`) and renderer (`web`) code |
| `npm run lint`        | Run ESLint                                                     |
| `npm run format`      | Format all files with Prettier                                 |
| `npm run build`       | Type-check and bundle the app                                  |
| `npm run build:win`   | Build a Windows installer (NSIS)                               |
| `npm run build:mac`   | Build a macOS disk image                                       |
| `npm run build:linux` | Build AppImage, snap, and deb packages                         |

`build:mac` and `build:linux` must run on the target operating system (or in a matching CI runner)
and require the corresponding binaries in `resources/`.

## Project structure

```
src/
  main/       Electron main process (Node.js)
    index.ts      app bootstrap and window creation
    download.ts   download queue: spawns yt-dlp and ffmpeg, parses progress
    settings.ts   settings persistence and IPC handlers
    history.ts    recent downloads persistence and IPC handlers
  preload/    Context-isolated bridge
    index.ts      exposes window.api over IPC
    types.d.ts    shared IPC types (global .d.ts)
  renderer/   React UI
    src/App.tsx             main screen: composer, queue, recent cards, dialogs
    src/components/         app components and shadcn-style primitives in ui/
resources/    ffmpeg/yt-dlp binaries and the app icon
build/        installer resources (icons, entitlements)
```

## How it works

1. The renderer collects URLs and options, then calls `window.api.startQueue()`.
2. The main process processes the queue one item at a time in `src/main/download.ts`.
3. Direct media URLs (e.g. `.mp4`, `.mp3`) are downloaded with FFmpeg; everything else goes through
   yt-dlp, which uses FFmpeg for merging and conversion.
4. Progress lines are parsed and streamed to the renderer as `queue:item` events.
5. Completed downloads are recorded in `downloads.json`; settings live in `settings.json`. Both are
   stored in Electron's `userData` directory.

See [CONTRIBUTING.md](CONTRIBUTING.md) for architecture details and conventions.

## License

[MIT](LICENSE)

### Third-party notices

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) is released under the Unlicense (public domain).
  TryDownload is not affiliated with the yt-dlp project.
- [FFmpeg](https://ffmpeg.org/legal.html) is a separate program invoked by this app. The bundled
  Windows build is distributed under its own license; if you redistribute this app, review that
  license and provide the corresponding FFmpeg sources or a link to them.
- Other dependencies are covered by their respective licenses.

## Disclaimer

Download only content you own or have permission to download. Respect the terms of service of the
sites you use.
