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
  check('version number is shown', /نسخه ۹/.test(await page.textContent('.topbar')));
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
  await confirmBtn(page).click();
  await page.locator('.word-card-result').waitFor({ timeout: 10000 });
  check('early confirm saves immediately', (await countSaved(page)) === 2);
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
  await ctxL.close();
  ctxL = await chromium.launchPersistentContext(lsDir, lsOpts);
  await ctxL.addInitScript(blockIdb);
  page = ctxL.pages()[0];
  await page.goto(FILE);
  await page.getByRole('button', { name: /کلمه‌ها و جمله‌هایم/ }).click();
  await page.locator('.word-card .word-text', { hasText: 'dog' }).waitFor({ timeout: 10000 });
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
  await ctxMo.close();

  // 13. AI tutor with a Gemini key (the service is simulated here: no internet to Google in this test)
  const aiDir = fs.mkdtempSync(path.join(os.tmpdir(), 'echowords-ai-'));
  const ctxA = await chromium.launchPersistentContext(aiDir, { viewport: { width: 412, height: 860 }, reducedMotion: 'reduce' });
  await ctxA.addInitScript(() => {
    window.__spoken = [];
    speechSynthesis.getVoices = () => [{ lang: 'en-US' }, { lang: 'fa-IR' }];
    speechSynthesis.speak = (u) => {
      window.__spoken.push({ text: u.text, lang: u.lang });
      setTimeout(() => u.onend && u.onend(new Event('end')), 30);
    };
    // A fake speech recogniser: hears one question, then silence.
    let heardOnce = false;
    window.SpeechRecognition = window.webkitSpeechRecognition = class {
      start() {
        setTimeout(() => {
          if (!heardOnce) {
            heardOnce = true;
            this.onresult && this.onresult({ results: [[{ transcript: 'گربه به ژاپنی چی میشه' }]] });
          }
          this.onend && this.onend();
        }, 100);
      }
      stop() {}
      abort() {}
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
  await page.getByRole('button', { name: /رفتن به تنظیمات/ }).click();
  await page.locator('input[type=password]').fill('test-gemini-key');
  await page.getByRole('button', { name: /ذخیره کلید/ }).click();
  await page.getByRole('button', { name: /معلم/ }).click();
  await page.getByRole('button', { name: '«سیب» به انگلیسی چی میشه؟' }).click();
  await page.locator('.bubble.assistant', { hasText: 'apple' }).waitFor({ timeout: 10000 });
  check('tutor answers in Persian with the English word', aiRequests[0]?.key === 'test-gemini-key' && !!aiRequests[0]?.body?.system_instruction);
  await page.waitForTimeout(400);
  check('tutor reads its answer aloud (each part in its language)', await page.evaluate(() => window.__spoken.some((x) => x.text.startsWith('apple') && x.lang === 'en-US') && window.__spoken.some((x) => x.lang === 'fa-IR')));
  await page.locator('.tutor-item', { hasText: 'apple' }).getByRole('button', { name: '💾' }).click();
  await page.getByRole('button', { name: /کلمه‌ها و جمله‌هایم/ }).first().click();
  await page.locator('.word-card', { hasText: 'apple سیب' }).waitFor({ timeout: 5000 });
  check('a word taught by the tutor can be saved with one tap', true);
  await page.getByRole('button', { name: /معلم/ }).click();
  // photo of a word
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await page.locator('.tutor-tools input[type=file]').setInputFiles({ name: 'word.png', mimeType: 'image/png', buffer: png });
  await page.locator('.bubble.assistant', { hasText: 'STOP' }).waitFor({ timeout: 10000 });
  check('photo of a word is read and translated', aiRequests.some((r) => r.body.contents?.at(-1)?.parts?.some((p) => p.inline_data)));
  // live voice mode: listens, answers out loud, listens again, stops after silence
  await page.getByRole('button', { name: /حالت لایو/ }).click();
  await page.locator('.bubble.assistant', { hasText: '猫' }).waitFor({ timeout: 10000 });
  await page.getByRole('button', { name: /حالت لایو/ }).waitFor({ timeout: 10000 });
  check('live mode: spoken question answered out loud, then stops by itself after silence', await page.evaluate(() => window.__spoken.some((x) => x.text.includes('猫') || x.lang === 'ja-JP' || x.text.includes('گربه'))));
  await page.screenshot({ path: `${OUT}/15-tutor.png` });
  await ctxA.close();

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

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
