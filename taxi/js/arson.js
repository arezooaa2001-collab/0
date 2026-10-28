import * as THREE from 'three';
import { Particles } from './effects.js';
import { posePunch, poseAngry } from './models.js';
import { pick, clamp } from './util.js';

const BURN_TIME = 40; // seconds until the taxi repairs itself
const BLAZE_AT = 3.2; // after this the cabin is deadly
const PANIC = ['وااای آتیش! کمک! 😱', 'یا خدا! ماشین آتیش گرفت!', 'کمک! داره می‌سوزه!'];
const ANGRY = [
  'مرتیکه چرا داری ماشینو آتیش می‌زنی؟! بیا اینجا ببینم 🤬',
  'وایسا ببینم! دیوونه‌ای؟! نزدیک بود منو بسوزونی! 🤬',
  'کجا در میری؟! بیا اینجا کارت دارم! 👊',
  'آتیش‌افروز روانی! وایسا!',
];
const charMat = new THREE.MeshStandardMaterial({ color: 0x1b1714, roughness: 1, emissive: 0x5a1800, emissiveIntensity: 0.5 });

/** Electric lighter + burning taxi + the passenger's reaction. */
export class Arson {
  constructor(game) {
    this.g = game;
    this.burning = false;
    this.t = 0;
    this.fire = new Particles(game.scene, { max: 420, color: 0xff7a1a, additive: true });
    this.flame2 = new Particles(game.scene, { max: 200, color: 0xffd25a, additive: true });
    this.smoke = new Particles(game.scene, { max: 260, color: 0x1e1c1a });
    this.light = new THREE.PointLight(0xff6a20, 0, 30, 1.6);
    game.scene.add(this.light);
    this.victim = null; // { walker, phase, ... }
    this.origColor = null;
  }
  setScale(h, fov) {
    for (const p of [this.fire, this.flame2, this.smoke]) p.setScale(h, fov);
  }

  /** used from the inventory */
  useLighter() {
    const g = this.g, p = g.player;
    if (g.state !== 'play') return false;
    if (this.burning) {
      g.ui.toast('ماشین همین الانم داره می‌سوزه! 🔥', 'warn');
      return false;
    }
    const f = g.onfoot;
    if (f.active) {
      const d = Math.hypot(f.walker.pos.x - p.pos.x, f.walker.pos.z - p.pos.z);
      if (d > 5) {
        g.ui.toast('برو نزدیک تاکسی تا بتونی آتیشش بزنی', 'warn');
        return false;
      }
    } else if (Math.abs(p.speed) > 3) {
      g.ui.toast('اول ماشین رو نگه دار!', 'warn');
      return false;
    }
    this.ignite();
    return true;
  }

  ignite() {
    const g = this.g, p = g.player;
    this.burning = true;
    this.t = 0;
    this.reported = false;
    p.burning = true;
    p.speed = 0;
    g.audio.crash(4);
    g.ui.flash();
    g.ui.toast('🔥 تاکسی آتیش گرفت! ۴۰ ثانیه دیگه خودش درست میشه', 'bad');
    this.origColor = p.car.paint.color.clone();
    g.stats.arsons = (g.stats.arsons || 0) + 1;
    // the driver jumps out
    if (!g.onfoot.active) g.onfoot.forceExit();
    // passenger reaction
    const v = g.rides.abandon();
    if (v) {
      const reaction = 0.8 + Math.random() * 4.0; // some freeze in panic
      this.victim = { ...v, phase: 'panic', t: 0, reaction, escapes: reaction < BLAZE_AT };
      g.ui.say(v.o.name, pick(PANIC), { mood: 'scared', female: v.o.female });
      g.audio.speak(PANIC[0]);
    }
  }

