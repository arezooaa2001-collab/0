'use strict';
/*
 * Round seventeen: running smoothly on any device.
 *  - People far from the camera wear a lighter body (a third of the triangles).
 *  - People far away or behind the camera think and animate less often (10-20 times a second),
 *    which nobody can see; everyone close and in view updates every frame as before.
 *  - The picture's resolution follows the frame rate: it drops a little when the device
 *    struggles and comes back when there is room; on a really slow device the extra effects
 *    (faces, motes, reflections, sun rays) switch themselves off.
 */

const PERF = {
  lodFar: { go: 9, plus: 16, pro: 22, ultra: 30, pc: 38 },
  // states that are safe to update at a lower rate (no tight timing with the player)
  lodStates: new Set(['idle', 'walk', 'jog', 'exercise', 'chat', 'leave', 'fan', 'knocked']),
};
const _camFwd = new THREE.Vector3();

/* ---------- a lighter body far away ---------- */

Object.assign(Character.prototype, {
  setLod(on) {
    if (!!this.lodOn === on) return;
    if (on) {
      if (!this.lodGeo) this.lodGeo = buildCharGeometry(this.o, this.mq / 8, true);
      this.fullGeo = this.mesh.geometry;
      this.mesh.geometry = this.lodGeo;
    } else {
      this.mesh.geometry = this.fullGeo || this.mesh.geometry;
    }
    this.lodOn = on;
  },
});

const _setMuscle17 = Character.prototype.setMuscle;
Character.prototype.setMuscle = function (m) {
  // the muscles change the body: whichever light body there was is out of date
  if (this.lodOn) this.setLod(false);
  _setMuscle17.call(this, m);
  if (this.lodGeo) { this.lodGeo.dispose(); this.lodGeo = null; }
};

const _charDispose17 = Character.prototype.dispose;
Character.prototype.dispose = function () {
  const other = this.lodOn ? this.fullGeo : this.lodGeo;
  _charDispose17.call(this);
  if (other && other !== this.mesh.geometry) other.dispose();
  this.lodGeo = null;
};

const _charUpdate17 = Character.prototype.update;
Character.prototype.update = function (dt) {
  _charUpdate17.call(this, dt);
  // look again a few times a second: near the camera full detail, far away the light body
  this.lodT = (this.lodT || 0) - dt;
  if (this.lodT > 0) return;
  this.lodT = 0.4 + Math.random() * 0.2;
  const cam = Game.camera;
  if (!cam || this.isPlayerBody || (Game.player && Game.player.ch === this)) { this.setLod(false); return; }
  const p = this.root.position, c = cam.position;
  const far = PERF.lodFar[Game.graphicsKey ? Game.graphicsKey() : 'plus'] || 18;
  const d2 = (p.x - c.x) ** 2 + (p.z - c.z) ** 2;
  // a little band in between so nobody flickers between the two
  if (!this.lodOn && d2 > (far + 1.5) ** 2) this.setLod(true);
  else if (this.lodOn && d2 < (far - 1.5) ** 2) this.setLod(false);
};

/* ---------- thinking less often where nobody looks ---------- */

const _updateNpc17 = WorldBase.prototype.updateNpc;
WorldBase.prototype.updateNpc = function (n, dt) {
  const cam = Game.camera;
  if (this !== Game.world || !cam || !PERF.lodStates.has(n.state) || Game.mode !== 'play') { n.lodAcc = 0; return _updateNpc17.call(this, n, dt); }
  if (Game.camFwdT !== Game.clock) { Game.camFwdT = Game.clock; cam.getWorldDirection(_camFwd); }
  const p = n.ch.root.position, c = cam.position;
  const dx = p.x - c.x, dz = p.z - c.z;
  const d2 = dx * dx + dz * dz;
  const behind = dx * _camFwd.x + dz * _camFwd.z < -3;
  let every = 0;
  if (behind && d2 > 100) every = 0.1;
  else if (d2 > 2500) every = 0.1;
  else if (d2 > 900) every = 0.05;
  if (!every) { n.lodAcc = 0; return _updateNpc17.call(this, n, dt); }
  n.lodAcc = (n.lodAcc || 0) + dt;
  if (n.lodAcc < every) return undefined;
  const t = Math.min(n.lodAcc, 0.25);
  n.lodAcc = 0;
  return _updateNpc17.call(this, n, t);
};

/* ---------- the picture follows the frame rate ---------- */

Object.assign(Game, {
  watchFps(dt) {
    this.fpsT = (this.fpsT || 0) + dt;
    this.fpsN = (this.fpsN || 0) + 1;
    if (this.fpsT < 2) return;
    const fps = this.fpsN / this.fpsT;
    this.fpsT = 0;
    this.fpsN = 0;
    if (this.mode !== 'play' || document.hidden) return;
    const G = GRAPHICS[this.graphicsKey()];
    const top = G.ratio(window.devicePixelRatio || 1);
    const floor = Math.max(0.55, top * 0.55);
    let r = this.pixelRatio;
    if (fps < 42 && r > floor + 0.01) r = Math.max(floor, r - (fps < 28 ? 0.25 : 0.12));
    else if (fps > 57 && r < top - 0.01) { this.fpsGood = (this.fpsGood || 0) + 1; if (this.fpsGood >= 2) { r = Math.min(top, r + 0.1); this.fpsGood = 0; } }
    else this.fpsGood = 0;
    if (Math.abs(r - this.pixelRatio) > 0.005) {
      this.pixelRatio = r;
      this.renderer.setPixelRatio(r);
      this.resize();
    }
    // still very slow at the lowest resolution: the extra effects go off (until things improve a lot)
    if (fps < 26 && r <= floor + 0.01) {
      this.slowN = (this.slowN || 0) + 1;
      if (this.slowN >= 2 && !this.perfLow) { this.perfLow = true; this.toast('⚡ برای روون‌تر شدن، جلوه‌های اضافه خاموش شدن.', 'gold'); }
    } else if (fps > 55) {
      this.slowN = 0;
      if (this.perfLow && r >= top - 0.01) this.perfLow = false;
    }
  },
});

/* the extra detail also stops when the device is too slow for it */
{
  const d = Object.getOwnPropertyDescriptor(Game, 'polishOn');
  Object.defineProperty(Game, 'polishOn', {
    get() { return d.get.call(this) && !this.perfLow; },
    configurable: true,
  });
}

/* choosing a preset starts the automatic adjustment over */
const _applyGraphics17 = Game.applyGraphics;
Game.applyGraphics = function (...args) {
  this.perfLow = false;
  this.slowN = 0;
  this.fpsGood = 0;
  return _applyGraphics17.apply(this, args);
};
