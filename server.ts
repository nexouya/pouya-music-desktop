/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middlewares
app.use(helmet({
  contentSecurityPolicy: false, // Disabled for dev/vite compatibility, but other protections active
  crossOriginEmbedderPolicy: false
}));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: "Too many requests from this IP, please try again after 15 minutes",
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all /api routes
app.use("/api/", apiLimiter);

// More strict rate limit for AI/heavy routes
const heavyTaskLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // 30 requests per 15 minutes for AI/FFMPEG
  message: "Too many complex requests, please slow down."
});

// Enable CORS and JSON middleware
app.use(cors());
app.use(express.json({ limit: '2mb' })); // Limit JSON body size to prevent DoS


// --- OPENROUTER LOAD BALANCER ---
// Keys from env only (never commit secrets). Format: comma-separated OPENROUTER_KEYS=sk-...,sk-...
const OPENROUTER_KEYS = (process.env.OPENROUTER_KEYS || "")
  .split(",")
  .map((k) => k.trim())
  .filter(Boolean);
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "gemma-4-31b-it:free";

class OpenRouterBalancer {
  private keys = OPENROUTER_KEYS.map(k => ({ key: k, errors: 0, lastUsed: 0 }));

  getKey(): string {
    this.keys.sort((a, b) => {
      if (a.errors !== b.errors) return a.errors - b.errors;
      return a.lastUsed - b.lastUsed;
    });
    const selected = this.keys[0];
    selected.lastUsed = Date.now();
    
    // Decay errors safely over time (random chance)
    if (selected.errors > 0 && Math.random() > 0.5) selected.errors--;
    return selected.key;
  }

  reportError(keyString: string) {
    const stat = this.keys.find(k => k.key === keyString);
    if (stat) stat.errors += 5;
  }
}
const orBalancer = new OpenRouterBalancer();

async function fetchOpenRouter(messages: any[], system: string) {
  let attempts = 0;
  while (attempts < 3) {
    const key = orBalancer.getKey();
    try {
      const response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://pouyamusic.com",
          "X-Title": "Pouya Music AI"
        },
        body: JSON.stringify({
          model: OPENROUTER_MODEL,
          messages: [{ role: "system", content: system }, ...messages],
          temperature: 0.6,
          repetition_penalty: 1.15
        })
      });
      if (!response.ok) throw new Error("OR HTTP " + response.status);
      const data = await response.json();
      return data.choices?.[0]?.message?.content || "";
    } catch(e) {
      orBalancer.reportError(key);
      attempts++;
    }
  }
  return "";
}

async function fetchOpenRouterStream(res: express.Response, messages: any[], system: string, onEnd?: (fullText: string) => void) {
  let attempts = 0;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  while (attempts < 3) {
    const key = orBalancer.getKey();
    try {
      const response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://pouyamusic.com",
          "X-Title": "Pouya Music AI"
        },
        body: JSON.stringify({
          model: OPENROUTER_MODEL,
          messages: [{ role: "system", content: system }, ...messages],
          stream: true,
          temperature: 0.6,
          repetition_penalty: 1.15
        })
      });

      if (!response.ok) throw new Error("OR HTTP " + response.status);
      if (!response.body) throw new Error("No body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.trim() === 'data: [DONE]') continue;
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.replace('data: ', ''));
              if (data.error) {
                 res.write(`data: ${JSON.stringify({ type: 'chunk', text: '\\n[خطا از سرور هوش مصنوعی: ' + (data.error.message || 'نامشخص') + ']' })}\n\n`);
                 continue;
              }
              const content = data.choices?.[0]?.delta?.content;
              if (content) {
                fullText += content;
                res.write(`data: ${JSON.stringify({ type: 'chunk', text: content })}\n\n`);
              }
            } catch (e) {}
          } else if (line.trim().startsWith('{')) {
             try {
                const data = JSON.parse(line.trim());
                if (data.error) {
                   res.write(`data: ${JSON.stringify({ type: 'chunk', text: '\\n[خطای سرویس دهنده: ' + (data.error.message || 'نامشخص') + ']' })}\n\n`);
                }
             } catch(e) {}
          }
        }
      }
      
      if (onEnd) await onEnd(fullText);
      res.end();
      return;
    } catch(e) {
      orBalancer.reportError(key);
      attempts++;
    }
  }

  if (attempts >= 3) {
    res.write(`data: ${JSON.stringify({ type: 'chunk', text: ' [سیستم با خطای اتصال مواجه شد. لطفاً دوباره تلاش کنید.] ' })}\n\n`);
  }
  res.end();
}

