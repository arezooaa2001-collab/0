/* ============================ WEATHER ============================ */
// Rain, snow, flood and storm in every view (2D, 2.5D, 3D platformer, 3D chase), plus rain and wind sounds.
// Weather is only looks and sound: it never changes how a level plays, so every level stays as verified.
const WX_KINDS = {
  off: { n: 'صاف', i: '☀️' }, rain: { n: 'بارون', i: '🌧️' }, snow: { n: 'برف', i: '❄️' },
  flood: { n: 'سیل', i: '🌊' }, storm: { n: 'طوفان', i: '⛈️' }, auto: { n: 'خودکار', i: '🎲' },
};
const WX = { kind: 'off', autoKind: 'off', autoT: 20, rain: 0, snow: 0, flood: 0, wind: 0, flash: 0, boltT: 4, sndT: 0, drops: [], flakes: [], lastCam: 0 };
const wxCurrent = () => CFG.weather === 'auto' ? WX.autoKind : (WX_KINDS[CFG.weather] ? CFG.weather : 'off');
function wxSay(k) {
  if (typeof app === 'undefined' || app.state !== 'play') return;
  app.taunt(k === 'off' ? 'هوا صاف شد ☀️' : { rain: 'بارون گرفت 🌧️', snow: 'برف می‌باره ❄️', flood: 'سیل اومد! 🌊', storm: 'طوفان شد! ⛈️' }[k], '#9ef9ff');
}
function wxTick(dt, playing) {
  if (CFG.weather === 'auto') {
    // automatic: the weather changes by itself every so often, leaning on the colours of the level
    WX.autoT -= dt;
    if (WX.autoT <= 0) {
      const bio = typeof app !== 'undefined' && app.def ? app.def.biome || '' : '';
      const pool = bio === 'ice' || bio === 'aurora' ? ['snow', 'snow', 'off', 'storm'] : bio === 'ocean' || bio === 'storm' || bio === 'toxic' ? ['rain', 'flood', 'storm', 'off']
        : bio === 'desert' || bio === 'volcano' || bio === 'gold' ? ['off', 'off', 'storm', 'rain'] : ['off', 'rain', 'snow', 'storm', 'flood'];
      let k = pool[Math.floor(Math.random() * pool.length)];
      if (k === WX.autoKind) k = pool[Math.floor(Math.random() * pool.length)];
      if (k !== WX.autoKind) { WX.autoKind = k; wxSay(k); }
      WX.autoT = 35 + Math.random() * 45;
    }
  }
  const k = WX.kind = wxCurrent(), I = clamp((CFG.weatherI ?? 70) / 100, .1, 1), e = (a, b, r) => a + (b - a) * Math.min(1, dt * r);
  WX.rain = e(WX.rain, k === 'rain' ? I : k === 'storm' ? Math.min(1.3, I * 1.3) : k === 'flood' ? I * .8 : 0, .7);
  WX.snow = e(WX.snow, k === 'snow' ? I : 0, .5);
  WX.flood = e(WX.flood, k === 'flood' ? 1 : 0, .22);
  WX.wind = e(WX.wind, k === 'storm' ? 1 : k === 'rain' || k === 'flood' ? .35 : k === 'snow' ? .3 : 0, .5);
  WX.flash = Math.max(0, WX.flash - dt * 3);
  if (k === 'storm' && WX.rain > .3) { WX.boltT -= dt; if (WX.boltT <= 0) { WX.boltT = 2.5 + Math.random() * 5; WX.flash = 1; if (CFG.wsnd !== false && playing) Sound.play('thunder'); } }
  if ((WX.sndT -= dt) <= 0) { WX.sndT = .3; const on = CFG.wsnd !== false && playing; Sound.ambient(on ? Math.min(1, WX.rain) : 0, on ? WX.wind * Math.max(WX.rain, WX.snow) : 0); }
}

