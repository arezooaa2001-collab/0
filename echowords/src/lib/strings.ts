// All user-facing text, in friendly Persian for a 9-year-old learner.
// The words being learned are always English; only the interface is Persian.

export const t = {
  appName: 'گنجینه صدای من',
  appTagline: 'کلمه‌های انگلیسی را با صدای خودت ضبط کن و هر وقت خواستی دوباره گوش بده',

  authWait: 'یک لحظه صبر کن…',

  // Tabs
  tabRecord: 'ضبط',
  tabLibrary: 'کلمه‌های من',
  tabSettings: 'تنظیمات',

  // Record screen
  recordTitle: 'یک کلمه انگلیسی بگو! 🎤',
  hintLabel: 'می‌خواهی چه کلمه‌ای بگویی؟ (اختیاری، به انگلیسی)',
  hintPlaceholder: 'e.g. apple',
  hintHelp: 'اگر کلمه را بنویسی، برنامه بهتر می‌فهمد چی گفتی.',
  pressToRecord: 'دکمه را بزن و بگو',
  record: 'ضبط',
  requestingMic: 'داریم میکروفون را روشن می‌کنیم…',
  allowMicHelp: 'اگر پیامی آمد، روی «اجازه» (Allow) بزن.',
  recording: 'دارم گوش می‌دهم…',
  paused: 'مکث',
  stop: 'تمام',
  pause: 'مکث',
  resume: 'ادامه',
  cancel: 'لغو',
  listenToMine: 'صدای خودم را گوش بده',
  recordAgain: 'دوباره ضبط کن',
  save: 'ذخیره کن',
  confirmSave: 'تایید و ذخیره',
  reviewTitle: 'درسته؟ 👀',
  reviewHelp: 'به صدایت گوش بده و نوشته را ببین. اگر درست است «تایید و ذخیره» را بزن.',
  reviewTextLabel: 'کلمه یا جمله‌ای که گفتی (به انگلیسی)',
  reviewTypeHere: 'اینجا به انگلیسی بنویس',
  reviewNoModel: 'الان نتوانستم بنویسم چی گفتی (بار اول اینترنت لازم است). می‌توانی خودت بنویسی، یا همین‌طوری ذخیره کنی و بعداً «دوباره بنویس» را بزنی.',
  reviewNoTextNote: 'اگر الان ننویسی، صدایت ذخیره می‌شود و بعداً می‌توانی بنویسی.',
  tapToUse: 'برای نوشتن، رویش بزن:',
  discardConfirm: 'این ضبط ذخیره نشود و پاک شود؟',
  yesDiscard: 'آره، پاکش کن',
  takeReady: 'ضبط شد! اول گوش بده، اگر خوب بود ذخیره کن.',
  maxLengthReached: 'یک دقیقه تمام شد، ضبط خودش ایستاد.',
  stoppedInBackground: 'چون از برنامه بیرون رفتی، ضبط ایستاد. صدایی که گرفته شده نگه داشته شد.',
  micLost: 'میکروفون قطع شد، ضبط ایستاد.',

  // Saving
  saved: 'آفرین! صدایت در گنجینه ذخیره شد 🎉',
  saveFailed: 'ذخیره نشد. شاید جای دستگاه پر است. دوباره امتحان کن.',
  retry: 'دوباره امتحان کن',

  // Transcription result
  greatYouSaid: 'آفرین! 🌟 تو گفتی:',
  notSure: 'مطمئن نیستم چی گفتی 🤔',
  maybeYouSaid: 'شاید گفتی:',
  yesCorrect: 'آره، درسته',
  writeItMyself: 'خودم می‌نویسم',
  tryAgainTranscribe: 'دوباره بنویس',
  recordNewOne: 'یک کلمه تازه ضبط کن',
  reasonEmpty: 'صدایی که بشود به انگلیسی نوشت نشنیدم.',
  reasonNotEnglish: 'به نظر رسید انگلیسی نبود. فقط انگلیسی بگو.',
  retryOrType: 'می‌توانی دوباره ضبط کنی یا خودت کلمه را بنویسی. صدایت ذخیره شده است.',
  transcribeFailed: 'الان نتوانستم صدا را به متن تبدیل کنم. صدایت سالم ذخیره شده؛ بعداً دوباره امتحان کن.',
  transcribing: 'دارم می‌نویسم چی گفتی…',
  editedByYou: 'نوشته شده توسط خودت ✍️',

  // Editor
  editLabel: 'کلمه یا جمله انگلیسی',
  editSave: 'ثبت',
  editCancel: 'بی‌خیال',
  onlyEnglish: 'لطفاً فقط با حروف انگلیسی بنویس.',
  emptyText: 'چیزی ننوشتی!',
  tooLong: 'خیلی طولانی شد. کوتاه‌ترش کن.',

  reasonMismatch: 'چیزی که شنیدم با کلمه‌ای که نوشته بودی یکی نبود.',
  useMyHint: 'همان که نوشته بودم',
  youWrote: 'تو نوشته بودی:',
  modelDownloading: (p: string) => `بار اول: دارم یاد می‌گیرم صدای انگلیسی را بفهمم… ${p}`,
  modelNeedsInternet: 'بار اول برای فهمیدن صدا اینترنت لازم است. صدایت ذخیره شده؛ وقتی اینترنت وصل شد «دوباره بنویس» را بزن.',
  savingTitle: 'دارم کلمه‌ات را در گنجینه می‌گذارم…',

  // Storage & backup
  storageTitle: 'گنجینه روی همین دستگاه 💾',
  storageInfo: (n: number, mb: string) => `${fa(n)} کلمه · ${mb} مگابایت`,
  storageSafe: 'مرورگر قول داده این اطلاعات را خودش پاک نکند ✅',
  storageWarn: 'اگر «پاک کردن اطلاعات مرورگر» را بزنی، کلمه‌ها پاک می‌شوند. هر چند وقت یک بار پشتیبان بگیر.',
  backupTitle: 'پشتیبان‌گیری',
  backupHelp: 'یک فایل می‌سازد که همه کلمه‌ها و صداها داخلش است. می‌توانی آن را نگه داری یا روی دستگاه دیگر باز کنی.',
  backupExport: 'ساختن فایل پشتیبان',
  backupImport: 'برگرداندن از فایل پشتیبان',
  backupDone: 'فایل پشتیبان ساخته شد 👍',
  backupRestored: (added: number, skipped: number) => `${fa(added)} کلمه برگشت${skipped ? ` (${fa(skipped)} تا تکراری یا خراب بود)` : ''}.`,
  backupBad: 'این فایل، فایل پشتیبان این برنامه نیست.',

  // Library
  libraryTitle: 'گنجینه کلمه‌های من 📚',
  searchPlaceholder: 'جست‌وجوی کلمه…',
  emptyLibrary: 'هنوز کلمه‌ای نداری. برو به «ضبط» و اولین کلمه‌ات را بگو!',
  noResults: 'چیزی پیدا نشد.',
  playMine: 'صدای خودم',
  standardPronunciation: 'تلفظ استاندارد',
  standardPronunciationNote: 'این صدای ماشین است، نه صدای تو.',
  needsText: 'متن لازم دارد',
  waitingText: 'در انتظار نوشتن',
  edit: 'ویرایش',
  delete: 'پاک کردن',
  deleteConfirm: 'این کلمه و صدای ضبط‌شده‌اش برای همیشه پاک شوند؟',
  yesDelete: 'آره، پاک کن',
  no: 'نه',
  deleted: 'پاک شد.',
  favorite: 'ستاره',
  refresh: 'تازه کردن',
  loadFailed: 'فهرست کلمه‌ها باز نشد. صفحه را دوباره باز کن.',
  audioLoadFailed: 'صدا باز نشد. دوباره بزن.',
  audioChanged: 'هشدار: فایل صدا با نسخه اصلی یکی نیست.',
  wordsCount: (n: number) => `${fa(n)} کلمه`,
  favoritesOnly: 'فقط ستاره‌دارها',

  // Settings
  settingsTitle: 'تنظیمات ⚙️',
  accentTitle: 'لهجه تلفظ استاندارد',
  accentHelp: 'دکمه «تلفظ استاندارد» با این لهجه کلمه را می‌خواند.',
  accentAuto: 'خودکار',
  accentUS: 'آمریکایی 🇺🇸',
  accentUK: 'بریتانیایی 🇬🇧',
  privacyTitle: 'حریم خصوصی',
  privacyBody:
    'همه صداها و کلمه‌هایت فقط روی همین دستگاه ذخیره می‌شوند. به هیچ سایتی فرستاده نمی‌شوند و حساب کاربری لازم نیست. صدای اصلی تو هرگز تغییر داده نمی‌شود.',
  englishOnlyTitle: 'فقط انگلیسی',
  englishOnlyBody:
    'این برنامه فقط برای یادگرفتن انگلیسی است. صدا فقط به انگلیسی نوشته می‌شود و ترجمه نمی‌شود.',

  // Errors (microphone)
  errInsecure: 'میکروفون فقط روی آدرس امن (https) کار می‌کند.',
  errUnsupported: 'این مرورگر ضبط صدا را پشتیبانی نمی‌کند. Chrome را امتحان کن.',
  errDenied: 'اجازه میکروفون داده نشد. از تنظیمات مرورگر، میکروفون را برای این برنامه روشن کن.',
  errNoMic: 'میکروفونی پیدا نشد.',
  errInUse: 'میکروفون دست یک برنامه دیگر است. آن را ببند و دوباره امتحان کن.',
  errRecorder: 'ضبط با مشکل روبه‌رو شد. دوباره امتحان کن.',
  errTooShort: 'خیلی کوتاه بود! دکمه را بزن، کلمه را بگو، بعد «تمام» را بزن.',
  errSilent: 'صدایی نشنیدم. نزدیک‌تر به دستگاه و بلندتر بگو.',
  errEmpty: 'صدایی ضبط نشد. دوباره امتحان کن.',
  errInvalid: 'فایل صدا خراب شد. لطفاً دوباره ضبط کن.',
  errGeneric: 'یک مشکل پیش آمد. دوباره امتحان کن.',


  close: 'بستن',
  ok: 'باشه',
} as const;

const faFmt = new Intl.NumberFormat('fa-IR', { useGrouping: false });
export function fa(n: number): string {
  return faFmt.format(n);
}
