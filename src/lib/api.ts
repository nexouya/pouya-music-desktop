/**
 * Runtime API base for the Rust core HTTP server (Tauri).
 * In browser/dev-without-tauri, falls back to same-origin (Express/Vite proxy).
 */

let apiBase = "";
let ready: Promise<void> | null = null;

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function isValidBase(base: string): boolean {
  return /^https?:\/\/127\.0\.0\.1:\d+$/.test(base) && !base.endsWith(":0");
}

async function resolveApiBase(): Promise<string> {
  const { invoke } = await import("@tauri-apps/api/core");
  // Port is bound in Tauri setup before the window loads; retry briefly as a safety net.
  for (let i = 0; i < 40; i++) {
    const base = await invoke<string>("get_api_base");
    if (isValidBase(base)) return base;
    await new Promise((r) => setTimeout(r, 25));
  }
  return invoke<string>("get_api_base");
}

export function initApiBase(): Promise<void> {
  if (ready) return ready;
  ready = (async () => {
    if (!isTauri()) {
      apiBase = "";
      return;
    }
    try {
      apiBase = await resolveApiBase();
      (window as unknown as { __API_BASE__?: string }).__API_BASE__ = apiBase;
    } catch (e) {
      console.error("Failed to resolve API base from Rust core", e);
      apiBase = "";
    }
  })();
  return ready;
}

export function getApiBase(): string {
  return apiBase;
}

/** Prefix relative app paths with the Rust core base. Absolute/blob/data URLs pass through. */
export function apiUrl(path: string): string {
  if (!path) return path;
  if (/^(https?:|blob:|data:|tauri:|file:)/i.test(path)) return path;
  if (path.startsWith("//")) return path;
  const base = apiBase.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  await initApiBase();
  return fetch(apiUrl(path), init);
}

export const isDesktop = isTauri;