/* ---------- 2D views ---------- */
let VIEW_ENTS = [];
function drawWeather2D(world, t, dt, sx, sy) {
  if (WX.rain < .01 && WX.snow < .01 && WX.flood < .01 && WX.flash <= 0) { WX.drops.length = WX.flakes.length = 0; return; }
  const q = (GFX.wq || 1) * Perf.fxK, dCam = (CAMX - WX.lastCam) * S; WX.lastCam = CAMX;
  ctx.save();
  // snow settles on the tops of blocks
  if (WX.snow > .05 && world) {
    worldTransform(sx, sy); ctx.fillStyle = `rgba(245,250,255,${Math.min(.92, WX.snow * 1.1).toFixed(2)})`;
    for (const e of VIEW_ENTS) {
      if (e.type !== 'block' || e.hidden || e.gone || e.lava || e.ceil || e.y <= .5 || e.appear < 1) continue;
      const [x, , w] = blockRect(e); ctx.beginPath(); ctx.moveTo(x, e.y + 1);
      for (let xx = 0; xx <= w; xx += 10) ctx.lineTo(x + xx, e.y - 3 - Math.abs(Math.sin((e.x + xx) * .07)) * 3.5 * WX.snow);
      ctx.lineTo(x + w, e.y + 1); ctx.closePath(); ctx.fill();
    }
  }
  // flood: water fills the bottom of every pit (and the floor of the screen)
  if (WX.flood > .01 && world) {
    worldTransform(sx, sy);
    const top = (17.25 - WX.flood * 1.45) * T, x0 = CAMX - EXT.l - 20, x1 = CAMX + W + EXT.r + 20;
    const gr = ctx.createLinearGradient(0, top - 6, 0, H + EXT.b); gr.addColorStop(0, 'rgba(120,190,255,.62)'); gr.addColorStop(.3, 'rgba(40,110,190,.66)'); gr.addColorStop(1, 'rgba(10,40,90,.8)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(x0, H + EXT.b + 10);
    for (let x = x0; x <= x1 + 16; x += 16) ctx.lineTo(x, top + Math.sin(x * .045 + t * 2.4) * 3 + Math.sin(x * .013 - t * 1.3) * 2.5);
    ctx.lineTo(x1 + 16, H + EXT.b + 10); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(220,240,255,.55)'; ctx.lineWidth = 2; ctx.beginPath();
    for (let x = x0; x <= x1 + 16; x += 16) { const y = top + Math.sin(x * .045 + t * 2.4) * 3 + Math.sin(x * .013 - t * 1.3) * 2.5; x === x0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    ctx.stroke();
    if (gtier(11)) { // light shimmering on the water
      ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(200,230,255,.22)'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 14; i++) { const x = x0 + ((i * 137 + t * 30) % (x1 - x0)), y = top + 10 + (i % 4) * 9; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 26 + (i % 3) * 10, y); ctx.stroke(); }
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (WX.rain > .01) { ctx.fillStyle = `rgba(10,14,32,${(Math.min(1, WX.rain) * .2).toFixed(3)})`; ctx.fillRect(0, 0, cw, ch); }
  // rain streaks (screen space, slanted by the wind, sliding with the camera)
  const nR = Math.round(260 * Math.min(1.3, WX.rain) * q), D = WX.drops, slant = (.12 + WX.wind * .45);
  while (D.length < nR) D.push({ x: Math.random() * cw * 1.2, y: Math.random() * ch, s: (900 + Math.random() * 500) * dpr, l: (16 + Math.random() * 14) * dpr });
  if (D.length > nR) D.length = nR;
  if (nR) {
    ctx.strokeStyle = 'rgba(190,210,255,.42)'; ctx.lineWidth = 1.3 * dpr; ctx.beginPath();
    for (const d of D) {
      d.y += d.s * dt; d.x += -d.s * slant * dt - dCam * .9;
      if (d.y > ch + 20) { d.y = -20 - Math.random() * 60; d.x = Math.random() * cw * 1.3; }
      if (d.x < -40) d.x += cw + 80; else if (d.x > cw + 40) d.x -= cw + 80;
      ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + d.l * slant, d.y - d.l);
    }
    ctx.stroke();
  }
  // snow flakes drifting
  const nS = Math.round(200 * WX.snow * q), F = WX.flakes;
  while (F.length < nS) F.push({ x: Math.random() * cw, y: Math.random() * ch, r: (1.2 + Math.random() * 2.4) * dpr, s: (40 + Math.random() * 60) * dpr, ph: Math.random() * 7 });
  if (F.length > nS) F.length = nS;
  if (nS) {
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    for (const f of F) {
      f.y += f.s * dt; f.x += (Math.sin(t * 1.3 + f.ph) * 24 - WX.wind * 90) * dpr * dt - dCam * .8;
      if (f.y > ch + 6) { f.y = -6; f.x = Math.random() * cw; }
      if (f.x < -10) f.x += cw + 20; else if (f.x > cw + 10) f.x -= cw + 20;
      ctx.fillRect(f.x - f.r / 2, f.y - f.r / 2, f.r, f.r);
    }
  }
  if (WX.flash > 0) { ctx.fillStyle = `rgba(225,230,255,${(WX.flash * .38).toFixed(3)})`; ctx.fillRect(0, 0, cw, ch); }
  ctx.restore();
}

/* ---------- three.js views: falling rain/snow around the camera + flood water ---------- */
class Wx3 {
  // u = world units per metre-ish (1 for the chase, 1 tile for the platformer); box = half sizes around the camera
  constructor(scene, keep, box, waterY) {
    this.box = box; this.waterY = waterY; const q = GFX.wq || 1;
    this.nR = Math.round(1400 * q); this.nS = Math.round(900 * q);
    const rg = keep(new THREE.BufferGeometry()); this.rp = new Float32Array(this.nR * 6); rg.setAttribute('position', new THREE.BufferAttribute(this.rp, 3));
    this.rain = new THREE.LineSegments(rg, keep(new THREE.LineBasicMaterial({ color: 0xbfd2ff, transparent: true, opacity: .5, depthWrite: false })));
    this.rain.frustumCulled = false; scene.add(this.rain);
    const sg = keep(new THREE.BufferGeometry()); this.sp = new Float32Array(this.nS * 3); sg.setAttribute('position', new THREE.BufferAttribute(this.sp, 3));
    this.snow = new THREE.Points(sg, keep(new THREE.PointsMaterial({ color: 0xffffff, size: box[0] > 30 ? .3 : .16, transparent: true, opacity: .9, depthWrite: false })));
    this.snow.frustumCulled = false; scene.add(this.snow);
    const r = Math.random; this.rv = Array.from({ length: this.nR }, () => [r(), r(), r(), .7 + r() * .6]); this.sv = Array.from({ length: this.nS }, () => [r(), r(), r(), r() * 7]);
    this.water = new THREE.Mesh(keep(new THREE.PlaneGeometry(1, 1)), keep(new THREE.MeshLambertMaterial({ color: 0x2f6cb0, transparent: true, opacity: .62, depthWrite: false })));
    this.water.rotation.x = -Math.PI / 2; this.water.scale.set(box[0] * 8, box[2] * 8, 1); scene.add(this.water); this.t = 0;
  }
  update(dt, cx, cy, cz, fallK = 1) {
    this.t += dt; const [bx, by, bz] = this.box, t = this.t;
    const nr = Math.round(this.nR * Math.min(1, WX.rain) * Perf.fxK), ns = Math.round(this.nS * WX.snow * Perf.fxK), wind = WX.wind;
    this.rain.visible = nr > 0; this.snow.visible = ns > 0;
    if (nr) {
      const P = this.rp, L = by * .07;
      for (let i = 0; i < nr; i++) {
        const v = this.rv[i]; v[1] -= dt * 1.15 * v[3] * fallK; if (v[1] < 0) { v[1] += 1; v[0] = Math.random(); v[2] = Math.random(); }
        const x = cx + (v[0] * 2 - 1) * bx, y = cy + (v[1] * 2 - 1) * by, z = cz + (v[2] * 2 - 1) * bz, o = i * 6;
        P[o] = x; P[o + 1] = y; P[o + 2] = z; P[o + 3] = x + wind * L * .6; P[o + 4] = y + L; P[o + 5] = z;
      }
      this.rain.geometry.setDrawRange(0, nr * 2); this.rain.geometry.attributes.position.needsUpdate = true;
      this.rain.material.opacity = .35 + Math.min(1, WX.rain) * .25;
    }
    if (ns) {
      const P = this.sp;
      for (let i = 0; i < ns; i++) {
        const v = this.sv[i]; v[1] -= dt * .12 * fallK; if (v[1] < 0) { v[1] += 1; v[0] = Math.random(); v[2] = Math.random(); }
        P[i * 3] = cx + (v[0] * 2 - 1) * bx + Math.sin(t + v[3]) * .6 - wind * 1.5; P[i * 3 + 1] = cy + (v[1] * 2 - 1) * by; P[i * 3 + 2] = cz + (v[2] * 2 - 1) * bz;
      }
      this.snow.geometry.setDrawRange(0, ns); this.snow.geometry.attributes.position.needsUpdate = true;
    }
    this.water.visible = WX.flood > .02;
    if (this.water.visible) { this.water.position.set(cx, this.waterY(WX.flood) + Math.sin(t * 1.7) * .03, cz); this.water.material.opacity = .62 * Math.min(1, WX.flood * 1.5); }
  }
}
