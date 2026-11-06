// All user-facing text, in friendly Persian for a 9-year-old learner.
// The words being learned are always English; only the interface is Persian.

export const t = {
  appName: 'گنجینه صدای من',
  appTagline: 'کلمه‌های انگلیسی را با صدای خودت ضبط کن و هر وقت خواستی دوباره گوش بده',

  // Setup
  setupTitle: 'برنامه هنوز به ابر وصل نشده',
  setupBody:
    'یک بزرگ‌تر باید آدرس و کلید عمومی Supabase را در فایل ‎.env‎ بنویسد. راهنمای کامل در فایل README هست.',

  // Auth
  authHello: 'سلام! 👋',
  authParentNote: 'برای ساختن حساب از مامان یا بابا کمک بگیر.',
  email: 'ایمیل',
  password: 'رمز عبور',
  passwordHint: 'حداقل ۶ حرف',
  login: 'ورود',
  signup: 'ساختن حساب تازه',
  haveAccount: 'حساب داری؟ وارد شو',
  noAccount: 'حساب نداری؟ یکی بساز',
  signupCheckEmail: 'حساب ساخته شد! ایمیل را باز کن و روی لینک تأیید بزن، بعد وارد شو.',
  authWait: 'یک لحظه صبر کن…',
  logout: 'خروج از حساب',
  logoutConfirm: 'مطمئنی می‌خواهی از حساب خارج شوی؟ کلمه‌هایت در ابر می‌مانند.',

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
  takeReady: 'ضبط شد! اول گوش بده، اگر خوب بود ذخیره کن.',
  maxLengthReached: 'یک دقیقه تمام شد، ضبط خودش ایستاد.',
  stoppedInBackground: 'چون از برنامه بیرون رفتی، ضبط ایستاد. صدایی که گرفته شده نگه داشته شد.',
  micLost: 'میکروفون قطع شد، ضبط ایستاد.',

  // Saving
  savingTitle: 'دارم کلمه‌ات را در گنجینه می‌گذارم…',
  stageLocal: 'نگه‌داری امن در دستگاه',
  stageUpload: 'فرستادن صدا به ابر',
  stageVerify: 'بررسی سالم رسیدن صدا',
  stageRecord: 'ثبت در فهرست کلمه‌ها',
  stageTranscribe: 'نوشتن چیزی که گفتی',
  savedToCloud: 'صدایت سالم در ابر ذخیره شد ☁️',
  saveFailed: 'ارسال به ابر انجام نشد. صدایت در دستگاه محفوظ است و دوباره امتحان می‌کنیم.',
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
  reasonLowConfidence: 'صدا کمی نامفهوم بود.',
  reasonNoSpeech: 'به نظر رسید فقط سروصدا بود.',
  retryOrType: 'می‌توانی دوباره ضبط کنی یا خودت کلمه را بنویسی. صدایت ذخیره شده است.',
  transcribeFailed: 'الان نتوانستم صدا را به متن تبدیل کنم. صدایت سالم ذخیره شده؛ بعداً دوباره امتحان کن.',
  transcribing: 'دارم می‌نویسم چی گفتی…',
  howSure: 'اطمینان دستگاه:',
  editedByYou: 'نوشته شده توسط خودت ✍️',

  // Editor
  editLabel: 'کلمه یا جمله انگلیسی',
  editSave: 'ثبت',
  editCancel: 'بی‌خیال',
  onlyEnglish: 'لطفاً فقط با حروف انگلیسی بنویس.',
  emptyText: 'چیزی ننوشتی!',
  tooLong: 'خیلی طولانی شد. کوتاه‌ترش کن.',

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
  notInCloudYet: 'هنوز به ابر نرسیده',
  uploading: 'در حال ارسال…',
  waitingForInternet: 'منتظر اینترنت…',
  refresh: 'تازه کردن',
  loadFailed: 'فهرست کلمه‌ها باز نشد. اینترنت را بررسی کن.',
  audioLoadFailed: 'صدا باز نشد. اینترنت را بررسی کن و دوباره بزن.',
  audioChanged: 'هشدار: فایل صدا با نسخه اصلی یکی نیست.',
  wordsCount: (n: number) => `${fa(n)} کلمه`,
  favoritesOnly: 'فقط ستاره‌دارها',

  // Settings
  settingsTitle: 'تنظیمات ⚙️',
  accentTitle: 'لهجه انگلیسی',
  accentHelp: 'برنامه با این لهجه به صدایت گوش می‌دهد و تلفظ استاندارد را پخش می‌کند.',
  accentAuto: 'خودکار',
  accentUS: 'آمریکایی 🇺🇸',
  accentUK: 'بریتانیایی 🇬🇧',
  account: 'حساب کاربری',
  privacyTitle: 'حریم خصوصی',
  privacyBody:
    'صداها و کلمه‌هایت فقط برای حساب خودت در ابر خصوصی ذخیره می‌شوند. هیچ‌کس دیگری نمی‌تواند آن‌ها را ببیند یا بشنود. صدای اصلی تو هرگز تغییر داده نمی‌شود.',
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
  errOffline: 'اینترنت وصل نیست.',

  // Auth errors
  errBadLogin: 'ایمیل یا رمز اشتباه است.',
  errUserExists: 'این ایمیل قبلاً حساب دارد. وارد شو.',
  errWeakPassword: 'رمز باید حداقل ۶ حرف باشد.',
  errEmailNotConfirmed: 'اول ایمیل را تأیید کن.',

  close: 'بستن',
  ok: 'باشه',
} as const;

const faFmt = new Intl.NumberFormat('fa-IR', { useGrouping: false });
export function fa(n: number): string {
  return faFmt.format(n);
}
