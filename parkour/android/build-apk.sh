#!/usr/bin/env bash
# Build the signed release APK of "پارکور اوج" (OUJ Parkour).
#
#   bash parkour/android/build-apk.sh
#
# Idempotent. On a fresh Linux box it installs the Android SDK (cmdline-tools,
# platform, build-tools, platform-tools), creates a signing keystore, copies the
# game into the APK assets and runs Gradle. Output: parkour/release/OujParkour.apk
#
# Environment (all optional):
#   ANDROID_HOME / ANDROID_SDK_ROOT  SDK to use (default: $HOME/android-sdk, installed if missing)
#   PARKOUR_REQUIRE_DIST=1           fail instead of falling back to test-placeholder.html
#   PARKOUR_USE_PLACEHOLDER=1        package test-placeholder.html even if dist/index.html exists
#   PARKOUR_VERSION_CODE / PARKOUR_VERSION_NAME   override versionCode (1) / versionName (1.0.0)
#   ANDROID_KEYSTORE_BASE64, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD
#                                    use this keystore (CI secrets) instead of keystore/release.jks
#   GRADLE                           Gradle command to run (default: local Gradle 8.13+/8.x, else ./gradlew)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARKOUR_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DIST_DIR="$PARKOUR_DIR/dist"
PLACEHOLDER="$SCRIPT_DIR/test-placeholder.html"
ASSETS_DIR="$SCRIPT_DIR/app/src/main/assets"
KEYSTORE_DIR="$SCRIPT_DIR/keystore"
KEYSTORE_PROPS="$KEYSTORE_DIR/keystore.properties"
RELEASE_DIR="$PARKOUR_DIR/release"
OUT_APK="$RELEASE_DIR/OujParkour.apk"
LOG_DIR="$SCRIPT_DIR/build/logs"

COMPILE_SDK=35
BUILD_TOOLS=35.0.0
MIN_SDK=24
CMDLINE_TOOLS_ZIP=commandlinetools-linux-13114758_latest.zip
CMDLINE_TOOLS_SHA256=7ec965280a073311c339e571cd5de778b9975026cfcbe79f2b1cdcb1e15317ee

START_TS=$(date +%s)
log()  { printf '\033[1;36m[apk]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[apk] WARNING:\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[apk] ERROR:\033[0m %s\n' "$*" >&2; exit 1; }
mkdir -p "$LOG_DIR"

# --------------------------------------------------------------------------- Java
command -v java >/dev/null 2>&1 || die "java not found (need JDK 17+)."
command -v keytool >/dev/null 2>&1 || die "keytool not found (need a full JDK, not a JRE)."
JAVA_MAJOR=$(java -XshowSettings:properties -version 2>&1 | sed -n 's/^ *java\.specification\.version = //p' | head -n1)
[ -n "$JAVA_MAJOR" ] && [ "${JAVA_MAJOR%%.*}" -ge 17 ] 2>/dev/null || die "JDK 17+ required (found: ${JAVA_MAJOR:-unknown})."
log "Java $JAVA_MAJOR"

# --------------------------------------------------------------------------- Android SDK
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
if [ -z "$SDK" ]; then
  for d in "$HOME/android-sdk" /opt/android-sdk "$HOME/Android/Sdk"; do
    if [ -d "$d/cmdline-tools" ] || [ -d "$d/platforms" ]; then SDK="$d"; break; fi
  done
  SDK="${SDK:-$HOME/android-sdk}"
fi
mkdir -p "$SDK"
SDK="$(cd "$SDK" && pwd)"
export ANDROID_HOME="$SDK" ANDROID_SDK_ROOT="$SDK"
log "Android SDK: $SDK"

