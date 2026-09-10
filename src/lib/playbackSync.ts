/**
 * Keeps the React playback UI in sync with the Rust core (single-writer queue).
 * On pure web this module is a no-op.
 */

import type { Track } from "../../types";
import { CoreBridge, PlayerSnapshot, RepeatMode } from "./coreBridge";
import { isDesktop } from "./api";

export async function syncPlay(
  track: Track,
  queue: Track[],
  startIndex: number,
  streamSource: string,
): Promise<void> {
  if (!isDesktop()) return;
  try {
    await CoreBridge.play(track, queue.length ? queue : [track], Math.max(0, startIndex), streamSource);
  } catch (e) {
    console.warn("Rust core play sync failed", e);
  }
}

export async function syncNext(fromEnded: boolean): Promise<PlayerSnapshot | null> {
  if (!isDesktop()) return null;
  try {
    return await CoreBridge.next(fromEnded);
  } catch (e) {
    console.warn("Rust core next failed", e);
    return null;
  }
}

export async function syncPrev(): Promise<PlayerSnapshot | null> {
  if (!isDesktop()) return null;
  try {
    return await CoreBridge.prev();
  } catch (e) {
    console.warn("Rust core prev failed", e);
    return null;
  }
}

export async function syncShuffleToggle(): Promise<void> {
  if (!isDesktop()) return;
  try {
    await CoreBridge.toggleShuffle();
  } catch (e) {
    console.warn("Rust core shuffle failed", e);
  }
}

export async function syncRepeat(mode: RepeatMode): Promise<void> {
  if (!isDesktop()) return;
  try {
    await CoreBridge.setRepeat(mode);
  } catch (e) {
    console.warn("Rust core repeat failed", e);
  }
}

export async function syncVolume(volume: number): Promise<void> {
  if (!isDesktop()) return;
  try {
    await CoreBridge.setVolume(volume);
  } catch (e) {
    console.warn("Rust core volume failed", e);
  }
}

export async function syncPause(): Promise<void> {
  if (!isDesktop()) return;
  try {
    await CoreBridge.pause();
  } catch {
    /* ignore */
  }
}

export async function syncResume(): Promise<void> {
  if (!isDesktop()) return;
  try {
    await CoreBridge.resume();
  } catch {
    /* ignore */
  }
}

/** Migrate web localStorage prefs into Rust settings once per install. */
export async function migrateWebPrefsOnce(): Promise<void> {
  if (!isDesktop()) return;
  const flag = "pouya_core_migrated_v1";
  try {
    if (localStorage.getItem(flag) === "1") return;
    const payload = {
      theme: localStorage.getItem("spotify_clone_theme") || "dark",
      language: localStorage.getItem("spotify_clone_lang") || "fa",
      streamSource: localStorage.getItem("pouya_stream_source") || "both",
      volume: 0.8,
      username: localStorage.getItem("pouya_music_username") || "Guest Finder",
      djAuthorized: localStorage.getItem("dj_studio_auth") === "true",
    };
    await CoreBridge.settingsMigrate(payload);
    localStorage.setItem(flag, "1");
  } catch (e) {
    console.warn("settings migrate failed", e);
  }
}
