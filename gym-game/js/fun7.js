'use strict';
/*
 * Round thirteen: a bowling lane, an archery range and a zipline in the south of the ninja hall,
 * a tornado power, a penguin pet, air guitar and the chicken dance, and medals for all of it.
 */

POWERS.push({ id: 'tornado', name: 'گردباد', icon: '🌪️', level: 260, cd: 40, xp: 70, key: '-' });
for (const p of POWERS) POWER_BY_ID[p.id] = p;

SHOP.push({ id: 'penguin', cat: 'pet', name: 'پنگوئن', icon: '🐧', price: 700, once: true, desc: 'تلوتلوخوران دنبالت میاد و وقتی می‌دوی روی شکمش سُر می‌خوره' });
for (const it of SHOP) SHOP_BY_ID[it.id] = it;

const EMOTES7 = [['e_guitar', 'گیتار هوایی', '🎸'], ['e_chicken', 'رقص جوجه', '🐔']]
  .map(([id, name, icon]) => ({ id, name, icon, level: 1, cat: 'fun', emote: true }));
MOVES.push(...EMOTES7);
for (const e of EMOTES7) MOVE_BY_ID[e.id] = e;
if (typeof DANCE_POOL !== 'undefined') DANCE_POOL.push('e_guitar', 'e_chicken');

Object.assign(ANIMS, {
  e_guitar: {
    dur: 2.8,
    events: [[0.72, 'whoosh']],
    fn(p, t) {
      const k = smooth(seg(t, 0, 0.1)) * (1 - smooth(seg(t, 0.9, 1)));
      const strum = Math.sin(t * TAU * 9);
      const bang = Math.max(0, Math.sin(t * TAU * 4.5));
      // the big finish: lean back and lift the neck of the guitar
      const solo = smooth(seg(t, 0.68, 0.76)) * (1 - smooth(seg(t, 0.86, 0.92)));
      const q = makePose();
      q.shLX = lerp(-1.05, -1.9, solo); q.shLZ = lerp(0.8, 0.5, solo); q.elL = -0.35;
      q.shRX = -0.45 + 0.28 * strum; q.shRZ = -0.25; q.elR = -1.55 - 0.35 * strum;
      q.spY = 0.35;
      q.spX = lerp(0.15 + 0.15 * bang, -0.35, solo);
      q.nkX = lerp(0.4 * bang, -0.3, solo);
      q.hpLX = -0.3; q.knL = 0.5; q.knR = 0.3 + 0.25 * solo;
      q.y = -0.06 - 0.05 * bang - 0.12 * solo;
      mixInto(p, q, k);
    },
  },
  e_chicken: {
    dur: 3.6,
    fn(p, t) {
      const k = smooth(seg(t, 0, 0.06)) * (1 - smooth(seg(t, 0.94, 1)));
      const ph = Math.min(3, Math.floor(t * 4));
      const f = Math.sin(t * TAU * 16);
      const q = makePose();
      if (ph === 0) {
        // beaks: hands out in front, snapping
        q.shLX = q.shRX = -1.4; q.elL = q.elR = -0.5 - 0.3 * Math.max(0, f);
        q.nkX = 0.15 * f;
      } else if (ph === 1) {
        // wings: flap the elbows
        q.shLX = q.shRX = -0.3; q.elL = q.elR = -2.4;
        q.shLZ = 0.5 + 0.55 * Math.max(0, f); q.shRZ = -q.shLZ;
      } else if (ph === 2) {
        // tail feathers: squat down and wiggle
        q.knL = q.knR = 1.0; q.hpLX = q.hpRX = -0.8; q.spX = 0.45; q.y = -0.28;
        q.shLX = q.shRX = 0.35; q.elL = q.elR = -1.2;
        q.spZ = 0.25 * f; q.bz = 0.06 * f;
      } else {
        // clap four times
        q.shLX = q.shRX = -1.45; q.elL = q.elR = -0.25;
        q.shLZ = 0.15 + 0.5 * Math.max(0, Math.sin(t * TAU * 8)); q.shRZ = -q.shLZ;
        q.y = 0.05 * Math.abs(f);
      }
      mixInto(p, q, k);
    },
  },
  bowlroll: {
    dur: 1.5,
    events: [[0.55, 'whoosh']],
    fn(p, t) {
      const k = smooth(seg(t, 0, 0.08)) * (1 - smooth(seg(t, 0.85, 1)));
      const back = smooth(seg(t, 0.05, 0.4));
      const go = smooth(seg(t, 0.4, 0.58));
      const q = makePose();
      // swing the ball back, step and slide, then follow through
      q.shRX = lerp(lerp(0.05, 1.15, back), -1.9, go); q.elR = -0.1; q.shRZ = -0.08;
      q.shLZ = 0.9 * go + 0.3; q.shLX = -0.4; q.elL = -0.3;
      q.hpLX = -0.9 * go; q.knL = 1.2 * go; q.hpRX = 0.55 * go; q.knR = 0.25 * go;
      q.spX = 0.2 + 0.4 * go; q.y = -0.28 * go;
      q.nkX = -0.2 * go;
      mixInto(p, q, k);
    },
  },
});

ACHIEVEMENTS.push(
  { id: 'strike', name: 'استرایک!', icon: '🎳', desc: 'توی بولینگ همه‌ی ۱۰ تا پین رو با یه توپ بنداز', test: (s) => (s.stats.strikes || 0) >= 1 },
  { id: 'bowl100', name: 'سلطان بولینگ', icon: '👑', desc: 'توی یه بازی بولینگ ۱۰۰ امتیاز بگیر', test: (s) => (s.stats.bowlBest || 0) >= 100 },
  { id: 'robin', name: 'رابین هود', icon: '🏹', desc: 'یه تیر بزن وسط خال (۱۰ امتیاز)', test: (s) => (s.stats.arrowTens || 0) >= 1 },
  { id: 'archer40', name: 'کماندار ماهر', icon: '🎯', desc: 'با ۵ تیر ۴۰ امتیاز بگیر', test: (s) => (s.stats.archeryBest || 0) >= 40 },
  { id: 'zipline', name: 'پرواز روی سیم', icon: '🚡', desc: 'با زیپ‌لاین از این سر سالن برو اون سر', test: (s) => (s.stats.zipRides || 0) >= 1 },
  { id: 'balloons', name: 'بادکنک‌ترکون', icon: '🎈', desc: 'توی یه سواری زیپ‌لاین هر ۵ تا بادکنک رو بترکون', test: (s) => (s.stats.zipAll || 0) >= 1 },
  { id: 'tornado', name: 'طوفان‌ساز', icon: '🌪️', desc: 'با گردباد ۵ نفر رو یه‌جا بچرخون', test: (s) => (s.stats.tornadoBest || 0) >= 5 },
  { id: 'penguin', name: 'رفیق قطبی', icon: '🐧', desc: 'پنگوئن رو با خودت ببر', test: (s) => s.shop && s.shop.pet === 'penguin' },
);

/* the south side of the ninja hall */
const LANE = { z: 28.4, x0: 84, pinX: 100.6, half: 0.6, gutter: 0.86, end: 102.4 };
const RANGE = { x: 104, z: 23, tx: 127.2, ty: 1.5, r: 0.6 };
const ZIP = { x0: 80.8, y0: 7.4, x1: 124.2, y1: 2.75, z: 15, towerX: 79.6, top: 6.3 };
const PIN_ROWS = (() => {
  const out = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j <= i; j++) out.push([i * 0.264, (j - i / 2) * 0.305]);
  return out;
})();
const NO_GRAB = ['knocked', 'class', 'race', 'boss', 'buddy', 'leave', 'dodge', 'frozen', 'dcoach', 'twister', 'flung'];
GYM_SPOTS.push(['🎳', 'بولینگ، کمان و زیپ‌لاین', 92, 22]);

function zipY(x) { return ZIP.y0 + (ZIP.y1 - ZIP.y0) * clamp((x - ZIP.x0) / (ZIP.x1 - ZIP.x0), 0, 1); }

/** 10 frames is long on a phone: a game here has five. */
function bowlScores(frames) {
  const rolls = [];
  frames.forEach((f) => rolls.push(...f));
  const out = [];
  let i = 0, total = 0;
  for (let f = 0; f < frames.length; f++) {
    const fr = frames[f];
    const last = f === 4;
    if (last) {
      const done = fr.length === 3 || (fr.length === 2 && fr[0] + fr[1] < 10);
      if (!done) { out.push(null); break; }
      total += fr.reduce((a, b) => a + b, 0);
      out.push(total);
      break;
    }
    if (fr[0] === 10) {
      if (rolls.length < i + 3) { out.push(null); i += 1; continue; }
      total += 10 + rolls[i + 1] + rolls[i + 2];
      i += 1;
    } else if (fr.length < 2) {
      out.push(null);
      break;
    } else if (fr[0] + fr[1] === 10) {
      if (rolls.length < i + 3) { out.push(null); i += 2; continue; }
      total += 10 + rolls[i + 2];
      i += 2;
    } else {
      total += fr[0] + fr[1];
      i += 2;
    }
    out.push(total);
  }
  return out;
}

function bowlMarks(fr, last) {
  const m = [];
  for (let r = 0; r < fr.length; r++) {
    const v = fr[r];
    const prev = r > 0 ? fr[r - 1] : null;
    const fresh = r === 0 || (last && (prev === 10 || (r === 2 && fr[0] + fr[1] === 10 && fr[0] !== 10)));
    if (v === 10 && fresh) m.push('X');
    else if (!fresh && prev + v === 10) m.push('/');
    else m.push(v === 0 ? '-' : fa(v));
  }
  return m;
}

