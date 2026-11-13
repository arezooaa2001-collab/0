#!/usr/bin/env bash
# Builds a real, signed AMIR_ABC.apk without Gradle, using the Android build tools
# (Ubuntu packages: aapt, apksigner, android-sdk-platform-23, dalvik-exchange, zipalign).
set -euo pipefail
unset JAVA_TOOL_OPTIONS 2>/dev/null || true
cd "$(dirname "$0")"
ROOT=$PWD
SDK=${ANDROID_SDK_DIR:-/usr/lib/android-sdk}
BT=$SDK/build-tools/debian
PLATFORM=$SDK/platforms/android-23/android.jar
SRC=$ROOT/android/app/src/main
OUT=$ROOT/android/build
KEYSTORE=${KEYSTORE:-$ROOT/android/keystore/amir_abc.jks}
KS_PASS=${KS_PASS:-amirabc123}

python3 -I build_html.py
mkdir -p "$SRC/assets"
cp AMIR_ABC.html "$SRC/assets/AMIR_ABC.html"

rm -rf "$OUT"; mkdir -p "$OUT"/{compiled,gen,classes,dex}

# 1) resources
sed 's#<manifest xmlns:android="http://schemas.android.com/apk/res/android">#<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.amirabc.official">#' \
  "$SRC/AndroidManifest.xml" > "$OUT/AndroidManifest.xml"
"$BT/aapt2" compile --dir "$SRC/res" -o "$OUT/compiled/res.zip"
"$BT/aapt2" link -o "$OUT/unsigned.apk" -I "$PLATFORM" \
  --manifest "$OUT/AndroidManifest.xml" \
  --min-sdk-version 26 --target-sdk-version 34 \
  --version-code 1 --version-name 1.0 \
  -A "$SRC/assets" --java "$OUT/gen" --auto-add-overlay \
  "$OUT/compiled/res.zip"

# 2) code
javac -nowarn --release 8 -encoding UTF-8 -classpath "$PLATFORM" -d "$OUT/classes" \
  $(find "$SRC/java" "$OUT/gen" -name '*.java')
"$BT/dx" --dex --min-sdk-version=26 --output="$OUT/dex/classes.dex" "$OUT/classes"
(cd "$OUT/dex" && zip -q -X "$OUT/unsigned.apk" classes.dex)

# 3) align + sign (v1 + v2 + v3)
"$BT/zipalign" -f -p 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"
if [ ! -f "$KEYSTORE" ]; then
  mkdir -p "$(dirname "$KEYSTORE")"
  keytool -genkeypair -keystore "$KEYSTORE" -storepass "$KS_PASS" -keypass "$KS_PASS" \
    -alias amirabc -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=AMIR ABC, O=AMIR ABC, C=IR" 2>/dev/null
fi
"$BT/apksigner" sign --ks "$KEYSTORE" --ks-pass "pass:$KS_PASS" --ks-key-alias amirabc \
  --min-sdk-version 26 --out "$ROOT/AMIR_ABC.apk" "$OUT/aligned.apk"
"$BT/apksigner" verify --verbose "$ROOT/AMIR_ABC.apk" | head -6
ls -l "$ROOT/AMIR_ABC.apk"
