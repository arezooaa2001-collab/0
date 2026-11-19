// Unified input: keyboard (remappable), mouse (pointer lock / drag), gamepad, multitouch virtual controls with
// adjustable size / opacity / dead zone / smoothing / layout editor, input buffering and haptics.
import { G } from './game.js';
import { clamp } from './util.js';
import { ACTIONS } from './config.js';
import { t } from './i18n.js';

const BUFFER = 0.14;
const TOUCH_BUTTONS = [
  { a: 'jump', icon: '⤒', x: 89, y: 78, s: 1.25 }, { a: 'boost', icon: '⚡', x: 77, y: 87, s: 1.05 }, { a: 'attack', icon: '✦', x: 92, y: 58, s: 1.0 },
  { a: 'spin', icon: '⟳', x: 80, y: 66, s: 0.95 }, { a: 'special', icon: '★', x: 66, y: 88, s: 0.85 }, { a: 'interact', icon: '✋', x: 69, y: 70, s: 0.75 },
  { a: 'camReset', icon: '◎', x: 95, y: 43, s: 0.6 }, { a: 'switchChar', icon: '⇄', x: 57, y: 90, s: 0.6 }, { a: 'transform', icon: '◆', x: 84, y: 47, s: 0.6 },
];

export class Input {
  constructor(canvas, ui) {
    this.canvas = canvas; this.keys = new Set(); this.held_ = {}; this.pressT = {}; this.edge = {}; this.rel = {};
    this.move = { x: 0, y: 0 }; this.look = { x: 0, y: 0 }; this.zoom = 0;
    this.touch = { move: { x: 0, y: 0 }, held: {}, look: { x: 0, y: 0 } };
    this.padState = { held: {}, move: { x: 0, y: 0 }, look: { x: 0, y: 0 } };
    this.rawPressed = new Set(); this.rebind = null; this.boostToggled = false; this.enabled = true; this.lastDevice = 'keyboard';
    this.bindKeyboard(); this.bindMouse();
    this.buildTouch();
  }
  // ---------- public API ----------
  held(a) { return !!(this.held_[a] || this.touch.held[a] || this.padState.held[a]); }
  take(a) { const t0 = this.pressT[a]; if (t0 !== undefined && G.realTime - t0 < BUFFER) { delete this.pressT[a]; return true; } return false; }
  pressed(a) { return !!this.edge[a]; }
  boostHeld() { if (G.settings.access.boostToggle) return this.boostToggled; return this.held('boost'); }
  press(a) { this.pressT[a] = G.realTime; this.edge[a] = true; if (a === 'boost' && G.settings.access.boostToggle) this.boostToggled = !this.boostToggled; }
  codePressed(c) { return this.rawPressed.has(c); }
  vibrate(ms) { if (G.settings.touch.haptics && navigator.vibrate) { try { navigator.vibrate(ms); } catch { /* ignore */ } } }
  clearAll() { this.keys.clear(); this.held_ = {}; this.pressT = {}; this.touch.held = {}; this.touch.move.x = this.touch.move.y = 0; this.boostToggled = false; }

