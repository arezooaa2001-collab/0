# واژه‌دان

کتابخانهٔ شخصی کلمه‌ها به ۱۶۹ زبان، با دکمهٔ بلندگو برای شنیدن تلفظ و دستیار هوش مصنوعی برای یادگیری.

## نسخه‌ها

| | `web/index.html` (نسخهٔ وب) | `index.html` (داخل Claude) |
|---|---|---|
| ورود | حساب واقعی گوگل (Firebase Authentication) | حساب Claude |
| فضای ابری | Cloud Firestore، به نام همان حساب گوگل | پایگاه‌دادهٔ Claude |
| دستیار | Gemini رایگان بدون کلید (Firebase AI Logic)، یا Gemini با کلید شخصی | Claude، بدون کلید |
| صدا | صدای دستگاه ← صدای آنلاین ← صدای Gemini (با کلید) | صداهای دستگاه |

## راه‌اندازی نسخهٔ وب

1. **انتشار روی اینترنت (GitHub Pages):** در مخزن، Settings ← Pages ← Source: *Deploy from a branch* ← شاخهٔ `ccr-34a4c3d2-1xoosi` و پوشهٔ `/ (root)` ← Save.
   آدرس برنامه: https://arezooaa2001-collab.github.io/0/vazhedan/web/
2. **Firebase:** بار اولی که برنامه را باز کنی، صفحهٔ راهنما قدم‌به‌قدم ساخت پروژهٔ رایگان Firebase را توضیح می‌دهد (ورود با گوگل، Firestore و قانون‌هایش، AI Logic، و دامنهٔ مجاز `arezooaa2001-collab.github.io`).
3. برای اینکه روی همهٔ دستگاه‌ها بدون صفحهٔ راهنما کار کند، `firebaseConfig` را در `EMBEDDED_FIREBASE_CONFIG` داخل `web/index.html` بگذار.

ورود با گوگل از روی فایلی که مستقیم از حافظهٔ گوشی باز شود (`file://`) کار نمی‌کند؛ برنامه باید از آدرس https باز شود.
