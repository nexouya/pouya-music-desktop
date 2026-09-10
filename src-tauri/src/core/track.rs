use serde::{Deserialize, Serialize};

pub type StreamSourceType = String;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Track {
    pub id: String,
    pub title: String,
    pub artist: String,
    /// Dynamic stream URL, relative path, or local media URL.
    #[serde(default)]
    pub url: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub duration: Option<f64>,
    #[serde(default)]
    pub cover_url: String,
    #[serde(default)]
    pub is_local: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub album: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cover_filename: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub recommendation_reason: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub confidence_score: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub exploration_tag: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
}

impl Track {
    pub fn is_youtube(&self) -> bool {
        self.source.as_deref() == Some("youtube")
            || self.id.starts_with("yt-")
            || self.url.contains("/yt/")
    }

    pub fn is_spotify(&self) -> bool {
        self.source.as_deref() == Some("spotify")
            || self.id.starts_with("itunes-")
            || self.url.contains("apple.com")
            || self.url.contains("mzstatic")
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LocalPlaylist {
    pub id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cover_url: Option<String>,
    pub track_ids: Vec<String>,
    pub created_at: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    #[serde(default = "default_theme")]
    pub theme: String,
    #[serde(default = "default_lang")]
    pub language: String,
    #[serde(default = "default_stream_source")]
    pub stream_source: String,
    #[serde(default = "default_volume")]
    pub volume: f64,
    #[serde(default)]
    pub username: String,
    #[serde(default)]
    pub dj_authorized: bool,
}

fn default_theme() -> String {
    "dark".into()
}

fn default_lang() -> String {
    "fa".into()
}

fn default_stream_source() -> String {
    "both".into()
}

fn default_volume() -> f64 {
    0.8
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: default_theme(),
            language: default_lang(),
            stream_source: default_stream_source(),
            volume: default_volume(),
            username: "Guest Finder".into(),
            dj_authorized: false,
        }
    }
}