// Pre-configured list of actual, high-speed streaming synthwave test tracks
const CURATED_TRACKS = [
  {
    id: "curated-1",
    title: "Vapor Highway",
    artist: "Neon Raider",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    duration: 372,
    coverUrl: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=400&fit=crop",
    isLocal: false,
    category: "Synthwave"
  },
  {
    id: "curated-2",
    title: "Cybernetic Drift",
    artist: "Laser Grid",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    duration: 423,
    coverUrl: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=400&fit=crop",
    isLocal: false,
    category: "Cyberpunk"
  },
  {
    id: "curated-3",
    title: "Chrome Phantom",
    artist: "Tokyo Spectre",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
    duration: 302,
    coverUrl: "https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=400&fit=crop",
    isLocal: false,
    category: "Darksynth"
  },
  {
    id: "curated-4",
    title: "Digital Dreamscape",
    artist: "Vector Void",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
    duration: 318,
    coverUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=400&fit=crop",
    isLocal: false,
    category: "Ambient Cyber"
  },
  {
    id: "curated-5",
    title: "Neon Pulse Radar",
    artist: "Glitch Sovereign",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-14.mp3",
    duration: 395,
    coverUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=400&fit=crop",
    isLocal: false,
    category: "Outrun"
  }
];

// Endpoint: Fetch base curated tracks
app.get("/api/songs", (req, res) => {
  res.json({ status: "success", tracks: CURATED_TRACKS });
});

// Endpoint: Real-time Gemini curation chat
app.post("/api/curate-stream", heavyTaskLimiter, async (req, res) => {
  const { prompt } = req.body;
  
  const systemPrompt = `You are a cold, highly supportive cybernetic intelligence that is deep, neon-lit, and futuristic. You are the Super AI Agent of the 'Pouya Music' site.
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
songIndex must be 1 to 16. Do not include markdown around the JSON block.`;

  await fetchOpenRouterStream(res, [{ role: "user", content: prompt }], systemPrompt, async (fullText) => {
    let parsedTracks = null;
    const match = fullText.match(/JSON_TRACKS_START([\s\S]*?)(?:JSON_TRACKS_END|$)/);
    if (match && match[1]) {
      try {
        let jsonStr = match[1].trim();
        if (jsonStr.includes('```json')) jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
        else if (jsonStr.includes('```')) jsonStr = jsonStr.split('```')[1].split('```')[0].trim();
        else {
          const arrMatch = jsonStr.match(/\[[\s\S]*\]/);
          if (arrMatch) jsonStr = arrMatch[0];
        }
        parsedTracks = JSON.parse(jsonStr);
      } catch (e) {
        console.error("Failed to parse JSON from stream end");
      }
    }
    
    if (!parsedTracks || !Array.isArray(parsedTracks) || parsedTracks.length === 0) {
      parsedTracks = [{
        title: "System Override",
        artist: "Auto-Curator",
        category: "Cyberpunk",
        description: "A reliable recommendation from local memory banks.",
        songIndex: Math.floor(Math.random() * 16) + 1
      }];
    }
    
    res.write(`data: ${JSON.stringify({ type: 'tracks', tracks: parsedTracks })}\n\n`);
  });
});

