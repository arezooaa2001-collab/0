#!/usr/bin/env bash
# Builds Camera.apk with the Android tools from Ubuntu's repositories:
#   sudo apt-get install aapt dalvik-exchange apksigner zipalign android-sdk-platform-23
#   bash android/build.sh
set -euo pipefail
cd "$(dirname "$0")"
SDK=/usr/lib/android-sdk
JAR=$SDK/platforms/android-23/android.jar
BUILD=build
rm -rf "$BUILD" && mkdir -p "$BUILD"/gen "$BUILD"/classes "$BUILD"/assets/www

# The web app, bundled into one file.
node ../camera/build-single.js > /dev/null
cp ../camera/Camera.html "$BUILD"/assets/www/Camera.html
cp -r ../camera/ai "$BUILD"/assets/www/ai

aapt package -f -m -J "$BUILD"/gen -M AndroidManifest.xml -S res -I "$JAR"
javac -nowarn -Xlint:-options -source 8 -target 8 -encoding UTF-8 -bootclasspath "$JAR" \
  -d "$BUILD"/classes "$BUILD"/gen/com/camera250/app/R.java src/com/camera250/app/*.java
dalvik-exchange --dex --output="$BUILD"/classes.dex "$BUILD"/classes

aapt package -f -M AndroidManifest.xml -S res -A "$BUILD"/assets -I "$JAR" -F "$BUILD"/unsigned.apk
(cd "$BUILD" && aapt add -f unsigned.apk classes.dex > /dev/null)
zipalign -f -p 4 "$BUILD"/unsigned.apk "$BUILD"/aligned.apk

# Same key every build, so a new Camera.apk installs over the old one as an update.
if [ ! -f camera.keystore ]; then
  keytool -genkeypair -keystore camera.keystore -storepass camera250 -keypass camera250 -alias camera \
    -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Camera, O=Camera, C=IR" > /dev/null 2>&1
fi
apksigner sign --ks camera.keystore --ks-pass pass:camera250 --key-pass pass:camera250 --ks-key-alias camera \
  --min-sdk-version 24 --out Camera.apk "$BUILD"/aligned.apk
apksigner verify --min-sdk-version 24 Camera.apk
rm -f Camera.apk.idsig
echo "Built $(pwd)/Camera.apk ($(du -h Camera.apk | cut -f1))"