find_sdkmanager() {
  local c
  for c in "$SDK/cmdline-tools/latest/bin/sdkmanager" "$SDK"/cmdline-tools/*/bin/sdkmanager; do
    if [ -x "$c" ]; then echo "$c"; return 0; fi
  done
  return 1
}

install_cmdline_tools() {
  command -v unzip >/dev/null 2>&1 || die "unzip is required to install the Android SDK."
  command -v curl >/dev/null 2>&1 || die "curl is required to install the Android SDK."
  local tmp
  tmp="$(mktemp -d)"
  log "Downloading Android cmdline-tools ($CMDLINE_TOOLS_ZIP)..."
  curl -fSL --retry 3 --retry-delay 3 -o "$tmp/tools.zip" \
    "https://dl.google.com/android/repository/$CMDLINE_TOOLS_ZIP"
  echo "$CMDLINE_TOOLS_SHA256  $tmp/tools.zip" | sha256sum -c - >/dev/null \
    || die "cmdline-tools checksum mismatch."
  unzip -q "$tmp/tools.zip" -d "$tmp/x"
  rm -rf "$SDK/cmdline-tools/latest"
  mkdir -p "$SDK/cmdline-tools"
  mv "$tmp/x/cmdline-tools" "$SDK/cmdline-tools/latest"
  rm -rf "$tmp"
}

PACKAGES=()
[ -f "$SDK/platforms/android-$COMPILE_SDK/android.jar" ] || PACKAGES+=("platforms;android-$COMPILE_SDK")
[ -x "$SDK/build-tools/$BUILD_TOOLS/aapt2" ] || PACKAGES+=("build-tools;$BUILD_TOOLS")
[ -x "$SDK/platform-tools/adb" ] || PACKAGES+=("platform-tools")
if [ ${#PACKAGES[@]} -gt 0 ] || [ ! -f "$SDK/licenses/android-sdk-license" ]; then
  SDKMANAGER="$(find_sdkmanager)" || { install_cmdline_tools; SDKMANAGER="$(find_sdkmanager)"; }
  log "Accepting SDK licenses..."
  (yes 2>/dev/null || true) | "$SDKMANAGER" --sdk_root="$SDK" --licenses >"$LOG_DIR/sdk-licenses.log" 2>&1 \
    || { tail -n 30 "$LOG_DIR/sdk-licenses.log"; die "sdkmanager --licenses failed."; }
  if [ ${#PACKAGES[@]} -gt 0 ]; then
    log "Installing SDK packages: ${PACKAGES[*]} (first run only, ~1-2 min)..."
    "$SDKMANAGER" --sdk_root="$SDK" --install "${PACKAGES[@]}" >"$LOG_DIR/sdk-install.log" 2>&1 \
      || { tail -n 40 "$LOG_DIR/sdk-install.log"; die "sdkmanager install failed (log: $LOG_DIR/sdk-install.log)."; }
  fi
fi
BT="$SDK/build-tools/$BUILD_TOOLS"
[ -f "$SDK/platforms/android-$COMPILE_SDK/android.jar" ] && [ -x "$BT/aapt2" ] \
  || die "SDK is incomplete: need platforms;android-$COMPILE_SDK and build-tools;$BUILD_TOOLS in $SDK."
printf 'sdk.dir=%s\n' "$SDK" > "$SCRIPT_DIR/local.properties"

# --------------------------------------------------------------------------- game assets
rm -rf "$ASSETS_DIR"
mkdir -p "$ASSETS_DIR"
if [ -f "$DIST_DIR/index.html" ] && [ "${PARKOUR_USE_PLACEHOLDER:-0}" != "1" ]; then
  # Copy the whole dist folder (normally just index.html), minus source maps.
  (cd "$DIST_DIR" && find . -type f ! -name '*.map' -print0 | while IFS= read -r -d '' f; do
     mkdir -p "$ASSETS_DIR/$(dirname "$f")"; cp "$f" "$ASSETS_DIR/$f"; done)
  GAME_SOURCE="$DIST_DIR/index.html"
  log "Game: $GAME_SOURCE ($(du -h "$GAME_SOURCE" | cut -f1))"
else
  if [ "${PARKOUR_REQUIRE_DIST:-0}" = "1" ]; then
    die "$DIST_DIR/index.html not found (PARKOUR_REQUIRE_DIST=1). Run 'npm run build' in parkour/ first."
  fi
  [ -f "$PLACEHOLDER" ] || die "Neither $DIST_DIR/index.html nor $PLACEHOLDER exists."
  cp "$PLACEHOLDER" "$ASSETS_DIR/index.html"
  GAME_SOURCE="$PLACEHOLDER"
  printf '\033[1;41;97m%s\033[0m\n' \
    "################################################################################" \
    "#  WARNING: parkour/dist/index.html NOT FOUND -- packaging the TEST PLACEHOLDER #" \
    "#  The APK will NOT contain the game. Run 'cd parkour && npm run build' first.  #" \
    "################################################################################" >&2
fi
grep -qi '<meta[^>]*charset' <(head -c 4096 "$ASSETS_DIR/index.html") \
  || warn "index.html has no <meta charset> near the top (the app serves it as UTF-8 anyway)."
grep -qi 'name=["'"'"']\?viewport' "$ASSETS_DIR/index.html" \
  || warn "index.html has no <meta name=viewport>; with wide viewport on it will render zoomed out."

# --------------------------------------------------------------------------- signing key
mkdir -p "$KEYSTORE_DIR"
chmod 700 "$KEYSTORE_DIR"
write_keystore_props() { # storeFile storePassword keyAlias keyPassword
  (umask 077; printf '%s\n' \
    "# Written by build-apk.sh. Never commit. Back up the .jks and this file together:" \
    "# every future update of the app must be signed with the same key." \
    "storeFile=$1" "storePassword=$2" "keyAlias=$3" "keyPassword=$4" > "$KEYSTORE_PROPS")
}
if [ -n "${ANDROID_KEYSTORE_BASE64:-}" ]; then
  [ -n "${ANDROID_KEYSTORE_PASSWORD:-}" ] || die "ANDROID_KEYSTORE_PASSWORD is required with ANDROID_KEYSTORE_BASE64."
  (umask 077; printf '%s' "$ANDROID_KEYSTORE_BASE64" | base64 -d > "$KEYSTORE_DIR/ci-release.jks") \
    || die "ANDROID_KEYSTORE_BASE64 is not valid base64."
  write_keystore_props keystore/ci-release.jks "$ANDROID_KEYSTORE_PASSWORD" \
    "${ANDROID_KEY_ALIAS:-oujparkour}" "${ANDROID_KEY_PASSWORD:-$ANDROID_KEYSTORE_PASSWORD}"
  log "Signing with keystore from ANDROID_KEYSTORE_BASE64."
elif [ ! -f "$KEYSTORE_PROPS" ] || [ ! -f "$KEYSTORE_DIR/release.jks" ]; then
  log "Generating a new release keystore in $KEYSTORE_DIR (keep it: updates must use the same key)..."
  rm -f "$KEYSTORE_DIR/release.jks"
  KS_PASS="$(head -c 32 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 24)"
  keytool -genkeypair -noprompt -storetype PKCS12 \
    -keystore "$KEYSTORE_DIR/release.jks" -alias oujparkour \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=OUJ Parkour, O=OUJ Parkour" \
    -storepass "$KS_PASS" -keypass "$KS_PASS" >"$LOG_DIR/keytool.log" 2>&1 \
    || { cat "$LOG_DIR/keytool.log"; die "keytool failed."; }
  write_keystore_props keystore/release.jks "$KS_PASS" oujparkour "$KS_PASS"
else
  log "Using existing keystore: $KEYSTORE_DIR/release.jks"
fi

# --------------------------------------------------------------------------- Gradle
gradle_version_ok() { # $1 = gradle command; accepts Gradle 8.13 .. 8.x (AGP 8.13 range)
  local v
  v="$("$1" --version 2>/dev/null | sed -n 's/^Gradle \([0-9][0-9.]*\).*/\1/p' | head -n1)"
  [ -n "$v" ] || return 1
  local major="${v%%.*}" rest="${v#*.}"
  local minor="${rest%%.*}"
  [ "$major" = 8 ] && [ "$minor" -ge 13 ] 2>/dev/null
}
if [ -n "${GRADLE:-}" ]; then
  GRADLE_CMD="$GRADLE"