  // ---------- keyboard ----------
  actionFor(code) { const k = G.settings.keys; const out = []; for (const a of ACTIONS) if (k[a] && (k[a][0] === code || k[a][1] === code)) out.push(a); return out; }
  bindKeyboard() {
    addEventListener('keydown', (e) => {
      if (this.rebind) { e.preventDefault(); const r = this.rebind; this.rebind = null; if (e.code !== 'Escape') { G.settings.keys[r.action][r.slot] = e.code; } r.cb && r.cb(e.code); return; }
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
      this.lastDevice = 'keyboard';
      if (!e.repeat) this.rawPressed.add(e.code);
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && G.state === 'play') e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      for (const a of this.actionFor(e.code)) { this.held_[a] = true; this.press(a); }
    });
    addEventListener('keyup', (e) => { this.keys.delete(e.code); for (const a of this.actionFor(e.code)) { this.held_[a] = false; this.rel[a] = true; } });
    addEventListener('blur', () => this.clearAll());
  }
  startRebind(action, slot, cb) { this.rebind = { action, slot, cb }; }
  // ---------- mouse ----------
  bindMouse() {
    const c = this.canvas; let dragging = false, lx = 0, ly = 0;
    c.addEventListener('mousedown', (e) => {
      if (G.state !== 'play' && G.state !== 'photo') return;
      this.lastDevice = 'keyboard';
      if (G.state === 'play' && !document.pointerLockElement && !this.isTouchUI() && e.button === 0) { try { const p = c.requestPointerLock(); p && p.catch && p.catch(() => {}); } catch { /* ignore */ } }
      const code = 'Mouse' + e.button; for (const a of this.actionFor(code)) { if (document.pointerLockElement || a !== 'attack') { this.held_[a] = true; this.press(a); } }
      dragging = true; lx = e.clientX; ly = e.clientY;
    });
    addEventListener('mouseup', (e) => { dragging = false; for (const a of this.actionFor('Mouse' + e.button)) { this.held_[a] = false; } });
    addEventListener('mousemove', (e) => {
      if (G.state !== 'play' && G.state !== 'photo') return;
      const s = 0.0022 * G.settings.camera.sens;
      if (document.pointerLockElement === c) { this.look.x += e.movementX * s; this.look.y += e.movementY * s; }
      else if (dragging && !this.isTouchUI()) { this.look.x += (e.clientX - lx) * s; this.look.y += (e.clientY - ly) * s; lx = e.clientX; ly = e.clientY; }
    });
    c.addEventListener('wheel', (e) => { if (G.state === 'play') { this.zoom += Math.sign(e.deltaY) * 0.08; e.preventDefault(); } }, { passive: false });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  // ---------- gamepad ----------
  pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : []; let gp = null;
    for (const p of pads) if (p && p.connected) { gp = p; break; }
    const ps = this.padState; ps.move.x = ps.move.y = ps.look.x = ps.look.y = 0;
    if (!gp) { ps.held = {}; return; }
    const dz = G.settings.pad.dead; const ax = (i) => { const v = gp.axes[i] || 0; return Math.abs(v) < dz ? 0 : (v - Math.sign(v) * dz) / (1 - dz); };
    ps.move.x = ax(0); ps.move.y = -ax(1); ps.look.x = ax(2) * 0.045 * G.settings.pad.sens; ps.look.y = ax(3) * 0.035 * G.settings.pad.sens;
    const map = { 0: 'jump', 1: 'spin', 2: 'attack', 3: 'special', 4: 'interact', 5: 'boost', 6: 'spin', 7: 'boost', 8: 'map', 9: 'pause', 10: 'transform', 11: 'camReset', 12: 'switchChar', 13: 'camMode' };
    const nh = {};
    for (const i in map) { const b = gp.buttons[i]; if (b && (b.pressed || b.value > 0.5)) nh[map[i]] = true; }
    for (const a in nh) if (!ps.held[a]) { this.press(a); this.lastDevice = 'pad'; }
    ps.held = nh;
    if (Math.abs(ps.move.x) + Math.abs(ps.move.y) > 0.2) this.lastDevice = 'pad';
  }
  // ---------- per-frame ----------
  update(dt) {
    this.pollPad();
    let x = 0, y = 0; const k = (a) => this.held_[a];
    if (k('left')) x -= 1; if (k('right')) x += 1; if (k('forward')) y += 1; if (k('back')) y -= 1;
    const tm = this.touch.move, pm = this.padState.move;
    if (Math.abs(tm.x) + Math.abs(tm.y) > 0.001) { x = tm.x; y = tm.y; }
    if (Math.abs(pm.x) + Math.abs(pm.y) > 0.001) { x = pm.x; y = pm.y; }
    const L = Math.hypot(x, y); if (L > 1) { x /= L; y /= L; }
    this.move.x = x; this.move.y = y;
    this.look.x += this.padState.look.x + this.touch.look.x; this.look.y += this.padState.look.y + this.touch.look.y;
    this.touch.look.x = this.touch.look.y = 0;
  }
  endFrame() { this.look.x = this.look.y = 0; this.zoom = 0; this.edge = {}; this.rel = {}; this.rawPressed.clear(); }

  // ---------- touch overlay ----------
  isTouchUI() { const s = G.settings.touch.show; return s === 'on' || (s === 'auto' && ((navigator.maxTouchPoints || 0) > 0 && matchMedia('(pointer: coarse)').matches)); }
  buildTouch() {
    const root = document.getElementById('touch');
    this.touchRoot = root; root.innerHTML = '';
    const joy = document.createElement('div'); joy.className = 'joy'; joy.innerHTML = '<div class="joy-knob"></div>'; root.append(joy); this.joyEl = joy;
    this.btnEls = {};
    for (const b of TOUCH_BUTTONS) {
      const e = document.createElement('div'); e.className = 'tbtn'; e.dataset.a = b.a; e.innerHTML = `<span>${b.icon}</span>`; e.setAttribute('role', 'button'); e.setAttribute('aria-label', t('act_' + b.a));
      root.append(e); this.btnEls[b.a] = e; e._def = b;
    }
    this.applyTouchLayout();
    const pointers = new Map(); let joyId = null, joyOx = 0, joyOy = 0;
    const st = () => G.settings.touch;
    const down = (e) => {
      if (G.state !== 'play' && !this.editing) return;
      const btn = e.target.closest && e.target.closest('.tbtn');
      if (this.editing) { const tgt = btn || (e.target.closest && e.target.closest('.joy')); if (tgt) { pointers.set(e.pointerId, { type: 'edit', el: tgt }); tgt.setPointerCapture && tgt.setPointerCapture(e.pointerId); } e.preventDefault(); return; }
      if (btn) {
        const a = btn.dataset.a; pointers.set(e.pointerId, { type: 'btn', a, el: btn }); this.touch.held[a] = true; this.press(a); btn.classList.add('on'); this.vibrate(8);
        if (a === 'camReset') G.cam && G.cam.reset();
        e.preventDefault(); return;
      }
      const w = innerWidth;
      if (e.clientX < w * 0.45 && joyId === null) {
        joyId = e.pointerId; const fixed = st().joyMode === 'fixed';
        const r = this.joyRadius();
        if (fixed) { const jb = joy.getBoundingClientRect(); joyOx = jb.left + jb.width / 2; joyOy = jb.top + jb.height / 2; }
        else { joyOx = e.clientX; joyOy = e.clientY; joy.style.left = (joyOx - r) + 'px'; joy.style.top = (joyOy - r) + 'px'; }
        joy.classList.add('active'); pointers.set(e.pointerId, { type: 'joy' }); this.joyMove(e.clientX - joyOx, e.clientY - joyOy);
      } else pointers.set(e.pointerId, { type: 'look', x: e.clientX, y: e.clientY });
      e.preventDefault();
    };
    const move = (e) => {
      const p = pointers.get(e.pointerId); if (!p) return;
      if (p.type === 'edit') { const x = clamp(e.clientX / innerWidth * 100, 3, 97), y = clamp(e.clientY / innerHeight * 100, 5, 95); if (p.el === this.joyEl) { st().layout.joy = { x, y }; this.placeJoy(); } else { p.el.style.left = x + '%'; p.el.style.top = y + '%'; st().layout[p.el.dataset.a] = { x, y }; } }
      else if (p.type === 'joy') this.joyMove(e.clientX - joyOx, e.clientY - joyOy);
      else if (p.type === 'look') { const s = 0.0055 * st().sens * G.settings.camera.sens; this.touch.look.x += (e.clientX - p.x) * s; this.touch.look.y += (e.clientY - p.y) * s * 0.8; p.x = e.clientX; p.y = e.clientY; }
      e.preventDefault();
    };
    const up = (e) => {
      const p = pointers.get(e.pointerId); if (!p) return; pointers.delete(e.pointerId);
      if (p.type === 'btn') { this.touch.held[p.a] = false; p.el.classList.remove('on'); }
      if (p.type === 'joy') { joyId = null; this.touch.move.x = this.touch.move.y = 0; this.joyRaw = { x: 0, y: 0 }; joy.classList.remove('active'); joy.querySelector('.joy-knob').style.transform = ''; if (st().joyMode !== 'fixed') this.placeJoy(); }
    };
    root.addEventListener('pointerdown', down, { passive: false });
    this.canvas.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') down(e); }, { passive: false });
    addEventListener('pointermove', move, { passive: false });
    addEventListener('pointerup', up); addEventListener('pointercancel', up);
    this.touchSmoothing();
  }
  joyRadius() { return 62 * G.settings.touch.joySize; }
  joyMove(dx, dy) {
    const r = this.joyRadius(); let L = Math.hypot(dx, dy); const k = L > r ? r / L : 1; dx *= k; dy *= k; L = Math.min(L, r);
    this.joyEl.querySelector('.joy-knob').style.transform = `translate(${dx}px,${dy}px)`;
    let m = L / r; const dz = G.settings.touch.dead; m = m < dz ? 0 : (m - dz) / (1 - dz);
    const a = Math.atan2(dy, dx);
    this.joyRaw = { x: Math.cos(a) * m, y: -Math.sin(a) * m };
  }
  touchSmoothing() {
    const tick = () => {
      const r = this.joyRaw || { x: 0, y: 0 }; const s = G.settings ? G.settings.touch.smoothing : 0.3;
      const k = 1 - s * 0.8;
      this.touch.move.x += (r.x - this.touch.move.x) * k; this.touch.move.y += (r.y - this.touch.move.y) * k;
      if (Math.abs(r.x) + Math.abs(r.y) < 0.001 && Math.abs(this.touch.move.x) + Math.abs(this.touch.move.y) < 0.02) { this.touch.move.x = this.touch.move.y = 0; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  placeJoy() {
    const r = this.joyRadius(); const j = this.joyEl; j.style.width = j.style.height = r * 2 + 'px';
    const pos = G.settings.touch.layout.joy || { x: 16, y: 72 };
    j.style.left = `calc(${pos.x}% - ${r}px)`; j.style.top = `calc(${pos.y}% - ${r}px)`;
  }
  applyTouchLayout() {
    if (!G.settings) return;
    const s = G.settings.touch; const show = this.isTouchUI();
    this.touchRoot.classList.toggle('show', show); this.touchRoot.style.setProperty('--tOp', s.opacity);
    document.documentElement.classList.toggle('touch-ui', show);
    for (const a in this.btnEls) {
      const e = this.btnEls[a]; const d = e._def; const L = s.layout[a] || d;
      const size = 64 * d.s * s.btnSize; e.style.width = e.style.height = size + 'px'; e.style.left = L.x + '%'; e.style.top = L.y + '%';
      e.style.fontSize = size * 0.42 + 'px';
    }
    this.placeJoy();
  }
  editLayout(on) { this.editing = on; this.touchRoot.classList.toggle('editing', on); if (on) this.touchRoot.classList.add('show'); else this.applyTouchLayout(); }
  resetLayout() { G.settings.touch.layout = {}; this.applyTouchLayout(); }
  setContextVisible(a, vis) { const e = this.btnEls[a]; if (e) e.classList.toggle('dim', !vis); }
}
