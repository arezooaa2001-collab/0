/* ============================ PHOTO MODE ============================ */
// From the pause menu: the game freezes, the HUD hides, you can slide the camera (2D views), pick a filter and
// take a picture. Pictures go to an in-game album (IndexedDB); from there they can be saved to the phone or shared.
const PH_FILTERS = [
  ['none', 'عادی', 'none'], ['bw', 'سیاه‌وسفید', 'grayscale(1) contrast(1.18)'], ['old', 'قدیمی', 'sepia(.85) contrast(1.05) brightness(1.06)'],
  ['neon', 'نئون', 'saturate(1.9) contrast(1.15) hue-rotate(-12deg)'], ['dream', 'رؤیایی', 'saturate(1.35) brightness(1.12) blur(.6px)'], ['night', 'شب', 'brightness(.72) hue-rotate(190deg) saturate(1.5)'],
];
const Photo = { on: false, f: 'none', cam0: 0, drag: null, back: 'sPause' };
const phCanvas = () => isGL(app.view) ? $('c3') : cv;
const phPan = () => !isGL(app.view) && app.view !== 'duo' && app.kind === 'plat' && app.world;
function photoOpen() {
  if (app.state !== 'pause') return;
  Photo.on = true; Photo.f = 'none'; app.state = 'photo'; app.show(null);
  $('hud').classList.remove('on'); tLayer.classList.remove('on'); t2Layer.classList.remove('on');
  if (app.world) Photo.cam0 = app.world.camX;
  $('photoUI').classList.add('on'); renderPhotoUI();
  $('phHint').textContent = phPan() ? '👆 بکش تا دوربین جابه‌جا شه، فیلتر انتخاب کن و عکس بگیر' : 'فیلتر انتخاب کن و عکس بگیر';
}
function photoClose() {
  if (!Photo.on) return;
  Photo.on = false; cv.style.filter = $('c3').style.filter = ''; $('photoUI').classList.remove('on');
  app.state = 'pause'; $('hud').classList.add('on'); app.show('sPause'); app.dirty = true;
  if (isTouch && !app.duo) tLayer.classList.add('on'); if (isTouch && app.duo) t2Layer.classList.add('on');
}
function renderPhotoUI() {
  $('phFilters').innerHTML = PH_FILTERS.map(([k, n]) => `<button class="chip${k === Photo.f ? ' on' : ''}" data-phf="${k}">${n}</button>`).join('');
  const css = PH_FILTERS.find(x => x[0] === Photo.f)[2]; cv.style.filter = $('c3').style.filter = css === 'none' ? '' : css;
}
// the picture: the frame drawn again right now (so the 3D canvas still holds it), filtered, with a small caption
function photoShot() {
  try { drawView(0); } catch (e) {}
  const src = phCanvas(), sw = src.width, sh = src.height, k = Math.min(1, 1280 / sw), w = Math.round(sw * k), h = Math.round(sh * k);
  const c = mkC(w, h), g = c.getContext('2d'), css = PH_FILTERS.find(x => x[0] === Photo.f)[2];
  if (css !== 'none' && 'filter' in g) g.filter = css;
  g.drawImage(src, 0, 0, w, h); g.filter = 'none';
  // caption
  const f = Math.max(12, Math.round(h / 34)), txt = `تله‌زار 😈 · ${app.label().replace(/<[^>]*>/g, '')}`;
  g.font = `800 ${f}px Vazirmatn, Tahoma, sans-serif`; g.direction = 'rtl'; g.textAlign = 'right'; g.textBaseline = 'bottom';
  const tw = g.measureText(txt).width; g.fillStyle = 'rgba(10,6,24,.55)'; g.fillRect(w - tw - f * 1.6, h - f * 2.2, tw + f * 1.2, f * 1.7);
  g.fillStyle = '#ffd36e'; g.fillText(txt, w - f, h - f * .7);
  let url; try { url = c.toDataURL('image/jpeg', .86); } catch (e) { app.taunt('❌ گرفتن عکس توی این مرورگر ممکن نشد', '#ff9a8a'); return; }
  // flash and click
  const fl = $('phFlash'); fl.classList.remove('on'); void fl.offsetWidth; fl.classList.add('on'); Sound.play('click');
  Album.add({ d: url, t: Date.now(), lv: app.label().replace(/<[^>]*>/g, '') }).then(() => { $('phCount').textContent = `🖼️ ${faNum(Album.n)}`; });
  unlockAch('photo');
}
$('photoUI').addEventListener('click', e => {
  const b = e.target.closest('[data-phf],[data-ph]'); if (!b) return; Sound.play('click');
  if (b.dataset.phf) { Photo.f = b.dataset.phf; renderPhotoUI(); }
  else if (b.dataset.ph === 'shot') photoShot();
  else if (b.dataset.ph === 'close') photoClose();
  else if (b.dataset.ph === 'album') { photoClose(); app.state = 'pause'; renderAlbum(); app.show('sAlbum'); }
});
$('bPhoto').onclick = () => { Sound.play('click'); photoOpen(); };
// sliding the camera
const phDown = e => { if (!Photo.on || !phPan()) return; Photo.drag = { x: e.clientX, cam: app.world.camX }; };
const phMove = e => { if (!Photo.on || !Photo.drag || !phPan()) return; const w = app.world; w.camX = clamp(Photo.drag.cam - (e.clientX - Photo.drag.x) * dpr / S, w.minX || 0, Math.max(w.minX || 0, w.lw - W)); app.dirty = true; };
cv.addEventListener('pointerdown', phDown); addEventListener('pointermove', phMove); addEventListener('pointerup', () => { Photo.drag = null; });
addEventListener('keydown', e => { if (!Photo.on) return; if (e.code === 'Escape') photoClose(); else if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); photoShot(); } else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') { const w = app.world; if (phPan()) w.camX = clamp(w.camX + (e.code === 'ArrowLeft' ? -60 : 60), w.minX || 0, Math.max(w.minX || 0, w.lw - W)); } });

