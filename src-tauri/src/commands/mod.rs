use crate::core::player::{PlayRequest, PlayerSnapshot};
use crate::core::queue::RepeatMode;
use crate::core::track::{AppSettings, LocalPlaylist, Track};
use crate::error::AppError;
use crate::state::AppState;
use serde_json::Value;
use std::path::PathBuf;
use tauri::State;

type CmdResult<T> = Result<T, String>;

fn map_err(e: AppError) -> String {
    e.to_string()
}

#[tauri::command]
pub fn get_api_base(state: State<'_, AppState>) -> CmdResult<String> {
    Ok(state.api_base())
}

#[tauri::command]
pub fn player_get_snapshot(state: State<'_, AppState>) -> CmdResult<PlayerSnapshot> {
    Ok(state.core.snapshot())
}

#[tauri::command]
pub fn player_play(state: State<'_, AppState>, request: PlayRequest) -> CmdResult<PlayerSnapshot> {
    state.core.play(request).map_err(map_err)
}

#[tauri::command]
pub fn player_pause(state: State<'_, AppState>) -> CmdResult<PlayerSnapshot> {
    state.core.pause().map_err(map_err)
}

#[tauri::command]
pub fn player_resume(state: State<'_, AppState>) -> CmdResult<PlayerSnapshot> {
    state.core.resume().map_err(map_err)
}

#[tauri::command]
pub fn player_set_volume(state: State<'_, AppState>, volume: f64) -> CmdResult<PlayerSnapshot> {
    state.core.set_volume(volume).map_err(map_err)
}

#[tauri::command]
pub fn player_seek(state: State<'_, AppState>, seconds: f64) -> CmdResult<PlayerSnapshot> {
    state.core.seek(seconds).map_err(map_err)
}

#[tauri::command]
pub fn player_set_rate(state: State<'_, AppState>, rate: f64) -> CmdResult<PlayerSnapshot> {
    state.core.set_rate(rate).map_err(map_err)
}

#[tauri::command]
pub fn player_sync_media(
    state: State<'_, AppState>,
    current_time: f64,
    duration: f64,
    playing: bool,
    loading: bool,
) -> PlayerSnapshot {
    state
        .core
        .sync_media(current_time, duration, playing, loading)
}

#[tauri::command]
pub fn player_next(state: State<'_, AppState>, from_ended: Option<bool>) -> CmdResult<PlayerSnapshot> {
    state.core.next(from_ended.unwrap_or(false)).map_err(map_err)
}

#[tauri::command]
pub fn player_prev(state: State<'_, AppState>) -> CmdResult<PlayerSnapshot> {
    state.core.prev().map_err(map_err)
}

#[tauri::command]
pub fn queue_set(
    state: State<'_, AppState>,
    tracks: Vec<Track>,
    start_index: usize,
) -> CmdResult<PlayerSnapshot> {
    state.core.set_queue(tracks, start_index).map_err(map_err)
}

#[tauri::command]
pub fn queue_toggle_shuffle(state: State<'_, AppState>) -> CmdResult<PlayerSnapshot> {
    state.core.toggle_shuffle().map_err(map_err)
}

#[tauri::command]
pub fn queue_set_repeat(state: State<'_, AppState>, mode: RepeatMode) -> CmdResult<PlayerSnapshot> {
    state.core.set_repeat(mode).map_err(map_err)
}

#[tauri::command]
pub fn queue_jump(state: State<'_, AppState>, index: usize) -> CmdResult<PlayerSnapshot> {
    state.core.jump(index).map_err(map_err)
}

#[tauri::command]
pub fn settings_get(state: State<'_, AppState>) -> CmdResult<AppSettings> {
    Ok(state.core.settings())
}

#[tauri::command]
pub fn settings_set(state: State<'_, AppState>, settings: AppSettings) -> CmdResult<AppSettings> {
    state.core.update_settings(settings).map_err(map_err)
}