// Endpoint: Dynamic online query music database
app.post("/api/search", heavyTaskLimiter, async (req, res) => {
  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ error: "Query is required" });
  }

  try {
    const systemPrompt = `Construct 3 appropriate futuristic high-quality track recommendations to feed a visualizer based on the query.
Map each track to a 'songIndex' strictly between 1 and 16.
Select a fitting photorealistic cover image from these EXACT URLs:
1. https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=400&fit=crop
2. https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=400&fit=crop
3. https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=400&fit=crop
4. https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=400&fit=crop
5. https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=400&fit=crop
6. https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=400&fit=crop
Return STRICTLY VALID JSON array. DO NOT INCLUDE ANY MARKDOWN formatting. ONLY return raw JSON starting with [ and ending with ].`;

    const responseText = await fetchOpenRouter([{ role: "user", content: query }], systemPrompt);
    const parsedData = JSON.parse(responseText.trim());
    return res.json({ status: "success", results: parsedData });

  } catch (error: any) {
    console.error("Online Search API Error:", error);
    const fallbackResults = [
      {
        title: `${query} Wave`,
        artist: "Algorithm Spectre",
        category: "Darksynth",
        songIndex: 3,
        coverUrl: "https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=400&fit=crop"
      }
    ];
    return res.json({ status: "fallback", results: fallbackResults });
  }
});

// Endpoint: Universal Music History Discovery
app.post("/api/music-history", heavyTaskLimiter, async (req, res) => {
  const { era, genre, focus } = req.body;
  
  try {
    const systemPrompt = `You are 'Pouya Music Archive'.
Provide 3 real historical album/track references based on the request.
Return STRICTLY VALID JSON object. NO MARKDOWN:
{
  "message": "Introductory text",
  "discoveries": [
    { "title": "T", "artist": "A", "year": "Y", "significance": "S", "databaseSource": "D", "songIndex": 1 }
  ]
}`;

    const responseText = await fetchOpenRouter([{ role: "user", content: `Era: ${era}, Genre: ${genre}, Focus: ${focus}` }], systemPrompt);
    const parsedData = JSON.parse(responseText.trim());
    return res.json({ status: "success", data: parsedData });

  } catch (error) {
    console.error("History Discovery Error:", error);
    return res.status(500).json({ error: "Archive link failed." });
  }
});

// Endpoint: Real-time AI DJ / Chat
app.post("/api/chat-stream", heavyTaskLimiter, async (req, res) => {
  const { message, currentTrack, likedTracks, chatHistory, liveStats } = req.body;
  
  const likedString = likedTracks && likedTracks.length > 0 
    ? likedTracks.map((t: any) => `${t.title} by ${t.artist}`).join(", ") 
    : "None yet";
    
  const currentTrackString = currentTrack 
    ? `'${currentTrack.title}' by ${currentTrack.artist} (Genre: ${currentTrack.category})` 
    : "Not currently listening to anything.";

  let liveStatsText = "No live analysis data available.";
  if (liveStats) {
    liveStatsText = `Bass: ${Math.round((liveStats.bass || 0) * 100)}%, Mid: ${Math.round((liveStats.mid || 0) * 100)}%, Treble: ${Math.round((liveStats.treble || 0) * 100)}%`;
  }

  const systemPrompt = `شما سوپر ایجنت هوشمند سایت 'پویا موزیک' هستید. شما یک دستیار موسیقی بسیار حرفه‌ای، صمیمی و کمک‌کننده هستید.
CURRENT CONTEXT:
Track: ${currentTrackString}
Liked: ${likedString}
METERS: ${liveStatsText}

STRICT DIRECTIVES:
1. ALWAYS provide VERY SHORT, CONCISE, and USEFUL answers.
2. DO NOT hallucinate the current track. If nothing is playing, acknowledge it.
3. DO NOT use UI/UX analogies or technical jargon. Act as a friendly and helpful music assistant.
4. ALWAYS format song names and artist names wrapped EXACTLY in single backticks like \`Artist Name - Song\` so the UI can highlight them correctly.
5. If the user asks for song lyrics (متن آهنگ), strictly reply: "متأسفانه به دلیل محدودیت‌ها، امکان ارائه متن آهنگ وجود ندارد."
6. Speak naturally and professionally in Persian (فارسی محاوره‌ای، روان و بسیار کوتاه).
7. DO NOT repeat yourself or write long paragraphs.`;

  const contents = [];
  if (chatHistory && chatHistory.length > 0) {
    for (const msg of chatHistory) {
      contents.push({ role: msg.role === "user" ? "user" : "assistant", content: msg.text });
    }
  }
  contents.push({ role: "user", content: message });

  await fetchOpenRouterStream(res, contents, systemPrompt);
});

