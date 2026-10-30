'use strict';
/*
 * Live cameras. A big screen on the gym's west wall shows live pictures from every place that
 * is open, and a board next to it lists who is where right now. At the desk in front of it you
 * can open the camera room: pick any place, switch between its fixed cameras, follow someone,
 * or fly an invisible camera around (forward, back, left, right, up, down, turn).
 */

Object.assign(Game, {
  /** Fixed cameras for a place: { name, pos, look } or a function of the world for moving ones. */
  cameraList(key, w) {
    if (key === 'gym') {
      return [
        { name: 'نمای کلی', pos: [0, 10, 31], look: [0, 0, -8] },
        { name: 'بال غربی', pos: [-44, 9, 28], look: [-62, 0, -12] },
        { name: 'بال شرقی', pos: [44, 9, 28], look: [62, 0, -12] },
        { name: 'پیست و میز مچ', pos: [14, 5, 14], look: [4, 0, 2] },
        { name: 'کراس‌فیت', pos: [16, 6, -2], look: [24, 0, -14] },
        { name: 'باغ مجسمه‌ها', pos: [-94, 7, 24], look: [-114, 1, -2] },
        { name: 'پیست نینجا', pos: [96, 7, 26], look: [114, 1, -8] },
      ];
    }
    if (w && w.cams) return w.cams;
    if (key === 'football') {
      return [
        { name: 'پخش زنده', fn: (cam) => { const b = w.ball.pos; cam.position.set(b.x * 0.85, 13, 33); cam.lookAt(b.x, 0, b.z * 0.5); } },
        { name: 'پشت دروازه‌ی قرمز', pos: [-37, 5, 0], look: [-10, 0, 0] },
        { name: 'پشت دروازه‌ی آبی', pos: [37, 5, 0], look: [10, 0, 0] },
        { name: 'نمای هوایی', pos: [0, 46, 1], look: [0, 0, 0] },
        { name: 'دنبال توپ', fn: (cam) => { const b = w.ball.pos; cam.position.set(b.x - 7, 4, b.z + 5); cam.lookAt(b.x, 0.5, b.z); } },
      ];
    }
    const B = w.bounds;
    const R = B.circle || Math.max(B.rect[0], B.rect[1]);
    const h = w.ceiling ? Math.min(w.ceiling - 1, R * 0.5) : R * 0.6;
    return [
      { name: 'نمای کلی', pos: [0, h * 1.2, R * 1.05], look: [0, 0, 0] },
      { name: 'گوشه‌ی راست', pos: [R * 0.85, h * 0.6, R * 0.6], look: [0, 1, 0] },
      { name: 'گوشه‌ی چپ', pos: [-R * 0.85, h * 0.6, -R * 0.5], look: [0, 1, 0] },
      { name: 'از بالا', pos: [0, R * 1.6, 0.1], look: [0, 0, 0] },
    ];
  },

  /** Places the camera room can show (built on demand). */
  watchPlaces() {
    const keys = this.rosterPlaces();
    if (this.save.secretFootball) keys.splice(keys.length - 2, 0, 'football');
    return keys;
  },

  worldFor(key) {
    if (key === 'gym') return this.gym;
    if (key === 'island') return this.getIsland();
    if (key === 'lucky') return this.getLucky();
    return this.getEnv(key);
  },

  peopleIn(key) { return this.people.filter((n) => n.loc === key); },

  /* ---------------- the camera room ---------------- */

  openWatch(key) {
    if (this.mode !== 'play') return;
    Sfx.init();
    this.closeModal('menuModal');
    this.keys.clear();
    this.resetJoy();
    if (!this.watchCam) this.watchCam = new THREE.PerspectiveCamera(60, 1, 0.1, 800);
    this.watch = { key: null, cam: 0, follow: -1, free: null, held: new Set() };
    $('hud').classList.add('photo-on');
    $('watch').hidden = false;
    this.selectWatch(key || 'gym');
    this.toast('📺 اتاق دوربین‌ها: یه مکان و یه دوربین انتخاب کن، یا با 🎥 دوربین آزاد همه‌جا رو بگرد');
  },

  closeWatch() {
    if (!this.watch) return;
    this.watch = null;
    this.watchWorld = null;
    $('watch').hidden = true;
    $('hud').classList.remove('photo-on');
  },

  selectWatch(key) {
    const W = this.watch;
    W.key = key;
    W.world = this.worldFor(key);
    this.watchWorld = W.world === this.world ? null : W.world;
    W.cams = this.cameraList(key, W.world);
    W.cam = 0;
    W.follow = -1;
    W.free = null;
    this.renderWatchUi();
    Sfx.play('click');
  },

  selectCam(i) {
    const W = this.watch;
    W.follow = -1;
    if (i === 'free') {
      const c = this.watchCam;
      const d = new THREE.Vector3();
      c.getWorldDirection(d);
      W.free = { x: c.position.x, y: c.position.y, z: c.position.z, yaw: Math.atan2(d.x, d.z), pitch: Math.asin(clamp(d.y, -1, 1)) };
      W.cam = 'free';
    } else if (i === 'follow') {
      const list = W.world.npcs;
      W.cam = 'follow';
      W.free = null;
      W.follow = list.length ? (W.follow + 1) % list.length : -1;
      if (W.follow < 0) this.toast('الان کسی این‌جا نیست که دنبالش کنی.', 'warn');
    } else {
      W.cam = i;
      W.free = null;
    }
    this.renderWatchUi();
    Sfx.play('click');
  },

  renderWatchUi() {
    const W = this.watch;
    const pl = $('watchPlaces');
    pl.innerHTML = '';
    for (const key of this.watchPlaces()) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'w-chip' + (key === W.key ? ' on' : '');
      const n = key === 'football' ? '' : ` (${fa(this.peopleIn(key).length)})`;
      b.textContent = `${this.locIcon(key)} ${key === 'football' ? FOOTBALL_ENV.name : this.locName(key)}${n}`;
      b.addEventListener('click', () => this.selectWatch(key));
      pl.appendChild(b);
    }
    const cl = $('watchCams');
    cl.innerHTML = '';
    W.cams.forEach((c, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'w-chip cam' + (W.cam === i ? ' on' : '');
      b.textContent = `📷 ${fa(i + 1)} • ${c.name}`;
      b.addEventListener('click', () => this.selectCam(i));
      cl.appendChild(b);
    });
    for (const [id, label] of [['follow', '👤 دنبال کردن'], ['free', '🎥 دوربین آزاد']]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'w-chip cam special' + (W.cam === id ? ' on' : '');
      b.textContent = label;
      b.addEventListener('click', () => this.selectCam(id));
      cl.appendChild(b);
    }
    $('watchPad').hidden = W.cam !== 'free';
    const ppl = this.peopleIn(W.key);
    $('watchInfo').textContent = W.key === 'football'
      ? `⚽ بازی زنده • قرمز ${fa(W.world.score[0])} – ${fa(W.world.score[1])} آبی`
      : ppl.length ? `${fa(ppl.length)} نفر این‌جان: ${ppl.slice(0, 6).map((n) => `${n.name} (${fa(n.level)})`).join('، ')}${ppl.length > 6 ? '…' : ''}` : 'الان کسی این‌جا نیست.';
  },

  /** Position the camera-room camera for this frame. */
  aimWatchCam(dt) {
    const W = this.watch;
    const cam = this.watchCam;
    cam.aspect = this.camera.aspect;
    cam.fov = this.camera.fov;
    cam.updateProjectionMatrix();
    if (W.cam === 'free' && W.free) {
      const F = W.free;
      const sp = 12 * dt;
      const h = W.held;
      const fw = (h.has('f') ? 1 : 0) - (h.has('b') ? 1 : 0);
      const st = (h.has('r') ? 1 : 0) - (h.has('l') ? 1 : 0);
      F.x += (Math.sin(F.yaw) * fw - Math.cos(F.yaw) * st) * sp;
      F.z += (Math.cos(F.yaw) * fw + Math.sin(F.yaw) * st) * sp;
      F.y = clamp(F.y + ((h.has('u') ? 1 : 0) - (h.has('d') ? 1 : 0)) * sp * 0.7, 0.4, 80);
      F.yaw += ((h.has('tl') ? 1 : 0) - (h.has('tr') ? 1 : 0)) * dt * 1.6;
      cam.position.set(F.x, F.y, F.z);
      cam.lookAt(F.x + Math.sin(F.yaw) * Math.cos(F.pitch), F.y + Math.sin(F.pitch), F.z + Math.cos(F.yaw) * Math.cos(F.pitch));
      return;
    }
    if (W.cam === 'follow') {
      const n = W.world.npcs[W.follow];
      if (n) {
        const p = n.ch.root.position;
        const yaw = n.ch.root.rotation.y;
        const tx = p.x - Math.sin(yaw) * 4.5;
        const tz = p.z - Math.cos(yaw) * 4.5;
        const k = damp(4, dt);
        cam.position.x += (tx - cam.position.x) * k;
        cam.position.y += (p.y + 2.6 - cam.position.y) * k;
        cam.position.z += (tz - cam.position.z) * k;
        cam.lookAt(p.x, p.y + 1.2, p.z);
        return;
      }
    }
    const c = W.cams[typeof W.cam === 'number' ? W.cam : 0];
    if (c.fn) c.fn(cam);
    else {
      cam.position.set(c.pos[0], c.pos[1], c.pos[2]);
      cam.lookAt(c.look[0], c.look[1], c.look[2]);
    }
  },

  /** Drag on the screen turns the free camera. */
  watchDrag(dx, dy) {
    const W = this.watch;
    if (!W || W.cam !== 'free' || !W.free) return;
    W.free.yaw -= dx * 0.005 * this.save.settings.sens;
    W.free.pitch = clamp(W.free.pitch - dy * 0.004 * this.save.settings.sens, -1.4, 1.4);
  },

  bindWatchUi() {
    $('watchExit').addEventListener('click', () => this.closeWatch());
    document.querySelectorAll('#watchPad [data-k]').forEach((b) => {
      const k = b.dataset.k;
      const on = (e) => { e.preventDefault(); if (this.watch) this.watch.held.add(k); };
      const off = () => { if (this.watch) this.watch.held.delete(k); };
      b.addEventListener('pointerdown', on);
      b.addEventListener('pointerup', off);
      b.addEventListener('pointerleave', off);
      b.addEventListener('pointercancel', off);
    });
    const keyMap = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r', KeyE: 'u', KeyQ: 'd', KeyZ: 'tl', KeyX: 'tr' };
    window.addEventListener('keydown', (e) => { if (this.watch && keyMap[e.code]) { this.watch.held.add(keyMap[e.code]); e.preventDefault(); } if (this.watch && e.code === 'Escape') this.closeWatch(); });
    window.addEventListener('keyup', (e) => { if (this.watch && keyMap[e.code]) this.watch.held.delete(keyMap[e.code]); });
  },

  /** Each frame while the camera room is open: keep the watched place alive and draw it. */
  stepWatch(dt) {
    const W = this.watch;
    if (W.world !== this.world) W.world.simulate(dt);
    this.aimWatchCam(dt);
    this.renderer.render(W.world.scene, this.watchCam);
    W.uiT = (W.uiT || 0) + dt;
    if (W.uiT > 1.5) { W.uiT = 0; this.renderWatchUi(); }
  },

  /* ---------------- the wall screen in the gym ---------------- */

  /** Which feed the wall shows: rotates through the gym and every place with someone in it. */
  wallFeeds() {
    const feeds = [];
    for (const key of this.watchPlaces()) {
      if (key === 'gym') continue;
      const w = key === 'football' ? this.envs.get('football') : this.builtWorld(key);
      const n = this.peopleIn(key).length;
      if (key === 'football' ? !!w : n > 0) feeds.push(key);
    }
    feeds.push('gym');
    return feeds;
  },

  tickWall(dt) {
    const g = this.gym;
    if (this.world !== g || !g.liveRT) return;
    const p = this.player.ch.root.position;
    if (p.x > -30) return; // only while you are in the west wing
    const L = this.wall || (this.wall = { i: -1, t: 0, frameT: 0, key: null, camI: 0, simT: 0 });
    L.t -= dt;
    if (L.t <= 0) {
      const feeds = this.wallFeeds();
      L.i = (L.i + 1) % feeds.length;
      L.key = feeds[L.i];
      if (L.key !== 'gym' && L.key !== 'football' && !this.builtWorld(L.key)) {
        // a place with people that you have never opened: build it now so it can be shown
        this.worldFor(L.key);
      }
      L.world = L.key === 'football' ? this.envs.get('football') : this.builtWorld(L.key);
      const cams = this.cameraList(L.key, L.world);
      L.camI = (L.camI + 1) % cams.length;
      L.cam = cams[L.camI];
      L.t = 7;
      this.drawWallCaption();
    }
    if (L.world !== this.world && L.world && L.world !== this.watchWorld) {
      L.simT += dt;
      if (L.simT > 0.1) { L.world.simulate(L.simT); L.simT = 0; }
    }
    L.frameT -= dt;
    if (L.frameT > 0 || !L.world) return;
    L.frameT = 0.2;
    if (!this.wallCam) this.wallCam = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 800);
    const cam = this.wallCam;
    if (L.cam.fn) L.cam.fn(cam);
    else { cam.position.set(...L.cam.pos); cam.lookAt(...L.cam.look); }
    const r = this.renderer;
    r.setRenderTarget(g.liveRT);
    r.render(L.world.scene, cam);
    r.setRenderTarget(null);
    this.boardT2 = (this.boardT2 || 0) - 0.2;
    if (this.boardT2 <= 0) { this.boardT2 = 2; this.drawStatusBoard(); }
  },

  drawWallCaption() {
    const L = this.wall;
    const n = L.key === 'football' ? 0 : this.peopleIn(L.key).length;
    const name = L.key === 'football' ? FOOTBALL_ENV.name : this.locName(L.key);
    redrawCanvasTexture(this.gym.liveCaptionTex, (ctx, w, h) => {
      ctx.fillStyle = 'rgba(5,7,15,0.75)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#e63946';
      ctx.beginPath(); ctx.arc(w - 40, h / 2, 14, 0, TAU); ctx.fill();
      ctx.direction = 'rtl';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 46px ${UI_FONT}`;
      ctx.fillText(`زنده • ${this.locIcon(L.key)} ${name} • ${L.cam.name}${n ? ` • ${fa(n)} نفر` : ''}`, w - 70, h / 2 + 2);
    });
  },

  drawStatusBoard() {
    const places = this.watchPlaces();
    redrawCanvasTexture(this.gym.statusTex, (ctx, w, h) => {
      ctx.fillStyle = '#0b1020';
      ctx.fillRect(0, 0, w, h);
      ctx.direction = 'rtl';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#7fe0ff';
      ctx.font = `44px ${DISPLAY_FONT}`;
      ctx.fillText('کی کجاست؟ (زنده)', w - 24, 40);
      const rowH = (h - 80) / places.length;
      places.forEach((key, i) => {
        const y = 80 + rowH * (i + 0.5);
        const ppl = key === 'football' ? [] : this.peopleIn(key);
        ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)';
        ctx.fillRect(10, y - rowH / 2 + 1, w - 20, rowH - 2);
        ctx.font = `700 ${Math.min(26, rowH * 0.5)}px ${UI_FONT}`;
        ctx.fillStyle = ppl.length || key === 'football' ? '#ffffff' : '#6b7894';
        const name = key === 'football' ? FOOTBALL_ENV.name : this.locName(key);
        ctx.fillText(`${this.locIcon(key)} ${name}`, w - 24, y);
        ctx.textAlign = 'left';
        ctx.fillStyle = ppl.length ? '#ffd34d' : '#6b7894';
        const names = key === 'football' ? 'بازی زنده ⚽' : ppl.length ? `${fa(ppl.length)} نفر • ${ppl.slice(0, 2).map((n) => n.name).join('، ')}` : 'خالی';
        ctx.fillText(names, 24, y);
        ctx.textAlign = 'right';
      });
    });
  },
});
