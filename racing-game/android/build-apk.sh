#!/usr/bin/env bash
# ساخت فایل APK اندروید قهرمان پیست با ابزارهای رسمی Android SDK (بدون Gradle)
# نیازها: JDK 17 یا بالاتر، Android SDK (build-tools و یک platform)، و فایل dist/ghahreman-pist.html
#   npm install && npm run build:html && npm run build:apk
# متغیرهای اختیاری: ANDROID_HOME، BUILD_TOOLS (پوشه build-tools)، ANDROID_JAR،
#   KEYSTORE_FILE، KEYSTORE_PASS، KEY_ALIAS (برای امضا با کلید ثابت خودتان)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}}"
BT="${BUILD_TOOLS:-$(ls -d "$SDK"/build-tools/* 2>/dev/null | sort -V | tail -1)}"
AJAR="${ANDROID_JAR:-$(ls -d "$SDK"/platforms/android-* 2>/dev/null | sort -V | tail -1)/android.jar}"
HTML="$ROOT/dist/ghahreman-pist.html"
OUT="$ROOT/dist/ghahreman-pist.apk"
B="$HERE/build"
[ -x "$BT/aapt2" ] || { echo "aapt2 not found in build-tools: $BT"; exit 1; }
[ -f "$AJAR" ] || { echo "android.jar not found: $AJAR"; exit 1; }
[ -f "$HTML" ] || { echo "Run 'npm run build:html' first ($HTML missing)"; exit 1; }
echo "build-tools: $BT"; echo "android.jar: $AJAR"
rm -rf "$B"; mkdir -p "$B/compiled" "$B/classes" "$B/assets" "$B/gen"
cp "$HTML" "$B/assets/index.html"

# ۱) منابع (آیکن، نام برنامه، تم)
"$BT/aapt2" compile --dir "$HERE/res" -o "$B/compiled/res.zip"
"$BT/aapt2" link -o "$B/base.apk" -I "$AJAR" --manifest "$HERE/AndroidManifest.xml" \
  -A "$B/assets" --java "$B/gen" --min-sdk-version 24 --target-sdk-version 35 \
  --version-code "${VERSION_CODE:-2}" --version-name "${VERSION_NAME:-1.1}" "$B/compiled/res.zip"

# ۲) کامپایل جاوا و تبدیل به DEX
javac --release 11 -encoding UTF-8 -classpath "$AJAR" -d "$B/classes" \
  $(find "$HERE/src" "$B/gen" -name '*.java')
"$BT/d8" --release --min-api 24 --lib "$AJAR" --output "$B" $(find "$B/classes" -name '*.class')

# ۳) افزودن classes.dex، هم‌ترازی و امضا
cp "$B/base.apk" "$B/unsigned.apk"
(cd "$B" && zip -q -j unsigned.apk classes.dex)
"$BT/zipalign" -f -p 4 "$B/unsigned.apk" "$B/aligned.apk"
KS="${KEYSTORE_FILE:-$B/release.keystore}"; KP="${KEYSTORE_PASS:-ghahreman-pist}"; KA="${KEY_ALIAS:-ghahreman}"
if [ ! -f "$KS" ]; then
  keytool -genkeypair -keystore "$KS" -storepass "$KP" -keypass "$KP" -alias "$KA" \
    -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Ghahreman Pist, O=Ghahreman Pist, C=IR" >/dev/null
fi
"$BT/apksigner" sign --ks "$KS" --ks-pass "pass:$KP" --key-pass "pass:$KP" --ks-key-alias "$KA" --out "$OUT" "$B/aligned.apk"
"$BT/apksigner" verify --verbose "$OUT" | head -5
ls -la "$OUT"
echo "APK ready: $OUT"
