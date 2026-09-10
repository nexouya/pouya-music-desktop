use serde::{Deserialize, Serialize};

use super::queue::RepeatMode;
use super::track::Track;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TransportState {
    Idle,
    Loading,
    Playing,
    Paused,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerSnapshot {
    pub current_track: Option<Track>,
    pub transport: TransportState,
    pub is_playing: bool,
    pub is_loading: bool,
    pub volume: f64,
    pub current_time: f64,
    pub duration: f64,
    pub playback_rate: f64,
    pub shuffle: bool,
    pub repeat: RepeatMode,
    pub queue_index: usize,
    pub queue_length: usize,
    pub error: Option<String>,
}

impl Default for PlayerSnapshot {
    fn default() -> Self {
        Self {
            current_track: None,
            transport: TransportState::Idle,
            is_playing: false,
            is_loading: false,
            volume: 0.8,
            current_time: 0.0,
            duration: 0.0,
            playback_rate: 1.0,
            shuffle: false,
            repeat: RepeatMode::Off,
            queue_index: 0,
            queue_length: 0,
            error: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayRequest {
    pub track: Track,
    #[serde(default)]
    pub queue: Vec<Track>,
    #[serde(default)]
    pub start_index: Option<usize>,
    #[serde(default)]
    pub stream_source: Option<String>,
}

/// Reject tracks that violate the strict stream-source mode.
/// Local offline files are always allowed.
pub fn stream_source_allows(track: &Track, mode: &str) -> bool {
    if track.is_local {
        return true;
    }
    let is_yt = track.is_youtube();
    let is_sp = track.is_spotify();

    match mode {
        "youtube" => !(is_sp && !is_yt),
        "spotify" => !(is_yt && !is_sp),
        _ => true,
    }
}

/// Append `strict=true` for YouTube play URLs when mode is youtube.
pub fn apply_strict_query(track: &mut Track, mode: &str) {
    if mode != "youtube" || !track.is_youtube() || track.is_local {
        return;
    }
    if track.url.contains("/yt/play/") && !track.url.contains("strict=true") {
        let sep = if track.url.contains('?') { "&" } else { "?" };
        track.url = format!("{}{}strict=true", track.url, sep);
    }
}
