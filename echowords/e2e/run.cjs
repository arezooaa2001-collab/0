// End-to-end test of the single-file app (release/echowords.html) opened straight from disk.
//
// Chromium records from a WAV file through its fake microphone, using the same
// getUserMedia → MediaRecorder path as a phone. Speech recognition runs the real Whisper
// model in the page; because this test machine cannot reach Hugging Face, the library and
// a Whisper model are served from a local folder (ASR_BASE) instead.
//
//   ASR_BASE=http://127.0.0.1:8790 ASR_MODEL=Xenova/whisper-tiny \
//   SPEECH_WAV=speech.wav SILENT_WAV=silent.wav node e2e/run.cjs
const { chromium } = require('playwright');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const FILE = 'file://' + path.resolve(__dirname, '..', 'release', 'echowords.html');
const ASR = process.env.ASR_BASE;
const OUT = process.env.OUT_DIR || path.join(__dirname, '..', 'test-results');
fs.mkdirSync(OUT, { recursive: true });

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

// Every test browser starts as a returning user (the first-launch welcome has its own test).
const launchPersistent = chromium.launchPersistentContext.bind(chromium);
chromium.launchPersistentContext = async (dir, opts = {}) => {
  const { firstLaunch, ...rest } = opts;
  const ctx = await launchPersistent(dir, rest);
  if (!firstLaunch) await ctx.addInitScript(() => { try { localStorage.setItem('echowords-welcomed', '1'); } catch {} });
  return ctx;
};

// A stand-in for the family's Google Drive file (survives "reinstalling" = a brand-new profile).
const driveFile = { name: null, b64: null, writes: 0 };
async function withDriveStub(ctx) {
  await ctx.exposeBinding('__driveSave', (_s, name, b64) => { driveFile.name = name; driveFile.b64 = b64; driveFile.writes++; });
  await ctx.exposeBinding('__driveRead', () => driveFile.b64);
}
const driveWords = () => (driveFile.b64 ? JSON.parse(Buffer.from(driveFile.b64, 'base64').toString('utf8')).words : []);

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'echowords-profile-'));

