// کنترل بازیکن + فیزیک شخصیت: دویدن، پرش، پرش دوبل، سُر خوردن، دیواردوی، بالا رفتن از لبه، پرتاب
import * as THREE from 'three';
import { PHYS } from './config.js';
import { Character } from './character.js';
import { clamp, damp, dampAngle, lerp, wrapAngle, smoothstep } from './util.js';
import { laserOn } from './level.js';

const V3 = THREE.Vector3;

export class Player {
  constructor(look, events) {
    this.char = new Character(look, { scarf: true });
    this.events = events;
    this.pos = new V3();
    this.vel = new V3();
    this.yaw = 0;
    this.near = [];
    this.setAbilities({ speed: 0, jump: 0, doubleJump: 0, magnet: 0 });
    this.reset();
  }
  setAbilities(u) {
    this.maxSpeed = PHYS.baseSpeed * (1 + PHYS.speedPerUpgrade * (u.speed || 0));
    this.jumpV = PHYS.baseJump * (1 + PHYS.jumpPerUpgrade * (u.jump || 0));
    this.canDouble = !!u.doubleJump;
    this.magnet = (u.magnet || 0) * 0.9;
  }
  reset() {
    this.grounded = false;
    this.groundCol = null;
    this.lastGround = null;
    this.coyote = 0;
    this.jumpBuf = 0;
    this.usedDouble = false;
    this.cutDone = true;
    this.slideT = 0;
    this.slideCd = 0;
    this.slideDir = new V3();
    this.slideSpeed = 0;
    this.wall = null;
    this.wallCd = 0;
    this.mantle = null;
    this.knockT = 0;
    this.height = PHYS.height;
    this.airTime = 0;
    this.fallStartY = 0;
    this.visOffY = 0;
    this.frozen = false;
    this.cele = false;
    this.bank = 0;
    this.prevYaw = this.yaw;
    this.accelLean = 0;
  }
  spawn(p, yaw) {
    this.reset();
    this.pos.set(p.x, p.y + 0.02, p.z);
    this.vel.set(0, 0, 0);
    this.yaw = yaw;
    this.prevYaw = yaw;
    this.char.root.position.copy(this.pos);
    this.char.root.rotation.set(0, yaw, 0);
    this.char.scarfInit = false;
  }

  // ---------- هندسهٔ برخورد ----------
  localOf(c, x, z) {
    const dx = x - c.cx, dz = z - c.cz;
    return [c.cos * dx - c.sin * dz, c.sin * dx + c.cos * dz];
  }
  supports(c, x, z, margin) {
    if (!c.solid) return false;
    if (c.shape === 'cyl') {
      const dx = x - c.cx, dz = z - c.cz;
      return dx * dx + dz * dz < (c.r + margin) * (c.r + margin);
    }
    const [lx, lz] = this.localOf(c, x, z);
    return Math.abs(lx) < c.hx + margin && Math.abs(lz) < c.hz + margin;
  }

