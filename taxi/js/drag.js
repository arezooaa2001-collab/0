import * as THREE from 'three';
import { buildCar } from './models.js';
import { GEAR_MAX, TOP_GEAR } from './vehicle.js';
import { boxCol, canvasTexture, clamp, fa, faMoney, damp } from './util.js';

const $ = (id) => document.getElementById(id);
const LEN = 402;
// launch: hold the revs in this window when the light turns green
const LAUNCH = [3600, 5300];
// shift: change up while the needle is in this window
const SHIFT = [5850, 6500];
const RPM_MAX = 7200;
const OPP = [
  { name: 'مش رحیم', icon: '👴', type: 'van', color: 0xd9d4c5, et: 21.5, bet: 50000, prize: 130000, coins: 3, talk: 'پسرم این وانت از بابای من به من رسیده، هنوز جون داره! 😄' },
  { name: 'کامی سریع', icon: '😎', type: 'hatch', color: 0xff7a00, et: 19.2, bet: 100000, prize: 270000, coins: 6, talk: 'آماده‌ای خاک بخوری؟ 💨' },
  { name: 'رضا توربو', icon: '🔥', type: 'sport', color: 0x1565c0, et: 17.4, bet: 200000, prize: 560000, coins: 12, talk: 'توربوی من رو شنیدی؟ فیییییس! 😏' },
  { name: 'شاهین دودی', icon: '👑', type: 'sport', color: 0x111111, et: 15.6, bet: 400000, prize: 1200000, coins: 25, talk: 'هیچ‌کس تا حالا منو توی درگ نبرده... هیچ‌کس. 🖤' },
];
const fmt = (t) => fa(t.toFixed(3)).replace('.', '٫');

/** Rival motion: v = Vm(1 - e^-kt), tuned so the quarter mile takes exactly `et` seconds. */
function rivalModel(et) {
  const Vm = (LEN / et) * 2.05;
  const d = (k, t) => Vm * (t - (1 - Math.exp(-k * t)) / k);
  let lo = 0.01, hi = 5;
  for (let i = 0; i < 60; i++) {
    const k = (lo + hi) / 2;
    if (d(k, et) < LEN) lo = k;
    else hi = k;
  }
  const k = (lo + hi) / 2;
  const at = (dist) => {
    let a = 0, b = et * 2;
    for (let i = 0; i < 40; i++) {
      const m = (a + b) / 2;
      if (d(k, m) < dist) a = m;
      else b = m;
    }
    return (a + b) / 2;
  };
  return { Vm, k, d: (t) => d(k, t), v: (t) => Vm * (1 - Math.exp(-k * t)), at };
}

