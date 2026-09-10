mod ai;
mod audiolab;
mod commands;
mod core;
mod error;
mod http;
mod state;
mod streams;

use std::sync::Arc;

use tauri::Manager;
use tracing_subscriber::EnvFilter;

use crate::core::Core;
use crate::http::HttpShared;
use crate::state::AppState;
use crate::streams::ytdlp;
use crate::audiolab::Ffmpeg;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("info,tower_http=info")),
        )
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let data_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::path::PathBuf::from("./data"));
            std::fs::create_dir_all(&data_dir)?;

            let core = Core::new(data_dir.clone())?;
            core.events.attach(app.handle().clone());

            let resource_dir = app.path().resource_dir().ok();
            let yt = ytdlp::YtDlp::discover(resource_dir.as_deref());
            let ffmpeg = Ffmpeg::discover(resource_dir.as_deref());
            let ai = Arc::new(ai::OpenRouterBalancer::from_env_or_default());

            let shared = Arc::new(HttpShared {
                core: core.clone(),
                yt,
                ffmpeg,
                meta_cache: ytdlp::new_meta_cache(),
                ai,
                api_port: parking_lot::RwLock::new(0),
            });

            // Manage state BEFORE binding HTTP so the server can publish the port.
            app.manage(AppState::new(core.clone()));

            let router = http::router(shared.clone());

            // Bind synchronously so get_api_base never returns port 0.
            let std_listener = std::net::TcpListener::bind("127.0.0.1:0")
                .map_err(|e| format!("failed to bind core HTTP: {e}"))?;
            let port = std_listener
                .local_addr()
                .map_err(|e| e.to_string())?
                .port();
            std_listener
                .set_nonblocking(true)
                .map_err(|e| e.to_string())?;
            let listener = tokio::net::TcpListener::from_std(std_listener)
                .map_err(|e| format!("failed to convert listener: {e}"))?;

            *shared.api_port.write() = port;
            if let Some(state) = app.try_state::<AppState>() {
                state.set_api_port(port);
            }
            tracing::info!("Pouya Music core HTTP listening on 127.0.0.1:{port}");

            tauri::async_runtime::spawn(async move {
                if let Err(e) = axum::serve(listener, router).await {
                    tracing::error!("core HTTP server exited: {e}");
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_api_base,
            commands::player_get_snapshot,
            commands::player_play,
            commands::player_pause,
            commands::player_resume,
            commands::player_set_volume,
            commands::player_seek,
            commands::player_set_rate,
            commands::player_sync_media,
            commands::player_next,
            commands::player_prev,
            commands::queue_set,
            commands::queue_toggle_shuffle,
            commands::queue_set_repeat,
            commands::queue_jump,
            commands::settings_get,
            commands::settings_set,
            commands::settings_migrate_from_json,
            commands::library_list_playlists,
            commands::library_create_playlist,
            commands::library_rename_playlist,
            commands::library_delete_playlist,
            commands::library_duplicate_playlist,
            commands::library_playlist_add_track,
            commands::library_playlist_remove_track,
            commands::library_playlist_reorder,
            commands::library_playlist_tracks,
            commands::library_list_tracks,
            commands::library_upsert_track,
            commands::library_remove_track,
            commands::library_set_liked,
            commands::library_liked,
            commands::files_import_audio,
            commands::files_media_urls,
            commands::files_write_audio,
            commands::files_write_cover,
            commands::files_write_playlist_cover,
            commands::playlist_cover_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Pouya Music");
}
