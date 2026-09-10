use std::path::PathBuf;
use std::sync::Arc;

use parking_lot::RwLock;

use crate::core::events::EventBus;
use crate::core::files::FileService;
use crate::core::library::LibraryService;
use crate::core::player::{
    apply_strict_query, stream_source_allows, PlayRequest, PlayerSnapshot, TransportState,
};
use crate::core::queue::{Queue, RepeatMode};
use crate::core::storage::Storage;
use crate::core::track::{AppSettings, LocalPlaylist, Track};
use crate::error::{AppError, AppResult};

/// Shared core. All mutations go through this type so state stays consistent.
pub struct Core {
    pub storage: Storage,
    pub events: EventBus,
    inner: RwLock<Inner>,
}

struct Inner {
    queue: Queue,
    snapshot: PlayerSnapshot,
    settings: AppSettings,
}

impl Core {
    pub fn new(data_dir: PathBuf) -> AppResult<Arc<Self>> {
        let storage = Storage::open(&data_dir)?;
        FileService::ensure_dirs(&storage)?;
        let settings = storage.get_settings().unwrap_or_default();

        let mut queue = Queue::new();
        let mut snapshot = PlayerSnapshot::default();
        snapshot.volume = settings.volume;

        if let Ok(Some((queue_json, cursor, volume, shuffle, repeat, rate))) =
            storage.load_player_state()
        {
            if let Ok(tracks) = serde_json::from_str::<Vec<Track>>(&queue_json) {
                let cursor = cursor.max(0) as usize;
                queue.set_tracks(tracks, cursor);
                queue.set_shuffle(shuffle);
                queue.set_repeat(parse_repeat(&repeat));
                snapshot.volume = volume;
                snapshot.playback_rate = rate;
                snapshot.shuffle = shuffle;
                snapshot.repeat = queue.repeat_mode();
                snapshot.queue_index = queue.cursor();
                snapshot.queue_length = queue.len();
                snapshot.current_track = queue.current().cloned();
            }
        }

        Ok(Arc::new(Self {
            storage,
            events: EventBus::new(),
            inner: RwLock::new(Inner {
                queue,
                snapshot,
                settings,
            }),
        }))
    }

    // --- settings ---

    pub fn settings(&self) -> AppSettings {
        self.inner.read().settings.clone()
    }

    pub fn update_settings(&self, mut next: AppSettings) -> AppResult<AppSettings> {
        next.volume = next.volume.clamp(0.0, 1.0);
        let _ = self.storage.save_settings(&next);
        let mut inner = self.inner.write();
        inner.snapshot.volume = next.volume;
        inner.settings = next.clone();
        self.persist_player(&inner)?;
        self.events.emit_player(&inner.snapshot);
        Ok(next)
    }

    // --- player / queue ---

    pub fn snapshot(&self) -> PlayerSnapshot {
        self.inner.read().snapshot.clone()
    }

    pub fn play(&self, req: PlayRequest) -> AppResult<PlayerSnapshot> {
        let mode = req
            .stream_source
            .clone()
            .unwrap_or_else(|| self.inner.read().settings.stream_source.clone());

        let mut track = req.track;
        if !stream_source_allows(&track, &mode) {
            return Err(AppError::Invalid(
                "stream source mode does not allow this track".into(),
            ));
        }
        apply_strict_query(&mut track, &mode);

        let mut inner = self.inner.write();
        if req.queue.is_empty() {
            // Single-track play replaces the queue context.
            inner.queue.set_tracks(vec![track.clone()], 0);
        } else {
            let mut queue_tracks = req.queue;
            let start = req.start_index.unwrap_or(0);
            for t in queue_tracks.iter_mut() {
                apply_strict_query(t, &mode);
            }
            if let Some(slot) = queue_tracks.get_mut(start) {
                *slot = track.clone();
            } else {
                queue_tracks.push(track.clone());
            }
            inner.queue.set_tracks(queue_tracks, start);
        }

        inner.snapshot.current_track = Some(track);
        inner.snapshot.transport = TransportState::Loading;
        inner.snapshot.is_loading = true;
        inner.snapshot.is_playing = true;
        inner.snapshot.current_time = 0.0;
        inner.snapshot.error = None;
        inner.snapshot.queue_index = inner.queue.cursor();
        inner.snapshot.queue_length = inner.queue.len();
        inner.snapshot.shuffle = inner.queue.shuffle_enabled();
        inner.snapshot.repeat = inner.queue.repeat_mode();

        let snap = inner.snapshot.clone();
        let (len, cur) = (inner.queue.len(), inner.queue.cursor());
        self.persist_player(&inner)?;
        drop(inner);

        self.events.emit_player(&snap);
        self.events.emit_queue(len, cur);
        Ok(snap)
    }

