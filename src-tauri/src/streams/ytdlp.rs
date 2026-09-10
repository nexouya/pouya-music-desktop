use std::path::{Path, PathBuf};
use std::process::Stdio;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::process::Command;

use crate::error::{AppError, AppResult};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct YtSong {
    pub video_id: String,
    pub title: String,
    #[serde(default)]
    pub artist: String,
    #[serde(default)]
    pub duration: Option<f64>,
    #[serde(default)]
    pub thumbnail: Option<String>,
}

pub struct YtDlp {
    binary: PathBuf,
}

impl YtDlp {
    /// Resolve yt-dlp from Tauri sidecar path, PATH, or bundled resources.
    pub fn discover(resource_dir: Option<&Path>) -> Self {
        let mut candidates: Vec<PathBuf> = Vec::new();
        if let Some(rd) = resource_dir {
            candidates.push(rd.join("bin").join("yt-dlp.exe"));
            candidates.push(rd.join("bin").join("yt-dlp"));
            candidates.push(rd.join("yt-dlp.exe"));
            candidates.push(rd.join("yt-dlp"));
        }
        if let Ok(p) = std::env::current_exe() {
            if let Some(dir) = p.parent() {
                candidates.push(dir.join("bin").join("yt-dlp.exe"));
                candidates.push(dir.join("yt-dlp.exe"));
            }
        }
        // Project-local fallback used during development
        if let Ok(cwd) = std::env::current_dir() {
            candidates.push(cwd.join("bin").join("yt-dlp.exe"));
            candidates.push(cwd.join("bin").join("yt-dlp"));
            candidates.push(cwd.join("..").join("bin").join("yt-dlp.exe"));
        }
        // PATH lookup
        let binary = candidates
            .into_iter()
            .find(|p| p.is_file())
            .unwrap_or_else(|| PathBuf::from("yt-dlp"));
        Self { binary }
    }

    pub fn binary(&self) -> &Path {
        &self.binary
    }

    pub async fn describe(&self) -> AppResult<String> {
        let out = Command::new(&self.binary)
            .arg("--version")
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .output()
            .await
            .map_err(AppError::io)?;
        if !out.status.success() {
            return Err(AppError::Stream("yt-dlp not available".into()));
        }
        Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
    }

    pub async fn search(&self, query: &str, limit: usize) -> AppResult<Vec<YtSong>> {
        let q = format!("ytsearch{}:{}", limit.max(1), query);
        let out = Command::new(&self.binary)
            .args([
                "--flat-playlist",
                "--dump-json",
                "--no-warnings",
                "--ignore-errors",
                &q,
            ])
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .output()
            .await
            .map_err(AppError::io)?;

        let stdout = String::from_utf8_lossy(&out.stdout);
        let mut songs = Vec::new();
        for line in stdout.lines() {
            if line.trim().is_empty() {
                continue;
            }
            if let Ok(v) = serde_json::from_str::<Value>(line) {
                let video_id = v["id"].as_str().unwrap_or("").to_string();
                if video_id.is_empty() {
                    continue;
                }
                songs.push(YtSong {
                    video_id,
                    title: v["title"].as_str().unwrap_or("Unknown").to_string(),
                    artist: v["channel"]
                        .as_str()
                        .or_else(|| v["uploader"].as_str())
                        .unwrap_or("")
                        .to_string(),
                    duration: v["duration"].as_f64(),
                    thumbnail: v["thumbnail"]
                        .as_str()
                        .map(|s| s.to_string())
                        .or_else(|| {
                            v["thumbnails"]
                                .as_array()
                                .and_then(|t| t.last())
                                .and_then(|t| t["url"].as_str())
                                .map(|s| s.to_string())
                        }),
                });
            }
        }
        Ok(songs)
    }

    /// Resolve a direct audio stream URL for a video id.
    pub async fn resolve_stream(&self, video_id: &str) -> AppResult<String> {
        let url = format!("https://www.youtube.com/watch?v={video_id}");
        let out = Command::new(&self.binary)
            .args([
                "-f",
                "bestaudio[ext=m4a]/bestaudio/best",
                "-g",
                "--no-warnings",
                "--no-playlist",
                &url,
            ])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await
            .map_err(AppError::io)?;

        let stdout = String::from_utf8_lossy(&out.stdout);
        let line = stdout
            .lines()
            .find(|l| l.starts_with("http"))
            .map(|s| s.trim().to_string());
        line.ok_or_else(|| {
            let err = String::from_utf8_lossy(&out.stderr);
            AppError::Stream(format!("yt-dlp resolve failed: {err}"))
        })
    }

    /// Download best audio into `dir`, return the produced file path.
    pub async fn download(&self, video_id: &str, dir: &Path) -> AppResult<PathBuf> {
        std::fs::create_dir_all(dir).map_err(AppError::io)?;
        let url = format!("https://www.youtube.com/watch?v={video_id}");
        let template = dir.join("%(id)s.%(ext)s");
        let out = Command::new(&self.binary)
            .args([
                "-f",
                "bestaudio[ext=m4a]/bestaudio/best",
                "-o",
                &template.to_string_lossy(),
                "--no-warnings",
                "--no-playlist",
                &url,
            ])
            .stdout(Stdio::null())
            .stderr(Stdio::piped())
            .output()
            .await
            .map_err(AppError::io)?;

        if !out.status.success() {
            return Err(AppError::Stream(format!(
                "download failed: {}",
                String::from_utf8_lossy(&out.stderr)
            )));
        }

        let mut found = None;
        if let Ok(rd) = std::fs::read_dir(dir) {
            for entry in rd.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.starts_with(video_id) {
                    found = Some(entry.path());
                    break;
                }
            }
        }
        found.ok_or_else(|| AppError::NotFound("downloaded file not found".into()))
    }
}

/// Shared fallback title cache for iTunes fallback (videoId -> query).
pub type VideoMetaCache = parking_lot::RwLock<std::collections::HashMap<String, String>>;

pub fn new_meta_cache() -> VideoMetaCache {
    parking_lot::RwLock::new(std::collections::HashMap::new())
}
