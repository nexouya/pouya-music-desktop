const fs = require('fs');
let file = 'server/yt-core/providers/ytdlp.js';
let content = fs.readFileSync(file, 'utf8');
content = content.replace("'-f', 'bestaudio[ext=m4a]/bestaudio/best',", "'-f', 'bestaudio[ext=m4a]/bestaudio/best',\n      '--extractor-args', 'youtube:player_client=default,ios',");
fs.writeFileSync(file, content);