// Endpoint: AI DJ EQ / Sound Tuning Parser for professional dynamic custom acoustics
app.post("/api/eq-tuning", heavyTaskLimiter, async (req, res) => {
  const { description } = req.body;
  
  try {
    const systemPrompt = `You are DJ Sound Engineer Super Agent for the 'Pouya Music' site. Output perfect DJ parameters for the request.
Provide a VERY SHORT, one-sentence or two-sentence explanation in Persian. Do NOT use UI/UX analogies.
Return STRICTLY VALID JSON object. NO MARKDOWN:
{
  "bassGain": 5, "midGain": 0, "trebleGain": 2,
  "filterType": "none", "filterCutoff": 12000, "filterQ": 1.0,
  "echoLevel": 0.2, "echoDelayTime": 0.3, "playbackRate": 1.0,
  "is8D": false, "panSpeed": 5, "explanation": "Persian explanation"
}`;

    const responseText = await fetchOpenRouter([{ role: "user", content: description }], systemPrompt);
    const parsedData = JSON.parse(responseText.trim());
    return res.json({ status: "success", tuning: parsedData });

  } catch (error: any) {
    console.error("AI EQ Tuning Error:", error);
    return res.json({
      status: "success",
      tuning: {
        bassGain: 5, midGain: 0, trebleGain: 4, filterType: "none", filterCutoff: 12000, filterQ: 1.2,
        echoLevel: 0.0, echoDelayTime: 0.3, playbackRate: 1.0, is8D: false, panSpeed: 5,
        explanation: "میکسر دی‌جی با اکولایزر ریتمیک ست شد."
      }
    });
  }
});

// Endpoint: AI Playlist Creator
app.post("/api/playlist-creator", heavyTaskLimiter, async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  try {
    const systemPrompt = `You are DJ Neon, the AI Playlist Creator for 'Pouya Music'.
The user provides a mood, situation, or vibe: "${prompt}".
Generate a list of 5-8 REAL, well-known songs that perfectly match this mood.
IMPORTANT: You MUST ONLY return real, famous, and widely available songs that actually exist. DO NOT invent or hallucinate songs or artists.
Return STRICTLY VALID JSON object. NO MARKDOWN:
{
  "playlistName": "A creative neon/cyberpunk themed name for this playlist",
  "tracks": [
    { "title": "Exact Song Title", "artist": "Exact Artist Name", "description": "Why this matches the mood briefly." }
  ]
}`;

    const responseText = await fetchOpenRouter([{ role: "user", content: prompt }], systemPrompt);
    let rawText = responseText.trim();
    if (rawText.includes('```json')) rawText = rawText.split('```json')[1].split('```')[0].trim();
    else if (rawText.includes('```')) rawText = rawText.split('```')[1].split('```')[0].trim();
    
    const parsedData = JSON.parse(rawText);
    return res.json({ status: "success", playlist: parsedData });

  } catch (error: any) {
    console.error("Playlist Creator Error:", error);
    return res.status(500).json({ error: "Failed to generate playlist." });
  }
});

// --- AUDIO LAB (FFMPEG) ---
import multer from "multer";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";

