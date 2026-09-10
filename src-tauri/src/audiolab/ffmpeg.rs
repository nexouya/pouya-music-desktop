use std::path::{Path, PathBuf};
use std::process::Stdio;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::process::Command;

use crate::error::{AppError, AppResult};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Enhancements {
    #[serde(default)]
    pub noise_reduction: bool,
    #[serde(default)]
    pub clarity: bool,
    #[serde(default)]
    pub eq: bool,
    #[serde(default)]
    pub compressor: bool,
    #[serde(default)]
    pub stereo: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessResult {
    pub message: String,
    pub file_name: String,
    pub stats: ProcessStats,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessStats {
    pub sample_rate: String,
    pub bitrate: String,
    pub original_size: u64,
    pub final_size: u64,
    pub format: String,
}

pub struct Ffmpeg {
    ffmpeg: PathBuf,
    ffprobe: PathBuf,
}

impl Ffmpeg {
    pub fn discover(resource_dir: Option<&Path>) -> Self {
        let mut ff = Vec::new();
        let mut fp = Vec::new();
        if let Some(rd) = resource_dir {
            ff.push(rd.join("bin").join("ffmpeg.exe"));
            ff.push(rd.join("ffmpeg.exe"));
            fp.push(rd.join("bin").join("ffprobe.exe"));
            fp.push(rd.join("ffprobe.exe"));
        }
        if let Ok(cwd) = std::env::current_dir() {
            ff.push(cwd.join("bin").join("ffmpeg.exe"));
            fp.push(cwd.join("bin").join("ffprobe.exe"));
            ff.push(cwd.join("..").join("bin").join("ffmpeg.exe"));
            fp.push(cwd.join("..").join("bin").join("ffprobe.exe"));
        }
        Self {
            ffmpeg: ff
                .into_iter()
                .find(|p| p.is_file())
                .unwrap_or_else(|| PathBuf::from("ffmpeg")),
            ffprobe: fp
                .into_iter()
                .find(|p| p.is_file())
                .unwrap_or_else(|| PathBuf::from("ffprobe")),
        }
    }

    pub fn available(&self) -> bool {
        self.ffmpeg.is_file()
            || which_exists(&self.ffmpeg)
    }

    /// Process audio with the same preset/filter chain as the Express Audio Lab.
    pub async fn process(
        &self,
        input: &Path,
        uploads_dir: &Path,
        preset: &str,
        out_format: &str,
        enhancements: &Enhancements,
    ) -> AppResult<ProcessResult> {
        std::fs::create_dir_all(uploads_dir).map_err(AppError::io)?;
        let file_name = format!("processed_{}.{}", now_ms(), sanitize_ext(out_format));
        let out_path = uploads_dir.join(&file_name);

        let mut filters: Vec<String> = Vec::new();
        let mut args: Vec<String> = vec!["-y".into(), "-i".into(), input.to_string_lossy().into()];

        match preset {
            "studio" => {
                args.push("-ar".into());
                args.push("48000".into());
            }
            "restoration" => {
                filters.push("afftdn=nr=10:nf=-30:tn=1".into());
                filters.push("highpass=f=28".into());
                filters.push("equalizer=f=3200:width_type=q:width=1.2:g=1.5".into());
                filters.push("alimiter=limit=0.96:attack=7:release=100:asc=1".into());
            }
            _ => {
                args.push("-ar".into());
                args.push("44100".into());
            }
        }

        if enhancements.noise_reduction && preset != "restoration" {
            filters.push("afftdn=nr=8:nf=-32:tn=1".into());
        }
        if enhancements.clarity {
            filters.push("equalizer=f=3500:width_type=q:width=1.4:g=1.8".into());
            filters.push("treble=g=2.5:f=11000:width_type=q:width=0.8".into());
        }
        if enhancements.eq {
            filters.push("bass=g=2.2:f=80:width_type=q:width=0.7".into());
            filters.push("treble=g=2.0:f=12000:width_type=q:width=0.7".into());
        }
        if enhancements.compressor {
            filters.push(
                "acompressor=threshold=-12dB:ratio=2.2:attack=15:release=120:makeup=1.5dB:knee=2.8dB"
                    .into(),
            );
        }
        if enhancements.stereo {
            filters.push("extrastereo=m=1.12:c=y".into());
        }

        if !filters.is_empty() {
            args.push("-af".into());
            args.push(filters.join(","));
        }

        match out_format {
            "mp3" => {
                args.push("-codec:a".into());
                args.push("libmp3lame".into());
                args.push("-b:a".into());
                args.push(if preset == "studio" { "320k" } else { "192k" }.into());
            }
            "aac" => {
                args.push("-codec:a".into());
                args.push("aac".into());
                args.push("-b:a".into());
                args.push(if preset == "studio" { "256k" } else { "128k" }.into());
            }
            "ogg" => {
                args.push("-codec:a".into());
                args.push("libvorbis".into());
                args.push("-b:a".into());
                args.push(if preset == "studio" { "256k" } else { "160k" }.into());
            }
            "flac" => {
                args.push("-codec:a".into());
                args.push("flac".into());
            }
            _ => {
                args.push("-codec:a".into());
                args.push("pcm_s16le".into());
            }
        }

        args.push(out_path.to_string_lossy().into());

        let out = Command::new(&self.ffmpeg)
            .args(&args)
            .stdout(Stdio::null())
            .stderr(Stdio::piped())
            .output()
            .await
            .map_err(AppError::io)?;

        if !out.status.success() {
            let _ = std::fs::remove_file(&out_path);
            return Err(AppError::Ffmpeg(String::from_utf8_lossy(&out.stderr).into()));
        }

        let final_size = std::fs::metadata(&out_path).map(|m| m.len()).unwrap_or(0);
        let original_size = std::fs::metadata(input).map(|m| m.len()).unwrap_or(0);
        let (sample_rate, bitrate) = self.probe(&out_path).await;

        Ok(ProcessResult {
            message: "Processing completed successfully".into(),
            file_name,
            stats: ProcessStats {
                sample_rate,
                bitrate,
                original_size,
                final_size,
                format: out_format.to_string(),
            },
        })
    }

    async fn probe(&self, path: &Path) -> (String, String) {
        let out = Command::new(&self.ffprobe)
            .args([
                "-v",
                "quiet",
                "-print_format",
                "json",
                "-show_streams",
                &path.to_string_lossy(),
            ])
            .output()
            .await;
        let Ok(out) = out else {
            return ("Unknown".into(), "Unknown".into());
        };
        let Ok(v) = serde_json::from_slice::<Value>(&out.stdout) else {
            return ("Unknown".into(), "Unknown".into());
        };
        let stream = &v["streams"][0];
        let sample_rate = stream["sample_rate"]
            .as_str()
            .unwrap_or("Unknown")
            .to_string();
        let bitrate = stream["bit_rate"]
            .as_str()
            .and_then(|b| b.parse::<u64>().ok())
            .map(|b| format!("{} kbps", b / 1000))
            .unwrap_or_else(|| "VBR / PCM".into());
        (sample_rate, bitrate)
    }
}

fn sanitize_ext(fmt: &str) -> &str {
    match fmt {
        "mp3" | "aac" | "ogg" | "flac" | "wav" => fmt,
        _ => "wav",
    }
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn which_exists(cmd: &Path) -> bool {
    if cmd.components().count() > 1 {
        return cmd.is_file();
    }
    std::env::var_os("PATH")
        .map(|paths| {
            std::env::split_paths(&paths).any(|dir| {
                let p = dir.join(cmd);
                p.is_file()
                    || dir.join(format!("{}.exe", cmd.to_string_lossy())).is_file()
            })
        })
        .unwrap_or(false)
}
