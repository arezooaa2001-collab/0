// ورودی: صفحه‌کلید، موس (قفل نشانگر)، لمس (جوی‌استیک پویا + دکمه‌ها)، دسته بازی
export class Input {
  constructor(canvas, touchUI) {
    this.canvas = canvas;
    this.keys = new Set();
    this.camDX = 0;
    this.camDY = 0;
    this.jumpQueued = false;
    this.slideQueued = false;
    this.jumpTouch = false;
    this.slideTouch = false;
    this.joy = { active: false, id: -1, x: 0, y: 0, ox: 0, oy: 0 };
    this.lookTouch = { id: -1, x: 0, y: 0 };
    this.enabled = true;
    this.pointerLocked = false;
    this.dragMouse = false;
    this.touchUI = touchUI;
    this.onPause = null;
    this.onChat = null;
    this.bind();
  }

  bind() {
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      const k = e.code;
      if (k === 'Space' || k.startsWith('Arrow')) e.preventDefault();
      if (!this.keys.has(k)) {
        if (k === 'Space') this.jumpQueued = true;
        if (k === 'ShiftLeft' || k === 'ShiftRight' || k === 'KeyC' || k === 'ControlLeft') this.slideQueued = true;
        if (k === 'Escape' || k === 'KeyP') this.onPause && this.onPause();
        if (k === 'Enter' || k === 'KeyT') {
          e.preventDefault();
          this.onChat && this.onChat();
        }
      }
      this.keys.add(k);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    const c = this.canvas;
    c.addEventListener('mousedown', (e) => {
      if (!this.enabled || e.pointerType === 'touch') return;
      if (e.button === 0 && !this.pointerLocked && this.allowLock) {
        try {
          const r = c.requestPointerLock && c.requestPointerLock();
          if (r && r.catch) r.catch(() => {});
        } catch (err) { /* ignore */ }
      }
      this.dragMouse = true;
    });
    window.addEventListener('mouseup', () => (this.dragMouse = false));
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === c;
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      if (this.pointerLocked || this.dragMouse) {
        this.camDX += e.movementX;
        this.camDY += e.movementY;
      }
    });

    // لمس
    const T = this.touchUI;
    if (!T) return;
    const zone = T.zone;
    zone.addEventListener('touchstart', (e) => {
      if (!this.enabled) return;
      for (const t of e.changedTouches) {
        const left = t.clientX < window.innerWidth * 0.45;
        if (left && !this.joy.active) {
          this.joy = { active: true, id: t.identifier, x: 0, y: 0, ox: t.clientX, oy: t.clientY };
          T.showJoy(t.clientX, t.clientY);
        } else if (this.lookTouch.id === -1) {
          this.lookTouch = { id: t.identifier, x: t.clientX, y: t.clientY };
        }
      }
      e.preventDefault();
    }, { passive: false });
    zone.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joy.id) {
          const R = 52;
          let dx = t.clientX - this.joy.ox, dy = t.clientY - this.joy.oy;
          const l = Math.hypot(dx, dy);
          if (l > R) {
            // جوی‌استیک دنبال انگشت می‌آید
            this.joy.ox += (dx / l) * (l - R);
            this.joy.oy += (dy / l) * (l - R);
            dx = t.clientX - this.joy.ox; dy = t.clientY - this.joy.oy;
            T.moveJoyBase(this.joy.ox, this.joy.oy);
          }
          this.joy.x = dx / R;
          this.joy.y = dy / R;
          T.moveKnob(dx, dy);
        } else if (t.identifier === this.lookTouch.id) {
          this.camDX += (t.clientX - this.lookTouch.x) * 1.6;
          this.camDY += (t.clientY - this.lookTouch.y) * 1.6;
          this.lookTouch.x = t.clientX;
          this.lookTouch.y = t.clientY;
        }
      }
      e.preventDefault();
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joy.id) {
          this.joy = { active: false, id: -1, x: 0, y: 0, ox: 0, oy: 0 };
          T.hideJoy();
        }
        if (t.identifier === this.lookTouch.id) this.lookTouch = { id: -1, x: 0, y: 0 };
      }
    };
    zone.addEventListener('touchend', end);
    zone.addEventListener('touchcancel', end);
    const btn = (el, down, up) => {
      el.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); el.classList.add('pressed'); down(); }, { passive: false });
      const u = (e) => { e.preventDefault(); el.classList.remove('pressed'); up(); };
      el.addEventListener('touchend', u);
      el.addEventListener('touchcancel', u);
      el.addEventListener('mousedown', (e) => { e.preventDefault(); down(); });
      el.addEventListener('mouseup', () => up());
    };
    btn(T.jump, () => { this.jumpQueued = true; this.jumpTouch = true; }, () => (this.jumpTouch = false));
    btn(T.slide, () => { this.slideQueued = true; this.slideTouch = true; }, () => (this.slideTouch = false));
  }

  // خواندن ورودی نسبت به جهت دوربین
  read(camYaw) {
    const k = this.keys;
    let mx = 0, my = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) my += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) my -= 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) mx -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) mx += 1;
    if (this.joy.active) {
      let jx = this.joy.x, jy = -this.joy.y;
      const jm = Math.hypot(jx, jy);
      if (jm < 0.14) { jx = 0; jy = 0; }
      else {
        // اگر انگشت تقریباً مستقیم است، دقیقاً مستقیم برو (بدون کشیده شدن به چپ و راست)
        let a = Math.atan2(jx, jy);
        const snap = Math.PI / 2;
        const near = Math.round(a / snap) * snap;
        if (Math.abs(a - near) < 0.24) a = near;
        const k = Math.min(1, (jm - 0.14) / 0.76);
        jx = Math.sin(a) * k; jy = Math.cos(a) * k;
      }
      mx += jx;
      my += jy;
    }
    let jumpHeld = k.has('Space') || this.jumpTouch;
    let slideHeld = this.slideTouch || k.has('ShiftLeft') || k.has('KeyC');
    // دسته بازی
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads) {
      if (!gp) continue;
      const dz = (v) => (Math.abs(v) < 0.15 ? 0 : v);
      mx += dz(gp.axes[0] || 0);
      my -= dz(gp.axes[1] || 0);
      this.camDX += dz(gp.axes[2] || 0) * 14;
      this.camDY += dz(gp.axes[3] || 0) * 10;
      const a = gp.buttons[0] && gp.buttons[0].pressed;
      const b = (gp.buttons[1] && gp.buttons[1].pressed) || (gp.buttons[7] && gp.buttons[7].pressed);
      if (a && !this._padA) this.jumpQueued = true;
      if (b && !this._padB) this.slideQueued = true;
      if (gp.buttons[9] && gp.buttons[9].pressed && !this._padStart) this.onPause && this.onPause();
      this._padA = a; this._padB = b; this._padStart = gp.buttons[9] && gp.buttons[9].pressed;
      jumpHeld = jumpHeld || a;
    }
    let mag = Math.hypot(mx, my);
    if (mag > 1) { mx /= mag; my /= mag; mag = 1; }
    // تبدیل به جهان: جلو = جهت دوربین
    const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
    const rx = -fz, rz = fx;
    const out = {
      x: fx * my + rx * mx,
      z: fz * my + rz * mx,
      mag,
      jump: this.jumpQueued,
      jumpHeld,
      slide: this.slideQueued || false,
      slideHeld,
      camDX: this.camDX,
      camDY: this.camDY,
    };
    this.jumpQueued = false;
    this.slideQueued = false;
    this.camDX = 0;
    this.camDY = 0;
    if (!this.enabled) { out.x = out.z = out.mag = 0; out.jump = out.slide = false; }
    return out;
  }
}