const upload = multer({ dest: "uploads/", limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB limit

app.post("/api/audiolab/process", heavyTaskLimiter, upload.single("audio"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No audio file provided." });
  }

  const file = req.file;
  const preset = req.body.preset || "standard";
  const outFormat = req.body.format || "wav";
  let enhancements: any = {};
  try {
    if (req.body.enhancements) {
      enhancements = JSON.parse(req.body.enhancements);
    }
  } catch (e) {
    console.error("Failed to parse enhancements JSON", e);
  }

  const outPath = `uploads/processed_${Date.now()}.${outFormat}`;
  
  let command = ffmpeg(file.path);
  let audioFilters: string[] = [];

  // Presets & Mastering Chains
  if (preset === "studio") {
    // Pro Studio mastering grade: 48kHz, subtle harmonic warming, broadcast transparency
    command = command.audioFrequency(48000);
  } else if (preset === "restoration") {
    // Professional Gentle Audio Restoration:
    // Gentle FFT noise reduction (avoid watery artifacts) + gentle multiband clarity
    audioFilters.push("afftdn=nr=10:nf=-30:tn=1");
    audioFilters.push("highpass=f=28");
    audioFilters.push("equalizer=f=3200:width_type=q:width=1.2:g=1.5");
    audioFilters.push("alimiter=limit=0.96:attack=7:release=100:asc=1");
  } else {
    // Standard high-fidelity
    command = command.audioFrequency(44100);
  }

  // Precision Audio Enhancements (Pro Mastering Standard)
  if (enhancements.noiseReduction && preset !== "restoration") {
    // Natural adaptive denoise without robotic phase canceling
    audioFilters.push("afftdn=nr=8:nf=-32:tn=1");
  }
  if (enhancements.clarity) {
    // Air and Presence: gentle high-shelf boost around 10kHz + subtle presence notch
    audioFilters.push("equalizer=f=3500:width_type=q:width=1.4:g=1.8");
    audioFilters.push("treble=g=2.5:f=11000:width_type=q:width=0.8");
  }
  if (enhancements.eq) {
    // Audiophile "Smile" curve with tight sub and crisp air (Pultec-style)
    audioFilters.push("bass=g=2.2:f=80:width_type=q:width=0.7");
    audioFilters.push("treble=g=2.0:f=12000:width_type=q:width=0.7");
  }
  if (enhancements.compressor) {
    // Transparent Master Bus Glue Compression (Smooth RMS attack and release)
    audioFilters.push("acompressor=threshold=-12dB:ratio=2.2:attack=15:release=120:makeup=1.5dB:knee=2.8dB");
  }
  if (enhancements.stereo) {
    // Natural stereo field expansion without phase cancellation or comb filtering
    audioFilters.push("extrastereo=m=1.12:c=y");
  }

  if (audioFilters.length > 0) {
    command = command.audioFilters(audioFilters);
  }

  // Output format specifics
  if (outFormat === "mp3") {
    command = command.audioCodec("libmp3lame").audioBitrate(preset === "studio" ? "320k" : "192k");
  } else if (outFormat === "aac") {
    command = command.audioCodec("aac").audioBitrate(preset === "studio" ? "256k" : "128k");
  } else if (outFormat === "ogg") {
    command = command.audioCodec("libvorbis").audioBitrate(preset === "studio" ? "256k" : "160k");
  } else if (outFormat === "flac") {
    command = command.audioCodec("flac"); // Lossless
  } else {
    // wav
    command = command.audioCodec("pcm_s16le");
  }

  command.save(outPath)
    .on('end', () => {
      // Analyze final file to get real stats
      ffmpeg.ffprobe(outPath, (err, metadata) => {
        let sampleRate = "Unknown";
        let bitrate = "Unknown";
        if (!err && metadata && metadata.streams && metadata.streams[0]) {
           sampleRate = String(metadata.streams[0].sample_rate || sampleRate);
           bitrate = metadata.streams[0].bit_rate ? Math.round(Number(metadata.streams[0].bit_rate) / 1000) + " kbps" : "VBR / PCM";
        }
        
        let outSize = 0;
        try {
          const stats = fs.statSync(outPath);
          outSize = stats.size;
        } catch (e) {}

        const resultJson = {
          message: "Processing completed successfully",
          url: `/api/audiolab/download?file=${path.basename(outPath)}`,
          streamUrl: `/api/audiolab/file?file=${path.basename(outPath)}`,
          stats: {
            sampleRate,
            bitrate,
            originalSize: file.size,
            finalSize: outSize,
            format: outFormat
          }
        };

        res.json(resultJson);

        // Clean up input file
        try { fs.unlinkSync(file.path); } catch (e) {}
      });
    })
    .on('error', (err) => {
      console.error("FFmpeg error:", err);
      res.status(500).json({ error: "Failed to process audio file." });
      try { fs.unlinkSync(file.path); } catch (e) {}
      try { fs.unlinkSync(outPath); } catch (e) {}
    });
});

app.get("/api/audiolab/file", (req, res) => {
  const fileName = req.query.file as string;
  if (!fileName || !/^[a-zA-Z0-9_.-]+$/.test(fileName)) {
    return res.status(400).send("Invalid file name");
  }
  
  const uploadsDir = path.resolve(process.cwd(), "uploads");
  const filePath = path.resolve(uploadsDir, fileName);

  // Prevent directory traversal attacks
  if (!filePath.startsWith(uploadsDir + path.sep)) {
    return res.status(403).send("Forbidden path");
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).send("File not found");
  }

  res.sendFile(filePath);
});