    pub fn pause(&self) -> AppResult<PlayerSnapshot> {
        let mut inner = self.inner.write();
        if inner.snapshot.is_playing {
            inner.snapshot.is_playing = false;
            inner.snapshot.transport = TransportState::Paused;
        }
        let snap = inner.snapshot.clone();
        self.persist_player(&inner)?;
        drop(inner);
        self.events.emit_player(&snap);
        Ok(snap)
    }

    pub fn resume(&self) -> AppResult<PlayerSnapshot> {
        let mut inner = self.inner.write();
        if inner.snapshot.current_track.is_some() {
            inner.snapshot.is_playing = true;
            inner.snapshot.transport = TransportState::Playing;
        }
        let snap = inner.snapshot.clone();
        drop(inner);
        self.events.emit_player(&snap);
        Ok(snap)
    }

    pub fn set_volume(&self, volume: f64) -> AppResult<PlayerSnapshot> {
        let volume = volume.clamp(0.0, 1.0);
        let mut inner = self.inner.write();
        inner.snapshot.volume = volume;
        inner.settings.volume = volume;
        let _ = self.storage.save_settings(&inner.settings);
        let snap = inner.snapshot.clone();
        self.persist_player(&inner)?;
        drop(inner);
        self.events.emit_player(&snap);
        Ok(snap)
    }

    pub fn seek(&self, seconds: f64) -> AppResult<PlayerSnapshot> {
        let mut inner = self.inner.write();
        let max = inner.snapshot.duration;
        inner.snapshot.current_time = if max > 0.0 {
            seconds.clamp(0.0, max)
        } else {
            seconds.max(0.0)
        };
        let snap = inner.snapshot.clone();
        drop(inner);
        self.events.emit_player(&snap);
        Ok(snap)
    }

    pub fn set_rate(&self, rate: f64) -> AppResult<PlayerSnapshot> {
        let rate = rate.clamp(0.5, 2.0);
        let mut inner = self.inner.write();
        inner.snapshot.playback_rate = rate;
        let snap = inner.snapshot.clone();
        self.persist_player(&inner)?;
        drop(inner);
        self.events.emit_player(&snap);
        Ok(snap)
    }

    /// Called by frontend when the media element is ready / time updates.
    pub fn sync_media(&self, current_time: f64, duration: f64, playing: bool, loading: bool) -> PlayerSnapshot {
        let mut inner = self.inner.write();
        inner.snapshot.current_time = current_time.max(0.0);
        if duration > 0.0 {
            inner.snapshot.duration = duration;
        }
        inner.snapshot.is_playing = playing;
        inner.snapshot.is_loading = loading;
        inner.snapshot.transport = if loading {
            TransportState::Loading
        } else if playing {
            TransportState::Playing
        } else if inner.snapshot.current_track.is_some() {
            TransportState::Paused
        } else {
            TransportState::Idle
        };
        inner.snapshot.clone()
    }

    /// Single-writer next: used by UI button and by `ended` handler.
    pub fn next(&self, from_ended: bool) -> AppResult<PlayerSnapshot> {
        let mut inner = self.inner.write();
        match inner.queue.next(from_ended) {
            Some(track) => {
                let mut track = track.clone();
                let mode = inner.settings.stream_source.clone();
                apply_strict_query(&mut track, &mode);
                inner.snapshot.current_track = Some(track);
                inner.snapshot.is_playing = true;
                inner.snapshot.is_loading = true;
                inner.snapshot.transport = TransportState::Loading;
                inner.snapshot.current_time = 0.0;
                inner.snapshot.queue_index = inner.queue.cursor();
                inner.snapshot.queue_length = inner.queue.len();
            }
            None => {
                inner.snapshot.is_playing = false;
                inner.snapshot.transport = TransportState::Idle;
                inner.snapshot.current_time = 0.0;
            }
        }
        let snap = inner.snapshot.clone();
        let (len, cur) = (inner.queue.len(), inner.queue.cursor());
        self.persist_player(&inner)?;
        drop(inner);
        self.events.emit_player(&snap);
        self.events.emit_queue(len, cur);
        Ok(snap)
    }

