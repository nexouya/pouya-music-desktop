use crate::core::storage::Storage;
use crate::core::track::{LocalPlaylist, Track};
use crate::error::{AppError, AppResult};

pub struct LibraryService;

impl LibraryService {
    pub fn create_playlist(
        storage: &Storage,
        name: &str,
        description: Option<&str>,
    ) -> AppResult<LocalPlaylist> {
        let name = name.trim();
        if name.is_empty() {
            return Err(AppError::Invalid("playlist name required".into()));
        }
        let pl = LocalPlaylist {
            id: format!("local-pl-{}", now_ms()),
            name: name.to_string(),
            description: description.map(|s| s.to_string()),
            cover_url: None,
            track_ids: vec![],
            created_at: now_ms(),
            updated_at: Some(now_ms()),
        };
        storage.upsert_playlist(&pl)?;
        Ok(pl)
    }

    pub fn rename_playlist(
        storage: &Storage,
        id: &str,
        name: &str,
        description: Option<&str>,
    ) -> AppResult<LocalPlaylist> {
        let mut pl = Self::require(storage, id)?;
        pl.name = name.to_string();
        if let Some(d) = description {
            pl.description = Some(d.to_string());
        }
        pl.updated_at = Some(now_ms());
        storage.upsert_playlist(&pl)?;
        Ok(pl)
    }

    pub fn delete_playlist(storage: &Storage, id: &str) -> AppResult<()> {
        storage.delete_playlist(id)
    }

    pub fn duplicate_playlist(storage: &Storage, id: &str, suffix: &str) -> AppResult<LocalPlaylist> {
        let src = Self::require(storage, id)?;
        let new_id = format!("local-pl-{}", now_ms());
        let mut cover_marker = src.cover_url.clone();
        if src.cover_url.as_deref() == Some("blob") {
            // Copy playlist cover file if present
            if let Ok(src_path) = crate::core::files::FileService::playlist_cover_path(storage, id)
            {
                if let Ok(bytes) = std::fs::read(&src_path) {
                    let _ = crate::core::files::FileService::write_playlist_cover(
                        storage, &new_id, &bytes,
                    );
                }
            }
            cover_marker = Some("blob".into());
        }
        let pl = LocalPlaylist {
            id: new_id,
            name: format!("{}{}", src.name, suffix),
            description: src.description.clone(),
            cover_url: cover_marker,
            track_ids: src.track_ids.clone(),
            created_at: now_ms(),
            updated_at: Some(now_ms()),
        };
        storage.upsert_playlist(&pl)?;
        Ok(pl)
    }

    pub fn add_track(storage: &Storage, playlist_id: &str, track: &Track) -> AppResult<LocalPlaylist> {
        let mut pl = Self::require(storage, playlist_id)?;
        // Ensure track exists in library table
        if storage.get_track(&track.id)?.is_none() {
            storage.upsert_track(track, None, false)?;
        }
        if !pl.track_ids.contains(&track.id) {
            pl.track_ids.push(track.id.clone());
        }
        pl.updated_at = Some(now_ms());
        storage.upsert_playlist(&pl)?;
        Ok(pl)
    }

    pub fn remove_track(storage: &Storage, playlist_id: &str, track_id: &str) -> AppResult<LocalPlaylist> {
        let mut pl = Self::require(storage, playlist_id)?;
        pl.track_ids.retain(|id| id != track_id);
        pl.updated_at = Some(now_ms());
        storage.upsert_playlist(&pl)?;
        Ok(pl)
    }

    pub fn reorder_tracks(storage: &Storage, playlist_id: &str, track_ids: Vec<String>) -> AppResult<LocalPlaylist> {
        let mut pl = Self::require(storage, playlist_id)?;
        pl.track_ids = track_ids;
        pl.updated_at = Some(now_ms());
        storage.upsert_playlist(&pl)?;
        Ok(pl)
    }

    pub fn set_cover_marker(storage: &Storage, playlist_id: &str) -> AppResult<LocalPlaylist> {
        let mut pl = Self::require(storage, playlist_id)?;
        pl.cover_url = Some("blob".into());
        pl.updated_at = Some(now_ms());
        storage.upsert_playlist(&pl)?;
        Ok(pl)
    }

    pub fn get_tracks_for_playlist(storage: &Storage, playlist_id: &str) -> AppResult<Vec<Track>> {
        let pl = Self::require(storage, playlist_id)?;
        let mut tracks = Vec::new();
        for id in pl.track_ids {
            if let Some(mut t) = storage.get_track(&id)? {
                // Local tracks: leave url/cover empty; frontend resolves via media API.
                if t.is_local {
                    t.url = String::new();
                }
                tracks.push(t);
            }
        }
        Ok(tracks)
    }

    fn require(storage: &Storage, id: &str) -> AppResult<LocalPlaylist> {
        storage
            .list_playlists()?
            .into_iter()
            .find(|p| p.id == id)
            .ok_or_else(|| AppError::NotFound(format!("playlist {id}")))
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
    use crate::core::storage::Storage;

    #[test]
    fn playlist_crud() {
        let dir = tempfile::tempdir().unwrap();
        let s = Storage::open(dir.path()).unwrap();
        let pl = LibraryService::create_playlist(&s, "My Mix", Some("desc")).unwrap();
        assert_eq!(pl.name, "My Mix");

        let t = Track {
            id: "x".into(),
            title: "T".into(),
            artist: "A".into(),
            url: "".into(),
            duration: None,
            cover_url: "".into(),
            is_local: true,
            category: None,
            album: None,
            cover_filename: None,
            recommendation_reason: None,
            confidence_score: None,
            exploration_tag: None,
            source: None,
        };
        let pl2 = LibraryService::add_track(&s, &pl.id, &t).unwrap();
        assert_eq!(pl2.track_ids, vec!["x"]);

        let dup = LibraryService::duplicate_playlist(&s, &pl.id, " (Copy)").unwrap();
        assert_eq!(dup.track_ids, vec!["x"]);
        assert!(dup.name.contains("Copy"));
    }
}
