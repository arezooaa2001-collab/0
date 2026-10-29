import * as THREE from 'three';
import { buildCar } from './models.js';
import { TrafficCar } from './traffic.js';
import { clamp, damp, wrapAngle, fa, faMoney, collideCircle, canvasTexture, pick } from './util.js';
import { LANE } from './world.js';

const TRACKS = [
  { id: 'desert', name: 'درگ جاده کویر', icon: '🏜️', from: [0, 560], to: [-300, 1740], fee: 150000, prize: 600000, coins: 15 },
  { id: 'forest', name: 'پیچ‌های جنگل', icon: '🌲', from: [0, -440], to: [-150, -1790], fee: 200000, prize: 800000, coins: 20 },
  { id: 'mountain', name: 'جاده کوهستان', icon: '⛰️', from: [440, 0], to: [1640, 250], fee: 200000, prize: 750000, coins: 20 },
  { id: 'city', name: 'مسابقه شهری', icon: '🏙️', from: [-330, -330], to: [330, 330], fee: 100000, prize: 450000, coins: 10, city: true },
];
const RIVALS = [
  ['رضا توربو', 0x1565c0, 'فکر کردی با این ماشین به من می‌رسی؟ 😏'],
  ['شاهین دودی', 0x26282c, 'گرد و خاکم رو می‌خوری رفیق! 💨'],
  ['مهسا نیترو', 0x8e24aa, 'آماده‌ای ببازی؟ 😎'],
  ['کامی بی‌ترمز', 0x2e7d32, 'من ترمز ندارم، تو هم نداشته باش! 🔥'],
];
const OFFS = [-1.45, 0, 1.45];
const _res = { nx: 0, nz: 0, pen: 0 };
const $ = (id) => document.getElementById(id);

function labelSprite(text, bg = 'rgba(20,10,40,0.85)', w = 512) {
  const tex = canvasTexture(w, 128, (g, W, H) => {
    g.fillStyle = bg;
    g.beginPath();
    g.roundRect(4, 4, W - 8, H - 8, 40);
    g.fill();
    g.strokeStyle = '#ffd21a';
    g.lineWidth = 6;
    g.stroke();
    g.fillStyle = '#fff';
    g.font = 'bold 60px Vazirmatn, Tahoma, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.direction = 'rtl';
    g.fillText(text, W / 2, H / 2 + 4);
  });
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, fog: false }));
  sp.scale.set((w / 128) * 1.6, 1.6, 1);
  return sp;
}

