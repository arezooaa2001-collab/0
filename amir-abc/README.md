# AMIR ABC

| فایل | توضیح |
|---|---|
| `AMIR_ABC.html` | سایت کامل در یک فایل (تصویر، فونت وزیرمتن، CSS و JS داخل خود فایل؛ آفلاین کار می‌کند) |
| `AMIR_ABC.apk` | اپ اندروید (`com.amirabc.official`، نسخه 1.0، حداقل Android 8.0) |
| `android/` | پروژه استاندارد اندروید (قابل باز کردن در Android Studio) |
| `src/template.html` | سورس صفحه؛ `build_html.py` آن را به `AMIR_ABC.html` تبدیل می‌کند |

## ساخت دوباره

```bash
python3 build_html.py      # فقط HTML
./build_apk.sh             # HTML + APK  (نیاز: apt install aapt apksigner android-sdk-platform-23 dalvik-exchange zipalign)
python3 make_icons.py      # ساخت دوباره آیکون‌ها
```

یا پوشه `android/` را در Android Studio باز کنید (قبلش `AMIR_ABC.html` را در `android/app/src/main/assets/` کپی کنید؛ اسکریپت این کار را خودش انجام می‌دهد).

کلید امضای APK در `android/keystore/` ساخته می‌شود و عمداً در git نیست.
اگر با کلید دیگری بسازید، برای نصب نسخه جدید باید نسخه قبلی را پاک کنید.

فونت‌ها: Vazirmatn و Cinzel Decorative (هر دو با مجوز OFL؛ فایل‌های `assets/*-OFL.txt`).
