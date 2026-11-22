// ورودی: صفحه‌کلید و دکمه‌های لمسی
export class Input {
  constructor() {
    this.keys = new Set();
    this.touch = { left: false, right: false, gas: false, brake: false, nitro: false, hand: false };
    this.state = { steer: 0, throttle: 0, brake: 0, handbrake: false, nitro: false };
    this.pressed = new Set();
    this.look = 0; this.lookTarget = 0;
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT')) return;
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); for (const k in this.touch) this.touch[k] = false; });
  }
  bindTouch(root) {
    root.querySelectorAll('[data-touch]').forEach((el) => {
      const k = el.dataset.touch;
      const on = (e) => { e.preventDefault(); this.touch[k] = true; el.classList.add('on'); };
      const off = (e) => { e.preventDefault(); this.touch[k] = false; el.classList.remove('on'); };
      el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('pointerleave', off);
    });
  }
  consume(code) { const had = this.pressed.has(code); this.pressed.delete(code); return had; }
  update() {
    const k = this.keys, t = this.touch;
    const left = k.has('ArrowLeft') || k.has('KeyA') || t.left;
    const right = k.has('ArrowRight') || k.has('KeyD') || t.right;
    this.state.steer = (left ? 1 : 0) - (right ? 1 : 0);
    this.state.throttle = (k.has('ArrowUp') || k.has('KeyW') || t.gas) ? 1 : 0;
    this.state.brake = (k.has('ArrowDown') || k.has('KeyS') || t.brake) ? 1 : 0;
    this.state.handbrake = k.has('Space') || t.hand;
    this.state.nitro = k.has('ShiftLeft') || k.has('ShiftRight') || k.has('KeyN') || t.nitro;
    this.lookTarget = (k.has('KeyQ') ? 1 : 0) - (k.has('KeyE') ? 1 : 0);
    return this.state;
  }
  clearPressed() { this.pressed.clear(); }
}