  update(dt) {
    const g = this.g, p = g.player;
    if (this.victim) this.updateVictim(dt);
    if (!this.burning) {
      this.fire.update(dt, -2);
      this.flame2.update(dt, -2);
      this.smoke.update(dt, -0.5);
      return;
    }
    this.t += dt;
    const t = this.t;
    // intensity: grows fast, burns, then dies down before the repair
    const k = clamp(t / 1.5, 0, 1) * (t > BURN_TIME - 8 ? clamp((BURN_TIME - t) / 8, 0, 1) : 1);
    const pos = p.group.position;
    const h = p.heading, fx = Math.sin(h), fz = Math.cos(h), rx = -fz, rz = fx;
    const n = Math.round(10 * k);
    for (let i = 0; i < n; i++) {
      const a = (Math.random() - 0.5) * 4.2, b = (Math.random() - 0.5) * 1.6;
      const x = pos.x + fx * a + rx * b, z = pos.z + fz * a + rz * b;
      this.fire.emit(x, pos.y + 0.6 + Math.random() * 0.9, z, (Math.random() - 0.5) * 0.6, 2.5 + Math.random() * 2, (Math.random() - 0.5) * 0.6, 0.6 + Math.random() * 0.5, 0.9 + Math.random() * 0.8, -0.6, 0.85, 0.6);
      if (i % 2 === 0) this.flame2.emit(x, pos.y + 0.8, z, 0, 2 + Math.random(), 0, 0.4, 0.6, -0.5, 0.9, 0.6);
    }
    if (Math.random() < 0.8 * k) this.smoke.emit(pos.x + (Math.random() - 0.5) * 2, pos.y + 2, pos.z + (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 0.8, 2.5, (Math.random() - 0.5) * 0.8, 4, 1.6, 4, 0.55, 0.3);
    this.fire.update(dt, -2);
    this.flame2.update(dt, -2);
    this.smoke.update(dt, -0.5);
    this.light.position.set(pos.x, pos.y + 2, pos.z);
    this.light.intensity = (60 + Math.random() * 40) * k;
    // charring
    const char = clamp(t / 8, 0, 1) * (t > BURN_TIME - 3 ? clamp((BURN_TIME - t) / 3, 0, 1) : 1);
    p.car.paint.color.copy(this.origColor).lerp(new THREE.Color(0x15110e), char * 0.92);
    p.health = Math.max(0, 100 - char * 100);
    // the police might hear about it
    if (!this.reported && t > 5) {
      this.reported = true;
      this.report();
    }
    if (t >= BURN_TIME) this.restore();
  }

  witnesses() {
    const g = this.g, p = g.player.pos;
    let n = 0;
    for (const c of g.traffic.cars) if (c.active && Math.hypot(c.pos.x - p.x, c.pos.z - p.z) < 150) n++;
    for (const w of g.peds.list) if (w.active && Math.hypot(w.pos.x - p.x, w.pos.z - p.z) < 100) n++;
    return n;
  }
  report() {
    const g = this.g;
    const v = this.victim;
    const dead = v && !v.escapes;
    const chance = dead ? 1 : this.witnesses() > 0 ? 0.8 : 0.3;
    if (Math.random() > chance) {
      g.ui.toast('🤫 کسی ندید... فعلاً پلیس خبر نداره', 'info');
      return;
    }
    g.police.report(dead ? 2500000 : 600000, dead ? '🚨 یه نفر توی ماشین سوخت! پلیس داره میاد دنبالت!' : '🚨 یکی آتیش‌سوزی رو به پلیس خبر داد!');
  }

  restore() {
    const g = this.g, p = g.player;
    this.burning = false;
    p.burning = false;
    p.health = 100;
    p.car.paint.color.copy(this.origColor);
    this.light.intensity = 0;
    const v = this.victim;
    if (v && v.phase === 'burnt') {
      v.walker.dispose();
      this.victim = null;
    }
    g.ui.toast('✨ تاکسی خودش ترمیم شد و مثل روز اولش شد!', 'good');
    g.audio.cash();
  }

  /* ---------------- the passenger ---------------- */
  updateVictim(dt) {
    const g = this.g, v = this.victim, w = v.walker, car = g.player;
    v.t += dt;
    if (v.phase === 'panic') {
      if (v.escapes && v.t > v.reaction) {
        // door flies open, out and run!
        car.car.doors[v.door].target = 1;
        g.audio.door();
        const side = v.door[1] === 'l' ? 1 : -1;
        const h = car.heading;
        const ox = car.pos.x + Math.cos(h) * side * 1.5 - Math.sin(h) * 0.6;
        const oz = car.pos.z - Math.sin(h) * side * 1.5 - Math.cos(h) * 0.6;
        w.standOut(ox, oz, h + side * Math.PI / 2);
        const ax = ox - car.pos.x, az = oz - car.pos.z, al = Math.hypot(ax, az) || 1;
        w.walkTo(ox + (ax / al) * 22, oz + (az / al) * 22, 5.4, () => {
          v.phase = 'catchBreath';
          v.t = 0;
        });
        v.phase = 'flee';
        setTimeout(() => (car.car.doors[v.door].target = 0), 1500);
      } else if (!v.escapes && v.t > BLAZE_AT + 0.8) {
        this.charify(w);
        v.phase = 'burnt';
        g.ui.toast(`☠️ ${v.o.name} نتونست به موقع فرار کنه و سوخت...`, 'bad');
      } else {
        // trapped & panicking inside: shaking
        w.p.shL.rotation.set(-2.4 + Math.sin(v.t * 20) * 0.3, 0, 0.3);
        w.p.shR.rotation.set(-2.4 + Math.cos(v.t * 20) * 0.3, 0, -0.3);
      }
    } else if (v.phase === 'flee') {
      w.update(dt, g.world);
    } else if (v.phase === 'catchBreath') {
      w.mode = 'angry';
      w.lookAt(g.focus().pos.x, g.focus().pos.z);
      w.update(dt, g.world);
      if (v.t > 2.5) {
        v.phase = 'chase';
        v.t = 0;
        v.shout = 0;
        v.far = 0;
        g.ui.say(v.o.name, ANGRY[0], { mood: 'grumpy', female: v.o.female });
        g.audio.speak('مرتیکه چرا داری ماشینو آتیش می‌زنی؟ بیا اینجا ببینم');
      }
    } else if (v.phase === 'chase') {
      const f = g.focus();
      const d = Math.hypot(f.pos.x - w.pos.x, f.pos.z - w.pos.z);
      v.shout -= dt;
      if (v.shout <= 0 && d < 30) {
        v.shout = 5;
        g.ui.say(v.o.name, pick(ANGRY), { mood: 'grumpy', female: v.o.female });
      }
      if (d > 1.3) {
        if (!w.target || Math.hypot(w.target.x - f.pos.x, w.target.z - f.pos.z) > 0.8) w.walkTo(f.pos.x, f.pos.z, 4.2);
        w.update(dt, g.world);
      } else {
        // fists!
        w.mode = 'idle';
        w.target = null;
        w.heading = Math.atan2(f.pos.x - w.pos.x, f.pos.z - w.pos.z);
        w.t += dt;
        posePunch(w.p, w.t);
        w.root.position.set(w.pos.x, g.world.heightAt(w.pos.x, w.pos.z) + 0.03, w.pos.z);
        w.root.rotation.y = w.heading;
        v.punch = (v.punch || 0) - dt;
        if (v.punch <= 0) {
          v.punch = 0.75;
          g.shake = Math.max(g.shake, 0.45);
          g.audio.burst(0.12, 300, 'lowpass', 0.6);
          if (!v.hits || v.hits % 3 === 0) g.ui.toast('🤕 مشت خوردی!', 'bad');
          v.hits = (v.hits || 0) + 1;
        }
      }
      v.far = d > 60 ? v.far + dt : 0;
      if (v.far > 5 || v.t > 50 || (v.hits || 0) > 12) {
        g.ui.say(v.o.name, v.far > 5 ? 'فرار کن ترسو! بالاخره گیرت میارم! 😤' : 'برو گمشو... دیگه حوصله ندارم!', { mood: 'grumpy', female: v.o.female });
        const away = { x: w.pos.x + (w.pos.x - f.pos.x) * 5, z: w.pos.z + (w.pos.z - f.pos.z) * 5 };
        w.walkTo(away.x, away.z, 1.5);
        v.phase = 'leave';
        v.t = 0;
      }
    } else if (v.phase === 'leave') {
      w.update(dt, g.world);
      if (v.t > 10) {
        w.dispose();
        this.victim = null;
      }
    } else if (v.phase === 'burnt') {
      // embers glow
      charMat.emissiveIntensity = 0.3 + Math.random() * 0.4 * (this.burning ? 1 : 0.2);
    }
  }

  clearVictim() {
    if (this.victim) {
      this.victim.walker.dispose();
      this.victim = null;
    }
  }
  /** turns the seated passenger into a charred skeleton */
  charify(w) {
    w.root.traverse((o) => {
      if (!o.isMesh) return;
      o.material = charMat;
      const isHead = o.parent === w.p.head;
      if (isHead) o.scale.set(0.82, 0.92, 0.85);
      else o.scale.set(o.scale.x * 0.42, o.scale.y, o.scale.z * 0.42);
    });
    if (w.p.skirt) w.p.skirt.visible = false;
    // rib cage and dark eye sockets
    const ribs = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.13 - i * 0.01, 0.012, 6, 16), charMat);
      r.rotation.x = Math.PI / 2;
      r.position.y = 0.38 - i * 0.07;
      ribs.add(r);
    }
    w.p.spine.add(ribs);
    const sock = new THREE.MeshBasicMaterial({ color: 0x000000 });
    for (const s of [1, -1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), sock);
      e.position.set(s * 0.04, 0.12, 0.085);
      w.p.head.add(e);
    }
    this.g.audio.bad();
  }
}