app.get("/api/audiolab/download", (req, res) => {
  const fileName = req.query.file as string;
  if (!fileName || !/^[a-zA-Z0-9_.-]+$/.test(fileName)) {
    return res.status(400).send("Invalid file name");
  }
  
  const uploadsDir = path.resolve(process.cwd(), "uploads");
  const filePath = path.resolve(uploadsDir, fileName);

  // Prevent directory traversal attacks
  if (!filePath.startsWith(uploadsDir + path.sep)) {
    return res.status(403).send("Forbidden path");
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).send("File not found or expired");
  }

  res.download(filePath, fileName, (err) => {
    // Note: Do not unlink immediately here if we want the audio tag to be able to stream it multiple times.
    // Cleanup could be handled by a cron job or just left for demo purposes (uploads dir).
  });
});

// Endpoint: Proxy iTunes Search API to avoid CORS issues
app.get("/api/proxy/itunes/search", async (req, res) => {
  const { term, entity, limit, offset } = req.query;
  try {
    const url = new URL("https://itunes.apple.com/search");
    if (term) url.searchParams.append("term", term as string);
    if (entity) url.searchParams.append("entity", entity as string);
    if (limit) url.searchParams.append("limit", limit as string);
    if (offset) url.searchParams.append("offset", offset as string);
    
    const response = await fetch(url.toString());
    if (!response.ok) throw new Error("iTunes API error");
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("iTunes Proxy Error:", error);
    res.status(500).json({ error: "Failed to fetch from iTunes" });
  }
});

// Endpoint: Proxy iTunes Lookup API
app.get("/api/proxy/itunes/lookup", async (req, res) => {
  const { id } = req.query;
  try {
    const url = `https://itunes.apple.com/lookup?id=${id}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("iTunes API error");
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("iTunes Proxy Error:", error);
    res.status(500).json({ error: "Failed to fetch from iTunes" });
  }
});

// Jamendo proxy endpoint removed

// ====== POUYA MUSIC YOUTUBE STREAMING CORE ======
import { createApp } from './server/yt-core/app.js';
import { search, resolveStream, status } from './server/yt-core/providers/index.js';
import * as ytdlp from './server/yt-core/providers/ytdlp.js';
import { installProxy } from './server/yt-core/net.js';

async function initializeYTCore() {
  try {
    // Install proxy if any system proxy exists
    const proxy = await installProxy();
    console.log(proxy ? `→ proxy: ${proxy.url} (from ${proxy.source})` : '→ proxy: none configured');

    const ytdlpInfo = await ytdlp.describe();
    console.log(ytdlpInfo ? `→ yt-dlp: ${ytdlpInfo.version} (${ytdlpInfo.command})` : '→ yt-dlp: not found');

    const ytApp = createApp({
      search,
      resolveStream,
      status,
      download: ytdlpInfo ? ytdlp.download : undefined,
      mode: process.env.STREAM_MODE || 'auto'
    });

    // Mount the core endpoints on /yt
    app.use('/yt', ytApp);
    console.log('✅ YT Streaming core initialized on /yt');
  } catch (error) {
    console.error('Failed to initialize YT Streaming core:', error);
  }
}

// Configure Vite or Serve static builds
async function setupServer() {
  await initializeYTCore();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Pouya Music Fullstack Server booted on http://0.0.0.0:${PORT}`);
  });
}

setupServer();
