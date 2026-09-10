const fs = require('fs');
let file = 'server/yt-core/audio.js';
let content = fs.readFileSync(file, 'utf8');

// Replace the error throw in serve() with a TTS fallback
content = content.replace(
  "if (!canFallBack) throw new Error('yt-dlp is not available for fallback');",
  "if (!canFallBack) {\n        // FALLBACK TO TTS MESSAGE SO AUDIO ELEMENT DOESNT CRASH\n        const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=YouTube%20has%20blocked%20the%20streaming%20IP.%20Please%20try%20an%20iTunes%20track.&tl=en&client=tw-ob`;\n        res.redirect(302, ttsUrl);\n        return;\n      }"
);

content = content.replace(
  "return serveFromDisk(req, res, videoId);",
  "try { return await serveFromDisk(req, res, videoId); } catch(err) {\n        const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=YouTube%20anti%20bot%20system%20has%20blocked%20the%20streaming%20server.%20Please%20try%20an%20iTunes%20track.&tl=en&client=tw-ob`;\n        res.redirect(302, ttsUrl);\n        return;\n      }"
)

fs.writeFileSync(file, content);