class PenguinPet {
  constructor() {
    this.kind = 'penguin';
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    const b = new Batch();
    b.sphere(0.22, 0, 0.32, 0, '#1d2230');
    b.sphere(0.17, 0, 0.3, 0.08, '#f4f6fb');
    b.sphere(0.14, 0, 0.6, 0.01, '#1d2230');
    b.sphere(0.09, 0, 0.58, 0.06, '#f4f6fb');
    b.add(UnitGeo.cone(8), 0, 0.58, 0.17, '#ff9f1c', Math.PI / 2, 0, 0, 0.035, 0.09, 0.035);
    b.sphere(0.022, 0.05, 0.64, 0.12, '#111111');
    b.sphere(0.022, -0.05, 0.64, 0.12, '#111111');
    const m = new THREE.Mesh(mergeParts(b.parts, false), MATTE_MAT);
    m.scale.set(1, 1.15, 0.9);
    this.body.add(m);
    this.flips = [];
    for (const s of [-1, 1]) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.1).translate(0, -0.11, 0), new THREE.MeshStandardMaterial({ color: '#1d2230', roughness: 0.7 }));
      f.position.set(s * 0.21, 0.46, 0);
      this.body.add(f);
      this.flips.push(f);
    }
    this.feet = [];
    for (const s of [-1, 1]) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.025, 0.13), new THREE.MeshStandardMaterial({ color: '#ff9f1c', roughness: 0.6 }));
      f.position.set(s * 0.08, 0.012, 0.05);
      this.root.add(f);
      this.feet.push(f);
    }
    const shadow = new THREE.Mesh(SHADOW_GEO, SHADOW_MAT);
    shadow.scale.set(0.5, 1, 0.5);
    shadow.position.y = 0.015;
    this.root.add(shadow);
    this.root.traverse((o) => { o.userData.noSolid = true; });
    this.phase = 0;
    this.slide = 0;
  }

  place(p) { this.root.position.set(p.x + 1, 0, p.z + 1); }

  update(dt, player, time) {
    const pp = player.ch.root.position;
    const yaw = player.ch.root.rotation.y;
    const tx = pp.x - Math.sin(yaw) * 1.1 - Math.cos(yaw) * 0.8;
    const tz = pp.z - Math.cos(yaw) * 1.1 + Math.sin(yaw) * 0.8;
    const pos = this.root.position;
    const dx = tx - pos.x, dz = tz - pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 25) { pos.set(tx, 0, tz); return; }
    // running far behind: down on the belly and slide
    const fast = player.vel.length() > 5.5 || d > 4;
    this.slide += ((fast ? 1 : 0) - this.slide) * damp(fast ? 6 : 3, dt);
    const speed = d > 0.3 ? Math.min(fast ? 11 : 3.2, d * (fast ? 3.5 : 2)) : 0;
    if (speed > 0) {
      pos.x += (dx / d) * speed * dt;
      pos.z += (dz / d) * speed * dt;
      this.root.rotation.y = angleLerp(this.root.rotation.y, Math.atan2(dx, dz), damp(8, dt));
      this.phase += dt * (8 + speed * 2);
    } else {
      this.root.rotation.y = angleLerp(this.root.rotation.y, Math.atan2(pp.x - pos.x, pp.z - pos.z), damp(4, dt));
    }
    const s = this.slide;
    const waddle = speed > 0 ? Math.sin(this.phase) : 0;
    this.body.rotation.z = waddle * 0.22 * (1 - s);
    this.body.rotation.x = 1.35 * s;
    this.body.position.y = s * 0.12 + (1 - s) * Math.abs(waddle) * 0.03;
    this.body.position.z = -0.25 * s;
    const flap = player.ch.busy ? Math.abs(Math.sin(time * 10)) * 0.9 : 0.15 + 0.1 * Math.abs(waddle);
    this.flips[0].rotation.z = -flap - s * 0.8;
    this.flips[1].rotation.z = flap + s * 0.8;
    this.feet[0].position.z = 0.05 + 0.05 * waddle * (1 - s);
    this.feet[1].position.z = 0.05 - 0.05 * waddle * (1 - s);
    for (const f of this.feet) f.visible = s < 0.5;
  }
}