#[tauri::command]
pub fn library_list_playlists(state: State<'_, AppState>) -> CmdResult<Vec<LocalPlaylist>> {
    state.core.playlists().map_err(map_err)
}

#[tauri::command]
pub fn library_create_playlist(
    state: State<'_, AppState>,
    name: String,
    description: Option<String>,
) -> CmdResult<LocalPlaylist> {
    state
        .core
        .create_playlist(&name, description.as_deref())
        .map_err(map_err)
}

#[tauri::command]
pub fn library_rename_playlist(
    state: State<'_, AppState>,
    id: String,
    name: String,
    description: Option<String>,
) -> CmdResult<LocalPlaylist> {
    state
        .core
        .rename_playlist(&id, &name, description.as_deref())
        .map_err(map_err)
}

#[tauri::command]
pub fn library_delete_playlist(state: State<'_, AppState>, id: String) -> CmdResult<()> {
    state.core.delete_playlist(&id).map_err(map_err)
}

#[tauri::command]
pub fn library_duplicate_playlist(
    state: State<'_, AppState>,
    id: String,
    suffix: Option<String>,
) -> CmdResult<LocalPlaylist> {
    state
        .core
        .duplicate_playlist(&id, suffix.as_deref().unwrap_or(" (Copy)"))
        .map_err(map_err)
}

#[tauri::command]
pub fn library_playlist_add_track(
    state: State<'_, AppState>,
    playlist_id: String,
    track: Track,
) -> CmdResult<LocalPlaylist> {
    state
        .core
        .playlist_add_track(&playlist_id, track)
        .map_err(map_err)
}

#[tauri::command]
pub fn library_playlist_remove_track(
    state: State<'_, AppState>,
    playlist_id: String,
    track_id: String,
) -> CmdResult<LocalPlaylist> {
    state
        .core
        .playlist_remove_track(&playlist_id, &track_id)
        .map_err(map_err)
}

#[tauri::command]
pub fn library_playlist_reorder(
    state: State<'_, AppState>,
    playlist_id: String,
    track_ids: Vec<String>,
) -> CmdResult<LocalPlaylist> {
    state
        .core
        .playlist_reorder(&playlist_id, track_ids)
        .map_err(map_err)
}

#[tauri::command]
pub fn library_playlist_tracks(
    state: State<'_, AppState>,
    playlist_id: String,
) -> CmdResult<Vec<Track>> {
    state.core.playlist_tracks(&playlist_id).map_err(map_err)
}

#[tauri::command]
pub fn library_list_tracks(state: State<'_, AppState>) -> CmdResult<Vec<Track>> {
    state.core.list_tracks().map_err(map_err)
}

#[tauri::command]
pub fn library_upsert_track(state: State<'_, AppState>, track: Track) -> CmdResult<()> {
    state.core.upsert_track(track).map_err(map_err)
}

#[tauri::command]
pub fn library_remove_track(state: State<'_, AppState>, id: String) -> CmdResult<()> {
    state.core.remove_track(&id).map_err(map_err)
}

#[tauri::command]
pub fn library_set_liked(state: State<'_, AppState>, tracks: Vec<Track>) -> CmdResult<()> {
    state.core.set_liked(tracks).map_err(map_err)
}

#[tauri::command]
pub fn library_liked(state: State<'_, AppState>) -> CmdResult<Vec<Track>> {
    state.core.liked().map_err(map_err)
}

