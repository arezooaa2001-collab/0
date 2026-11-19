// Renders the «AMIR ABC» intro music (src/brand/introMusicScore.ts) to an MP3 the app plays.
//   NODE_PATH=$(npm root -g) node scripts/make-music.cjs
// The score is Web Audio code; it is rendered offline in Chromium (Playwright), with the same
// gentle limiter the app would use, then encoded with ffmpeg. Writes:
//   src/brand/intro-music.mp3  (bundled into the app)
//   docs/intro-music.mp3       (to listen to)
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const ts = require('typescript');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'src/brand/introMusicScore.ts'), 'utf8');
let js = ts.transpileModule(src, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ES2020 } }).outputText;
js = `(() => {${js.replace(/^export /gm, '')}\nwindow.IntroMusic = { scheduleIntroMusic, MUSIC_LENGTH, DROP_AT };})();`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.addScriptTag({ content: js });
  const res = await page.evaluate(async () => {
    const sr = 44100;
    const len = Math.ceil(sr * (IntroMusic.MUSIC_LENGTH + 0.2));
    const ctx = new OfflineAudioContext(2, len, sr);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.knee.value = 8;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    const master = ctx.createGain();
    master.gain.value = 0.85;
    comp.connect(master).connect(ctx.destination);
    IntroMusic.scheduleIntroMusic(ctx, comp, 0);
    const buf = await ctx.startRendering();
    const L = buf.getChannelData(0);
    const R = buf.getChannelData(1);
    let peak = 0;
    const pcm = new Int16Array(len * 2);
    for (let i = 0; i < len; i++) {
      peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
      pcm[2 * i] = Math.max(-1, Math.min(1, L[i])) * 32767;
      pcm[2 * i + 1] = Math.max(-1, Math.min(1, R[i])) * 32767;
    }
    let bin = '';
    const u8 = new Uint8Array(pcm.buffer);
    for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode(...u8.subarray(i, i + 0x8000));
    return { b64: btoa(bin), sr, peak, drop: IntroMusic.DROP_AT };
  });
  await browser.close();
  if (res.peak >= 0.999) throw new Error(`the mix clips (peak ${res.peak})`);

  const data = Buffer.from(res.b64, 'base64');
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(2, 22);
  h.writeUInt32LE(res.sr, 24);
  h.writeUInt32LE(res.sr * 4, 28);
  h.writeUInt16LE(4, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(data.length, 40);
  const wav = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'amir-music-')), 'intro.wav');
  fs.writeFileSync(wav, Buffer.concat([h, data]));
  const out = path.join(root, 'src/brand/intro-music.mp3');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', '128k', '-metadata', 'title=AMIR ABC intro', '-metadata', 'artist=AMIR ABC', out]);
  fs.copyFileSync(out, path.join(root, 'docs/intro-music.mp3'));
  console.log(`→ src/brand/intro-music.mp3 (${Math.round(fs.statSync(out).size / 1024)} KB, peak ${(20 * Math.log10(res.peak)).toFixed(1)} dBFS, drop at ${res.drop} s)`);
})();