Object.assign(Game, {
  /** Something of this round is running and owns the player. */
  miniBusy() { return !!(this.bowl || this.archery || this.zip); },

  /* ---------- building the corner: lane, range, zipline ---------- */

  buildSouth(g) {
    g.south = true;
    const add = (m, solid) => { if (!solid) m.userData.noSolid = true; g.scene.add(m); return m; };
    const steel = new THREE.MeshStandardMaterial({ color: '#2c3140', roughness: 0.5, metalness: 0.6 });
    const dark = new THREE.MeshStandardMaterial({ color: '#1a1d26', roughness: 0.8 });

    /* the bowling lane */
    const L = LANE;
    const len = L.end - L.x0 + 3;
    const lane = new THREE.Mesh(new THREE.PlaneGeometry(len, L.half * 2), new THREE.MeshStandardMaterial({
      map: makeCanvasTexture(1024, 64, (ctx, w, h) => {
        ctx.fillStyle = '#e0b77a'; ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 16; i++) { ctx.fillStyle = `rgba(120,70,20,${rand(0.05, 0.14)})`; ctx.fillRect(0, i * (h / 16), w, 1); }
        const s = w / len;
        // the approach, the foul line, the dots and the arrows
        ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(0, 0, 3 * s, h);
        ctx.fillStyle = '#c0392b'; ctx.fillRect(3 * s - 3, 0, 5, h);
        ctx.fillStyle = '#5a3412';
        for (let j = 1; j < 6; j++) ctx.fillRect(3.8 * s, (j * h) / 6 - 1.5, 4, 3);
        for (let j = 1; j < 6; j++) {
          const x = (7.6 + Math.abs(j - 3) * 0.45) * s, y = (j * h) / 6;
          ctx.beginPath(); ctx.moveTo(x + 10, y); ctx.lineTo(x, y - 4); ctx.lineTo(x, y + 4); ctx.fill();
        }
      }),
      roughness: 0.25, metalness: 0.05,
    }));
    lane.rotation.x = -Math.PI / 2;
    lane.position.set(L.x0 - 3 + len / 2, 0.012, L.z);
    add(lane);
    for (const s of [-1, 1]) {
      const gut = add(new THREE.Mesh(new THREE.BoxGeometry(L.end - L.x0, 0.01, L.gutter - L.half), dark));
      gut.position.set((L.x0 + L.end) / 2, 0.006, L.z + s * (L.half + L.gutter) / 2);
      const rail = add(new THREE.Mesh(new THREE.BoxGeometry(L.end - L.x0 + 1.2, 0.12, 0.08), steel));
      rail.position.set((L.x0 + L.end) / 2 + 0.6, 0.06, L.z + s * (L.gutter + 0.04));
    }
    // the pit and the back curtain
    add(new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.02, L.gutter * 2), dark)).position.set(L.end + 0.55, 0.01, L.z);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.5, L.gutter * 2 + 0.3), new THREE.MeshStandardMaterial({ color: '#2b2f45', roughness: 0.9 })), true).position.set(L.end + 1.2, 0.75, L.z);
    const hood = add(new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, L.gutter * 2 + 0.3), new THREE.MeshStandardMaterial({
      map: signTexture([{ text: '🎳 بولینگ', size: 90, display: true, color: '#ffd34d' }], { w: 512, h: 128, border: '#ffd34d', bg1: '#10142a', bg2: '#1b1f3d' }),
      toneMapped: false,
    })));
    hood.position.set(L.end, 1.9, L.z);
    for (const s of [-1, 1]) add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.15, 0.1), steel), true).position.set(L.end, 1.07, L.z + s * (L.gutter + 0.2));
    this.hangSign(g, 'بولینگ 🎳', '#ffd34d', 91, 6.2, L.z + 1.2, 4.4);
    // the pins and the ball
    const pinGeo = new THREE.LatheGeometry([[0, 0], [0.03, 0], [0.045, 0.05], [0.06, 0.12], [0.055, 0.18], [0.035, 0.25], [0.028, 0.28], [0.035, 0.33], [0.03, 0.37], [0, 0.385]].map(([r, y]) => new THREE.Vector2(r, y)), 14);
    const pinMat = new THREE.MeshStandardMaterial({
      map: makeCanvasTexture(8, 64, (ctx, w, h) => {
        ctx.fillStyle = '#fbfbfd'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#e63946'; ctx.fillRect(0, 21, w, 3); ctx.fillRect(0, 26, w, 3);
      }),
      roughness: 0.25,
    });
    g.pins = PIN_ROWS.map(([dx, dz]) => {
      const m = add(new THREE.Mesh(pinGeo, pinMat));
      const P = { m, hx: L.pinX + dx, hz: L.z + dz, x: 0, z: 0, vx: 0, vz: 0, tilt: 0, dir: 0, hit: false, gone: false, counted: false };
      this.rackPin(P);
      return P;
    });
    const ball = add(new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 14), new THREE.MeshStandardMaterial({
      map: makeCanvasTexture(128, 64, (ctx, w, h) => {
        const gr = ctx.createLinearGradient(0, 0, w, h);
        gr.addColorStop(0, '#6c2bd9'); gr.addColorStop(0.5, '#c77dff'); gr.addColorStop(1, '#3a0ca3');
        ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#10142a';
        for (const [x, y] of [[60, 24], [70, 24], [65, 38]]) { ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU); ctx.fill(); }
      }),
      roughness: 0.15, metalness: 0.2,
    })));
    ball.position.set(L.x0 - 1.6, 0.11, L.z + L.gutter + 0.45);
    g.bowlBall = ball;
    g.ballHome = ball.position.clone();

    /* the archery range */
    const R = RANGE;
    const line = add(new THREE.Mesh(new THREE.PlaneGeometry(0.1, 7), new THREE.MeshBasicMaterial({ color: '#ffffff' })));
    line.rotation.x = -Math.PI / 2;
    line.position.set(R.x + 0.35, 0.013, R.z);
    const mat = add(new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshStandardMaterial({ color: '#2e7d4f', roughness: 0.9 })));
    mat.rotation.x = -Math.PI / 2;
    mat.position.set(R.x - 0.3, 0.012, R.z);
    const face = makeCanvasTexture(256, 256, (ctx, w, h) => {
      const cols = ['#ffffff', '#ffffff', '#222222', '#222222', '#2f6fed', '#2f6fed', '#e63946', '#e63946', '#ffd34d', '#ffd34d'];
      for (let i = 0; i < 10; i++) {
        ctx.fillStyle = cols[i];
        ctx.beginPath(); ctx.arc(w / 2, h / 2, (w / 2) * (1 - i / 10), 0, TAU); ctx.fill();
        ctx.strokeStyle = i === 2 || i === 3 ? '#ffffff' : '#222222'; ctx.lineWidth = 1; ctx.stroke();
      }
      ctx.strokeStyle = '#222222'; ctx.beginPath(); ctx.moveTo(w / 2 - 4, h / 2); ctx.lineTo(w / 2 + 4, h / 2); ctx.moveTo(w / 2, h / 2 - 4); ctx.lineTo(w / 2, h / 2 + 4); ctx.stroke();
    });
    const straw = new THREE.MeshStandardMaterial({ color: '#d9b45a', roughness: 0.95 });
    const target = new THREE.Mesh(new THREE.CylinderGeometry(R.r, R.r, 0.16, 36), [straw, new THREE.MeshStandardMaterial({ map: face, roughness: 0.8 }), straw]);
    target.rotation.z = Math.PI / 2; // the face looks down the range (-x)
    target.position.set(R.tx + 0.08, R.ty, R.z);
    add(target);
    for (const s of [-1, 1]) {
      const leg = add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.2, 0.08), new THREE.MeshStandardMaterial({ color: '#8a5a2b', roughness: 0.8 })), true);
      leg.position.set(R.tx + 0.35, 1.0, R.z + s * 0.45);
      leg.rotation.x = -s * 0.12;
    }
    add(new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.4, 8.5), new THREE.MeshStandardMaterial({ color: '#1f3d2b', roughness: 0.95 })), true).position.set(R.tx + 1.6, 1.7, R.z);
    this.hangSign(g, 'تیراندازی 🏹', '#7bed9f', 115.5, 6.2, R.z - 3.6, 4.4);

    /* the zipline: a tower, a cable, a landing pad */
    const Z = ZIP;
    for (const [dx, dz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) {
      add(new THREE.Mesh(new THREE.BoxGeometry(0.14, Z.top, 0.14), steel), true).position.set(Z.towerX + dx, Z.top / 2, Z.z + dz);
    }
    add(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 1.5), new THREE.MeshStandardMaterial({ color: '#ffd34d', roughness: 0.6 }))).position.set(Z.towerX, Z.top, Z.z);
    for (const [dx, dz, w, d] of [[0, -0.72, 1.5, 0.05], [0, 0.72, 1.5, 0.05], [-0.72, 0, 0.05, 1.5]]) {
      add(new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), steel)).position.set(Z.towerX + dx, Z.top + 0.9, Z.z + dz);
    }
    // the ladder up the east face
    for (const s of [-1, 1]) add(new THREE.Mesh(new THREE.BoxGeometry(0.05, Z.top + 0.9, 0.05), steel)).position.set(Z.towerX + 0.7, (Z.top + 0.9) / 2, Z.z + s * 0.25);
    for (let y = 0.35; y < Z.top; y += 0.35) add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.5), steel)).position.set(Z.towerX + 0.7, y, Z.z);
    // the cable from a mast on the tower to a post over the pad
    add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.6, 0.12), steel)).position.set(Z.towerX + 0.6, Z.top + 0.8, Z.z);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, Z.y1 + 0.5, 10), steel), true).position.set(Z.x1 + 0.9, (Z.y1 + 0.5) / 2, Z.z);
    const a = new THREE.Vector3(Z.x0 - 0.2, Z.y0 + 0.02, Z.z), b = new THREE.Vector3(Z.x1 + 0.9, Z.y1 - 0.06, Z.z);
    const cable = add(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, a.distanceTo(b), 6), new THREE.MeshStandardMaterial({ color: '#cfd6e3', metalness: 0.8, roughness: 0.3 })));
    cable.position.copy(a).add(b).multiplyScalar(0.5);
    cable.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    const pad = add(new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.08, 3), new THREE.MeshStandardMaterial({ color: '#2f6fed', roughness: 0.85 })));
    pad.position.set(Z.x1 - 0.6, 0.04, Z.z);
    // the trolley that waits at the top
    const tr = new THREE.Group();
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 12), new THREE.MeshStandardMaterial({ color: '#e63946', metalness: 0.5, roughness: 0.4 }));
    wheel.rotation.x = Math.PI / 2;
    tr.add(wheel);
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.3, 0.03), steel);
    strap.position.y = -0.17;
    tr.add(strap);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.5, 8), new THREE.MeshStandardMaterial({ color: '#ffd34d', metalness: 0.4, roughness: 0.4 }));
    bar.rotation.x = Math.PI / 2;
    bar.position.y = -0.32;
    tr.add(bar);
    tr.traverse((o) => { o.userData.noSolid = true; });
    g.scene.add(tr);
    g.trolley = tr;
    this.parkTrolley(g);
    this.hangSign(g, 'زیپ‌لاین 🚡', '#7fe0ff', 101, 8.9, Z.z - 2.2, 4.4);
    g.solids = null;
  },

  parkTrolley(g) {
    g.trolley.position.set(ZIP.x0, ZIP.y0 - 0.02, ZIP.z);
  },

  rackPin(P) {
    P.x = P.hx; P.z = P.hz; P.vx = P.vz = 0; P.tilt = 0; P.hit = false; P.gone = false; P.counted = false; P.spin = 0;
    P.m.visible = true;
    P.m.position.set(P.x, 0.012, P.z);
    P.m.rotation.set(0, 0, 0);
  },

  nearLane() {
    const p = this.player.ch.root.position;
    return p.x > LANE.x0 - 4 && p.x < LANE.x0 + 1 && Math.abs(p.z - LANE.z) < 2.2;
  },
  nearRange() {
    const p = this.player.ch.root.position;
    return Math.abs(p.x - RANGE.x) < 2.2 && Math.abs(p.z - RANGE.z) < 3.6;
  },
  nearZip() {
    const p = this.player.ch.root.position;
    return Math.hypot(p.x - (ZIP.towerX + 1.2), p.z - ZIP.z) < 1.9;
  },

  southFree() {
    return this.arcadeFree() && !this.miniBusy() && this.gym && this.gym.south;
  },

  southAction() {
    if (this.aim) return { label: '🎯 الان!', run: () => this.lockAim() };
    if (this.zip) {
      if (this.zip.phase === 'ride') return { label: '🪂 ول کن!', run: () => this.dropZip() };
      return null;
    }
    if (this.bowl || this.archery) return null;
    if (this.world !== this.gym || !this.southFree()) return null;
    if (this.nearZip()) return { label: '🚡 سوار زیپ‌لاین شو', run: () => this.startZip() };
    if (this.nearLane()) return { label: '🎳 بازی بولینگ', run: () => this.startBowl() };
    if (this.nearRange()) return { label: '🏹 تیراندازی با کمان', run: () => this.startArchery() };
    return null;
  },

  /* ---------- the game panel and its meter ---------- */

  showGame(head, info) {
    $('gameHead').textContent = head;
    $('gameInfo').textContent = info || '';
    $('gamePanel').hidden = false;
  },

  hideGame() {
    $('gamePanel').hidden = true;
    $('gameBar').hidden = true;
    this.aim = null;
  },

  startAim(kind, speed, best) {
    this.aim = { kind, t: rand(0, 0.6), speed, best, v: 0 };
    const B = (best - 0.06) * 100, O = (best - 0.175) * 100;
    $('gameBest').style.left = `${B.toFixed(1)}%`;
    $('gameOk').style.left = `${O.toFixed(1)}%`;
    $('gameBar').style.background = `linear-gradient(90deg, #e63946 0%, #ff7b00 ${Math.max(1, (best - 0.28) * 100)}%, #ffd34d ${Math.max(2, (best - 0.12) * 100)}%, #2ecc71 ${best * 100}%, #ffd34d ${Math.min(98, (best + 0.12) * 100)}%, #ff7b00 ${Math.min(99, (best + 0.28) * 100)}%, #e63946 100%)`;
    $('gameBar').hidden = false;
    this.tickAim(0);
  },

  tickAim(dt) {
    const A = this.aim;
    if (!A) return;
    if (this.modals.size || this.watch || this.photo) return;
    A.t += dt;
    A.v = meterValue(A.t, A.speed);
    $('gameNeedle').style.left = `${(A.v * 100).toFixed(1)}%`;
  },

  lockAim() {
    const A = this.aim;
    if (!A || this.modals.size) return;
    this.aim = null;
    $('gameBar').hidden = true;
    const e = Math.abs(A.v - A.best);
    this.floatText(e < 0.06 ? '🎯 عالی!' : e < 0.175 ? '👍 خوب' : '😬 اوه!', e < 0.06 ? 'fl-combo' : '');
    Sfx.play('tap');
    if (A.kind === 'bowl') this.rollBowl(A.v);
    else if (A.kind === 'arrowX') this.aimArrowY(A.v);
    else if (A.kind === 'arrowY') this.shootArrow(A.v);
  },

  /** Hold the camera on something other than the player for a moment. */
  follow(p, dist, yaw, pitch) {
    const c = this.gym.cam;
    if (!this.camSave) this.camSave = { dist: c.dist, yaw: c.yaw, pitch: c.pitch };
    this.camFollow = p;
    if (dist != null) c.dist = dist;
    if (yaw != null) c.yaw = yaw;
    if (pitch != null) c.pitch = pitch;
  },

  unfollow(restore) {
    this.camFollow = null;
    if (restore && this.camSave && this.gym) Object.assign(this.gym.cam, this.camSave);
    if (restore) this.camSave = null;
  },

  /* ---------- bowling ---------- */

  startBowl() {
    if (!this.southFree() || !this.nearLane()) return;
    if (this.loop) this.stopLoop(true);
    const P = this.player;
    if (P.board) this.endBoard();
    if (P.jet) this.endJet();
    const g = this.gym;
    for (const pin of g.pins) this.rackPin(pin);
    this.bowl = { frames: [[]], phase: 'aim', t: 0, ball: null, before: 10 };
    g.bowlBall.visible = false;
    Sfx.play('click');
    this.follow(null, 5.2, -Math.PI / 2, 0.2);
    this.camFollow = null;
    this.drawBowl();
    this.nextBowl();
  },

  /** Stand on the approach with the ball and wait for the meter. */
  nextBowl() {
    const B = this.bowl;
    const P = this.player;
    P.ch.stopAction();
    P.ch.root.position.set(LANE.x0 - 0.9, 0, LANE.z);
    P.ch.root.rotation.y = Math.PI / 2;
    P.vel.set(0, 0);
    B.phase = 'aim';
    B.ball = null;
    this.gym.cam.yaw = -Math.PI / 2;
    this.startAim('bowl', 0.85 + 0.08 * B.frames.length, 0.5);
    this.showBowlBall(true);
  },

  showBowlBall(inHand) {
    const g = this.gym;
    g.bowlBall.visible = true;
    if (inHand) this.bowl.inHand = true;
  },

  rollBowl(v) {
    const B = this.bowl;
    if (!B) return;
    const P = this.player;
    P.ch.root.rotation.y = Math.PI / 2;
    P.ch.play('bowlroll');
    B.phase = 'swing';
    B.t = 0;
    // the meter picks where it meets the pins: the green middle is the pocket
    B.aimZ = (v - 0.5) * 2.1 + rand(-0.03, 0.03) + 0.06;
    B.standing = this.gym.pins.filter((p) => !p.gone && !p.hit).length;
  },

  tickBowl(dt) {
    const B = this.bowl;
    if (!B) return;
    const g = this.gym;
    if (this.world !== g || this.mode !== 'play' || this.race || this.arm) { this.endBowl(null); return; }
    const P = this.player;
    const ch = P.ch;
    const ball = g.bowlBall;
    if (B.phase === 'aim' || B.phase === 'swing') {
      // keep the player on the approach facing the pins
      const p = ch.root.position;
      p.z = LANE.z;
      if (B.phase === 'aim') { p.x = LANE.x0 - 0.9; ch.root.rotation.y = Math.PI / 2; }
      P.vel.set(0, 0);
    }
    if (this.modals.size || this.watch || this.photo) return;
    if (B.inHand) {
      ch.root.updateMatrixWorld(true);
      ch.B.haR.getWorldPosition(ball.position);
      ball.position.y -= 0.06;
    }
    if (B.phase === 'swing') {
      B.t += dt;
      if (B.t >= 1.5 * 0.56) {
        B.inHand = false;
        const sx = Math.max(LANE.x0 + 0.1, ball.position.x), sz = clamp(ball.position.z, LANE.z - LANE.half + 0.12, LANE.z + LANE.half - 0.12);
        const speed = rand(8.6, 9.4);
        const dx = LANE.pinX - sx, dz = LANE.z + B.aimZ - sz;
        const d = Math.hypot(dx, dz);
        B.ball = { x: sx, z: sz, vx: (dx / d) * speed, vz: (dz / d) * speed, gutter: 0, spin: 0 };
        ball.position.set(sx, 0.11, sz);
        B.phase = 'roll';
        B.t = 0;
        Sfx.play('land');
        this.follow(ball.position, 3.2, -Math.PI / 2, 0.32);
      }
      return;
    }
    if (B.phase === 'roll' || B.phase === 'settle') {
      B.t += dt;
      const b = B.ball;
      if (b && !b.done) {
        const steps = 3;
        for (let s = 0; s < steps; s++) this.stepBall(b, dt / steps);
        ball.position.set(b.x, b.gutter ? 0.06 : 0.11, b.z);
        b.spin += (Math.hypot(b.vx, b.vz) / 0.11) * dt;
        ball.rotation.z = -b.spin;
        if (b.x > LANE.end + 0.4) { b.done = true; ball.visible = false; Sfx.play('clank'); }
      }
      this.stepPins(dt);
      if (B.phase === 'roll' && b && (b.done || b.x > LANE.pinX + 0.3)) {
        B.phase = 'settle';
        B.t = 0;
        this.follow(new THREE.Vector3(LANE.pinX + 0.4, 0.2, LANE.z), 3.4, -Math.PI / 2 + 0.25, 0.32);
      }
      const moving = g.pins.some((p) => !p.gone && (Math.hypot(p.vx, p.vz) > 0.08 || (p.hit && p.tilt < Math.PI / 2 - 0.01)));
      if (B.phase === 'settle' && ((B.t > 1.6 && !moving) || B.t > 4.5)) this.scoreRoll();
      else if (B.phase === 'roll' && B.t > 6) this.scoreRoll();
      return;
    }
    if (B.phase === 'show') {
      B.t -= dt;
      if (B.t <= 0) {
        if (B.over) { this.endBowl(true); return; }
        this.unfollow(false);
        this.nextBowl();
      }
    }
  },

  stepBall(b, dt) {
    const L = LANE;
    b.x += b.vx * dt;
    b.z += b.vz * dt;
    if (!b.gutter && Math.abs(b.z - L.z) > L.half - 0.02 && b.x < L.pinX + 1) {
      // into the gutter: it rolls on past the pins
      b.gutter = Math.sign(b.z - L.z);
      b.vz = 0;
      Sfx.play('clank');
    }
    if (b.gutter) { b.z = L.z + b.gutter * (L.half + L.gutter) / 2; return; }
    for (const P of this.gym.pins) {
      if (P.gone || P.tilt > 1.2) continue;
      const dx = P.x - b.x, dz = P.z - b.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.17 && d > 1e-4) {
        const nx = dx / d, nz = dz / d;
        const sp = Math.hypot(b.vx, b.vz);
        const along = b.vx * nx + b.vz * nz;
        if (along <= 0) continue;
        this.knockPin(P, nx * along * 1.1 + b.vx * 0.12 + rand(-0.3, 0.3), nz * along * 1.1 + b.vz * 0.12 + rand(-0.3, 0.3));
        // the ball is heavy: it slows a little and gets pushed off to the side
        b.vx -= nx * along * 0.18;
        b.vz -= nz * along * 0.32;
        const k = Math.max(0.6, sp - 0.35) / Math.max(0.01, Math.hypot(b.vx, b.vz));
        b.vx *= k; b.vz *= k;
        // keep it from sinking into the pin
        b.x = P.x - nx * 0.171; b.z = P.z - nz * 0.171;
      }
    }
  },

  knockPin(P, vx, vz) {
    if (!P.hit) { P.hit = true; P.dir = Math.atan2(vx, vz); Sfx.play('tap'); }
    P.vx += vx; P.vz += vz;
    const s = Math.hypot(P.vx, P.vz);
    if (s > 9) { P.vx *= 9 / s; P.vz *= 9 / s; }
    P.spin = rand(-8, 8);
  },

  stepPins(dt) {
    const L = LANE;
    const pins = this.gym.pins;
    for (const P of pins) {
      if (P.gone) continue;
      if (P.hit) {
        P.tilt = Math.min(Math.PI / 2, P.tilt + dt * 7);
        P.x += P.vx * dt;
        P.z += P.vz * dt;
        const f = Math.max(0, 1 - 2.2 * dt);
        P.vx *= f; P.vz *= f;
        if (Math.abs(P.z - L.z) > L.gutter - 0.04) { P.z = L.z + Math.sign(P.z - L.z) * (L.gutter - 0.04); P.vz = -P.vz * 0.45; Sfx.play('tap'); }
        if (P.x > L.end + 0.25) { P.gone = true; P.m.visible = false; continue; }
        if (P.x < L.pinX - 1.5) { P.vx = Math.abs(P.vx) * 0.3; }
        if (Math.hypot(P.vx, P.vz) > 0.2) P.dir = angleLerp(P.dir, Math.atan2(P.vx, P.vz), 0.2);
        // a falling or sliding pin knocks the next one over (its body and its tip)
        const tipX = P.x + Math.sin(P.dir) * 0.36 * Math.sin(P.tilt), tipZ = P.z + Math.cos(P.dir) * 0.36 * Math.sin(P.tilt);
        const sp = Math.hypot(P.vx, P.vz);
        for (const Q of pins) {
          if (Q === P || Q.gone || Q.hit) continue;
          const dBody = Math.hypot(Q.x - P.x, Q.z - P.z);
          const dTip = Math.hypot(Q.x - tipX, Q.z - tipZ);
          if (dBody < 0.12 || (dTip < 0.1 && P.tilt > 0.35)) {
            const nx = (Q.x - P.x) / Math.max(dBody, 1e-3), nz = (Q.z - P.z) / Math.max(dBody, 1e-3);
            const push = Math.max(1.2, sp * 0.75);
            this.knockPin(Q, nx * push + rand(-0.2, 0.2), nz * push + rand(-0.2, 0.2));
            P.vx *= 0.65; P.vz *= 0.65;
          }
        }
      }
      // lay it down along the way it fell
      P.m.position.set(P.x, 0.012 + 0.06 * Math.sin(P.tilt), P.z);
      P.m.rotation.set(0, 0, 0);
      P.m.rotateY(P.dir);
      P.m.rotateX(P.tilt);
      if (P.tilt >= Math.PI / 2) P.m.rotateY(P.spin * 0.05);
    }
  },

  scoreRoll() {
    const B = this.bowl;
    const g = this.gym;
    let down = 0;
    for (const P of g.pins) if ((P.hit || P.gone) && !P.counted) { P.counted = true; down++; }
    const fi = B.frames.length - 1;
    const fr = B.frames[fi];
    fr.push(down);
    const last = fi === 4;
    const st = this.save.stats;
    const standingAfter = g.pins.filter((p) => !p.counted).length;
    let rack = false;
    let frameOver = false;
    // a strike knocks all ten with the first ball of a rack
    const fresh = B.standing === 10;
    if (fresh && down === 10) {
      st.strikes = (st.strikes || 0) + 1;
      this.showBanner('همه‌ی ۱۰ تا پین!', '🎳 استرایک!');
      this.confetti();
      Sfx.play('cheer');
      this.player.ch.play('e_victory');
      if (st.strikes === 1) this.checkAchievements();
    } else if (!fresh && standingAfter === 0) {
      this.showBanner('بقیه‌ی پین‌ها رو هم انداختی', '✨ اسپر!');
      Sfx.play('success');
      this.player.ch.play('e_flex');
    } else {
      this.floatText(down ? `${fa(down)} پین` : '😅 هیچی!', down >= 7 ? 'fl-combo' : '');
      if (!down) Sfx.play('fail');
    }
    if (!last) {
      if (fr.length === 2 || fr[0] === 10) frameOver = true;
    } else {
      if (fr.length === 3) frameOver = true;
      else if (fr.length === 2 && fr[0] + fr[1] < 10) frameOver = true;
      else if (standingAfter === 0) rack = true;
    }
    if (frameOver) {
      if (fi === 4) B.over = true;
      else { B.frames.push([]); rack = true; }
    }
    if (rack) for (const P of g.pins) this.rackPin(P);
    else for (const P of g.pins) if (P.counted) { P.m.visible = false; P.gone = true; }
    g.bowlBall.visible = false;
    this.drawBowl();
    B.phase = 'show';
    B.t = 1.3;
  },

  drawBowl() {
    const B = this.bowl;
    const scores = bowlScores(B.frames);
    const box = $('gameBoxes');
    box.textContent = '';
    for (let f = 0; f < 5; f++) {
      const fr = B.frames[f] || [];
      const d = document.createElement('div');
      d.className = 'game-box' + (f === B.frames.length - 1 && !B.over ? ' now' : '');
      const marks = document.createElement('span');
      marks.className = 'gb-marks';
      marks.textContent = bowlMarks(fr, f === 4).join(' ') || '·';
      const tot = document.createElement('b');
      tot.textContent = scores[f] != null ? fa(scores[f]) : '';
      d.append(marks, tot);
      box.appendChild(d);
    }
    const fi = Math.min(5, B.frames.length);
    this.showGame(B.over ? '🎳 بازی تموم شد!' : `🎳 بولینگ: فریم ${fa(fi)} از ۵`, 'وقتی عقربه روی سبزه بزن تا توپ بخوره بین پین‌ها؛ همه رو با یه توپ بندازی «استرایک»ه!');
  },

  endBowl(done) {
    const B = this.bowl;
    if (!B) return;
    this.bowl = null;
    this.hideGame();
    this.unfollow(true);
    const g = this.gym;
    if (g && g.pins) {
      for (const P of g.pins) this.rackPin(P);
      g.bowlBall.visible = true;
      g.bowlBall.position.copy(g.ballHome);
      g.bowlBall.rotation.set(0, 0, 0);
    }
    if (this.player) this.player.ch.stopAction();
    if (!done) return;
    const scores = bowlScores(B.frames);
    const total = scores[4] || 0;
    const st = this.save.stats;
    st.bowlGames = (st.bowlGames || 0) + 1;
    const best = total > (st.bowlBest || 0);
    st.bowlBest = Math.max(st.bowlBest || 0, total);
    const coins = Math.round(total * 0.6);
    if (coins) this.addCoins(coins, true);
    this.gainXp(Math.round(total * 2 * this.mult()));
    this.showBanner(`${fa(coins)} سکه${best ? ' — رکورد تازه!' : ''}`, `🎳 امتیاز: ${fa(total)} از ۱۵۰`);
    if (total >= 60) { this.confetti(); Sfx.play('cheer'); }
    this.checkAchievements();
    this.persist();
  },

  /* ---------- archery ---------- */

  startArchery() {
    if (!this.southFree() || !this.nearRange()) return;
    if (this.loop) this.stopLoop(true);
    const P = this.player;
    if (P.board) this.endBoard();
    if (P.jet) this.endJet();
    P.ch.stopAction();
    P.ch.root.position.set(RANGE.x - 0.3, 0, RANGE.z);
    P.ch.root.rotation.y = Math.PI / 2;
    P.vel.set(0, 0);
    P.ch.showProp('bow', true);
    P.ch.manual = true;
    P.ch.manualSnap = false;
    this.archery = { n: 0, scores: [], phase: 'x', stuck: [], arrow: null };
    Sfx.play('click');
    this.follow(null, 3.4, -Math.PI / 2 + 0.28, 0.12);
    this.camFollow = null;
    this.nextArrow();
  },

  nextArrow() {
    const A = this.archery;
    A.phase = 'x';
    A.wind = A.n === 0 ? rand(-0.06, 0.06) : rand(-0.2, 0.2);
    this.drawArchery();
    this.startAim('arrowX', 0.8 + A.n * 0.12, 0.5 - A.wind);
  },

  aimArrowY(v) {
    const A = this.archery;
    if (!A) return;
    A.vx = v;
    A.phase = 'y';
    this.drawArchery();
    this.startAim('arrowY', 0.9 + A.n * 0.12, 0.5);
  },

  drawArchery() {
    const A = this.archery;
    const box = $('gameBoxes');
    box.textContent = '';
    for (let i = 0; i < 5; i++) {
      const d = document.createElement('div');
      d.className = 'game-box' + (i === A.n && A.n < 5 ? ' now' : '');
      const s = A.scores[i];
      const marks = document.createElement('span');
      marks.className = 'gb-marks';
      marks.textContent = '🏹';
      const tot = document.createElement('b');
      tot.textContent = s == null ? '' : s ? fa(s) : '✗';
      d.append(marks, tot);
      box.appendChild(d);
    }
    const sum = A.scores.reduce((a, b) => a + b, 0);
    const w = Math.round(Math.abs(A.wind) * 20);
    const wind = !w ? 'بی‌باد' : A.wind > 0 ? `💨 باد ${fa(w)} به راست ←` : `💨 باد ${fa(w)} به چپ →`;
    const step = A.phase === 'x' ? 'اول چپ و راست رو نشونه بگیر' : A.phase === 'y' ? 'حالا بالا و پایین رو' : '';
    this.showGame(A.n >= 5 ? `🏹 تموم شد: ${fa(sum)} از ۵۰` : `🏹 تیر ${fa(A.n + 1)} از ۵ — ${fa(sum)} امتیاز`, A.n >= 5 ? '' : `${wind} · ${step}؛ باد خونه‌ی سبز رو جابه‌جا می‌کنه.`);
  },

  shootArrow(vy) {
    const A = this.archery;
    if (!A) return;
    const P = this.player;
    const ch = P.ch;
    const p = ch.root.position;
    // where it lands on the face (metres from the middle)
    const hz = (A.vx - 0.5 + A.wind) * 2.4 + rand(-0.015, 0.015);
    const hy = (vy - 0.5) * 2.4 + rand(-0.015, 0.015);
    const r = Math.hypot(hz, hy);
    const hit = r < RANGE.r;
    const sx = p.x + 0.55, sy = 1.45, sz = p.z + 0.02;
    const tx = hit ? RANGE.tx : RANGE.tx + 1.48;
    const k = (tx - sx) / (RANGE.tx - sx);
    const ex = tx, ey = RANGE.ty + hy * k, ez = RANGE.z + hz * k;
    const mesh = this.arrowMesh();
    mesh.position.set(sx, sy, sz);
    this.world.scene.add(mesh);
    A.arrow = { mesh, sx, sy, sz, ex, ey, ez, t: 0, T: 0.55, hit, score: hit ? Math.max(1, 10 - Math.floor(r / 0.06)) : 0 };
    A.phase = 'fly';
    A.release = 0.25;
    Sfx.play('whoosh');
    this.drawArchery();
    this.follow(mesh.position, 2.6, -Math.PI / 2 + 0.5, 0.1);
  },

  arrowMesh() {
    if (!this.arrowGeo) {
      const b = new Batch();
      b.cyl(0.012, 0.75, 0, 0, 0, '#d9c49a', Math.PI / 2, 0, 0);
      b.add(UnitGeo.cone(8), 0, 0, 0.4, '#9aa0a8', Math.PI / 2, 0, 0, 0.03, 0.08, 0.03);
      b.box(0.08, 0.005, 0.12, 0, 0, -0.32, '#e63946');
      b.box(0.005, 0.08, 0.12, 0, 0, -0.32, '#ffd34d');
      this.arrowGeo = mergeParts(b.parts, false);
    }
    const m = new THREE.Mesh(this.arrowGeo, MATTE_MAT);
    m.userData.noSolid = true;
    return m;
  },

  tickArchery(dt) {
    const A = this.archery;
    if (!A) return;
    if (this.world !== this.gym || this.mode !== 'play' || this.race || this.arm) { this.endArchery(null); return; }
    const P = this.player;
    const ch = P.ch;
    ch.root.position.set(RANGE.x - 0.3, 0, RANGE.z);
    ch.root.rotation.y = Math.PI / 2;
    P.vel.set(0, 0);
    // the archer's stance: drawn while aiming, the string hand flies back on release
    const pose = ch.manualPose;
    copyPose(pose, STAND);
    const draw = A.phase === 'x' || A.phase === 'y';
    if (A.release > 0) A.release -= dt;
    archeryFn(pose, draw ? 0.5 : A.release > 0 ? 0.64 : 0.5);
    // aim up and down with the whole upper body
    if (this.aim && this.aim.kind === 'arrowY') pose.spX = (0.5 - this.aim.v) * 0.25;
    if (this.modals.size || this.watch || this.photo) return;
    const R = A.arrow;
    if (R && A.phase === 'fly') {
      R.t += dt;
      const u = Math.min(1, R.t / R.T);
      const x = lerp(R.sx, R.ex, u), z = lerp(R.sz, R.ez, u);
      const y = lerp(R.sy, R.ey, u) + Math.sin(Math.PI * u) * 0.35;
      R.mesh.lookAt(x + (R.ex - R.sx) * 0.01, y + Math.cos(Math.PI * u) * 0.35 * Math.PI * 0.01 + (R.ey - R.sy) * 0.01, z + (R.ez - R.sz) * 0.01);
      R.mesh.position.set(x, y, z);
      if (u >= 1) {
        A.stuck.push(R.mesh);
        A.scores.push(R.score);
        A.n++;
        const st = this.save.stats;
        if (R.score === 10) {
          st.arrowTens = (st.arrowTens || 0) + 1;
          this.showBanner('درست وسط خال!', '🏹 ۱۰ امتیاز!');
          Sfx.play('cheer');
          this.confetti();
          if (st.arrowTens === 1) this.checkAchievements();
        } else {
          this.floatText(R.hit ? `🎯 ${fa(R.score)}` : '😅 بیرون زد!', R.score >= 8 ? 'fl-combo' : '');
          Sfx.play(R.hit ? 'punch' : 'clank');
        }
        this.world.fx.burst({ x: R.ex - 0.1, y: R.ey, z: R.ez }, { count: 14, colors: R.hit ? ['#d9b45a', '#ffd34d'] : ['#1f3d2b', '#9aa0a8'], speed: 1.5, up: 0.5, life: 0.5 });
        A.arrow = null;
        A.phase = 'wait';
        A.t = 1.3;
        this.drawArchery();
        this.follow(new THREE.Vector3(RANGE.tx, RANGE.ty - 1.2, RANGE.z), 2.2, -Math.PI / 2 + 0.3, 0.1);
      }
      return;
    }
    if (A.phase === 'wait') {
      A.t -= dt;
      if (A.t <= 0) {
        this.follow(null, 3.4, -Math.PI / 2 + 0.28, 0.12);
        this.camFollow = null;
        if (A.n >= 5) this.endArchery(true);
        else this.nextArrow();
      }
    }
  },

  endArchery(done) {
    const A = this.archery;
    if (!A) return;
    this.archery = null;
    this.hideGame();
    this.unfollow(true);
    const P = this.player;
    if (P) {
      P.ch.showProp('bow', false);
      if (!P.board) P.ch.manual = false;
    }
    if (A.arrow) A.arrow.mesh.removeFromParent();
    // the arrows stay in the target for a little while
    const stuck = A.stuck;
    setTimeout(() => { for (const m of stuck) m.removeFromParent(); }, 12000);
    if (!done) return;
    const total = A.scores.reduce((a, b) => a + b, 0);
    const st = this.save.stats;
    st.archeryRounds = (st.archeryRounds || 0) + 1;
    const best = total > (st.archeryBest || 0);
    st.archeryBest = Math.max(st.archeryBest || 0, total);
    if (total) this.addCoins(total, true);
    this.gainXp(Math.round(total * 3 * this.mult()));
    this.showBanner(`${fa(total)} سکه${best ? ' — رکورد تازه!' : ''}`, `🏹 امتیاز: ${fa(total)} از ۵۰`);
    if (total >= 35) { this.confetti(); Sfx.play('cheer'); P.ch.play('e_victory'); }
    this.checkAchievements();
    this.persist();
  },

  /* ---------- zipline ---------- */

  startZip() {
    if (!this.southFree() || !this.nearZip()) return;
    if (this.loop) this.stopLoop(true);
    const P = this.player;
    if (P.board) this.endBoard();
    if (P.jet) this.endJet();
    P.ch.stopAction();
    P.ch.manual = true;
    P.ch.manualSnap = false;
    const g = this.gym;
    // five balloons along the way, some to each side: lean with left and right to get them
    for (const m of g.zipBalloons || []) m.removeFromParent();
    g.zipBalloons = [];
    const sides = [0, -1, 1, -1, 1].sort(() => Math.random() - 0.5);
    for (let i = 0; i < 5; i++) {
      const x = 88 + i * 7.2 + rand(-1, 1);
      const m = new THREE.Mesh(this.balloonGeo || (this.balloonGeo = new THREE.SphereGeometry(0.28, 16, 12).scale(1, 1.2, 1)), new THREE.MeshStandardMaterial({ color: DISCO_COLORS[i % DISCO_COLORS.length], roughness: 0.3, emissive: DISCO_COLORS[i % DISCO_COLORS.length], emissiveIntensity: 0.25 }));
      m.position.set(x, zipY(x) - 1.35, ZIP.z + sides[i] * 0.95);
      m.userData.noSolid = true;
      m.userData.side = sides[i];
      g.scene.add(m);
      g.zipBalloons.push(m);
    }
    this.zip = { phase: 'climb', t: 0, x: ZIP.x0, v: 0, lean: 0, popped: 0 };
    Sfx.play('click');
    this.toast('🚡 با چپ و راست خم شو و بادکنک‌ها رو بترکون؛ «ول کن!» یعنی پریدن پایین.', 'gold');
  },

  tickZip(dt) {
    const Z = this.zip;
    if (!Z) return;
    const g = this.gym;
    if (this.world !== g || this.mode !== 'play' || this.race || this.arm) { this.endZip(); return; }
    const P = this.player;
    const ch = P.ch;
    const p = ch.root.position;
    const pose = ch.manualPose;
    copyPose(pose, STAND);
    P.vel.set(0, 0);
    if (this.modals.size || this.watch || this.photo) {
      if (Z.phase !== 'climb') { ch.airY = Z.y; ch.vy = 0; ch.grounded = false; }
      return;
    }
    Z.t += dt;
    if (Z.phase === 'climb') {
      // up the ladder, hand over hand
      const u = Math.min(1, Z.t / 2.2);
      p.set(ZIP.towerX + 0.95, 0, ZIP.z);
      ch.root.rotation.y = -Math.PI / 2;
      Z.y = u * (ZIP.top + 0.05);
      ch.airY = Z.y; ch.vy = 0; ch.grounded = u >= 1 ? false : u < 0.02;
      const c = Math.sin(Z.t * 9);
      pose.shLX = -2.6 + 0.4 * c; pose.shRX = -2.6 - 0.4 * c; pose.elL = pose.elR = -0.6;
      pose.hpLX = -0.6 - 0.4 * c; pose.hpRX = -0.6 + 0.4 * c; pose.knL = 0.9 + 0.4 * c; pose.knR = 0.9 - 0.4 * c;
      if (u >= 1) { Z.phase = 'ready'; Z.t = 0; Sfx.play('charge'); }
      return;
    }
    if (Z.phase === 'ready') {
      // step over to the cable and grab the bar
      const u = Math.min(1, Z.t / 0.6);
      p.set(lerp(ZIP.towerX + 0.95, ZIP.x0, u), 0, ZIP.z);
      ch.root.rotation.y = Math.PI / 2;
      Z.y = lerp(ZIP.top + 0.05, ZIP.y0 - 2.4, smooth(u));
      ch.airY = Z.y; ch.vy = 0; ch.grounded = false;
      pose.shLX = pose.shRX = -3.0 * u; pose.elL = pose.elR = -0.2;
      g.trolley.position.set(ZIP.x0, ZIP.y0 - 0.02, ZIP.z);
      if (u >= 1) { Z.phase = 'ride'; Z.t = 0; Z.v = 2.5; Sfx.play('whoosh'); }
      return;
    }
    if (Z.phase === 'ride') {
      const slope = (ZIP.y0 - ZIP.y1) / (ZIP.x1 - ZIP.x0);
      Z.v += (9.8 * slope * 1.6 - 0.012 * Z.v * Z.v) * dt;
      Z.v = Math.min(Z.v, 13);
      Z.x += Z.v * dt;
      const inp = this.zipIn || { x: 0 };
      Z.lean += ((inp.x || 0) * 0.75 - Z.lean) * damp(4, dt);
      const sway = Math.sin(Z.t * 2.4) * 0.06;
      const th = Z.lean + sway;
      const cy = zipY(Z.x);
      p.set(Z.x, 0, ZIP.z + Math.sin(th) * 1.25);
      ch.root.rotation.y = Math.PI / 2;
      Z.y = cy - 0.02 - 2.36 + (1 - Math.cos(th)) * 1.25;
      ch.airY = Z.y; ch.vy = 0; ch.grounded = false;
      g.trolley.position.set(Z.x, cy - 0.02, ZIP.z);
      g.trolley.rotation.x = -th;
      pose.shLX = pose.shRX = -3.0; pose.elL = pose.elR = -0.15;
      pose.bz = -th;
      const kick = Math.sin(Z.t * 5);
      pose.hpLX = -0.35 + 0.25 * kick; pose.hpRX = -0.35 - 0.25 * kick; pose.knL = 0.4; pose.knR = 0.4;
      pose.nkX = -0.15;
      if (Math.random() < 0.6) this.world.fx.emit(Z.x - 0.3, cy - 0.05, ZIP.z, -1.5, rand(-0.2, 0.2), rand(-0.2, 0.2), new THREE.Color(pick(['#ffffff', '#ffd34d'])), 0.35, 0);
      // balloons in reach pop
      const bx = Z.x, by = cy - 1.35, bz = p.z;
      for (const m of g.zipBalloons) {
        if (!m.parent) continue;
        if (Math.abs(m.position.x - bx) < 0.55 && Math.abs(m.position.z - bz) < 0.6 && Math.abs(m.position.y - by) < 1) {
          m.removeFromParent();
          Z.popped++;
          this.world.fx.burst({ x: m.position.x, y: m.position.y, z: m.position.z }, { count: 24, colors: [`#${m.material.color.getHexString()}`, '#ffffff'], speed: 4, up: 1, life: 0.6 });
          Sfx.play('boom');
          this.addCoins(8, false);
          this.floatText(`🎈 ${fa(Z.popped)}/۵`, 'fl-coin');
        }
      }
      if (Z.x >= ZIP.x1) this.dropZip(true);
      return;
    }
  },

  /** Let go: at the end over the pad, or anywhere along the way. */
  dropZip(atEnd) {
    const Z = this.zip;
    if (!Z || Z.phase !== 'ride') return;
    const P = this.player;
    const ch = P.ch;
    this.zip = null;
    this.zipIn = null;
    ch.manual = false;
    ch.vy = atEnd ? 2 : 0.5;
    ch.grounded = false;
    // you keep a little of the speed
    P.vel.set(Math.min(Z.v, 6) * 0.6, 0);
    const g = this.gym;
    setTimeout(() => { if (g.trolley && !this.zip) this.parkTrolley(g); }, 1500);
    for (const m of g.zipBalloons) m.removeFromParent();
    const st = this.save.stats;
    st.zipRides = (st.zipRides || 0) + 1;
    if (Z.popped === 5) {
      st.zipAll = (st.zipAll || 0) + 1;
      this.addCoins(40, true);
      this.showBanner('هر ۵ تا بادکنک ترکید! +۴۰ سکه', '🎈 بادکنک‌ترکون!');
      this.confetti();
      Sfx.play('cheer');
    } else {
      this.floatText(atEnd ? `🚡 وووی! ${fa(Z.popped)} بادکنک` : '🪂 پریدم!', atEnd ? 'fl-combo' : '');
    }
    this.gainXp(Math.round((30 + Z.popped * 10) * this.mult()));
    this.checkAchievements();
    this.persist();
  },

  endZip() {
    const Z = this.zip;
    if (!Z) return;
    this.zip = null;
    this.zipIn = null;
    const P = this.player;
    if (P && !P.board) P.ch.manual = false;
    const g = this.gym;
    if (g && g.zipBalloons) for (const m of g.zipBalloons) m.removeFromParent();
    if (g && g.trolley) this.parkTrolley(g);
    if (P && this.world === g && Z.phase !== 'ride') {
      // still on the ladder or the platform: back down to the floor
      P.ch.root.position.set(ZIP.towerX + 1.3, 0, ZIP.z);
      P.ch.airY = 0; P.ch.vy = 0; P.ch.grounded = true;
    }
  },

  /* ---------- the tornado power ---------- */

  startTornado() {
    const pw = POWER_BY_ID.tornado;
    if (this.mode !== 'play' || this.modals.size || this.race || this.arm || this.photo || this.build) return;
    if (!this.powerUnlocked(pw)) { Sfx.play('error'); this.toast(`🔒 قدرت «${pw.name}» در سطح ${fa(pw.level)} باز می‌شه.`, 'warn'); return; }
    if (this.powerCd.tornado > 0 || this.tornado) return;
    const P = this.player;
    if (P.ch.busy || P.anchor || !P.ch.grounded) return;
    Sfx.init();
    const w = this.world;
    const p = P.ch.root.position;
    const yaw = P.ch.root.rotation.y;
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: '#cfd8e6', transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide });
    const rings = [];
    for (let i = 0; i < 11; i++) {
      const u = i / 10;
      const r = 0.3 + 2.1 * u * u + 0.25 * u;
      const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.06 + 0.16 * u, 6, 22), mat);
      m.rotation.x = Math.PI / 2;
      m.position.y = 0.2 + u * 6.2;
      g.add(m);
      rings.push(m);
    }
    const core = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 0.25, 6.4, 20, 1, true).translate(0, 3.4, 0), new THREE.MeshBasicMaterial({ color: '#9fb0c8', transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }));
    g.add(core);
    g.traverse((o) => { o.userData.noSolid = true; });
    const x = p.x + Math.sin(yaw) * 3, z = p.z + Math.cos(yaw) * 3;
    g.position.set(x, 0, z);
    w.scene.add(g);
    this.tornado = { w, g, rings, mat, x, z, dir: yaw, t: 8.5, caught: new Map(), total: 0 };
    this.powerCd.tornado = pw.cd;
    this.save.stats.powers++;
    this.missionProgress('power', 1);
    Sfx.play('whoosh');
    Sfx.play('charge');
    w.shake = Math.max(w.shake || 0, 0.4);
    this.showBanner('همه رو با خودش می‌بره!', '🌪️ گردباد');
    this.gainXp(Math.round(pw.xp * this.mult()));
    this.refreshPowers();
  },

  tickTornado(dt) {
    const T = this.tornado;
    if (!T) return;
    if (T.w !== this.world || this.mode !== 'play') { this.endTornado(); return; }
    if (this.modals.size || this.watch || this.photo) return;
    const w = T.w;
    T.t -= dt;
    // it wanders on, turning now and then, and won't go through walls
    // it hunts the nearest person it can pick up, and wanders when there is no one
    let best = null, bd = 22;
    for (const q of w.npcs) {
      if (NO_GRAB.includes(q.state) || q.anchored) continue;
      const qp = q.ch.root.position;
      const d = Math.hypot(qp.x - T.x, qp.z - T.z);
      if (d < bd) { bd = d; best = qp; }
    }
    if (best) T.dir = angleLerp(T.dir, Math.atan2(best.x - T.x, best.z - T.z), damp(1.6, dt));
    else T.dir += Math.sin(this.clock * 0.9) * 0.6 * dt;
    const sp = best ? 5 : 2.6;
    let nx = T.x + Math.sin(T.dir) * sp * dt, nz = T.z + Math.cos(T.dir) * sp * dt;
    if (!w.inBounds(nx, nz, 2) || !w.spotFree(nx, nz, 0.6)) { T.dir += Math.PI * rand(0.6, 1.0); nx = T.x; nz = T.z; }
    T.x = nx; T.z = nz;
    const fade = Math.min(1, T.t / 0.8, (8.5 - T.t) / 0.5);
    T.g.position.set(T.x, 0, T.z);
    T.rings.forEach((m, i) => {
      m.rotation.z += dt * (5 + i * 0.6);
      m.position.x = Math.sin(this.clock * 3 + i * 0.7) * 0.18 * i * 0.15;
      m.position.z = Math.cos(this.clock * 2.6 + i * 0.5) * 0.18 * i * 0.15;
      m.scale.setScalar(Math.max(0.05, fade));
    });
    T.mat.opacity = 0.42 * fade;
    T.g.children[T.g.children.length - 1].material.opacity = 0.16 * fade;
    for (let k = 0; k < 4; k++) {
      const a = rand(0, TAU), r = rand(0.3, 2), y = rand(0, 5);
      w.fx.emit(T.x + Math.cos(a) * r, y, T.z + Math.sin(a) * r, -Math.sin(a) * 4, rand(1.5, 3), Math.cos(a) * 4, new THREE.Color(pick(['#cfd8e6', '#9fb0c8', '#ffffff', '#b8a27a'])), 0.6, 0);
    }
    // people close by get pulled in
    if (T.t > 0.8) {
      for (const q of w.npcs) {
        if (NO_GRAB.includes(q.state) || q.anchored || T.caught.has(q)) continue;
        const qp = q.ch.root.position;
        const d = Math.hypot(qp.x - T.x, qp.z - T.z);
        if (d < 2.8) this.grabTwister(q, T, d);
      }
    }
    // carried round and round, up and up; then thrown out
    for (const [q, C] of T.caught) {
      if (q.state !== 'twister' || !w.npcs.includes(q)) { T.caught.delete(q); q.anchored = false; continue; }
      C.t += dt;
      C.a += dt * (4 + C.t);
      C.h = Math.min(4.2, C.h + dt * 1.6);
      const r = 0.8 + 0.35 * Math.sin(C.t * 2) + C.h * 0.18;
      const ch = q.ch;
      ch.root.position.set(T.x + Math.cos(C.a) * r, 0, T.z + Math.sin(C.a) * r);
      ch.root.rotation.y += dt * 9;
      ch.airY = C.h;
      ch.vy = 0;
      ch.grounded = false;
      if (C.t > C.hold || T.t <= 0.8) this.flingTwister(q, T, C);
    }
    if (T.t <= 0) this.endTornado();
  },

  grabTwister(q, T, d) {
    const ch = q.ch;
    if (ch.busy) ch.stopAction();
    T.w.leaveStation(q);
    q.state = 'twister';
    q.anchored = true;
    q.vel.set(0, 0);
    const p = ch.root.position;
    T.caught.set(q, { a: Math.atan2(p.z - T.z, p.x - T.x), h: ch.airY, t: 0, hold: rand(1.8, 2.8), d });
    T.total++;
    ch.setLabel(q.name, '🌪️ وااای!', '#cfd8e6');
    if (Math.random() < 0.5) Sfx.play('whoosh');
    const st = this.save.stats;
    if (T.total > (st.tornadoBest || 0)) { st.tornadoBest = T.total; if (T.total === 5) this.checkAchievements(); }
  },

  flingTwister(q, T, C) {
    T.caught.delete(q);
    q.anchored = false;
    q.state = 'flung';
    const p = q.ch.root.position;
    const a = Math.atan2(p.z - T.z, p.x - T.x);
    q.fling = { x: Math.cos(a), z: Math.sin(a), sp: rand(5, 8) };
    q.ch.vy = rand(3, 5);
    q.ch.grounded = false;
  },

  endTornado() {
    const T = this.tornado;
    if (!T) return;
    this.tornado = null;
    for (const [q, C] of T.caught) {
      if (q.state === 'twister') this.flingTwister(q, T, C);
      else q.anchored = false;
    }
    T.g.removeFromParent();
    T.g.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    T.mat.dispose();
    const n = T.total;
    if (n) this.floatText(`🌪️ ${fa(n)} نفر چرخیدن!`, 'fl-combo');
    this.checkAchievements();
  },

  /* ---------- the menu ---------- */

  goSouth() {
    this.closeModal('menuModal');
    if (this.world !== this.gym) { this.toast('بولینگ، کمان و زیپ‌لاین ته باشگاه اوله (جنوب پیست نینجا)؛ اول برگرد باشگاه.', 'warn'); return; }
    this.quickTravel(92, 22);
    if (this.world === this.gym && !this.race && !this.arm && !this.build && !this.photo) this.toast('🎳 بولینگ سمت چپته، 🏹 میدان تیر سمت راست، 🚡 برج زیپ‌لاین هم پشت سرت.', 'gold');
  },

  /* ---------- every frame ---------- */

  tickFun7(dt) {
    const g = this.gym;
    if (g && !g.south) this.buildSouth(g);
    this.tickAim(dt);
    this.tickBowl(dt);
    this.tickArchery(dt);
    this.tickZip(dt);
    this.tickTornado(dt);
  },
});