#[tauri::command]
pub async fn files_import_audio(
    state: State<'_, AppState>,
    path: String,
) -> CmdResult<Track> {
    let core = state.core.clone();
    tokio::task::spawn_blocking(move || {
        crate::core::files::FileService::import_audio(&core.storage, &PathBuf::from(path))
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(map_err)
}

#[tauri::command]
pub fn files_media_urls(state: State<'_, AppState>, track_id: String) -> CmdResult<MediaUrls> {
    let base = state.api_base();
    let has_cover = state
        .core
        .storage
        .track_has_cover(&track_id)
        .unwrap_or(false);
    let has_audio = crate::core::files::FileService::audio_path(&state.core.storage, &track_id).is_ok();
    Ok(MediaUrls {
        audio: if has_audio {
            Some(format!("{base}/media/audio/{track_id}"))
        } else {
            None
        },
        cover: if has_cover {
            Some(format!("{base}/media/cover/{track_id}"))
        } else {
            None
        },
    })
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaUrls {
    pub audio: Option<String>,
    pub cover: Option<String>,
}

#[tauri::command]
pub fn files_write_audio(
    state: State<'_, AppState>,
    track_id: String,
    bytes: Vec<u8>,
    ext: String,
) -> CmdResult<()> {
    let ext = ext.trim_start_matches('.').to_lowercase();
    let allowed = ["mp3", "m4a", "aac", "flac", "ogg", "wav", "opus", "webm"];
    if !allowed.contains(&ext.as_str()) {
        return Err("unsupported audio extension".into());
    }
    let core = state.core.clone();
    let dir = core.storage.audio_dir();
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let safe_id: String = track_id
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'))
        .take(128)
        .collect();
    if safe_id.is_empty() {
        return Err("invalid track id".into());
    }
    let path = dir.join(format!("{safe_id}.{ext}"));
    std::fs::write(&path, &bytes).map_err(|e| e.to_string())?;
    if let Ok(Some(mut t)) = core.storage.get_track(&safe_id) {
        t.is_local = true;
        let has_cover = core.storage.track_has_cover(&safe_id).unwrap_or(false);
        let _ = core.storage.upsert_track(&t, Some(&ext), has_cover);
    }
    Ok(())
}

#[tauri::command]
pub fn files_write_cover(
    state: State<'_, AppState>,
    track_id: String,
    bytes: Vec<u8>,
) -> CmdResult<()> {
    crate::core::files::FileService::write_cover(&state.core.storage, &track_id, &bytes)
        .map(|_| ())
        .map_err(map_err)
}

#[tauri::command]
pub fn files_write_playlist_cover(
    state: State<'_, AppState>,
    playlist_id: String,
    bytes: Vec<u8>,
) -> CmdResult<()> {
    crate::core::files::FileService::write_playlist_cover(&state.core.storage, &playlist_id, &bytes)
        .map(|_| ())
        .map_err(map_err)
}

#[tauri::command]
pub fn playlist_cover_url(state: State<'_, AppState>, playlist_id: String) -> CmdResult<Option<String>> {
    let exists = crate::core::files::FileService::playlist_cover_path(
        &state.core.storage,
        &playlist_id,
    )
    .is_ok();
    if exists {
        Ok(Some(format!(
            "{}/media/playlist-cover/{}",
            state.api_base(),
            playlist_id
        )))
    } else {
        Ok(None)
    }
}

/// Import localStorage-style settings from the web app on first desktop run.
#[tauri::command]
pub fn settings_migrate_from_json(
    state: State<'_, AppState>,
    payload: Value,
) -> CmdResult<AppSettings> {
    let mut s = state.core.settings();
    if let Some(theme) = payload.get("theme").and_then(|v| v.as_str()) {
        s.theme = theme.to_string();
    }
    if let Some(lang) = payload.get("language").and_then(|v| v.as_str()) {
        s.language = lang.to_string();
    }
    if let Some(src) = payload.get("streamSource").and_then(|v| v.as_str()) {
        s.stream_source = src.to_string();
    }
    if let Some(vol) = payload.get("volume").and_then(|v| v.as_f64()) {
        s.volume = vol;
    }
    if let Some(name) = payload.get("username").and_then(|v| v.as_str()) {
        s.username = name.to_string();
    }
    if let Some(auth) = payload.get("djAuthorized").and_then(|v| v.as_bool()) {
        s.dj_authorized = auth;
    }
    state.core.update_settings(s).map_err(map_err)
}
