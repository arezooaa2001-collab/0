// Unified input: multi-touch mobile controls (floating analog slider, virtual steering wheel,
// buttons or device tilt), keyboard and gamepad. Raw inputs are shaped into smooth, natural
// steering / pedal signals (speed-sensitive steering rate, pedal ramps, auto-centering).

import { clamp, approach, damp, wrapAngle, isTouchDevice } from '../core/utils.js';

const WHEEL_LOCK = (150 * Math.PI) / 180;

export class Input {
  constructor(host, getSettings) {
    this.host = host;
    this.getSettings = getSettings;
    this.out = { steer: 0, throttle: 0, brake: 0, handbrake: false, nitro: false };
    this.enabled = false;
    this.keys = new Set();
    this.pointers = new Map();
    this.touch = { steer: 0, steerActive: false, gas: 0, brake: 0, nitro: false, handbrake: false, left: false, right: false };
    this.wheelAngle = 0;
    this.tilt = { raw: 0, center: 0, has: false, value: 0 };
    this.analogSteer = 0;
    this.lastSource = isTouchDevice() ? 'touch' : 'keyboard';
    this.handlers = { pause: null, camera: null, respawn: null };
    this.#buildTouchUI();
    this.#bind();
  }

  on(event, fn) {
    this.handlers[event] = fn;
  }