/* ---------- hooks into what is already there ---------- */

const _usePower7 = Game.usePower;
Game.usePower = function (id) {
  if (this.miniBusy()) return;
  if (id === 'tornado') { this.startTornado(); return; }
  _usePower7.call(this, id);
};

const _quickTravel7 = Game.quickTravel;
Game.quickTravel = function (x, z, special) {
  if (this.zip && this.zip.phase === 'ride') { this.closeModal('qtModal'); this.toast('وسط زیپ‌لاین نمی‌شه جابه‌جا شد! 🚡', 'warn'); return; }
  if (this.world === this.gym && this.mode === 'play' && !this.race && !this.arm && !this.build && !this.photo) {
    this.endBowl(null);
    this.endArchery(null);
    this.endZip();
  }
  _quickTravel7.call(this, x, z, special);
};

const _startRace7 = Game.startRace;
Game.startRace = function () {
  if (this.miniBusy()) { this.toast('اول کاری که می‌کنی رو تموم کن.', 'warn'); return; }
  // a giant or a tiny body would fix the rivals' speed for the whole race
  if (this.morphSize && this.morphSize() !== 1) { this.toast('اول به اندازه‌ی خودت برگرد، بعد مسابقه بده! 🏁', 'warn'); return; }
  _startRace7.call(this);
};

