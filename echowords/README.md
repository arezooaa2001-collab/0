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

## Logo and first launch

- **Logo:** the family's hand-drawn sketch (panels C, B, A) redrawn with straight lines, a rainbow outline and equal-size letters, on a night-sky background. `scripts/make-logo.cjs` draws it and renders the launcher icons, `public/logo.png`, `docs/logo.png` and `src/brand/mark.svg`.
- **First launch:** «تبریک! به برنامه AMIR ABC گنجینه صدای من، خوش آمدید» (Congratulations! Welcome to AMIR ABC, My Sound Treasure). It fades away after 3 seconds; «رد کردن» (Skip) appears after 1 second. It is shown only once.

## Google account (Google Drive copy)

In the Android app, Settings → «حساب گوگل» (Google account) → «اتصال به گوگل درایو» (Connect to Google Drive) opens Android's «save to» screen. Choose **Drive**, which is the family's own Google account.

- **What is saved:** a complete copy of the library (words, folders and recordings) is written there at once, including everything saved before connecting.
- **After every change:** the app rewrites the same file by itself about 3 seconds later. Android keeps access to the file through a persistable permission.
- **After uninstalling and reinstalling:** «بازیابی از گوگل درایو» (Restore from Google Drive) reads the file back, and syncing continues to the same file.

No developer account or API key is needed. Android's document picker and the Drive app handle the Google account.

## Android app (APK)

`release/echowords.apk` is the same app as a real Android app (Android 7 and newer).

- **Microphone and camera:** asked with Android's normal «Allow?» dialog. The page is served from a secure address inside the app (`https://appassets.androidplatform.net/`), so recording and the live camera work.
- **Storage:** words, folders and recordings live in the app's own storage. They stay after closing the app or restarting the tablet. Only uninstalling the app or «Clear data» removes them; make a backup from Settings first.
- **Native features:** Android's text-to-speech reads «🔊 تلفظ», Android's speech recognition hears the tutor's questions and live mode, and backups are saved with the system «Save as» screen.
- **Build:** `ECHOWORDS_KS_PASS=… android/build.sh`, using Ubuntu's `android-sdk-platform-23`, `android-sdk-build-tools` and `dalvik-exchange`; Gradle is not needed.
- **Signing key:** never committed. `build.sh` uses `ECHOWORDS_KEYSTORE` and `ECHOWORDS_KS_PASS`, and makes a new key if none exists. Android installs an update over the old app only when both are signed with the same key. With a different key, the old app must be uninstalled first, which deletes its data, so make a backup file before installing.

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
- **Every language, mixed, with no settings.** One entry can mix languages ("cat گربه"). «🔊 تلفظ» (Pronunciation) splits the text by language and reads each part with that language's voice. Speech recognition detects the language itself.
- **Folders.** Make folders («🐶 حیوانات», «🍎 میوه‌ها»…), choose one when saving, move words between folders, rename or delete folders. Deleting a folder never deletes its words: they move to «بدون پوشه» (No folder).
- **Microphone, explained.** The app tells you exactly why the browser refused:
  - the page was opened as a file — Android never allows the microphone there;
  - it is inside another app's viewer;
  - access is blocked for this site;
  - the permission prompt was dismissed.
  Settings has «🎙️ اجازه میکروفون» (Allow microphone), which asks the browser directly.
