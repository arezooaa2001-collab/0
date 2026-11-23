import * as THREE from 'three';
import { concatGeometries, clamp, faMoney, pick } from './util.js';

const PETS = {
  cat: { name: 'پشمک', icon: '🐈', price: 350000, fur: 0xf0a04b, belly: 0xfff1dc, nose: 0xff8fa3, desc: 'گربه نارنجی تنبل؛ روی صندلی جلو می‌خوابه و خرخر می‌کنه' },
  dog: { name: 'هاپو', icon: '🐕', price: 450000, fur: 0xc9a27a, belly: 0xf4e6d2, nose: 0x222222, desc: 'سگ باوفا؛ تند که بری سرش رو از پنجره بیرون میاره' },
  parrot: { name: 'کاکو', icon: '🦜', price: 600000, fur: 0x2fbf4f, belly: 0xb8e35a, nose: 0xf0c040, desc: 'طوطی حرّاف! حرف مسافرها رو تکرار می‌کنه و با رادیو می‌رقصه' },
};
function painted(geo, hex) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    a[i * 3] = c.r;
    a[i * 3 + 1] = c.g;
    a[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
const sph = (r, x, y, z, sx = 1, sy = 1, sz = 1, d = 10) => new THREE.SphereGeometry(r, d, Math.max(6, d - 3)).scale(sx, sy, sz).translate(x, y, z);

function emojiSprite(ch, size = 0.18) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const c = cv.getContext('2d');
  c.font = 'bold 44px sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(ch, 32, 34);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthWrite: false, transparent: true }));
  s.scale.setScalar(size);
  s.visible = false;
  return s;
}

const PARROT_LINES = ['سلام! سلام! 🦜', 'کاکو خوشگله! کاکو خوشگله!', 'بزن بریم! بزن بریم!', 'تاکسی! تاکسی! 🚕', 'کرایه یادت نره! 💰', 'دنده رو عوض کن! دنده!', 'قربونت برم! 😘', 'چراغ قرمزه! قرمزه! 🚦', 'گشنمه! تخمه می‌خوام! 🌻'];

/** A pet that rides in the front passenger seat: naps, looks around, leans in corners, reacts to
 *  the horn and loves being petted. The parrot talks. */