const _input7 = Game.input;
Game.input = function () {
  const r = _input7.call(this);
  if (this.zip) this.zipIn = { x: r.enabled ? r.x : 0 };
  if (this.miniBusy()) {
    // on the zipline the jump key lets go
    if (r.jump && this.zip && this.zip.phase === 'ride') this.dropZip(false);
    r.enabled = false; r.jump = false;
  }
  return r;
};

const _ctx7 = Game.contextAction;
Game.contextAction = function () {
  const a = this.southAction();
  if (a || this.miniBusy()) return a;
  return _ctx7.call(this);
};

const _arcadeFree7 = Game.arcadeFree;
Game.arcadeFree = function () { return !this.miniBusy() && _arcadeFree7.call(this); };
const _funFree7 = Game.funFree;
Game.funFree = function () { return !this.miniBusy() && _funFree7.call(this); };

const _onMove7 = Game.onMove;
Game.onMove = function (m) {
  if (this.miniBusy()) { Sfx.play('error'); return; }
  _onMove7.call(this, m);
};

/* the camera can hold on a rolling ball or a flying arrow */
const _updateCamera7 = WorldBase.prototype.updateCamera;
WorldBase.prototype.updateCamera = function (dt, camera) {
  const f = Game.camFollow;
  if (!f || Game.world !== this) { _updateCamera7.call(this, dt, camera); return; }
  const c = this.cam;
  const k = damp(6, dt);
  c.tx += (f.x - c.tx) * k;
  c.tz += (f.z - c.tz) * k;
  c.ty += (f.y + 0.6 - c.ty) * k;
  const cp = Math.cos(c.pitch);
  const [x, y, z] = this.cameraLimits(c.tx + Math.sin(c.yaw) * cp * c.dist, c.ty + Math.sin(c.pitch) * c.dist + 0.5, c.tz + Math.cos(c.yaw) * cp * c.dist);
  camera.position.set(x, y, z);
  camera.lookAt(c.tx, c.ty, c.tz);
};

