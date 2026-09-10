use parking_lot::RwLock;
use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::core::player::PlayerSnapshot;
use crate::core::track::LocalPlaylist;

pub const EVENT_PLAYER_STATE: &str = "player://state";
pub const EVENT_QUEUE_CHANGED: &str = "queue://changed";
pub const EVENT_LIBRARY_CHANGED: &str = "library://changed";
pub const EVENT_TOAST: &str = "app://toast";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QueueChanged {
    pub length: usize,
    pub cursor: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryChanged {
    pub playlists: Vec<LocalPlaylist>,
    pub track_count: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToastEvent {
    pub message: String,
}

pub struct EventBus {
    app: RwLock<Option<AppHandle>>,
}

impl EventBus {
    pub fn new() -> Self {
        Self {
            app: RwLock::new(None),
        }
    }

    pub fn attach(&self, app: AppHandle) {
        *self.app.write() = Some(app);
    }

    pub fn emit_player(&self, snapshot: &PlayerSnapshot) {
        if let Some(app) = self.app.read().as_ref() {
            let _ = app.emit(EVENT_PLAYER_STATE, snapshot);
        }
    }

    pub fn emit_queue(&self, length: usize, cursor: usize) {
        if let Some(app) = self.app.read().as_ref() {
            let _ = app.emit(EVENT_QUEUE_CHANGED, QueueChanged { length, cursor });
        }
    }

    pub fn emit_library(&self, playlists: Vec<LocalPlaylist>, track_count: usize) {
        if let Some(app) = self.app.read().as_ref() {
            let _ = app.emit(
                EVENT_LIBRARY_CHANGED,
                LibraryChanged {
                    playlists,
                    track_count,
                },
            );
        }
    }

    pub fn toast(&self, message: impl Into<String>) {
        if let Some(app) = self.app.read().as_ref() {
            let _ = app.emit(EVENT_TOAST, ToastEvent { message: message.into() });
        }
    }
}

impl Default for EventBus {
    fn default() -> Self {
        Self::new()
    }
}
