const fs = require('fs');
let file = 'server/yt-core/audio.js';
let content = fs.readFileSync(file, 'utf8');

const replacement = `
      try {
        const ttsUrl = \`https://translate.google.com/translate_tts?ie=UTF-8&q=YouTube%20anti%20bot%20system%20has%20blocked%20the%20streaming%20server.%20Please%20try%20an%20iTunes%20track.&tl=en&client=tw-ob\`;
        const ttsRes = await fetchImpl(ttsUrl);
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Accept-Ranges', 'none'); // tell browser we dont support ranges for this
        if (ttsRes.body) {
           const { Readable } = require('node:stream');
           const stream = Readable.fromWeb(ttsRes.body);
           stream.pipe(res);
        } else {
           res.end();
        }
      } catch (ttsErr) {
        res.status(502).end();
      }
      return;
`;

content = content.replace(
  "try { return await serveFromDisk(req, res, videoId); } catch(err) {\n        const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=YouTube%20anti%20bot%20system%20has%20blocked%20the%20streaming%20server.%20Please%20try%20an%20iTunes%20track.&tl=en&client=tw-ob`;\n        res.redirect(302, ttsUrl);\n        return;\n      }",
  "try { return await serveFromDisk(req, res, videoId); } catch(err) {" + replacement + "}"
);

content = content.replace(
  "if (!canFallBack) {\n        // FALLBACK TO TTS MESSAGE SO AUDIO ELEMENT DOESNT CRASH\n        const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=YouTube%20has%20blocked%20the%20streaming%20IP.%20Please%20try%20an%20iTunes%20track.&tl=en&client=tw-ob`;\n        res.redirect(302, ttsUrl);\n        return;\n      }",
  "if (!canFallBack) {" + replacement + "}"
);

fs.writeFileSync(file, content);