export class Pet {
  constructor(game) {
    this.g = game;
    this.models = {};
    this.t = 0;
    this.idle = 0;
    this.lean = { x: 0, z: 0, vx: 0, vz: 0 };
    this.talkT = 20;
    this.hearts = [];
    this.btn = document.getElementById('btnPet');
    if (this.btn) this.btn.addEventListener('click', () => this.pet());
  }
  get data() {
    const s = this.g.stats;
    if (!s.pets || typeof s.pets !== 'object') s.pets = { owned: [], active: null };
    if (!Array.isArray(s.pets.owned)) s.pets.owned = [];
    return s.pets;
  }
  model(kind) {
    if (this.models[kind]) return this.models[kind];
    const m = kind === 'parrot' ? this.parrotModel() : this.furModel(kind);
    // hearts when petted, a "z" bubble when asleep
    m.zz = emojiSprite('💤');
    m.zz.position.set(0.08, 0.5, 0.05);
    m.root.add(m.zz);
    m.root.traverse((o) => {
      if (o.isMesh) o.castShadow = false;
    });
    this.models[kind] = m;
    return m;
  }
  furModel(kind) {
    const P = PETS[kind], cat = kind === 'cat';
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
    const root = new THREE.Group();
    // sitting body: haunches, chest and front paws
    root.add(new THREE.Mesh(concatGeometries([
      painted(sph(0.13, 0, 0.11, -0.05, 1, 0.9, 1.25), P.fur),
      painted(sph(0.1, 0, 0.2, 0.06, 0.9, 1.15, 0.9), P.fur),
      painted(sph(0.075, 0, 0.17, 0.12, 0.8, 1.1, 0.6), P.belly),
      painted(new THREE.CylinderGeometry(0.025, 0.03, 0.16, 6).translate(-0.05, 0.08, 0.12), P.fur),
      painted(new THREE.CylinderGeometry(0.025, 0.03, 0.16, 6).translate(0.05, 0.08, 0.12), P.fur),
      painted(sph(0.032, -0.05, 0.01, 0.14, 1, 0.6, 1.3, 6), P.belly),
      painted(sph(0.032, 0.05, 0.01, 0.14, 1, 0.6, 1.3, 6), P.belly),
      // tabby stripes on the cat's back
      ...(cat ? [0, 1, 2].map((i) => painted(sph(0.02, 0, 0.2 - i * 0.05, -0.06 - i * 0.05, 5, 0.6, 1, 6), 0xc8742a)) : []),
    ]), mat));
    // head on its own pivot so it can look around and nod off
    const head = new THREE.Group();
    head.position.set(0, 0.33, 0.08);
    const ear = (sx) => cat
      ? painted(new THREE.ConeGeometry(0.035, 0.07, 4).translate(sx * 0.045, 0.085, 0), P.fur)
      : painted(sph(0.03, sx * 0.075, 0.02, -0.01, 0.5, 1.6, 1, 6).rotateZ(sx * 0.4), 0x8d6e4f);
    head.add(new THREE.Mesh(concatGeometries([
      painted(sph(0.08, 0, 0.03, 0, 1.05, 0.95, 1), P.fur),
      painted(sph(0.04, 0, 0.0, cat ? 0.065 : 0.08, cat ? 1.1 : 1, 0.75, cat ? 0.7 : 1.3), P.belly),
      painted(sph(0.012, 0, 0.015, cat ? 0.1 : 0.13, 1.3, 1, 1, 6), P.nose),
      painted(sph(0.016, -0.032, 0.05, 0.07, 1, 1.2, 0.6, 6), 0x1b1b1b),
      painted(sph(0.016, 0.032, 0.05, 0.07, 1, 1.2, 0.6, 6), 0x1b1b1b),
      painted(sph(0.005, -0.028, 0.057, 0.08, 1, 1, 1, 4), 0xffffff),
      painted(sph(0.005, 0.036, 0.057, 0.08, 1, 1, 1, 4), 0xffffff),
      ear(-1),
      ear(1),
      ...(cat ? [] : [painted(sph(0.02, 0, -0.04, 0.1, 1, 0.5, 1.2, 6), 0xe57373)]), // the dog's tongue
    ]), mat));
    root.add(head);
    const tail = new THREE.Group();
    tail.position.set(0, 0.06, -0.18);
    const tg = cat ? new THREE.CylinderGeometry(0.018, 0.026, 0.26, 6).rotateX(-1.1).translate(0, 0.08, -0.1) : new THREE.CylinderGeometry(0.02, 0.03, 0.16, 6).rotateX(-0.6).translate(0, 0.07, -0.05);
    tail.add(new THREE.Mesh(painted(tg, P.fur), mat));
    root.add(tail);
    return { root, head, tail };
  }
  parrotModel() {
    const P = PETS.parrot;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 });
    const root = new THREE.Group();
    // a little wooden perch on the seat
    root.add(new THREE.Mesh(concatGeometries([
      painted(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 6).rotateZ(Math.PI / 2).translate(0, 0.12, 0), 0x8d6e4f),
      painted(new THREE.CylinderGeometry(0.012, 0.016, 0.12, 6).translate(-0.1, 0.06, 0), 0x8d6e4f),
      painted(new THREE.CylinderGeometry(0.012, 0.016, 0.12, 6).translate(0.1, 0.06, 0), 0x8d6e4f),
      painted(new THREE.BoxGeometry(0.26, 0.015, 0.12).translate(0, 0.006, 0), 0x6d4c41),
    ]), mat));
    const body = new THREE.Group();
    body.position.set(0, 0.13, 0);
    root.add(body);
    body.add(new THREE.Mesh(concatGeometries([
      painted(sph(0.065, 0, 0.1, 0, 1, 1.45, 1, 12), P.fur),
      painted(sph(0.05, 0, 0.085, 0.03, 0.9, 1.3, 0.7, 10), P.belly),
      painted(new THREE.BoxGeometry(0.05, 0.2, 0.012).translate(0, -0.03, -0.06).rotateX(0.35), 0xd32f2f),
      painted(new THREE.BoxGeometry(0.034, 0.16, 0.014).translate(0, -0.05, -0.068).rotateX(0.35), 0x1e88e5),
      painted(new THREE.CylinderGeometry(0.006, 0.006, 0.04, 4).translate(-0.022, 0.0, 0.012), 0x555555),
      painted(new THREE.CylinderGeometry(0.006, 0.006, 0.04, 4).translate(0.022, 0.0, 0.012), 0x555555),
    ]), mat));
    const head = new THREE.Group();
    head.position.set(0, 0.2, 0.01);
    head.add(new THREE.Mesh(concatGeometries([
      painted(sph(0.052, 0, 0.03, 0, 1, 1, 1.05, 12), P.fur),
      painted(sph(0.03, -0.035, 0.035, 0.022, 0.6, 1, 1, 8), 0xffffff),
      painted(sph(0.03, 0.035, 0.035, 0.022, 0.6, 1, 1, 8), 0xffffff),
      painted(sph(0.011, -0.046, 0.038, 0.03, 1, 1, 1, 6), 0x111111),
      painted(sph(0.011, 0.046, 0.038, 0.03, 1, 1, 1, 6), 0x111111),
      // a hooked beak
      painted(sph(0.026, 0, 0.012, 0.05, 0.8, 1.1, 1.2, 8), P.nose),
      painted(new THREE.ConeGeometry(0.016, 0.04, 6).rotateX(Math.PI * 0.85).translate(0, -0.012, 0.072), 0x5d4a2a),
      painted(sph(0.024, 0, 0.07, -0.01, 0.6, 1, 1.3, 8), 0xffd54f), // yellow crown
    ]), mat));
    body.add(head);
    const wing = (sx) => {
      const pv = new THREE.Group();
      pv.position.set(sx * 0.058, 0.15, -0.005);
      pv.add(new THREE.Mesh(concatGeometries([
        painted(sph(0.03, sx * 0.012, -0.05, -0.01, 0.45, 1.9, 1, 8), 0x1f9c45),
        painted(sph(0.02, sx * 0.014, -0.11, -0.02, 0.45, 1.5, 0.9, 6), 0x1e88e5),
        painted(sph(0.018, sx * 0.012, -0.02, 0.0, 0.5, 1, 1, 6), 0xd32f2f),
      ]), mat));
      body.add(pv);
      return pv;
    };
    const wings = [wing(-1), wing(1)];
    return { root, head, tail: body, body, wings, parrot: true };
  }
  active() {
    const a = this.data.active;
    return a && PETS[a] && this.data.owned.includes(a) ? a : null;
  }
  /** a short meow, woof or squawk */
  voice(kind, happy) {
    const A = this.g.audio;
    if (kind === 'cat') {
      if (happy) {
        // purr
        for (let i = 0; i < 6; i++) A.tone(48 + (i % 2) * 6, 0.12, 0.09, 'sawtooth', i * 0.15);
        return;
      }
      A.tone(720, 0.12, 0.07, 'sine');
      A.tone(980, 0.22, 0.07, 'sine', 0.1);
      A.tone(760, 0.18, 0.06, 'sine', 0.3);
    } else if (kind === 'dog') {
      A.tone(210, 0.09, 0.12, 'square');
      A.tone(170, 0.12, 0.12, 'square', 0.16);
      if (happy) A.tone(240, 0.09, 0.1, 'square', 0.36);
    } else {
      // a two-note squawk, or a happy whistle
      if (happy) for (const [f, t] of [[1760, 0], [2093, 0.12], [2637, 0.24], [2093, 0.4]]) A.tone(f, 0.11, 0.06, 'sine', t);
      else {
        A.tone(1900, 0.08, 0.06, 'square');
        A.tone(2500, 0.12, 0.05, 'square', 0.09);
      }
    }
  }
  /** called when the horn sounds */
  honk() {
    const k = this.active();
    if (!k || this.g.onfoot.active) return;
    this.hop = 0.35;
    this.idle = 0;
    this.flap = 1.2;
    this.voice(k);
  }
  /** the 🐾 button: a pat on the head */
  pet() {
    const k = this.active(), g = this.g;
    if (!k || g.onfoot.active || g.state !== 'play') return;
    this.idle = 0;
    this.joy = 2.2;
    this.flap = k === 'parrot' ? 1.5 : 0;
    this.voice(k, true);
    const m = this.model(k);
    for (let i = 0; i < 3; i++) {
      const h = emojiSprite(pick(['❤️', '💖', '💕']), 0.12);
      h.visible = true;
      h.position.set((Math.random() - 0.5) * 0.15, 0.45, 0.05);
      m.root.add(h);
      this.hearts.push({ s: h, t: -i * 0.25 });
    }
    g.stats.petPats = (g.stats.petPats || 0) + 1;
    if (k === 'parrot' && Math.random() < 0.6) this.say(pick(['قربون دستت! 🦜💚', 'کاکو دوستت داره!', 'بازم! بازم!']));
  }
  /** the parrot speaks in the talk bubble */
  say(text) {
    const g = this.g;
    if (g.ui.talkT > 1.5) return false;
    g.ui.say(`${PETS.parrot.icon} ${PETS.parrot.name}`, text, { face: '🦜' });
    this.voice('parrot');
    this.talkT = 25 + Math.random() * 30;
    return true;
  }
  /** a passenger said something: the parrot may repeat it later */
  heard(text) {
    if (this.active() === 'parrot' && text && text.length < 70) this.lastHeard = text;
  }
  /** what a new passenger says about the pet: most love it, a few sneeze */
  greet(r) {
    const k = this.active();
    if (!k || !r || r.petSaid) return null;
    r.petSaid = true;
    const P = PETS[k], x = Math.random();
    const what = { cat: 'گربه', dog: 'سگ', parrot: 'طوطی' }[k];
    if (x < 0.15) {
      r.complaints++;
      return `اَچو! 🤧 من به ${what} حساسیت دارم...`;
    }
    if (x < 0.75) {
      r.petLove = true;
      return pick([`وای چه ${what} نازی! اسمش چیه؟ ${P.name}؟ 😍`, `${P.icon} سلام ${P.name} جون! چه بامزه‌ای!`, k === 'parrot' ? 'وای! این طوطی حرف هم می‌زنه؟! 😂' : 'آخی! منم یکی از اینا دارم 🥰']);
    }
    return null;
  }
  /** the parrot's chatter: reacts to what's going on, or repeats a passenger */
  chatter(dt) {
    const g = this.g, p = g.player;
    this.talkT -= dt;
    if (this.talkT > 0 || g.state !== 'play' || g.onfoot.active) return;
    let line;
    if (g.police.state !== 'none') line = 'پلیس! پلیس! فرار کن! 🚨';
    else if (g.railway && g.railway.closed && Math.hypot(p.pos.x - g.railway.R.x, p.pos.z - g.railway.cz) < 150) line = 'قطار! قطار! چوو چوو! 🚂';
    else if (Math.abs(p.speed) > 27) line = 'یواش‌تر! یواش‌تر! 😵';
    else if (this.lastHeard && Math.random() < 0.45) {
      line = `«${this.lastHeard}» 🦜 هاهاها!`;
      this.lastHeard = null;
    } else if (g.weather && g.weather.rain > 0.5) line = 'بارون! بارون! خیس شدم! 🌧️';
    else if (g.env && g.env.night > 0.7 && Math.random() < 0.4) line = 'شب بخیر... کاکو خوابش میاد 😴';
    else line = pick(PARROT_LINES);
    if (!this.say(line)) this.talkT = 5;
  }
  update(dt) {
    const g = this.g, p = g.player, k = this.active();
    for (const [kind, m] of Object.entries(this.models)) if (kind !== k && m.root.parent) m.root.removeFromParent();
    if (this.btn) this.btn.classList.toggle('hidden', !k || g.onfoot.active);
    if (!k) return;
    const m = this.model(k);
    // ride along on the front passenger seat of whatever car we drive
    if (m.root.parent !== p.group) p.group.add(m.root);
    const seat = p.car.seats && p.car.seats.front;
    if (!seat) return;
    m.root.position.set(seat.x, 0.47 + (p.car.rh ? p.car.rh - 0.3 : 0), seat.z + 0.02);
    if (g.state !== 'play') return;
    this.t += dt;
    const sp = Math.abs(p.speed);
    this.idle = sp < 0.5 && !g.onfoot.active ? this.idle + dt : 0;
    const night = g.env ? g.env.night : 0;
    const asleep = k === 'parrot' ? night > 0.8 && this.idle > 6 : this.idle > 18;
    // lean against braking/acceleration and corners (a little spring)
    const L = this.lean, h = Math.min(dt, 1 / 30);
    const lon = clamp(p.lastAccel || 0, -20, 20), lat = clamp(p.speed * (p.yawRate || 0), -20, 20);
    L.vx += (-40 * L.x - 6 * L.vx - lon * 0.25) * h;
    L.vz += (-40 * L.z - 6 * L.vz + lat * 0.25) * h;
    L.x = clamp(L.x + L.vx * h, -0.4, 0.4);
    L.z = clamp(L.z + L.vz * h, -0.4, 0.4);
    if (this.hop > 0) this.hop -= dt;
    if (this.joy > 0) this.joy -= dt;
    const hopY = this.hop > 0 ? Math.sin((this.hop / 0.35) * Math.PI) * 0.08 : 0;
    const air = p.air ? 0.05 : 0;
    const breathe = Math.sin(this.t * (asleep ? 1.6 : 3)) * 0.015;
    m.root.position.y += hopY + air;
    // the dog sticks its head out of the window at speed
    const outWin = k === 'dog' && sp > 13 && !asleep ? 1 : 0;
    this.win = (this.win || 0) + (outWin - (this.win || 0)) * Math.min(1, dt * 2);
    m.root.position.x += -this.win * 0.14;
    m.root.rotation.set(L.x, 0, L.z - this.win * 0.25);
    const S = k === 'parrot' ? 1.25 : 1.3;
    m.root.scale.set(S, S * (1 + breathe), S);
    // head: dozing, being petted, or watching the road / the driver
    if (asleep) m.head.rotation.set(0.55, 0.3, 0.15);
    else if (this.joy > 0) m.head.rotation.set(-0.25 + Math.sin(this.t * 9) * 0.08, Math.sin(this.t * 4) * 0.3, Math.sin(this.t * 6) * 0.2);
    else {
      let look = Math.sin(this.t * 0.4) > 0.75 ? 0.9 : Math.sin(this.t * 0.23) * 0.4 - p.steer * 0.8;
      if (this.win > 0.5) look = 1.2 + Math.sin(this.t * 2) * 0.15;
      m.head.rotation.set(Math.sin(this.t * 1.3) * 0.05 - (p.air ? 0.3 : 0), m.head.rotation.y + (look - m.head.rotation.y) * Math.min(1, dt * 3), 0);
    }
    if (k === 'parrot') {
      // bobbing to the radio, flapping when excited
      const radio = !!g.radio;
      if (radio && !asleep) m.body.rotation.x = Math.max(0, Math.sin(this.t * 7.5)) * 0.18;
      else m.body.rotation.x = asleep ? 0.25 : 0;
      this.flap = Math.max(0, (this.flap || 0) - dt);
      const fl = this.flap > 0 ? Math.abs(Math.sin(this.t * 26)) * 1.1 : 0;
      m.wings[0].rotation.z = -fl;
      m.wings[1].rotation.z = fl;
      this.chatter(dt);
    } else {
      const wag = k === 'dog' && (sp > 3 || this.joy > 0) ? 12 : 2.2;
      m.tail.rotation.y = Math.sin(this.t * wag) * (asleep ? 0.1 : this.joy > 0 ? 0.7 : 0.45);
    }
    m.zz.visible = asleep;
    if (asleep) m.zz.position.y = 0.5 + ((this.t * 0.25) % 0.15);
    // hearts float up and fade
    for (let i = this.hearts.length - 1; i >= 0; i--) {
      const H = this.hearts[i];
      H.t += dt;
      H.s.visible = H.t > 0;
      H.s.position.y = 0.42 + Math.max(0, H.t) * 0.25;
      H.s.material.opacity = clamp(1.4 - H.t, 0, 1);
      if (H.t > 1.4) {
        H.s.removeFromParent();
        H.s.material.map.dispose();
        H.s.material.dispose();
        this.hearts.splice(i, 1);
      }
    }
    // a hard stop gets a complaint
    if (lon < -14 && !this.ouchT) {
      this.ouchT = 2;
      this.voice(k);
      if (k === 'parrot') this.say(pick(['آخ! یواش! 😵', 'ترمز نگیر! ترمز نگیر!']));
    }
    if (this.ouchT) this.ouchT = Math.max(0, this.ouchT - dt);
  }
  /* ---------------- shop (garage) ---------------- */
  shopHtml() {
    const D = this.data;
    return `<div class="card pets"><h3>🐾 حیوون خونگی</h3><p>همیشه کنارت روی صندلی جلو می‌شینه؛ با دکمه 🐾 نازش کن! بیشتر مسافرها عاشقشن (انعام بیشتر)، ولی بعضیا حساسیت دارن.</p>
      <div class="petrow">${Object.entries(PETS).map(([id, P]) => {
        const own = D.owned.includes(id), on = D.active === id;
        return `<div class="${on ? 'cur' : ''}"><b>${P.icon} ${P.name}</b><small>${P.desc}</small><button data-pet="${id}">${on ? '✓ همراهته' : own ? 'بیارش' : 'خرید • ' + faMoney(P.price)}</button></div>`;
      }).join('')}</div>
      ${D.active ? '<button data-pet="none" class="ghost">بذارش خونه</button>' : ''}</div>`;
  }
  bindShop(el, buy, done) {
    const D = this.data;
    el.querySelectorAll('[data-pet]').forEach((b) => (b.onclick = () => {
      const id = b.dataset.pet;
      if (id === 'none') {
        D.active = null;
        return done('🏠 حیوونت رو گذاشتی خونه');
      }
      const P = PETS[id];
      if (!D.owned.includes(id)) {
        if (!buy(P.price)) return;
        D.owned.push(id);
      }
      D.active = id;
      this.voice(id);
      done(`${P.icon} ${P.name} سوار ماشین شد!`);
    }));
  }
  static get list() {
    return PETS;
  }
}
