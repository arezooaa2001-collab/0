# اپ اندروید «پارکور اوج»

این پوشه یک پروژهٔ اندروید سادهٔ جاوا است: یک Activity با یک WebView تمام‌صفحه که فایل
`parkour/dist/index.html` را از داخل APK اجرا می‌کند. صفحه از طریق `WebViewAssetLoader` در آدرس
`https://appassets.androidplatform.net/assets/index.html` باز می‌شود، پس origin واقعی https دارد:
`localStorage` ماندگار است و `fetch()` به `https://api.anthropic.com` با CORS عادی کار می‌کند.

- شناسهٔ بسته: `com.oujparkour.game` — نسخه: `1.0.0` (versionCode 1)
- اندروید ۷ (API 24) به بالا، target/compile SDK 35، فقط افقی (`sensorLandscape`)، تمام‌صفحهٔ immersive
- مجوزها: `INTERNET` و `VIBRATE`

## ساخت دوباره

اول بازی را بسازید، بعد APK را:

```bash
cd parkour && npm ci && npm run build && cd ..
bash parkour/android/build-apk.sh
```

خروجی: `parkour/release/OujParkour.apk`

اسکریپت تکرارپذیر است و در یک کانتینر لینوکس تازه این کارها را می‌کند:

1. اگر Android SDK نباشد، cmdline-tools را از dl.google.com در `$HOME/android-sdk` نصب می‌کند
   (اگر `ANDROID_HOME` یا `ANDROID_SDK_ROOT` تنظیم شده باشد از همان استفاده می‌کند)، مجوزها را
   می‌پذیرد و `platforms;android-35`، `build-tools;35.0.0` و `platform-tools` را نصب می‌کند.
2. `parkour/dist/index.html` را در `app/src/main/assets/` کپی می‌کند. اگر وجود نداشته باشد با یک
   هشدار بزرگ قرمز، صفحهٔ آزمایشی `test-placeholder.html` (مثلث چرخان WebGL + شمارندهٔ localStorage)
   را بسته‌بندی می‌کند.
3. بار اول یک کلید امضا در `parkour/android/keystore/` می‌سازد (در git نیست).
4. با Gradle نسخهٔ release را می‌سازد (امضای v1 و v2، بدون minify) و امضا را با `apksigner` بررسی می‌کند.

متغیرهای اختیاری:

| متغیر | کار |
|---|---|
| `ANDROID_HOME` / `ANDROID_SDK_ROOT` | مسیر SDK |
| `PARKOUR_REQUIRE_DIST=1` | اگر `dist/index.html` نبود، شکست بخورد (در CI روشن است) |
| `PARKOUR_USE_PLACEHOLDER=1` | حتی اگر بازی ساخته شده باشد، صفحهٔ آزمایشی را بسته‌بندی کند |
| `PARKOUR_VERSION_CODE` / `PARKOUR_VERSION_NAME` | تغییر versionCode / versionName برای نسخه‌های بعدی |
| `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` | امضا با کلید خودتان (CI) |
| `GRADLE` | دستور Gradle دلخواه (پیش‌فرض: Gradle محلی 8.13+ و در غیر این صورت `./gradlew`) |

## کلید امضا — مهم

فایل‌های `keystore/release.jks` و `keystore/keystore.properties` را جایی امن نگه دارید. هر به‌روزرسانی
اپ باید با **همان کلید** امضا شود؛ وگرنه کاربر باید اول اپ قبلی را حذف کند (و پیشرفت بازی‌اش پاک می‌شود).

برای این‌که GitHub Actions هم با همین کلید امضا کند، این secretها را در مخزن بسازید:

```bash
base64 -w0 parkour/android/keystore/release.jks          # → PARKOUR_KEYSTORE_BASE64
grep storePassword parkour/android/keystore/keystore.properties   # → PARKOUR_KEYSTORE_PASSWORD
```

(`PARKOUR_KEY_ALIAS` پیش‌فرض `oujparkour` است.) بدون این secretها هر اجرای CI یک کلید یک‌بارمصرف می‌سازد.

## نصب روی گوشی

با کابل USB و «USB debugging» روشن:

```bash
~/android-sdk/platform-tools/adb install -r parkour/release/OujParkour.apk
```

یا فایل APK را به گوشی بفرستید، بازش کنید و «نصب از منابع ناشناس» را برای همان برنامه اجازه دهید.

برای دیدن لاگ‌های کنسول جاوااسکریپت:

```bash
~/android-sdk/platform-tools/adb logcat -s OujParkour
```

## قرارداد بین بازی و اپ

```js
// پل جاوااسکریپت (فقط داخل اپ وجود دارد)
if (window.AndroidBridge && AndroidBridge.isAndroid()) {
  AndroidBridge.vibrate(30);   // میلی‌ثانیه (۱ تا ۵۰۰۰)
  AndroidBridge.exitApp();     // بستن اپ
}

// دکمهٔ Back: اگر بازی آن را مصرف کرد (بستن منو، توقف بازی...) باید همزمان true برگرداند.
// هر چیز دیگری (یا خطا، یا جواب ندادن در ۲ ثانیه) اپ را به پس‌زمینه می‌فرستد.
window.__onAndroidBack = () => { if (menuOpen) { closeMenu(); return true; } return false; };

// وقتی اپ به پس‌زمینه می‌رود / برمی‌گردد
window.addEventListener('androidpause',  () => { pauseGame(); audioCtx.suspend(); });
window.addEventListener('androidresume', () => { audioCtx.resume(); });
```

## ساختار

```
parkour/android/
├── build-apk.sh              اسکریپت ساخت
├── test-placeholder.html     صفحهٔ آزمایشی
├── app/build.gradle          تنظیمات اپ (AGP 8.13، Java 17)
├── app/src/main/AndroidManifest.xml
├── app/src/main/java/com/oujparkour/game/MainActivity.java   WebView، تمام‌صفحه، Back، چرخهٔ عمر
├── app/src/main/java/com/oujparkour/game/AndroidBridge.java  window.AndroidBridge
├── app/src/main/res/          آیکون وکتوری تطبیقی، تم تیره، نام اپ
└── gradlew, gradle/wrapper/   Gradle 8.14.3
```