    pub fn prev(&self) -> AppResult<PlayerSnapshot> {
        let mut inner = self.inner.write();
        // If more than 3s in, restart current (standard player UX).
        if inner.snapshot.current_time > 3.0 {
            inner.snapshot.current_time = 0.0;
        } else if let Some(track) = inner.queue.prev().cloned() {
            let mut track = track;
            let mode = inner.settings.stream_source.clone();
            apply_strict_query(&mut track, &mode);
            inner.snapshot.current_track = Some(track);
            inner.snapshot.is_playing = true;
            inner.snapshot.is_loading = true;
            inner.snapshot.transport = TransportState::Loading;
            inner.snapshot.current_time = 0.0;
            inner.snapshot.queue_index = inner.queue.cursor();
        }
        let snap = inner.snapshot.clone();
        let (len, cur) = (inner.queue.len(), inner.queue.cursor());
        self.persist_player(&inner)?;
        drop(inner);
        self.events.emit_player(&snap);
        self.events.emit_queue(len, cur);
        Ok(snap)
    }

    pub fn toggle_shuffle(&self) -> AppResult<PlayerSnapshot> {
        let mut inner = self.inner.write();
        let next = !inner.queue.shuffle_enabled();
        inner.queue.set_shuffle(next);
        inner.snapshot.shuffle = next;
        inner.snapshot.queue_index = inner.queue.cursor();
        let snap = inner.snapshot.clone();
        let (len, cur) = (inner.queue.len(), inner.queue.cursor());
        self.persist_player(&inner)?;
        drop(inner);
        self.events.emit_player(&snap);
        self.events.emit_queue(len, cur);
        Ok(snap)
    }

    pub fn set_repeat(&self, mode: RepeatMode) -> AppResult<PlayerSnapshot> {
        let mut inner = self.inner.write();
        inner.queue.set_repeat(mode);
        inner.snapshot.repeat = mode;
        let snap = inner.snapshot.clone();
        self.persist_player(&inner)?;
        drop(inner);
        self.events.emit_player(&snap);
        Ok(snap)
    }

    pub fn jump(&self, index: usize) -> AppResult<PlayerSnapshot> {
        let mut inner = self.inner.write();
        let Some(mut track) = inner.queue.jump(index).cloned() else {
            return Err(AppError::Invalid("queue index out of range".into()));
        };
        let mode = inner.settings.stream_source.clone();
        apply_strict_query(&mut track, &mode);
        inner.snapshot.current_track = Some(track);
        inner.snapshot.is_playing = true;
        inner.snapshot.is_loading = true;
        inner.snapshot.transport = TransportState::Loading;
        inner.snapshot.current_time = 0.0;
        inner.snapshot.queue_index = inner.queue.cursor();
        let snap = inner.snapshot.clone();
        let (len, cur) = (inner.queue.len(), inner.queue.cursor());
        self.persist_player(&inner)?;
        drop(inner);
        self.events.emit_player(&snap);
        self.events.emit_queue(len, cur);
        Ok(snap)
    }

    pub fn set_queue(&self, tracks: Vec<Track>, start_index: usize) -> AppResult<PlayerSnapshot> {
        let mode = self.inner.read().settings.stream_source.clone();
        let mut tracks = tracks;
        for t in tracks.iter_mut() {
            apply_strict_query(t, &mode);
        }
        let mut inner = self.inner.write();
        inner.queue.set_tracks(tracks, start_index);
        inner.snapshot.queue_index = inner.queue.cursor();
        inner.snapshot.queue_length = inner.queue.len();
        inner.snapshot.current_track = inner.queue.current().cloned();
        let snap = inner.snapshot.clone();
        let (len, cur) = (inner.queue.len(), inner.queue.cursor());
        self.persist_player(&inner)?;
        drop(inner);
        self.events.emit_player(&snap);
        self.events.emit_queue(len, cur);
        Ok(snap)
    }

