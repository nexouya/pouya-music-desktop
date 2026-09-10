# Pouya Music — Tauri 2 Desktop (Rust Core)

Native Windows desktop port of the Pouya Music web app.

## Architecture

```
WebView (React UI, identical to the web app)
   │  Tauri IPC commands/events
   │  HTTP (streaming, AI, media)
   ▼
Tauri 2 shell
   │
   ▼
Rust core (src-tauri)
  · player state machine + queue (shuffle/repeat) — single writer
  · library + playlists (SQLite)
  · local files + ID3 metadata (lofty)
  · axum HTTP: /api, /yt, /media  (same contract as Express)
  · OpenRouter AI, iTunes proxy, yt-dlp streams, ffmpeg Audio Lab
```

Rust owns playback *state*, queue advance, library persistence, and native I/O.
The WebView keeps HTML5 Audio + Web Audio so the Three.js visualizer and 8D/EQ graph stay pixel-identical.

## Prerequisites (dev machine)

- Node.js 20+
- Rust stable (`x86_64-pc-windows-msvc`)
- Visual Studio Build Tools with **Desktop development with C++**
- WebView2 Runtime (preinstalled on Windows 10/11)

> Builds are intended to run on **GitHub Actions** (see `.github/workflows/build-windows.yml`).
> Local install of VS Build Tools is only needed if you want `npm run tauri:dev` on this PC.

## Optional sidecars

Place in `bin/`:

- `yt-dlp.exe` — YouTube search/stream/download
- `ffmpeg.exe` / `ffprobe.exe` — Audio Lab processing

Without them, YouTube/Audio Lab degrade gracefully; local files, iTunes, and AI still work.

## Commands

```bash
npm install

# Web (legacy Express + Vite) — unchanged
npm run dev

# Desktop
npm run tauri:dev      # requires local Rust + MSVC
npm run tauri:build    # NSIS/MSI under src-tauri/target/release/bundle/
```

Typecheck frontend:

```bash
npm run lint
```

Rust unit tests (core queue/storage):

```bash
cd src-tauri && cargo test --lib
```

## Data locations

| Data | Location |
|------|----------|
| SQLite `core.db` | `%APPDATA%/com.pouya.music/` |
| Audio files | `…/audio/{trackId}.{ext}` |
| Covers | `…/covers/` `…/playlist-covers/` |
| Audio Lab temp | `…/uploads/` |

## What was preserved

- All UI screens, Motion animations, glass/blur, Three.js visualizer modes
- DJ Studio, Audio Lab, AI Curator, Local World, Explore, Search
- Stream-source guard (`youtube` / `spotify` / `both`)
- Media keys via MediaSession
- Fa/en locales, dark/light theme

## What moved to Rust

- Queue ownership (next/prev/shuffle/repeat) — fixes double-advance races
- Playlist CRUD + persistence (was localStorage/localforage)
- Local audio storage on disk (was IndexedDB blobs)
- Express API surface (axum) including SSE AI chat/curate
- yt-dlp orchestration, iTunes proxy, ffmpeg processing, OpenRouter balancer
