'use strict';
/*
 * The secret stadium (code 2020): a real 5-a-side match. You play for the red team with three
 * team-mates and a keeper against five blues. Dribble by running into the ball, shoot, pass,
 * tackle, score; a referee whistles goals, throw-ins, corners and full time, and the stands are
 * full of real spectators who jump up when someone scores.
 */

const PITCH = { L: 30, W: 19, goalW: 3.66, goalH: 2.44 };
const MATCH_SECONDS = 180;
const FOOTBALL_CODE = '2020';

const FOOTBALL_ENV = { id: 'football', name: 'استادیوم مخفی فوتبال', icon: '⚽', level: 1, secret: true, desc: 'بازی فوتبال واقعی با داور و تماشاگر' };
ENVS.push(FOOTBALL_ENV);
ENV_BY_ID.football = FOOTBALL_ENV;

ANIMS.fkick = {
  dur: 0.5,
  fn(p, t) {
    const back = Math.sin(Math.PI * seg(t, 0, 0.4));
    const fwd = Math.sin(Math.PI * seg(t, 0.35, 1));
    p.hpRX = 0.7 * back - 1.25 * fwd;
    p.knR = 1.2 * back + 0.1;
    p.hpLX = -0.15; p.knL = 0.3;
    p.shLZ = 0.12 + 0.7 * fwd; p.shRZ = -0.12 - 0.4 * fwd;
    p.shLX = -0.4 * fwd;
    p.spX = -0.15 * fwd;
    plant(p, false);
  },
};
ANIMS.gkdive = {
  dur: 1.0,
  fn(p, t) {
    const a = Math.sin(Math.PI * seg(t, 0, 0.7));
    p.bz = -1.3 * a;
    p.y = 0.25 * a;
    p.shLX = p.shRX = -2.8 * a;
    p.shLZ = 0.3; p.shRZ = -0.3;
    p.hpLZ = 0.3 * a;
  },
};

function ballTexture() {
  return makeCanvasTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#111111';
    for (let i = 0; i < 12; i++) {
      const x = (i % 6) * (w / 6) + (Math.floor(i / 6) ? w / 12 : 0) + 20;
      const y = Math.floor(i / 6) * (h / 2) + h / 4;
      ctx.beginPath();
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * TAU - Math.PI / 2;
        ctx.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14);
      }
      ctx.fill();
    }
  });
}

const TEAM_KITS = [
  { shirt: '#e63946', accent: '#ffffff', shorts: '#ffffff', socks: '#e63946', stripe: '#ffffff' },
  { shirt: '#2f6fed', accent: '#ffd34d', shorts: '#1d2433', socks: '#2f6fed', stripe: '#ffd34d' },
];

