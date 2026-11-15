import * as THREE from 'three';
import { buildCar } from './models.js';
import { TrafficCar } from './traffic.js';
import { boxCol, canvasTexture, clamp, fa, faMoney } from './util.js';

const $ = (id) => document.getElementById(id);
const R = 2.3; // ball radius
const GOAL_W = 8; // half width of the goal mouth
const GOAL_H = 6;
const TIME = 90;
const PER_GOAL = 60000;
const _q = new THREE.Quaternion(), _ax = new THREE.Vector3(), _c = [];

/** Car soccer on a pitch in the desert: push a giant ball past a robot keeper. */
export class Soccer {
  constructor(game) {
    this.g = game;
    this.state = 'idle';
    const P = (this.P = game.world.pitch);
    this.spot = { kind: 'soccer', padX: P.x, padZ: P.z - P.hz - 8, name: 'فوتبال ماشینی' };
    this.ball = { x: P.x, z: P.z, y: R, vx: 0, vz: 0, vy: 0 };
    this.buildPitch();
    this.buildBall();
    this.buildKeeper();
    this.goalT = 0;
  }
  buildPitch() {
    const g = this.g, w = g.world, P = this.P, scene = g.scene;
    const y0 = w.heightAt(P.x, P.z) + 0.06;
    const L = P.hx * 2 + 12, W = P.hz * 2 + 4;
    const tex = canvasTexture(1024, 640, (c, cw, ch) => {
      const k = cw / L;
      for (let i = 0; i < 12; i++) {
        c.fillStyle = i % 2 ? '#3f8f3a' : '#479e41';
        c.fillRect((i * cw) / 12, 0, cw / 12 + 1, ch);
      }
      c.strokeStyle = '#f5f5f5';
      c.lineWidth = 0.35 * k;
      const ox = 6 * k, oz = 2 * k, fw = P.hx * 2 * k, fh = P.hz * 2 * k;
      c.strokeRect(ox, oz, fw, fh);
      c.beginPath();
      c.moveTo(ox + fw / 2, oz);
      c.lineTo(ox + fw / 2, oz + fh);
      c.stroke();
      c.beginPath();
      c.arc(ox + fw / 2, oz + fh / 2, 9 * k, 0, Math.PI * 2);
      c.stroke();
      for (const s of [0, 1]) c.strokeRect(s ? ox + fw - 12 * k : ox, oz + fh / 2 - 14 * k, 12 * k, 28 * k);
      c.fillStyle = 'rgba(255,255,255,0.9)';
      c.font = `bold ${5 * k}px sans-serif`;
      c.textAlign = 'center';
      c.fillText('⚽', ox + fw / 2, oz + fh / 2 + 2 * k);
    }, { aniso: 8 });
    const field = new THREE.Mesh(new THREE.PlaneGeometry(L, W), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    field.rotation.x = -Math.PI / 2;
    field.position.set(P.x, y0, P.z);
    field.receiveShadow = true;
    scene.add(field);
    // low barrier walls around it, with a gap on the near side to drive in
    const wm = new THREE.MeshStandardMaterial({ color: 0xeceff1, roughness: 0.6 });
    const ad = canvasTexture(512, 32, (c, cw, ch) => {
      const cols = ['#e53935', '#1e88e5', '#fdd835', '#43a047'];
      for (let i = 0; i < 8; i++) {
        c.fillStyle = cols[i % 4];
        c.fillRect((i * cw) / 8, 0, cw / 8, ch);
        c.fillStyle = '#fff';
        c.font = 'bold 20px sans-serif';
        c.textAlign = 'center';
        c.fillText(['TAXI', 'GOAL!', '⚽', 'CUP'][i % 4], (i + 0.5) * (cw / 8), 24);
      }
    }, { repeat: [3, 1] });
    const am = new THREE.MeshStandardMaterial({ map: ad, roughness: 0.6 });
    const wall = (x, z, lx, lz) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(lx, 0.9, lz), [wm, wm, wm, wm, am, am]);
      m.position.set(x, w.heightAt(x, z) + 0.45, z);
      if (lx > lz) m.material = [wm, wm, wm, wm, am, am];
      else m.material = [am, am, wm, wm, wm, wm];
      scene.add(m);
      w.statics.insert(boxCol(x, z, lx / 2, lz / 2));
    };
    const ex = P.hx + 6, ez = P.hz + 1.5;
    wall(P.x, P.z + ez, ex * 2, 0.5);
    // near side: two pieces with an 12 m gap in the middle
    const half = (ex * 2 - 12) / 2;
    wall(P.x - 6 - half / 2, P.z - ez, half, 0.5);
    wall(P.x + 6 + half / 2, P.z - ez, half, 0.5);
    for (const s of [-1, 1]) {
      // ends: walls either side of the goal
      const seg = ez - GOAL_W - 1;
      wall(P.x + s * ex, P.z + (GOAL_W + 1 + seg / 2), 0.5, seg);
      wall(P.x + s * ex, P.z - (GOAL_W + 1 + seg / 2), 0.5, seg);
    }
    // goals
    const post = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.2 });
    const net = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.45 });
    this.goals = [];
    for (const s of [-1, 1]) {
      const gx = P.x + s * P.hx, gy = w.heightAt(gx, P.z);
      const grp = new THREE.Group();
      for (const dz of [-GOAL_W, GOAL_W]) {
        const pm = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, GOAL_H, 10), post);
        pm.position.set(0, GOAL_H / 2, dz);
        grp.add(pm);
        w.statics.insert(boxCol(gx, P.z + dz, 0.3, 0.3));
      }
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, GOAL_W * 2, 10), post);
      bar.rotation.x = Math.PI / 2;
      bar.position.y = GOAL_H;
      grp.add(bar);
      const back = new THREE.Mesh(new THREE.BoxGeometry(5, GOAL_H, GOAL_W * 2, 3, 6, 10), net);
      back.position.set(s * 2.5, GOAL_H / 2, 0);
      grp.add(back);
      // coloured frame: red = yours, blue = theirs
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, GOAL_W * 2), new THREE.MeshBasicMaterial({ color: s > 0 ? 0x1e88e5 : 0xe53935 }));
      band.position.y = GOAL_H + 0.3;
      grp.add(band);
      grp.position.set(gx, gy, P.z);
      scene.add(grp);
      w.statics.insert(boxCol(gx + s * 5.2, P.z, 0.3, GOAL_W));
      for (const dz of [-GOAL_W, GOAL_W]) w.statics.insert(boxCol(gx + s * 2.6, P.z + dz, 2.6, 0.25));
      this.goals.push(grp);
    }
    // sign by the entrance
    const sign = canvasTexture(256, 96, (c, cw, ch) => {
      c.fillStyle = '#2e7d32';
      c.fillRect(0, 0, cw, ch);
      c.fillStyle = '#fff';
      c.font = 'bold 40px Vazirmatn, Tahoma, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('⚽ فوتبال ماشینی', cw / 2, ch / 2 + 2);
    });
    const sm = new THREE.Mesh(new THREE.BoxGeometry(5, 1.8, 0.15), [wm, wm, wm, wm, new THREE.MeshBasicMaterial({ map: sign }), new THREE.MeshBasicMaterial({ map: sign })]);
    const sx = P.x + 9, sz = P.z - ez - 1.5;
    sm.position.set(sx, w.heightAt(sx, sz) + 3.2, sz);
    scene.add(sm);
    for (const dx of [-2.2, 2.2]) {
      const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.4, 6), wm);
      pl.position.set(sx + dx, w.heightAt(sx, sz) + 1.2, sz);
      scene.add(pl);
    }
    w.statics.insert(boxCol(sx, sz, 2.6, 0.2));
  }
  buildBall() {
    const tex = canvasTexture(512, 256, (c, cw, ch) => {
      c.fillStyle = '#fafafa';
      c.fillRect(0, 0, cw, ch);
      c.fillStyle = '#111';
      for (let j = 0; j < 5; j++) for (let i = 0; i < 8; i++) {
        const x = (i + (j % 2) * 0.5) * (cw / 8), y = (j + 0.5) * (ch / 5);
        c.beginPath();
        for (let k = 0; k < 5; k++) {
          const a = -Math.PI / 2 + (k * Math.PI * 2) / 5;
          c[k ? 'lineTo' : 'moveTo'](x + Math.cos(a) * 18, y + Math.sin(a) * 14);
        }
        c.closePath();
        c.fill();
      }
    });
    this.ballMesh = new THREE.Mesh(new THREE.SphereGeometry(R, 32, 20), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45 }));
    this.ballMesh.castShadow = true;
    this.g.scene.add(this.ballMesh);
    this.placeBall();
  }
  buildKeeper() {
    const root = buildCar({ type: 'sport', color: 0x1e88e5 }).root;
    const c = new TrafficCar(this.g.traffic, root);
    c.isRival = true;
    c.isKeeper = true;
    this.keeper = c;
  }
  placeBall(kick = false) {
    const B = this.ball, P = this.P;
    B.x = P.x;
    B.z = P.z;
    B.y = R + (kick ? 6 : 0);
    B.vx = B.vz = 0;
    B.vy = kick ? 4 : 0;
    this.syncBall();
  }
  syncBall() {
    const B = this.ball;
    this.ballMesh.position.set(B.x, this.g.world.heightAt(B.x, B.z) + B.y, B.z);
  }
  canStart() {
    const g = this.g;
    if (this.state !== 'idle') return false;
    if (g.race.state !== 'idle' || g.crazy.state !== 'idle' || g.parking.state !== 'idle' || g.drag.state !== 'idle' || g.events.job || g.bounty.state !== 'idle') return false;
    if (g.rides.ride) return g.ui.toast('اول مسافرت رو برسون 🧳', 'warn'), false;
    if (g.police.state !== 'none') return g.ui.toast('با پلیس پشت سرت؟! 🚨', 'warn'), false;
    if (g.player.burning || g.onfoot.active || g.onfoot.busy) return false;
    return true;
  }
  offer() {
    const g = this.g, s = g.stats;
    if (!this.canStart()) return;
    g.ui.panel(`<h2>⚽ فوتبال ماشینی</h2>
      <div class="raceoffer"><p class="prize">${fa(TIME)} ثانیه وقت داری توپ غول‌پیکر رو توی دروازه آبی بندازی!</p>
      <p class="note">یه دروازه‌بان رباتی جلوی دروازه آبیه. توی دروازه قرمز (خودت) گل نخوری! هر گل ${faMoney(PER_GOAL)} تومان. با سرعت و نیترو به توپ بزنی هوا میره 🚀</p>
      <div class="statrow"><span>⚽ کل گل‌ها: ${fa(s.goals || 0)}</span><span>🏆 بهترین بازی: ${fa(s.soccerBest || 0)} گل</span></div>
      <div class="btnrow"><button data-a="go">شروع بازی! ⚽</button><button data-a="no" class="ghost">بی‌خیال</button></div></div>`, (el) => {
      el.querySelector('[data-a=go]').onclick = () => {
        g.ui.closePanel();
        if (this.canStart()) this.start();
      };
      el.querySelector('[data-a=no]').onclick = () => g.ui.closePanel();
    });
  }
  start() {
    const g = this.g, P = this.P;
    if (g.rides.state === 'offer') g.rides.decline();
    this.state = 'play';
    this.time = TIME;
    this.score = [0, 0];
    this.placeBall();
    g.player.placeAt(P.x - P.hx + 14, P.z, Math.PI / 2);
    this.keeperOn(true);
    g.rides.cooldown = Math.max(g.rides.cooldown, 15);
    $('soccerHud').classList.remove('hidden');
    document.body.classList.add('timedmode');
    g.audio.tone(880, 0.5, 0.15, 'square');
    g.ui.toast('⚽ بازی شروع شد! توپ رو بنداز توی دروازه آبی', 'good');
  }
  keeperOn(on) {
    const k = this.keeper, P = this.P;
    if (on) {
      k.pos.set(P.x + P.hx - 3, 0, P.z);
      k.heading = -Math.PI / 2;
      k.speed = 0;
      k.state = 'parked';
      k.active = true;
      k.group.visible = true;
      k.knock.set(0, 0);
      k.spin = 0;
      k.sync(0);
    } else k.deactivate();
  }
  end() {
    const g = this.g, s = g.stats;
    if (this.state === 'idle') return;
    this.state = 'idle';
    this.keeperOn(false);
    $('soccerHud').classList.add('hidden');
    document.body.classList.remove('timedmode');
    const [me, them] = this.score;
    const pay = me * PER_GOAL;
    if (pay) {
      g.money += pay;
      g.coins += me * 2;
      s.earned = (s.earned || 0) + pay;
      s.today = (s.today || 0) + pay;
    }
    s.soccerGames = (s.soccerGames || 0) + 1;
    if (me > (s.soccerBest || 0)) s.soccerBest = me;
    if (me > them) s.soccerWins = (s.soccerWins || 0) + 1;
    g.addXp(20 + me * 15);
    g.audio.tone(660, 0.6, 0.15, 'square');
    g.stunts.banner(`⚽ سوت پایان! ${fa(me)} - ${fa(them)}${pay ? ` • +${faMoney(pay)} و 🪙${fa(me * 2)}` : ''}`);
    this.placeBall();
    g.save();
  }
  goal(theirs) {
    const g = this.g, P = this.P;
    const playing = this.state === 'play';
    if (playing) this.score[theirs ? 1 : 0]++;
    g.stats.goals = (g.stats.goals || 0) + (theirs ? 0 : 1);
    this.goalT = 2.2;
    g.audio.burst(1.4, 1300, 'bandpass', 0.3);
    if (theirs) g.ui.toast('😱 گل به خودی!', 'bad');
    else {
      g.stunts.banner('⚽ گلللللل!!! 🎉');
      g.fireworks.show(P.x + P.hx + 10, P.z, 2);
      g.slowmo = 0.35;
      g.replay.offer();
    }
  }
  updateBall(dt) {
    const g = this.g, B = this.ball, P = this.P, p = g.player;
    // car hits ball
    if (!g.onfoot.active) {
      const oc = p.circles(_c);
      const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
      const cvx = fx * p.speed + p.ext.x, cvz = fz * p.speed + p.ext.y;
      const ph = p.y - g.world.heightAt(p.pos.x, p.pos.z);
      for (let i = 0; i < 3; i++) {
        const dx = B.x - oc[i * 2], dz = B.z - oc[i * 2 + 1], d = Math.hypot(dx, dz) || 1e-4;
        if (d >= R + 0.95 || B.y - ph > R + 1.4) continue;
        const nx = dx / d, nz = dz / d;
        B.x += nx * (R + 0.95 - d);
        B.z += nz * (R + 0.95 - d);
        const rel = (B.vx - cvx) * nx + (B.vz - cvz) * nz;
        if (rel < 0) {
          const j = -rel * 1.55;
          B.vx += nx * j;
          B.vz += nz * j;
          if (-rel > 5) B.vy = Math.max(B.vy, Math.min(13, -rel * 0.35 + (p.nitroOn ? 4 : 0)));
          p.speed *= 0.97;
          g.audio.burst(0.08, 400, 'lowpass', Math.min(0.6, -rel * 0.04));
        }
      }
    }
    // the keeper blocks shots
    const k = this.keeper;
    if (k.active) {
      const dx = B.x - k.pos.x, dz = B.z - k.pos.z, d = Math.hypot(dx, dz) || 1e-4;
      if (d < R + 1.6 && B.y < R + 1.5) {
        const nx = dx / d, nz = dz / d;
        B.x = k.pos.x + nx * (R + 1.6);
        B.z = k.pos.z + nz * (R + 1.6);
        const rel = B.vx * nx + B.vz * nz;
        if (rel < 0) {
          B.vx -= nx * rel * 1.7;
          B.vz -= nz * rel * 1.7;
        }
      }
    }
    // flight and bounces
    B.vy -= 20 * dt;
    B.y += B.vy * dt;
    if (B.y <= R) {
      B.y = R;
      B.vy = Math.abs(B.vy) > 1.5 ? -B.vy * 0.5 : 0;
    }
    const damp = Math.exp(-(B.y > R + 0.05 ? 0.08 : 0.45) * dt);
    B.vx *= damp;
    B.vz *= damp;
    const sp = Math.hypot(B.vx, B.vz);
    if (sp > 45) {
      B.vx *= 45 / sp;
      B.vz *= 45 / sp;
    }
    B.x += B.vx * dt;
    B.z += B.vz * dt;
    // walls, and the goals
    const ex = P.hx, ez = P.hz;
    const lx = B.x - P.x, lz = B.z - P.z;
    const inMouth = Math.abs(lz) < GOAL_W - 0.6 && B.y < GOAL_H - 0.5;
    if (Math.abs(lx) > ex + 1.5 && inMouth && this.goalT <= 0) {
      this.goal(lx < 0);
    } else if (Math.abs(lx) > ex + 6 - R || (Math.abs(lx) > ex - R + 0.2 && !inMouth)) {
      B.x = P.x + Math.sign(lx) * (inMouth ? ex + 6 - R : ex - R + 0.2);
      B.vx = -B.vx * 0.7;
    }
    if (Math.abs(lz) > ez + 1.2 - R) {
      B.z = P.z + Math.sign(lz) * (ez + 1.2 - R);
      B.vz = -B.vz * 0.7;
    }
    // roll
    if (sp > 0.05) {
      _ax.set(B.vz, 0, -B.vx).normalize();
      _q.setFromAxisAngle(_ax, (sp * dt) / R);
      this.ballMesh.quaternion.premultiply(_q);
    }
    this.syncBall();
  }
  update(dt) {
    const g = this.g, P = this.P, p = g.player;
    if (g.state !== 'play') return;
    // only simulate the ball when someone's around to see it
    const near = Math.hypot(p.pos.x - P.x, p.pos.z - P.z) < 260;
    if (near || this.state !== 'idle') this.updateBall(dt);
    if (this.goalT > 0) {
      this.goalT -= dt;
      if (this.goalT <= 0) this.placeBall(true);
    }
    if (this.state !== 'play') return;
    if (g.police.state === 'chase' || g.police.state === 'arrest' || g.onfoot.active || p.burning) {
      this.end();
      return;
    }
    g.rides.cooldown = Math.max(g.rides.cooldown, 5);
    this.time -= dt;
    // the keeper slides along its goal line after the ball
    const k = this.keeper, B = this.ball;
    // it only re-reads the ball every so often, and it's not that quick
    this.readT = (this.readT || 0) - dt;
    if (this.readT <= 0) {
      this.readT = 0.4;
      this.keepZ = clamp(B.z, P.z - GOAL_W + 2.5, P.z + GOAL_W - 2.5);
    }
    const dz = (this.keepZ ?? P.z) - k.pos.z;
    k.pos.z += clamp(dz, -4.5 * dt, 4.5 * dt);
    k.pos.x = P.x + P.hx - 3;
    k.heading = -Math.PI / 2 + clamp(dz * 0.05, -0.3, 0.3);
    k.sync(0);
    const hud = $('soccerHud');
    const html = `<b>🚕 ${fa(this.score[0])} : ${fa(this.score[1])} 🤖</b><span class="${this.time < 15 ? 'low' : ''}">⏱ ${fa(Math.max(0, Math.ceil(this.time)))}</span>`;
    if (html !== this.hudText) hud.innerHTML = this.hudText = html;
    if (this.time <= 0) this.end();
  }
  mapIcon() {
    return { x: this.spot.padX, z: this.spot.padZ };
  }
}
