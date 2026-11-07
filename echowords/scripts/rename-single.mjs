import { renameSync } from 'node:fs';
renameSync('release/index.html', 'release/echowords.html');
console.log('→ release/echowords.html');