/** Quarter-mile drag strip in the desert: christmas tree, launch control by ear, perfect shifts and a time slip. */
export class Drag {
  constructor(game) {
    this.g = game;
    this.state = 'idle';
    const w = game.world, D = (this.D = w.drag);
    this.lanes = [D.x - 4.5, D.x + 4.5];
    this.spot = { kind: 'drag', padX: this.lanes[0], padZ: D.z0 - 28, name: 'درگ ۴۰۰ متری' };
    this.buildStrip();
    this.buildTree();
    this.buildStands();
    this.board = this.buildBoard();
  }
  /* ---------------- scenery ---------------- */
  buildStrip() {
    const g = this.g, w = g.world, D = this.D, scene = g.scene;
    const y0 = w.heightAt(D.x, D.z0) + 0.07;
    const len = D.z1 - (D.z0 - 50);
    const tex = canvasTexture(256, 1024, (c, W, H) => {
      c.fillStyle = '#2e3033';
      c.fillRect(0, 0, W, H);
      for (let i = 0; i < 4000; i++) {
        c.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${0.04 + Math.random() * 0.04})`;
        c.fillRect(Math.random() * W, Math.random() * H, 2, 2);
      }
      const m = W / 18;
      c.fillStyle = '#f2f2f2';
      c.fillRect(0.35 * m, 0, 0.22 * m, H);
      c.fillRect(W - 0.57 * m, 0, 0.22 * m, H);
      c.fillRect(W / 2 - 0.12 * m, 0, 0.24 * m, H);
      // rubbered-in lanes where the tyres run
      c.fillStyle = 'rgba(0,0,0,0.22)';
      for (const lx of [4.5 - 0.8, 4.5 + 0.8, 13.5 - 0.8, 13.5 + 0.8]) c.fillRect((lx - 0.35) * m, 0, 0.7 * m, H);
    }, { repeat: [1, len / 72], aniso: 8 });
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(D.hw * 2, len), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(D.x, y0, (D.z0 - 50 + D.z1) / 2);
    strip.receiveShadow = true;
    scene.add(strip);
    // burnout box: black tyre marks just behind the line
    const burn = canvasTexture(128, 256, (c, W, H) => {
      c.clearRect(0, 0, W, H);
      for (const lx of [0.25, 0.75]) {
        const grd = c.createLinearGradient(0, 0, 0, H);
        grd.addColorStop(0, 'rgba(0,0,0,0)');
        grd.addColorStop(0.6, 'rgba(0,0,0,0.55)');
        grd.addColorStop(1, 'rgba(0,0,0,0.75)');
        c.fillStyle = grd;
        c.fillRect(lx * W - 22, 0, 12, H);
        c.fillRect(lx * W + 10, 0, 12, H);
      }
    });
    const bm = new THREE.MeshBasicMaterial({ map: burn, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    const bp = new THREE.Mesh(new THREE.PlaneGeometry(D.hw * 2, 60), bm);
    bp.rotation.x = -Math.PI / 2;
    bp.rotation.z = Math.PI;
    bp.position.set(D.x, y0 + 0.004, D.z0 + 30);
    scene.add(bp);
    // start and finish lines (chequered)
    const chk = canvasTexture(256, 16, (c, W, H) => {
      for (let i = 0; i < 32; i++) for (let j = 0; j < 2; j++) {
        c.fillStyle = (i + j) % 2 ? '#111' : '#fff';
        c.fillRect(i * 8, j * 8, 8, 8);
      }
    }, { srgb: true });
    for (const z of [D.z0, D.z0 + LEN]) {
      const l = new THREE.Mesh(new THREE.PlaneGeometry(D.hw * 2, 1.1), new THREE.MeshBasicMaterial({ map: chk, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
      l.rotation.x = -Math.PI / 2;
      l.position.set(D.x, y0 + 0.006, z);
      scene.add(l);
    }
    // distance boards along the west side
    const post = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.5, roughness: 0.5 });
    for (const [d, t] of [[18, '۱۸ م'], [100, '۱۰۰'], [201, '۲۰۰'], [300, '۳۰۰'], [LEN, '🏁']]) {
      const tx = canvasTexture(128, 96, (c, W, H) => {
        c.fillStyle = d === LEN ? '#c62828' : '#ffd21a';
        c.fillRect(0, 0, W, H);
        c.fillStyle = '#111';
        c.font = 'bold 52px Vazirmatn, Tahoma, sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(t, W / 2, H / 2 + 3);
      });
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 1.2), [post, post, post, post, new THREE.MeshBasicMaterial({ map: tx }), new THREE.MeshBasicMaterial({ map: tx })]);
      const x = D.x - D.hw - 1.4, z = D.z0 + d;
      b.position.set(x, w.heightAt(x, z) + 1.6, z);
      b.rotation.y = Math.PI / 2;
      scene.add(b);
      const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 6), post);
      pl.position.set(x, w.heightAt(x, z) + 0.6, z);
      scene.add(pl);
    }
    // finish gantry
    const gm = new THREE.MeshStandardMaterial({ color: 0x30343a, metalness: 0.6, roughness: 0.4 });
    const zf = D.z0 + LEN;
    for (const sx of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7, 0.5), gm);
      const x = D.x + sx * (D.hw + 0.8);
      p.position.set(x, w.heightAt(x, zf) + 3.5, zf);
      scene.add(p);
      w.statics.insert(boxCol(x, zf, 0.3, 0.3));
    }
    const ban = canvasTexture(512, 64, (c, W, H) => {
      c.fillStyle = '#b71c1c';
      c.fillRect(0, 0, W, H);
      c.fillStyle = '#fff';
      c.font = 'bold 40px Vazirmatn, Tahoma, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('🏁 خط پایان • ۴۰۲ متر 🏁', W / 2, H / 2 + 2);
    });
    const bb = new THREE.Mesh(new THREE.BoxGeometry(D.hw * 2 + 2.2, 1.3, 0.25), [gm, gm, gm, gm, new THREE.MeshBasicMaterial({ map: ban }), new THREE.MeshBasicMaterial({ map: ban })]);
    bb.position.set(D.x, w.heightAt(D.x, zf) + 6.4, zf);
    scene.add(bb);
    // entrance arch sign at the staging lanes
    const arch = canvasTexture(512, 96, (c, W, H) => {
      const grd = c.createLinearGradient(0, 0, W, 0);
      grd.addColorStop(0, '#ff6a00');
      grd.addColorStop(1, '#ee0979');
      c.fillStyle = grd;
      c.fillRect(0, 0, W, H);
      c.fillStyle = '#fff';
      c.font = 'bold 50px Vazirmatn, Tahoma, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('🚦 پیست درگ کویر 🚦', W / 2, H / 2 + 3);
    });
    const ze = D.z0 - 45;
    for (const sx of [-1, 1]) {
      const x = D.x + sx * (D.hw + 0.8);
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.45, 6.5, 0.45), gm);
      p.position.set(x, w.heightAt(x, ze) + 3.25, ze);
      scene.add(p);
      w.statics.insert(boxCol(x, ze, 0.3, 0.3));
    }
    const ab = new THREE.Mesh(new THREE.BoxGeometry(D.hw * 2 + 2, 1.7, 0.3), [gm, gm, gm, gm, new THREE.MeshBasicMaterial({ map: arch }), new THREE.MeshBasicMaterial({ map: arch })]);
    ab.position.set(D.x, w.heightAt(D.x, ze) + 6, ze);
    scene.add(ab);
  }
  buildTree() {
    const g = this.g, w = g.world, D = this.D;
    const grp = new THREE.Group();
    const dark = new THREE.MeshStandardMaterial({ color: 0x1d1f22, metalness: 0.4, roughness: 0.5 });
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.2, 0.16), dark);
    pole.position.y = 1.1;
    grp.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.95, 2.5, 0.22), dark);
    head.position.y = 3.35;
    grp.add(head);
    // per lane: stage, 3 ambers, green, red (top to bottom), facing the cars on the line
    const geo = new THREE.SphereGeometry(0.17, 12, 8);
    this.bulbs = [[], []];
    const rows = [['stage', 0x8fd3ff], ['a1', 0xffa000], ['a2', 0xffa000], ['a3', 0xffa000], ['go', 0x2bff5a], ['red', 0xff2020]];
    rows.forEach(([id, col], i) => {
      for (const lane of [0, 1]) {
        const m = new THREE.MeshBasicMaterial({ color: 0x222222 });
        const b = new THREE.Mesh(geo, m);
        b.position.set(lane ? 0.24 : -0.24, 4.35 - i * 0.4, -0.15);
        grp.add(b);
        this.bulbs[lane].push({ id, col, m });
      }
    });
    grp.position.set(D.x, w.heightAt(D.x, D.z0), D.z0 + 7);
    g.scene.add(grp);
    w.statics.insert(boxCol(D.x, D.z0 + 7, 0.3, 0.3));
    this.tree = grp;
  }
  lights(on = {}) {
    for (const lane of [0, 1]) for (const b of this.bulbs[lane]) b.m.color.setHex(on[b.id] === true || on[b.id] === lane ? b.col : 0x222222);
  }
  buildStands() {
    const g = this.g, w = g.world, D = this.D;
    // grandstand with a cheering crowd east of the finish line
    const crowd = canvasTexture(512, 64, (c, W, H) => {
      c.fillStyle = '#5b6067';
      c.fillRect(0, 0, W, H);
      const cols = ['#e53935', '#1e88e5', '#fdd835', '#43a047', '#fb8c00', '#8e24aa', '#ffffff', '#212121', '#00acc1'];
      for (let i = 0; i < 220; i++) {
        const x = Math.random() * W, y = 18 + Math.random() * 38;
        c.fillStyle = cols[(Math.random() * cols.length) | 0];
        c.fillRect(x - 3, y, 7, 14);
        c.fillStyle = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524'][(Math.random() * 4) | 0];
        c.beginPath();
        c.arc(x, y - 3, 3.6, 0, Math.PI * 2);
        c.fill();
      }
    });
    const conc = new THREE.MeshStandardMaterial({ color: 0x9e9e9e, roughness: 0.9 });
    const front = new THREE.MeshStandardMaterial({ map: crowd, roughness: 0.9 });
    const x0 = D.x + D.hw + 7, zc = D.z0 + LEN - 30, L = 70;
    const yb = w.heightAt(x0, zc);
    for (let i = 0; i < 4; i++) {
      const tier = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1 + i * 1.1, L), [conc, conc, conc, conc, conc, conc]);
      const x = x0 + i * 2.4;
      tier.position.set(x, yb + (1 + i * 1.1) / 2, zc);
      g.scene.add(tier);
      const people = new THREE.Mesh(new THREE.PlaneGeometry(L, 1.3), front);
      people.position.set(x - 0.6, yb + 1 + i * 1.1 + 0.6, zc);
      people.rotation.y = -Math.PI / 2;
      g.scene.add(people);
    }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(11, 0.3, L + 2), new THREE.MeshStandardMaterial({ color: 0xc62828, roughness: 0.6 }));
    roof.position.set(x0 + 3.6, yb + 7.4, zc);
    g.scene.add(roof);
    for (const dz of [-L / 2, 0, L / 2]) for (const dx of [-1.4, 8.6]) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 7.4, 8), conc);
      c.position.set(x0 + dx, yb + 3.7, zc + dz);
      g.scene.add(c);
    }
    w.statics.insert(boxCol(x0 + 3.6, zc, 5.4, L / 2));
    this.stands = { x: x0, z: zc, L };
  }
  /** the big timing board at the finish shows the last run */
  buildBoard() {
    const g = this.g, w = g.world, D = this.D;
    const cv = document.createElement('canvas');
    cv.width = 512;
    cv.height = 160;
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const frame = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const scr = new THREE.MeshBasicMaterial({ map: tex });
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.6, 8), [scr, frame, frame, frame, frame, frame]);
    const x = D.x - D.hw - 5, z = D.z0 + LEN + 8;
    m.position.set(x, w.heightAt(x, z) + 4.2, z);
    g.scene.add(m);
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3, 0.3), frame);
    pole.position.set(x, w.heightAt(x, z) + 1.5, z);
    g.scene.add(pole);
    w.statics.insert(boxCol(x, z, 0.3, 0.3));
    const board = { cv, tex };
    this.drawBoard(board, null);
    return board;
  }
  drawBoard(b, r) {
    const c = b.cv.getContext('2d'), W = b.cv.width, H = b.cv.height;
    c.fillStyle = '#05070a';
    c.fillRect(0, 0, W, H);
    c.font = 'bold 34px monospace';
    c.textBaseline = 'middle';
    c.fillStyle = '#ffb300';
    c.textAlign = 'center';
    if (!r) c.fillText('DRAG STRIP  402 m', W / 2, H / 2);
    else {
      c.fillText(`YOU  ${r.et.toFixed(3)}s  ${Math.round(r.trap)} km/h`, W / 2, H * 0.3);
      c.fillStyle = r.win ? '#5dff8a' : '#ff5252';
      c.fillText(`${r.rival.padEnd(4)} ${r.ret.toFixed(3)}s  ${r.win ? 'WIN!' : 'LOSE'}`, W / 2, H * 0.7);
    }
    b.tex.needsUpdate = true;
  }
  /* ---------------- flow ---------------- */
  canStart() {
    const g = this.g;
    if (this.state !== 'idle' || g.race.state !== 'idle' || g.crazy.state !== 'idle' || g.parking.state !== 'idle') return false;
    if (g.rides.ride) return g.ui.toast('اول سفر مسافرت رو تموم کن 🧳', 'warn'), false;
    if (g.police.state !== 'none') return g.ui.toast('با پلیس پشت سرت؟! 🚨', 'warn'), false;
    if (g.player.burning || g.onfoot.active || g.onfoot.busy || g.player.health <= 0) return false;
    if (g.player.fuelTotal() < 2) return g.ui.toast('⛽ با این بنزین به خط پایان نمی‌رسی!', 'warn'), false;
    return true;
  }
  offer() {
    const g = this.g, s = g.stats;
    if (!this.canStart()) return;
    const beat = s.dragBeat || 0;
    g.ui.panel(`<h2>🚦 پیست درگ کویر • ۴۰۲ متر</h2>
      <div class="statrow"><span>🏆 برد: ${fa(s.dragWins || 0)}</span><span>⏱ بهترین زمان: ${s.dragBest ? fmt(s.dragBest) + ' ث' : '—'}</span><span>💨 بیشترین سرعت: ${s.dragTrap ? fa(Math.round(s.dragTrap)) + ' km/h' : '—'}</span><span>⚡ تعویض عالی: ${fa(s.perfectShifts || 0)}</span></div>
      <div class="dragtips"><b>🎓 چطوری ببرم؟</b>
        <span>۱. وقتی چراغ‌های زرد روشن میشن با گاز دور موتور رو توی <i class="gz">محدوده سبز</i> نگه دار (گاز رو کامل فشار نده!)</span>
        <span>۲. چراغ سبز = گاز! استارت توی محدوده سبز = 🚀 استارت عالی</span>
        <span>۳. وقتی عقربه دور موتور به <i class="gz">ناحیه سبز</i> رسید دنده رو بالا ببر (E یا دکمه ⬆️ دنده)</span>
        <span>۴. نیترو هم مجازه 😉 از خط وسط رد نشو!</span></div>
      <div class="opps">${OPP.map((o, i) => {
        const locked = i > beat;
        return `<div class="card ${locked ? 'locked' : ''}"><h3>${o.icon} ${o.name}</h3><p>رکورد: ${fmt(o.et)} ثانیه</p><p>شرط: ${faMoney(o.bet)} • جایزه: ${faMoney(o.prize)} + 🪙${fa(o.coins)}</p>
          ${locked ? '<button disabled>🔒 اول نفر قبلی رو ببر</button>' : `<button data-o="${i}">مسابقه! 🚦</button>`}</div>`;
      }).join('')}</div>
      <p class="money">موجودی: ${faMoney(g.money)} تومان${g.coins ? ` + 🪙 ${fa(g.coins)} سکه` : ''}</p>`, (el) => {
      el.querySelectorAll('[data-o]').forEach((b) => (b.onclick = () => {
        const o = OPP[+b.dataset.o];
        g.topUp(o.bet);
        if (g.money < o.bet) return g.ui.toast('پول شرط رو نداری 😕', 'warn');
        g.ui.closePanel();
        if (this.canStart()) this.start(+b.dataset.o);
      }));
    });
  }
  start(idx) {
    const g = this.g, p = g.player, D = this.D, o = OPP[idx];
    if (g.rides.state === 'offer') g.rides.decline();
    g.money -= o.bet;
    this.opp = idx;
    this.model = rivalModel(o.et * (0.985 + Math.random() * 0.03));
    this.state = 'stage';
    this.t = 0;
    this.treeAt = 1.2 + Math.random() * 1.3;
    this.goT = null;
    this.launched = false;
    this.slip = { react: null, t18: null, t201: null, v201: 0, et: null, trap: 0 };
    this.rv = { t: 0, react: 0.18 + Math.random() * 0.15, d: 0, fin: null };
    this.shifts = 0;
    this.perfect = 0;
    this.spin = 0;
    this.warned = false;
    this.beep = -1;
    this.launchText = '—';
    this.prevAuto = p.auto;
    p.auto = false;
    if (g.cruise) g.setCruise(false);
    p.placeAt(this.lanes[0], D.z0 - 2.4, 0);
    p.quickShift(0, 0);
    // rival car on the right lane
    const car = buildCar({ type: o.type, color: o.color });
    this.rival = car;
    car.root.position.set(this.lanes[1], g.world.heightAt(this.lanes[1], D.z0), D.z0 - 2.4);
    g.scene.add(car.root);
    if (g.guide && g.guide.custom) g.clearGuide();
    g.rides.cooldown = Math.max(g.rides.cooldown, 15);
    this.lights({ stage: true });
    $('dragHud').classList.remove('hidden');
    document.body.classList.add('timedmode', 'dragmode');
    g.ui.say(`${o.icon} ${o.name}`, o.talk);
    g.audio.tone(520, 0.15, 0.12, 'square');
  }
  /** E / Shift / the ⬆️ button. Returns true when the drag race used the key. */
  shift(dir) {
    const g = this.g, p = g.player;
    if (this.state === 'stage' || this.state === 'tree') return true;
    if (this.state !== 'run') return false;
    if (dir < 0 || p.gear < 1 || p.gear >= TOP_GEAR) return true;
    const rpm = 850 + (Math.max(0, p.speed) / (GEAR_MAX[p.gear] * p.speedMul())) * 5900;
    let label, cls, clutch;
    if (rpm >= SHIFT[0] && rpm <= SHIFT[1]) {
      label = '⚡ تعویض عالی!';
      cls = 'perfect';
      clutch = 0.15;
      p.speed += 0.9;
      this.perfect++;
      g.audio.tone(1560, 0.08, 0.12, 'sine');
      g.camera.fov += 7;
    } else if (rpm >= 5150 && rpm < SHIFT[0]) {
      label = '👍 خوب';
      cls = 'good';
      clutch = 0.35;
    } else if (rpm < 5150) {
      label = '🐢 زود عوض کردی!';
      cls = 'early';
      clutch = 0.75;
    } else {
      label = '🔥 دیر عوض کردی!';
      cls = 'late';
      clutch = 0.4;
    }
    this.shifts++;
    p.quickShift(p.gear + 1, clutch);
    g.audio.click(0.9);
    this.feedback(label, cls);
    return true;
  }
  feedback(text, cls) {
    const el = $('dragMsg');
    el.textContent = text;
    el.className = cls;
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(this.fbT);
    this.fbT = setTimeout(() => el.classList.remove('show'), 900);
  }
  end(ok, reason) {
    const g = this.g, p = g.player;
    if (this.state === 'idle') return;
    const wasRunning = this.state;
    this.state = 'idle';
    p.auto = this.prevAuto;
    $('dragHud').classList.add('hidden');
    document.body.classList.remove('timedmode', 'dragmode');
    if (this.rival) {
      g.scene.remove(this.rival.root);
      this.rival = null;
    }
    this.lights({});
    if (!ok) {
      g.audio.bad();
      if (reason) g.ui.toast(reason, 'warn');
      if (wasRunning === 'stage' || wasRunning === 'tree') {
        // cancelled before the green light: the bet comes back
        g.money += OPP[this.opp].bet;
      }
    }
  }
  finish() {
    const g = this.g, s = g.stats, o = OPP[this.opp], S = this.slip, R = this.rv;
    const rivalEt = this.model.at(LEN) + R.react;
    const win = S.et < rivalEt;
    const tr = S.trap;
    const rec = !s.dragBest || S.et < s.dragBest;
    if (rec) s.dragBest = +S.et.toFixed(3);
    s.dragTrap = Math.max(s.dragTrap || 0, tr);
    s.perfectShifts = (s.perfectShifts || 0) + this.perfect;
    s.dragRuns = (s.dragRuns || 0) + 1;
    let pay = 0;
    if (win) {
      pay = o.prize;
      g.money += pay;
      g.coins += o.coins;
      s.dragWins = (s.dragWins || 0) + 1;
      if (this.opp + 1 > (s.dragBeat || 0)) {
        s.dragBeat = this.opp + 1;
        if (OPP[this.opp + 1]) setTimeout(() => g.ui.toast(`🔓 حریف جدید باز شد: ${OPP[this.opp + 1].icon} ${OPP[this.opp + 1].name}`, 'good'), 2500);
      }
      g.addXp(60 + this.opp * 30 + this.perfect * 10);
      g.audio.cash();
      g.audio.burst(1.6, 1500, 'bandpass', 0.3);
      g.fireworks.show(this.D.x + 30, this.D.z0 + LEN + 60, 3);
    } else {
      g.addXp(15 + this.perfect * 5);
      g.audio.bad();
    }
    this.drawBoard(this.board, { et: S.et, trap: tr, ret: rivalEt, rival: 'CPU', win });
    const r18 = this.model.at(18.3) + R.react, r201 = this.model.at(201) + R.react;
    const rv201 = this.model.v(this.model.at(201)) * 3.6, rtrap = this.model.v(this.model.at(LEN)) * 3.6;
    const row = (t, a, b, best) => `<tr><td>${t}</td><td class="${best === 0 ? 'w' : ''}">${a}</td><td class="${best === 1 ? 'w' : ''}">${b}</td></tr>`;
    setTimeout(() => {
      if (g.state !== 'play') return;
      g.ui.panel(`<h2>🧾 برگه زمان درگ</h2>
        <div class="slip ${win ? 'win' : 'lose'}"><div class="sh">${win ? '🏆 بردی!' : '😞 باختی'}${rec ? ' • رکورد جدید! 🎉' : ''}</div>
        <table><tr><th></th><th>تو 🚕</th><th>${o.icon} ${o.name}</th></tr>
        ${row('⏱ زمان واکنش', fmt(S.react), fmt(R.react), S.react <= R.react ? 0 : 1)}
        ${row('۱۸ متر (۶۰ فوت)', fmt(S.t18), fmt(r18), S.t18 <= r18 ? 0 : 1)}
        ${row('۲۰۱ متر', `${fmt(S.t201)}<small>${fa(Math.round(S.v201))} km/h</small>`, `${fmt(r201)}<small>${fa(Math.round(rv201))} km/h</small>`, S.t201 <= r201 ? 0 : 1)}
        ${row('۴۰۲ متر', `<b>${fmt(S.et)}</b><small>${fa(Math.round(tr))} km/h</small>`, `<b>${fmt(rivalEt)}</b><small>${fa(Math.round(rtrap))} km/h</small>`, win ? 0 : 1)}
        </table>
        <div class="statrow"><span>🚀 استارت: ${this.launchText}</span><span>⚡ تعویض عالی: ${fa(this.perfect)} از ${fa(this.shifts)}</span><span>${win ? `💰 +${faMoney(pay)} و 🪙${fa(o.coins)}` : `💸 شرط رو باختی (${faMoney(o.bet)})`}</span></div></div>
        <div class="btnrow"><button data-a="again">🔁 دوباره</button><button data-a="ok" class="ghost">باشه</button></div>`, (el) => {
        el.querySelector('[data-a=ok]').onclick = () => g.ui.closePanel();
        el.querySelector('[data-a=again]').onclick = () => {
          g.ui.closePanel();
          const p = g.player;
          p.placeAt(this.spot.padX, this.spot.padZ, 0);
          this.offer();
        };
      });
    }, 1800);
    g.save();
  }
  update(dt) {
    const g = this.g, p = g.player, D = this.D;
    if (this.state === 'idle') return;
    if (g.state === 'jail' || g.police.state === 'chase' || g.police.state === 'arrest') return this.end(false, '🚨 مسابقه درگ لغو شد');
    if (g.onfoot.active || g.onfoot.busy) return this.end(false, 'از ماشین پیاده شدی؛ مسابقه لغو شد');
    if (p.burning || p.health <= 0) return this.end(false, 'ماشینت از کار افتاد! 💥');
    if (g.state !== 'play') return;
    g.rides.cooldown = Math.max(g.rides.cooldown, 5);
    this.t += dt;
    const inp = g.lastInput || { gas: 0 };
    const hud = $('dragHud');
    if (this.state === 'stage' || this.state === 'tree') {
      // staged: the car is held on the line, revs follow the throttle in neutral
      p.pos.set(this.lanes[0], 0, D.z0 - 2.4);
      p.heading = 0;
      p.speed = 0;
      p.ext.set(0, 0);
      if (p.gear !== 0) p.quickShift(0, 0);
      if (this.state === 'stage' && this.t > this.treeAt) {
        this.state = 'tree';
        this.t = 0;
      }
      if (this.state === 'tree') {
        const n = Math.floor(this.t / 0.5);
        this.lights({ stage: true, a1: n >= 0, a2: n >= 1, a3: n >= 2 });
        if (n !== this.beep && n < 3) {
          this.beep = n;
          g.audio.tone(880, 0.12, 0.12, 'square');
        }
        if (this.t >= 1.5) {
          this.state = 'run';
          this.t = 0;
          this.beep = -1;
          this.lights({ stage: true, go: true });
          g.audio.tone(1320, 0.4, 0.16, 'square');
        }
      }
    }
    if (this.state === 'run' || this.state === 'done') this.runUpdate(dt, inp);
    this.rivalUpdate(dt);
    // HUD
    const rpm = p.rpm, k = clamp(rpm / RPM_MAX, 0, 1);
    const zone = this.state === 'run' ? SHIFT : LAUNCH;
    const dist = clamp(p.pos.z - D.z0, 0, LEN);
    const stage = this.state === 'stage' ? '<span class="tr">🔵 آماده… دور موتور رو بالا ببر</span>' : this.state === 'tree' ? `<span class="tr">${[0, 1, 2].map((i) => `<i class="${this.t >= i * 0.5 ? 'am' : ''}"></i>`).join('')}<i></i></span>` : '';
    const html = `${stage}<div class="rpm"><em style="left:${(zone[0] / RPM_MAX) * 100}%;width:${((zone[1] - zone[0]) / RPM_MAX) * 100}%"></em><i style="width:${k * 100}%" class="${rpm > zone[1] ? 'hot' : rpm >= zone[0] ? 'ok' : ''}"></i></div>
      <div class="dr"><span>⚙️ ${p.gear > 0 ? fa(p.gear) : 'N'}</span><span>${fa(Math.round(Math.abs(p.speed) * 3.6))} km/h</span><span>📏 ${fa(Math.round(dist))} م</span><span>⏱ ${this.state === 'run' || this.state === 'done' ? fmt(this.t).slice(0, -1) : '—'}</span></div>`;
    if (html !== this.hudText) {
      $('dragInfo').innerHTML = this.hudText = html;
      hud.classList.toggle('canshift', this.state === 'run' && p.gear >= 1 && p.gear < TOP_GEAR && rpm >= SHIFT[0]);
    }
  }
  runUpdate(dt, inp) {
    const g = this.g, p = g.player, D = this.D, S = this.slip;
    if (!this.launched && this.state === 'run') {
      if (inp.gas > 0.3) {
        // launch: judged on the revs at the moment the clutch drops
        this.launched = true;
        S.react = this.t;
        const rpm = p.rpm;
        // sport tyres and electric torque forgive a bit more revs
        const hi = LAUNCH[1] + (p.hasPerf('tires') ? 500 : 0) + (p.spec.ev ? 700 : 0);
        p.quickShift(1, 0);
        if (rpm >= LAUNCH[0] && rpm <= hi) {
          p.speed = 2.2;
          this.launchText = 'عالی 🚀';
          this.feedback('🚀 استارت عالی!', 'perfect');
        } else if (rpm > hi) {
          this.spin = 0.9 + (rpm - hi) / 1500;
          this.launchText = 'بکسواد 💨';
          this.feedback('💨 بکسواد! دور موتور زیاد بود', 'late');
        } else {
          this.spin = 0.6;
          this.launchText = 'خوابید 😴';
          this.feedback('😴 ماشین خوابید! دور کم بود', 'early');
        }
      } else if (this.t > 6) return this.end(false, '⏱ چراغ سبز شد ولی حرکت نکردی!');
      else return;
    }
    // wheelspin / bog after a bad launch
    if (this.spin > 0) {
      this.spin -= dt;
      p.clutch = Math.max(p.clutch, 0.6);
      if (this.launchText.startsWith('بکسواد')) {
        const fx = g.fx.tyre;
        for (const sx of [-0.8, 0.8]) fx.emit(p.pos.x + sx, p.y + 0.25, p.pos.z - 1.6, (Math.random() - 0.5) * 2, 0.6 + Math.random(), -1 - Math.random() * 2, 1.5, 0.9, 4, 0.4);
        g.audio.setSkid && g.audio.setSkid(0.8);
      }
    }
    const d = p.pos.z - D.z0;
    if (this.state === 'run') {
      if (S.t18 === null && d >= 18.3) S.t18 = this.t;
      if (S.t201 === null && d >= 201) {
        S.t201 = this.t;
        S.v201 = Math.abs(p.speed) * 3.6;
      }
      // leaving your lane is a disqualification
      if (Math.abs(p.pos.x - this.lanes[0]) > 4.6) {
        if (p.pos.x > D.x) return this.dq('❌ از خط وسط رد شدی! مسابقه رو باختی');
        return this.dq('❌ از پیست بیرون رفتی! مسابقه رو باختی');
      }
      if (!this.warned && Math.abs(p.pos.x - this.lanes[0]) > 3) {
        this.warned = true;
        g.ui.toast('⚠️ صاف برو! نزدیک خط وسطی', 'warn');
      }
      if (d >= LEN) {
        // interpolate the crossing inside this frame
        const over = (d - LEN) / Math.max(0.1, Math.abs(p.speed));
        S.et = this.t - over;
        S.trap = Math.abs(p.speed) * 3.6;
        this.state = 'done';
        this.doneT = 0;
        this.finish();
      } else if (this.t > 45) return this.dq('⏱ خیلی طول کشید! مسابقه تموم شد');
    } else {
      this.doneT += dt;
      if (this.doneT > 6 || p.pos.z > D.z1 - 20) this.end(true);
    }
  }
  dq(msg) {
    const g = this.g;
    g.stats.dragRuns = (g.stats.dragRuns || 0) + 1;
    this.feedback('❌ خطا', 'late');
    this.end(false, msg);
  }
  rivalUpdate(dt) {
    const r = this.rival, R = this.rv, D = this.D, g = this.g;
    if (!r) return;
    let d = 0, v = 0;
    if (this.state === 'run' || this.state === 'done') {
      R.t += dt;
      const t = Math.max(0, R.t - R.react);
      d = this.model.d(t);
      v = this.model.v(t);
      if (d >= LEN) {
        // past the line it brakes
        if (R.fin === null) {
          R.fin = { t, d, v };
          if (this.slip.et === null && this.state === 'run') g.ui.toast(`${OPP[this.opp].icon} ${OPP[this.opp].name} زودتر رسید!`, 'warn');
        }
        const tb = t - R.fin.t;
        v = Math.max(0, R.fin.v - tb * 9);
        d = R.fin.d + (R.fin.v * R.fin.v - v * v) / 18;
      }
    }
    const z = D.z0 - 2.4 + d;
    r.root.position.set(this.lanes[1], g.world.heightAt(this.lanes[1], z), z);
    // squat on launch, wheels spinning
    r.root.rotation.x = -clamp(v > 0 && v < 25 ? 0.03 : 0, 0, 0.05);
    this.rSpin = (this.rSpin || 0) + (v / 0.33) * dt;
    for (const w of r.wheels) if (w.spin) w.spin.rotation.x = this.rSpin;
    if (this.state === 'stage' || this.state === 'tree') {
      // revving at the line
      r.root.rotation.z = Math.sin(this.t * 40) * 0.006;
    } else r.root.rotation.z = damp(r.root.rotation.z, 0, 8, dt);
  }
}