    fn persist_player(&self, inner: &Inner) -> AppResult<()> {
        let tracks = inner.queue.tracks().to_vec();
        let json = serde_json::to_string(&tracks)?;
        let repeat = match inner.queue.repeat_mode() {
            RepeatMode::Off => "off",
            RepeatMode::All => "all",
            RepeatMode::One => "one",
        };
        self.storage.save_player_state(
            &json,
            inner.queue.cursor() as i64,
            inner.snapshot.volume,
            inner.queue.shuffle_enabled(),
            repeat,
            inner.snapshot.playback_rate,
        )
    }

    // --- library passthrough ---

    pub fn playlists(&self) -> AppResult<Vec<LocalPlaylist>> {
        self.storage.list_playlists()
    }

    pub fn create_playlist(&self, name: &str, description: Option<&str>) -> AppResult<LocalPlaylist> {
        let pl = LibraryService::create_playlist(&self.storage, name, description)?;
        self.emit_library();
        Ok(pl)
    }

    pub fn rename_playlist(
        &self,
        id: &str,
        name: &str,
        description: Option<&str>,
    ) -> AppResult<LocalPlaylist> {
        let pl = LibraryService::rename_playlist(&self.storage, id, name, description)?;
        self.emit_library();
        Ok(pl)
    }

    pub fn delete_playlist(&self, id: &str) -> AppResult<()> {
        LibraryService::delete_playlist(&self.storage, id)?;
        self.emit_library();
        Ok(())
    }

    pub fn duplicate_playlist(&self, id: &str, suffix: &str) -> AppResult<LocalPlaylist> {
        let pl = LibraryService::duplicate_playlist(&self.storage, id, suffix)?;
        self.emit_library();
        Ok(pl)
    }

    pub fn playlist_add_track(&self, playlist_id: &str, track: Track) -> AppResult<LocalPlaylist> {
        let pl = LibraryService::add_track(&self.storage, playlist_id, &track)?;
        self.emit_library();
        Ok(pl)
    }

    pub fn playlist_remove_track(&self, playlist_id: &str, track_id: &str) -> AppResult<LocalPlaylist> {
        let pl = LibraryService::remove_track(&self.storage, playlist_id, track_id)?;
        self.emit_library();
        Ok(pl)
    }

    pub fn playlist_reorder(&self, playlist_id: &str, track_ids: Vec<String>) -> AppResult<LocalPlaylist> {
        let pl = LibraryService::reorder_tracks(&self.storage, playlist_id, track_ids)?;
        self.emit_library();
        Ok(pl)
    }

    pub fn playlist_tracks(&self, playlist_id: &str) -> AppResult<Vec<Track>> {
        LibraryService::get_tracks_for_playlist(&self.storage, playlist_id)
    }

    pub fn list_tracks(&self) -> AppResult<Vec<Track>> {
        self.storage.list_tracks()
    }

    pub fn upsert_track(&self, track: Track) -> AppResult<()> {
        self.storage.upsert_track(&track, None, false)?;
        self.emit_library();
        Ok(())
    }

    pub fn remove_track(&self, id: &str) -> AppResult<()> {
        self.storage.remove_track(id)?;
        self.emit_library();
        Ok(())
    }

    pub fn set_liked(&self, tracks: Vec<Track>) -> AppResult<()> {
        self.storage.set_liked(&tracks)
    }

    pub fn liked(&self) -> AppResult<Vec<Track>> {
        self.storage.list_liked()
    }

    fn emit_library(&self) {
        let playlists = self.storage.list_playlists().unwrap_or_default();
        let track_count = self.storage.list_tracks().map(|t| t.len()).unwrap_or(0);
        self.events.emit_library(playlists, track_count);
    }
}

fn parse_repeat(s: &str) -> RepeatMode {
    match s {
        "all" => RepeatMode::All,
        "one" => RepeatMode::One,
        _ => RepeatMode::Off,
    }
}