/** Street races against a rival sports car, with checkpoints along a road route. */
export class Race {
  constructor(game) {
    this.g = game;
    this.state = 'idle';
    this.rivals = {};
    const w = game.world;
    // meeting spots on the roadside
    this.spots = TRACKS.map((t) => {
      const ne = w.nearestEdge(t.from[0], t.from[1]);
      const rs = w.roadside(ne, 1, 12);
      return { kind: 'race', track: t, padX: rs.x, padZ: rs.z, name: t.name };
    });
    const flagTex = canvasTexture(128, 128, (g, W, H) => {
      const n = 8, s = W / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        g.fillStyle = (i + j) % 2 ? '#111' : '#fff';
        g.fillRect(i * s, j * s, s, s);
      }
    });
    this.flagTex = flagTex;
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.6, roughness: 0.4 });
    const flagMat = new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: 0.8 });
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0xb04dff, transparent: true, opacity: 0.75, depthWrite: false, fog: false });
    for (const s of this.spots) {
      const grp = new THREE.Group();
      const y = w.heightAt(s.padX, s.padZ);
      grp.position.set(s.padX, y, s.padZ);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 6, 8), poleMat);
      pole.position.y = 3;
      grp.add(pole);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(2, 1.3, 8, 1), flagMat);
      flag.position.set(1.05, 5.3, 0);
      grp.add(flag);
      s.flag = flag;
      const ring = new THREE.Mesh(new THREE.RingGeometry(4.2, 5, 40), this.ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.15;
      grp.add(ring);
      const lab = labelSprite(`🏁 ${s.track.name}`);
      lab.position.y = 7.4;
      grp.add(lab);
      game.scene.add(grp);
      s.group = grp;
    }
    // checkpoint gates
    this.gateMat = new THREE.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: 0.85, depthWrite: false, fog: false });
    this.gateMat2 = new THREE.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: 0.3, depthWrite: false, fog: false });
    this.gate = new THREE.Mesh(new THREE.TorusGeometry(6.5, 0.35, 10, 48), this.gateMat);
    this.gate2 = new THREE.Mesh(new THREE.TorusGeometry(6.5, 0.25, 8, 40), this.gateMat2);
    this.gate.visible = this.gate2.visible = false;
    game.scene.add(this.gate, this.gate2);
    // finish arch
    const arch = new THREE.Group();
    for (const x of [-7, 7]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7, 0.5), poleMat);
      p.position.set(x, 3.5, 0);
      arch.add(p);
    }
    const banTex = canvasTexture(512, 96, (g, W, H) => {
      const s = H / 4;
      for (let i = 0; i < W / s; i++) for (let j = 0; j < 4; j++) {
        g.fillStyle = (i + j) % 2 ? '#111' : '#fff';
        g.fillRect(i * s, j * s, s, s);
      }
      g.fillStyle = 'rgba(200,20,40,0.9)';
      g.fillRect(W * 0.3, 8, W * 0.4, H - 16);
      g.fillStyle = '#fff';
      g.font = 'bold 52px Vazirmatn, Tahoma, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('پایان', W / 2, H / 2 + 3);
    });
    const banner = new THREE.Mesh(new THREE.BoxGeometry(14.5, 1.6, 0.3), new THREE.MeshStandardMaterial({ map: banTex, roughness: 0.7 }));
    banner.position.y = 7;
    arch.add(banner);
    arch.visible = false;
    game.scene.add(arch);
    this.arch = arch;
  }

  /* ---------------- offer ---------------- */
  offer(spot) {
    const g = this.g, ui = g.ui, t = spot.track;
    if (this.state !== 'idle') return;
    if (g.rides.ride) {
      ui.toast('اول سفر مسافرت رو تموم کن، بعد مسابقه بده! 🧳', 'warn');
      return;
    }
    if (g.police.state !== 'none') {
      ui.toast('با پلیس پشت سرت؟! اول از دستشون خلاص شو 🚨', 'warn');
      return;
    }
    const [name, color, taunt] = pick(RIVALS);
    const won = (g.stats.raceTracks || []).includes(t.id);
    const path = this.buildPath(t);
    if (!path) {
      ui.toast('مسیر مسابقه پیدا نشد 😕', 'warn');
      return;
    }
    const km = (this.total / 1000).toFixed(1);
    ui.panel(`<h2>🏁 ${t.icon} ${t.name}</h2>
      <div class="raceoffer"><div class="rv">🏎️ <b>${name}</b><small>«${taunt}»</small></div>
      <div class="statrow"><span>📏 ${fa(km).replace('.', '٫')} کیلومتر</span><span>🚩 ${fa(this.cps.length)} چک‌پوینت</span><span>🎟️ ورودی ${faMoney(t.fee)}</span></div>
      <p class="prize">🏆 جایزه: ${faMoney(t.prize)} تومان + 🪙 ${fa(t.coins)} سکه${won ? ' <small>(این مسیر رو قبلاً بردی)</small>' : ''}</p>
      <p class="note">از توی حلقه‌های نارنجی رد شو و زودتر از رقیب به خط پایان برس. با فلش 🧭 راه رو گم نمی‌کنی!</p>
      <div class="btnrow"><button data-a="go">قبوله! بزن بریم 🔥</button><button data-a="no" class="ghost">بی‌خیال</button></div></div>`, (el) => {
      el.querySelector('[data-a=go]').onclick = () => {
        // things may have changed while the panel was open
        if (this.state !== 'idle' || g.rides.ride || g.police.state !== 'none' || g.state !== 'play' || g.onfoot.active || g.onfoot.busy || g.player.burning) {
          ui.closePanel();
          ui.toast(g.rides.ride ? 'اول سفر مسافرت رو تموم کن، بعد مسابقه بده! 🧳' : 'الان نمی‌شه مسابقه داد', 'warn');
          return;
        }
        g.topUp(t.fee);
        if (g.money < t.fee) {
          ui.toast('پول ورودی رو نداری 😟', 'warn');
          g.audio.bad();
          return;
        }
        g.money -= t.fee;
        ui.closePanel();
        this.start(t, path, name, color);
      };
      el.querySelector('[data-a=no]').onclick = () => ui.closePanel();
    });
  }
  buildPath(t) {
    const w = this.g.world;
    let path = w.route(t.from[0], t.from[1], t.to[0], t.to[1]);
    // start on the first node so we never begin by driving backwards
    if (path.length < 3) return null;
    path = path.slice(1).map((q) => ({ x: q.x, z: q.z }));
    // drop duplicates
    const pts = [path[0]];
    for (const q of path) if (Math.hypot(q.x - pts[pts.length - 1].x, q.z - pts[pts.length - 1].z) > 1) pts.push(q);
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
    this.pts = pts;
    this.cum = cum;
    this.total = cum[cum.length - 1];
    if (pts.length < 2 || this.total < 50) return null;
    // checkpoints every ~170 m, the last one is the finish line
    const n = Math.max(2, Math.round(this.total / 170));
    this.cps = [];
    for (let k = 1; k <= n; k++) this.cps.push(this.pointAt((this.total * k) / n));
    return pts;
  }
  /** point and direction at a distance along the race path */
  pointAt(s) {
    const { pts, cum } = this;
    s = clamp(s, 0, this.total);
    let i = 1;
    while (i < pts.length - 1 && cum[i] < s) i++;
    const a = pts[i - 1], b = pts[i];
    const L = cum[i] - cum[i - 1] || 1;
    const t = (s - cum[i - 1]) / L;
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, dx: (b.x - a.x) / L, dz: (b.z - a.z) / L, s };
  }
  /** distance along the path of the closest point to (x,z), searching near a hint segment */
  project(x, z, hint) {
    const { pts, cum } = this;
    let best = Infinity, bs = 0, bi = hint;
    const i0 = Math.max(1, hint - 3), i1 = Math.min(pts.length - 1, hint + 8);
    for (let i = i0; i <= i1; i++) {
      const a = pts[i - 1], b = pts[i];
      const abx = b.x - a.x, abz = b.z - a.z;
      const L2 = abx * abx + abz * abz || 1;
      const t = clamp(((x - a.x) * abx + (z - a.z) * abz) / L2, 0, 1);
      const d = Math.hypot(x - (a.x + abx * t), z - (a.z + abz * t));
      if (d < best) { best = d; bs = cum[i - 1] + t * Math.sqrt(L2); bi = i; }
    }
    return { s: bs, i: bi, d: best };
  }

  /* ---------------- race ---------------- */
  start(t, pts, name, color) {
    const g = this.g, p = g.player;
    if (g.rides.state === 'offer') g.rides.decline();
    this.track = t;
    this.rivalName = name;
    let r = this.rivals[color];
    if (!r) {
      r = new TrafficCar(g.traffic, buildCar({ type: 'sport', color }).root);
      r.isRival = true;
      const tag = labelSprite('🏎️ ' + name, 'rgba(120,20,160,0.85)');
      tag.position.y = 2.25;
      tag.scale.multiplyScalar(0.42);
      r.group.add(tag);
      this.rivals[color] = r;
    }
    this.rival = r;
    this.state = 'countdown';
    this.placed = false;
    this.cd = 4.2;
    this.cdShown = -1;
    this.cp = 0;
    this.time = 0;
    this.pi = 1;
    this.ri = 1;
    this.rs = 0;
    this.ps = 0;
    this.rivalDone = false;
    this.off = -LANE * 0.5;
    this.stuckT = 0;
    this.idleT = 0;
    this.prevGuide = g.guideOn;
    const st = this.pointAt(6);
    const h = Math.atan2(st.dx, st.dz);
    this.startPos = { x: st.x + -st.dz * LANE * 0.55, z: st.z + st.dx * LANE * 0.55, h };
    g.fade(1, 0.35, () => {
      if (this.state !== 'countdown') {
        g.fade(0, 0.3);
        return;
      }
      p.placeAt(this.startPos.x, this.startPos.z, h);
      this.placed = true;
      p.lights = g.env && g.env.night > 0.4;
      r.pos.set(st.x - -st.dz * LANE * 0.55, 0, st.z - st.dx * LANE * 0.55);
      r.heading = h;
      r.speed = 0;
      r.knock.set(0, 0);
      r.spin = 0;
      r.active = true;
      r.state = 'drive';
      r.group.visible = true;
      r.sync(0);
      g.traffic.clearAround && g.traffic.clearAround(st.x, st.z, 60);
      g.fade(0, 0.5);
      g.guideOn = true;
      this.showGates();
      g.setGuide({ x: this.cps[0].x, z: this.cps[0].z, label: '🏁 چک‌پوینت', addr: `${fa(1)} از ${fa(this.cps.length)}`, race: true });
      $('raceHud').classList.remove('hidden');
      g.ui.say(name, RIVALS.find((x) => x[0] === name)[2], { mood: 'grumpy' });
    });
  }
  showGates() {
    const w = this.g.world;
    const place = (m, c) => {
      m.position.set(c.x, w.heightAt(c.x, c.z) + 4.2, c.z);
      m.rotation.set(0, Math.atan2(c.dx, c.dz), 0);
    };
    const last = this.cp === this.cps.length - 1;
    const c = this.cps[this.cp];
    this.gate.visible = !last;
    this.arch.visible = last;
    if (last) place(this.arch, c);
    else place(this.gate, c);
    const n = this.cps[this.cp + 1];
    this.gate2.visible = !!n && this.cp + 1 < this.cps.length - 1;
    if (this.gate2.visible) place(this.gate2, n);
    if (!last && this.cps.length) {
      // the arch is always visible from afar at the end
      const f = this.cps[this.cps.length - 1];
      place(this.arch, f);
      this.arch.visible = true;
    }
  }
  abort(msg) {
    if (this.state === 'idle') return;
    this.g.ui.toast(msg || '🏁 مسابقه لغو شد', 'warn');
    this.finish(false, true);
  }
  finish(win, aborted = false) {
    const g = this.g, t = this.track;
    this.state = 'idle';
    this.gate.visible = this.gate2.visible = this.arch.visible = false;
    $('raceHud').classList.add('hidden');
    $('countdown').classList.add('hidden');
    g.guideOn = this.prevGuide;
    if (g.rides.ride) g.rides.restoreGuide();
    else g.clearGuide();
    g.rides.cooldown = Math.max(g.rides.cooldown, 10);
    const r = this.rival;
    this.leaveT = 6;
    if (aborted) {
      this.leaveT = 0.1;
      if (!this.placed) {
        // never got to the start line: give the entry fee back
        g.money += t.fee;
        this.placed = true;
      }
      return;
    }
    const s = g.stats;
    if (win) {
      g.money += t.prize;
      g.coins += t.coins;
      s.racesWon = (s.racesWon || 0) + 1;
      g.addXp(150);
      s.raceTracks = s.raceTracks || [];
      if (!s.raceTracks.includes(t.id)) s.raceTracks.push(t.id);
      g.audio.cash();
      g.stunts.banner(`🏆 بردی! +${faMoney(t.prize)} تومان • 🪙 ${fa(t.coins)}`);
      g.ui.say(this.rivalName, pick(['باورم نمیشه! دفعه بعد جبران می‌کنم 😤', 'دمت گرم، خوب روندی! 👏', 'شانسی بردی! یه دور دیگه؟ 😠']), { mood: 'grumpy' });
    } else {
      g.audio.bad();
      g.stunts.banner(`😞 ${this.rivalName} زودتر رسید!`);
      g.ui.say(this.rivalName, pick(['هه! گفتم که نمی‌تونی 😏', 'برو یه ماشین بهتر بخر! 😂', 'دفعه بعد شاید! 🏎️💨']), { mood: 'grumpy' });
    }
    s.races = (s.races || 0) + 1;
    if (!win) g.addXp(40);
    r.speed = Math.min(r.speed, 14);
    g.save();
  }
  update(dt) {
    const g = this.g, p = g.player;
    // flags flutter
    const tt = g.time;
    for (const s of this.spots) s.flag.rotation.y = Math.sin(tt * 3 + s.padX) * 0.25;
    this.ringMat.opacity = 0.55 + Math.sin(tt * 4) * 0.25;
    if (this.state === 'idle') {
      // the rival drives off and disappears
      if (this.rival && this.rival.active) {
        this.leaveT -= dt;
        if (this.leaveT > 0 && this.pts) this.driveRival(dt, true);
        else this.rival.deactivate();
      }
      return;
    }
    if (g.state === 'jail' || g.police.state === 'chase' || g.police.state === 'arrest') return this.abort('🚨 پلیس اومد! مسابقه بهم خورد');
    if (g.onfoot.active || g.onfoot.busy) return this.abort('از ماشین پیاده شدی؛ مسابقه رو باختی 🏳️');
    if (p.burning) return this.abort('ماشین آتیش گرفت! مسابقه لغو شد 🔥');
    if (g.state !== 'play') return;
    g.rides.cooldown = Math.max(g.rides.cooldown, 5);
    const hud = $('raceHud');
    if (this.state === 'countdown') {
      if (!this.placed) return;
      this.cd -= dt;
      // hold both cars on the line
      p.speed = 0;
      p.ext.set(0, 0);
      p.pos.x = this.startPos.x;
      p.pos.z = this.startPos.z;
      p.heading = this.startPos.h;
      const n = Math.ceil(this.cd);
      if (n !== this.cdShown && this.cd < 3.2) {
        this.cdShown = n;
        const el = $('countdown');
        el.classList.remove('hidden');
        el.textContent = n > 0 ? fa(n) : 'برو! 🔥';
        el.classList.toggle('go', n <= 0);
        el.style.animation = 'none';
        void el.offsetWidth;
        el.style.animation = '';
        g.audio.tone(n > 0 ? 520 : 1040, n > 0 ? 0.25 : 0.6, 0.2, 'square');
      }
      if (this.cd <= 0) {
        this.state = 'racing';
        g.audio.burst(0.6, 1200, 'bandpass', 0.4);
      }
      hud.innerHTML = `🏁 ${this.track.name} • آماده...`;
      this.driveRival(0, false);
      return;
    }
    // racing
    this.time += dt;
    if (this.time > 1 && this.time - dt <= 1) $('countdown').classList.add('hidden');
    const pr = this.project(p.pos.x, p.pos.z, this.pi);
    this.pi = pr.i;
    this.ps = pr.s;
    this.driveRival(dt, false);
    // checkpoints
    const c = this.cps[this.cp];
    if (Math.hypot(p.pos.x - c.x, p.pos.z - c.z) < 14 || (this.ps > c.s + 5 && Math.hypot(p.pos.x - c.x, p.pos.z - c.z) < 40)) {
      this.cp++;
      if (this.cp >= this.cps.length) {
        this.finish(!this.rivalDone);
        return;
      }
      g.audio.tone(880, 0.12, 0.15, 'triangle');
      g.audio.tone(1320, 0.18, 0.12, 'triangle', 0.08);
      this.showGates();
      const nc = this.cps[this.cp];
      g.setGuide({ x: nc.x, z: nc.z, label: this.cp === this.cps.length - 1 ? '🏁 خط پایان' : '🏁 چک‌پوینت', addr: `${fa(this.cp + 1)} از ${fa(this.cps.length)}`, race: true });
    }
    if (this.rivalDone) {
      this.finish(false);
      return;
    }
    // too far off the track or stopped for too long
    if (pr.d > 320) return this.abort('خیلی از مسیر مسابقه دور شدی؛ باختی 🏳️');
    this.idleT = (p.groundSpeed ?? Math.abs(p.speed)) < 1 ? this.idleT + dt : 0;
    if (this.idleT > 25) return this.abort('وایسادی؟! رقیب مسخره‌ت کرد و رفت 🏳️');
    const first = this.ps >= this.rs;
    const mm = Math.floor(this.time / 60), ss = (this.time % 60).toFixed(1).padStart(4, '0');
    hud.innerHTML = `<b class="${first ? 'p1' : 'p2'}">${first ? '🥇 نفر اول' : '🥈 نفر دوم'}</b><span>🚩 ${fa(this.cp)}/${fa(this.cps.length)}</span><span>⏱ ${fa(mm)}:${fa(ss).replace('.', '٫')}</span><span class="gap">${fa(Math.round(Math.abs(this.ps - this.rs)))} متر ${first ? 'جلوتر' : 'عقب‌تر'}</span>`;
  }
  /** pure-pursuit rival following the race path, with rubber banding and overtaking */
  driveRival(dt, leaving) {
    const g = this.g, r = this.rival, w = g.world;
    r.state = 'drive';
    if (dt <= 0) {
      r.sync(0);
      return;
    }
    const pr = this.project(r.pos.x, r.pos.z, this.ri);
    this.ri = pr.i;
    this.rs = pr.s;
    if (!leaving && this.rs >= this.total - 4) this.rivalDone = true;
    const ahead = (d) => ({ x: r.pos.x + Math.sin(r.heading) * d, z: r.pos.z + Math.cos(r.heading) * d, dx: Math.sin(r.heading), dz: Math.cos(r.heading) });
    const pastEnd = leaving && this.rs > this.total - 40;
    const look = pastEnd ? ahead(10) : this.pointAt(this.rs + 7 + Math.abs(r.speed) * 0.45);
    // overtaking: shift sideways when something is in the way
    const fx = Math.sin(r.heading), fz = Math.cos(r.heading);
    let offT = -LANE * 0.5;
    for (const o of g.traffic.obstacles) {
      if (o === r) continue;
      const rx = o.pos.x - r.pos.x, rz = o.pos.z - r.pos.z;
      const f = rx * fx + rz * fz;
      if (f <= 0 || f > 26) continue;
      const lat = rx * fz - rz * fx; // >0: obstacle on our left side
      if (Math.abs(lat) > 2.6) continue;
      offT = lat > 0 ? LANE * 1.1 : -LANE * 1.6;
      if (f < 9) r.speed = Math.min(r.speed, Math.max(6, (o.speed || 0) + 2));
    }
    this.off = damp(this.off, offT, 2.2, dt);
    const tx = look.x - look.dz * this.off, tz = look.z + look.dx * this.off;
    // corner speed
    const far = pastEnd ? ahead(30) : this.pointAt(this.rs + 22 + Math.abs(r.speed) * 1.1);
    const ang = Math.abs(wrapAngle(Math.atan2(far.x - r.pos.x, far.z - r.pos.z) - r.heading));
    let target = this.track.city ? 27 : 41;
    if (ang > 0.2) target = Math.min(target, Math.max(11, 42 - ang * 34));
    if (!leaving) {
      // rubber band so the race stays close
      const gap = this.rs - this.ps;
      if (gap > 50) target *= clamp(1 - (gap - 50) / 260, 0.62, 1);
      else if (gap < -30) target *= clamp(1 + (-gap - 30) / 220, 1, this.rs > this.total * 0.85 ? 1.08 : 1.28);
    } else target = Math.min(target, 16);
    r.speed += clamp(target - r.speed, -14 * dt, 7 * dt);
    const err = wrapAngle(Math.atan2(tx - r.pos.x, tz - r.pos.z) - r.heading);
    const maxRate = Math.abs(r.speed) / 4 + 0.6;
    r.heading += clamp(err * 3.6, -maxRate, maxRate) * dt;
    r.pos.x += (Math.sin(r.heading) * r.speed + r.knock.x) * dt;
    r.pos.z += (Math.cos(r.heading) * r.speed + r.knock.y) * dt;
    r.knock.x = damp(r.knock.x, 0, 3, dt);
    r.knock.y = damp(r.knock.y, 0, 3, dt);
    const q = this._q || (this._q = []);
    for (const off of OFFS) {
      const cx = r.pos.x + Math.sin(r.heading) * off, cz = r.pos.z + Math.cos(r.heading) * off;
      w.statics.query(cx, cz, 2, q);
      for (const o of q) {
        if (o.soft || o.ramp || !collideCircle(cx, cz, 0.95, o, _res)) continue;
        r.pos.x += _res.nx * _res.pen;
        r.pos.z += _res.nz * _res.pen;
        r.speed *= 0.9;
      }
    }
    // stuck: hop back onto the racing line a bit further on
    this.stuckT = Math.abs(r.speed) < 2 && !leaving && this.state === 'racing' ? this.stuckT + dt : 0;
    if (this.stuckT > 2.5) {
      const np = this.pointAt(this.rs + 12);
      r.pos.set(np.x, 0, np.z);
      r.heading = Math.atan2(np.dx, np.dz);
      r.speed = 8;
      this.stuckT = 0;
    }
    r.sync(dt);
  }
}