async function open(wav) {
  const ctx = await chromium.launchPersistentContext(profile, {
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${wav}`, '--allow-file-access-from-files'],
    viewport: { width: 412, height: 860 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
    acceptDownloads: true,
    permissions: ['microphone'],
  });
  await ctx.addInitScript(([base, model]) => {
    window.__ECHOWORDS_ASR__ = {
      libUrl: `${base}/lib/transformers.min.js`,
      model,
      remoteHost: `${base}/models/`,
      remotePathTemplate: '{model}/',
      wasmPaths: `${base}/lib/`,
    };
    // Record what the device would say (headless Chromium has no voices).
    window.__spoken = [];
    const voices = ['en-US', 'en-GB', 'fa-IR', 'fr-FR'].map((lang) => ({ lang, name: lang, voiceURI: lang, default: false, localService: true }));
    speechSynthesis.getVoices = () => voices;
    speechSynthesis.speak = (u) => {
      window.__spoken.push({ text: u.text, lang: u.lang });
      setTimeout(() => u.onend && u.onend(new Event('end')), 50);
    };
    window.__streams = [];
    if (!navigator.mediaDevices) return;
    const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (c) => {
      const s = await orig(c);
      window.__streams.push(s);
      return s;
    };
  }, [ASR, process.env.ASR_MODEL || 'Xenova/whisper-tiny']);
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  page.on('pageerror', (e) => console.log('pageerror:', e.message));
  await page.goto(FILE);
  return { ctx, page };
}

async function record(page, ms) {
  await page.locator('.mic-btn').click();
  await page.getByText('دارم گوش می‌دهم').waitFor({ timeout: 10000 });
  const bars = [];
  for (let waited = 0; waited < ms; waited += 100) {
    await page.waitForTimeout(100);
    bars.push(Math.max(...(await page.$$eval('.meter span', (els) => els.map((e) => parseFloat(e.style.height))))));
  }
  const timer = await page.textContent('.timer');
  await page.getByRole('button', { name: /تمام/ }).click();
  return { bars, timer };
}

const countSaved = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve) => {
        const req = indexedDB.open('echowords-library');
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('words')) return resolve(0);
          const c = db.transaction('words').objectStore('words').count();
          c.onsuccess = () => resolve(c.result);
        };
      }),
  );
const confirmBtn = (page) => page.getByRole('button', { name: /تایید و ذخیره/ });
const reviewInput = (page) => page.locator('.review-input');

const resultCard = (page) => page.locator('.word-card-result .word-text, .word-card-result .state-unclear, .word-card-result .state-failed').first();

(async () => {
  let { ctx, page } = await open(process.env.SPEECH_WAV);
  await page.getByText('یک کلمه یا جمله تازه').waitFor();
  check('opens from a file with no login or setup', true);
  check('version number is shown', /نسخه ۱۹/.test(await page.textContent('.topbar')));
  await page.screenshot({ path: `${OUT}/01-record.png` });

  // 0. Type a word → «تایید و ذخیره» → it is in «کلمه‌ها و جمله‌هایم» (no recording needed)
  await page.locator('.hint-field input').fill('123');
  await page.locator('.save-typed').click();
  check('typed text without letters is refused', await page.getByText('باید حداقل یک حرف بنویسی').isVisible());
  await page.locator('.hint-field input').fill('cat');
  const [firstBackup] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }).catch(() => null), page.locator('.hint-field input').press('Enter')]);
  await page.locator('.saved-card', { hasText: 'cat' }).waitFor({ timeout: 5000 });
  check('typed word «cat» is saved with «تایید و ذخیره» (or Enter)', (await countSaved(page)) === 1);
  check('first save also drops a backup file in Downloads', !!firstBackup, firstBackup?.suggestedFilename());
  await page.waitForTimeout(300);
  check('new word is pronounced once automatically', await page.evaluate(() => window.__spoken.some((x) => x.text === 'cat' && x.lang === 'en-US')));
  await page.screenshot({ path: `${OUT}/00-word-saved.png` });
  await page.locator('.saved-card').getByRole('button', { name: /برو به کلمه‌ها و جمله‌هایم/ }).click();
  await page.locator('.word-card .word-text', { hasText: 'cat' }).waitFor({ timeout: 5000 });
  check('«cat» is shown in «کلمه‌ها و جمله‌هایم»', true);
  const before = await page.evaluate(() => window.__spoken.length);
  await page.locator('.word-card .btn-tts').first().click();
  await page.waitForTimeout(300);
  check('every saved word has a «🔊 تلفظ» button that speaks it', (await page.evaluate(() => window.__spoken.length)) === before + 1);
  await page.screenshot({ path: `${OUT}/00-library-cat.png` });

  // close the app completely and open it again
  await ctx.close();
  ({ ctx, page } = await open(process.env.SPEECH_WAV));
  await page.getByRole('button', { name: /کلمه‌ها و جمله‌هایم/ }).click();
  await page.locator('.word-card .word-text', { hasText: 'cat' }).waitFor({ timeout: 10000 });
  check('«cat» is still there after closing and reopening', true);

  // add my own voice to «cat»
  await page.getByRole('button', { name: /صدای خودم را اضافه کن/ }).click();
  await page.getByText('را با صدای خودت بگو').waitFor({ timeout: 5000 });
  await record(page, 3000);
  await page.getByText('صدایت را گوش بده').waitFor({ timeout: 10000 });
  await page.getByText('دستگاه این را شنید').waitFor({ timeout: 120000 });
  await page.screenshot({ path: `${OUT}/00-voice-review.png` });
  await page.getByRole('button', { name: /تایید و ذخیره صدا/ }).click();
  await page.locator('.word-card-result .word-text', { hasText: 'cat' }).waitFor({ timeout: 10000 });
  check('my voice is added to «cat» (still one word, now with sound)', (await countSaved(page)) === 1 && (await page.locator('.word-card-result .btn-play').isVisible()));
  await page.getByRole('button', { name: /یک کلمه یا جمله تازه/ }).last().click();

  // 1. Record → preview → save → on-device transcription
  const { bars, timer } = await record(page, 3500);
  check('timer counts real elapsed time', /۰:۰[۳۴]/.test(timer), timer);
  check('level meter reacts to captured audio', Math.max(...bars) > 20);
  await page.getByText('درسته؟').waitFor({ timeout: 10000 });
  check('microphone released after stop', await page.evaluate(() => window.__streams.every((s) => s.getTracks().every((t) => t.readyState === 'ended'))));
  await page.getByRole('button', { name: /صدای خودم را گوش بده/ }).click();
  await page.waitForTimeout(300);
  check('preview plays my recording', (await page.getByRole('button', { name: /صدای خودم را گوش بده/ }).getAttribute('aria-pressed')) === 'true');
  check('confirm button is visible and usable right away', (await confirmBtn(page).isVisible()) && (await confirmBtn(page).isEnabled()));
  await page.waitForFunction(() => document.querySelector('.review-input')?.value, null, { timeout: 120000 });
  const heard = await reviewInput(page).inputValue();
  check('speech transcribed on the device, shown for checking', /learning english/i.test(heard), JSON.stringify(heard));
  check('speech recognition runs in a background thread (saving never waits for it)', (await page.evaluate(() => window.__ECHOWORDS_ASR_THREAD__)) === 'worker', await page.evaluate(() => String(window.__ECHOWORDS_ASR_THREAD__)));
  check('nothing is saved before the confirm button', (await countSaved(page)) === 1);
  await page.screenshot({ path: `${OUT}/02-review.png` });
  await confirmBtn(page).click();
  await page.locator('.word-card-result .word-text').waitFor({ timeout: 10000 });
  check('confirm button saves the word', (await countSaved(page)) === 2, await page.locator('.word-card-result .word-text').textContent());
  await page.screenshot({ path: `${OUT}/02-result.png` });

  // 1b. Cancel on the review step discards the take
  await page.getByRole('button', { name: /یک کلمه یا جمله تازه/ }).last().click();
  await record(page, 1500);
  await reviewInput(page).waitFor({ timeout: 120000 });
  await page.getByRole('button', { name: /لغو/ }).click();
  await page.getByRole('button', { name: 'آره، پاکش کن' }).click();
  await page.locator('.mic-btn').waitFor();
  check('cancel throws the take away without saving', (await countSaved(page)) === 2);

  // 3. Silent recording is rejected
  await ctx.close();
  ({ ctx, page } = await open(process.env.SILENT_WAV));
  await record(page, 1500);
  await page.getByText('صدایی نشنیدم').waitFor({ timeout: 10000 });
  check('silent recording is not saved', true);

  // 4. After "closing the app", the library is still there and plays repeatedly
  await page.getByRole('button', { name: /کلمه‌ها و جمله‌هایم/ }).click();
  await page.locator('.word-card').first().waitFor({ timeout: 10000 });
  check('words survive closing and reopening the app', (await page.locator('.word-card').count()) === 2);
  const play = page.locator('.word-card .btn-play').first();
  let plays = 0;
  for (let i = 0; i < 3; i++) {
    await play.click();
    await page.waitForTimeout(300);
    if ((await play.getAttribute('aria-pressed')) === 'true') plays++;
    await play.click();
  }
  check('original recording replays again and again', plays === 3, `${plays}/3`);
  await page.screenshot({ path: `${OUT}/04-library.png` });

  // 5. Manual correction: Persian rejected, English saved
  await page.getByRole('button', { name: /ویرایش/ }).first().click();
  const input = page.locator('.editor input');
  await input.fill('!!');
  await page.getByRole('button', { name: /ثبت/ }).click();
  check('editor refuses text without letters', await page.getByText('باید حداقل یک حرف بنویسی').isVisible());
  await input.fill('Apple');
  await page.getByRole('button', { name: /ثبت/ }).click();
  await page.locator('.word-text', { hasText: 'Apple' }).waitFor({ timeout: 5000 });
  check('manual correction saved', true);

  // 6. Backup → delete everything → restore
  await page.getByRole('button', { name: /تنظیمات/ }).click();
  await page.screenshot({ path: `${OUT}/05-settings.png` });
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /ساختن فایل پشتیبان/ }).click()]);
  const backupPath = path.join(OUT, 'backup.json');
  await download.saveAs(backupPath);
  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  const hashesOk = backup.words.every((w) => crypto.createHash('sha256').update(Buffer.from(w.audio, 'base64')).digest('hex') === w.audioSha256);
  const rates = backup.words.filter((w) => w.audioBytes).map((w) => Math.round(w.audioBytes / (w.durationMs / 1000)));
  check('recordings are small (voice quality)', rates.length > 0 && rates.every((r) => r < 6000), `${rates.join(', ')} bytes/second`);
  check('backup file holds every word with its exact audio', backup.words.length === 2 && hashesOk, download.suggestedFilename());

  await page.getByRole('button', { name: /کلمه‌ها و جمله‌هایم/ }).click();
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: /پاک کردن/ }).first().click();
    await page.getByRole('button', { name: 'آره، پاک کن' }).click();
    await page.waitForTimeout(400);
  }
  check('delete removes words', (await page.locator('.word-card').count()) === 0);
  await page.getByRole('button', { name: /تنظیمات/ }).click();
  await page.locator('input[type=file]').setInputFiles(backupPath);
  await page.getByText('کلمه برگشت').waitFor({ timeout: 10000 });
  await page.getByRole('button', { name: /کلمه‌ها و جمله‌هایم/ }).click();
  await page.locator('.word-card').first().waitFor();
  check('restore brings everything back', (await page.locator('.word-card').count()) === 2);

  // 6b. Every language, mixed in one entry, read part by part — no settings needed
  await page.locator('.tabbar button').first().click();
  await page.locator('.hint-field input').fill('cat گربه');
  await page.locator('.save-typed').click();
  await page.locator('.saved-card', { hasText: 'cat گربه' }).waitFor({ timeout: 5000 });
  await page.waitForTimeout(500);
  const spokenMixed = await page.evaluate(() => window.__spoken.slice(-2));
  check('mixed «cat گربه» is saved and read in English then Persian', JSON.stringify(spokenMixed) === JSON.stringify([{ text: 'cat', lang: 'en-US' }, { text: 'گربه', lang: 'fa-IR' }]), JSON.stringify(spokenMixed));
  await page.screenshot({ path: `${OUT}/12-mixed-saved.png` });
  await page.locator('.saved-card').getByRole('button', { name: /یک کلمه یا جمله تازه/ }).click();
  await page.locator('.hint-field input').fill('ねこ');
  await page.locator('.save-typed').click();
  await page.locator('.saved-card', { hasText: 'ねこ' }).waitFor({ timeout: 5000 });
  await page.locator('.saved-card .btn-tts').click();
  await page.getByText('این دستگاه صدای ژاپنی ندارد').waitFor({ timeout: 5000 });
  check('Japanese saved without any setting; missing voice is explained', true);
  await page.locator('.saved-card').getByRole('button', { name: /برو به کلمه‌ها و جمله‌هایم/ }).click();
  await page.locator('.word-card', { hasText: 'ねこ' }).waitFor();
  await page.locator('.toolbar .chip', { hasText: 'ژاپنی' }).click();
  check('library can be filtered by language', (await page.locator('.word-card').count()) === 1);
  await page.locator('.toolbar .chip', { hasText: 'ژاپنی' }).click();

  // 6c. Folders
  await page.locator('.folder-add').click();
  await page.locator('.folder-dialog input').fill('حیوانات');
  await page.locator('.emoji-choice', { hasText: '🐶' }).click();
  await page.locator('.folder-dialog').getByRole('button', { name: /تایید/ }).click();
  await page.locator('.folder-tile.on', { hasText: 'حیوانات' }).waitFor({ timeout: 5000 });
  check('a folder «🐶 حیوانات» can be made', await page.getByText('این پوشه هنوز خالی است').isVisible());
  await page.locator('.tabbar button').first().click();
  await page.locator('.folder-picker .chip', { hasText: 'حیوانات' }).click();
  await page.locator('.hint-field input').fill('dog سگ');
  await page.locator('.save-typed').click();
  await page.locator('.saved-card', { hasText: 'dog سگ' }).waitFor({ timeout: 5000 });
  await page.getByRole('button', { name: /کلمه‌ها و جمله‌هایم/ }).first().click();
  await page.locator('.folder-tile', { hasText: 'حیوانات' }).click();
  await page.locator('.word-card', { hasText: 'dog سگ' }).waitFor({ timeout: 5000 });
  check('word saved into the chosen folder', (await page.locator('.word-card').count()) === 1);
  await page.screenshot({ path: `${OUT}/13-folder.png` });
  // move another word into the folder from its card
  await page.locator('.folder-tile', { hasText: 'همه' }).click();
  await page.locator('.word-card', { hasText: 'ねこ' }).locator('.folder-select').selectOption({ label: '🐶 حیوانات' });
  await page.locator('.folder-tile', { hasText: 'حیوانات' }).click();
  await page.waitForTimeout(300);
  check('a word can be moved into a folder', (await page.locator('.word-card').count()) === 2);
  await page.getByRole('button', { name: 'پاک کردن پوشه' }).click();
  await page.getByRole('button', { name: 'آره، پاک کن' }).click();
  await page.locator('.folder-tile', { hasText: 'بدون پوشه' }).click();
  await page.locator('.word-card', { hasText: 'dog سگ' }).waitFor({ timeout: 5000 });
  check('deleting a folder keeps its words (they go to «بدون پوشه»)', true);
  await ctx.close();

  // 7. No internet the first time → recording kept, text can be made later
  // A fresh profile = a new device that has never downloaded the model.
  const fresh = fs.mkdtempSync(path.join(os.tmpdir(), 'echowords-fresh-'));
  const ctx2 = await chromium.launchPersistentContext(fresh, {
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${process.env.SPEECH_WAV}`, '--allow-file-access-from-files'],
    viewport: { width: 412, height: 860 }, reducedMotion: 'reduce', permissions: ['microphone'],
  });
  await ctx2.addInitScript(([base, model]) => {
    window.__ECHOWORDS_ASR__ = { libUrl: `${base}/lib/transformers.min.js`, model, remoteHost: `${base}/models/`, remotePathTemplate: '{model}/', wasmPaths: `${base}/lib/` };
  }, [ASR, process.env.ASR_MODEL || 'Xenova/whisper-tiny']);
  await ctx2.route(/\/models\//, (r) => r.abort());
  page = ctx2.pages()[0];
  await page.goto(FILE);
  await record(page, 2500);
  await page.getByText('الان نتوانستم بنویسم چی گفتی').waitFor({ timeout: 60000 });
  await confirmBtn(page).click();
  await page.locator('.word-card-result .state-failed').waitFor({ timeout: 60000 });
  check('without internet the recording is still saved', await page.locator('.word-card-result .btn-play').isVisible());
  await page.screenshot({ path: `${OUT}/06-no-model.png` });
  await ctx2.unroute(/\/models\//);
  await page.getByRole('button', { name: /دوباره بنویس/ }).click();
  await page.locator('.word-card-result .word-text').waitFor({ timeout: 120000 });
  check('text is made later when the model is reachable', true, await page.locator('.word-card-result .word-text').textContent());
  await ctx2.close();

  // 8. Model download hangs forever (blocked/slow host): confirm must still work, nothing may hang
  const fresh2 = fs.mkdtempSync(path.join(os.tmpdir(), 'echowords-hang-'));
  const ctx3 = await chromium.launchPersistentContext(fresh2, {
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${process.env.SPEECH_WAV}`, '--allow-file-access-from-files'],
    viewport: { width: 412, height: 860 }, reducedMotion: 'reduce', permissions: ['microphone'],
  });
  await ctx3.addInitScript(([base, model]) => {
    window.__ECHOWORDS_ASR__ = { libUrl: `${base}/lib/transformers.min.js`, model, remoteHost: `${base}/models/`, remotePathTemplate: '{model}/', wasmPaths: `${base}/lib/` };
  }, [ASR, process.env.ASR_MODEL || 'Xenova/whisper-tiny']);
  await ctx3.route(/\/models\//, () => {}); // never answers
  page = ctx3.pages()[0];
  await page.goto(FILE);
  await record(page, 2500);
  await page.getByText('درسته؟').waitFor();
  check('hanging download: confirm button usable immediately', (await confirmBtn(page).isEnabled()) && (await reviewInput(page).isVisible()));
  const t0 = Date.now();
  await page.getByText('الان نتوانستم بنویسم چی گفتی').waitFor({ timeout: 40000 });
  check('hanging download: app stops waiting by itself', true, `${Math.round((Date.now() - t0) / 1000)}s`);
  await reviewInput(page).fill('I like apples.');
  await confirmBtn(page).click();
  await page.locator('.word-card-result .word-text', { hasText: 'I like apples.' }).waitFor({ timeout: 10000 });
  await page.screenshot({ path: `${OUT}/07-confirmed.png` });
  await page.getByRole('button', { name: /برو به کلمه‌ها و جمله‌هایم/ }).click();
  await page.locator('.word-card .word-text', { hasText: 'I like apples.' }).waitFor({ timeout: 10000 });
  check('confirmed sentence appears in «کلمه‌ها و جمله‌هایم»', true);
  await page.screenshot({ path: `${OUT}/08-library.png` });

  // 9. Confirm while recognition is still running: saved at once, text filled in afterwards
  await page.locator('.tabbar button').first().click();
  await ctx3.unroute(/\/models\//);
  await record(page, 3000);
  await page.waitForTimeout(400); // recognition is busy now
  const tSave = Date.now();
  await confirmBtn(page).click();
  await page.locator('.word-card-result').waitFor({ timeout: 10000 });
  const saveMs = Date.now() - tSave;
  check('early confirm saves immediately (voice + text), even while recognition is busy', (await countSaved(page)) === 2 && saveMs < 1500, `${saveMs} ms`);
  await page.locator('.word-card-result .word-text').waitFor({ timeout: 120000 });
  check('text is filled in afterwards', /learning english/i.test(await page.locator('.word-card-result .word-text').textContent()));
  await ctx3.close();

  // 9b. A viewer that blocks IndexedDB but allows localStorage: words still survive closing
  const lsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'echowords-ls-'));
  const lsOpts = { viewport: { width: 412, height: 860 }, reducedMotion: 'reduce', acceptDownloads: true };
  const blockIdb = () => {
    IDBFactory.prototype.open = function () {
      throw new DOMException('denied', 'SecurityError');
    };
  };
  let ctxL = await chromium.launchPersistentContext(lsDir, lsOpts);
  await ctxL.addInitScript(blockIdb);
  page = ctxL.pages()[0];
  await page.goto(FILE);
  await page.locator('.hint-field input').fill('dog');
  await page.locator('.save-typed').click();
  await page.locator('.saved-card', { hasText: 'dog' }).waitFor({ timeout: 5000 });
  await page.waitForTimeout(1500); // Chromium writes localStorage to disk a moment later; the test closes the browser abruptly
  await ctxL.close();
  ctxL = await chromium.launchPersistentContext(lsDir, lsOpts);
  await ctxL.addInitScript(blockIdb);
  page = ctxL.pages()[0];
  await page.goto(FILE);
  await page.locator('.tabbar button').nth(1).click();
  await page.locator('.word-card .word-text', { hasText: 'dog' }).waitFor({ timeout: 20000 });
  check('IndexedDB blocked: second storage keeps «dog» after closing', true);
  await ctxL.close();

  // 9c. A page without Web Crypto (crypto.subtle / randomUUID are missing outside https)
  const ncDir = fs.mkdtempSync(path.join(os.tmpdir(), 'echowords-nocrypto-'));
  const ctxN = await chromium.launchPersistentContext(ncDir, { viewport: { width: 412, height: 860 }, reducedMotion: 'reduce', acceptDownloads: true });
  await ctxN.addInitScript(() => {
    Object.defineProperty(Crypto.prototype, 'subtle', { get: () => undefined });
    Crypto.prototype.randomUUID = undefined;
  });
  page = ctxN.pages()[0];
  await page.goto(FILE);
  await page.locator('.hint-field input').fill('bird');
  await page.locator('.save-typed').click();
  await page.locator('.saved-card', { hasText: 'bird' }).waitFor({ timeout: 5000 });
  await page.locator('.saved-card').getByRole('button', { name: /برو به کلمه‌ها و جمله‌هایم/ }).click();
  await page.locator('.word-card .word-text', { hasText: 'bird' }).waitFor({ timeout: 5000 });
  check('no Web Crypto: saving still works', true);
  await ctxN.close();

  // 10. A place that cannot keep data (in-app file viewer, private tab…): warn, keep working, back up after each save
  const blockedDir = fs.mkdtempSync(path.join(os.tmpdir(), 'echowords-blocked-'));
  const ctx4 = await chromium.launchPersistentContext(blockedDir, {
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${process.env.SPEECH_WAV}`, '--allow-file-access-from-files'],
    viewport: { width: 412, height: 860 }, reducedMotion: 'reduce', permissions: ['microphone'], acceptDownloads: true,
  });
  await ctx4.addInitScript(() => {
    IDBFactory.prototype.open = function () {
      throw new DOMException('The user denied permission to access the database.', 'SecurityError');
    };
    Storage.prototype.setItem = function () {
      throw new DOMException('blocked', 'SecurityError');
    };
    window.__ECHOWORDS_ASR__ = { libUrl: 'http://127.0.0.1:1/none.js', model: 'x' }; // no recognizer here
  });
  page = ctx4.pages()[0];
  await page.goto(FILE);
  await page.locator('.storage-banner').waitFor({ timeout: 10000 });
  check('blocked storage: clear warning is shown', true);
  await page.screenshot({ path: `${OUT}/09-blocked.png` });
  await record(page, 2000);
  await reviewInput(page).fill('cat');
  const [blockedBackup] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }).catch(() => null), confirmBtn(page).click()]);
  await page.locator('.word-card-result .word-text', { hasText: 'cat' }).waitFor({ timeout: 10000 });
  check('blocked storage: save still works and a backup file is made', !!blockedBackup);
  const rescue = path.join(OUT, 'rescue-backup.json');
  if (blockedBackup) await blockedBackup.saveAs(rescue);
  await ctx4.close();

  // 11. Open in a brand-new browser (new device / new app version): empty → restore card → everything back
  const newDir = fs.mkdtempSync(path.join(os.tmpdir(), 'echowords-newdevice-'));
  const ctx5 = await chromium.launchPersistentContext(newDir, { viewport: { width: 412, height: 860 }, reducedMotion: 'reduce' });
  page = ctx5.pages()[0];
  await page.goto(FILE);
  await page.locator('.restore-card').waitFor({ timeout: 10000 });
  check('empty app offers to restore from the backup file', true);
  await page.screenshot({ path: `${OUT}/10-restore-card.png` });
  await page.locator('.restore-card input[type=file]').setInputFiles(rescue);
  await page.getByText('کلمه برگشت').waitFor({ timeout: 10000 });
  await page.getByRole('button', { name: /کلمه‌ها و جمله‌هایم/ }).click();
  await page.locator('.word-card .word-text', { hasText: 'cat' }).waitFor({ timeout: 10000 });
  const p2 = page.locator('.word-card .btn-play').first();
  await p2.click();
  await page.waitForTimeout(300);
  check('restored word and its recording are back', (await p2.getAttribute('aria-pressed')) === 'true');
  await ctx5.close();

  // 12. Microphone: a page opened as a file gets the real reason, not a vague "no permission"
  const micDir = fs.mkdtempSync(path.join(os.tmpdir(), 'echowords-mic-'));
  const ctxM = await chromium.launchPersistentContext(micDir, { viewport: { width: 412, height: 860 }, reducedMotion: 'reduce' });
  await ctxM.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException('Permission denied', 'NotAllowedError');
    };
  });
  page = ctxM.pages()[0];
  await page.goto(FILE);
  await page.locator('.mic-btn').click();
  await page.getByText('برنامه به شکل «فایل» باز شده است').waitFor({ timeout: 5000 });
  check('mic refused on a file page: explains why and what to do', true);
  await page.screenshot({ path: `${OUT}/14-mic-file.png` });
  await ctxM.close();

  // 12b. Normal case: the «اجازه میکروفون» button asks the browser and reports success
  const micOkDir = fs.mkdtempSync(path.join(os.tmpdir(), 'echowords-micok-'));
  const ctxMo = await chromium.launchPersistentContext(micOkDir, {
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
    viewport: { width: 412, height: 860 }, reducedMotion: 'reduce', permissions: ['microphone'],
  });
  page = ctxMo.pages()[0];
  await page.goto(FILE);
  await page.getByRole('button', { name: /تنظیمات/ }).click();
  await page.getByRole('button', { name: /اجازه میکروفون/ }).click();
  await page.getByText('میکروفون آماده است').waitFor({ timeout: 5000 });
  check('Settings «اجازه میکروفون» asks the browser directly', true);
  await page.getByRole('button', { name: /امتحان میکروفون/ }).click();
  await page.getByText('میکروفون کار می‌کند').waitFor({ timeout: 10000 });
  check('Settings microphone test records, measures and plays back', true, await page.locator('.mic-check .msg').textContent());
  await ctxMo.close();

  // 13. AI tutor with a Gemini key (the service is simulated here: no internet to Google in this test)
  const aiDir = fs.mkdtempSync(path.join(os.tmpdir(), 'echowords-ai-'));
  const ctxA = await chromium.launchPersistentContext(aiDir, { viewport: { width: 412, height: 860 }, reducedMotion: 'reduce' });
  await ctxA.addInitScript(() => {
    window.__spoken = [];
    speechSynthesis.getVoices = () => [{ lang: 'en-US' }, { lang: 'fa-IR' }, { lang: 'ja-JP' }];
    speechSynthesis.speak = (u) => {
      window.__spoken.push({ text: u.text, lang: u.lang });
      setTimeout(() => u.onend && u.onend(new Event('end')), 30);
    };
  });
  const aiRequests = [];
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
  await ctxA.route('https://generativelanguage.googleapis.com/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const body = JSON.parse(req.postData() || '{}');
    aiRequests.push({ key: req.headers()['x-goog-api-key'], body });
    const lastText = body.contents?.at(-1)?.parts?.[0]?.text ?? '';
    const hasImage = !!body.contents?.at(-1)?.parts?.some((p) => p.inline_data);
    const answer = hasImage
      ? { reply: 'در عکس نوشته «STOP» که به فارسی یعنی «ایست».', items: [{ text: 'STOP', lang: 'en', meaning: 'ایست', say: 'اِستاپ' }] }
      : /ژاپنی/.test(lastText)
        ? { reply: 'گربه به ژاپنی می‌شود 猫 که «نِکو» خوانده می‌شود.', items: [{ text: '猫', lang: 'ja', meaning: 'گربه', say: 'نِکو' }] }
        : { reply: 'سیب به انگلیسی می‌شود apple.', items: [{ text: 'apple', lang: 'en', meaning: 'سیب', say: 'اَپِل' }] };
    await route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(answer) }] } }] }) });
  });
  page = ctxA.pages()[0];
  await page.goto(FILE);
  await page.getByRole('button', { name: /معلم/ }).click();
  check('tutor without a key explains how to turn it on', await page.getByText('معلم هوشمند هنوز روشن نیست').isVisible());
  await page.locator('.tutor-input textarea').fill('سلام');
  await page.getByRole('button', { name: /بفرست/ }).click();
  await page.locator('.bubble.assistant.error', { hasText: 'کلید Gemini یا ChatGPT' }).waitFor({ timeout: 5000 });
  check('tutor always has a text box (explains in the chat when no AI is set up)', true);
  await page.getByRole('button', { name: /رفتن به تنظیمات/ }).click();
  await page.locator('.ai-settings .chip', { hasText: 'Gemini' }).click();
  await page.locator('input[type=password]').fill('test-gemini-key');
  await page.getByRole('button', { name: /ذخیره کلید/ }).click();
  await page.getByRole('button', { name: /معلم/ }).click();
  await page.getByRole('button', { name: '«سیب» به انگلیسی چی میشه؟' }).click();
  await page.locator('.bubble.assistant', { hasText: 'apple' }).waitFor({ timeout: 10000 });
  check('tutor answers in Persian with the English word', aiRequests[0]?.key === 'test-gemini-key' && !!aiRequests[0]?.body?.system_instruction);
  await page.waitForTimeout(400);
  check('tutor reads its answer aloud (each part in its language)', await page.evaluate(() => window.__spoken.some((x) => x.text.startsWith('apple') && x.lang === 'en-US') && window.__spoken.some((x) => x.lang === 'fa-IR')));
  await page.locator('.tutor-item', { hasText: 'apple' }).getByRole('button', { name: /ذخیره در کلمه‌ها/ }).click();
  await page.locator('.tabbar button').nth(1).click();
  await page.locator('.word-card', { hasText: 'apple سیب' }).waitFor({ timeout: 5000 });
  check('a word taught by the tutor can be saved with one tap', true);
  await page.getByRole('button', { name: /معلم/ }).click();
  // translation into another language, in a box with its own «🔊 تلفظ»
  await page.locator('.tutor-input textarea').fill('گربه به ژاپنی چی میشه');
  await page.getByRole('button', { name: /بفرست/ }).click();
  await page.locator('.tutor-item', { hasText: '猫' }).waitFor({ timeout: 10000 });
  await page.waitForTimeout(300);
  await page.evaluate(() => { window.__spoken.length = 0; });
  await page.locator('.tutor-item', { hasText: '猫' }).locator('.btn-tts').click();
  await page.waitForTimeout(300);
  check('a translated word has its own box with «🔊 تلفظ»', (await page.evaluate(() => window.__spoken.map((x) => x.text).join(' '))).includes('猫'));
  await page.evaluate(() => { window.__spoken.length = 0; });
  await page.locator('.bubble.assistant .answer-box').last().locator('.btn-tts').click();
  await page.waitForTimeout(300);
  check('the answer box has «🔊 تلفظ» that reads the whole answer', (await page.evaluate(() => window.__spoken.length)) >= 1);
  check('tutor is text only (no live mode, no camera, no voice button)', (await page.getByRole('button', { name: /حالت لایو|دوربین|با صدا بپرس|عکس از کلمه/ }).count()) === 0);
  await page.screenshot({ path: `${OUT}/15-tutor.png` });
  await ctxA.close();

  // 13b. Fast and never stuck: no "thinking" delay, time limit, cancel, model fallback
  const fastDir = fs.mkdtempSync(path.join(os.tmpdir(), 'echowords-fast-'));
  const ctxF = await chromium.launchPersistentContext(fastDir, { viewport: { width: 412, height: 860 }, reducedMotion: 'reduce' });
  await ctxF.addInitScript(() => {
    window.__ECHOWORDS_AI_TIMEOUT__ = 2000;
    localStorage.setItem('echowords-ai', JSON.stringify({ provider: 'gemini', key: 'k', model: 'gemini-old-model' }));
    window.__spoken = [];
    speechSynthesis.getVoices = () => [{ lang: 'en-US' }, { lang: 'fa-IR' }];
    speechSynthesis.speak = (u) => { window.__spoken.push(u.text); setTimeout(() => u.onend && u.onend(new Event('end')), 30); };
  });
  const fastCors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
  let mode = 'hang';
  const fastReqs = [];
  await ctxF.route('https://generativelanguage.googleapis.com/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: fastCors });
    const model = /models\/([^:]+):/.exec(req.url())?.[1];
    fastReqs.push({ model, body: JSON.parse(req.postData() || '{}') });
    if (mode === 'hang') return; // never answers
    if (model === 'gemini-old-model') return route.fulfill({ status: 404, headers: fastCors, body: '{"error":{"code":404}}' });
    return route.fulfill({ status: 200, headers: fastCors, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"reply":"سگ به انگلیسی می‌شود dog.","items":[]}' }] } }] }) });
  });
  page = ctxF.pages()[0];
  await page.goto(FILE);
  await page.getByRole('button', { name: /معلم/ }).click();
  const t0b = Date.now();
  await page.getByRole('button', { name: 'یک کلمه تازه انگلیسی یادم بده' }).click();
  await page.locator('.bubble.assistant .diag', { hasText: 'generativelanguage.googleapis.com' }).waitFor({ timeout: 5000 });
  check('while waiting, the step it is on is shown (which server, how long)', true);
  await page.locator('.bubble.assistant.error', { hasText: 'سرور هوش مصنوعی جواب نداد' }).waitFor({ timeout: 15000 });
  check('a server that never answers: clear message instead of endless «thinking»', fastReqs.length === 2, `${Math.round((Date.now() - t0b) / 1000)}s, ${fastReqs.length} tries`);
  await page.locator('.bubble.assistant.error').last().getByRole('button', { name: /کپی گزارش/ }).click();
  const reportText = await page.locator('.report-text').last().innerText();
  check('«📋 کپی گزارش» gives the full step-by-step report (without the key)', /v19/.test(reportText) && /timeout/.test(reportText) && !/"k"|key: k/.test(reportText), reportText.split('\n').slice(0, 3).join(' | '));
  fastReqs.length = 0;
  await page.locator('.tutor-input textarea').fill('«سیب» به انگلیسی چی میشه؟');
  await page.getByRole('button', { name: /بفرست/ }).click();
  await page.locator('.tutor-item', { hasText: 'apple' }).waitFor({ timeout: 15000 });
  check('AI unreachable: a word question is still answered from the app\'s own dictionary', (await page.locator('.offline-note').count()) === 1 && (await page.locator('.tutor-item', { hasText: 'apple' }).getByRole('button', { name: /تلفظ/ }).count()) === 1);
  await page.locator('.tutor-input textarea').fill('سلام');
  await page.getByRole('button', { name: /بفرست/ }).click();
  await page.locator('.bubble.assistant').getByRole('button', { name: /لغو/ }).click();
  await page.locator('.bubble.assistant', { hasText: 'لغو شد' }).waitFor({ timeout: 3000 });
  check('«لغو» stops waiting at once', true);
  mode = 'answer';
  fastReqs.length = 0;
  await page.locator('.tutor-input textarea').fill('سگ به انگلیسی چی میشه');
  await page.getByRole('button', { name: /بفرست/ }).click();
  await page.locator('.bubble.assistant', { hasText: 'dog' }).waitFor({ timeout: 15000 });
  const okReq = fastReqs.find((r) => r.model !== 'gemini-old-model');
  check('answers fast: Gemini «thinking» turned off', okReq?.body?.generationConfig?.thinkingConfig?.thinkingBudget === 0 && okReq.body.generationConfig.maxOutputTokens <= 600);
  check('a model name that no longer exists falls back to another', fastReqs[0]?.model === 'gemini-old-model' && !!okReq, fastReqs.map((r) => r.model).join(' → '));
  await page.waitForTimeout(500);
  check('the answer is read aloud', await page.evaluate(() => window.__spoken.some((x) => x.includes('dog'))));
  await ctxF.close();

  // 13c. Settings «امتحان اتصال» with ChatGPT
  const camDir = fs.mkdtempSync(path.join(os.tmpdir(), 'echowords-conn-'));
  const ctxV = await chromium.launchPersistentContext(camDir, { viewport: { width: 412, height: 860 }, reducedMotion: 'reduce' });
  await ctxV.addInitScript(() => localStorage.setItem('echowords-ai', JSON.stringify({ provider: 'openai', key: 'sk-test', model: 'gpt-4o-mini' })));
  const oaCors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
  await ctxV.route('https://api.openai.com/**', (r) =>
    r.request().method() === 'OPTIONS'
      ? r.fulfill({ status: 204, headers: oaCors })
      : r.fulfill({ status: 200, headers: oaCors, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{"reply":"سلام!","items":[]}' } }] }) }),
  );
  page = ctxV.pages()[0];
  await page.goto(FILE);
  await page.getByRole('button', { name: /تنظیمات/ }).click();
  await page.getByRole('button', { name: /امتحان اتصال/ }).click();
  await page.getByText('ChatGPT جواب داد').waitFor({ timeout: 10000 });
  check('Settings «امتحان اتصال» shows that ChatGPT answers (and how fast)', true);
  await ctxV.close();

  // 13d. The real reason for failures; models that refuse settings; a custom service
  const whyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'echowords-why-'));
  const ctxW = await chromium.launchPersistentContext(whyDir, { viewport: { width: 412, height: 900 }, reducedMotion: 'reduce' });
  const wCors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
  let oaMode = 'quota';
  const oaBodies = [];
  await ctxW.route('https://api.openai.com/**', (r) => {
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: wCors });
    const body = JSON.parse(r.request().postData() || '{}');
    oaBodies.push(body);
    const json = (status, obj) => r.fulfill({ status, headers: wCors, contentType: 'application/json', body: JSON.stringify(obj) });
    if (oaMode === 'quota') return json(429, { error: { message: 'You exceeded your current quota, please check your plan and billing details.', code: 'insufficient_quota' } });
    if (oaMode === 'badkey') return json(401, { error: { message: 'Incorrect API key provided: sk-wrong.', code: 'invalid_api_key' } });
    if (oaMode === 'region') return json(403, { error: { message: 'Country, region, or territory not supported', code: 'unsupported_country_region_territory' } });
    // 'picky': a newer model that refuses max_tokens and temperature
    if ('max_tokens' in body) return json(400, { error: { message: "Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead." } });
    if ('temperature' in body) return json(400, { error: { message: "Unsupported value: 'temperature' does not support 0.4 with this model." } });
    return json(200, { choices: [{ message: { content: '{"reply":"سلام! من آماده‌ام.","items":[]}' } }] });
  });
  await ctxW.route('https://ai.example.test/**', (r) => {
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: wCors });
    return r.fulfill({ status: 200, headers: wCors, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{"reply":"سلام از سرویس دلخواه!","items":[]}' } }] }) });
  });
  page = ctxW.pages()[0];
  await page.goto(FILE);
  await page.getByRole('button', { name: /تنظیمات/ }).click();
  await page.locator('.ai-settings .chip', { hasText: 'ChatGPT' }).click();
  await page.locator('.ai-key').fill('  sk-test-key  ');
  await page.getByRole('button', { name: /ذخیره کلید/ }).click();
  await page.getByText('اعتبار یا سهمیه آن تمام شده').waitFor({ timeout: 15000 });
  check('right key but no credit: says so (not «wrong key»)', /insufficient|quota/i.test(await page.locator('.ai-settings .diag').textContent()));
  await page.screenshot({ path: `${OUT}/18-ai-quota.png` });
  oaMode = 'badkey';
  await page.getByRole('button', { name: /امتحان اتصال/ }).click();
  await page.getByText('خود سرویس می‌گوید این کلید درست نیست').waitFor({ timeout: 15000 });
  check('wrong key: the service\'s own message is shown', /Incorrect API key/.test(await page.locator('.ai-settings .diag').textContent()));
  oaMode = 'region';
  await page.getByRole('button', { name: /امتحان اتصال/ }).click();
  await page.getByText('محدودیت منطقه').waitFor({ timeout: 15000 });
  check('region refused: explained as region, not key', true);
  oaMode = 'picky';
  oaBodies.length = 0;
  await page.getByRole('button', { name: /امتحان اتصال/ }).click();
  await page.getByText('ChatGPT جواب داد').waitFor({ timeout: 15000 });
  const lastBody = oaBodies.at(-1);
  check('a model that refuses our settings is adapted to automatically', oaBodies.length === 3 && !('max_tokens' in lastBody) && 'max_completion_tokens' in lastBody && !('temperature' in lastBody), `${oaBodies.length} requests`);
  await page.locator('.ai-settings .chip', { hasText: 'سرویس دیگر' }).click();
  await page.locator('.ai-settings input[inputmode=url]').fill('https://ai.example.test/v1/');
  await page.locator('.ai-key').fill('my-key');
  await page.locator('.ai-model').fill('some-model');
  await page.getByRole('button', { name: /ذخیره کلید/ }).click();
  await page.getByText('سرویس دلخواه جواب داد').waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: /معلم/ }).click();
  await page.locator('.tutor-input textarea').fill('سلام');
  await page.getByRole('button', { name: /بفرست/ }).click();
  await page.locator('.bubble.assistant', { hasText: 'سلام از سرویس دلخواه' }).waitFor({ timeout: 10000 });
  check('a custom OpenAI-compatible service works', true);
  await ctxW.close();

  // 14. Inside Claude: the tutor uses Claude with no key at all (claude.use('sample') simulated)
  const clDir = fs.mkdtempSync(path.join(os.tmpdir(), 'echowords-claude-'));
  const ctxC = await chromium.launchPersistentContext(clDir, { viewport: { width: 412, height: 860 }, reducedMotion: 'reduce' });
  await ctxC.addInitScript(() => {
    window.__prompts = [];
    const sample = async (input) => {
      window.__prompts.push(input);
      return { text: JSON.stringify({ reply: 'Hello به ژاپنی می‌شود こんにちは.', items: [{ text: 'こんにちは', lang: 'ja', meaning: 'سلام', say: 'کُنیچیوا' }] }) };
    };
    window.claude = { use: async (n) => (n === 'sample' ? sample : null) };
  });
  page = ctxC.pages()[0];
  await page.goto(FILE);
  await page.getByRole('button', { name: /معلم/ }).click();
  await page.getByText('بدون کلید').first().waitFor({ timeout: 5000 });
  await page.getByRole('button', { name: '«Hello» را به ژاپنی بگو' }).click();
  await page.locator('.bubble.assistant', { hasText: 'こんにちは' }).waitFor({ timeout: 10000 });
  check('inside Claude the tutor works with no API key', await page.evaluate(() => window.__prompts.length === 1 && /9-year-old/.test(window.__prompts[0])));
  await ctxC.close();

  // 15. Inside Claude: words are also kept in the learner's private Claude storage
  const remoteStore = {}; // shared between the two "devices" below (stands in for Claude storage)
  const stubClaude = async (ctx) => {
    await ctx.exposeBinding('__remoteSet', (_s, k, v) => { remoteStore[k] = v; });
    await ctx.exposeBinding('__remoteDel', (_s, k) => { delete remoteStore[k]; });
    await ctx.exposeBinding('__remoteAll', () => remoteStore);
    await ctx.addInitScript(() => {
      const coll = {
        doc: (id) => ({ set: (d) => window.__remoteSet(id, d), delete: () => window.__remoteDel(id) }),
        get: async () => {
          const all = await window.__remoteAll();
          return { docs: Object.entries(all).map(([id, v]) => ({ id, exists: true, data: () => v })) };
        },
      };
      const db = { collection: () => coll };
      const user = { id: async () => 'learner-1' };
      window.claude = { use: async (n) => (n === 'db' ? db : n === 'user' ? user : null) };
    });
  };
  const devA = fs.mkdtempSync(path.join(os.tmpdir(), 'echowords-devA-'));
  const ctxD1 = await chromium.launchPersistentContext(devA, { viewport: { width: 412, height: 860 }, reducedMotion: 'reduce' });
  await stubClaude(ctxD1);
  page = ctxD1.pages()[0];
  await page.goto(FILE);
  await page.locator('.hint-field input').fill('rabbit خرگوش');
  await page.locator('.save-typed').click();
  await page.locator('.saved-card', { hasText: 'rabbit' }).waitFor({ timeout: 5000 });
  await page.waitForTimeout(500);
  check('inside Claude: a saved word is also stored in Claude storage', Object.values(remoteStore).some((v) => v.transcript === 'rabbit خرگوش'));
  await ctxD1.close();
  const devB = fs.mkdtempSync(path.join(os.tmpdir(), 'echowords-devB-'));
  const ctxD2 = await chromium.launchPersistentContext(devB, { viewport: { width: 412, height: 860 }, reducedMotion: 'reduce' });
  await stubClaude(ctxD2);
  page = ctxD2.pages()[0];
  await page.goto(FILE);
  await page.getByRole('button', { name: /کلمه‌ها و جمله‌هایم/ }).first().click();
  await page.locator('.word-card', { hasText: 'rabbit خرگوش' }).waitFor({ timeout: 10000 });
  check('inside Claude: an empty browser gets the words back from Claude storage', true);
  await ctxD2.close();

  // 16. Inside the Android app: speech, listening and backups go through the native bridge
  const andDir = fs.mkdtempSync(path.join(os.tmpdir(), 'echowords-android-'));
  const ctxN2 = await chromium.launchPersistentContext(andDir, { viewport: { width: 412, height: 860 }, reducedMotion: 'reduce' });
  await ctxN2.addInitScript(() => {
    // Like the real Android WebView: the browser's own speech engines do not exist there.
    try { delete window.speechSynthesis; } catch {}
    Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true });
    window.SpeechSynthesisUtterance = undefined;
    window.SpeechRecognition = undefined;
    window.webkitSpeechRecognition = undefined;
    window.__pageErrors = [];
    window.addEventListener('unhandledrejection', (e) => window.__pageErrors.push(String(e.reason)));
    window.addEventListener('error', (e) => window.__pageErrors.push(String(e.message)));
    window.__native = { spoken: [], listened: [], saved: [] };
    const reply = (id, obj) => setTimeout(() => window.__ewNative.done(id, JSON.stringify(obj)), 30);
    window.__native.allowMic = false;
    window.__native.recordStarts = 0;
    window.__native.canListen = true;
    window.EchoWordsAndroid = {
      appVersion: () => '11',
      micGranted: () => window.__native.allowMic,
      requestMic: (id) => { window.__native.allowMic = true; reply(id, { granted: true }); },
      openAppSettings: () => {},
      requestCamera: (id) => reply(id, { granted: false, blocked: true }),
      // Android's own networking: here it forwards to the page's fetch so the simulated server still answers.
      httpRequest: (id, method, url, headersJson, b64) => {
        window.__native.http = (window.__native.http || 0) + 1;
        if (window.__nativeHttpFails) return setTimeout(() => window.__ewNative.done(id, JSON.stringify({ ok: false, error: 'dns', detail: 'java.net.UnknownHostException: stub' })), 50);
        const body = b64 ? Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)) : undefined;
        fetch(url, { method, headers: JSON.parse(headersJson), body })
          .then(async (r) => window.__ewNative.done(id, JSON.stringify({ ok: true, status: r.status, body: await r.text() })))
          .catch((e) => window.__ewNative.done(id, JSON.stringify({ ok: false, error: 'network', detail: String(e) })));
      },
      httpCancel: () => {},
      cloudStatus: () => JSON.stringify(localStorage.getItem('stubDrive') === '1' ? { linked: true, name: 'AMIR-ABC-ganjineh-sedaye-man.json', authority: 'com.google.android.apps.docs.storage' } : { linked: false }),
      cloudLink: (id, name, b64) => window.__driveSave(name, b64).then(() => { localStorage.setItem('stubDrive', '1'); reply(id, { ok: true, linked: true, name, authority: 'com.google.android.apps.docs.storage' }); }),
      cloudWrite: (id, b64) => window.__driveSave('same', b64).then(() => reply(id, { ok: true })),
      cloudOpen: (id) => window.__driveRead().then((b64) => { localStorage.setItem('stubDrive', '1'); reply(id, { ok: true, linked: true, name: 'AMIR-ABC-ganjineh-sedaye-man.json', authority: 'com.google.android.apps.docs.storage', b64 }); }),
      cloudUnlink: () => localStorage.removeItem('stubDrive'),
      startRecording: (id) => { window.__native.recordStarts++; reply(id, window.__native.allowMic ? { ok: true } : { ok: false, error: 'not-allowed' }); },
      recordingLevel: () => 0.3,
      pauseRecording: () => true,
      resumeRecording: () => true,
      stopRecording: (id) => reply(id, { ok: true, mime: 'audio/mp4', b64: window.__SPEECH_B64 }),
      cancelRecording: () => {},
      hasVoice: (tag) => tag !== 'ja-JP',
      speak: (id, text, tag) => { window.__native.spoken.push({ text, tag }); reply(id, { status: 'ok' }); },
      stopSpeaking: () => {},
      canListen: () => window.__native.canListen,
      listen: (id, tag) => { window.__native.listened.push(tag); reply(id, { text: 'سیب به انگلیسی چی میشه', error: null }); },
      stopListening: () => {},
      saveFile: (id, name, mime, b64) => { window.__native.saved.push({ name, mime, size: b64.length }); reply(id, { ok: true }); },
    };
    navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('denied', 'NotAllowedError'); };
  });
  await withDriveStub(ctxN2);
  await ctxN2.addInitScript((b64) => { window.__SPEECH_B64 = b64; }, fs.readFileSync(process.env.SPEECH_WAV).toString('base64'));
  page = ctxN2.pages()[0];
  await page.goto(FILE);
  await page.locator('.hint-field input').fill('cat گربه');
  const [noPopup] = await Promise.all([page.waitForEvent('download', { timeout: 2000 }).catch(() => null), page.locator('.save-typed').click()]);
  await page.locator('.saved-card', { hasText: 'cat گربه' }).waitFor({ timeout: 5000 });
  await page.waitForTimeout(300);
  const nspoken = await page.evaluate(() => window.__native.spoken);
  check('app: pronunciation uses Android text-to-speech, part by part', JSON.stringify(nspoken) === JSON.stringify([{ text: 'cat', tag: 'en-US' }, { text: 'گربه', tag: 'fa-IR' }]), JSON.stringify(nspoken));
  check('app: no surprise «save file» screen after saving a word', !noPopup && (await page.evaluate(() => window.__native.saved.length)) === 0);
  await page.locator('.saved-card').getByRole('button', { name: /یک کلمه یا جمله تازه/ }).click();
  await page.locator('.mic-btn').click();
  await page.getByText('اجازه میکروفون به برنامه داده نشد').waitFor({ timeout: 5000 });
  check('app: microphone refusal explains the Android app setting', true);
  await page.getByRole('button', { name: /تنظیمات/ }).click();
  await page.getByRole('button', { name: /اجازه میکروفون/ }).click();
  await page.getByText('میکروفون آماده است').waitFor({ timeout: 5000 });
  check('app: «اجازه میکروفون» shows Android\'s own permission dialog', await page.evaluate(() => window.__native.allowMic));
  await page.locator('.tabbar button').first().click();
  await page.locator('.mic-btn').click();
  await page.getByText('دارم گوش می‌دهم').waitFor({ timeout: 5000 });
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /تمام/ }).click();
  await page.getByText('درسته؟').waitFor({ timeout: 10000 });
  await page.locator('.review-input').fill('hello');
  await confirmBtn(page).click();
  await page.locator('.word-card-result .btn-play').waitFor({ timeout: 10000 });
  check('app: recording uses Android\'s own recorder and is saved', (await page.evaluate(() => window.__native.recordStarts)) === 2);
  await page.getByRole('button', { name: /تنظیمات/ }).click();
  await page.getByRole('button', { name: /ساختن فایل پشتیبان/ }).click();
  await page.getByText('فایل پشتیبان ساخته شد').waitFor({ timeout: 5000 });
  const nsaved = await page.evaluate(() => window.__native.saved);
  check('app: backup is saved through Android «save as»', nsaved.length === 1 && nsaved[0].mime === 'application/json' && nsaved[0].size > 100, nsaved[0]?.name);
  await page.evaluate(() => localStorage.setItem('echowords-ai', JSON.stringify({ provider: 'gemini', key: 'k', model: 'm' })));
  await page.waitForTimeout(300); // let Chromium hand the new setting to the next page load
  await ctxN2.route('https://generativelanguage.googleapis.com/**', (r) =>
    r.request().method() === 'OPTIONS'
      ? r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } })
      : r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"reply":"سیب می‌شود apple.","items":[]}' }] } }] }) }),
  );
  await page.reload();
  await page.getByRole('button', { name: /معلم/ }).click();
  // typed question inside the app (this used to hang on «thinking» forever)
  await page.locator('.tutor-input textarea').fill('کتاب به انگلیسی چی میشه');
  await page.getByRole('button', { name: /بفرست/ }).click();
  await page.locator('.bubble.user', { hasText: 'کتاب به انگلیسی چی میشه' }).waitFor({ timeout: 5000 });
  await page.locator('.bubble.assistant .answer-box', { hasText: 'apple' }).waitFor({ timeout: 15000 }).catch(async (e) => {
    await page.screenshot({ path: `${OUT}/debug-app-tutor.png` });
    console.log('chat:', (await page.locator('.chat').innerText()).replace(/\s+/g, ' ').slice(0, 400));
    throw e;
  });
  check('app: a typed question gets its answer and «thinking» ends', (await page.locator('.bubble .spinner').count()) === 0);
  await page.waitForTimeout(300);
  check('app: the answer is read aloud with Android\'s voice', (await page.evaluate(() => window.__native.spoken.length)) >= 1);
  // ask again right away, several times: never stuck
  for (const q of ['سگ', 'ماه', 'خورشید']) {
    await page.locator('.tutor-input textarea').fill(`${q} به انگلیسی چی میشه`);
    await page.getByRole('button', { name: /بفرست/ }).click();
    await page.waitForFunction(() => !document.querySelector('.bubble .spinner'), null, { timeout: 15000 });
  }
  check('app: several questions in a row are all answered', (await page.locator('.bubble.assistant .answer-box').count()) === 4);
  check('app: no hidden errors while using the tutor', (await page.evaluate(() => window.__pageErrors.length)) === 0, JSON.stringify(await page.evaluate(() => window.__pageErrors.slice(0, 2))));
  check('app: AI requests go through Android\'s own networking', (await page.evaluate(() => window.__native.http)) >= 4);
  await page.evaluate(() => { window.__nativeHttpFails = true; });
  await page.locator('.tutor-input textarea').fill('یک داستان کوتاه بگو');
  await page.getByRole('button', { name: /بفرست/ }).click();
  await page.waitForFunction(() => !document.querySelector('.bubble .spinner'), null, { timeout: 15000 });
  check('app: if Android\'s networking fails, the WebView\'s own network is tried and the answer comes', (await page.locator('.bubble.assistant .answer-box').count()) === 5);
  await page.evaluate(() => { window.__nativeHttpFails = false; });
  check('app: the version is shown on the tutor screen', await page.getByText('نسخه ۱۹').first().isVisible());
  check('app: the new logo is shown in the top bar', (await page.locator('.topbar .brand-logo svg').count()) === 1);
  await page.screenshot({ path: `${OUT}/16-tutor-app.png` });

  // 17. Google Drive copy: link → everything saved (also words made before linking) → auto-save on change
  const wordsBeforeLink = await countSaved(page);
  await page.getByRole('button', { name: /تنظیمات/ }).click();
  await page.getByRole('button', { name: /اتصال به گوگل درایو/ }).click();
  await page.getByText('وصل است به گوگل درایو').waitFor({ timeout: 10000 });
  const firstCopy = driveWords();
  check('Drive: linking saves ALL existing words at once (made before linking too)', firstCopy.length === wordsBeforeLink && wordsBeforeLink >= 2, `${firstCopy.length} words`);
  check('Drive: the recordings are in the copy too', firstCopy.some((w) => w.audio && w.audio.length > 100));
  await page.screenshot({ path: `${OUT}/17-drive-linked.png` });
  const writes0 = driveFile.writes;
  await page.locator('.tabbar button').first().click();
  await page.locator('.hint-field input').fill('rainbow رنگین‌کمان');
  await page.locator('.save-typed').click();
  await page.locator('.saved-card', { hasText: 'rainbow' }).waitFor({ timeout: 5000 });
  await page.waitForTimeout(2000);
  check('Drive: the heavy Drive copy is not written while the child is still saving words', driveFile.writes === writes0);
  const tDrive = Date.now();
  while (driveFile.writes === writes0 && Date.now() - tDrive < 20000) await page.waitForTimeout(250);
  check('Drive: a new word is saved to Drive by itself once things are quiet', driveFile.writes > writes0 && driveWords().some((w) => w.transcript === 'rainbow رنگین‌کمان'), `${Math.round((Date.now() - tDrive) / 1000) + 2}s`);
  const writes1 = driveFile.writes;
  await page.locator('.saved-card').getByRole('button', { name: /یک کلمه یا جمله تازه/ }).click();
  await page.locator('.hint-field input').fill('star ستاره');
  await page.locator('.save-typed').click();
  await page.locator('.saved-card', { hasText: 'star' }).waitFor({ timeout: 5000 });
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(1500);
  check('Drive: leaving the app writes the waiting Drive copy at once', driveFile.writes > writes1 && driveWords().some((w) => w.transcript === 'star ستاره'));
  await ctxN2.close();

  // 18. "Uninstall and reinstall": a brand-new app with nothing in it → «بازیابی از گوگل درایو» → all back
  const reDir = fs.mkdtempSync(path.join(os.tmpdir(), 'echowords-reinstall-'));
  const ctxR = await chromium.launchPersistentContext(reDir, { viewport: { width: 412, height: 860 }, reducedMotion: 'reduce' });
  await withDriveStub(ctxR);
  await ctxR.addInitScript(() => {
    const reply = (id, obj) => setTimeout(() => window.__ewNative.done(id, JSON.stringify(obj)), 30);
    window.EchoWordsAndroid = {
      appVersion: () => '17', hasVoice: () => true, speak: (id) => reply(id, { status: 'ok' }), stopSpeaking: () => {},
      canListen: () => false, listen: () => {}, stopListening: () => {}, saveFile: () => {},
      cloudStatus: () => JSON.stringify(localStorage.getItem('stubDrive') === '1' ? { linked: true, name: 'AMIR-ABC-ganjineh-sedaye-man.json', authority: 'com.google.android.apps.docs.storage' } : { linked: false }),
      cloudLink: () => {},
      cloudWrite: (id, b64) => window.__driveSave('same', b64).then(() => reply(id, { ok: true })),
      cloudOpen: (id) => window.__driveRead().then((b64) => { localStorage.setItem('stubDrive', '1'); reply(id, { ok: true, linked: true, name: 'AMIR-ABC-ganjineh-sedaye-man.json', authority: 'com.google.android.apps.docs.storage', b64 }); }),
      cloudUnlink: () => localStorage.removeItem('stubDrive'),
    };
  });
  page = ctxR.pages()[0];
  await page.goto(FILE);
  await page.getByRole('button', { name: /کلمه‌ها و جمله‌هایم/ }).first().click();
  await page.getByRole('button', { name: /بازیابی از گوگل درایو/ }).click();
  await page.locator('.word-card', { hasText: 'rainbow' }).waitFor({ timeout: 10000 });
  check('Drive: after reinstalling, every word comes back', (await page.locator('.word-card').count()) === driveWords().length);
  check('Drive: recordings come back and play', (await page.locator('.word-card .btn-play').count()) >= 1);
  await page.getByRole('button', { name: /تنظیمات/ }).click();
  check('Drive: after restoring, syncing continues to the same file', await page.getByText('وصل است به گوگل درایو').isVisible());
  await ctxR.close();

  // 19. First launch only: «تبریک! …خوش آمدید», skip after 1 s, gone by itself after 3 s
  const wDir = fs.mkdtempSync(path.join(os.tmpdir(), 'echowords-welcome-'));
  let ctxW2 = await chromium.launchPersistentContext(wDir, { viewport: { width: 412, height: 860 }, firstLaunch: true });
  page = ctxW2.pages()[0];
  await page.goto(FILE);
  await page.locator('.welcome').waitFor({ timeout: 5000 });
  const welcomeText = (await page.locator('.welcome').innerText()).replace(/\s+/g, ' ');
  check('first launch: welcome screen with the congratulations message', /تبریک!/.test(welcomeText) && /AMIRABC/.test(welcomeText.replace(/\s+/g, '')) && /گنجینه صدای من/.test(welcomeText) && /خوش آمدید/.test(welcomeText), welcomeText);
  await page.screenshot({ path: `${OUT}/19-welcome.png` });
  check('first launch: no skip button during the first second', (await page.locator('.welcome-skip').count()) === 0);
  await page.locator('.welcome-skip').waitFor({ timeout: 2000 });
  check('first launch: «رد کردن» appears after 1 second', true);
  await page.locator('.welcome').waitFor({ state: 'detached', timeout: 4000 });
  check('first launch: the welcome fades away by itself', true);
  await ctxW2.close();
  ctxW2 = await chromium.launchPersistentContext(wDir, { viewport: { width: 412, height: 860 }, firstLaunch: true });
  page = ctxW2.pages()[0];
  await page.goto(FILE);
  await page.waitForTimeout(800);
  check('second launch: no welcome screen', (await page.locator('.welcome').count()) === 0);
  await ctxW2.close();
  const w3 = fs.mkdtempSync(path.join(os.tmpdir(), 'echowords-welcome2-'));
  ctxW2 = await chromium.launchPersistentContext(w3, { viewport: { width: 412, height: 860 }, firstLaunch: true });
  page = ctxW2.pages()[0];
  await page.goto(FILE);
  await page.locator('.welcome-skip').click({ timeout: 3000 });
  await page.locator('.welcome').waitFor({ state: 'detached', timeout: 1500 });
  check('first launch: «رد کردن» closes it at once', true);
  await ctxW2.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