else
  GRADLE_CMD=""
  for g in "$(command -v gradle 2>/dev/null || true)" /opt/gradle/bin/gradle; do
    if [ -n "$g" ] && [ -x "$g" ] && gradle_version_ok "$g"; then GRADLE_CMD="$g"; break; fi
  done
  if [ -z "$GRADLE_CMD" ]; then
    chmod +x "$SCRIPT_DIR/gradlew"
    GRADLE_CMD="$SCRIPT_DIR/gradlew"
  fi
fi
log "Gradle: $GRADLE_CMD"

GRADLE_ARGS=(-p "$SCRIPT_DIR" --console=plain --warning-mode=summary)
[ "${CI:-}" = "true" ] && GRADLE_ARGS+=(--no-daemon)
[ -n "${PARKOUR_VERSION_CODE:-}" ] && GRADLE_ARGS+=("-PversionCode=$PARKOUR_VERSION_CODE")
[ -n "${PARKOUR_VERSION_NAME:-}" ] && GRADLE_ARGS+=("-PversionName=$PARKOUR_VERSION_NAME")

log "Building release APK..."
set +e
"$GRADLE_CMD" "${GRADLE_ARGS[@]}" assembleRelease 2>&1 | grep --line-buffered -v '^Picked up ' | tee "$LOG_DIR/gradle.log"
GRADLE_RC=${PIPESTATUS[0]}
set -e
[ "$GRADLE_RC" -eq 0 ] || die "Gradle build failed (log: $LOG_DIR/gradle.log)."

