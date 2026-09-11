# Contributing

Thanks for your interest in improving TryDownload. This guide covers how the app is put together
and the conventions to follow.

## Setup

Requirements:

- [Node.js](https://nodejs.org/) 20.19 or newer
- [Git LFS](https://git-lfs.com/) (needed for the bundled binaries)
- FFmpeg and yt-dlp in `resources/` — see the [README](README.md#binaries)

```bash
git clone https://github.com/luandhng/try-download.git
cd try-download
npm install
npm run setup:binaries
npm run dev
```

`setup:binaries` skips binaries that are already present, so it is safe to run on any platform. See
the [README](README.md#binaries) for details.

Before opening a pull request, make sure these pass:

```bash
npm run typecheck
npm run lint
```

## CI and releases

[`.github/workflows/build.yml`](.github/workflows/build.yml) builds Windows, macOS, and Linux
installers. It runs on every `v*` tag and can also be triggered manually from the Actions tab. On a
tag push it opens a draft GitHub release with the installers attached.

The workflow runs `npm run setup:binaries` on each runner instead of relying on Git LFS, so release
builds always bundle platform-correct binaries. Builds are unsigned by default; add these repository
secrets to sign them:

- Windows: `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD`
- macOS: `MAC_CSC_LINK`, `MAC_CSC_KEY_PASSWORD`, plus `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and
  `APPLE_TEAM_ID` for notarization

## Architecture

TryDownload is a standard Electron app with context isolation enabled and three parts:

### Main process (`src/main`)

Node.js side, one file per concern:

- `index.ts` — app bootstrap, window creation, registers all IPC handlers
- `download.ts` — the download queue; spawns yt-dlp for site downloads and FFmpeg for direct media
  URLs, parses progress output, and streams `queue:item` events to the renderer
- `settings.ts` — loads/saves `settings.json` in `userData`, exposes download directory, theme,
  cookies, and appearance settings
- `history.ts` — loads/saves `downloads.json` in `userData` for the recent downloads list

### Preload (`src/preload`)

- `index.ts` — exposes a typed `window.api` to the renderer via `contextBridge`
- `types.d.ts` — single source of truth for every IPC shape (global declarations shared by all
  three processes)

### Renderer (`src/renderer`)

React 19 + Tailwind CSS v4. `src/App.tsx` holds the main screen (composer, queue status, recent
cards, settings/sites/quality dialogs). Reusable components live in `src/components/`, and
shadcn-style primitives in `src/components/ui/`. The path alias `@/` maps to `src/renderer/src/`.

## Conventions

- TypeScript everywhere; the strict configs are in `tsconfig.node.json` and `tsconfig.web.json`.
- Formatting is enforced by Prettier (`singleQuote`, no semicolons, 100 columns) and ESLint. Run
  `npm run format` before committing.
- Prefer small pure functions with descriptive names over comments; the code should read on its own.
- IPC channels are named `namespace:action` (`download:startQueue`, `settings:update`,
  `downloads:list`). Request/response goes through `ipcMain.handle` / `ipcRenderer.invoke`; push
  updates from main to renderer use `sender.send` (currently `queue:item`).
- Anything crossing the IPC boundary must be typed in `src/preload/types.d.ts`.

## Extending the app

**Adding a format or quality option**

1. Add it to the lists in `src/renderer/src/App.tsx`.
2. Add validation/mapping in `src/main/download.ts` (`videoFormats`, `audioFormats`,
   `qualityHeights`, `audioQualities`).

**Adding a setting**

1. Add the field to `Settings`, its default, and its validation in `src/main/settings.ts`.
2. Include it in `settingsPayload()` and, if it can be changed, in `SettingsPatch`.
3. Add the type to `AppSettings` / `SettingsPatch` in `src/preload/types.d.ts`.
4. Add UI in the settings dialog in `src/renderer/src/App.tsx`.

**Adding an IPC endpoint**

1. Register the handler in the relevant `src/main/*.ts` file.
2. Expose it in `src/preload/index.ts`.
3. Add its signature to the matching API interface in `src/preload/types.d.ts`.

## Pull requests

- Keep changes focused and describe the what and why in the PR.
- Include a screenshot or short recording for UI changes.
- Use concise, imperative commit messages, e.g. `Add M4A audio quality option` or
  `Fix queue stuck after window close`.
- New features should not break the "no DRM circumvention" scope of the app.

## Reporting bugs

Open an issue at <https://github.com/luandhng/try-download/issues> and include:

- OS and app version
- Steps to reproduce
- The URL type or site (only if you can share it)
- Any error message shown in the app
