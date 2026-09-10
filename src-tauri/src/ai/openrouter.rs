use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use parking_lot::Mutex;
use serde_json::{json, Value};

use crate::error::{AppError, AppResult};

const OPENROUTER_URL: &str = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL: &str = "gemma-4-31b-it:free";

/// Load-balanced OpenRouter keys with error decay.
pub struct OpenRouterBalancer {
    keys: Mutex<Vec<KeyStat>>,
    cursor: AtomicUsize,
}

struct KeyStat {
    key: String,
    errors: u32,
    last_used: u64,
}

impl OpenRouterBalancer {
    pub fn from_env_or_default() -> Self {
        let keys: Vec<String> = std::env::var("OPENROUTER_KEYS")
            .ok()
            .map(|s| {
                s.split(',')
                    .map(|k| k.trim().to_string())
                    .filter(|k| !k.is_empty())
                    .collect()
            })
            .filter(|v: &Vec<String>| !v.is_empty())
            .unwrap_or_else(default_keys);

        Self::new(keys)
    }

    pub fn new(keys: Vec<String>) -> Self {
        Self {
            keys: Mutex::new(
                keys.into_iter()
                    .map(|key| KeyStat {
                        key,
                        errors: 0,
                        last_used: 0,
                    })
                    .collect(),
            ),
            cursor: AtomicUsize::new(0),
        }
    }

    fn pick(&self) -> AppResult<String> {
        let mut keys = self.keys.lock();
        if keys.is_empty() {
            return Err(AppError::Ai("no API keys configured".into()));
        }
        keys.sort_by(|a, b| {
            a.errors
                .cmp(&b.errors)
                .then(a.last_used.cmp(&b.last_used))
        });
        let selected = &mut keys[0];
        selected.last_used = now_ms();
        if selected.errors > 0 && rand::random::<f64>() > 0.5 {
            selected.errors = selected.errors.saturating_sub(1);
        }
        let key = selected.key.clone();
        let _ = self.cursor.fetch_add(1, Ordering::Relaxed);
        Ok(key)
    }

    fn report_error(&self, key: &str) {
        let mut keys = self.keys.lock();
        if let Some(stat) = keys.iter_mut().find(|k| k.key == key) {
            stat.errors = stat.errors.saturating_add(5);
        }
    }

    fn build_messages(system: &str, messages: &[Value]) -> Vec<Value> {
        let mut msgs = vec![json!({"role": "system", "content": system})];
        msgs.extend(messages.iter().cloned());
        msgs
    }

    pub async fn chat(
        &self,
        messages: Vec<Value>,
        system: &str,
        temperature: f64,
    ) -> AppResult<String> {
        let client = reqwest::Client::new();
        let mut attempts = 0;
        let mut last_err = String::new();
        while attempts < 3 {
            let key = self.pick()?;
            let msgs = Self::build_messages(system, &messages);
            let resp = client
                .post(OPENROUTER_URL)
                .header("Authorization", format!("Bearer {key}"))
                .header("Content-Type", "application/json")
                .header("HTTP-Referer", "https://pouyamusic.com")
                .header("X-Title", "Pouya Music AI")
                .json(&json!({
                    "model": OPENROUTER_MODEL,
                    "messages": msgs,
                    "temperature": temperature,
                    "repetition_penalty": 1.15
                }))
                .send()
                .await;

            match resp {
                Ok(r) if r.status().is_success() => {
                    let data: Value = r.json().await.map_err(AppError::network)?;
                    return Ok(data["choices"][0]["message"]["content"]
                        .as_str()
                        .unwrap_or("")
                        .to_string());
                }
                Ok(r) => {
                    last_err = format!("HTTP {}", r.status());
                    self.report_error(&key);
                }
                Err(e) => {
                    last_err = e.to_string();
                    self.report_error(&key);
                }
            }
            attempts += 1;
        }
        Err(AppError::Ai(last_err))
    }

