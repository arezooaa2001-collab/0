import * as THREE from 'three';
import { fa, mulberry32 } from './util.js';
import { REGION_NAMES } from './world.js';

const _v = new THREE.Vector3();

/** Photo hunt: three landmarks a day to photograph in photo mode, plus overall completion for the phone. */
export class PhotoHunt {
  constructor(game) {
    this.g = game;
  }
  get data() {
    const g = this.g, s = g.stats, places = g.world.places;
    if (!s.hunt || s.hunt.day !== g.day || !Array.isArray(s.hunt.list)) {
      const rnd = mulberry32(g.day * 7919 + 13);
      const idx = new Set();
      while (idx.size < Math.min(3, places.length)) idx.add(Math.floor(rnd() * places.length));
      s.hunt = { day: g.day, list: [...idx], done: [] };
    }
    return s.hunt;
  }
  targets() {
    const P = this.g.world.places, H = this.data;
    return H.list.map((i) => ({ i, pl: P[i], done: H.done.includes(i) }));
  }
  /** called by Photo.capture: did this shot catch one of today's landmarks? */
  check() {
    const g = this.g, cam = g.camera;
    for (const t of this.targets()) {
      if (t.done) continue;
      const pl = t.pl;
      const d = Math.hypot(cam.position.x - pl.x, cam.position.z - pl.z);
      if (d > 110) continue;
      _v.set(pl.x, g.world.heightAt(pl.x, pl.z) + 3, pl.z).project(cam);
      if (_v.z > 1 || Math.abs(_v.x) > 0.85 || Math.abs(_v.y) > 0.85) continue;
      this.data.done.push(t.i);
      g.coins += 4;
      g.addXp(30);
      g.stats.huntShots = (g.stats.huntShots || 0) + 1;
      g.audio.cash();
      const left = this.targets().filter((x) => !x.done).length;
      setTimeout(() => g.ui.toast(`📸 عکس «${pl.name}» توی آلبوم شکار عکس ثبت شد! +🪙۴${left ? ` • ${fa(left)} تا مونده` : ' • همه رو گرفتی! 🎉'}`, 'good'), 400);
      if (!left) {
        g.coins += 15;
        setTimeout(() => g.ui.achievement('📸', 'شکار عکس امروز کامل شد!', 15, '🖼️ عکاس شهر'), 1600);
      }
      g.save();
      return true;
    }
    return false;
  }
  html() {
    const g = this.g, p = g.player.pos;
    return `<p class="note">امروز از این ۳ جای شهر عکس بگیر: برو نزدیکش (کمتر از ۱۱۰ متر)، حالت عکاسی (📸 یا X) رو باز کن و طوری بچرخ که توی کادر باشه، بعد عکس بگیر.</p>
      <div class="hunt">${this.targets().map((t) => `<div class="${t.done ? 'ok' : ''}"><span>${t.done ? '✅' : '📸'}</span><b>${t.pl.name}</b><small>${REGION_NAMES[t.pl.region] || ''} • ${fa(Math.round(Math.hypot(t.pl.x - p.x, t.pl.z - p.z)))} م</small>${t.done ? '' : `<button data-hunt="${t.i}">🧭 مسیر</button>`}</div>`).join('')}</div>
      <p class="note">هر عکس 🪙۴ • هر ۳ تا با هم 🪙۱۵ جایزه • فردا جاهای جدید</p>`;
  }
  bind(el) {
    const g = this.g;
    el.querySelectorAll('[data-hunt]').forEach((b) => (b.onclick = () => {
      const pl = g.world.places[+b.dataset.hunt];
      g.ui.closePanel();
      if (g.ui.navTo(pl.x, pl.z, `📸 ${pl.name}`, 'شکار عکس')) g.ui.toast(`🧭 فلش راهنما تو رو به «${pl.name}» می‌بره`, 'good');
    }));
  }
  mapIcons() {
    return this.targets().filter((t) => !t.done).map((t) => ({ x: t.pl.x, z: t.pl.z, col: '#7b1fa2', txt: '📸' }));
  }
  /** how much of the game you've seen, for the phone */
  completion() {
    const g = this.g, s = g.stats;
    const parts = [
      ['🏆', 'افتخارات', g.ach.done().length, g.ach.list.length],
      ['📖', 'فصل‌های داستان', s.career ? s.career.ch + (s.career.done ? 1 : 0) : 0, 7],
      ['🗿', 'مجسمه‌های طلایی', (s.statues || []).length, g.thrills.statues.length],
      ['🚗', 'ماشین‌ها', g.player.owned.length, 7],
      ['🏁', 'مسیرهای مسابقه', (s.raceTracks || []).length, 4],
      ['🚦', 'حریف‌های درگ', s.dragBeat || 0, 4],
      ['🔧', 'قطعات مسابقه‌ای', (g.player.perf || []).length, 4],
      ['💼', 'تاکسی‌های شرکت', (s.fleet && s.fleet.taxis) || 0, 5],
      ['🧭', 'مناطق کشف‌شده', (s.regions || []).length, 5],
    ];
    const pct = Math.round((parts.reduce((a, [, , v, n]) => a + Math.min(1, v / n), 0) / parts.length) * 100);
    return { pct, parts };
  }
  completionHtml() {
    const { pct, parts } = this.completion();
    return `<div class="compl"><div class="ring" style="--p:${pct}"><b>${fa(pct)}٪</b><small>پیشرفت کل</small></div>
      ${parts.map(([i, t, v, n]) => `<div class="ach ${v >= n ? 'ok' : ''}"><span class="ai">${i}</span><div><b>${t}</b><small>${fa(Math.min(v, n))} از ${fa(n)}</small><div class="ap"><i style="width:${Math.min(100, (v / n) * 100)}%"></i></div></div></div>`).join('')}</div>`;
  }
}
