// End-to-end test against a LOCAL Supabase stack (supabase start) and the PocketSphinx test double.
// Chromium records from a WAV file through its fake microphone device: the app code path is the
// same real getUserMedia → MediaRecorder path used on a phone.
//
//   node e2e/run.cjs            (expects vite on :5173, supabase on :54321, fake-deepgram on :8787)
const { chromium, devices } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');

const APP = process.env.APP_URL || 'http://localhost:5173';
const SB_URL = 'http://127.0.0.1:54321';
const ANON = process.env.SB_ANON;
const SERVICE = process.env.SB_SERVICE;
const SPEECH_WAV = process.env.SPEECH_WAV;
const SILENT_WAV = process.env.SILENT_WAV;
const OUT = process.env.OUT_DIR || path.join(__dirname, '..', 'test-results');
fs.mkdirSync(OUT, { recursive: true });

const admin = createClient(SB_URL, SERVICE, { auth: { persistSession: false } });
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

async function launch(wav) {
  return chromium.launch({
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${wav}`, '--autoplay-policy=no-user-gesture-required'],
  });
}

async function newPage(browser, storageState) {
  const ctx = await browser.newContext({ ...devices['Pixel 7'], permissions: ['microphone'], storageState, locale: 'fa-IR', reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__streams = [];
    if (!navigator.mediaDevices) return;
    const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (c) => {
      const s = await orig(c);
      window.__streams.push(s);
      return s;
    };
  });
  page.on('pageerror', (e) => console.log('pageerror:', e.message));
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

(async () => {
  const email = `kid${Date.now()}@example.com`;
  const password = 'secret123';
  let browser = await launch(SPEECH_WAV);
  let { ctx, page } = await newPage(browser);

  // 1. Sign up
  await page.goto(APP);
  await page.screenshot({ path: `${OUT}/01-login.png` });
  await page.getByText('حساب نداری؟').click();
  await page.getByLabel('ایمیل').fill(email);
  await page.getByLabel('رمز عبور').fill(password);
  await page.getByRole('button', { name: 'ساختن حساب تازه' }).click();
  await page.getByText('یک کلمه انگلیسی بگو').waitFor({ timeout: 15000 });
  check('sign up lands on the record screen', true);
  await page.screenshot({ path: `${OUT}/02-record.png` });

  // 2. Record with the real recorder pipeline
  const { bars, timer } = await record(page, 3500);
  check('timer counts real elapsed time', /۰:۰[۳۴]/.test(timer), timer);
  check('level meter reacts to captured audio', Math.max(...bars) > 20, `max bar ${Math.max(...bars).toFixed(1)}%`);
  await page.getByText('ضبط شد!').waitFor({ timeout: 10000 });
  const tracksEnded = await page.evaluate(() => window.__streams.every((s) => s.getTracks().every((t) => t.readyState === 'ended')));
  check('microphone released after stop', tracksEnded);
  await page.screenshot({ path: `${OUT}/03-preview.png` });

  await page.getByRole('button', { name: /صدای خودم را گوش بده/ }).click();
  await page.waitForTimeout(400);
  check('preview plays my recording', (await page.getByRole('button', { name: /صدای خودم را گوش بده/ }).getAttribute('aria-pressed')) === 'true');

  // 3. Save → upload → verify → transcribe
  await page.getByRole('button', { name: /ذخیره کن/ }).click();
  await page.locator('.word-card-result').waitFor({ timeout: 20000 });
  await page.locator('.word-card-result .word-text, .word-card-result .state-unclear, .word-card-result .state-failed').first().waitFor({ timeout: 60000 });
  await page.screenshot({ path: `${OUT}/04-result.png` });

  const { data: users } = await admin.auth.admin.listUsers();
  const user = users.users.find((u) => u.email === email);
  const { data: rows } = await admin.from('words').select('*').eq('user_id', user.id);
  check('one word row saved in the cloud database', rows.length === 1);
  const row = rows[0];
  check('transcription ran on the server', ['done', 'unclear'].includes(row.stt_status), `${row.stt_status} heard=${JSON.stringify(row.stt_transcript)} provider=${row.stt_provider}`);
  const { data: obj } = await admin.storage.from('recordings').download(row.audio_path);
  const cloudBytes = Buffer.from(await obj.arrayBuffer());
  check('cloud audio is byte-identical to the recording (sha256)', sha(cloudBytes) === row.audio_sha256, `${cloudBytes.length} bytes ${row.audio_mime}`);
  check('audio path is inside the user folder', row.audio_path.startsWith(`${user.id}/`), row.audio_path);
  const storageState = await ctx.storageState();
  await browser.close();

  // 4. "Close the app" → new browser process, same saved session → library → replay many times
  browser = await launch(SILENT_WAV);
  ({ ctx, page } = await newPage(browser, storageState));
  await page.goto(APP);
  await page.getByRole('button', { name: /کلمه‌های من/ }).click();
  await page.locator('.word-card').first().waitFor({ timeout: 15000 });
  check('session persisted after restart', true);
  const play = page.locator('.word-card .btn-play').first();
  let plays = 0;
  for (let i = 0; i < 3; i++) {
    await play.click();
    await page.waitForTimeout(300);
    if ((await play.getAttribute('aria-pressed')) === 'true') plays++;
    await play.click(); // stop
  }
  check('original recording replays repeatedly from the cloud', plays === 3, `${plays}/3`);
  await page.screenshot({ path: `${OUT}/05-library.png` });

  // 5. Manual correction keeps the audio unchanged
  const editBtn = page.getByRole('button', { name: /ویرایش|خودم می‌نویسم/ }).first();
  await editBtn.click();
  const input = page.locator('.editor input');
  await input.fill('سیب');
  await page.getByRole('button', { name: /ثبت/ }).click();
  check('Persian text is rejected in the English editor', await page.getByText('فقط با حروف انگلیسی').isVisible());
  await input.fill('I am learning English.');
  await page.getByRole('button', { name: /ثبت/ }).click();
  await page.locator('.word-text', { hasText: 'I am learning English.' }).waitFor({ timeout: 10000 });
  const { data: after } = await admin.from('words').select('*').eq('id', row.id).single();
  check('manual correction saved', after.transcript === 'I am learning English.' && after.transcript_edited);
  check('audio untouched by correction', after.audio_sha256 === row.audio_sha256 && after.audio_path === row.audio_path);
  await page.screenshot({ path: `${OUT}/06-edited.png` });

  // 6. Silent recording is rejected (fake mic now plays a silent file)
  await page.locator('.tabbar button').first().click();
  await record(page, 1500);
  await page.getByText('صدایی نشنیدم').waitFor({ timeout: 10000 });
  check('silent recording is not saved', true);
  await page.screenshot({ path: `${OUT}/07-silent.png` });
  await browser.close();

  // 7. Offline save → kept in device outbox → uploads when back online
  browser = await launch(SPEECH_WAV);
  ({ ctx, page } = await newPage(browser, storageState));
  await page.goto(APP);
  await page.getByText('یک کلمه انگلیسی بگو').waitFor();
  await record(page, 2500);
  await page.getByText('ضبط شد!').waitFor();
  await ctx.setOffline(true);
  await page.getByRole('button', { name: /ذخیره کن/ }).click();
  await page.getByText('صدایت در دستگاه محفوظ است').waitFor({ timeout: 20000 });
  check('offline save keeps the recording on the device', true);
  await page.screenshot({ path: `${OUT}/08-offline.png` });
  await page.reload().catch(() => undefined); // simulate a crash/close while offline (page may fail to load)
  await ctx.setOffline(false);
  await page.goto(APP);
  await page.waitForTimeout(8000);
  const { data: rows2 } = await admin.from('words').select('id').eq('user_id', user.id);
  check('pending recording uploaded automatically after reopening online', rows2.length === 2, `${rows2.length} rows`);
  await browser.close();

  // 8. Privacy: another account sees nothing
  const other = createClient(SB_URL, ANON, { auth: { persistSession: false } });
  await other.auth.signUp({ email: `other${Date.now()}@example.com`, password });
  const { data: theirs } = await other.from('words').select('*');
  const { data: stolen, error: stealErr } = await other.storage.from('recordings').download(row.audio_path);
  check('other users cannot read my words (RLS)', theirs.length === 0);
  check('other users cannot download my audio', !stolen && !!stealErr);
  const { error: overwriteErr } = await other.storage.from('recordings').upload(row.audio_path, Buffer.from('x'), { upsert: true, contentType: 'audio/webm' });
  check('other users cannot overwrite my audio', !!overwriteErr);

  // 9. Owner cannot overwrite the original either, and audio metadata is immutable
  const me = createClient(SB_URL, ANON, { auth: { persistSession: false } });
  await me.auth.signInWithPassword({ email, password });
  const { error: ownOverwrite } = await me.storage.from('recordings').upload(row.audio_path, Buffer.from('x'), { upsert: true, contentType: 'audio/webm' });
  check('even the owner cannot overwrite an original recording', !!ownOverwrite, ownOverwrite?.message);
  const { error: immut } = await me.from('words').update({ audio_sha256: '0'.repeat(64) }).eq('id', row.id);
  check('audio metadata is immutable in the database', !!immut, immut?.message);

  // 10. Delete removes both file and row
  browser = await launch(SILENT_WAV);
  ({ ctx, page } = await newPage(browser, storageState));
  await page.goto(APP);
  await page.getByRole('button', { name: /کلمه‌های من/ }).click();
  await page.locator('.word-card').first().waitFor();
  const n0 = await page.locator('.word-card').count();
  await page.getByRole('button', { name: /پاک کردن/ }).first().click();
  await page.getByRole('button', { name: 'آره، پاک کن' }).click();
  await page.waitForTimeout(2500);
  const n1 = await page.locator('.word-card').count();
  const { data: rows3 } = await admin.from('words').select('id, audio_path').eq('user_id', user.id);
  const { data: files } = await admin.storage.from('recordings').list(user.id);
  check('delete removes the word from the library', n1 === n0 - 1 && rows3.length === 1);
  check('delete removes the audio file from storage', files.length === 1, `${files.length} files left`);
  await page.screenshot({ path: `${OUT}/09-after-delete.png` });
  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
