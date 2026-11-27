# ابزارهای ساخت و تست

- `build.py` — کل بازی رو توی یه فایل `taxi-city.html` (کنار پوشه `taxi/`) می‌سازه، به‌علاوه نسخه claude.ai.
  `ESBUILD=/path/to/esbuild ART_OUT=/path/artifact.html python3 taxi/tools/build.py`
  (بدون `ESBUILD` از `npx esbuild@0.24.0` استفاده می‌کنه)
- `harness.mjs` — بازی رو توی Chromium بدون صفحه بالا میاره و فریم‌ها رو دستی جلو می‌بره (`step(n, cond)`).
- `smoke.mjs`، `reg.mjs` — تست سریع و تست کامل (سفر، پلیس و زندان، همه حالت‌ها، ذخیره و بارگذاری).
  اول سرور: `cd taxi && python3 -m http.server 8765` بعد `node taxi/tools/reg.mjs`
