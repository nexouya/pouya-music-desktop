import localforage from 'localforage';
import { Track } from './types';
import { isDesktop } from './src/lib/api';
import { CoreBridge, LocalPlaylist as RustPlaylist } from './src/lib/coreBridge';

// Initialize a specific instance for music blobs (web / non-Tauri fallback)
const musicStorage = localforage.createInstance({
  name: "PouyaMusic",
  storeName: "local_audio_blobs"
});

export interface LocalPlaylist {
  id: string;
  name: string;
  description?: string;
  coverUrl?: string;
  trackIds: string[]; // references tracks stored in localforage or Rust core
  createdAt: number;
  updatedAt?: number;
}

function toUiPlaylist(p: RustPlaylist): LocalPlaylist {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    coverUrl: p.coverUrl,
    trackIds: p.trackIds,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

async function blobToBytes(blob: Blob): Promise<number[]> {
  const buf = await blob.arrayBuffer();
  return Array.from(new Uint8Array(buf));
}

export class LocalMusicStore {
  // Store playlists metadata in localStorage for fast synchronous read (web).
  // On desktop, Rust SQLite is the source of truth; this cache is refreshed async.
  private static desktopCache: LocalPlaylist[] = [];

  static getPlaylists(): LocalPlaylist[] {
    if (isDesktop()) {
      return this.desktopCache;
    }
    try {
      const data = localStorage.getItem("pouyamusic_local_playlists");
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  static async refreshFromCore(): Promise<LocalPlaylist[]> {
    if (!isDesktop()) return this.getPlaylists();
    const list = await CoreBridge.listPlaylists();
    this.desktopCache = list.map(toUiPlaylist);
    return this.desktopCache;
  }

  static savePlaylists(playlists: LocalPlaylist[]) {
    if (isDesktop()) {
      this.desktopCache = playlists;
      return;
    }
    localStorage.setItem("pouyamusic_local_playlists", JSON.stringify(playlists));
  }

  static async createPlaylist(name: string, description?: string): Promise<LocalPlaylist> {
    if (isDesktop()) {
      const pl = await CoreBridge.createPlaylist(name, description);
      await this.refreshFromCore();
      return toUiPlaylist(pl);
    }
    const playlists = this.getPlaylists();
    const newPlaylist: LocalPlaylist = {
      id: `local-pl-${Date.now()}`,
      name,
      description: description || "",
      trackIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    playlists.push(newPlaylist);
    this.savePlaylists(playlists);
    return newPlaylist;
  }

  static async renamePlaylist(playlistId: string, newName: string, newDescription?: string): Promise<boolean> {
    if (isDesktop()) {
      try {
        await CoreBridge.renamePlaylist(playlistId, newName, newDescription);
        await this.refreshFromCore();
        return true;
      } catch {
        return false;
      }
    }
    const playlists = this.getPlaylists();
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist) return false;
    playlist.name = newName;
    if (newDescription !== undefined) playlist.description = newDescription;
    playlist.updatedAt = Date.now();
    this.savePlaylists(playlists);
    return true;
  }

  static async reorderTracks(playlistId: string, newTrackIds: string[]): Promise<boolean> {
    if (isDesktop()) {
      try {
        await CoreBridge.playlistReorder(playlistId, newTrackIds);
        await this.refreshFromCore();
        return true;
      } catch {
        return false;
      }
    }
    const playlists = this.getPlaylists();
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist) return false;
    playlist.trackIds = newTrackIds;
    playlist.updatedAt = Date.now();
    this.savePlaylists(playlists);
    return true;
  }

  static async duplicatePlaylist(playlistId: string, suffix: string = " (Copy)"): Promise<LocalPlaylist | null> {
    if (isDesktop()) {
      try {
        const pl = await CoreBridge.duplicatePlaylist(playlistId, suffix);
        await this.refreshFromCore();
        return toUiPlaylist(pl);
      } catch {
        return null;
      }
    }
    const playlists = this.getPlaylists();
    const source = playlists.find(p => p.id === playlistId);
    if (!source) return null;

    const newId = `local-pl-${Date.now()}`;
    const newPlaylist: LocalPlaylist = {
      id: newId,
      name: `${source.name}${suffix}`,
      description: source.description || "",
      coverUrl: source.coverUrl,
      trackIds: [...source.trackIds],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // If source had a blob cover, duplicate cover in storage
    if (source.coverUrl === "blob") {
      const coverBlob = await musicStorage.getItem<Blob>(`pl-cover-${source.id}`);
      if (coverBlob) {
        await musicStorage.setItem(`pl-cover-${newId}`, coverBlob);
      }
    }

    playlists.push(newPlaylist);
    this.savePlaylists(playlists);
    return newPlaylist;
  }

  static async addTrackToPlaylist(playlistId: string, track: Track, audioBlob: Blob, coverBlob?: Blob) {
    if (isDesktop()) {
      await CoreBridge.upsertTrack({ ...track, isLocal: true, url: "", source: "local" });
      if (coverBlob) {
        await CoreBridge.writeCover(track.id, await blobToBytes(coverBlob));
      }
      const ext = guessExt(audioBlob.type, track.title);
      await CoreBridge.writeAudio(track.id, Array.from(new Uint8Array(await audioBlob.arrayBuffer())), ext);
      await CoreBridge.playlistAddTrack(playlistId, { ...track, isLocal: true });
      await this.refreshFromCore();
      return;
    }

    const playlists = this.getPlaylists();
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist) throw new Error("Playlist not found");

    // Store blobs
    await musicStorage.setItem(`audio-${track.id}`, audioBlob);
    if (coverBlob) {
      await musicStorage.setItem(`cover-${track.id}`, coverBlob);
    }

    // We don't want to store Blob URLs in localStorage because they expire.
    // Instead we store the track metadata without the ephemeral URL.
    const metaTrack = { ...track, url: "", coverUrl: coverBlob ? "" : track.coverUrl };
    await musicStorage.setItem(`meta-${track.id}`, metaTrack);

    playlist.trackIds.push(track.id);
    playlist.updatedAt = Date.now();
    this.savePlaylists(playlists);
  }

  static async getTracksForPlaylist(playlistId: string): Promise<Track[]> {
    if (isDesktop()) {
      try {
        const tracks = await CoreBridge.playlistTracks(playlistId);
        const resolved: Track[] = [];
        for (const t of tracks) {
          const urls = await CoreBridge.mediaUrls(t.id);
          resolved.push({
            ...t,
            isLocal: true,
            url: urls.audio ?? t.url,
            coverUrl: urls.cover ?? t.coverUrl,
          });
        }
        // Fallback to localforage blobs for tracks imported before Rust migration
        if (resolved.length === 0) {
          return this.getTracksForPlaylistWeb(playlistId);
        }
        return resolved;
      } catch {
        return this.getTracksForPlaylistWeb(playlistId);
      }
    }
    return this.getTracksForPlaylistWeb(playlistId);
  }

  private static async getTracksForPlaylistWeb(playlistId: string): Promise<Track[]> {
    const playlists = this.getPlaylists();
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist) return [];

    const tracks: Track[] = [];
    for (const trackId of playlist.trackIds) {
      const meta = await musicStorage.getItem<Track>(`meta-${trackId}`);
      if (meta) {
        const audioBlob = await musicStorage.getItem<Blob>(`audio-${trackId}`);
        const coverBlob = await musicStorage.getItem<Blob>(`cover-${trackId}`);

        const track: Track = { ...meta };
        if (audioBlob) track.url = URL.createObjectURL(audioBlob);
        if (coverBlob) track.coverUrl = URL.createObjectURL(coverBlob);

        tracks.push(track);
      }
    }
    return tracks;
  }

  static async updatePlaylistCover(playlistId: string, coverBlob: Blob) {
    if (isDesktop()) {
      await CoreBridge.writePlaylistCover(playlistId, await blobToBytes(coverBlob));
      await CoreBridge.playlistCoverUrl(playlistId);
      await this.refreshFromCore();
      return;
    }
    const playlists = this.getPlaylists();
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist) return;

    await musicStorage.setItem(`pl-cover-${playlistId}`, coverBlob);
    playlist.coverUrl = "blob"; // marker
    playlist.updatedAt = Date.now();
    this.savePlaylists(playlists);
  }

  static async getPlaylistCover(playlistId: string): Promise<string | undefined> {
    if (isDesktop()) {
      const url = await CoreBridge.playlistCoverUrl(playlistId);
      return url ?? undefined;
    }
    const blob = await musicStorage.getItem<Blob>(`pl-cover-${playlistId}`);
    if (blob) return URL.createObjectURL(blob);
    return undefined;
  }

  static async deletePlaylist(playlistId: string) {
    if (isDesktop()) {
      await CoreBridge.deletePlaylist(playlistId);
      await this.refreshFromCore();
      return;
    }
    const playlists = this.getPlaylists();
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist) return;

    // Check which tracks are only used in this playlist before removing blobs
    const otherPlaylists = playlists.filter(p => p.id !== playlistId);
    const otherTrackIds = new Set(otherPlaylists.flatMap(p => p.trackIds));

    for (const trackId of playlist.trackIds) {
      if (!otherTrackIds.has(trackId)) {
        await musicStorage.removeItem(`audio-${trackId}`);
        await musicStorage.removeItem(`cover-${trackId}`);
        await musicStorage.removeItem(`meta-${trackId}`);
      }
    }

    await musicStorage.removeItem(`pl-cover-${playlistId}`);

    const updated = playlists.filter(p => p.id !== playlistId);
    this.savePlaylists(updated);
  }

  static async deleteTrack(playlistId: string, trackId: string) {
    if (isDesktop()) {
      await CoreBridge.playlistRemoveTrack(playlistId, trackId);
      await this.refreshFromCore();
      return;
    }
    const playlists = this.getPlaylists();
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist) return;

    playlist.trackIds = playlist.trackIds.filter(id => id !== trackId);
    playlist.updatedAt = Date.now();
    this.savePlaylists(playlists);

    // Only remove blob if not referenced by any other playlist
    const anyOtherUses = playlists.some(p => p.id !== playlistId && p.trackIds.includes(trackId));
    if (!anyOtherUses) {
      await musicStorage.removeItem(`audio-${trackId}`);
      await musicStorage.removeItem(`cover-${trackId}`);
      await musicStorage.removeItem(`meta-${trackId}`);
    }
  }

  static async getStorageStats(): Promise<{ totalPlaylists: number; totalTracks: number; approximateBytes: number }> {
    if (isDesktop()) {
      await this.refreshFromCore();
    }
    const playlists = this.getPlaylists();
    const uniqueTrackIds = new Set(playlists.flatMap(p => p.trackIds));

    let approximateBytes = 0;
    try {
      if (!isDesktop() && navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        approximateBytes = estimate.usage || 0;
      } else {
        approximateBytes = uniqueTrackIds.size * 5 * 1024 * 1024;
      }
    } catch {
      approximateBytes = uniqueTrackIds.size * 5 * 1024 * 1024; // Fallback estimate ~5MB/track
    }

    return {
      totalPlaylists: playlists.length,
      totalTracks: uniqueTrackIds.size,
      approximateBytes
    };
  }
}

function guessExt(mime: string, title: string): string {
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  if (mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac")) return "m4a";
  if (mime.includes("flac")) return "flac";
  if (mime.includes("ogg") || mime.includes("vorbis")) return "ogg";
  if (mime.includes("wav")) return "wav";
  const m = title.match(/\.([a-z0-9]{2,4})$/i);
  return m ? m[1].toLowerCase() : "mp3";
}
