#!/usr/bin/env bash
# Build the Arash Castle Android app (APK) without the Android SDK.
# Needs: JDK 17+ (javac, keytool), python3 with Pillow, npm, curl.
# Tools come from Maven Central / npm only:
#   android.jar 4.1.1.4 (compile stubs), dalvik-dx 16.0.1 (dex), apksig 2.3.0 (signing),
#   three.js 0.149.0 and the Vazirmatn / Lalezar fonts (bundled so the game runs offline).
#
# usage: android/build.sh [version_code] [version_name]
# env:   KEYSTORE (default android/keystore/arash.p12), KEYPASS (default arash-castle)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
VCODE="${1:-1}"; VNAME="${2:-1.0}"
WORK="${WORK:-$HERE/.build}"
KEYSTORE="${KEYSTORE:-$HERE/keystore/arash.p12}"; KEYPASS="${KEYPASS:-arash-castle}"
OUT="$ROOT/dist/arash-castle.apk"
M=https://repo1.maven.org/maven2
mkdir -p "$WORK/tools" "$WORK/classes" "$WORK/stubclasses" "$ROOT/dist"

fetch() { # url dest  (retries: Maven Central rate-limits bursts)
  [ -s "$2" ] && return 0
  for i in 1 2 3 4 5; do
    curl -fsSL -o "$2.part" "$1" && mv "$2.part" "$2" && return 0
    sleep $((i * 6))
  done
  echo "download failed: $1" >&2; exit 1
}
fetch $M/com/google/android/android/4.1.1.4/android-4.1.1.4.jar "$WORK/tools/android.jar"
fetch $M/com/jakewharton/android/repackaged/dalvik-dx/16.0.1/dalvik-dx-16.0.1.jar "$WORK/tools/dx.jar"
fetch $M/com/android/tools/build/apksig/2.3.0/apksig-2.3.0.jar "$WORK/tools/apksig.jar"
if [ ! -s "$WORK/three.min.js" ] || [ ! -d "$WORK/fonts/vazir" ]; then
  (cd "$WORK" && npm pack three@0.149.0 @fontsource/vazirmatn@5.3.0 @fontsource/lalezar@5.3.0 >/dev/null 2>&1)
  mkdir -p "$WORK/fonts" "$WORK/three"
  tar xzf "$WORK/three-0.149.0.tgz" -C "$WORK/three"; cp "$WORK/three/package/build/three.min.js" "$WORK/three.min.js"
  tar xzf "$WORK/fontsource-vazirmatn-5.3.0.tgz" -C "$WORK/fonts" --transform 's/^package/vazir/'
  tar xzf "$WORK/fontsource-lalezar-5.3.0.tgz" -C "$WORK/fonts" --transform 's/^package/lalezar/'
fi

echo "== compile Java"
rm -rf "$WORK/classes"/* "$WORK/stubclasses"/*
javac -nowarn --release 8 -classpath "$WORK/tools/android.jar" -d "$WORK/stubclasses" \
  $(find "$HERE/stubs" -name '*.java') 2>&1 | grep -v "^warning\|^Picked up\|^1 warning\|^note:" || true
javac -nowarn --release 8 -classpath "$WORK/stubclasses:$WORK/tools/android.jar" -d "$WORK/classes" \
  $(find "$HERE/src" -name '*.java') 2>&1 | grep -v "^warning\|^Picked up\|^1 warning\|^note:" || true
[ -f "$WORK/classes/com/arash/castle/MainActivity.class" ] || { echo "javac failed" >&2; exit 1; }

echo "== dex"
java -cp "$WORK/tools/dx.jar" com.android.dx.command.Main --dex --min-sdk-version=24 \
  --output="$WORK/classes.dex" "$WORK/classes" 2>&1 | grep -v "^Picked up" || true
[ -s "$WORK/classes.dex" ] || { echo "dx failed" >&2; exit 1; }

echo "== assemble"
python3 -I "$HERE/tools/build_apk.py" "$ROOT/games/arash-castle-adventure.html" "$WORK/three.min.js" \
  "$WORK/fonts" "$WORK/classes.dex" "$WORK/unsigned.apk" "$VCODE" "$VNAME"

echo "== sign"
if [ ! -f "$KEYSTORE" ]; then
  mkdir -p "$(dirname "$KEYSTORE")"
  keytool -genkeypair -keystore "$KEYSTORE" -storetype PKCS12 -storepass "$KEYPASS" -keypass "$KEYPASS" \
    -alias arash -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Arash Castle, O=Arash Castle" 2>&1 | grep -v "^Picked up" || true
fi
# APK Signature Scheme v2 (Android 7+) with apksig
javac -nowarn -cp "$WORK/tools/apksig.jar" -d "$WORK/tools" "$HERE/tools/Sign.java" 2>&1 | grep -v "^Picked up" || true
java --add-exports java.base/sun.security.x509=ALL-UNNAMED --add-exports java.base/sun.security.pkcs=ALL-UNNAMED --add-exports java.base/sun.security.util=ALL-UNNAMED \
  -cp "$WORK/tools/apksig.jar:$WORK/tools" Sign "$WORK/unsigned.apk" "$OUT" "$KEYSTORE" "$KEYPASS" arash 2>&1 | grep -v "^Picked up"
ls -la "$OUT"
