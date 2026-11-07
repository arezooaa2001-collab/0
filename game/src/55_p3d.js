/* ============================ 3D VIEW FOR PLATFORMER LEVELS ============================ */
// Renders a 2D World (same physics, same traps) as a real three.js scene. 1 tile = 1 unit, y up, z towards the camera.
class P3D {
  static MESHED = new Set(['block', 'spike', 'saw', 'door', 'portal', 'spring', 'orb', 'laser', 'flag']);
  constructor(world) {
    this.world = world; this.disp = []; this.meshes = new Map(); this.cm = new Map(); this.t = 0;
    const keep = this.keep = o => { this.disp.push(o); return o; };
    const RP = Run3D.prototype, def = world.def;
    this.realm = !!def.realm; this.dark = !!world.dark;
    const sc = this.scene = new THREE.Scene();
    const sk = PAL.skyCol, fogC = this.realm ? 0x0a0320 : this.dark ? 0x05030c : hexNum(sk('#3a1c5e'));
    sc.fog = new THREE.Fog(fogC, this.dark ? 16 : 34, (this.dark ? 46 : 110) * (gtier(19) ? 1.3 : 1));
    this.cam = new THREE.PerspectiveCamera(34, 16 / 9, 0.1, 500);
    const hemi = this.hemi = new THREE.HemisphereLight(this.realm ? 0x9a8cff : 0xc8b8ff, this.realm ? 0x200a40 : 0x302048, this.dark ? 0.12 : 0.85); sc.add(hemi);
    const sun = this.sun = new THREE.DirectionalLight(0xffe2c8, this.dark ? 0.08 : 0.75); sun.position.set(6, 26, 18); sun.target.position.set(16, 6, 0); sc.add(sun, sun.target);
    const SH = GFX.sh === 2; if (R3renderer) R3renderer.shadowMap.enabled = SH;
    if (SH) { sun.castShadow = true; sun.shadow.mapSize.set(gtier(7) ? 4096 : 2048, gtier(7) ? 4096 : 2048); Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 80 }); sun.shadow.camera.updateProjectionMatrix(); sun.shadow.bias = -0.0006; }
    this.SH = SH;
    if (this.dark) { this.pLight = new THREE.PointLight(0xffe6c0, 2.4, 11, 1.6); sc.add(this.pLight); }
    // sky dome
    const cols = this.realm ? ['#03010c', '#170636', '#3a0a52'] : ['#07061c', '#46205f', '#a0405b'].map(sk);
    const skyMat = keep(new THREE.ShaderMaterial({
      uniforms: { c0: { value: new THREE.Color(cols[0]) }, c1: { value: new THREE.Color(cols[1]) }, c2: { value: new THREE.Color(cols[2]) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 c0; uniform vec3 c1; uniform vec3 c2; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(c1, c0, smoothstep(0.0, 0.6, h)) : mix(c1, c2, smoothstep(0.0, -0.4, h)); gl_FragColor = vec4(c, 1.0); }',
      side: THREE.BackSide, depthWrite: false, fog: false }));
    const sky = this.sky = new THREE.Mesh(keep(new THREE.SphereGeometry(300, 24, 14)), skyMat); sky.position.set(16, 6, 0); sc.add(sky);
    // stars, moon and mountains travel with the camera (slightly slower: parallax) along long levels
    const bg = this.bg = new THREE.Group(); sc.add(bg);
    const glowTex = keep(RP.radialTex('rgba(255,255,255,1)', 'rgba(255,255,255,0)')); this.glowTex = glowTex;
    // stars
    { const n = GFXK === 'go' ? 120 : 300, pos = new Float32Array(n * 3), r = srand(5);
      for (let i = 0; i < n; i++) { pos[i * 3] = -60 + r() * 150; pos[i * 3 + 1] = 4 + r() * 60; pos[i * 3 + 2] = -90 - r() * 40; }
      const g = keep(new THREE.BufferGeometry()); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      bg.add(new THREE.Points(g, keep(new THREE.PointsMaterial({ color: this.realm ? 0x9ef9ff : 0xffffff, size: 0.35, fog: false })))); }
    if (!this.realm) {
      const moon = new THREE.Mesh(keep(new THREE.CircleGeometry(4.5, 32)), keep(new THREE.MeshBasicMaterial({ color: 0xffd9b8, fog: false }))); moon.position.set(30, 22, -85); bg.add(moon);
      const mg = new THREE.Mesh(keep(new THREE.PlaneGeometry(1, 1)), keep(new THREE.MeshBasicMaterial({ map: glowTex, color: 0xffc8a0, transparent: true, opacity: .5, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }))); mg.scale.set(40, 40, 1); mg.position.set(30, 22, -86); bg.add(mg);
      // mountain ranges behind the level
      const cone = keep(flatG(new THREE.ConeGeometry(1, 1, 6))); cone.translate(0, .5, 0); const r = srand(9);
      [[sk('#33205a'), -95, 22], [sk('#211541'), -60, 26]].forEach(([c, z, n]) => {
        const m = new THREE.InstancedMesh(cone, keep(new THREE.MeshLambertMaterial({ color: hexNum(c) })), n); m.frustumCulled = false;
        const M = new THREE.Matrix4(); for (let i = 0; i < n; i++) { const hgt = 18 + r() * 30, w = 14 + r() * 14; M.makeScale(w, hgt, w); M.setPosition(-70 + i * 9 + r() * 5, -8, z - r() * 14); m.setMatrixAt(i, M); }
        bg.add(m); keep(m);
      });
    } else {
      const grid = new THREE.GridHelper(260, 80, 0xff4fd8, 0x00e5d0); grid.position.set(16, -6, -30); grid.material.transparent = true; grid.material.opacity = .45; keep(grid.geometry); keep(grid.material); bg.add(grid);
      const cube = keep(new THREE.BoxGeometry(1, 1, 1)), r = srand(3), cm = keep(new THREE.MeshBasicMaterial({ color: 0x9a4dff, wireframe: true }));
      for (let i = 0; i < 18; i++) { const m = new THREE.Mesh(cube, cm); const s = 1 + r() * 3; m.scale.set(s, s, s); m.position.set(-20 + r() * 72, -2 + r() * 26, -14 - r() * 40); m.rotation.set(r() * 3, r() * 3, 0); bg.add(m); }
    }
    // materials shared by all blocks
    const stone = keep(RP.stoneTex(hexNum(mixHex(PAL.block, '#ffffff', .22)))); stone.wrapS = stone.wrapT = THREE.RepeatWrapping;
    if (gtier(4) && R3renderer) stone.anisotropy = R3renderer.capabilities.getMaxAnisotropy();
    this.mat = {
      stone: keep(new THREE.MeshLambertMaterial({ map: stone, color: this.realm ? 0x9a7aff : 0xffffff })),
      ghost: keep(new THREE.MeshLambertMaterial({ map: stone, transparent: true, opacity: .42 })),
      moss: keep(this.realm ? new THREE.MeshBasicMaterial({ color: 0x00ffd5 }) : new THREE.MeshLambertMaterial({ color: hexNum(PAL.moss), emissive: hexNum(PAL.moss), emissiveIntensity: .12 })),
      ice: keep(new THREE.MeshLambertMaterial({ color: 0xbdf2ff, emissive: 0x3a7a90, emissiveIntensity: .5 })),
      hint: keep(new THREE.LineBasicMaterial({ color: hexNum(PAL.moss), transparent: true, opacity: .5 })),
      spike: keep(new THREE.MeshLambertMaterial({ color: hexNum(PAL.hazard) })),
      tip: keep(new THREE.MeshBasicMaterial({ color: 0xff5d8a })),
      lava: keep(new THREE.MeshBasicMaterial({ color: 0xff5a14 })),
      flagOn: keep(new THREE.MeshBasicMaterial({ color: hexNum(PAL.moss), side: THREE.DoubleSide })),
      flagOff: keep(new THREE.MeshBasicMaterial({ color: 0xff5d8a, side: THREE.DoubleSide })),
      pole: keep(new THREE.MeshLambertMaterial({ color: 0xd8d2ee })),
    };
    { const ct = keep(new THREE.CanvasTexture(TEX.convC)); ct.wrapS = THREE.RepeatWrapping; this.convTex = ct; this.mat.conv = keep(new THREE.MeshBasicMaterial({ map: ct })); }
    this.unit = keep(new THREE.BoxGeometry(1, 1, 1));
    this.spikeG = keep(new THREE.ConeGeometry(0.42, 0.95, 4)); this.spikeG.rotateY(Math.PI / 4); this.spikeG.translate(0, 0.475, 0);
    // hero
    const h = buildHeroMesh(keep); this.hero = h; h.g.scale.setScalar(0.6); sc.add(h.g);
    this.fogF = sc.fog.far; this.wx = new Wx3(sc, keep, [26, 12, 7], f => (H - (17.25 - f * 1.45) * T) / T);
    // particles
    const N = this.pN = 420; this.pPos = new Float32Array(N * 3); this.pCol = new Float32Array(N * 3);
    const pg = keep(new THREE.BufferGeometry()); pg.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3)); pg.setAttribute('color', new THREE.BufferAttribute(this.pCol, 3));
    this.parts = new THREE.Points(pg, keep(new THREE.PointsMaterial({ size: 0.24, vertexColors: true, map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
    this.parts.frustumCulled = false; sc.add(this.parts); this.colCache = new Map();
    this.buildEnts();
  }
  X(px) { return px / T; } Y(py) { return (H - py) / T; }
  buildEnts() {
    for (const m of this.meshes.values()) { this.scene.remove(m.o); if (m.hint) this.scene.remove(m.hint); if (m.extra) this.scene.remove(m.extra); }
    this.meshes.clear(); this.lvUid = this.world.lv.uid; this.order = [];
    for (const e of this.world.lv.ents) { const m = this.mk(e); if (m) { this.meshes.set(e, m); this.order.push([e, m]); this.scene.add(m.o); } }
  }
  // a respawn rebuilds the level with the same entities in the same order: reuse the meshes instead of rebuilding them
  rebind() {
    const old = this.order || [], M = P3D.MESHED, ents = this.world.lv.ents.filter(e => M.has(e.type));
    const same = ents.length === old.length && ents.every((e, i) => { const o = old[i][0]; return e.type === o.type && e.w === o.w && e.h === o.h && e.n === o.n && e.r === o.r && !!e.hidden === !!o.hidden0; });
    if (!same) return this.buildEnts();
    this.meshes.clear(); ents.forEach((e, i) => { e.hidden0 = !!e.hidden; old[i][0] = e; this.meshes.set(e, old[i][1]); }); this.lvUid = this.world.lv.uid;
  }
  cache(k, f) { let v = this.cm.get(k); if (!v) { v = f(); this.cm.set(k, v); this.disp.push(v); } return v; }
  mk(e) {
    const C = (k, f) => this.cache(k, f), RP = Run3D.prototype, D = 2.4, mat = this.mat;
    e.hidden0 = !!e.hidden;
    if (e.type === 'flag') {
      const g = new THREE.Group(), h = e.h / T;
      const pole = new THREE.Mesh(C('poleG', () => new THREE.CylinderGeometry(.05, .05, 1, 6)), mat.pole); pole.scale.y = h; pole.position.set(0, h / 2, 0); g.add(pole);
      const cloth = new THREE.Mesh(C('clothG', () => new THREE.PlaneGeometry(.8, .5, 4, 1).translate(.4, 0, 0)), mat.flagOff); cloth.position.set(.05, h - .3, 0); g.add(cloth);
      const ball = new THREE.Mesh(C('ballG', () => new THREE.SphereGeometry(.1, 8, 6)), C('ballM', () => new THREE.MeshBasicMaterial({ color: 0xffd36e }))); ball.position.y = h + .05; g.add(ball);
      return { o: g, kind: 'flag', cloth };
    }
    const glowM = (col, op) => C('glow' + col + op, () => new THREE.MeshBasicMaterial({ map: this.glowTex, color: col, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending }));
    const plane = C('plane', () => new THREE.PlaneGeometry(1, 1));
    const edges = C('edges', () => new THREE.EdgesGeometry(this.unit));
    if (e.type === 'block') {
      const g = new THREE.Group();
      if (e.lava) {
        const lw = e.w / T + 28, lx = (e.x + e.w / 2) / T;
        const m = new THREE.Mesh(this.unit, mat.lava); m.scale.set(lw, 30, D + 1); m.position.set(lx, -15, 0); g.add(m);
        const gl = new THREE.Mesh(plane, glowM(0xff7a1a, .7)); gl.scale.set(lw + 10, 6, 1); gl.position.set(lx, 0.6, D / 2 + .6); g.add(gl);
        return { o: g, kind: 'lava' };
      }
      let x0 = e.x / T, x1 = (e.x + e.w) / T, y0 = (H - e.y - e.h) / T, y1 = (H - e.y) / T;
      if (e.x <= .5) x0 -= 8; if (e.x + e.w >= this.world.lw - .5) x1 += 8; if (e.y + e.h >= H - .5) y0 -= 8; if (e.y <= .5) y1 += 6;
      const w = x1 - x0, h = y1 - y0;
      const geo = C('box' + w.toFixed(2) + ',' + h.toFixed(2), () => { const b = RP.geoBuilder(); b.box(-w / 2, w / 2, -h / 2, h / 2, -D / 2, D / 2, true); return b.build(); });
      const body = new THREE.Mesh(geo, e.ghost && this.world.D.hints ? mat.ghost : mat.stone); body.castShadow = body.receiveShadow = this.SH; g.add(body);
      if (!(e.ceil || e.y <= 0.5)) { const top = new THREE.Mesh(this.unit, e.conv ? mat.conv : e.ice ? mat.ice : mat.moss); top.scale.set(w + .02, .14, D + .02); top.position.set(0, h / 2 + .06, 0); g.add(top); }
      let hint = null;
      if (e.hidden) { hint = new THREE.LineSegments(edges, mat.hint); hint.scale.set(w, h, D); this.scene.add(hint); }
      return { o: g, kind: 'block', cx: (x0 + x1) / 2 - e.x / T, cy: (y0 + y1) / 2 - (H - e.y) / T, hint, body };
    }
    if (e.type === 'spike') {
      // cones laid along local +x with tips along local +y, then the group is rotated to the spike direction
      const g = new THREE.Group(), vert = e.dir === 'up' || e.dir === 'down';
      for (let i = 0; i < e.n; i++) { const s = new THREE.Mesh(this.spikeG, mat.spike); s.castShadow = this.SH; s.position.set(i + .5, 0, 0); g.add(s); }
      g.rotation.z = { up: 0, down: Math.PI, right: -Math.PI / 2, left: Math.PI / 2 }[e.dir];
      const inner = new THREE.Group(); inner.add(g);
      inner.position.set(...({ up: [0, -1, 0], down: [e.n, 0, 0], right: [0, 0, 0], left: [1, -e.n, 0] }[e.dir]));
      const o = new THREE.Group(); o.add(inner);
      let hint = null; if (e.hidden) { hint = new THREE.LineSegments(edges, mat.hint); hint.scale.set(vert ? e.n : 1, vert ? 1 : e.n, .8); this.scene.add(hint); }
      return { o, kind: 'spike', inner, g, hint };
    }
    if (e.type === 'saw') {
      const r = e.r / T;
      const geo = C('saw' + r.toFixed(2), () => { const sh = new THREE.Shape(), n = 16;
        for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, a2 = (i + .5) / n * Math.PI * 2; sh[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r * .8, Math.sin(a) * r * .8); sh.lineTo(Math.cos(a2 - .08) * r * 1.12, Math.sin(a2 - .08) * r * 1.12); }
        const gg = new THREE.ExtrudeGeometry(sh, { depth: .22, bevelEnabled: false }); gg.translate(0, 0, -.11); return gg; });
      const g = new THREE.Group(), disc = new THREE.Group();
      const m = new THREE.Mesh(geo, C('sawM', () => new THREE.MeshLambertMaterial({ color: hexNum(PAL.saw) }))); m.castShadow = this.SH; disc.add(m);
      const hub = new THREE.Mesh(C('hub' + r.toFixed(2), () => new THREE.CylinderGeometry(r * .22, r * .22, .3, 12)), mat.tip); hub.rotation.x = Math.PI / 2; disc.add(hub);
      g.add(disc);
      if (GFX.glow > 0) { const gl = new THREE.Mesh(plane, glowM(0xff5d8a, .45)); gl.scale.set(r * 4, r * 4, 1); gl.position.z = -.2; g.add(gl); }
      let extra = null;
      if (e.orbit) { extra = new THREE.Mesh(C('ring' + e.orbit.rad, () => new THREE.TorusGeometry(e.orbit.rad, .05, 6, 40)), C('ringM', () => new THREE.MeshBasicMaterial({ color: 0x5a3a6a }))); extra.position.set(e.ocx / T, (H - e.ocy) / T, -.4); this.scene.add(extra); }
      return { o: g, kind: 'saw', disc, extra };
    }
    if (e.type === 'door' || e.type === 'portal') {
      const col = e.type === 'portal' ? 0xc59bff : (e.fake && this.world.D.hints ? 0xff5d8a : hexNum(PAL.door));
      const g = new THREE.Group(), w = e.w / T, h = e.h / T, r = w / 2;
      const frameM = C('frameM', () => new THREE.MeshLambertMaterial({ color: 0x3a2f5c })), rimM = C('rim' + col, () => new THREE.MeshBasicMaterial({ color: col }));
      for (const sx of [-1, 1]) { const p = new THREE.Mesh(this.unit, frameM); p.scale.set(.18, h - r, .5); p.position.set(sx * (r + .05), -h / 2 + (h - r) / 2, 0); g.add(p); }
      const arch = new THREE.Mesh(C('arch', () => new THREE.TorusGeometry(r + .05, .1, 8, 20, Math.PI)), rimM); arch.position.set(0, h / 2 - r, 0); g.add(arch);
      const tex = C('swirl', () => RP.swirlTex()), swM = C('swM' + col, () => new THREE.MeshBasicMaterial({ map: tex, color: e.type === 'portal' ? 0xc59bff : 0xffffff }));
      const sw = new THREE.Mesh(C('circ', () => new THREE.CircleGeometry(r * .95, 28)), swM); sw.position.set(0, h / 2 - r, .02); g.add(sw);
      const low = new THREE.Mesh(C('low', () => new THREE.PlaneGeometry(w * .95, h - r)), swM); low.position.set(0, -h / 2 + (h - r) / 2, .01); g.add(low);
      const gl = new THREE.Mesh(plane, glowM(col, +(.55 * Math.min(1, GFX.glow + .2)).toFixed(2))); gl.scale.set(6, 6, 1); gl.position.z = -.3; g.add(gl);
      if (this.dark) { const light = new THREE.PointLight(col, 1.6, 8); light.position.set(0, 0, 1.5); g.add(light); }
      return { o: g, kind: e.type, sw };
    }
    if (e.type === 'spring') {
      const g = new THREE.Group();
      const base = new THREE.Mesh(this.unit, C('springB', () => new THREE.MeshLambertMaterial({ color: 0x2a2547 }))); base.scale.set(.8, .1, .8); base.position.y = .05; g.add(base);
      const coil = new THREE.Mesh(C('coil', () => new THREE.CylinderGeometry(.22, .22, 1, 10, 1, true)), C('coilM', () => new THREE.MeshLambertMaterial({ color: 0xc8cbe6, side: THREE.DoubleSide }))); g.add(coil);
      const pad = new THREE.Mesh(this.unit, C('padM', () => new THREE.MeshLambertMaterial({ color: 0xff5d8a }))); pad.scale.set(.85, .16, .85); g.add(pad);
      return { o: g, kind: 'spring', coil, pad };
    }
    if (e.type === 'orb') {
      const g = new THREE.Group(), r = e.r / T;
      g.add(new THREE.Mesh(C('orbG', () => new THREE.SphereGeometry(r * .85, 16, 12)), C('orbM', () => new THREE.MeshBasicMaterial({ color: 0xc59bff }))));
      const ring = new THREE.Mesh(C('orbR', () => new THREE.TorusGeometry(r * 1.3, .04, 6, 24)), C('orbRM', () => new THREE.MeshBasicMaterial({ color: 0xe6d6ff }))); g.add(ring);
      const gl = new THREE.Mesh(plane, glowM(0xb18cff, .8)); gl.scale.set(2.4, 2.4, 1); g.add(gl);
      return { o: g, kind: 'orb', ring };
    }
    if (e.type === 'laser') {
      const g = new THREE.Group(), L = e.len / T, hz = e.dir === 'h';
      const em = C('emM', () => new THREE.MeshLambertMaterial({ color: 0x2a2547 }));
      for (const k of [0, L]) { const b = new THREE.Mesh(this.unit, em); b.scale.set(.4, .4, .6); b.position.set(hz ? k : 0, hz ? 0 : -k, 0); g.add(b); }
      const beam = new THREE.Mesh(C('beamG', () => new THREE.CylinderGeometry(.09, .09, 1, 8)), C('beamM', () => new THREE.MeshBasicMaterial({ color: 0xff3d71, transparent: true, opacity: .95 })));
      if (hz) { beam.rotation.z = Math.PI / 2; beam.position.set(L / 2, 0, 0); } else beam.position.set(0, -L / 2, 0);
      beam.scale.y = L; g.add(beam);
      const glow = new THREE.Mesh(C('glowCyl', () => new THREE.CylinderGeometry(.3, .3, 1, 8, 1, true)), C('glowCylM', () => new THREE.MeshBasicMaterial({ color: 0xff3d71, transparent: true, opacity: .25, depthWrite: false, blending: THREE.AdditiveBlending })));
      glow.rotation.copy(beam.rotation); glow.position.copy(beam.position); glow.scale.y = L; g.add(glow);
      return { o: g, kind: 'laser', beam, glow };
    }
    return null;
  }
  sync(t) {
    const w = this.world, hints = !!w.D.hints;
    if (w.lv.uid !== this.lvUid) this.rebind();    // respawn creates a fresh level
    const cc = (w.camX + W / 2) / T, c0 = cc - 34, c1 = cc + 34;
    for (const [e, m] of this.meshes) {
      const o = m.o;
      if (m.kind === 'lava') { o.position.y = this.Y(e.y); continue; }
      // long levels: only what is near the camera is shown and updated
      const ex0 = e.type === 'saw' ? e.x / T - 4 : e.x / T, ex1 = e.type === 'saw' ? e.x / T + 4 : (e.x + (e.type === 'laser' && e.dir === 'h' ? e.len : e.w || 0)) / T;
      if (ex1 < c0 || ex0 > c1) { o.visible = false; if (m.hint) m.hint.visible = false; if (m.extra) m.extra.visible = false; continue; }
      if (m.extra) m.extra.visible = !e.gone && !e.hidden;
      if (m.kind === 'flag') { o.visible = true; o.position.set(this.X(e.x + 2), this.Y(e.y + e.h), 0); m.cloth.material = e.on ? this.mat.flagOn : this.mat.flagOff; m.cloth.rotation.y = Math.sin(t * 5 + e.x) * .35 * (1 + (e.wave || 0) * 2); continue; }
      const hidden = e.gone || (e.hidden && m.kind !== 'portal');
      o.visible = !hidden;
      if (m.hint) { m.hint.visible = hints && e.hidden && !e.gone; if (m.hint.visible) m.hint.position.set(this.X(e.x + e.w / 2), this.Y(e.y + e.h / 2), 0); }
      if (hidden) continue;
      const shx = e.shake ? (Math.random() - .5) * .12 : 0;
      if (m.kind === 'block') {
        o.position.set(this.X(e.x) + m.cx + shx, this.Y(e.y) + m.cy, 0);
        const k = e.appear < 1 ? 1 - Math.pow(1 - e.appear, 3) : 1; o.scale.setScalar(Math.max(.001, k));
        if (e.ghost) m.body.material = hints ? this.mat.ghost : this.mat.stone;
      } else if (m.kind === 'spike') {
        o.position.set(this.X(e.x) + shx, this.Y(e.y), 0);
        const k = Math.max(.001, Math.min(1, e.pop)); m.g.scale.set(1, k, 1);
      } else if (m.kind === 'saw') { o.position.set(this.X(e.x), this.Y(e.y), 0); m.disc.rotation.z = -e.rot; }
      else if (m.kind === 'door' || m.kind === 'portal') {
        o.position.set(this.X(e.x + e.w / 2), this.Y(e.y + e.h / 2), 0); o.rotation.z = e.flip ? Math.PI : 0; m.sw.rotation.z = -t * 3;
        if (m.kind === 'portal') { const k = e.open > 0 ? 1 - Math.pow(1 - e.open, 3) : 0; o.visible = k > 0; o.scale.setScalar(Math.max(.001, k)); o.rotation.y = Math.sin(t) * .1; }
      } else if (m.kind === 'spring') {
        const k = e.anim > 0 ? Math.sin((1 - e.anim) * Math.PI * 3) * e.anim : 0, hgt = .3 - k * .2 + (e.anim > .5 ? .25 * (e.anim - .5) : 0);
        o.position.set(this.X(e.x + T / 2), this.Y(e.y + e.h), 0); m.coil.scale.y = hgt; m.coil.position.y = .1 + hgt / 2; m.pad.position.y = .1 + hgt + .08;
      } else if (m.kind === 'orb') { o.position.set(this.X(e.x), this.Y(e.y), 0); m.ring.rotation.set(t, t * 1.3, 0); o.scale.setScalar(e.cd > 0 ? .7 : 1 + Math.sin(t * 5) * .06); }
      else if (m.kind === 'laser') {
        o.position.set(this.X(e.x), this.Y(e.y), 0);
        m.beam.visible = e.act || (e.warn && Math.floor(t * 18) % 2 === 0); m.glow.visible = e.act;
        m.beam.scale.x = m.beam.scale.z = e.act ? 1 + Math.sin(t * 40) * .15 : .35;
      }
    }
    if (this.convTex) this.convTex.offset.x = (t * 0.6) % 1;
  }
  render(dt, t) {
    const r = getRenderer3(); if (!r) return;
    const w = this.world, p = w.p; this.t += dt;
    this.sync(t);
    // hero
    const h = this.hero, g = h.g, flip = p.g < 0;
    g.visible = w.state !== 'dead';
    const fx = this.X(p.x + PW / 2), fy = flip ? this.Y(p.y) : this.Y(p.y + PHT);
    g.position.set(fx, fy, 0);
    const third = CFG.cam3d === 'third', tw = third ? .1 : .45;
    const turn = p.face > 0 ? -Math.PI / 2 - tw : Math.PI / 2 + tw;
    g.rotation.set(0, turn, flip ? Math.PI : 0);
    let sc = .6; if (w.state === 'win') { sc *= Math.max(.02, p.winS); g.rotation.y += p.rot; }
    g.scale.set(sc * p.sx, sc * p.sy, sc * p.sx);
    const run = p.onGround && Math.abs(p.vx) > 40, ph = p.runPhase;
    h.legs[0].position.z = run ? Math.sin(ph) * .22 : 0; h.legs[1].position.z = run ? -Math.sin(ph) * .22 : 0;
    h.tail.forEach((m, i) => { m.position.x = 0.15 + Math.sin(t * 14 - i) * 0.08 * (i + 1); });
    if (this.pLight) { this.pLight.position.set(fx, fy + .5, 2); this.pLight.intensity = 2.4 * (1 + Math.sin(t * 9) * .04); this.hemi.intensity = .12 + w.lightning * 1.2; }
    // particles
    const parts = w.parts, N = Math.min(this.pN, parts.length), pos = this.pPos, col = this.pCol;
    for (let i = 0; i < N; i++) {
      const q = parts[parts.length - N + i]; let c = this.colCache.get(q.col);
      if (!c) { const rgb = hexRgb(q.col.length === 4 ? q.col.replace(/#(.)(.)(.)/, '#$1$1$2$2$3$3') : q.col); c = rgb.map(v => v / 255); this.colCache.set(q.col, c); }
      const a = Math.min(1, q.life / q.max * 1.5);
      pos[i * 3] = this.X(q.x); pos[i * 3 + 1] = this.Y(q.y); pos[i * 3 + 2] = .6;
      col[i * 3] = c[0] * a; col[i * 3 + 1] = c[1] * a; col[i * 3 + 2] = c[2] * a;
    }
    this.parts.geometry.setDrawRange(0, N); this.parts.geometry.attributes.position.needsUpdate = true; this.parts.geometry.attributes.color.needsUpdate = true;
    // camera framing the whole level, drifting gently with the player
    const W3 = innerWidth, H3 = innerHeight, aspect = W3 / H3, cam = this.cam;
    const tan = Math.tan(34 * Math.PI / 360), d = Math.max(10.4 / tan, 17.6 / (tan * aspect)) + 1.5;
    const cc = (w.camX + W / 2) / T, cx = cc + (fx - cc) * .18, cy = 9 + (fy - 9) * .1;
    this.sky.position.x = cx; this.bg.position.x = cx * .9 - 16 * .9;
    this.sun.position.set(cx - 10, 26, 18); this.sun.target.position.set(cx, 6, 0); this.sun.target.updateMatrixWorld();
    const sh = w.shakeA * (CFG.shake / 100) * .03;
    if (third) {
      // third-person: behind the player and a little to the side, looking down the course
      const look = clamp(w.look / 70, -1, 1), up = flip ? -1 : 1, k = Math.min(1, dt * 6), ky = Math.min(1, dt * 3.5);
      const cs = this.cs || (this.cs = { x: fx - 6.2, y: fy + 3 * up, lx: fx + 6 });
      cs.x = lerp(cs.x, fx - 6.2, k); cs.y = lerp(cs.y, fy + 3 * up, ky); cs.lx = lerp(cs.lx, fx + 5 + look * 2, k);
      cam.fov = lerp(cam.fov, aspect < 1 ? 75 : 62, Math.min(1, dt * 4));
      cam.position.set(cs.x + (Math.random() - .5) * sh, cs.y + (Math.random() - .5) * sh, 4.4);
      cam.lookAt(cs.lx, cs.y - 2.1 * up, -.5); cam.aspect = aspect; cam.updateProjectionMatrix();
    } else {
      cam.fov = 34;
      cam.position.set(cx + (Math.random() - .5) * sh, cy + 1.6 + (Math.random() - .5) * sh, d);
      cam.lookAt(cx, cy + .1, 0); cam.aspect = aspect; cam.updateProjectionMatrix();
    }
    if (third) this.wx.update(dt, this.cs.lx, this.cs.y, 0); else this.wx.update(dt, cx, cy, 0);
    if (!this.dark) this.hemi.intensity = .85 + WX.flash * 1.2;
    this.scene.fog.far = this.fogF * (1 - .3 * Math.min(1, WX.rain + WX.snow));
    toneMap3(r);
    r.setScissorTest(false); r.setViewport(0, 0, W3, H3);
    r.render(this.scene, cam);
  }
  dispose() {
    for (const m of this.meshes.values()) { if (m.hint) this.scene.remove(m.hint); if (m.extra) this.scene.remove(m.extra); }
    for (const o of this.disp) { try { o.dispose(); } catch (e) {} }
    this.disp = []; this.meshes.clear();
  }
}
