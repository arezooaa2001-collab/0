#!/usr/bin/env bash
# Build dist/amir-abc-apps.html and dist/amir-abc-apps.apk.
# Needs: python3, JDK 17+, the Android SDK (platform 35, build-tools 35.0.0).
set -euo pipefail
HERE=$(cd "$(dirname "$0")/.." && pwd)
SDK=${ANDROID_HOME:-/opt/android-sdk}

python3 "$HERE/tools/build.py"

cd "$HERE/android"
echo "sdk.dir=$SDK" > local.properties

# Release signing key, kept outside the repository. Keep this file and the .jks next to it:
# later versions must be signed with the same key to install as an update.
SIGN=${AMIRABC_SIGNING:-$HOME/.android/amirabc-signing.properties}
if [ ! -f "$SIGN" ]; then
  mkdir -p "$(dirname "$SIGN")"
  KS="$(dirname "$SIGN")/amirabc-release.jks"
  PASS=$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 24)
  keytool -genkeypair -keystore "$KS" -storetype PKCS12 -storepass "$PASS" -keypass "$PASS" \
    -alias amirabc -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=AMIR ABC" -noprompt
  printf 'storeFile=%s\nstorePassword=%s\nkeyAlias=amirabc\nkeyPassword=%s\n' "$KS" "$PASS" "$PASS" > "$SIGN"
  chmod 600 "$SIGN"
  echo "created signing key $KS"
fi
export AMIRABC_SIGNING="$SIGN"

if [ -x ./gradlew ]; then GRADLE=./gradlew; else GRADLE=gradle; fi
$GRADLE --no-daemon -q assembleRelease
cp app/build/outputs/apk/release/app-release.apk "$HERE/dist/amir-abc-apps.apk"
echo "wrote dist/amir-abc-apps.apk"
