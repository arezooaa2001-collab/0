#!/bin/bash
# Builds the Android app ../telezar.apk: a full-screen WebView that runs the single-file game (../index.html).
# Needs a JDK and the Ubuntu/Debian packages: android-sdk-platform-23 aapt dalvik-exchange zipalign apksigner
set -e
cd "$(dirname "$0")"
SDK=/usr/lib/android-sdk/platforms/android-23/android.jar
OUT=build
rm -rf "$OUT"; mkdir -p "$OUT/gen" "$OUT/obj" "$OUT/assets"
(cd .. && python3 build.py >/dev/null)                    # fresh game file
cp ../index.html "$OUT/assets/index.html"
aapt package -f -m -J "$OUT/gen" -M AndroidManifest.xml -S res -I "$SDK"
javac -nowarn -Xlint:-options -source 8 -target 8 -bootclasspath "$SDK" -cp "$SDK" -d "$OUT/obj" $(find src "$OUT/gen" -name '*.java')
dalvik-exchange --dex --output="$OUT/classes.dex" "$OUT/obj"
aapt package -f -M AndroidManifest.xml -S res -A "$OUT/assets" -I "$SDK" -F "$OUT/unsigned.apk"
(cd "$OUT" && aapt add -f unsigned.apk classes.dex >/dev/null)
zipalign -f -p 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"
# the same key for every build, so a new version installs over the old one (keeps your saves)
[ -f telezar.keystore ] || keytool -genkeypair -keystore telezar.keystore -alias telezar -keyalg RSA -keysize 2048 -validity 36500 \
  -storepass telezar -keypass telezar -dname "CN=Telezar, O=Telezar, C=IR" >/dev/null 2>&1
apksigner sign --ks telezar.keystore --ks-key-alias telezar --ks-pass pass:telezar --key-pass pass:telezar --min-sdk-version 21 --v4-signing-enabled false --out ../telezar.apk "$OUT/aligned.apk"
apksigner verify ../telezar.apk && echo "built ../telezar.apk ($(du -h ../telezar.apk | cut -f1))"