/* ---------- the album (IndexedDB, newest first, at most 30 pictures) ---------- */
const Album = {
  db: null, n: 0, mem: [],
  open() {
    if (this.db || !window.indexedDB) return Promise.resolve(this.db);
    return new Promise(res => { try { const r = indexedDB.open('telezar_album', 1); r.onupgradeneeded = () => r.result.createObjectStore('ph', { keyPath: 'id', autoIncrement: true }); r.onsuccess = () => { this.db = r.result; res(this.db); }; r.onerror = () => res(null); } catch (e) { res(null); } });
  },
  async all() {
    const db = await this.open(); if (!db) return this.mem.slice().reverse();
    return new Promise(res => { try { const q = db.transaction('ph').objectStore('ph').getAll(); q.onsuccess = () => { const a = q.result || []; this.n = a.length; res(a.reverse()); }; q.onerror = () => res([]); } catch (e) { res([]); } });
  },
  async add(p) {
    const db = await this.open(); if (!db) { p.id = Date.now(); this.mem.push(p); this.n = this.mem.length; return; }
    await new Promise(res => { try { const tx = db.transaction('ph', 'readwrite'); tx.objectStore('ph').add(p); tx.oncomplete = res; tx.onerror = res; } catch (e) { res(); } });
    const a = await this.all(); for (const old of a.slice(30)) await this.del(old.id);
  },
  async del(id) {
    const db = await this.open(); if (!db) { this.mem = this.mem.filter(x => x.id !== id); return; }
    await new Promise(res => { try { const tx = db.transaction('ph', 'readwrite'); tx.objectStore('ph').delete(id); tx.oncomplete = res; tx.onerror = res; } catch (e) { res(); } });
  },
};
let albumCache = [];
async function renderAlbum() {
  albumCache = await Album.all();
  $('albumGrid').innerHTML = albumCache.length ? albumCache.map((p, i) => `<button class="phThumb" data-ai="${i}"><img src="${p.d}" alt=""><small>${esc(p.lv || '')}</small></button>`).join('')
    : '<p class="sub small">هنوز عکسی نگرفتی. وسط بازی دکمه‌ی توقف ⏸ رو بزن و «📸 حالت عکس» رو انتخاب کن.</p>';
}
function albumView(i) {
  const p = albumCache[i]; if (!p) return;
  // inside an embedded page (an iframe) downloads are usually blocked, so the save button is only offered where it works
  let framed = false; try { framed = window.self !== window.top; } catch (e) { framed = true; }
  const canSave = !!(window.TelezarApp && TelezarApp.saveImage) || !framed;
  $('albumBig').innerHTML = `<img src="${p.d}" alt=""><div class="row">${canSave ? '<button class="btn primary" data-av="save">📥 ذخیره در گالری</button>' : ''}${window.TelezarApp || (navigator.canShare) ? '<button class="btn" data-av="share">📤 فرستادن</button>' : ''}<button class="btn" data-av="del">🗑</button><button class="btn" data-av="x">بستن</button></div>`;
  $('albumBig').dataset.i = i; $('albumBig').classList.add('on');
}
$('albumGrid').addEventListener('click', e => { const b = e.target.closest('[data-ai]'); if (b) { Sound.play('click'); albumView(+b.dataset.ai); } });
$('albumBig').addEventListener('click', async e => {
  const b = e.target.closest('[data-av]'); if (!b) return; Sound.play('click');
  const p = albumCache[+$('albumBig').dataset.i]; if (!p) return; const a = b.dataset.av, b64 = p.d.split(',')[1];
  if (a === 'x') $('albumBig').classList.remove('on');
  else if (a === 'del') { await Album.del(p.id); $('albumBig').classList.remove('on'); renderAlbum(); }
  else if (a === 'save') {
    if (window.TelezarApp && TelezarApp.saveImage) { const r = String(TelezarApp.saveImage(b64)); app.taunt(r === 'ok' ? '✅ توی گالری (پوشه‌ی Pictures/Telezar) ذخیره شد' : r.startsWith('file:') ? '✅ ذخیره شد: ' + r.slice(5) : '❌ ذخیره نشد', r === 'err' ? '#ff9a8a' : '#9be05a'); }
    else { const l = document.createElement('a'); l.href = p.d; l.download = `telezar-${p.t}.jpg`; document.body.appendChild(l); l.click(); l.remove(); }
  }
  else if (a === 'share') {
    try {
      if (window.TelezarApp && TelezarApp.shareImage) TelezarApp.shareImage(b64);
      else { const blob = await (await fetch(p.d)).blob(), file = new File([blob], `telezar-${p.t}.jpg`, { type: 'image/jpeg' }); if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], text: 'تله‌زار 😈' }); }
    } catch (e) {}
  }
});
$('bAlbum').onclick = () => { Sound.init(); Sound.play('click'); renderAlbum(); app.open('sAlbum'); };
