#!/usr/bin/env bash
# Build the Android app (APK) without Gradle, using the Ubuntu Android SDK packages:
#   apt-get install android-sdk-platform-23 android-sdk-build-tools dalvik-exchange
# Output: ../release/echowords.apk
set -euo pipefail
cd "$(dirname "$0")"
SDK=/usr/lib/android-sdk
BT=$SDK/build-tools/debian
JAR=$SDK/platforms/android-23/android.jar
OUT=build

rm -rf "$OUT" && mkdir -p "$OUT/gen" "$OUT/classes" assets

# 1. The web app, as one self-contained page.
(cd .. && npm run build:single >/dev/null)
cp ../release/echowords.html assets/index.html

# 2. Resources + manifest → R.java and the base APK.
"$BT/aapt" package -f -m -J "$OUT/gen" -M AndroidManifest.xml -S res -A assets -I "$JAR" -F "$OUT/app.unaligned.apk"

# 3. Java → classes → Android bytecode.
javac -nowarn -Xlint:-options -source 8 -target 8 -bootclasspath "$JAR" -d "$OUT/classes" $(find src "$OUT/gen" -name '*.java')
"$BT/dx" --dex --min-sdk-version=24 --output="$OUT/classes.dex" "$OUT/classes"
(cd "$OUT" && "$BT/aapt" add app.unaligned.apk classes.dex >/dev/null)

# 4. Align and sign. The signing key is NOT in the repository (keep it safe and private):
#    ECHOWORDS_KEYSTORE (default: android/echowords.keystore) and ECHOWORDS_KS_PASS.
#    New versions only install over old ones when they are signed with the same key.
: "${ECHOWORDS_KS_PASS:?set ECHOWORDS_KS_PASS to the signing key password}"
KS="${ECHOWORDS_KEYSTORE:-echowords.keystore}"
if [ ! -f "$KS" ]; then
  keytool -genkeypair -keystore "$KS" -storepass "$ECHOWORDS_KS_PASS" -keypass "$ECHOWORDS_KS_PASS" -alias echowords \
    -keyalg RSA -keysize 2048 -validity 36500 -dname "CN=EchoWords" >/dev/null 2>&1
  echo "Created a new signing key: $KS (back it up; do not commit it)"
fi
"$BT/zipalign" -f 4 "$OUT/app.unaligned.apk" "$OUT/app.aligned.apk"
"$BT/apksigner" sign --ks "$KS" --ks-pass env:ECHOWORDS_KS_PASS --key-pass env:ECHOWORDS_KS_PASS \
  --v1-signing-enabled true --v2-signing-enabled true --out ../release/echowords.apk "$OUT/app.aligned.apk"
"$BT/apksigner" verify ../release/echowords.apk
echo "→ release/echowords.apk ($(du -h ../release/echowords.apk | cut -f1))"
