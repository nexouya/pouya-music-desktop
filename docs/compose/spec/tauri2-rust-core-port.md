---
feature: tauri2-rust-core-port
status: delivered
updated: 2026-06-06
branch: feature/tauri2-rust-core
commits: d1b7ce3..fc6f717
---

# Tauri 2 + Rust Core Port (Windows Desktop)

## Report

**What was built** — Pouya Music is now a Tauri 2 desktop app whose application core is Rust. The Rust crate owns the player state machine, queue (shuffle bag + repeat modes), playlists, SQLite persistence, local audio/cover files with ID3 metadata (lofty), an axum HTTP server that preserves the Express contract (`/api/*`, `/yt/*`) and adds `/media/*` with Range support, OpenRouter AI (SSE chat/curate), iTunes proxy, yt-dlp stream orchestration, and ffmpeg Audio Lab. Tauri is only the IPC bridge (commands + events + window). The React UI, Motion animations, glass/blur styling, Three.js visualizer, and Web Audio graph (8D/EQ/filter/echo/analyser) are preserved without visual simplification. Thin frontend adapters (`src/lib/api.ts`, `coreBridge.ts`, `playbackSync.ts`) rewrite relative URLs and sync play/next/prev/shuffle/repeat/volume to the Rust core on desktop; on pure web the same code falls back to the existing Express path. Queue next/prev is single-writer in Rust, which removes the double-advance race from the old frontend-only `onTrackEnded` handler.

**Verification** —
- `package.json` / `tauri.conf.json` / `capabilities/default.json` parse: **PASS**
- Static review of command ↔ invoke_handler registration: **PASS** (all commands registered)
- Frontend `fetch` + `XMLHttpRequest.open` bridge installed in `main.tsx`: **PASS**
- HTTP route set matches Express surface used by App/DJStudio/AICurator/AudioLab/RecommendationEngine: **PASS**
- Independent reviewer found 7 criticals; all 7 fixed and re-checked (Default conflict, Connection `!Sync`, axum `{param}`, ChatBody camelCase, queue test, missing resources, port-0 race): **PASS (fixes applied)**
- `cargo test` / `cargo check` / `vite build` / installer: **DEFERRED** to GitHub Actions (`.github/workflows/build-windows.yml`) per project constraint (no local MSVC / no local build)

**Journey log** —
1. Linked worktree was blocked by sandbox; used in-place branch `feature/tauri2-rust-core` instead.
2. crates.io was flaky; used project-local `src-tauri/.cargo/config.toml` rsproxy sparse mirror for lockfile generation only.
3. Local MSVC/link.exe unavailable; stopped local builds and moved packaging to GitHub Actions as requested.
4. Reviewer caught axum 0.8 `:param` panic and rusqlite `!Sync` — both are easy to miss without a real compile; worth checking on every axum/Tauri port.
5. Bulk regex on `storage.rs` briefly turned `conn()` into infinite recursion; fixed immediately after.

## [S1] Problem

Pouya Music was a React + Express web player that needed a native Windows desktop shell with Rust as the real core (player, queue, playlists, files, metadata, storage, events), without removing or simplifying any UI feature or visual.

## [S2] Design

### Architecture

```
WebView (React UI — preserved 1:1)
   │  Tauri IPC + HTTP
   ▼
Tauri 2 shell
   ▼
Rust core
  player · queue · library · storage · files · metadata · events
  axum /api /yt /media · OpenRouter · iTunes · yt-dlp · ffmpeg
```

Rust is the single writer for queue/current track. The WebView HTMLAudioElement + Web Audio graph keeps visualizer fidelity. axum serves the same HTTP URLs the web app already used.

### Key contracts

- Tauri commands in `src-tauri/src/commands/mod.rs` (player/queue/library/files/settings)
- Events: `player://state`, `queue://changed`, `library://changed`, `app://toast`
- HTTP: Express endpoints ported; `/media/audio|cover|playlist-cover` added
- Frontend: `initApiBase()` + `apiUrl()` + fetch/XHR bridges; `playbackSync` on desktop
- Storage: SQLite `core.db` + `audio/` `covers/` `playlist-covers/` under app data dir

### Bug fixes included

1. Queue double-advance race → Rust single-writer next/prev
2. Stream-source guard enforced in Rust and UI
3. Strict YouTube never falls back to iTunes
4. Path traversal guard for audiolab files
5. OpenRouter key balancer mutex-protected
6. XHR (AudioLab) and fetch both rewrite to core HTTP base
7. API base never cached as port 0 (sync bind + retry)

## [S3] Out of Scope

- Local MSVC install / local `tauri build` (CI only)
- macOS/Linux packaging polish
- Replacing Web Audio with rodio/cpal (would break visualizer)
- Deleting the legacy Electron scripts (kept unused)

## Tasks

- [x] T1: Scaffold Tauri 2 app + Cargo + tauri.conf + capabilities (covers: S2)
- [x] T2: Core domain (track, queue, player, library) + SQLite + unit tests (covers: S2)
- [x] T3: axum HTTP server with /api, /yt, /media + range streaming (covers: S2)
- [x] T4: Port AI (OpenRouter SSE), Audio Lab (ffmpeg), yt-dlp stream resolve (covers: S2)
- [x] T5: Tauri commands + events + get_api_base wiring (covers: S2)
- [x] T6: Frontend adapter api.ts + LocalMusicStore → Rust media URLs (covers: S2)
- [x] T7: GitHub Actions Windows build workflow + TAURI.md (covers: S2)
- [x] T8: Static verify + reviewer criticals fixed (covers: S2)
- [x] T9: Re-check critical fixes after review (covers: S2)
