// نقطهٔ شروع بازی
import { Game } from './game.js';

async function start() {
  const canvas = document.getElementById('game');
  try {
    if (document.fonts && document.fonts.load) {
      await Promise.race([
        Promise.all([document.fonts.load('900 40px Vazirmatn'), document.fonts.load('400 16px Vazirmatn')]),
        new Promise((r) => setTimeout(r, 1500)),
      ]);
    }
  } catch (e) { /* ignore */ }
  const test = document.createElement('canvas');
  const gl = test.getContext('webgl2') || test.getContext('webgl');
  if (!gl) {
    document.getElementById('loadTip').textContent = 'مرورگر یا دستگاه تو WebGL را پشتیبانی نمی‌کند؛ بازی را با کروم یا فایرفاکس به‌روز باز کن.';
    return;
  }
  const game = new Game(canvas);
  window.__game = game;
  try {
    await game.boot();
  } catch (e) {
    console.error(e);
    document.getElementById('loadTip').textContent = 'خطا در اجرای بازی: ' + (e && e.message ? e.message : e);
  }
}
start();
