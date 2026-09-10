const fs = require('fs');

const files = [
  'server/yt-core/render.js',
  'server/yt-core/audio.js',
  'server/yt-core/net.js',
  'server/yt-core/app.js',
  'server/yt-core/providers/chain.js',
  'server/yt-core/providers/innertube.js',
  'server/yt-core/providers/invidious.js',
  'server/yt-core/providers/ytdlp.js',
  'server/yt-core/providers/index.js'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/\\\$\{/g, '${');
  content = content.replace(/\\\`/g, '`');
  content = content.replace(/\\\\/g, '\\');
  fs.writeFileSync(file, content);
}
console.log('Fixed');
