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

async function record(page, ms, hint) {
  if (hint !== undefined) {
    await page.locator('.hint-field input').fill(hint);
    await page.getByRole('button', { name: /^✅ تایید$/ }).click();
    await page.locator('.hint-confirmed', { hasText: hint }).waitFor({ timeout: 5000 });
  }
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
  await page.getByText('یک کلمه یا جمله انگلیسی بگو').waitFor();
  check('opens from a file with no login or setup', true);
  check('version number is shown', /نسخه ۵/.test(await page.textContent('.topbar')));
  await page.locator('.hint-field input').fill('سیب');
  await page.getByRole('button', { name: /^✅ تایید$/ }).click();
  check('written word: Persian is refused', await page.getByText('فقط با حروف انگلیسی').isVisible());
  await page.locator('.hint-field input').fill('banana');
  await page.locator('.hint-field input').press('Enter');
  await page.locator('.hint-confirmed', { hasText: 'banana' }).waitFor({ timeout: 5000 });
  check('written word: «تایید» / Enter confirms it', await page.getByText('«banana» را بگو').isVisible());
  await page.screenshot({ path: `${OUT}/00-word-confirmed.png` });
  await page.getByRole('button', { name: /عوض کن/ }).click();
  await page.locator('.hint-field input').fill('');
  await page.screenshot({ path: `${OUT}/01-record.png` });

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
  check('nothing is saved before the confirm button', (await countSaved(page)) === 0);
  await page.screenshot({ path: `${OUT}/02-review.png` });
  await confirmBtn(page).click();
  await page.locator('.word-card-result .word-text').waitFor({ timeout: 10000 });
  check('confirm button saves the word', (await countSaved(page)) === 1, await page.locator('.word-card-result .word-text').textContent());
  await page.screenshot({ path: `${OUT}/02-result.png` });

  // 1b. Cancel on the review step discards the take
  await page.getByRole('button', { name: /تازه ضبط کن/ }).last().click();
  await record(page, 1500);
  await reviewInput(page).waitFor({ timeout: 120000 });
  await page.getByRole('button', { name: /لغو/ }).click();
  await page.getByRole('button', { name: 'آره، پاکش کن' }).click();
  await page.locator('.mic-btn').waitFor();
  check('cancel throws the take away without saving', (await countSaved(page)) === 1);

  // 2. Hint that does not match → the app asks instead of guessing
  await record(page, 3000, 'apple');
  check('confirmed written word is already in the review box', (await reviewInput(page).inputValue()) === 'apple');
  await page.getByText('مطمئن نیستم').waitFor({ timeout: 120000 });
  check('mismatch with what was heard is pointed out', (await reviewInput(page).inputValue()) === 'apple');
  await page.screenshot({ path: `${OUT}/03-unclear.png` });
  await page.locator('.chip-en', { hasText: 'learning' }).click();
  check('tapping a suggestion fills the box', /learning/i.test(await reviewInput(page).inputValue()));
  await page.locator('.chip-en', { hasText: 'apple' }).click();
  await confirmBtn(page).click();
  await page.locator('.word-card-result .word-text', { hasText: 'apple' }).waitFor({ timeout: 5000 });
  check('learner can confirm the word they meant', true);

  // 3. Silent recording is rejected
  await page.getByRole('button', { name: /تازه ضبط کن/ }).last().click();
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
  await input.fill('سیب');
  await page.getByRole('button', { name: /ثبت/ }).click();
  check('Persian text is rejected in the English editor', await page.getByText('فقط با حروف انگلیسی').isVisible());
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

  // 7. No internet the first time → recording kept, text can be made later
  await ctx.route(/\/models\//, (r) => r.abort());
  await ctx.close();
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

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
