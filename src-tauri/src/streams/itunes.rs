use serde_json::Value;
use url::Url;

use crate::error::{AppError, AppResult};

pub async fn search(
    term: &str,
    entity: &str,
    limit: u32,
    offset: u32,
) -> AppResult<Value> {
    let mut url = Url::parse("https://itunes.apple.com/search")
        .map_err(|e| AppError::Network(e.to_string()))?;
    url.query_pairs_mut()
        .append_pair("term", term)
        .append_pair("entity", entity)
        .append_pair("limit", &limit.to_string())
        .append_pair("offset", &offset.to_string());

    let client = reqwest::Client::new();
    let resp = client
        .get(url.as_str())
        .send()
        .await
        .map_err(AppError::network)?;
    if !resp.status().is_success() {
        return Err(AppError::Network(format!("iTunes HTTP {}", resp.status())));
    }
    resp.json::<Value>().await.map_err(AppError::network)
}

pub async fn lookup(id: &str) -> AppResult<Value> {
    let url = format!(
        "https://itunes.apple.com/lookup?id={}",
        urlencoding_lite(id)
    );
    let client = reqwest::Client::new();
    let resp = client.get(&url).send().await.map_err(AppError::network)?;
    if !resp.status().is_success() {
        return Err(AppError::Network(format!("iTunes HTTP {}", resp.status())));
    }
    resp.json::<Value>().await.map_err(AppError::network)
}

/// Fetch an iTunes preview URL for fallback streaming.
pub async fn preview_url_for_query(query: &str) -> AppResult<String> {
    let data = search(query, "song", 1, 0).await?;
    data["results"][0]["previewUrl"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| AppError::NotFound("no iTunes preview".into()))
}

fn urlencoding_lite(s: &str) -> String {
    let mut out = String::with_capacity(s.len() * 3);
    for byte in s.as_bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(*byte as char)
            }
            _ => out.push_str(&format!("%{byte:02X}")),
        }
    }
    out
}