class FootballWorld extends EnvWorld {
  constructor() {
    super('football', {
      bounds: { rect: [36, 26] }, spawn: { x: -6, z: 0, yaw: Math.PI / 2 }, background: '#0e1726', fog: [90, 260],
      skyTop: '#1b2a6b', skyBottom: '#ff9e6d', groundTint: 0x335533,
    });
    this.ceiling = 30;
    this.buildPitch();
    this.buildStands();
    this.buildExtras();
    this.finishBatches();
    this.ball = { pos: new THREE.Vector3(0, 0.11, 0), vel: new THREE.Vector3(), holder: null, last: null, spin: 0 };
    this.ballMesh = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: 0.45 }));
    this.ballMesh.userData.noSolid = true;
    this.scene.add(this.ballMesh);
    this.ballShadow = new THREE.Mesh(SHADOW_GEO, SHADOW_MAT);
    this.ballShadow.scale.set(0.35, 1, 0.35);
    this.scene.add(this.ballShadow);
    this.buildTeams();
    this.score = [0, 0];
    this.clock = MATCH_SECONDS;
    this.state = 'kickoff';
    this.stateT = 2;
    this.kickTeam = 0;
    this.drawScoreboard();
  }

  buildPitch() {
    const m = this.matte;
    const { L, W } = PITCH;
    m.box(80, 0.1, 60, 0, -0.05, 0, '#2a6b34');
    for (let i = 0; i < 12; i++) m.box((L * 2 + 8) / 12, 0.02, W * 2 + 6, -L - 4 + (i + 0.5) * ((L * 2 + 8) / 12), 0.005, 0, i % 2 ? '#3d9a4a' : '#47ab55');
    const line = (w, d, x, z) => m.box(w, 0.025, d, x, 0.012, z, '#f5f5f5');
    line(L * 2, 0.12, 0, W);
    line(L * 2, 0.12, 0, -W);
    line(0.12, W * 2, L, 0);
    line(0.12, W * 2, -L, 0);
    line(0.12, W * 2, 0, 0);
    m.geo(ellipseRingGeometry(5, 5, 0.12), 0, 0.014, 0, '#f5f5f5');
    m.cyl(0.18, 0.03, 0, 0.014, 0, '#f5f5f5', 0, 0, 0, 12);
    for (const s of [-1, 1]) {
      // penalty box, goal box, spot
      line(0.12, 16, s * (L - 7), 0);
      line(7, 0.12, s * (L - 3.5), 8);
      line(7, 0.12, s * (L - 3.5), -8);
      line(0.12, 8, s * (L - 2.5), 0);
      line(2.5, 0.12, s * (L - 1.25), 4);
      line(2.5, 0.12, s * (L - 1.25), -4);
      m.cyl(0.15, 0.03, s * (L - 5.5), 0.014, 0, '#f5f5f5', 0, 0, 0, 12);
      // goal: posts, bar, net
      const gx = s * L;
      for (const z of [-PITCH.goalW, PITCH.goalW]) {
        this.metal.cyl(0.07, PITCH.goalH, gx + s * 0.05, PITCH.goalH / 2, z, '#ffffff', 0, 0, 0, 10);
        this.addCollider(gx + s * 0.05 - 0.08, z - 0.08, gx + s * 0.05 + 0.08, z + 0.08);
      }
      this.metal.cyl(0.07, PITCH.goalW * 2, gx + s * 0.05, PITCH.goalH, 0, '#ffffff', Math.PI / 2, 0, 0, 10);
      const netMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.3, side: THREE.DoubleSide, wireframe: false });
      const back = new THREE.Mesh(new THREE.PlaneGeometry(PITCH.goalW * 2, PITCH.goalH, 1, 1), netMat);
      back.position.set(gx + s * 1.6, PITCH.goalH / 2, 0);
      back.rotation.y = Math.PI / 2;
      this.scene.add(back);
      const top = new THREE.Mesh(new THREE.PlaneGeometry(1.6, PITCH.goalW * 2), netMat);
      top.rotation.x = -Math.PI / 2;
      top.position.set(gx + s * 0.8, PITCH.goalH, 0);
      this.scene.add(top);
      for (const z of [-PITCH.goalW, PITCH.goalW]) {
        const side = new THREE.Mesh(new THREE.PlaneGeometry(1.6, PITCH.goalH), netMat);
        side.position.set(gx + s * 0.8, PITCH.goalH / 2, z);
        this.scene.add(side);
      }
      this.addCollider(Math.min(gx + s * 1.5, gx + s * 1.7), -PITCH.goalW, Math.max(gx + s * 1.5, gx + s * 1.7), PITCH.goalW);
      // corner flags
      for (const z of [-W, W]) {
        this.metal.cyl(0.03, 1.5, gx, 0.75, z, '#ffd34d', 0, 0, 0, 6);
        m.box(0.02, 0.3, 0.4, gx, 1.35, z + 0.2, s > 0 ? '#2f6fed' : '#e63946');
      }
    }
  }

  buildStands() {
    const m = this.matte;
    const { L, W } = PITCH;
    // LED advertising boards
    const ads = ['#e63946', '#2f6fed', '#ffd34d', '#2ecc71', '#ff7b00', '#9b5de5', '#00b4d8', '#ff4da6'];
    for (const s of [-1, 1]) {
      for (let i = 0; i < 14; i++) {
        const x = -L + 2 + i * 4.3;
        m.box(4.2, 0.9, 0.15, x, 0.45, s * (W + 2.2), ads[i % ads.length]);
        this.glow.box(3.6, 0.35, 0.02, x, 0.5, s * (W + 2.2) - s * 0.09, '#ffffff');
      }
      this.addCollider(-L - 4, s * (W + 2.1) - 0.1, L + 4, s * (W + 2.1) + 0.1);
      // stands: steps
      for (let r = 0; r < 4; r++) {
        m.box(L * 2 + 6, 0.5 + r * 0.6, 1.4, 0, (0.5 + r * 0.6) / 2, s * (W + 4 + r * 1.4), r % 2 ? '#39435c' : '#2f3850');
      }
      m.box(L * 2 + 6, 6, 0.5, 0, 3, s * (W + 9.6), '#1d2433');
      this.addCollider(-L - 4, s > 0 ? W + 3.2 : -W - 10, L + 4, s > 0 ? W + 10 : -W - 3.2);
    }
    // real spectators: full characters with faces, standing on the steps
    this.fans = [];
    for (const s of [-1, 1]) {
      for (let r = 0; r < 2; r++) {
        for (let i = 0; i < 18; i++) {
          if (Math.random() < 0.15) continue;
          const o = randomOutfit();
          if (Math.random() < 0.55) Object.assign(o, TEAM_KITS[s > 0 ? 0 : 1], { number: false });
          const ch = new Character(Object.assign(o, { muscle: rand(0, 0.5) }));
          const x = -L + 1.5 + i * ((L * 2 - 3) / 17) + rand(-0.4, 0.4);
          const z = s * (W + 4 + r * 1.4 * 2 + rand(-0.15, 0.15));
          const y = 0.5 + r * 1.2;
          ch.root.position.set(x, y, z);
          ch.root.rotation.y = s > 0 ? Math.PI : 0;
          ch.lookAround = true;
          this.scene.add(ch.root);
          this.fans.push({ ch, side: s, cheerT: rand(0, 6) });
        }
      }
    }
    this.fanTick = 0;
  }

  buildExtras() {
    const m = this.matte;
    const { L, W } = PITCH;
    // floodlight towers
    for (const [x, z] of [[-L - 3, -W - 6], [L + 3, -W - 6], [-L - 3, W + 6], [L + 3, W + 6]]) {
      this.metal.box(0.5, 18, 0.5, x, 9, z, '#9aa0a8');
      this.metal.box(4, 2, 0.6, x, 18, z, '#2c3140');
      for (let i = 0; i < 6; i++) this.glow.box(0.5, 0.5, 0.05, x - 1.5 + (i % 3) * 1.5, 17.5 + Math.floor(i / 3) * 0.9, z - Math.sign(z) * 0.32, '#fffbe0');
    }
    this.scene.add(new THREE.PointLight('#fff6e0', 0.5, 120));
    // big screen behind a goal
    this.boardTex = makeCanvasTexture(1024, 384, () => {});
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(12, 4.5), new THREE.MeshBasicMaterial({ map: this.boardTex, toneMapped: false }));
    scr.position.set(-L - 5.5, 6, 0);
    scr.rotation.y = Math.PI / 2;
    this.scene.add(scr);
    this.metal.box(0.4, 5, 12.4, -L - 5.8, 6, 0, '#0b0f1c');
    this.metal.box(0.4, 4, 0.4, -L - 5.8, 2, 0, '#2c3140');
    // benches with coats
    for (const [x, c] of [[-8, '#e63946'], [8, '#2f6fed']]) {
      m.box(5, 0.5, 0.8, x, 0.25, -W - 1.2, '#1d2433');
      m.box(5.2, 1.6, 0.1, x, 1.0, -W - 1.6, '#a8d8ff');
      for (let k = 0; k < 4; k++) m.sphere(0.2, x - 1.8 + k * 1.2, 0.7, -W - 1.2, c);
      this.addCollider(x - 2.6, -W - 1.65, x + 2.6, -W - 0.8);
    }
    // the player's way back to the gym
    this.homeRing = portalRing(this, -8, W + 1.2, '#ffc23d', 'برگشت به باشگاه');
    this.home = { x: -8, z: W + 1.2 };
  }

  buildTeams() {
    const { L } = PITCH;
    this.players = [];
    const mk = (team, role, hx, hz) => {
      const kit = Object.assign({}, randomOutfit(), TEAM_KITS[team], { number: true });
      if (role === 'gk') Object.assign(kit, { shirt: team ? '#2ecc71' : '#ffd34d', stripe: null });
      const ch = new Character(Object.assign(kit, { muscle: rand(0.3, 0.7) }));
      const e = { ch, team, role, home: { x: hx, z: hz }, vel: new THREE.Vector2(), kickCd: 0, dir: team ? -1 : 1, user: false };
      ch.root.position.set(hx, 0, hz);
      ch.root.rotation.y = team ? -Math.PI / 2 : Math.PI / 2;
      this.scene.add(ch.root);
      this.players.push(e);
      return e;
    };
    this.gks = [mk(0, 'gk', -L + 1, 0), mk(1, 'gk', L - 1, 0)];
    mk(0, 'def', -16, -4); mk(0, 'mid', -8, 8); mk(0, 'mid', -8, -9);
    mk(1, 'def', 16, 4); mk(1, 'mid', 8, -8); mk(1, 'mid', 8, 9); mk(1, 'fwd', 3, 0);
    this.userEnt = { ch: null, team: 0, role: 'fwd', home: { x: -3, z: 0 }, vel: null, kickCd: 0, dir: 1, user: true };
    const ref = new Character(Object.assign(randomOutfit(), { shirt: '#111111', accent: '#ffd34d', shorts: '#111111', stripe: '#ffd34d', number: false, band: null, muscle: 0.2 }));
    ref.root.position.set(0, 0, -6);
    this.scene.add(ref.root);
    this.ref = { ch: ref, vel: new THREE.Vector2() };
  }

  /** Everyone on the pitch, the player included when present. */
  allPlayers() {
    if (this.player && this.userActive) {
      this.userEnt.ch = this.player.ch;
      return [this.userEnt, ...this.players];
    }
    return this.players;
  }

  posOf(e) { return e.ch.root.position; }

  enter(player, at) {
    super.enter(player, at);
    this.userActive = true;
    this.resetKickoff(0);
    this.clock = MATCH_SECONDS;
    this.score = [0, 0];
    this.state = 'kickoff';
    this.stateT = 2.5;
    this.drawScoreboard();
  }

  resetKickoff(team) {
    this.kickTeam = team;
    for (const e of this.players) {
      e.ch.stopAction();
      e.ch.root.position.set(e.home.x, 0, e.home.z);
      e.vel.set(0, 0);
    }
    if (this.player && this.userActive) {
      this.player.ch.stopAction();
      this.player.ch.root.position.set(team === 0 ? -0.6 : -6, 0, 0);
      this.player.ch.root.rotation.y = Math.PI / 2;
      this.player.vel.set(0, 0);
    }
    const B = this.ball;
    B.pos.set(0, 0.11, 0);
    B.vel.set(0, 0, 0);
    B.holder = null;
    if (team === 1) {
      const f = this.players.find((e) => e.team === 1 && e.role === 'fwd');
      f.ch.root.position.set(0.6, 0, 0);
    }
  }

  whistle(text, long) {
    Sfx.play('whistle');
    if (long) setTimeout(() => Sfx.play('whistle'), 350);
    if (this.onEvent) this.onEvent(text);
  }

  /* ---------------- ball ---------------- */

  kick(e, dir, power, up) {
    const B = this.ball;
    B.holder = null;
    B.last = e;
    B.vel.set(dir.x * power, up, dir.z * power);
    B.pos.y = Math.max(B.pos.y, 0.12);
    e.kickCd = 0.45;
    if (e.ch && !e.ch.busy && e.ch.grounded) e.ch.play('fkick');
    Sfx.play('punch');
  }

  passTarget(e) {
    const p = this.posOf(e);
    const mates = this.allPlayers().filter((o) => o !== e && o.team === e.team && o.role !== 'gk');
    let best = null;
    let bs = -Infinity;
    for (const o of mates) {
      const q = this.posOf(o);
      const fwd = (q.x - p.x) * e.dir;
      const d = Math.hypot(q.x - p.x, q.z - p.z);
      const s = fwd * 0.6 - Math.abs(d - 10) * 0.3 - this.pressure(o) * 4;
      if (s > bs) { bs = s; best = o; }
    }
    return best;
  }

  pressure(e) {
    const p = this.posOf(e);
    let n = 0;
    for (const o of this.allPlayers()) if (o.team !== e.team && Math.hypot(this.posOf(o).x - p.x, this.posOf(o).z - p.z) < 3) n++;
    return n;
  }

  passTo(e, o) {
    const p = this.posOf(e);
    const q = this.posOf(o);
    const lead = o.vel ? new THREE.Vector2(o.vel.x, o.vel.y).multiplyScalar(0.4) : new THREE.Vector2();
    const tx = q.x + lead.x - p.x;
    const tz = q.z + lead.y - p.z;
    const d = Math.hypot(tx, tz) || 1;
    this.kick(e, { x: tx / d, z: tz / d }, clamp(6 + d * 0.9, 8, 18), 1.2 + d * 0.06);
  }

  shoot(e, power = 21) {
    const p = this.posOf(e);
    const gx = e.dir * PITCH.L;
    const tz = rand(-PITCH.goalW + 0.4, PITCH.goalW - 0.4);
    const dx = gx - p.x;
    const dz = tz - p.z;
    const d = Math.hypot(dx, dz) || 1;
    const err = e.user ? 0.03 : 0.08;
    this.kick(e, { x: dx / d + rand(-err, err), z: dz / d + rand(-err, err) }, power, rand(1.5, 4.5));
  }

  updateBall(dt) {
    const B = this.ball;
    const { L, W } = PITCH;
    if (B.holder) {
      const h = B.holder;
      const p = this.posOf(h);
      const yaw = h.ch.root.rotation.y;
      B.pos.set(p.x + Math.sin(yaw) * 0.55, 0.11, p.z + Math.cos(yaw) * 0.55);
      B.vel.set(0, 0, 0);
      B.spin += dt * 12 * (h.user ? (this.player.vel.length() / 4) : (h.vel.length() / 4));
    } else {
      B.vel.y -= 9.8 * dt;
      B.pos.addScaledVector(B.vel, dt);
      if (B.pos.y < 0.11) {
        B.pos.y = 0.11;
        if (B.vel.y < -1.5) B.vel.y = -B.vel.y * 0.45; else B.vel.y = 0;
        const f = Math.max(0, 1 - 1.1 * dt);
        B.vel.x *= f;
        B.vel.z *= f;
      }
      B.spin += dt * Math.hypot(B.vel.x, B.vel.z) * 3;
      // goal posts and the net
      for (const s of [-1, 1]) {
        if (Math.abs(B.pos.x - s * L) < 0.15 && Math.abs(Math.abs(B.pos.z) - PITCH.goalW) < 0.15 && B.pos.y < PITCH.goalH) {
          B.vel.x *= -0.6;
          B.vel.z *= -0.6;
          Sfx.play('clank');
        }
        if (s * B.pos.x > L + 1.5) { B.pos.x = s * (L + 1.5); B.vel.multiplyScalar(0.2); }
      }
    }
    this.ballMesh.position.copy(B.pos);
    this.ballMesh.rotation.set(B.spin, B.spin * 0.3, 0);
    this.ballShadow.position.set(B.pos.x, 0.02, B.pos.z);
    if (this.state !== 'play' || B.holder) return;
    // goal?
    for (const s of [-1, 1]) {
      if (s * B.pos.x > L && Math.abs(B.pos.z) < PITCH.goalW && B.pos.y < PITCH.goalH) { this.goal(s > 0 ? 0 : 1); return; }
    }
    // out of play
    if (Math.abs(B.pos.z) > W + 0.3) this.restart('throw', B.pos.x, Math.sign(B.pos.z) * (W - 0.4));
    else if (Math.abs(B.pos.x) > L + 0.3) {
      const s = Math.sign(B.pos.x);
      const defending = s > 0 ? 1 : 0;
      if (B.last && B.last.team === defending) this.restart('corner', s * (L - 0.6), Math.sign(B.pos.z || 1) * (W - 0.6));
      else this.restart('goalkick', s * (L - 5.5), 0, defending);
    }
  }

  /** Give the ball to the right team after it went out. */
  restart(kind, x, z, team) {
    const B = this.ball;
    const last = B.last ? B.last.team : 0;
    const t = team != null ? team : 1 - last;
    const names = { throw: 'پرتاب اوت', corner: 'ضربه‌ی کرنر', goalkick: 'ضربه‌ی دروازه' };
    this.whistle(names[kind]);
    B.vel.set(0, 0, 0);
    B.pos.set(x, 0.11, z);
    let taker;
    if (kind === 'goalkick') taker = this.gks[t];
    else {
      let bd = Infinity;
      for (const e of this.allPlayers()) {
        if (e.team !== t || e.role === 'gk' || e.user) continue;
        const d = this.posOf(e).distanceTo(B.pos);
        if (d < bd) { bd = d; taker = e; }
      }
    }
    if (taker) {
      if (!taker.user) taker.ch.root.position.set(x - Math.sign(x || 1) * 0.4, 0, z - Math.sign(z || 1) * 0.4);
      B.holder = taker;
      B.last = taker;
      taker.kickCd = 0;
      taker.holdT = 0.8;
    }
  }

  goal(team) {
    this.score[team]++;
    this.state = 'goal';
    this.stateT = 3.5;
    this.lastScorer = this.ball.last;
    this.whistle(team === 0 ? 'گل! قرمزها زدن' : 'گل! آبی‌ها زدن', true);
    Sfx.play('cheer');
    for (const f of this.fans) if ((team === 0) === (f.side > 0) || Math.random() < 0.3) { f.ch.stopAction(); f.ch.play('cheer'); }
    for (const e of this.allPlayers()) if (e.team === team && e.ch && !e.ch.busy) e.ch.play(e.user ? 'e_victory' : 'cheer');
    this.fx.burst({ x: this.ball.pos.x, y: 1.5, z: this.ball.pos.z }, { count: 120, colors: team === 0 ? ['#e63946', '#ffffff', '#ffd34d'] : ['#2f6fed', '#ffd34d', '#ffffff'], speed: 6, up: 6, life: 1.6 });
    this.drawScoreboard();
    if (this.onGoal) this.onGoal(team, this.lastScorer);
  }

  /* ---------------- AI ---------------- */

  moveEnt(e, tx, tz, speed, dt) {
    const p = this.posOf(e);
    const dx = tx - p.x;
    const dz = tz - p.z;
    const d = Math.hypot(dx, dz);
    const want = d > 0.3 ? Math.min(speed, d * 2.5) : 0;
    const vx = d > 0.01 ? (dx / d) * want : 0;
    const vz = d > 0.01 ? (dz / d) * want : 0;
    e.vel.x += (vx - e.vel.x) * damp(6, dt);
    e.vel.y += (vz - e.vel.y) * damp(6, dt);
    if (e.ch.busy && e.ch.action.name !== 'fkick') e.vel.multiplyScalar(0.9);
    p.x += e.vel.x * dt;
    p.z += e.vel.y * dt;
    const sp = e.vel.length();
    if (sp > 0.3) e.ch.root.rotation.y = angleLerp(e.ch.root.rotation.y, Math.atan2(e.vel.x, e.vel.y), damp(10, dt));
    e.ch.speed = sp;
  }

  aiSpeed() { return 4.6 + Math.min(2.6, (this.diff || 1) / 60); }

  updateAI(dt) {
    const B = this.ball;
    const { L, W } = PITCH;
    const all = this.allPlayers();
    const holderTeam = B.holder ? B.holder.team : -1;
    // the closest outfield player of each team chases a loose or enemy ball
    const chaser = [null, null];
    for (const t of [0, 1]) {
      let bd = Infinity;
      for (const e of all) {
        if (e.team !== t || e.role === 'gk' || e.user) continue;
        const d = this.posOf(e).distanceTo(B.pos);
        if (d < bd) { bd = d; chaser[t] = e; }
      }
    }
    const speed = this.aiSpeed();
    for (const e of this.players) {
      e.kickCd -= dt;
      const p = this.posOf(e);
      if (e.role === 'gk') { this.updateKeeper(e, dt); continue; }
      if (B.holder === e) {
        e.holdT = (e.holdT || 0) - dt;
        const gx = e.dir * L;
        const dGoal = Math.hypot(gx - p.x, p.z);
        if (e.holdT <= 0 && dGoal < 14 && Math.random() < dt * 3) { this.shoot(e, rand(17, 23)); continue; }
        if (e.holdT <= 0 && (this.pressure(e) > 0 || Math.random() < dt * 0.35)) {
          const o = this.passTarget(e);
          if (o && Math.random() < dt * 4) { this.passTo(e, o); continue; }
        }
        this.moveEnt(e, gx, clamp(p.z * 0.6, -W + 2, W - 2), speed * 0.92, dt);
        continue;
      }
      let tx;
      let tz;
      if (holderTeam === e.team) {
        tx = clamp(e.home.x + e.dir * 12, -L + 3, L - 3);
        tz = e.home.z * 1.3;
      } else if (chaser[e.team] === e) {
        tx = B.pos.x + B.vel.x * 0.2;
        tz = B.pos.z + B.vel.z * 0.2;
      } else {
        tx = lerp(e.home.x, B.pos.x, 0.35);
        tz = lerp(e.home.z, B.pos.z, 0.25);
      }
      this.moveEnt(e, tx, tz, chaser[e.team] === e ? speed * 1.05 : speed * 0.8, dt);
      this.tryTake(e, dt);
    }
    // user possession and tackles
    if (this.player && this.userActive) {
      const u = this.userEnt;
      u.kickCd -= dt;
      this.tryTake(u, dt);
    }
    // keep players from overlapping
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = this.posOf(all[i]);
        const b = this.posOf(all[j]);
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d2 = dx * dx + dz * dz;
        if (d2 > 0.36 || d2 < 1e-6) continue;
        const d = Math.sqrt(d2);
        const k = (0.6 - d) / d * 0.5;
        if (!all[i].user) { a.x -= dx * k; a.z -= dz * k; }
        if (!all[j].user) { b.x += dx * k; b.z += dz * k; }
      }
    }
    for (const e of this.players) {
      const p = this.posOf(e);
      p.x = clamp(p.x, -L - 1, L + 1);
      p.z = clamp(p.z, -W - 1, W + 1);
      e.ch.update(dt);
    }
  }

  /** Pick up a loose ball, or steal it from an opponent who is close. */
  tryTake(e, dt) {
    const B = this.ball;
    if (e.kickCd > 0 || B.pos.y > 0.7) return;
    const p = this.posOf(e);
    const d = Math.hypot(B.pos.x - p.x, B.pos.z - p.z);
    if (!B.holder) {
      if (d < 0.75) { B.holder = e; B.last = e; e.holdT = rand(0.3, 1.0); if (e.user) Sfx.play('tap'); }
    } else if (B.holder.team !== e.team && d < 0.9 && !e.user) {
      const holderIsUser = B.holder.user;
      const chance = holderIsUser ? 0.9 * dt / Math.max(0.6, (this.userSkill || 1)) : 1.2 * dt;
      if (Math.random() < chance) {
        B.holder.kickCd = 0.7;
        B.holder = e;
        B.last = e;
        e.holdT = rand(0.2, 0.6);
        Sfx.play('punch');
      }
    }
  }

  updateKeeper(e, dt) {
    const B = this.ball;
    const { L } = PITCH;
    const gx = -e.dir * (L - 0.8);
    if (B.holder === e) {
      e.holdT = (e.holdT || 0) - dt;
      this.moveEnt(e, gx + e.dir * 1.5, 0, 2, dt);
      if (e.holdT <= 0) {
        const o = this.passTarget(e);
        if (o) this.passTo(e, o); else this.kick(e, { x: e.dir, z: rand(-0.3, 0.3) }, 20, 6);
      }
      return;
    }
    const tz = clamp(B.pos.z * 0.55, -PITCH.goalW + 0.6, PITCH.goalW - 0.6);
    this.moveEnt(e, gx, tz, 4, dt);
    // save attempts on shots coming at goal
    const p = this.posOf(e);
    const coming = (B.vel.x * -e.dir) > 3;
    const d = Math.hypot(B.pos.x - p.x, B.pos.z - p.z);
    if (!B.holder && coming && d < 2.3 && B.pos.y < 2.5 && e.kickCd <= 0) {
      const speed = Math.hypot(B.vel.x, B.vel.z);
      const userShot = B.last && B.last.user;
      const chance = clamp(1.15 - speed / 28 - (userShot ? (this.userSkill || 1) * 0.08 : 0), 0.15, 0.8);
      e.kickCd = 1.2;
      if (Math.random() < chance) {
        B.holder = e;
        B.last = e;
        e.holdT = 1.2;
        e.ch.stopAction();
        e.ch.play('gkdive');
        if (this.onEvent) this.onEvent('🧤 دروازه‌بان گرفت!');
      } else if (!e.ch.busy) e.ch.play('gkdive');
    } else if (d < 0.8 && !B.holder && e.kickCd <= 0) {
      B.holder = e;
      B.last = e;
      e.holdT = 1.0;
    }
  }

  updateRef(dt) {
    const B = this.ball;
    const R = this.ref;
    const p = R.ch.root.position;
    const tx = clamp(B.pos.x - 4, -PITCH.L + 4, PITCH.L - 4);
    const tz = clamp(B.pos.z + (B.pos.z > 0 ? -7 : 7), -PITCH.W + 1, PITCH.W - 1);
    const dx = tx - p.x;
    const dz = tz - p.z;
    const d = Math.hypot(dx, dz);
    const sp = d > 0.5 ? Math.min(4.2, d * 1.5) : 0;
    R.vel.x += ((d > 0.01 ? dx / d : 0) * sp - R.vel.x) * damp(4, dt);
    R.vel.y += ((d > 0.01 ? dz / d : 0) * sp - R.vel.y) * damp(4, dt);
    p.x += R.vel.x * dt;
    p.z += R.vel.y * dt;
    R.ch.speed = R.vel.length();
    if (R.ch.speed > 0.3) R.ch.root.rotation.y = angleLerp(R.ch.root.rotation.y, Math.atan2(R.vel.x, R.vel.y), damp(6, dt));
    else R.ch.root.rotation.y = angleLerp(R.ch.root.rotation.y, Math.atan2(B.pos.x - p.x, B.pos.z - p.z), damp(4, dt));
    R.ch.update(dt);
  }

  updateFans(dt) {
    this.fanTick = (this.fanTick + 1) % 2;
    for (let i = this.fanTick; i < this.fans.length; i += 2) {
      const f = this.fans[i];
      f.cheerT -= dt * 2;
      if (f.cheerT <= 0) {
        f.cheerT = rand(4, 14);
        if (!f.ch.busy) f.ch.play(pick(['cheer', 'e_clap', 'e_wave', 'fanclap']));
      }
      f.ch.update(dt * 2);
    }
  }

  drawScoreboard() {
    const [a, b] = this.score;
    const t = Math.max(0, Math.ceil(this.clock));
    redrawCanvasTexture(this.boardTex, (ctx, w, h) => {
      ctx.fillStyle = '#05070f';
      ctx.fillRect(0, 0, w, h);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#e63946';
      ctx.fillRect(40, 60, 300, 180);
      ctx.fillStyle = '#2f6fed';
      ctx.fillRect(w - 340, 60, 300, 180);
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold 150px ${UI_FONT}`;
      ctx.fillText(fa(a), 190, 156);
      ctx.fillText(fa(b), w - 190, 156);
      ctx.fillStyle = '#ffd34d';
      ctx.font = `bold 90px ${UI_FONT}`;
      ctx.fillText(fa(`${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`), w / 2, 150);
      ctx.direction = 'rtl';
      ctx.font = `600 40px ${UI_FONT}`;
      ctx.fillStyle = '#ffffff';
      ctx.fillText('قرمز', 190, 300);
      ctx.fillText('آبی', w - 190, 300);
      ctx.fillStyle = '#7fe0ff';
      ctx.fillText(this.state === 'over' ? 'پایان بازی' : 'زنده', w / 2, 300);
    });
  }

  /** One frame of the match. */
  match(dt) {
    this.diff = this.playerLevel || 20;
    if (this.state === 'kickoff') {
      this.stateT -= dt;
      if (this.stateT <= 0) { this.state = 'play'; this.whistle('شروع!'); }
    } else if (this.state === 'goal') {
      this.stateT -= dt;
      if (this.stateT <= 0) {
        this.resetKickoff(this.score[0] > this.score[1] ? 1 : 0);
        this.state = 'kickoff';
        this.stateT = 2;
      }
    } else if (this.state === 'play') {
      this.clock -= dt;
      if (this.clock <= 0) {
        this.clock = 0;
        this.state = 'over';
        this.stateT = 8;
        this.whistle('پایان بازی', true);
        Sfx.play('cheer');
        if (this.onOver) this.onOver(this.score);
      }
    } else if (this.state === 'over') {
      this.stateT -= dt;
      if (this.stateT <= 0) {
        this.score = [0, 0];
        this.clock = MATCH_SECONDS;
        this.resetKickoff(0);
        this.state = 'kickoff';
        this.stateT = 3;
      }
    }
    if (this.state === 'play') this.updateAI(dt);
    else {
      for (const e of this.players) {
        e.vel.multiplyScalar(0.85);
        e.ch.speed = e.vel.length();
        e.ch.update(dt);
      }
    }
    this.updateBall(dt);
    this.updateRef(dt);
    this.updateFans(dt);
    this.boardT = (this.boardT || 0) + dt;
    if (this.boardT > 0.5) { this.boardT = 0; this.drawScoreboard(); }
  }

  updateExtra(dt) {
    super.updateExtra(dt);
    this.homeRing.rotation.z += dt;
    this.match(dt);
  }

  /** Watching on a screen with nobody playing: the AI teams play on. */
  simulateExtra(dt) {
    this.userActive = false;
    if (this.ball.holder && this.ball.holder.user) this.ball.holder = null;
    super.updateExtra(dt);
    this.match(dt);
  }

  nearHome() {
    const p = this.player.ch.root.position;
    return Math.hypot(p.x - this.home.x, p.z - this.home.z) < 2.4;
  }

  /* ---------------- the player's actions ---------------- */

  userShoot() {
    const u = this.userEnt;
    const B = this.ball;
    if (this.state !== 'play') return;
    if (B.holder === u) {
      const yaw = this.player.ch.root.rotation.y;
      const p = this.player.ch.root.position;
      const toGoal = Math.atan2(PITCH.L - p.x, -p.z);
      const aim = Math.abs(wrapAngle(toGoal - yaw)) < 1.0 && PITCH.L - p.x < 26;
      if (aim) this.shoot(u, 18 + Math.min(10, (this.userSkill || 1) * 3));
      else this.kick(u, { x: Math.sin(yaw), z: Math.cos(yaw) }, 20, 3);
      return;
    }
    // tackle: steal the ball from a nearby opponent
    if (B.holder && B.holder.team !== 0) {
      const p = this.player.ch.root.position;
      const q = this.posOf(B.holder);
      if (Math.hypot(q.x - p.x, q.z - p.z) < 1.6) {
        if (!this.player.ch.busy) this.player.ch.play('fkick');
        if (Math.random() < 0.55 + Math.min(0.35, (this.userSkill || 1) * 0.08)) {
          B.holder.kickCd = 0.8;
          B.holder = u;
          B.last = u;
          Sfx.play('punch');
          if (this.onEvent) this.onEvent('💪 توپ رو گرفتی!');
        } else if (this.onEvent) this.onEvent('تکل نگرفت!');
      }
    } else if (!B.holder && this.player.ch.root.position.distanceTo(B.pos) < 1.6) {
      const yaw = this.player.ch.root.rotation.y;
      this.kick(u, { x: Math.sin(yaw), z: Math.cos(yaw) }, 18, 3);
    }
  }

  userPass() {
    const u = this.userEnt;
    if (this.state !== 'play' || this.ball.holder !== u) return;
    const yaw = this.player.ch.root.rotation.y;
    const p = this.player.ch.root.position;
    let best = null;
    let bs = -Infinity;
    for (const o of this.players) {
      if (o.team !== 0 || o.role === 'gk') continue;
      const q = this.posOf(o);
      const a = Math.atan2(q.x - p.x, q.z - p.z);
      const s = -Math.abs(wrapAngle(a - yaw)) * 3 - Math.hypot(q.x - p.x, q.z - p.z) * 0.05;
      if (s > bs) { bs = s; best = o; }
    }
    if (best) this.passTo(u, best);
  }
}

ENV_BUILDERS.football = () => new FootballWorld();
