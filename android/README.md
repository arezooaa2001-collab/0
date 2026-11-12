# Arash Castle — Android app

`dist/arash-castle.apk` is the game wrapped in a full-screen Android WebView. Everything is
inside the APK (the game page, three.js, the Vazirmatn and Lalezar fonts), so it runs offline.

- Android 7.0 (API 24) or newer, target API 34, package `com.arash.castle`
- Signed with APK Signature Scheme v2
- File pickers (photos, restoring a backup) open the Android chooser; "save backup" opens Android's save dialog
- Back button asks before quitting; the game pauses in the background; rotating the phone keeps the game state
- The page is served from `https://appassets.androidplatform.net/assets/` (intercepted from the APK's
  assets; Android reserves this host for app content). On `file://` WebView may block or drop
  localStorage, which is why 1.0–1.2 lost progress; on an https origin it persists like a browser.
- Saving: the game's localStorage is mirrored into the app's own files (`files/save/`, one file per key,
  written atomically on a background thread). The game autosaves every 15 s and the app asks it to save
  before going to the background, so progress survives the app being closed or killed, and values larger
  than WebView's storage quota are kept.

## Build

```
android/build.sh [version_code] [version_name]     # e.g. android/build.sh 2 1.1
```

Needs JDK 17+, Python 3 with Pillow, npm and curl. No Android SDK: the tools come from
Maven Central (android.jar 4.1.1.4 stubs, dalvik-dx 16.0.1, apksig 2.3.0), and
`tools/build_apk.py` writes the binary manifest and resource table itself.

**Signing key:** the first build creates `android/keystore/arash.p12` (not committed).
Android only installs an update over an existing install if it is signed with the same key,
so keep that file. Point `KEYSTORE=` / `KEYPASS=` at it for later builds and raise `version_code`.
