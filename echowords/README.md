# گنجینه صدای من — EchoWords

This app helps a 9-year-old learn English. The child records English words with their own voice, sees what they said written **in English**, and replays their recordings any time.

**Nothing to set up.** There is no account, no cloud, and no server. Everything is saved on the device itself.

![Screens](docs/screens-1.png)

## Use it

Open `release/echowords.html` in Chrome. It is the whole app in one file. On an Android tablet, open the file from the Downloads folder with Chrome; if Chrome will not open it, put it on any website address instead.

- **First transcription:** the browser downloads the English speech model once (about 40 MB, needs internet). After that, transcription works offline.
- **No internet the first time:** the recording is still saved. The child presses «دوباره بنویس» (Write again) later.
- **Keeping words safe for years:**
  - Words stay in the browser's storage on the device, and the app asks the browser to keep them permanently.
  - At start-up the app tests whether storage really works. If it doesn't (for example inside an in-app file viewer or a private tab), a red warning appears. The app keeps working for that visit and saves a backup file after every save.
  - Otherwise it saves a backup file (`echowords-backup-….json`) in Downloads by itself: on the first save, then at most once a day when something changed, or at once after 10 new words.
  - If the app ever opens empty (browser data cleared, new device, a new copy of the file), a «برگرداندن از فایل پشتیبان» (Restore from backup) card brings everything back.
  - Settings shows when the last backup was made. Keeping a copy of the backup file somewhere else (Telegram Saved Messages, Google Drive) protects against a lost or broken tablet.

## What it does

- **Interface:** Persian, right-to-left, kid-friendly (big buttons, emoji, simple wording).
- **English only.** Speech is transcribed with Whisper `tiny.en`, an English-only model, running inside the browser. There is no translation. Text in other scripts is rejected.
- **Real microphone recording:**
  - live timer and level meter, pause/resume, cancel, preview and re-record;
  - silent, too-short or broken recordings are rejected;
  - the microphone is always released afterwards.
- **Original voice preserved:**
  - the exact recorded bytes are stored, with a SHA-256 fingerprint;
  - the fingerprint is checked after saving, on playback, and when restoring a backup;
  - «تلفظ استاندارد» (Standard pronunciation) is a separate, clearly labelled machine voice.
- **Pronunciation for every word.** Every saved word or sentence has a «🔊 تلفظ» (Pronunciation) button, played by the device's own voice in the word's language. The word is also spoken once right after saving. If the device has no voice for that language, the app says how to add one: Android settings → Google Text-to-speech.
- **Languages.** In Settings: Persian, English, French, Chinese, Japanese and Hindi, or «همه با هم» (all together); English only by default. The menus stay Persian. Typing picks the language from the letters. Each language's text is checked against its own alphabet. Speech recognition uses the English-only Whisper model when only English is on, and one multilingual model otherwise.
- **Small and tidy.** Recordings are made at voice quality (32 kbit/s, about 3 KB per second). Automatic backup files are made at most weekly (or after 25 new words). Library cards are compact: word, «🔊 تلفظ», «▶️ صدای خودم», and small edit/delete icons. The library can be filtered by language.
- **Type and save.** Type an English word or sentence and press «✅ تایید و ذخیره» (Confirm and save), or the keyboard's Enter. It is saved at once in «کلمه‌ها و جمله‌هایم» (My words and sentences); no recording is needed. The child can then say it (optional), or later tap «🎤 صدای خودم را اضافه کن» (Add my voice) on the word card. A word gets its recording once, and that recording never changes.
- **Works where the page has limited powers.** Saving does not need `crypto.subtle` or `crypto.randomUUID`, which are missing on non-https pages; there are plain-JS fallbacks. If IndexedDB is blocked, words go to localStorage, and they move back into IndexedDB once it works again.
- **Confirm before saving.** After recording, the text box and the «✅ تایید و ذخیره» (Confirm and save) button appear immediately. Recognition fills the box in the background, but the child never has to wait for it. If the model download stalls (no progress for 20 s), the app stops waiting and says so. Nothing is saved until confirm is pressed. After saving, a button opens «کلمه‌ها و جمله‌هایم» (My words and sentences).
- **No guessing.** If nothing English was heard, or the result differs from the word the child typed as a hint, the app asks «مطمئن نیستم چی گفتی 🤔» (I'm not sure what you said). The child can then:
  - accept what was heard,
  - use the word they typed,
  - type the word themselves (English letters only),
  - record again.

## Code

| | |
|---|---|
| `src/lib/useRecorder.ts` | getUserMedia + MediaRecorder; error, background and unmount handling |
| `src/lib/db.ts` | IndexedDB library; audio and details are written in one transaction; audio fields can never be updated |
| `src/lib/asr.ts` | On-device Whisper through transformers.js; decodes a temporary 16 kHz copy |
| `src/lib/stt.ts` | Decides when a result can be trusted |
| `src/lib/backup.ts` | Backup and restore, with fingerprint checks |

```bash
npm install
npm run dev             # development server
npm test                # unit tests
npm run build:single    # → release/echowords.html
```

`e2e/run.cjs` drives Chromium's fake microphone against the built file and checks recording, transcription, the hint mismatch, silence rejection, persistence after restart, replay, editing, backup/restore and the offline first run. The test machine cannot reach Hugging Face, so it serves the library and a Whisper model locally (see the comment at the top of the file).
