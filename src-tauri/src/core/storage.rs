use std::path::{Path, PathBuf};
use std::sync::Mutex;

use rusqlite::{params, Connection, OptionalExtension};
use serde_json::Value;

use crate::core::track::{AppSettings, LocalPlaylist, Track};
use crate::error::{AppError, AppResult};

/// SQLite storage. Connection is mutex-wrapped so `Storage` is `Sync`
/// (required for Tauri managed state and axum `State`).
pub struct Storage {
    conn: Mutex<Connection>,
    data_dir: PathBuf,
}

impl Storage {
    pub fn open(data_dir: &Path) -> AppResult<Self> {
        std::fs::create_dir_all(data_dir).map_err(AppError::io)?;
        let db_path = data_dir.join("core.db");
        let conn = Connection::open(&db_path).map_err(AppError::storage)?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
            .map_err(AppError::storage)?;
        let storage = Self {
            conn: Mutex::new(conn),
            data_dir: data_dir.to_path_buf(),
        };
        storage.migrate()?;
        Ok(storage)
    }

    fn conn(&self) -> AppResult<std::sync::MutexGuard<'_, Connection>> {
        self.conn
            .lock()
            .map_err(|_| AppError::Storage("database lock poisoned".into()))
    }

    pub fn data_dir(&self) -> &Path {
        &self.data_dir
    }

    pub fn audio_dir(&self) -> PathBuf {
        self.data_dir.join("audio")
    }

    pub fn covers_dir(&self) -> PathBuf {
        self.data_dir.join("covers")
    }

    pub fn playlist_covers_dir(&self) -> PathBuf {
        self.data_dir.join("playlist-covers")
    }

    pub fn uploads_dir(&self) -> PathBuf {
        self.data_dir.join("uploads")
    }

    fn migrate(&self) -> AppResult<()> {
        self.conn()?
            .execute_batch(
                r#"
                CREATE TABLE IF NOT EXISTS tracks (
                    id TEXT PRIMARY KEY,
                    payload TEXT NOT NULL,
                    audio_ext TEXT,
                    has_cover INTEGER NOT NULL DEFAULT 0,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                );
                CREATE TABLE IF NOT EXISTS playlists (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT,
                    cover_marker TEXT,
                    track_ids TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                );
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS player_state (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    queue_json TEXT NOT NULL,
                    cursor INTEGER NOT NULL,
                    volume REAL NOT NULL,
                    shuffle INTEGER NOT NULL,
                    repeat_mode TEXT NOT NULL,
                    playback_rate REAL NOT NULL
                );
                CREATE TABLE IF NOT EXISTS liked_tracks (
                    id TEXT PRIMARY KEY,
                    payload TEXT NOT NULL
                );
                "#,
            )
            .map_err(AppError::storage)?;
        Ok(())
    }

    // --- tracks ---

    pub fn upsert_track(&self, track: &Track, audio_ext: Option<&str>, has_cover: bool) -> AppResult<()> {
        let now = now_ms();
        let payload = serde_json::to_string(track)?;
        self.conn()?
            .execute(
                r#"
                INSERT INTO tracks (id, payload, audio_ext, has_cover, created_at, updated_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?5)
                ON CONFLICT(id) DO UPDATE SET
                    payload=excluded.payload,
                    audio_ext=COALESCE(excluded.audio_ext, tracks.audio_ext),
                    has_cover=excluded.has_cover,
                    updated_at=excluded.updated_at
                "#,
                params![track.id, payload, audio_ext, has_cover as i64, now as i64],
            )
            .map_err(AppError::storage)?;
        Ok(())
    }

    pub fn get_track(&self, id: &str) -> AppResult<Option<Track>> {
        let payload: Option<String> = self
            .conn()?
            .query_row("SELECT payload FROM tracks WHERE id=?1", params![id], |r| {
                r.get(0)
            })
            .optional()
            .map_err(AppError::storage)?;
        match payload {
            Some(p) => Ok(Some(serde_json::from_str(&p)?)),
            None => Ok(None),
        }
    }

    pub fn list_tracks(&self) -> AppResult<Vec<Track>> {
        let conn = self.conn()?;
        let mut stmt = conn
            .prepare("SELECT payload FROM tracks ORDER BY updated_at DESC")
            .map_err(AppError::storage)?;
        let rows = stmt
            .query_map([], |r| r.get::<_, String>(0))
            .map_err(AppError::storage)?;
        let mut out = Vec::new();
        for row in rows {
            let p = row.map_err(AppError::storage)?;
            out.push(serde_json::from_str(&p)?);
        }
        Ok(out)
    }

    pub fn remove_track(&self, id: &str) -> AppResult<()> {
        self.conn()?
            .execute("DELETE FROM tracks WHERE id=?1", params![id])
            .map_err(AppError::storage)?;
        Ok(())
    }

    pub fn track_audio_ext(&self, id: &str) -> AppResult<Option<String>> {
        Ok(self
            .conn()?
            .query_row(
                "SELECT audio_ext FROM tracks WHERE id=?1",
                params![id],
                |r| r.get(0),
            )
            .optional()
            .map_err(AppError::storage)?)
    }

    pub fn track_has_cover(&self, id: &str) -> AppResult<bool> {
        let v: Option<i64> = self
            .conn()?
            .query_row(
                "SELECT has_cover FROM tracks WHERE id=?1",
                params![id],
                |r| r.get(0),
            )
            .optional()
            .map_err(AppError::storage)?;
        Ok(v.unwrap_or(0) != 0)
    }

    // --- playlists ---

    pub fn list_playlists(&self) -> AppResult<Vec<LocalPlaylist>> {
        let conn = self.conn()?;
        let mut stmt = conn
            .prepare(
                "SELECT id, name, description, cover_marker, track_ids, created_at, updated_at
                 FROM playlists ORDER BY created_at ASC",
            )
            .map_err(AppError::storage)?;
        let rows = stmt
            .query_map([], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, Option<String>>(2)?,
                    r.get::<_, Option<String>>(3)?,
                    r.get::<_, String>(4)?,
                    r.get::<_, i64>(5)?,
                    r.get::<_, Option<i64>>(6)?,
                ))
            })
            .map_err(AppError::storage)?;
        let mut out = Vec::new();
        for row in rows {
            let (id, name, description, cover, track_ids, created_at, updated_at) =
                row.map_err(AppError::storage)?;
            let track_ids: Vec<String> = serde_json::from_str(&track_ids).unwrap_or_default();
            out.push(LocalPlaylist {
                id,
                name,
                description,
                cover_url: cover,
                track_ids,
                created_at: created_at as u64,
                updated_at: updated_at.map(|v| v as u64),
            });
        }
        Ok(out)
    }

    pub fn upsert_playlist(&self, playlist: &LocalPlaylist) -> AppResult<()> {
        let track_ids = serde_json::to_string(&playlist.track_ids)?;
        let updated = playlist.updated_at.unwrap_or_else(now_ms);
        self.conn()?
            .execute(
                r#"
                INSERT INTO playlists (id, name, description, cover_marker, track_ids, created_at, updated_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
                ON CONFLICT(id) DO UPDATE SET
                    name=excluded.name,
                    description=excluded.description,
                    cover_marker=excluded.cover_marker,
                    track_ids=excluded.track_ids,
                    updated_at=excluded.updated_at
                "#,
                params![
                    playlist.id,
                    playlist.name,
                    playlist.description,
                    playlist.cover_url,
                    track_ids,
                    playlist.created_at as i64,
                    updated as i64
                ],
            )
            .map_err(AppError::storage)?;
        Ok(())
    }

    pub fn delete_playlist(&self, id: &str) -> AppResult<()> {
        self.conn()?
            .execute("DELETE FROM playlists WHERE id=?1", params![id])
            .map_err(AppError::storage)?;
        Ok(())
    }

    // --- settings / liked ---

    pub fn get_settings(&self) -> AppResult<AppSettings> {
        let raw: Option<String> = self
            .conn()?
            .query_row(
                "SELECT value FROM settings WHERE key='app'",
                [],
                |r| r.get(0),
            )
            .optional()
            .map_err(AppError::storage)?;
        match raw {
            Some(v) => Ok(serde_json::from_str(&v)?),
            None => Ok(AppSettings::default()),
        }
    }

    pub fn save_settings(&self, settings: &AppSettings) -> AppResult<()> {
        let v = serde_json::to_string(settings)?;
        self.conn()?
            .execute(
                "INSERT INTO settings (key, value) VALUES ('app', ?1)
                 ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                params![v],
            )
            .map_err(AppError::storage)?;
        Ok(())
    }

    pub fn set_kv(&self, key: &str, value: &Value) -> AppResult<()> {
        let v = value.to_string();
        self.conn()?
            .execute(
                "INSERT INTO settings (key, value) VALUES (?1, ?2)
                 ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                params![key, v],
            )
            .map_err(AppError::storage)?;
        Ok(())
    }

    pub fn get_kv(&self, key: &str) -> AppResult<Option<Value>> {
        let raw: Option<String> = self
            .conn()?
            .query_row(
                "SELECT value FROM settings WHERE key=?1",
                params![key],
                |r| r.get(0),
            )
            .optional()
            .map_err(AppError::storage)?;
        match raw {
            Some(v) => Ok(Some(serde_json::from_str(&v)?)),
            None => Ok(None),
        }
    }

    pub fn list_liked(&self) -> AppResult<Vec<Track>> {
        let conn = self.conn()?;
        let mut stmt = conn
            .prepare("SELECT payload FROM liked_tracks")
            .map_err(AppError::storage)?;
        let rows = stmt
            .query_map([], |r| r.get::<_, String>(0))
            .map_err(AppError::storage)?;
        let mut out = Vec::new();
        for row in rows {
            out.push(serde_json::from_str(&row.map_err(AppError::storage)?)?);
        }
        Ok(out)
    }

    pub fn set_liked(&self, tracks: &[Track]) -> AppResult<()> {
        let conn = self.conn()?;
        conn.execute("DELETE FROM liked_tracks", [])
            .map_err(AppError::storage)?;
        for t in tracks {
            let payload = serde_json::to_string(t)?;
            conn.execute(
                "INSERT OR REPLACE INTO liked_tracks (id, payload) VALUES (?1, ?2)",
                params![t.id, payload],
            )
            .map_err(AppError::storage)?;
        }
        Ok(())
    }

    // --- player persistence ---

    pub fn save_player_state(
        &self,
        queue_json: &str,
        cursor: i64,
        volume: f64,
        shuffle: bool,
        repeat_mode: &str,
        playback_rate: f64,
    ) -> AppResult<()> {
        self.conn()?
            .execute(
                r#"
                INSERT INTO player_state (id, queue_json, cursor, volume, shuffle, repeat_mode, playback_rate)
                VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6)
                ON CONFLICT(id) DO UPDATE SET
                    queue_json=excluded.queue_json,
                    cursor=excluded.cursor,
                    volume=excluded.volume,
                    shuffle=excluded.shuffle,
                    repeat_mode=excluded.repeat_mode,
                    playback_rate=excluded.playback_rate
                "#,
                params![
                    queue_json,
                    cursor,
                    volume,
                    shuffle as i64,
                    repeat_mode,
                    playback_rate
                ],
            )
            .map_err(AppError::storage)?;
        Ok(())
    }

    pub fn load_player_state(&self) -> AppResult<Option<(String, i64, f64, bool, String, f64)>> {
        Ok(self
            .conn()?
            .query_row(
                "SELECT queue_json, cursor, volume, shuffle, repeat_mode, playback_rate
                 FROM player_state WHERE id=1",
                [],
                |r| {
                    Ok((
                        r.get::<_, String>(0)?,
                        r.get::<_, i64>(1)?,
                        r.get::<_, f64>(2)?,
                        r.get::<_, i64>(3)? != 0,
                        r.get::<_, String>(4)?,
                        r.get::<_, f64>(5)?,
                    ))
                },
            )
            .optional()
            .map_err(AppError::storage)?)
    }
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn track_roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let s = Storage::open(dir.path()).unwrap();
        let t = Track {
            id: "t1".into(),
            title: "Song".into(),
            artist: "Artist".into(),
            url: "".into(),
            duration: Some(12.0),
            cover_url: "".into(),
            is_local: true,
            category: None,
            album: Some("Album".into()),
            cover_filename: None,
            recommendation_reason: None,
            confidence_score: None,
            exploration_tag: None,
            source: Some("local".into()),
        };
        s.upsert_track(&t, Some("mp3"), true).unwrap();
        let loaded = s.get_track("t1").unwrap().unwrap();
        assert_eq!(loaded.title, "Song");
        assert_eq!(s.track_audio_ext("t1").unwrap().unwrap(), "mp3");
        assert!(s.track_has_cover("t1").unwrap());
    }

    #[test]
    fn playlist_roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let s = Storage::open(dir.path()).unwrap();
        let p = LocalPlaylist {
            id: "pl1".into(),
            name: "Mix".into(),
            description: Some("d".into()),
            cover_url: None,
            track_ids: vec!["a".into(), "b".into()],
            created_at: 1,
            updated_at: Some(2),
        };
        s.upsert_playlist(&p).unwrap();
        let list = s.list_playlists().unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].track_ids, vec!["a", "b"]);
    }
}