/* people caught by the tornado are moved by it; thrown out, they fly, land and fall over */
Object.assign(WorldBase.prototype, {
  twisterNpc(n) {
    if (!Game.tornado || !Game.tornado.caught.has(n)) { n.anchored = false; n.state = 'idle'; n.timer = 0.5; }
    return [0, 0, 0];
  },
  flungNpc(n) {
    const F = n.fling;
    const ch = n.ch;
    if (!F || ch.grounded) {
      n.fling = null;
      const p = ch.root.position;
      if (this.fx) this.fx.burst({ x: p.x, y: 0.3, z: p.z }, { count: 16, colors: ['#cfd6e3', '#ffffff'], speed: 2.5, up: 1, life: 0.5 });
      this.knockNpc(n, p.x - (F ? F.x : 0), p.z - (F ? F.z : 0));
      return [0, 0, 0];
    }
    return [F.x, F.z, F.sp];
  },
});

/* the panel's own controls */
$('gameCancel').addEventListener('click', () => {
  if (Game.bowl) { Game.endBowl(null); Game.toast('🎳 بولینگ تموم شد.'); }
  if (Game.archery) { Game.endArchery(null); Game.toast('🏹 تیراندازی تموم شد.'); }
});
$('gameBar').addEventListener('pointerdown', (e) => { e.preventDefault(); Game.lockAim(); });

/* a giant or tiny body does not fit the arm-wrestling table or a custom machine */
for (const name of ['openArm', 'useCustom']) {
  const orig = Game[name];
  Game[name] = function (...args) {
    if (this.morphSize && this.morphSize() !== 1) {
      Sfx.play('error');
      this.toast('با این اندازه جا نمی‌شی! صبر کن به اندازه‌ی عادی برگردی (یا دوباره دکمه‌ی قدرت رو بزن).', 'warn');
      return undefined;
    }
    return orig.apply(this, args);
  };
}
