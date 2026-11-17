#!/usr/bin/env bash
# Builds rangin-hesab.apk from ../index.html.
# Needs (Ubuntu): apt-get install aapt apksigner dalvik-exchange android-sdk-platform-23 zipalign openjdk python3-pil
set -euo pipefail
cd "$(dirname "$0")"
JAR=/usr/lib/android-sdk/platforms/android-23/android.jar
OUT=build; rm -rf "$OUT"; mkdir -p "$OUT"/{classes,assets,res}
cp -r res/* "$OUT/res/"
python3 make_icon.py "$OUT/res"
cp ../index.html "$OUT/assets/index.html"
javac -nowarn --release 8 -cp "$JAR" -d "$OUT/classes" src/com/ranginhesab/calc/MainActivity.java
dalvik-exchange --dex --min-sdk-version=21 --output="$OUT/classes.dex" "$OUT/classes"
aapt package -f -0 arsc -M AndroidManifest.xml -S "$OUT/res" -A "$OUT/assets" -I "$JAR" -F "$OUT/unsigned.apk"
(cd "$OUT" && aapt add unsigned.apk classes.dex >/dev/null)
zipalign -f -p 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"
KS=${KEYSTORE:-release.keystore}
if [ ! -f "$KS" ]; then
  keytool -genkeypair -keystore "$KS" -alias rangin -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass rangin123 -keypass rangin123 -dname "CN=Rangin Hesab" >/dev/null 2>&1
fi
apksigner sign --ks "$KS" --ks-key-alias rangin --ks-pass pass:rangin123 --key-pass pass:rangin123 \
  --min-sdk-version 21 --out ../rangin-hesab.apk "$OUT/aligned.apk"
apksigner verify --print-certs ../rangin-hesab.apk | head -2
echo "Built $(cd .. && pwd)/rangin-hesab.apk"
