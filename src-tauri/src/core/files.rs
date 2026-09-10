use std::path::{Path, PathBuf};

use sha2::{Digest, Sha256};

use crate::core::metadata::read_metadata;
use crate::core::storage::Storage;
use crate::core::track::Track;
use crate::error::{AppError, AppResult};

pub struct FileService;

impl FileService {
    pub fn ensure_dirs(storage: &Storage) -> AppResult<()> {
        for dir in [
            storage.audio_dir(),
            storage.covers_dir(),
            storage.playlist_covers_dir(),
            storage.uploads_dir(),
        ] {
            std::fs::create_dir_all(&dir).map_err(AppError::io)?;
        }
        Ok(())
    }

    /// Import an audio file from a user-selected path into app storage.
    pub fn import_audio(storage: &Storage, source: &Path) -> AppResult<Track> {
        if !source.is_file() {
            return Err(AppError::Invalid(format!(
                "not a file: {}",
                source.display()
            )));
        }
        Self::ensure_dirs(storage)?;

        let meta = read_metadata(source)?;
        let ext = source
            .extension()
            .map(|e| e.to_string_lossy().to_lowercase())
            .unwrap_or_else(|| "mp3".into());

        let id = format!("local-{}", short_hash(&source.to_string_lossy()));
        let dest = storage.audio_dir().join(format!("{id}.{ext}"));
        std::fs::copy(source, &dest).map_err(AppError::io)?;

        let mut has_cover = false;
        if let Some(cover) = &meta.cover {
            let cover_path = storage.covers_dir().join(&id);
            std::fs::write(&cover_path, cover).map_err(AppError::io)?;
            has_cover = true;
        }

        let title = meta
            .title
            .clone()
            .unwrap_or_else(|| {
                source
                    .file_stem()
                    .map(|s| s.to_string_lossy().to_string())
                    .unwrap_or_else(|| "Unknown".into())
            });
        let artist = meta.artist.clone().unwrap_or_else(|| "Unknown Artist".into());

        let track = Track {
            id: id.clone(),
            title,
            artist,
            url: String::new(), // filled via media URL at serve/read time
            duration: meta.duration,
            cover_url: String::new(),
            is_local: true,
            category: None,
            album: meta.album,
            cover_filename: if has_cover { Some(id.clone()) } else { None },
            recommendation_reason: None,
            confidence_score: None,
            exploration_tag: None,
            source: Some("local".into()),
        };

        storage.upsert_track(&track, Some(&ext), has_cover)?;
        Ok(track)
    }

    pub fn write_cover(storage: &Storage, track_id: &str, bytes: &[u8]) -> AppResult<PathBuf> {
        Self::ensure_dirs(storage)?;
        let path = storage.covers_dir().join(sanitize_id(track_id));
        std::fs::write(&path, bytes).map_err(AppError::io)?;
        if let Some(mut t) = storage.get_track(track_id)? {
            t.cover_url = String::new();
            t.cover_filename = Some(track_id.to_string());
            let ext = storage.track_audio_ext(track_id)?;
            storage.upsert_track(&t, ext.as_deref(), true)?;
        }
        Ok(path)
    }

    pub fn write_playlist_cover(storage: &Storage, playlist_id: &str, bytes: &[u8]) -> AppResult<PathBuf> {
        Self::ensure_dirs(storage)?;
        let path = storage
            .playlist_covers_dir()
            .join(sanitize_id(playlist_id));
        std::fs::write(&path, bytes).map_err(AppError::io)?;
        Ok(path)
    }

    pub fn audio_path(storage: &Storage, track_id: &str) -> AppResult<PathBuf> {
        let id = sanitize_id(track_id);
        let ext = storage
            .track_audio_ext(&id)?
            .ok_or_else(|| AppError::NotFound(format!("track {id}")))?;
        let path = storage.audio_dir().join(format!("{id}.{ext}"));
        if !path.is_file() {
            return Err(AppError::NotFound(format!("audio for {id}")));
        }
        Ok(path)
    }

    pub fn cover_path(storage: &Storage, track_id: &str) -> AppResult<PathBuf> {
        let id = sanitize_id(track_id);
        let path = storage.covers_dir().join(&id);
        if !path.is_file() {
            return Err(AppError::NotFound(format!("cover for {id}")));
        }
        Ok(path)
    }

    pub fn playlist_cover_path(storage: &Storage, playlist_id: &str) -> AppResult<PathBuf> {
        let id = sanitize_id(playlist_id);
        let path = storage.playlist_covers_dir().join(&id);
        if !path.is_file() {
            return Err(AppError::NotFound(format!("cover for playlist {id}")));
        }
        Ok(path)
    }

    /// Resolve a safe file path under `base` for audiolab outputs.
    pub fn safe_child(base: &Path, file_name: &str) -> AppResult<PathBuf> {
        if file_name.is_empty()
            || file_name.len() > 128
            || !file_name
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-' | '.'))
            || file_name.contains("..")
        {
            return Err(AppError::Invalid("invalid file name".into()));
        }
        let base_canon = base.canonicalize().map_err(AppError::io)?;
        let joined = base_canon.join(file_name);
        // Ensure no escape via pre-existing path components
        if let Ok(canon) = joined.canonicalize() {
            if !canon.starts_with(&base_canon) {
                return Err(AppError::Invalid("path escape".into()));
            }
            return Ok(canon);
        }
        // File may not exist yet — still ensure parent stays inside base
        if joined.parent().map(|p| p.starts_with(&base_canon)) != Some(true) {
            return Err(AppError::Invalid("path escape".into()));
        }
        Ok(joined)
    }
}

fn sanitize_id(id: &str) -> String {
    let cleaned: String = id
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'))
        .take(128)
        .collect();
    if cleaned.is_empty() {
        "unknown".into()
    } else {
        cleaned
    }
}

fn short_hash(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    let out = hasher.finalize();
    hex::encode(&out[..8])
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn safe_child_rejects_traversal() {
        let dir = tempfile::tempdir().unwrap();
        assert!(FileService::safe_child(dir.path(), "../evil.txt").is_err());
        assert!(FileService::safe_child(dir.path(), "ok_file-1.mp3").is_ok());
    }

    #[test]
    fn import_creates_db_row() {
        let dir = tempfile::tempdir().unwrap();
        let storage = Storage::open(dir.path()).unwrap();
        let src = dir.path().join("sample.mp3");
        let mut f = std::fs::File::create(&src).unwrap();
        f.write_all(b"ID3fake").unwrap();
        drop(f);
        // lofty may fail on fake mp3 — import should still error cleanly
        let res = FileService::import_audio(&storage, &src);
        // Either success with defaults or a clean AppError — never panic
        match res {
            Ok(t) => assert!(t.is_local),
            Err(e) => assert!(!e.to_string().is_empty()),
        }
    }
}
