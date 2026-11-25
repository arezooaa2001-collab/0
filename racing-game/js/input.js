// ورودی: صفحه‌کلید، دکمه‌های لمسی (گاز، دنده عقب، ترمز، دریفت) و جوی‌استیک رانندگی
export class Input {
  constructor() {
    this.keys = new Set();
    this.touch = { left: false, right: false, gas: false, brake: false, rev: false, drift: false, nitro: false };
    this.state = { steer: 0, throttle: 0, brake: 0, reverse: 0, brakeRev: 0, drift: false, handbrake: false, nitro: false, touch: false };
    this.joy = { x: 0, y: 0, active: false };
    this.pressed = new Set();
    this.look = 0; this.lookTarget = 0;
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT')) return;
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); for (const k in this.touch) this.touch[k] = false; this.joy.x = this.joy.y = 0; this.joy.active = false; });
  }
  bindTouch(root) {
    root.querySelectorAll('[data-touch]').forEach((el) => {
      const k = el.dataset.touch;
      const on = (e) => { e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ } this.touch[k] = true; el.classList.add('on'); navigator.vibrate?.(8); };
      const off = (e) => { e.preventDefault(); this.touch[k] = false; el.classList.remove('on'); };
      el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('pointerleave', off);
    });
  }
  // جوی‌استیک رانندگی: بالا = جلو، پایین = ترمز و دنده عقب، چپ و راست = فرمان
  bindJoystick(el, knob, target = this.joy) {
    let id = null, c = null;
    const move = (e) => {
      if (e.pointerId !== id) return;
      let dx = (e.clientX - c.x) / c.R, dy = (e.clientY - c.y) / c.R; const L = Math.hypot(dx, dy); if (L > 1) { dx /= L; dy /= L; }
      target.x = dx; target.y = dy; target.active = true; knob.style.transform = `translate(${dx * c.R * 0.55}px, ${dy * c.R * 0.55}px)`;
    };
    const end = (e) => { if (e.pointerId !== id) return; id = null; target.x = 0; target.y = 0; target.active = false; knob.style.transform = ''; el.classList.remove('on'); };
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); id = e.pointerId; el.setPointerCapture(id); const r = el.getBoundingClientRect(); c = { x: r.left + r.width / 2, y: r.top + r.height / 2, R: r.width / 2 }; el.classList.add('on'); move(e); });
    el.addEventListener('pointermove', move); el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  }
  consume(code) { const had = this.pressed.has(code); this.pressed.delete(code); return had; }
  update(extraJoy = null) {
    const k = this.keys, t = this.touch, s = this.state;
    const j = extraJoy && extraJoy.active ? extraJoy : this.joy;
    const dz = (v) => (Math.abs(v) < 0.12 ? 0 : (v - Math.sign(v) * 0.12) / 0.88);
    const jx = j.active ? dz(j.x) : 0, jy = j.active ? dz(j.y) : 0;
    const left = k.has('ArrowLeft') || k.has('KeyA') || t.left;
    const right = k.has('ArrowRight') || k.has('KeyD') || t.right;
    s.steer = Math.max(-1, Math.min(1, (left ? 1 : 0) - (right ? 1 : 0) - jx * 1.15));
    s.throttle = Math.max((k.has('ArrowUp') || k.has('KeyW') || t.gas) ? 1 : 0, Math.min(1, Math.max(0, -jy * 1.25)));
    s.brake = t.brake ? 1 : 0;                     // دکمه ترمز: فقط ترمز
    s.reverse = t.rev ? 1 : 0;                     // دکمه دنده عقب
    s.brakeRev = Math.max((k.has('ArrowDown') || k.has('KeyS')) ? 1 : 0, Math.min(1, Math.max(0, jy * 1.25))); // کلید پایین و کشیدن جوی‌استیک به عقب: ترمز و بعد دنده عقب
    s.drift = k.has('Space') || t.drift;
    s.handbrake = false;
    s.nitro = k.has('ShiftLeft') || k.has('ShiftRight') || k.has('KeyN') || t.nitro;
    s.touch = t.gas || t.brake || t.rev || t.left || t.right || t.drift || j.active;
    this.lookTarget = (k.has('KeyQ') ? 1 : 0) - (k.has('KeyE') ? 1 : 0);
    return s;
  }
  clearPressed() { this.pressed.clear(); }
}
