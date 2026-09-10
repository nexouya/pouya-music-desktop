use std::sync::Arc;

use axum::{
    body::Body,
    extract::{DefaultBodyLimit, Multipart, Path as AxPath, Query, State},
    http::{header, HeaderMap, HeaderValue, Method, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use tokio_util::io::ReaderStream;
use tower_http::cors::{Any, CorsLayer};

use crate::audiolab::{Enhancements, Ffmpeg};
use crate::core::files::FileService;
use crate::core::track::Track;
use crate::core::Core;
use crate::error::AppError;
use crate::streams::{itunes, ytdlp};

pub struct HttpShared {
    pub core: Arc<Core>,
    pub yt: ytdlp::YtDlp,
    pub ffmpeg: Ffmpeg,
    pub meta_cache: ytdlp::VideoMetaCache,
    pub ai: Arc<crate::ai::OpenRouterBalancer>,
    pub api_port: parking_lot::RwLock<u16>,
}

pub fn router(shared: Arc<HttpShared>) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers(Any);

    Router::new()
        .route("/api/songs", get(api_songs))
        .route("/api/curate-stream", post(api_curate_stream))
        .route("/api/search", post(api_search))
        .route("/api/music-history", post(api_music_history))
        .route("/api/chat-stream", post(api_chat_stream))
        .route("/api/eq-tuning", post(api_eq_tuning))
        .route("/api/playlist-creator", post(api_playlist_creator))
        .route("/api/audiolab/process", post(api_audiolab_process))
        .route("/api/audiolab/file", get(api_audiolab_file))
        .route("/api/audiolab/download", get(api_audiolab_download))
        .route("/api/proxy/itunes/search", get(api_itunes_search))
        .route("/api/proxy/itunes/lookup", get(api_itunes_lookup))
        .route("/api/liked", get(api_liked).post(api_set_liked))
        .route("/yt/healthz", get(yt_healthz))
        .route("/yt/api/status", get(yt_status))
        .route("/yt/api/search", get(yt_search))
        .route("/yt/stream/{video_id}", get(yt_stream))
        .route("/yt/play/{video_id}", get(yt_play))
        .route("/yt/download/{video_id}", get(yt_download))
        .route("/media/audio/{track_id}", get(media_audio))
        .route("/media/cover/{track_id}", get(media_cover))
        .route("/media/playlist-cover/{id}", get(media_playlist_cover))
        .layer(DefaultBodyLimit::max(50 * 1024 * 1024))
        .layer(cors)
        .with_state(shared)
}

// ---------- helpers ----------

fn err_response(err: AppError) -> Response {
    let status = match &err {
        AppError::NotFound(_) => StatusCode::NOT_FOUND,
        AppError::Invalid(_) => StatusCode::BAD_REQUEST,
        _ => StatusCode::INTERNAL_SERVER_ERROR,
    };
    (status, Json(json!({ "error": err.to_string() }))).into_response()
}

fn sse_headers() -> [(header::HeaderName, &'static str); 3] {
    [
        (header::CONTENT_TYPE, "text/event-stream"),
        (header::CACHE_CONTROL, "no-cache"),
        (header::CONNECTION, "keep-alive"),
    ]
}

async fn sse_from_chunks(chunks: Vec<String>) -> Response {
    let mut body = String::new();
    for c in chunks {
        body.push_str(&format!("data: {}\n\n", serde_json::json!({ "type": "chunk", "text": c })));
    }
    body.push_str("data: [DONE]\n\n");
    let mut resp = Response::new(Body::from(body));
    for (k, v) in sse_headers() {
        resp.headers_mut().insert(k, HeaderValue::from_static(v));
    }
    resp
}

// ---------- curated / AI ----------

fn curated_tracks() -> Vec<Value> {
    let raw = [
        ("curated-1", "Vapor Highway", "Neon Raider", "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", 372.0, "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=400&fit=crop", "Synthwave"),
        ("curated-2", "Cybernetic Drift", "Laser Grid", "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", 423.0, "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=400&fit=crop", "Cyberpunk"),
        ("curated-3", "Chrome Phantom", "Tokyo Spectre", "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3", 302.0, "https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=400&fit=crop", "Darksynth"),
        ("curated-4", "Digital Dreamscape", "Vector Void", "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3", 318.0, "https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=400&fit=crop", "Ambient Cyber"),
        ("curated-5", "Neon Pulse Radar", "Glitch Sovereign", "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-14.mp3", 395.0, "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=400&fit=crop", "Outrun"),
    ];
    raw.into_iter()
        .map(|(id, title, artist, url, duration, cover, category)| {
            json!({
                "id": id,
                "title": title,
                "artist": artist,
                "url": url,
                "duration": duration,
                "coverUrl": cover,
                "isLocal": false,
                "category": category
            })
        })
        .collect()
}

async fn api_songs() -> Response {
    Json(json!({ "status": "success", "tracks": curated_tracks() })).into_response()
}

#[derive(Deserialize)]
struct PromptBody {
    prompt: String,
}

async fn api_curate_stream(State(st): State<Arc<HttpShared>>, Json(body): Json<PromptBody>) -> Response {
    let system = r#"You are a cold, highly supportive cybernetic intelligence that is deep, neon-lit, and futuristic. You are the Super AI Agent of the 'Pouya Music' site.
The user wants to find electronic, cyberpunk, retrowave, lo-fi, or dark ambient tracks.
Reply in character. DO NOT use UI/UX analogies. Be extremely concise.
Respond in Persian (فارسی).
IMPORTANT: Write smoothly without stuttering or repeating characters.

ALSO, at the VERY END of your message, you MUST include a JSON block containing 1-3 track recommendations.
The JSON block must be EXACTLY in this format:
JSON_TRACKS_START
[
  { "title": "Track Name", "artist": "CyberArtist", "category": "Synthwave", "description": "Vibe", "songIndex": 3 }
]
JSON_TRACKS_END
songIndex must be 1 to 16. Do not include markdown around the JSON block."#;

    let messages = vec![json!({"role":"user","content": body.prompt})];
    let (full_text, chunks) = match st.ai.chat_stream(messages, system).await {
        Ok(v) => v,
        Err(e) => return err_response(e),
    };

    // Parse tracks JSON
    let mut tracks: Value = Value::Null;
    if let Some(start) = full_text.find("JSON_TRACKS_START") {
        let rest = &full_text[start + "JSON_TRACKS_START".len()..];
        let end = rest.find("JSON_TRACKS_END").unwrap_or(rest.len());
        let mut json_str = rest[..end].trim().to_string();
        if let Some(i) = json_str.find("```json") {
            if let Some(e) = json_str[i + 7..].find("```") {
                json_str = json_str[i + 7..i + 7 + e].trim().to_string();
            }
        } else if let Some(i) = json_str.find("```") {
            if let Some(e) = json_str[i + 3..].find("```") {
                json_str = json_str[i + 3..i + 3 + e].trim().to_string();
            }
        }
        if let Ok(v) = serde_json::from_str::<Value>(&json_str) {
            if v.is_array() {
                tracks = v;
            }
        }
    }
    if tracks.is_null() {
        tracks = json!([{
            "title": "System Override",
            "artist": "Auto-Curator",
            "category": "Cyberpunk",
            "description": "A reliable recommendation from local memory banks.",
            "songIndex": 3
        }]);
    }

    let mut body_out = String::new();
    for c in &chunks {
        body_out.push_str(&format!(
            "data: {}\n\n",
            json!({ "type": "chunk", "text": c })
        ));
    }
    body_out.push_str(&format!(
        "data: {}\n\n",
        json!({ "type": "tracks", "tracks": tracks })
    ));

    let mut resp = Response::new(Body::from(body_out));
    for (k, v) in sse_headers() {
        resp.headers_mut().insert(k, HeaderValue::from_static(v));
    }
    resp
}

async fn api_search(State(st): State<Arc<HttpShared>>, Json(body): Json<Value>) -> Response {
    let query = body["query"].as_str().unwrap_or("").trim().to_string();
    if query.is_empty() {
        return err_response(AppError::Invalid("Query is required".into()));
    }
    let system = r#"Construct 3 appropriate futuristic high-quality track recommendations to feed a visualizer based on the query.
Map each track to a 'songIndex' strictly between 1 and 16.
Select a fitting photorealistic cover image from these EXACT URLs:
1. https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=400&fit=crop
2. https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=400&fit=crop
3. https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=400&fit=crop
4. https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=400&fit=crop
5. https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=400&fit=crop
6. https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=400&fit=crop
Return STRICTLY VALID JSON array. DO NOT INCLUDE ANY MARKDOWN formatting. ONLY return raw JSON starting with [ and ending with ]."#;

    match st
        .ai
        .chat(vec![json!({"role":"user","content": query})], system, 0.6)
        .await
    {
        Ok(text) => {
            let cleaned = crate::ai::openrouter::extract_json_block(&text).unwrap_or(text);
            match serde_json::from_str::<Value>(&cleaned) {
                Ok(parsed) => Json(json!({ "status": "success", "results": parsed })).into_response(),
                Err(_) => fallback_search(&query),
            }
        }
        Err(_) => fallback_search(&query),
    }
}

fn fallback_search(query: &str) -> Response {
    Json(json!({
        "status": "fallback",
        "results": [{
            "title": format!("{query} Wave"),
            "artist": "Algorithm Spectre",
            "category": "Darksynth",
            "songIndex": 3,
            "coverUrl": "https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=400&fit=crop"
        }]
    }))
    .into_response()
}

async fn api_music_history(State(st): State<Arc<HttpShared>>, Json(body): Json<Value>) -> Response {
    let era = body["era"].as_str().unwrap_or("");
    let genre = body["genre"].as_str().unwrap_or("");
    let focus = body["focus"].as_str().unwrap_or("");
    let system = r#"You are 'Pouya Music Archive'.
Provide 3 real historical album/track references based on the request.
Return STRICTLY VALID JSON object. NO MARKDOWN:
{
  "message": "Introductory text",
  "discoveries": [
    { "title": "T", "artist": "A", "year": "Y", "significance": "S", "databaseSource": "D", "songIndex": 1 }
  ]
}"#;
    let prompt = format!("Era: {era}, Genre: {genre}, Focus: {focus}");
    match st
        .ai
        .chat(vec![json!({"role":"user","content": prompt})], system, 0.6)
        .await
    {
        Ok(text) => {
            let cleaned = crate::ai::openrouter::extract_json_block(&text).unwrap_or(text);
            match serde_json::from_str::<Value>(&cleaned) {
                Ok(data) => Json(json!({ "status": "success", "data": data })).into_response(),
                Err(_) => err_response(AppError::Ai("Archive link failed.".into())),
            }
        }
        Err(_) => err_response(AppError::Ai("Archive link failed.".into())),
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ChatBody {
    message: String,
    #[serde(default)]
    current_track: Option<Value>,
    #[serde(default)]
    liked_tracks: Option<Vec<Value>>,
    #[serde(default)]
    chat_history: Option<Vec<Value>>,
    #[serde(default)]
    live_stats: Option<Value>,
}

async fn api_chat_stream(State(st): State<Arc<HttpShared>>, Json(body): Json<ChatBody>) -> Response {
    let liked_string = body
        .liked_tracks
        .as_ref()
        .map(|list| {
            if list.is_empty() {
                "None yet".to_string()
            } else {
                list.iter()
                    .map(|t| {
                        format!(
                            "{} by {}",
                            t["title"].as_str().unwrap_or(""),
                            t["artist"].as_str().unwrap_or("")
                        )
                    })
                    .collect::<Vec<_>>()
                    .join(", ")
            }
        })
        .unwrap_or_else(|| "None yet".into());

    let current_track_string = match body.current_track.as_ref() {
        Some(t) if !t.is_null() => format!(
            "'{}' by {} (Genre: {})",
            t["title"].as_str().unwrap_or(""),
            t["artist"].as_str().unwrap_or(""),
            t["category"].as_str().unwrap_or("")
        ),
        _ => "Not currently listening to anything.".into(),
    };

    let live_stats_text = match body.live_stats.as_ref() {
        Some(s) if !s.is_null() => format!(
            "Bass: {}%, Mid: {}%, Treble: {}%",
            (s["bass"].as_f64().unwrap_or(0.0) * 100.0).round(),
            (s["mid"].as_f64().unwrap_or(0.0) * 100.0).round(),
            (s["treble"].as_f64().unwrap_or(0.0) * 100.0).round()
        ),
        _ => "No live analysis data available.".into(),
    };

    let system = format!(
        r#"شما سوپر ایجنت هوشمند سایت 'پویا موزیک' هستید. شما یک دستیار موسیقی بسیار حرفه‌ای، صمیمی و کمک‌کننده هستید.
CURRENT CONTEXT:
Track: {current_track_string}
Liked: {liked_string}
METERS: {live_stats_text}

STRICT DIRECTIVES:
1. ALWAYS provide VERY SHORT, CONCISE, and USEFUL answers.
2. DO NOT hallucinate the current track. If nothing is playing, acknowledge it.
3. DO NOT use UI/UX analogies or technical jargon. Act as a friendly and helpful music assistant.
4. ALWAYS format song names and artist names wrapped EXACTLY in single backticks like `Artist Name - Song` so the UI can highlight them correctly.
5. If the user asks for song lyrics (متن آهنگ), strictly reply: "متأسفانه به دلیل محدودیت‌ها، امکان ارائه متن آهنگ وجود ندارد."
6. Speak naturally and professionally in Persian (فارسی محاوره‌ای، روان و بسیار کوتاه).
7. DO NOT repeat yourself or write long paragraphs."#
    );

    let mut messages = Vec::new();
    if let Some(history) = body.chat_history {
        for msg in history {
            let role = if msg["role"].as_str() == Some("user") {
                "user"
            } else {
                "assistant"
            };
            messages.push(json!({ "role": role, "content": msg["text"].as_str().unwrap_or("") }));
        }
    }
    messages.push(json!({ "role": "user", "content": body.message }));

    let chunks = match st.ai.chat_stream(messages, &system).await {
        Ok((_full, chunks)) => chunks,
        Err(_) => vec![" [سیستم با خطای اتصال مواجه شد. لطفاً دوباره تلاش کنید.] ".to_string()],
    };
    sse_from_chunks(chunks).await
}

async fn api_eq_tuning(State(st): State<Arc<HttpShared>>, Json(body): Json<Value>) -> Response {
    let description = body["description"].as_str().unwrap_or("").to_string();
    let system = r#"You are DJ Sound Engineer Super Agent for the 'Pouya Music' site. Output perfect DJ parameters for the request.
Provide a VERY SHORT, one-sentence or two-sentence explanation in Persian. Do NOT use UI/UX analogies.
Return STRICTLY VALID JSON object. NO MARKDOWN:
{
  "bassGain": 5, "midGain": 0, "trebleGain": 2,
  "filterType": "none", "filterCutoff": 12000, "filterQ": 1.0,
  "echoLevel": 0.2, "echoDelayTime": 0.3, "playbackRate": 1.0,
  "is8D": false, "panSpeed": 5, "explanation": "Persian explanation"
}"#;

    match st
        .ai
        .chat(vec![json!({"role":"user","content": description})], system, 0.6)
        .await
    {
        Ok(text) => {
            let cleaned = crate::ai::openrouter::extract_json_block(&text).unwrap_or(text);
            match serde_json::from_str::<Value>(&cleaned) {
                Ok(tuning) => Json(json!({ "status": "success", "tuning": tuning })).into_response(),
                Err(_) => fallback_eq(),
            }
        }
        Err(_) => fallback_eq(),
    }
}

fn fallback_eq() -> Response {
    Json(json!({
        "status": "success",
        "tuning": {
            "bassGain": 5, "midGain": 0, "trebleGain": 4, "filterType": "none",
            "filterCutoff": 12000, "filterQ": 1.2, "echoLevel": 0.0, "echoDelayTime": 0.3,
            "playbackRate": 1.0, "is8D": false, "panSpeed": 5,
            "explanation": "میکسر دی‌جی با اکولایزر ریتمیک ست شد."
        }
    }))
    .into_response()
}

async fn api_playlist_creator(State(st): State<Arc<HttpShared>>, Json(body): Json<PromptBody>) -> Response {
    if body.prompt.trim().is_empty() {
        return err_response(AppError::Invalid("Prompt is required".into()));
    }
    let system = format!(
        r#"You are DJ Neon, the AI Playlist Creator for 'Pouya Music'.
The user provides a mood, situation, or vibe: "{}".
Generate a list of 5-8 REAL, well-known songs that perfectly match this mood.
IMPORTANT: You MUST ONLY return real, famous, and widely available songs that actually exist. DO NOT invent or hallucinate songs or artists.
Return STRICTLY VALID JSON object. NO MARKDOWN:
{{
  "playlistName": "A creative neon/cyberpunk themed name for this playlist",
  "tracks": [
    {{ "title": "Exact Song Title", "artist": "Exact Artist Name", "description": "Why this matches the mood briefly." }}
  ]
}}"#,
        body.prompt
    );

    match st
        .ai
        .chat(vec![json!({"role":"user","content": body.prompt})], &system, 0.6)
        .await
    {
        Ok(text) => {
            let cleaned = crate::ai::openrouter::extract_json_block(&text).unwrap_or(text);
            match serde_json::from_str::<Value>(&cleaned) {
                Ok(playlist) => Json(json!({ "status": "success", "playlist": playlist })).into_response(),
                Err(_) => err_response(AppError::Ai("Failed to generate playlist.".into())),
            }
        }
        Err(_) => err_response(AppError::Ai("Failed to generate playlist.".into())),
    }
}

// ---------- Audio Lab ----------

async fn api_audiolab_process(
    State(st): State<Arc<HttpShared>>,
    mut multipart: Multipart,
) -> Response {
    let mut input_path: Option<std::path::PathBuf> = None;
    let mut preset = "standard".to_string();
    let mut out_format = "wav".to_string();
    let mut enhancements = Enhancements::default();
    let uploads = st.core.storage.uploads_dir();
    if let Err(e) = std::fs::create_dir_all(&uploads) {
        return err_response(AppError::io(e));
    }

    while let Ok(Some(field)) = multipart.next_field().await {
        let name = field.name().unwrap_or("").to_string();
        match name.as_str() {
            "audio" => {
                let file_name = field
                    .file_name()
                    .map(|s| sanitize_filename::sanitize(s))
                    .unwrap_or_else(|| "upload.bin".into());
                let ext = std::path::Path::new(&file_name)
                    .extension()
                    .map(|e| e.to_string_lossy().to_lowercase())
                    .unwrap_or_else(|| "bin".into());
                let dest = uploads.join(format!("input_{}.{}", crate_yuid(), ext));
                match field.bytes().await {
                    Ok(bytes) => {
                        if bytes.len() > 50 * 1024 * 1024 {
                            return err_response(AppError::Invalid("file too large".into()));
                        }
                        if let Err(e) = std::fs::write(&dest, &bytes) {
                            return err_response(AppError::io(e));
                        }
                        input_path = Some(dest);
                    }
                    Err(e) => return err_response(AppError::io(e)),
                }
            }
            "preset" => {
                if let Ok(b) = field.bytes().await {
                    preset = String::from_utf8_lossy(&b).to_string();
                }
            }
            "format" => {
                if let Ok(b) = field.bytes().await {
                    out_format = String::from_utf8_lossy(&b).to_string();
                }
            }
            "enhancements" => {
                if let Ok(b) = field.bytes().await {
                    if let Ok(v) = serde_json::from_slice::<Enhancements>(&b) {
                        enhancements = v;
                    }
                }
            }
            _ => {}
        }
    }

    let Some(input) = input_path else {
        return err_response(AppError::Invalid("No audio file provided.".into()));
    };

    let result = st
        .ffmpeg
        .process(&input, &uploads, &preset, &out_format, &enhancements)
        .await;
    let _ = std::fs::remove_file(&input);

    match result {
        Ok(r) => Json(json!({
            "message": r.message,
            "url": format!("/api/audiolab/download?file={}", r.file_name),
            "streamUrl": format!("/api/audiolab/file?file={}", r.file_name),
            "stats": r.stats
        }))
        .into_response(),
        Err(e) => err_response(e),
    }
}

fn crate_yuid() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

#[derive(Deserialize)]
struct FileQuery {
    file: String,
}

async fn api_audiolab_file(State(st): State<Arc<HttpShared>>, Query(q): Query<FileQuery>) -> Response {
    serve_local_file(&st.core.storage.uploads_dir(), &q.file, false).await
}

async fn api_audiolab_download(
    State(st): State<Arc<HttpShared>>,
    Query(q): Query<FileQuery>,
) -> Response {
    serve_local_file(&st.core.storage.uploads_dir(), &q.file, true).await
}

async fn serve_local_file(base: &std::path::Path, file_name: &str, download: bool) -> Response {
    let path = match FileService::safe_child(base, file_name) {
        Ok(p) => p,
        Err(e) => return err_response(e),
    };
    if !path.is_file() {
        return err_response(AppError::NotFound("File not found".into()));
    }
    match tokio::fs::File::open(&path).await {
        Ok(file) => {
            let stream = ReaderStream::new(file);
            let body = Body::from_stream(stream);
            let mut resp = Response::new(body);
            let mime = mime_guess::from_path(&path)
                .first_or_octet_stream()
                .essence_str()
                .to_string();
            if let Ok(v) = HeaderValue::from_str(&mime) {
                resp.headers_mut().insert(header::CONTENT_TYPE, v);
            }
            if download {
                resp.headers_mut().insert(
                    header::CONTENT_DISPOSITION,
                    HeaderValue::from_str(&format!(
                        "attachment; filename=\"{file_name}\""
                    ))
                    .unwrap_or_else(|_| HeaderValue::from_static("attachment")),
                );
            }
            resp
        }
        Err(e) => err_response(AppError::io(e)),
    }
}

// ---------- iTunes ----------

#[derive(Deserialize)]
struct ItunesSearchQuery {
    #[serde(default)]
    term: Option<String>,
    #[serde(default)]
    entity: Option<String>,
    #[serde(default)]
    limit: Option<u32>,
    #[serde(default)]
    offset: Option<u32>,
}

async fn api_itunes_search(Query(q): Query<ItunesSearchQuery>) -> Response {
    let term = q.term.unwrap_or_default();
    if term.is_empty() {
        return err_response(AppError::Invalid("term required".into()));
    }
    match itunes::search(
        &term,
        q.entity.as_deref().unwrap_or("song"),
        q.limit.unwrap_or(25),
        q.offset.unwrap_or(0),
    )
    .await
    {
        Ok(data) => Json(data).into_response(),
        Err(e) => err_response(e),
    }
}

#[derive(Deserialize)]
struct ItunesLookupQuery {
    id: String,
}

async fn api_itunes_lookup(Query(q): Query<ItunesLookupQuery>) -> Response {
    match itunes::lookup(&q.id).await {
        Ok(data) => Json(data).into_response(),
        Err(e) => err_response(e),
    }
}

async fn api_liked(State(st): State<Arc<HttpShared>>) -> Response {
    match st.core.liked() {
        Ok(list) => Json(json!({ "status": "success", "tracks": list })).into_response(),
        Err(e) => err_response(e),
    }
}

async fn api_set_liked(State(st): State<Arc<HttpShared>>, Json(body): Json<Value>) -> Response {
    let tracks: Vec<Track> = match serde_json::from_value(body["tracks"].clone()) {
        Ok(t) => t,
        Err(e) => return err_response(AppError::Invalid(e.to_string())),
    };
    match st.core.set_liked(tracks) {
        Ok(()) => Json(json!({ "status": "success" })).into_response(),
        Err(e) => err_response(e),
    }
}

// ---------- YouTube ----------

async fn yt_healthz(State(st): State<Arc<HttpShared>>) -> Response {
    let strategy = if st.yt.binary().is_file() || st.yt.binary() == std::path::Path::new("yt-dlp") {
        "ytdlp"
    } else {
        "none"
    };
    Json(json!({ "ok": true, "strategy": strategy })).into_response()
}

async fn yt_status(State(st): State<Arc<HttpShared>>) -> Response {
    let version = st.yt.describe().await.ok();
    Json(json!({
        "ok": true,
        "strategy": "ytdlp",
        "engines": [{
            "name": "yt-dlp",
            "version": version,
            "command": st.yt.binary().display().to_string()
        }]
    }))
    .into_response()
}

#[derive(Deserialize)]
struct YtSearchQuery {
    q: String,
}

async fn yt_search(State(st): State<Arc<HttpShared>>, Query(q): Query<YtSearchQuery>) -> Response {
    let query = q.q.trim().to_string();
    if query.is_empty() || query.len() > 200 {
        return err_response(AppError::Invalid("query parameter q is required".into()));
    }
    match st.yt.search(&query, 10).await {
        Ok(songs) => {
            {
                let mut cache = st.meta_cache.write();
                for s in &songs {
                    let key = s.video_id.clone();
                    let val = format!("{} {}", s.artist, s.title).trim().to_string();
                    cache.insert(key, val);
                }
            }
            let mapped: Vec<Value> = songs
                .into_iter()
                .map(|s| {
                    json!({
                        "videoId": s.video_id,
                        "title": s.title,
                        "artist": s.artist,
                        "duration": s.duration,
                        "thumbnail": s.thumbnail
                    })
                })
                .collect();
            Json(json!({ "query": query, "songs": mapped })).into_response()
        }
        Err(e) => err_response(e),
    }
}

async fn yt_stream(State(st): State<Arc<HttpShared>>, AxPath(video_id): AxPath<String>) -> Response {
    if !valid_video_id(&video_id) {
        return (StatusCode::BAD_REQUEST, "invalid video id").into_response();
    }
    match st.yt.resolve_stream(&video_id).await {
        Ok(url) => Response::builder()
            .status(StatusCode::FOUND)
            .header(header::LOCATION, url)
            .body(Body::empty())
            .unwrap_or_else(|_| err_response(AppError::Stream("redirect failed".into()))),
        Err(e) => err_response(e),
    }
}

async fn yt_play(
    State(st): State<Arc<HttpShared>>,
    AxPath(video_id): AxPath<String>,
    Query(q): Query<StrictQuery>,
    headers: HeaderMap,
) -> Response {
    if !valid_video_id(&video_id) {
        return (StatusCode::BAD_REQUEST, "invalid video id").into_response();
    }
    let strict = q.strict.as_deref() == Some("true");
    match st.yt.resolve_stream(&video_id).await {
        Ok(url) => proxy_audio(&url, &headers, None).await,
        Err(err) => {
            if strict {
                return err_response(err);
            }
            // iTunes fallback
            let query = {
                let cache = st.meta_cache.read();
                cache.get(&video_id).cloned()
            };
            let query = match query {
                Some(q) => q,
                None => match fetch_oembed_title(&video_id).await {
                    Some(t) => t,
                    None => "Michael Jackson Chicago".to_string(),
                },
            };
            match itunes::preview_url_for_query(&query).await {
                Ok(preview) => proxy_audio(&preview, &headers, None).await,
                Err(_) => err_response(err),
            }
        }
    }
}

async fn yt_download(
    State(st): State<Arc<HttpShared>>,
    AxPath(video_id): AxPath<String>,
    Query(q): Query<DownloadQuery>,
    headers: HeaderMap,
) -> Response {
    if !valid_video_id(&video_id) {
        return (StatusCode::BAD_REQUEST, "invalid video id").into_response();
    }
    let title = q.title.clone().unwrap_or_else(|| video_id.clone());
    let safe_title: String = title
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c.is_whitespace() || matches!(c, '.' | '-' | '_') {
                c
            } else {
                '_'
            }
        })
        .collect::<String>()
        .trim()
        .to_string();
    let safe_title = if safe_title.is_empty() {
        video_id.clone()
    } else {
        safe_title
    };

    match st.yt.resolve_stream(&video_id).await {
        Ok(url) => proxy_audio(&url, &headers, Some(&safe_title)).await,
        Err(err) => {
            let query = {
                let cache = st.meta_cache.read();
                cache.get(&video_id).cloned()
            }
            .unwrap_or_else(|| "Michael Jackson Chicago".into());
            match itunes::preview_url_for_query(&query).await {
                Ok(preview) => proxy_audio(&preview, &headers, Some(&safe_title)).await,
                Err(_) => err_response(err),
            }
        }
    }
}

#[derive(Deserialize)]
struct StrictQuery {
    #[serde(default)]
    strict: Option<String>,
}

#[derive(Deserialize)]
struct DownloadQuery {
    #[serde(default)]
    title: Option<String>,
}

fn valid_video_id(id: &str) -> bool {
    id.len() == 11 && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

async fn fetch_oembed_title(video_id: &str) -> Option<String> {
    let url = format!(
        "https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
    );
    let resp = reqwest::get(url).await.ok()?;
    let data: Value = resp.json().await.ok()?;
    let title = data["title"].as_str()?;
    let cleaned = regex_strip(title);
    if cleaned.is_empty() {
        None
    } else {
        Some(cleaned)
    }
}

fn regex_strip(title: &str) -> String {
    // Strip bracketed segments and common noise words without a regex crate.
    let mut out = String::new();
    let mut depth = 0i32;
    for c in title.chars() {
        match c {
            '(' | '[' | '{' => depth += 1,
            ')' | ']' | '}' => depth = (depth - 1).max(0),
            _ if depth == 0 => out.push(c),
            _ => {}
        }
    }
    let lower = out.to_lowercase();
    let noise = ["official", "video", "audio", "lyrics", "hd", "4k"];
    let mut result = out;
    for n in noise {
        // remove whole-word noise (simple)
        let parts: Vec<&str> = result.split_whitespace().collect();
        result = parts
            .into_iter()
            .filter(|w| w.to_lowercase() != n)
            .collect::<Vec<_>>()
            .join(" ");
    }
    let _ = lower;
    result.trim().to_string()
}

async fn proxy_audio(url: &str, headers: &HeaderMap, download_name: Option<&str>) -> Response {
    let client = reqwest::Client::new();
    let mut req = client.get(url);
    if let Some(range) = headers.get(header::RANGE) {
        if let Ok(v) = range.to_str() {
            req = req.header(header::RANGE, v);
        }
    }
    let resp = match req.send().await {
        Ok(r) => r,
        Err(e) => return err_response(AppError::network(e)),
    };

    let status =
        StatusCode::from_u16(resp.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
    let mut builder = Response::builder().status(status);
    if let Some(h) = builder.headers_mut() {
        if let Some(ct) = resp.headers().get(reqwest::header::CONTENT_TYPE) {
            if let Ok(v) = HeaderValue::from_bytes(ct.as_bytes()) {
                h.insert(header::CONTENT_TYPE, v);
            }
        }
        if let Some(cl) = resp.headers().get(reqwest::header::CONTENT_LENGTH) {
            if let Ok(v) = HeaderValue::from_bytes(cl.as_bytes()) {
                h.insert(header::CONTENT_LENGTH, v);
            }
        }
        if let Some(cr) = resp.headers().get(reqwest::header::CONTENT_RANGE) {
            if let Ok(v) = HeaderValue::from_bytes(cr.as_bytes()) {
                h.insert(header::CONTENT_RANGE, v);
            }
        }
        h.insert(header::ACCEPT_RANGES, HeaderValue::from_static("bytes"));
        if let Some(name) = download_name {
            let disp = format!("attachment; filename=\"{name}.mp3\"");
            if let Ok(v) = HeaderValue::from_str(&disp) {
                h.insert(header::CONTENT_DISPOSITION, v);
            }
        }
    }

    let stream = resp.bytes_stream();
    builder
        .body(Body::from_stream(stream))
        .unwrap_or_else(|_| err_response(AppError::Stream("proxy body failed".into())))
}

// ---------- media (local library) ----------

async fn media_audio(State(st): State<Arc<HttpShared>>, AxPath(id): AxPath<String>, headers: HeaderMap) -> Response {
    let path = match FileService::audio_path(&st.core.storage, &id) {
        Ok(p) => p,
        Err(e) => return err_response(e),
    };
    serve_path_with_range(path, &headers, None).await
}

async fn media_cover(State(st): State<Arc<HttpShared>>, AxPath(id): AxPath<String>) -> Response {
    let path = match FileService::cover_path(&st.core.storage, &id) {
        Ok(p) => p,
        Err(e) => return err_response(e),
    };
    serve_path_simple(path).await
}

async fn media_playlist_cover(State(st): State<Arc<HttpShared>>, AxPath(id): AxPath<String>) -> Response {
    let path = match FileService::playlist_cover_path(&st.core.storage, &id) {
        Ok(p) => p,
        Err(e) => return err_response(e),
    };
    serve_path_simple(path).await
}

async fn serve_path_simple(path: std::path::PathBuf) -> Response {
    let bytes = match tokio::fs::read(&path).await {
        Ok(b) => b,
        Err(e) => return err_response(AppError::io(e)),
    };
    let mime = mime_guess::from_path(&path)
        .first_or_octet_stream()
        .essence_str()
        .to_string();
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, mime)
        .body(Body::from(bytes))
        .unwrap_or_else(|_| err_response(AppError::Internal("response build".into())))
}

async fn serve_path_with_range(
    path: std::path::PathBuf,
    headers: &HeaderMap,
    _download: Option<&str>,
) -> Response {
    let meta = match tokio::fs::metadata(&path).await {
        Ok(m) => m,
        Err(e) => return err_response(AppError::io(e)),
    };
    let file_size = meta.len();
    let mime = mime_guess::from_path(&path)
        .first_or_octet_stream()
        .essence_str()
        .to_string();

    let range_header = headers
        .get(header::RANGE)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    if let Some(range) = range_header {
        if let Some((start, end)) = parse_range(&range, file_size) {
            let length = end - start + 1;
            match tokio::fs::File::open(&path).await {
                Ok(file) => {
                    use tokio::io::{AsyncReadExt, AsyncSeekExt};
                    let mut file = file;
                    let _ = file.seek(std::io::SeekFrom::Start(start)).await;
                    let mut buf = vec![0u8; length as usize];
                    if file.read_exact(&mut buf).await.is_err() {
                        return err_response(AppError::Io("range read failed".into()));
                    }
                    return Response::builder()
                        .status(StatusCode::PARTIAL_CONTENT)
                        .header(header::CONTENT_TYPE, mime)
                        .header(header::ACCEPT_RANGES, "bytes")
                        .header(
                            header::CONTENT_RANGE,
                            format!("bytes {start}-{end}/{file_size}"),
                        )
                        .header(header::CONTENT_LENGTH, length.to_string())
                        .body(Body::from(buf))
                        .unwrap_or_else(|_| err_response(AppError::Internal("range response".into())));
                }
                Err(e) => return err_response(AppError::io(e)),
            }
        }
    }

    match tokio::fs::File::open(&path).await {
        Ok(file) => {
            let stream = ReaderStream::new(file);
            Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, mime)
                .header(header::ACCEPT_RANGES, "bytes")
                .header(header::CONTENT_LENGTH, file_size.to_string())
                .body(Body::from_stream(stream))
                .unwrap_or_else(|_| err_response(AppError::Internal("stream response".into())))
        }
        Err(e) => err_response(AppError::io(e)),
    }
}

fn parse_range(header: &str, file_size: u64) -> Option<(u64, u64)> {
    let header = header.trim();
    let rest = header.strip_prefix("bytes=")?;
    let mut parts = rest.splitn(2, '-');
    let start_s = parts.next()?.trim();
    let end_s = parts.next()?.trim();
    if start_s.is_empty() {
        // suffix range: -N
        let n: u64 = end_s.parse().ok()?;
        if n == 0 {
            return None;
        }
        let start = file_size.saturating_sub(n);
        return Some((start, file_size.saturating_sub(1)));
    }
    let start: u64 = start_s.parse().ok()?;
    let end: u64 = if end_s.is_empty() {
        file_size.saturating_sub(1)
    } else {
        end_s.parse().ok()?
    };
    if start > end || start >= file_size {
        return None;
    }
    Some((start, end.min(file_size - 1)))
}