  #emit(event) {
    this.handlers[event]?.();
  }

  // ------------------------------------------------------------------------------------------
  #buildTouchUI() {
    const el = document.createElement('div');
    el.className = 'touch-ui';
    el.innerHTML = `
      <div class="steer-area" data-zone="steer">
        <div class="steer-ring"><div class="steer-knob"></div></div>
        <div class="steer-hint">برای فرمان، انگشت را چپ و راست بکشید</div>
      </div>
      <div class="steer-wheel" data-zone="wheel">
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <defs><radialGradient id="wg" cx="50%" cy="40%"><stop offset="0" stop-color="#3a3f4a"/><stop offset="1" stop-color="#14161b"/></radialGradient></defs>
          <circle cx="100" cy="100" r="88" fill="none" stroke="url(#wg)" stroke-width="22"/>
          <circle cx="100" cy="100" r="88" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="2"/>
          <path d="M100 100 L26 112 A75 75 0 0 1 32 80 Z" fill="#1d2027"/>
          <path d="M100 100 L174 112 A75 75 0 0 0 168 80 Z" fill="#1d2027"/>
          <path d="M100 100 L86 176 A78 78 0 0 0 114 176 Z" fill="#1d2027"/>
          <circle cx="100" cy="100" r="26" fill="#22252d" stroke="#e11d48" stroke-width="3"/>
          <rect x="94" y="8" width="12" height="20" rx="3" fill="#e11d48"/>
        </svg>
      </div>
      <div class="steer-buttons">
        <div class="tbtn" data-act="left" aria-label="چپ">◀</div>
        <div class="tbtn" data-act="right" aria-label="راست">▶</div>
      </div>
      <div class="pedal-group">
        <div class="aux">
          <div class="abtn nitro" data-act="nitro"><b>N₂O</b><small>نیترو</small></div>
          <div class="abtn hb" data-act="handbrake"><b>⏚</b><small>دستی</small></div>
        </div>
        <div class="pedals">
          <div class="pedal brake" data-act="brake" data-pedal="1"><i></i><span>ترمز</span></div>
          <div class="pedal gas" data-act="gas" data-pedal="1"><i></i><span>گاز</span></div>
        </div>
      </div>`;
    this.host.appendChild(el);
    this.ui = el;
    this.ring = el.querySelector('.steer-ring');
    this.knob = el.querySelector('.steer-knob');
    this.wheelEl = el.querySelector('.steer-wheel');
    this.wheelSvg = el.querySelector('.steer-wheel svg');
    this.pedalEls = [...el.querySelectorAll('[data-pedal]')];
  }

  applySettings() {
    const s = this.getSettings();
    this.ui.dataset.mode = s.controlMode;
    this.ui.dataset.side = s.pedalSide;
    this.ui.style.setProperty('--btn-scale', s.buttonScale);
    this.ui.dataset.autogas = s.autoAccel ? '1' : '0';
  }

  setTouchVisible(v) {
    this.ui.classList.toggle('visible', v);
  }

  setEnabled(v) {
    this.enabled = v;
    if (!v) this.reset();
  }

  reset() {
    this.keys.clear();
    this.pointers.clear();
    Object.assign(this.touch, { steer: 0, steerActive: false, gas: 0, brake: 0, nitro: false, handbrake: false, left: false, right: false });
    Object.assign(this.out, { steer: 0, throttle: 0, brake: 0, handbrake: false, nitro: false });
    this.wheelAngle = 0;
    this.analogSteer = 0;
    this.ring?.classList.remove('active');
    this.ui?.querySelectorAll('.pressed').forEach((e) => e.classList.remove('pressed'));
  }

  // ------------------------------------------------------------------------------------------
  #bind() {
    this._onKeyDown = (e) => {
      if (e.repeat) return;
      const k = e.code;
      this.keys.add(k);
      this.lastSource = 'keyboard';
      if (!this.enabled) return;
      if (k === 'KeyP' || k === 'Escape') this.#emit('pause');
      else if (k === 'KeyC') this.#emit('camera');
      else if (k === 'KeyR') this.#emit('respawn');
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(k)) e.preventDefault();
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onBlur = () => this.reset();
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);

    this._onDown = (e) => {
      if (!this.enabled) return;
      const target = e.target.closest('[data-act],[data-zone]');
      if (!target || !this.ui.contains(target)) return;
      e.preventDefault();
      this.lastSource = 'touch';
      const act = target.dataset.act || target.dataset.zone;
      const p = { act, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, el: target };
      if (act === 'steer') {
        p.ox = e.clientX;
        this.ring.style.left = `${e.clientX}px`;
        this.ring.style.top = `${e.clientY}px`;
        this.ring.classList.add('active');
        this.touch.steerActive = true;
      } else if (act === 'wheel') {
        const r = this.wheelEl.getBoundingClientRect();
        p.cx = r.left + r.width / 2;
        p.cy = r.top + r.height / 2;
        p.last = Math.atan2(e.clientY - p.cy, e.clientX - p.cx);
        this.touch.steerActive = true;
      }
      this.pointers.set(e.pointerId, p);
      this.#refreshTouch();
      if ((act === 'nitro' || act === 'handbrake')) this.vibrate(8);
    };
    this._onMove = (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      e.preventDefault();
      p.x = e.clientX;
      p.y = e.clientY;
      if (p.act === 'gas' || p.act === 'brake') {
        // sliding a finger between the pedals switches pedal, like a real foot
        for (const el of this.pedalEls) {
          const r = el.getBoundingClientRect();
          if (e.clientX >= r.left - 14 && e.clientX <= r.right + 14 && e.clientY >= r.top - 30 && e.clientY <= r.bottom + 14) {
            p.act = el.dataset.act;
            p.el = el;
            break;
          }
        }
      }
      this.#refreshTouch();
    };
    this._onUp = (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      this.pointers.delete(e.pointerId);
      if (p.act === 'steer') this.ring.classList.remove('active');
      this.#refreshTouch();
    };
    this.ui.addEventListener('pointerdown', this._onDown, { passive: false });
    window.addEventListener('pointermove', this._onMove, { passive: false });
    window.addEventListener('pointerup', this._onUp);
    window.addEventListener('pointercancel', this._onUp);
    this.ui.addEventListener('contextmenu', (e) => e.preventDefault());

    this._onOrient = (e) => {
      if (e.beta == null || e.gamma == null) return;
      const angle = (screen.orientation && screen.orientation.angle) ?? window.orientation ?? 0;
      let v;
      if (angle === 90) v = e.beta;
      else if (angle === -90 || angle === 270) v = -e.beta;
      else if (angle === 180) v = -e.gamma;
      else v = e.gamma;
      this.tilt.raw = v;
      if (!this.tilt.has) { this.tilt.center = v; this.tilt.has = true; }
    };
    window.addEventListener('deviceorientation', this._onOrient);
  }

  #refreshTouch() {
    const t = this.touch;
    const s = this.getSettings();
    t.gas = 0; t.brake = 0; t.nitro = false; t.handbrake = false; t.left = false; t.right = false;
    let steerActive = false;
    this.ui.querySelectorAll('.pressed').forEach((e) => e.classList.remove('pressed'));
    const scale = s.buttonScale || 1;
    for (const p of this.pointers.values()) {
      p.el?.classList.add('pressed');
      switch (p.act) {
        case 'gas': {
          // analog depth: pressing nearer the top of the pedal gives full throttle
          const r = p.el.getBoundingClientRect();
          const depth = clamp(1.25 - (p.y - r.top) / r.height * 0.5, 0.75, 1);
          t.gas = Math.max(t.gas, depth);
          break;
        }
        case 'brake': t.brake = 1; break;
        case 'nitro': t.nitro = true; break;
        case 'handbrake': t.handbrake = true; break;
        case 'left': t.left = true; break;
        case 'right': t.right = true; break;
        case 'steer': {
          const R = 62 * scale;
          let dx = p.x - p.ox;
          if (Math.abs(dx) > R) { p.ox += dx - Math.sign(dx) * R; dx = Math.sign(dx) * R; }
          const v = dx / R;
          t.steer = Math.sign(v) * Math.abs(v) ** 1.2;
          this.knob.style.transform = `translateX(${dx}px)`;
          this.ring.style.left = `${p.ox}px`;
          steerActive = true;
          break;
        }
        case 'wheel': {
          const a = Math.atan2(p.y - p.cy, p.x - p.cx);
          this.wheelAngle = clamp(this.wheelAngle + wrapAngle(a - p.last), -WHEEL_LOCK, WHEEL_LOCK);
          p.last = a;
          t.steer = this.wheelAngle / WHEEL_LOCK;
          steerActive = true;
          break;
        }
        default:
          break;
      }
    }
    t.steerActive = steerActive;
    if (!steerActive) {
      t.steer = 0;
      this.knob.style.transform = 'translateX(0px)';
    }
  }

  async requestTiltPermission() {
    try {
      const D = window.DeviceOrientationEvent;
      if (D && typeof D.requestPermission === 'function') {
        const res = await D.requestPermission();
        return res === 'granted';
      }
      return !!D;
    } catch {
      return false;
    }
  }

  calibrateTilt() {
    this.tilt.center = this.tilt.raw;
  }

  // ------------------------------------------------------------------------------------------
  /** Produces the final control state for this frame. */
  update(dt, speed) {
    const o = this.out;
    if (!this.enabled) return o;
    const s = this.getSettings();
    const k = this.keys;
    const t = this.touch;

    // ---- steering targets -------------------------------------------------------------------
    let digital = 0;
    if (k.has('ArrowLeft') || k.has('KeyA') || t.left) digital -= 1;
    if (k.has('ArrowRight') || k.has('KeyD') || t.right) digital += 1;

    let analog = null;
    const gp = this.#gamepad();
    if (gp && Math.abs(gp.steer) > 0.08) analog = gp.steer;
    if (t.steerActive) analog = t.steer;
    if (s.controlMode === 'tilt' && this.tilt.has && this.lastSource === 'touch') {
      const max = 26 / (s.tiltSensitivity || 1);
      let d = this.tilt.raw - this.tilt.center;
      d = Math.abs(d) < 1.2 ? 0 : d - Math.sign(d) * 1.2;
      this.tilt.value = damp(this.tilt.value, clamp(d / max, -1, 1), 14, dt);
      if (digital === 0) analog = this.tilt.value;
    }

    const speedK = clamp(speed / 50, 0, 1);
    if (digital !== 0 || analog === null) {
      // keyboard-style: ramp in progressively, auto-centre quickly; slower at high speed
      const target = digital;
      const toward = Math.sign(target) === Math.sign(o.steer) || o.steer === 0;
      const rate = target === 0 ? 5.5 : toward ? 3.2 - 1.4 * speedK : 7;
      o.steer = approach(o.steer, target, rate * dt);
    } else {
      const sens = s.controlMode === 'tilt' ? 1 : s.steerSensitivity || 1;
      const target = clamp(analog * sens, -1, 1);
      o.steer = damp(o.steer, target, 16, dt);
    }
    // virtual wheel springs back when released
    if (s.controlMode === 'wheel' && !t.steerActive) this.wheelAngle = damp(this.wheelAngle, 0, 9, dt);
    if (this.wheelSvg) this.wheelSvg.style.transform = `rotate(${(this.wheelAngle * 180) / Math.PI}deg)`;

    // ---- pedals --------------------------------------------------------------------------------
    let gas = Math.max(t.gas, k.has('ArrowUp') || k.has('KeyW') ? 1 : 0, gp ? gp.gas : 0);
    const brake = Math.max(t.brake, k.has('ArrowDown') || k.has('KeyS') ? 1 : 0, gp ? gp.brake : 0);
    if (s.autoAccel && brake < 0.1 && this.lastSource === 'touch') gas = 1;
    o.throttle = gas > o.throttle ? approach(o.throttle, gas, 6 * dt) : approach(o.throttle, gas, 10 * dt);
    o.brake = brake > o.brake ? approach(o.brake, brake, 8 * dt) : approach(o.brake, brake, 12 * dt);
    o.handbrake = t.handbrake || k.has('Space') || !!(gp && gp.handbrake);
    o.nitro = t.nitro || k.has('ShiftLeft') || k.has('ShiftRight') || k.has('KeyN') || !!(gp && gp.nitro);
    return o;
  }

  #gamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const b = (i) => (p.buttons[i] ? p.buttons[i].value || (p.buttons[i].pressed ? 1 : 0) : 0);
      const res = {
        steer: p.axes[0] || 0,
        gas: b(7),
        brake: b(6),
        nitro: b(0) > 0.5 || b(5) > 0.5,
        handbrake: b(1) > 0.5 || b(4) > 0.5,
      };
      const pause = b(9) > 0.5, cam = b(3) > 0.5, resp = b(8) > 0.5;
      if (pause && !this._gpPause) this.#emit('pause');
      if (cam && !this._gpCam) this.#emit('camera');
      if (resp && !this._gpResp) this.#emit('respawn');
      this._gpPause = pause; this._gpCam = cam; this._gpResp = resp;
      if (Math.abs(res.steer) > 0.1 || res.gas > 0.1 || res.brake > 0.1) this.lastSource = 'gamepad';
      return res;
    }
    return null;
  }

  vibrate(ms) {
    if (this.lastSource === 'touch' && this.getSettings().haptics && navigator.vibrate) {
      try { navigator.vibrate(ms); } catch { /* ignore */ }
    }
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    window.removeEventListener('pointermove', this._onMove);
    window.removeEventListener('pointerup', this._onUp);
    window.removeEventListener('pointercancel', this._onUp);
    window.removeEventListener('deviceorientation', this._onOrient);
    this.ui.remove();
  }
}