    /// Stream chat completions. Returns the full text and a list of delta chunks.
    pub async fn chat_stream(
        &self,
        messages: Vec<Value>,
        system: &str,
    ) -> AppResult<(String, Vec<String>)> {
        use futures_util::StreamExt;

        let client = reqwest::Client::new();
        let mut attempts = 0;
        while attempts < 3 {
            let key = self.pick()?;
            let msgs = Self::build_messages(system, &messages);

            let resp = client
                .post(OPENROUTER_URL)
                .header("Authorization", format!("Bearer {key}"))
                .header("Content-Type", "application/json")
                .header("HTTP-Referer", "https://pouyamusic.com")
                .header("X-Title", "Pouya Music AI")
                .json(&json!({
                    "model": OPENROUTER_MODEL,
                    "messages": msgs,
                    "stream": true,
                    "temperature": 0.6,
                    "repetition_penalty": 1.15
                }))
                .send()
                .await;

            let resp = match resp {
                Ok(r) if r.status().is_success() => r,
                Ok(_) => {
                    self.report_error(&key);
                    attempts += 1;
                    continue;
                }
                Err(_) => {
                    self.report_error(&key);
                    attempts += 1;
                    continue;
                }
            };

            let mut stream = resp.bytes_stream();
            let mut buffer = String::new();
            let mut full_text = String::new();
            let mut chunks = Vec::new();

            while let Some(chunk) = stream.next().await {
                let chunk = chunk.map_err(AppError::network)?;
                buffer.push_str(&String::from_utf8_lossy(&chunk));
                while let Some(idx) = buffer.find('\n') {
                    let line = buffer[..idx].to_string();
                    buffer = buffer[idx + 1..].to_string();
                    let line = line.trim();
                    if line.is_empty() || line == "data: [DONE]" {
                        continue;
                    }
                    let payload = if let Some(rest) = line.strip_prefix("data: ") {
                        rest
                    } else if line.starts_with('{') {
                        line
                    } else {
                        continue;
                    };
                    if let Ok(data) = serde_json::from_str::<Value>(payload) {
                        if let Some(content) = data["choices"][0]["delta"]["content"].as_str() {
                            if !content.is_empty() {
                                full_text.push_str(content);
                                chunks.push(content.to_string());
                            }
                        }
                    }
                }
            }
            return Ok((full_text, chunks));
        }
        Ok((
            String::new(),
            vec![" [سیستم با خطای اتصال مواجه شد. لطفاً دوباره تلاش کنید.] ".into()],
        ))
    }
}

fn default_keys() -> Vec<String> {
    // Env-only. Never hardcode secrets in source.
    std::env::var("OPENROUTER_KEYS")
        .ok()
        .map(|s| {
            s.split(',')
                .map(|k| k.trim().to_string())
                .filter(|k| !k.is_empty())
                .collect()
        })
        .unwrap_or_default()
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Extract the first JSON object/array from mixed AI text.
pub fn extract_json_block(text: &str) -> Option<String> {
    if let Some(idx) = text.find("```json") {
        let rest = &text[idx + 7..];
        if let Some(end) = rest.find("```") {
            return Some(rest[..end].trim().to_string());
        }
    }
    if let Some(idx) = text.find("```") {
        let rest = &text[idx + 3..];
        if let Some(end) = rest.find("```") {
            let inner = rest[..end].trim();
            if inner.starts_with('[') || inner.starts_with('{') {
                return Some(inner.to_string());
            }
        }
    }
    if let (Some(s), Some(e)) = (text.find('['), text.rfind(']')) {
        if e > s {
            return Some(text[s..=e].to_string());
        }
    }
    if let (Some(s), Some(e)) = (text.find('{'), text.rfind('}')) {
        if e > s {
            return Some(text[s..=e].to_string());
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_fenced_json() {
        let t = "hello\n```json\n[1,2]\n```\nbye";
        assert_eq!(extract_json_block(t).unwrap(), "[1,2]");
    }

    #[test]
    fn extracts_raw_array() {
        let t = "prefix [{\"a\":1}] suffix";
        assert_eq!(extract_json_block(t).unwrap(), "[{\"a\":1}]");
    }
}
