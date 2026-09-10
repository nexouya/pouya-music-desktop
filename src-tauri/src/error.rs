use serde::Serialize;
use thiserror::Error;

pub type AppResult<T> = Result<T, AppError>;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("not found: {0}")]
    NotFound(String),
    #[error("invalid input: {0}")]
    Invalid(String),
    #[error("storage error: {0}")]
    Storage(String),
    #[error("io error: {0}")]
    Io(String),
    #[error("network error: {0}")]
    Network(String),
    #[error("stream error: {0}")]
    Stream(String),
    #[error("ai error: {0}")]
    Ai(String),
    #[error("ffmpeg error: {0}")]
    Ffmpeg(String),
    #[error("internal error: {0}")]
    Internal(String),
}

impl AppError {
    pub fn io(err: impl std::fmt::Display) -> Self {
        Self::Io(err.to_string())
    }

    pub fn storage(err: impl std::fmt::Display) -> Self {
        Self::Storage(err.to_string())
    }

    pub fn network(err: impl std::fmt::Display) -> Self {
        Self::Network(err.to_string())
    }
}

impl From<std::io::Error> for AppError {
    fn from(value: std::io::Error) -> Self {
        Self::Io(value.to_string())
    }
}

impl From<rusqlite::Error> for AppError {
    fn from(value: rusqlite::Error) -> Self {
        Self::Storage(value.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(value: serde_json::Error) -> Self {
        Self::Internal(value.to_string())
    }
}

impl From<reqwest::Error> for AppError {
    fn from(value: reqwest::Error) -> Self {
        Self::Network(value.to_string())
    }
}

impl From<lofty::error::LoftyError> for AppError {
    fn from(value: lofty::error::LoftyError) -> Self {
        Self::Io(value.to_string())
    }
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

impl From<AppError> for String {
    fn from(value: AppError) -> Self {
        value.to_string()
    }
}
