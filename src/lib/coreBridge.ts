/**
 * Bridge between the UI and the Rust core (player, queue, library, storage).
 * All heavy state lives in Rust; this module is a thin typed invoke layer.
 */

import type { Track } from "../../types";

export type RepeatMode = "off" | "all" | "one";

export interface PlayerSnapshot {
  currentTrack: Track | null;
  transport: "idle" | "loading" | "playing" | "paused" | "error";
  isPlaying: boolean;
  isLoading: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  playbackRate: number;
  shuffle: boolean;
  repeat: RepeatMode;
  queueIndex: number;
  queueLength: number;
  error: string | null;
}

export interface LocalPlaylist {
  id: string;
  name: string;
  description?: string;
  coverUrl?: string;
  trackIds: string[];
  createdAt: number;
  updatedAt?: number;
}

export interface MediaUrls {
  audio: string | null;
  cover: string | null;
}

export interface AppSettings {
  theme: string;
  language: string;
  streamSource: string;
  volume: number;
  username: string;
  djAuthorized: boolean;
}

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
  return tauriInvoke<T>(cmd, args);
}

export const CoreBridge = {
  getApiBase: () => invoke<string>("get_api_base"),
  getSnapshot: () => invoke<PlayerSnapshot>("player_get_snapshot"),
  play: (track: Track, queue?: Track[], startIndex?: number, streamSource?: string) =>
    invoke<PlayerSnapshot>("player_play", {
      request: {
        track,
        queue: queue ?? [],
        startIndex: startIndex ?? 0,
        streamSource: streamSource ?? null,
      },
    }),
  pause: () => invoke<PlayerSnapshot>("player_pause"),
  resume: () => invoke<PlayerSnapshot>("player_resume"),
  setVolume: (volume: number) => invoke<PlayerSnapshot>("player_set_volume", { volume }),
  seek: (seconds: number) => invoke<PlayerSnapshot>("player_seek", { seconds }),
  setRate: (rate: number) => invoke<PlayerSnapshot>("player_set_rate", { rate }),
  syncMedia: (currentTime: number, duration: number, playing: boolean, loading: boolean) =>
    invoke<PlayerSnapshot>("player_sync_media", {
      currentTime,
      duration,
      playing,
      loading,
    }),
  next: (fromEnded = false) => invoke<PlayerSnapshot>("player_next", { fromEnded }),
  prev: () => invoke<PlayerSnapshot>("player_prev"),
  setQueue: (tracks: Track[], startIndex = 0) =>
    invoke<PlayerSnapshot>("queue_set", { tracks, startIndex }),
  toggleShuffle: () => invoke<PlayerSnapshot>("queue_toggle_shuffle"),
  setRepeat: (mode: RepeatMode) => invoke<PlayerSnapshot>("queue_set_repeat", { mode }),
  jump: (index: number) => invoke<PlayerSnapshot>("queue_jump", { index }),

  settingsGet: () => invoke<AppSettings>("settings_get"),
  settingsSet: (settings: AppSettings) => invoke<AppSettings>("settings_set", { settings }),
  settingsMigrate: (payload: Record<string, unknown>) =>
    invoke<AppSettings>("settings_migrate_from_json", { payload }),

  listPlaylists: () => invoke<LocalPlaylist[]>("library_list_playlists"),
  createPlaylist: (name: string, description?: string) =>
    invoke<LocalPlaylist>("library_create_playlist", { name, description: description ?? null }),
  renamePlaylist: (id: string, name: string, description?: string) =>
    invoke<LocalPlaylist>("library_rename_playlist", {
      id,
      name,
      description: description ?? null,
    }),
  deletePlaylist: (id: string) => invoke<void>("library_delete_playlist", { id }),
  duplicatePlaylist: (id: string, suffix = " (Copy)") =>
    invoke<LocalPlaylist>("library_duplicate_playlist", { id, suffix }),
  playlistAddTrack: (playlistId: string, track: Track) =>
    invoke<LocalPlaylist>("library_playlist_add_track", { playlistId, track }),
  playlistRemoveTrack: (playlistId: string, trackId: string) =>
    invoke<LocalPlaylist>("library_playlist_remove_track", { playlistId, trackId }),
  playlistReorder: (playlistId: string, trackIds: string[]) =>
    invoke<LocalPlaylist>("library_playlist_reorder", { playlistId, trackIds }),
  playlistTracks: (playlistId: string) =>
    invoke<Track[]>("library_playlist_tracks", { playlistId }),
  listTracks: () => invoke<Track[]>("library_list_tracks"),
  upsertTrack: (track: Track) => invoke<void>("library_upsert_track", { track }),
  removeTrack: (id: string) => invoke<void>("library_remove_track", { id }),
  setLiked: (tracks: Track[]) => invoke<void>("library_set_liked", { tracks }),
  liked: () => invoke<Track[]>("library_liked"),

  importAudio: (path: string) => invoke<Track>("files_import_audio", { path }),
  mediaUrls: (trackId: string) => invoke<MediaUrls>("files_media_urls", { trackId }),
  writeAudio: (trackId: string, bytes: number[], ext: string) =>
    invoke<void>("files_write_audio", { trackId, bytes, ext }),
  writeCover: (trackId: string, bytes: number[]) =>
    invoke<void>("files_write_cover", { trackId, bytes }),
  writePlaylistCover: (playlistId: string, bytes: number[]) =>
    invoke<void>("files_write_playlist_cover", { playlistId, bytes }),
  playlistCoverUrl: (playlistId: string) =>
    invoke<string | null>("playlist_cover_url", { playlistId }),
};

export async function listenPlayerState(
  handler: (snap: PlayerSnapshot) => void,
): Promise<() => void> {
  const { listen } = await import("@tauri-apps/api/event");
  const un = await listen<PlayerSnapshot>("player://state", (e) => handler(e.payload));
  return () => {
    void un();
  };
}

export async function listenLibraryChanged(
  handler: (payload: { playlists: LocalPlaylist[]; trackCount: number }) => void,
): Promise<() => void> {
  const { listen } = await import("@tauri-apps/api/event");
  const un = await listen<{ playlists: LocalPlaylist[]; trackCount: number }>(
    "library://changed",
    (e) => handler(e.payload),
  );
  return () => {
    void un();
  };
}
