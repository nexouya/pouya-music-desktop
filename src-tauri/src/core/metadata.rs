use std::path::Path;

use lofty::file::{AudioFile, TaggedFileExt};
use lofty::picture::PictureType;
use lofty::prelude::Accessor;
use lofty::probe::Probe;
use lofty::tag::ItemKey;

use crate::error::{AppError, AppResult};

#[derive(Debug, Clone, Default)]
pub struct TrackMetadata {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub duration: Option<f64>,
    pub cover: Option<Vec<u8>>,
}

pub fn read_metadata(path: &Path) -> AppResult<TrackMetadata> {
    let tagged = Probe::open(path)
        .map_err(AppError::io)?
        .read()
        .map_err(AppError::io)?;

    let props = tagged.properties();
    let duration = props.duration().as_secs_f64();
    let mut meta = TrackMetadata {
        duration: if duration > 0.0 { Some(duration) } else { None },
        ..Default::default()
    };

    if let Some(tag) = tagged.primary_tag().or_else(|| tagged.first_tag()) {
        meta.title = tag.title().map(|s| s.to_string());
        meta.artist = tag.artist().map(|s| s.to_string());
        meta.album = tag.album().map(|s| s.to_string());
        if meta.artist.is_none() {
            meta.artist = tag
                .get_string(&ItemKey::AlbumArtist)
                .map(|s| s.to_string());
        }
        if let Some(pic) = tag
            .pictures()
            .iter()
            .find(|p| p.pic_type() == PictureType::CoverFront)
            .or_else(|| tag.pictures().first())
        {
            meta.cover = Some(pic.data().to_vec());
        }
    }

    if meta.title.is_none() {
        meta.title = path
            .file_stem()
            .map(|s| s.to_string_lossy().to_string());
    }

    Ok(meta)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn missing_file_errors() {
        let p = Path::new("definitely-not-a-real-file-xyz.mp3");
        assert!(read_metadata(p).is_err());
    }
}
