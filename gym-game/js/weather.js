'use strict';
/*
 * Weather and time of day for the outdoor places: every visit it may be a clear day, a golden
 * sunset, a starry night, or rain with thunder (snow in the mountains). Indoor halls stay as
 * they are.
 */

const WEATHERS = {
  clear: { name: '☀️ آفتابی', sky: null },
  sunset: { name: '🌇 غروب طلایی', sky: '#ffb38a', fog: '#f3b08c', hemi: 0.85, sun: 0.75, sunColor: '#ffb070' },
  night: { name: '🌙 شب پرستاره', sky: '#1d2a55', fog: '#0f1734', hemi: 0.42, sun: 0.22, sunColor: '#9fb6ff', stars: true },
  rain: { name: '🌧️ بارونی', sky: '#8f9bab', fog: '#8f9bab', hemi: 0.7, sun: 0.35, sunColor: '#d6dde8', rain: true, fogNear: 0.6 },
  snow: { name: '🌨️ برفی', sky: '#c9d6e6', fog: '#dfe7f1', hemi: 0.9, sun: 0.5, sunColor: '#ffffff', snow: true, fogNear: 0.6 },
};

Object.assign(Game, {
  isOutdoor(w) {
    // the Cosmic Olympus floats in space: no sunsets or rain there
    if (!w || w === this.gym || w.ceiling || w.env === 'gym4') return false;
    return w instanceof EnvWorld || w === this.island || w === this.lucky;
  },

  pickWeather(w) {
    const snowy = w.env === 'snow' || w.env === 'ice';
    const r = Math.random();
    if (r < 0.45) return 'clear';
    if (r < 0.65) return 'sunset';
    if (r < 0.8) return 'night';
    return snowy ? 'snow' : 'rain';
  },

  /** On entering a place. */
  applyWeather(w) {
    if (!this.isOutdoor(w)) return;
    if (!w.wx0) {
      // remember how the place looks normally
      const o = { lights: [], fog: w.scene.fog ? w.scene.fog.color.clone() : null, bg: w.scene.background && w.scene.background.isColor ? w.scene.background.clone() : null, sky: null };
      w.scene.traverse((x) => {
        if (x.isHemisphereLight || x.isDirectionalLight) o.lights.push([x, x.intensity, x.color.clone()]);
        if (!o.sky && x.isMesh && x.material && x.material.side === THREE.BackSide && x.geometry.type === 'SphereGeometry') o.sky = x;
      });
      if (o.sky) o.skyColor = o.sky.material.color.clone();
      w.wx0 = o;
    }
    const o = w.wx0;
    const id = this.pickWeather(w);
    const W = WEATHERS[id];
    w.weather = id;
    for (const [l, i, c] of o.lights) {
      l.intensity = W.sky ? i * (l.isHemisphereLight ? W.hemi : W.sun) / (l.isHemisphereLight ? 0.95 : 0.85) : i;
      l.color.copy(c);
      if (W.sunColor && l.isDirectionalLight) l.color.set(W.sunColor);
    }
    if (o.sky) o.sky.material.color.copy(W.sky ? new THREE.Color(W.sky) : o.skyColor);
    if (w.scene.fog && o.fog) w.scene.fog.color.copy(W.fog ? new THREE.Color(W.fog) : o.fog);
    if (o.bg) w.scene.background.copy(W.fog ? new THREE.Color(W.fog) : o.bg);
    if (w.scene.fog) {
      const f = w.scene.fog;
      if (!f.userData) f.userData = {};
      f.userData.wx = W.fogNear || 1;
    }
    // falling rain or snow around the camera; stars far above
    // free the old rain/snow and stars, not just hide them (a new set is made on every visit)
    if (w.wxFx) { w.scene.remove(w.wxFx); w.wxFx.geometry.dispose(); w.wxFx.material.dispose(); w.wxFx = null; }
    if (w.wxStars) { w.scene.remove(w.wxStars); w.wxStars.geometry.dispose(); w.wxStars.material.dispose(); w.wxStars = null; }
    if (W.rain || W.snow) w.wxFx = this.makePrecip(W.snow);
    if (w.wxFx) w.scene.add(w.wxFx);
    if (W.stars) {
      const n = 600;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU;
        const e = rand(0.15, 1.4);
        pos.set([Math.cos(a) * Math.cos(e) * 280, Math.sin(e) * 280, Math.sin(a) * Math.cos(e) * 280], i * 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      w.wxStars = new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, fog: false, toneMapped: false }));
      w.scene.add(w.wxStars);
    }
    w.thunderT = rand(6, 14);
    if (this.dressWorld) this.dressWorld(w);
    if (id !== 'clear') this.toast(`هوای این‌جا: ${W.name}`);
  },

  makePrecip(snow) {
    const n = snow ? 900 : 1400;
    const per = snow ? 1 : 2;
    const pos = new Float32Array(n * per * 3);
    for (let i = 0; i < n; i++) {
      const x = rand(-22, 22), y = rand(0, 18), z = rand(-22, 22);
      pos.set([x, y, z], i * per * 3);
      if (!snow) pos.set([x, y - 0.55, z], i * per * 3 + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const obj = snow
      ? new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: 0.12, transparent: true, opacity: 0.9, depthWrite: false }))
      : new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#cfe3ff', transparent: true, opacity: 0.55, depthWrite: false }));
    obj.frustumCulled = false;
    obj.userData = { snow, n, per, noSolid: true };
    return obj;
  },

  tickWeather(dt) {
    const w = this.world;
    if (!w) return;
    if (this.wxWorld !== w) { this.wxWorld = w; if (this.mode === 'play' || this.mode === 'transition') this.applyWeather(w); }
    const fx = w.wxFx;
    if (fx) {
      // drops fall around the camera and wrap back to the top
      const c = this.camera.position;
      fx.position.set(Math.round(c.x), 0, Math.round(c.z));
      const a = fx.geometry.attributes.position;
      const { snow, n, per } = fx.userData;
      const vy = snow ? 1.4 : 22;
      for (let i = 0; i < n; i++) {
        const k = i * per * 3;
        let y = a.array[k + 1] - vy * dt;
        let x = a.array[k];
        if (snow) x += Math.sin(this.clock * 1.3 + i) * 0.4 * dt;
        if (y < 0) y += 18;
        a.array[k] = x;
        a.array[k + 1] = y;
        if (!snow) { a.array[k + 3] = x; a.array[k + 4] = y - 0.55; }
      }
      a.needsUpdate = true;
    }
    // now and then thunder in the rain
    if (w.weather === 'rain' && this.mode === 'play') {
      w.thunderT -= dt;
      if (w.thunderT <= 0) {
        w.thunderT = rand(8, 18);
        const L = w.wx0.lights.find(([l]) => l.isHemisphereLight);
        if (L) {
          const l = L[0];
          const base = l.intensity;
          l.intensity = base * 3.5;
          setTimeout(() => { l.intensity = base; }, 120);
          setTimeout(() => Sfx.play('boom'), 600);
        }
      }
    }
  },
});
