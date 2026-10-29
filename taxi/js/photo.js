import { clamp } from './util.js';

const $ = (id) => document.getElementById(id);
const FILTERS = [
  ['عادی', 'none'],
  ['سینمایی', 'contrast(1.18) saturate(1.25) sepia(0.12)'],
  ['سیاه و سفید', 'grayscale(1) contrast(1.2)'],
  ['قدیمی', 'sepia(0.75) contrast(1.05) brightness(0.95)'],
  ['رویایی', 'saturate(1.6) brightness(1.08) hue-rotate(-12deg)'],
];

/** Photo mode: frozen world, free orbit camera, filters, save as PNG. */
export class Photo {
  constructor(game) {
    this.g = game;
    this.yaw = 0;
    this.pitch = 0.25;
    this.dist = 8;
    this.filter = 0;
    const el = $('photo');
    let drag = null;
    const pts = new Map();
    el.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      drag = { x: e.clientX, y: e.clientY };
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      const prev = pts.get(e.pointerId);
      if (pts.size >= 2) {
        // pinch zoom
        const [a, b] = [...pts.values()];
        const d0 = Math.hypot(a.x - b.x, a.y - b.y);
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const [c, d] = [...pts.values()];
        const d1 = Math.hypot(c.x - d.x, c.y - d.y);
        if (d0 > 0) this.dist = clamp(this.dist * (d0 / d1), 2.5, 40);
        return;
      }
      this.yaw -= (e.clientX - prev.x) * 0.008;
      this.pitch = clamp(this.pitch + (e.clientY - prev.y) * 0.006, -0.15, 1.45);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    });
    const up = (e) => {
      pts.delete(e.pointerId);
      if (!pts.size) drag = null;
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.dist = clamp(this.dist * (e.deltaY > 0 ? 1.1 : 0.9), 2.5, 40);
    }, { passive: false });
    $('phShot').onclick = () => this.capture();
    $('phFilter').onclick = () => this.cycleFilter();
    $('phExit').onclick = () => this.close();
    $('phView').onclick = (e) => {
      if (e.target === $('phView') || e.target.closest('.phclose')) $('phView').classList.add('hidden');
    };
  }
  open() {
    const g = this.g;
    if (g.state !== 'play' || g.ui.panelOpen) return;
    g.state = 'photo';
    const f = g.focus();
    // start behind the car / walker
    this.yaw = f.heading + Math.PI;
    this.pitch = 0.22;
    this.dist = g.onfoot.active ? 4.5 : 8;
    g.ui.resetInputs();
    g.audio.setEngine(0, 0, false);
    g.audio.setSkid(0);
    g.audio.siren(false);
    document.body.classList.add('photomode');
    $('photo').classList.remove('hidden');
    this.applyFilter();
    g.ui.toast('📸 حالت عکاسی: بکش تا دور بچرخی، با دو انگشت زوم کن', 'info');
  }
  close() {
    const g = this.g;
    if (g.state !== 'photo') return;
    g.state = 'play';
    document.body.classList.remove('photomode');
    $('photo').classList.add('hidden');
    $('phView').classList.add('hidden');
    g.renderer.domElement.style.filter = '';
    if (g.police.state === 'chase') g.audio.siren(true);
  }
  cycleFilter() {
    this.filter = (this.filter + 1) % FILTERS.length;
    this.applyFilter();
  }
  applyFilter() {
    this.g.renderer.domElement.style.filter = FILTERS[this.filter][1] === 'none' ? '' : FILTERS[this.filter][1];
    $('phFilter').textContent = '🎨 ' + FILTERS[this.filter][0];
  }
  update() {
    const g = this.g, f = g.focus(), cam = g.camera;
    const ty = (f.onFoot ? g.world.heightAt(f.pos.x, f.pos.z) : g.player.y) + 1;
    const cp = Math.cos(this.pitch);
    let x = f.pos.x + Math.sin(this.yaw) * cp * this.dist, z = f.pos.z + Math.cos(this.yaw) * cp * this.dist;
    let y = ty + Math.sin(this.pitch) * this.dist;
    y = Math.max(y, g.world.heightAt(x, z) + 0.4);
    cam.position.set(x, y, z);
    cam.lookAt(f.pos.x, ty, f.pos.z);
    if (cam.fov !== 55) {
      cam.fov = 55;
      cam.updateProjectionMatrix();
    }
    g.sky.mesh.position.copy(cam.position);
  }
  capture() {
    const g = this.g;
    // render and read back in the same task (no preserveDrawingBuffer needed)
    g.renderer.render(g.scene, g.camera);
    const src = g.renderer.domElement;
    const c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    const ctx = c.getContext('2d');
    const flt = FILTERS[this.filter][1];
    if (flt !== 'none') ctx.filter = flt;
    ctx.drawImage(src, 0, 0);
    ctx.filter = 'none';
    // watermark
    const s = Math.max(14, Math.round(c.height * 0.035));
    ctx.font = `bold ${s}px Vazirmatn, Tahoma, sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.direction = 'rtl';
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillText('🚕 تاکسی‌ران شهر', c.width - s * 0.6 + 2, c.height - s * 0.5 + 2);
    ctx.fillStyle = '#ffd21a';
    ctx.fillText('🚕 تاکسی‌ران شهر', c.width - s * 0.6, c.height - s * 0.5);
    let url;
    try {
      url = c.toDataURL('image/png');
    } catch (e) {
      g.ui.toast('ذخیره عکس روی این مرورگر نشد 😕', 'warn');
      return;
    }
    // flash + shutter
    g.ui.flash();
    g.audio.burst(0.06, 3000, 'highpass', 0.4);
    g.audio.burst(0.1, 900, 'lowpass', 0.3);
    const name = `taxi-city-${Date.now()}.png`;
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // also show it, so phones can long-press to save
    $('phImg').src = url;
    $('phDl').href = url;
    $('phDl').download = name;
    $('phView').classList.remove('hidden');
    g.stats.photos = (g.stats.photos || 0) + 1;
  }
}