BUILT_APK="$SCRIPT_DIR/app/build/outputs/apk/release/app-release.apk"
[ -f "$BUILT_APK" ] || die "Signed APK not found at $BUILT_APK (unsigned build? check keystore/keystore.properties)."

# --------------------------------------------------------------------------- verify + publish
log "Verifying signature..."
# Verify as if minSdk were 21 so apksigner checks the v1 (JAR) signature too; for
# minSdk 24 it would only look at v2 and report v1 as "false" even when present.
"$BT/apksigner" verify --min-sdk-version 21 --verbose "$BUILT_APK" 2>&1 \
  | grep -E '^(Verifies|Verified using v[12] |Number of signers|WARNING|ERROR|DOES NOT)' \
  | grep -v 'not protected by signature' | sed 's/^/    /' || true
"$BT/apksigner" verify --min-sdk-version 21 "$BUILT_APK" >/dev/null 2>&1 \
  && "$BT/apksigner" verify --min-sdk-version "$MIN_SDK" "$BUILT_APK" >/dev/null 2>&1 \
  || die "apksigner verify failed."
"$BT/zipalign" -c -p 4 "$BUILT_APK" || die "APK is not zip-aligned."

mkdir -p "$RELEASE_DIR"
cp "$BUILT_APK" "$OUT_APK"

log "Badging:"
"$BT/aapt2" dump badging "$OUT_APK" 2>/dev/null \
  | grep -E "^(package|minSdkVersion|targetSdkVersion|application-label:|uses-permission|launchable-activity|  uses-gl-es|  uses-feature: name='android.hardware.screen)" \
  | sed 's/^/    /' || true
"$BT/aapt2" dump xmltree --file AndroidManifest.xml "$OUT_APK" 2>/dev/null \
  | grep -E 'A: http://schemas.android.com/apk/res/android:screenOrientation' | head -n1 \
  | sed 's/.*=\([0-9]*\).*/    screenOrientation=\1 (6 = sensorLandscape)/' || true

SIZE_BYTES=$(stat -c %s "$OUT_APK")
log "Packaged: $(basename "$GAME_SOURCE")"
log "APK: $OUT_APK ($(du -h "$OUT_APK" | cut -f1), $SIZE_BYTES bytes) in $(( $(date +%s) - START_TS ))s"