- **«🤖 معلم مهربان» (Kind Teacher), the AI tutor.** Text only: type a message (or use the keyboard's own voice typing).
  - **Translation, with no key at all (also in the APK):** write the text, then «/», then the language: `سلام دوست من / انگلیسی`. (The older form «متن» را به «زبان» ترجمه کن also works.) It is translated by Google Translate's free public endpoint (no account, no key) into English, Persian, French, Chinese, Japanese, Hindi, Arabic, German, Spanish, Italian, Turkish, Russian, Korean, Portuguese or Urdu. The result is shown big, with a Latin-letter reading for Japanese, Chinese, Hindi, Russian and Korean, «🔊 تلفظ» in that language's voice, and «💾» to save it. Nothing else is translated: other messages are a normal conversation.
  - **Claude as the tutor, inside the app (also the APK):** Settings → «هوش مصنوعی» → «Claude (Anthropic)» (the default choice) → paste a Claude API key from console.anthropic.com. The tutor and the game studio then use Claude through the Claude API with the official TypeScript SDK (`@anthropic-ai/sdk`), with no claude.ai page.
    - Model `claude-opus-5-5` by default (editable, e.g. `claude-haiku-5-5` to pay less).
    - Tutor answers use `effort: "low"` (a child's chat, answered sooner). Games are streamed with `effort: "high"` and `max_tokens` 64000, so the characters written so far show and a long game never hits a request time limit.
    - Server-side fallbacks are on (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`): if the model declines for safety reasons, the API retries on a fallback model. If the whole chain still declines, the child sees a kind «ask something else» message instead of an empty answer. A model that refuses an optional setting (effort, fallbacks) gets the request again without it.
    - Requests go through the WebView's own fetch; in the APK, if that cannot connect, they are sent again through Android's own HTTPS.
    - The API is paid per use (prepaid credit on the Anthropic account; a claude.ai subscription does not cover it). The key is stored only on the device.
  - **Free conversation:** the tutor answers anything naturally, like a kind older friend (science, animals, math, stories, jokes…), in the child's language, without adding translations nobody asked for. This needs an AI: Claude inside claude.ai (no key), or a parent's Gemini (free key from Google AI Studio) or ChatGPT key, stored only on the device. No free AI service without a key exists any more (the last keyless one now requires a key, 2026), and an AI small enough to run on a tablet would be slow and poor in Persian.
  - **«/ABC»** shows two options:
    - **«🧑‍💻 کدنویسی با هوش مصنوعی» (AI coding):** the child describes a game and the AI writes it as one complete HTML file. It runs right there in a sealed frame (`sandbox="allow-scripts"`), with no access to the app, its words or the internet. The game can be restarted, played full screen, changed («✏️ تغییر بده» sends the current code and the change), saved to «بازی‌های من», or saved as an .html file. The AI is told to make the game self-contained, work with touch and keyboard, use Persian on-screen text, and be suitable for a 9-year-old.
    - **«/Prompt Code»** at the end of a request (in the studio or in the chat): the AI first turns the child's words into an expert game-design brief (shown under «دستور حرفه‌ای‌شده»), and the game is built from that.
    - **«🎮 بازی‌های من» (My games):** saved games (up to 30, on the device) to play again or delete.
    - Building needs an AI, like free conversation: a Claude API key (streamed), Claude inside claude.ai, or a Gemini/ChatGPT key. One build may take 1–5 minutes (time limit 8 minutes).
  - **Never stuck:** one question ends within 32 seconds, whatever happens. While waiting it shows the step it is on (which server, through Android or the browser). In the APK, if Android's own networking cannot connect, the WebView's network is tried too.
  - **Built-in dictionary:** when no AI can be reached (no internet, filtering, no key yet), simple word questions («سیب به انگلیسی چی میشه؟», «cat یعنی چی») are still answered from about 304 English–Persian words inside the app.
  - **«📋 کپی گزارش» (Copy report):** after a failure, copies the step-by-step log (version, server, HTTP status, timings; never the key) to send for help.
- **Inside Claude (claude.ai page).** `release/echowords-claude.html` is the same app as page content for claude.ai. There, words and folders are also stored in the learner's private Claude storage, so they come back after the browser is cleared or on another device. Microphone and live camera are not available inside claude.ai; typing, keyboard voice-typing, photos, pronunciation and the tutor all work.
- **Pronunciation for every word.** Every saved word or sentence has a «🔊 تلفظ» (Pronunciation) button, played by the device's own voice in the word's language. The word is also spoken once right after saving. If the device has no voice for that language, the app says how to add one: Android settings → Google Text-to-speech.
- **Languages.** In Settings: Persian, English, French, Chinese, Japanese and Hindi, or «همه با هم» (all together); English only by default. The menus stay Persian. Typing picks the language from the letters. Each language's text is checked against its own alphabet. Speech recognition uses the English-only Whisper model when only English is on, and one multilingual model otherwise.
- **Small and tidy.** Recordings are made at voice quality (32 kbit/s, about 3 KB per second). Automatic backup files are made at most weekly (or after 25 new words). Library cards are compact: word, «🔊 تلفظ», «▶️ صدای خودم», and small edit/delete icons. The library can be filtered by language.
- **Type and save.** Type an English word or sentence and press «✅ تایید و ذخیره» (Confirm and save), or the keyboard's Enter. It is saved at once in «کلمه‌ها و جمله‌هایم» (My words and sentences); no recording is needed. The child can then say it (optional), or later tap «🎤 صدای خودم را اضافه کن» (Add my voice) on the word card. A word gets its recording once, and that recording never changes.
- **Works where the page has limited powers.** Saving does not need `crypto.subtle` or `crypto.randomUUID`, which are missing on non-https pages; there are plain-JS fallbacks. If IndexedDB is blocked, words go to localStorage, and they move back into IndexedDB once it works again.
- **Fast saving, on every phone.** Speech recognition (Whisper) runs in a background thread (a Web Worker), so saving the voice and the text never waits for it; a save takes a fraction of a second even while recognition is still working. Pages that cannot start a worker run it in the page as before. The heavy Google Drive copy is written only after 15 quiet seconds, or at once when the app goes to the background, never in the middle of saving words. Backup checks after a save run in the background too.
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