  // ---------- یک زیرگام فیزیک ----------
  step(h, input, course, t) {
    if (this.frozen) return;
    const P = this.pos, Vv = this.vel;
    const r = PHYS.radius;
    const near = course.nearby(P, 8, this.near);

    // حمل توسط سکوی متحرک
    if (this.grounded && this.groundCol && (this.groundCol.dynamic || this.groundCol.local)) {
      const c = this.groundCol;
      if (c.dyaw) {
        const ox = P.x - (c.cx - c.dx), oz = P.z - (c.cz - c.dz);
        const cs = Math.cos(c.dyaw), sn = Math.sin(c.dyaw);
        P.x = c.cx + cs * ox + sn * oz;
        P.z = c.cz - sn * ox + cs * oz;
        this.yaw += c.dyaw;
      } else {
        P.x += c.dx;
        P.z += c.dz;
      }
      P.y += c.dy;
    }

    // بالا رفتن از لبه (انیمیشنی، بدون فیزیک)
    if (this.mantle) {
      const m = this.mantle;
      m.t += h / PHYS.mantleTime;
      const k = Math.min(1, m.t);
      const ky = 1 - Math.pow(1 - smoothstep(0, 0.75, k), 2);
      const kxz = smoothstep(0.35, 1, k);
      P.x = lerp(m.from.x, m.to.x, kxz);
      P.z = lerp(m.from.z, m.to.z, kxz);
      // سکو ممکن است حرکت کند
      const top = m.col.top;
      P.y = lerp(m.from.y, top, ky);
      Vv.set(0, 0, 0);
      if (k >= 1) {
        this.mantle = null;
        this.setGround(m.col, 0);
        const f = new V3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
        Vv.copy(f).multiplyScalar(this.maxSpeed * 0.55);
      }
      return;
    }

    // نگه‌داشتن تماس با زمین
    if (this.grounded) {
      const c = this.groundCol;
      let ok = c && c.solid && this.supports(c, P.x, P.z, r * 0.55) && Math.abs(P.y - c.top) < 0.35;
      if (ok) P.y = c.top;
      else {
        // سکوی دیگری زیر پا؟
        let best = null;
        for (const o of near) {
          if (!o.solid || o.top > P.y + 0.05 || o.top < P.y - 0.32) continue;
          if (this.supports(o, P.x, P.z, r * 0.55) && (!best || o.top > best.top)) best = o;
        }
        if (best) { this.groundCol = best; P.y = best.top; }
        else {
          this.grounded = false;
          this.groundCol = null;
          this.coyote = PHYS.coyote;
          this.fallStartY = P.y;
        }
      }
    }
    if (!this.grounded) this.coyote -= h;
    this.jumpBuf -= h;
    this.slideCd -= h;
    this.wallCd -= h;
    this.knockT -= h;

    // ورودی حرکت
    const kind = this.groundCol ? this.groundCol.kind : '';
    let tx = input.x * this.maxSpeed, tz = input.z * this.maxSpeed;
    const knocked = this.knockT > 0;
    if (knocked) { tx = Vv.x; tz = Vv.z; }

    // سُر خوردن
    if (input.slide && this.grounded && this.slideT <= 0 && this.slideCd <= 0) {
      const hs = Math.hypot(Vv.x, Vv.z);
      if (hs > 2.5) {
        this.slideT = PHYS.slideTime;
        this.slideDir.set(Vv.x / hs, 0, Vv.z / hs);
        this.slideSpeed = Math.max(hs, this.maxSpeed) * PHYS.slideBoost;
        this.events.onSlide && this.events.onSlide();
      }
    }
    if (this.slideT > 0) {
      this.slideT -= h;
      // هدایت ملایم
      if (input.mag > 0.1) {
        const ia = Math.atan2(input.x, input.z), sa = Math.atan2(this.slideDir.x, this.slideDir.z);
        const na = sa + clamp(wrapAngle(ia - sa), -1, 1) * h * 1.8;
        this.slideDir.set(Math.sin(na), 0, Math.cos(na));
      }
      const k = lerp(0.72, 1, this.slideT / PHYS.slideTime);
      tx = this.slideDir.x * this.slideSpeed * k;
      tz = this.slideDir.z * this.slideSpeed * k;
      // اگر سقف کوتاه است ادامه بده
      if (this.slideT <= 0 && this.blockedAbove(near, P, r)) this.slideT = 0.08;
      if (this.slideT <= 0) this.slideCd = PHYS.slideCooldown;
    }
    this.height = this.slideT > 0 ? PHYS.slideHeight : PHYS.height;

    // شتاب
    const ice = this.grounded && kind === 'ice';
    let acc;
    if (this.grounded) acc = ice ? PHYS.iceAccel : input.mag > 0.05 || this.slideT > 0 ? PHYS.groundAccel : PHYS.groundDecel;
    else acc = knocked ? 0 : PHYS.airAccel;
    if (this.wall) acc = 0;
    {
      const dx = tx - Vv.x, dz = tz - Vv.z;
      const dl = Math.hypot(dx, dz);
      const mx = acc * h;
      if (dl <= mx) { Vv.x = tx; Vv.z = tz; }
      else if (dl > 0) { Vv.x += (dx / dl) * mx; Vv.z += (dz / dl) * mx; }
      // در هوا سرعت افقی بیشتر از حد را حفظ کن (پرش از سُر)
    }

    // پرش‌ها
    if (this.jumpBuf > 0) {
      if (this.wall) {
        const w = this.wall;
        Vv.x = w.dir.x * this.maxSpeed + w.n.x * PHYS.wallJumpPush;
        Vv.z = w.dir.z * this.maxSpeed + w.n.z * PHYS.wallJumpPush;
        Vv.y = this.jumpV * 0.92;
        this.wall = null;
        this.wallCd = 0.3;
        this.jumpBuf = 0;
        this.usedDouble = false;
        this.cutDone = true;
        this.yaw = Math.atan2(Vv.x, Vv.z);
        this.events.onJump && this.events.onJump('wall');
      } else if (this.grounded || this.coyote > 0) {
        Vv.y = this.jumpV;
        if (this.slideT > 0) { this.slideT = 0; this.slideCd = PHYS.slideCooldown; }
        this.grounded = false;
        this.groundCol = null;
        this.coyote = 0;
        this.jumpBuf = 0;
        this.cutDone = false;
        this.fallStartY = P.y;
        this.events.onJump && this.events.onJump('ground');
      } else if (this.canDouble && !this.usedDouble && !knocked) {
        Vv.y = this.jumpV * PHYS.doubleJumpMult;
        // تغییر جهت سریع در پرش دوبل
        if (input.mag > 0.2) {
          const sp = Math.max(Math.hypot(Vv.x, Vv.z), this.maxSpeed * 0.9);
          Vv.x = input.x * sp; Vv.z = input.z * sp;
        }
        this.usedDouble = true;
        this.jumpBuf = 0;
        this.cutDone = true;
        this.char.triggerFlip();
        this.events.onJump && this.events.onJump('double');
      }
    }
    if (!input.jumpHeld && !this.cutDone && Vv.y > 0) {
      Vv.y *= PHYS.jumpCut;
      this.cutDone = true;
    }

    // دیواردوی
    if (this.wall) {
      const w = this.wall;
      const c = w.col;
      w.t -= h;
      const [lx, lz] = this.localOf(c, P.x, P.z);
      const along = Math.max(this.maxSpeed * 1.05, w.speed);
      Vv.x = w.dir.x * along;
      Vv.z = w.dir.z * along;
      Vv.y -= PHYS.gravity * PHYS.wallRunGravity * h;
      if (w.t > PHYS.wallRunTime - 0.25) Vv.y = Math.max(Vv.y, 0.8);
      Vv.y = Math.max(Vv.y, -2);
      if (w.t <= 0 || Math.abs(lz) > c.hz + 0.2 || P.y > c.top - 0.3 || P.y < c.bottom - 0.6) {
        this.wall = null;
        this.wallCd = 0.35;
      } else {
        // چسبیدن به دیوار
        const tlx = w.side * (c.hx + r + 0.03);
        const dlx = tlx - lx;
        P.x += c.cos * dlx;
        P.z += -c.sin * dlx;
      }
    } else if (!this.grounded && this.wallCd <= 0 && !knocked) {
      for (const c of near) {
        if (!c.wall) continue;
        const [lx, lz] = this.localOf(c, P.x, P.z);
        if (Math.abs(lz) > c.hz || P.y > c.top - 0.8 || P.y < c.bottom - 0.4) continue;
        const dist = Math.abs(lx) - c.hx;
        if (dist > r + 0.55 || dist < -0.3) continue;
        const axis = new V3(c.sin, 0, c.cos);
        const va = Vv.x * axis.x + Vv.z * axis.z;
        if (Math.abs(va) < 2.5) continue;
        const side = Math.sign(lx) || 1;
        this.wall = {
          col: c, side, t: PHYS.wallRunTime,
          dir: axis.multiplyScalar(Math.sign(va)),
          n: new V3(c.cos * side, 0, -c.sin * side),
          speed: Math.abs(va),
        };
        Vv.y = Math.max(Vv.y, 2.2);
        this.usedDouble = false;
        this.slideT = 0;
        this.events.onWallrun && this.events.onWallrun();
        break;
      }
    }

    // گرانش
    if (!this.grounded && !this.wall) {
      const g = PHYS.gravity * (Vv.y < 0 ? PHYS.fallMult : 1);
      Vv.y = Math.max(Vv.y - g * h, -PHYS.maxFall);
    }

    // حرکت عمودی
    if (!this.grounded) {
      const ny = P.y + Vv.y * h;
      if (Vv.y <= 0) {
        let best = null;
        for (const c of near) {
          if (!c.solid || c.wall) continue;
          if (c.top > P.y + 0.06 + Math.max(0, c.dy) || c.top < ny - 0.001) continue;
          if (this.supports(c, P.x, P.z, r * 0.55) && (!best || c.top > best.top)) best = c;
        }
        if (best) {
          const impact = -Vv.y;
          P.y = best.top;
          this.setGround(best, impact);
        } else P.y = ny;
      } else {
        let hit = false;
        for (const c of near) {
          if (!c.solid) continue;
          const head = P.y + this.height;
          if (c.bottom >= head - 0.02 && c.bottom <= ny + this.height && this.supports(c, P.x, P.z, r * 0.5)) {
            P.y = c.bottom - this.height - 0.01;
            Vv.y = 0;
            hit = true;
            break;
          }
        }
        if (!hit) P.y = ny;
      }
    }

    // حرکت افقی + برخورد با دیواره‌ها
    P.x += Vv.x * h;
    P.z += Vv.z * h;
    if (this.grounded && kind === 'conveyor' && this.groundCol) {
      const p = this.groundCol.p;
      const cs = this.groundCol.cos, sn = this.groundCol.sin;
      const bx = cs * p.belt.x + sn * p.belt.z, bz = -sn * p.belt.x + cs * p.belt.z;
      P.x += bx * p.beltSpeed * h;
      P.z += bz * p.beltSpeed * h;
    }
    for (const c of near) {
      if (!c.solid || c === this.groundCol) continue;
      const feet = P.y, head = P.y + this.height;
      if (c.bottom >= head || c.top <= feet + 0.001) continue;
      let nx = 0, nz = 0, push = 0;
      if (c.shape === 'cyl') {
        const dx = P.x - c.cx, dz = P.z - c.cz;
        const d = Math.hypot(dx, dz);
        if (d >= c.r + r) continue;
        nx = d > 1e-6 ? dx / d : 1; nz = d > 1e-6 ? dz / d : 0;
        push = c.r + r - d;
      } else {
        const [lx, lz] = this.localOf(c, P.x, P.z);
        const qx = clamp(lx, -c.hx, c.hx), qz = clamp(lz, -c.hz, c.hz);
        const ex = lx - qx, ez = lz - qz;
        const d2 = ex * ex + ez * ez;
        if (d2 >= r * r) continue;
        let lnx, lnz;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          lnx = ex / d; lnz = ez / d; push = r - d;
        } else {
          const px = c.hx - Math.abs(lx), pz = c.hz - Math.abs(lz);
          if (px < pz) { lnx = Math.sign(lx) || 1; lnz = 0; push = px + r; }
          else { lnx = 0; lnz = Math.sign(lz) || 1; push = pz + r; }
        }
        nx = c.cos * lnx + c.sin * lnz;
        nz = -c.sin * lnx + c.cos * lnz;
      }
      const rise = c.top - feet;
      // پله: بالا برو
      if (rise <= PHYS.stepHeight && (this.grounded || Vv.y <= 0) && c.kind !== 'bar') {
        if (this.supports(c, P.x - nx * (r + 0.05), P.z - nz * (r + 0.05), r * 0.6)) {
          this.visOffY -= rise;
          P.y = c.top;
          this.setGround(c, 0);
          continue;
        }
      }
      // بالا رفتن از لبه
      const into = -(Vv.x * nx + Vv.z * nz);
      const wantInto = -(input.x * nx + input.z * nz);
      if (!this.grounded && !this.wall && !knocked && c.kind !== 'bar' && c.kind !== 'tower' && !c.wall && rise >= PHYS.mantleMin && rise <= PHYS.mantleMax && (into > 0.5 || wantInto > 0.4) && Vv.y < 7) {
        this.mantle = {
          t: 0, col: c,
          from: P.clone(),
          to: new V3(P.x - nx * (r + 0.32), c.top, P.z - nz * (r + 0.32)),
        };
        this.yaw = Math.atan2(-nx, -nz);
        this.events.onMantle && this.events.onMantle();
        return;
      }
      P.x += nx * push;
      P.z += nz * push;
      const vn = Vv.x * nx + Vv.z * nz;
      if (vn < 0) { Vv.x -= vn * nx; Vv.z -= vn * nz; }
    }

    // موانع خطرناک
    this.checkHazards(course, t);
  }

  blockedAbove(near, P, r) {
    for (const c of near) {
      if (!c.solid) continue;
      if (c.bottom > P.y + PHYS.slideHeight - 0.05 && c.bottom < P.y + PHYS.height && this.supports(c, P.x, P.z, r * 0.9)) return true;
    }
    return false;
  }

  setGround(c, impact) {
    const wasAir = !this.grounded;
    this.grounded = true;
    this.groundCol = c;
    this.lastGround = c;
    this.vel.y = 0;
    this.usedDouble = false;
    this.wall = null;
    this.coyote = 0;
    if (wasAir) {
      const drop = this.fallStartY - this.pos.y;
      if (c.kind === 'bounce') {
        this.vel.y = PHYS.bounceV;
        this.vel.x *= 0.62;
        this.vel.z *= 0.62;
        this.grounded = false;
        this.groundCol = null;
        this.cutDone = true;
        this.fallStartY = this.pos.y;
        this.events.onBounce && this.events.onBounce(c.p);
        return;
      }
      if (impact > 2) {
        this.char.triggerLand(clamp((impact - 4) / 18, 0.2, 1));
        this.events.onLand && this.events.onLand(impact, drop);
      }
      if (this.knockT > -0.2) this.knockT = 0;
    }
    if (c.kind === 'crumble') this.events.onCrumbleTouch && this.events.onCrumbleTouch(c);
    if (c.kind === 'checkpoint' || c.kind === 'finish') this.events.onPad && this.events.onPad(c.p);
  }

  checkHazards(course, t) {
    const P = this.pos, r = PHYS.radius;
    const tr = { x: 0, y: 0, z: 0, yaw: 0 };
    for (const H of course.hazards) {
      if (H.type === 'bar') continue;
      const p = H.plat;
      const dxp = P.x - (p.col ? p.col.cx : p.x), dzp = P.z - (p.col ? p.col.cz : p.z);
      if (dxp * dxp + dzp * dzp > 400) continue;
      const c = p.col;
      const top = c.top;
      const [lx, lz] = this.localOf(c, P.x, P.z);
      if (H.type === 'sweeper') {
        const a = t * H.speed + H.phase;
        // در دستگاه بازو
        const ca = Math.cos(a), sa = Math.sin(a);
        const ax = ca * lx - sa * lz, az = sa * lx + ca * lz;
        const y0 = top + H.h - 0.2, y1 = top + H.h + 0.2;
        if (P.y > y1 || P.y + this.height < y0) continue;
        if (Math.abs(ax) < 0.17 + r && Math.abs(az) < H.len / 2) {
          // جهت ضربه: مماس بر چرخش
          const s = Math.sign(H.speed) * (az >= 0 ? 1 : -1);
          const wx = Math.cos(c.yaw + a), wz = -Math.sin(c.yaw + a);
          const out = new V3(dxp, 0, dzp).normalize();
          this.knock(new V3(wx * s * 7 + out.x * 4, 7.5, wz * s * 7 + out.z * 4));
        }
      } else if (H.type === 'hammer') {
        const th = Math.sin(t * H.speed + H.phase) * H.amp;
        const pivotY = c.cy + H.pivotY;
        const hx = Math.sin(th) * H.arm, hy = pivotY - Math.cos(th) * H.arm;
        const zc = clamp(lz, H.lz - 0.75, H.lz + 0.75);
        const yc = clamp(hy, P.y + r, P.y + this.height - r);
        const d = Math.hypot(lx - hx, yc - hy, lz - zc);
        if (d < 0.62 + r) {
          const omega = Math.cos(t * H.speed + H.phase) * H.amp * H.speed;
          const s = Math.sign(omega) || Math.sign(lx - hx) || 1;
          const wx = c.cos * s, wz = -c.sin * s;
          this.knock(new V3(wx * 10, 6.5, wz * 10));
        }
      } else if (H.type === 'laser') {
        if (!laserOn(H, t)) continue;
        if (Math.abs(lz - H.lz) > r + 0.05 || Math.abs(lx) > H.w / 2 + 0.1) continue;
        for (const hh of H.heights) {
          const y = top + hh;
          if (P.y < y + 0.05 && P.y + this.height > y - 0.05) {
            this.events.onZap && this.events.onZap();
            return;
          }
        }
      }
    }
  }

  knock(v) {
    if (this.knockT > 0) return;
    this.vel.copy(v);
    this.grounded = false;
    this.groundCol = null;
    this.knockT = 0.7;
    this.slideT = 0;
    this.wall = null;
    this.fallStartY = this.pos.y;
    this.events.onKnock && this.events.onKnock();
  }

  // ---------- به‌روزرسانی هر فریم (انیمیشن، جهت) ----------
  updateVisual(dt) {
    const hs = Math.hypot(this.vel.x, this.vel.z);
    let targetYaw = this.yaw;
    if (this.wall) targetYaw = Math.atan2(this.wall.dir.x, this.wall.dir.z);
    else if (this.slideT > 0) targetYaw = Math.atan2(this.slideDir.x, this.slideDir.z);
    else if (hs > 0.6 && this.knockT <= 0) targetYaw = Math.atan2(this.vel.x, this.vel.z);
    if (!this.mantle) this.yaw = dampAngle(this.yaw, targetYaw, this.grounded ? 16 : 7, dt);
    const yawRate = wrapAngle(this.yaw - this.prevYaw) / Math.max(dt, 1e-4);
    this.prevYaw = this.yaw;
    this.bank = damp(this.bank, clamp(-yawRate * hs * 0.012, -0.35, 0.35) * (this.grounded ? 1 : 0.4), 10, dt);
    this.visOffY = damp(this.visOffY, 0, 18, dt);
    const ch = this.char;
    ch.root.position.set(this.pos.x, this.pos.y + this.visOffY, this.pos.z);
    ch.root.rotation.set(0, this.yaw, 0);
    let wallSide = 0;
    if (this.wall) {
      const left = new V3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      wallSide = -(this.wall.n.x * left.x + this.wall.n.z * left.z) > 0 ? 1 : -1;
    }
    ch.update(dt, {
      speed: this.grounded ? hs : hs * 0.5,
      maxSpeed: this.maxSpeed,
      grounded: this.grounded,
      vy: this.vel.y,
      slide: this.slideT > 0,
      wall: wallSide,
      mantle: this.mantle ? this.mantle.t : -1,
      knock: this.knockT > 0,
      cele: this.cele,
      bank: this.bank,
      lean: 0,
    });
    ch.updateScarf(dt, this.vel);
  }
}
