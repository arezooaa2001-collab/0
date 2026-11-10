/* ============================ BOSS ROOMS ============================ */
// Four levels end their run of rooms with a boss arena. The boss attacks in turns (spike shockwaves along the
// floor, lobbed saws, rocks falling where you stand); three red buttons each drop a weight on its head. After the
// third hit it falls apart and the stone gate behind it opens. Everything is time-driven and deterministic, so the
// auto-solver checks boss rooms like any other room.
const BOSSES = {
  golem:  { n: 'غول سنگی', col: '#8a8aa8', eye: '#ff5d3a', atks: ['wave', 'rock', 'wave', 'saw'], gap: 2.7 },
  spider: { n: 'عنکبوت آهنی', col: '#5a6a8a', eye: '#7af7ff', atks: ['saw', 'wave', 'saw', 'rock'], gap: 2.5 },
  dragon: { n: 'اژدهای آتش', col: '#a8443a', eye: '#ffd36e', atks: ['rock', 'saw', 'wave', 'rock'], gap: 2.4 },
  king:   { n: 'پادشاه تله‌ها', col: '#6a3a8a', eye: '#ff3d71', atks: ['wave', 'saw', 'rock', 'wave', 'rock', 'saw'], gap: 2.2 },
};
// the arena: 34 tiles, floor at row 15 (starts and ends on the ground like every room)
function bossArena(kind) {
  return { boss: kind, w: 34, t0: TOP_MAX, spawn: [1, TOP_MAX - 1], build: P => {
    const B = BOSSES[kind];
    P.block(null, 0, 15, 34, 3);
    P.block(null, 2, 0, 31, 1, { ceil: true, rock: true });
    P.block(null, 10.5, 12.4, 4, .6); P.block(null, 17, 9.9, 3.5, .6);
    const gate = P.block('gate', 32.6, 1, 1.4, 14);
    const waves = [0, 1].map(i => P.spikes('bw' + i, 25, 14, 1, 'up', { hidden: true }));
    const saws = [0, 1].map(i => P.saw('bs' + i, 26, 12, .55, { hidden: true }));
    const rocks = [0, 1, 2].map(i => P.spikes('br' + i, 10, 1, 1, 'down', { hidden: true, fallV: 120 }));
    const boss = P.add('boss', { type: 'boss', kind, name: B.n, x: 26.6 * T, y: 10.2 * T, w: 4.8 * T, h: 4.8 * T, hp: 3, bt: 1.4, bp: 0, stun: 0, awake: 0, anim: 0, hurt: 0, dead: 0,
      atks: B.atks, gap: B.gap, waves, saws, rocks, gate });
    // three red buttons, each drops a weight on the boss
    [[7, 15], [12, 12.4], [18.3, 9.9]].forEach(([x, y], i) => {
      const wgt = P.block('wt' + i, 27.6 + i * .5, 1, 2, 1.4, { hidden: true, fallV: 260 });
      P.zone('pl' + i, 'plate', x, y - .25, 1, .25);
      P.trig(x, y - 1, 1, 1, () => {
        P.pop(wgt); P.fall(wgt, .05); P.sfx('rumble');
        P.after(.42, () => { if (boss.hp > 0) { boss.hp--; boss.stun = 1.1; boss.hurt = 1; P.shake(12); P.sfx('thud'); P.say(boss.hp ? `${boss.name}: ${'❤️'.repeat(boss.hp)}` : `${boss.name} شکست خورد! 🏆`); } });
      }, { ground: true });
    });
  } };
}
// per-step boss logic (called from World.updEnt)
World.prototype.updBoss = function (e, dt) {
  e.anim = Math.max(0, e.anim - dt * 2); e.hurt = Math.max(0, e.hurt - dt * 2.5);
  for (const w of e.waves) if (!w.hidden && !w.moves.length) { w.hidden = true; w.pop = 0; }
  for (const s of e.saws) if (!s.hidden && !s.moves.length) s.hidden = true;
  if (e.hp <= 0) {
    if (!(e.dead > 0)) { e.dead = .001; this.sfx('crack'); this.shake(16); for (const w of e.waves.concat(e.saws)) { w.hidden = true; w.moves = []; } }
    e.dead += dt; if (Math.random() < .5 && !this.silent) this.burst(e.x + Math.random() * e.w, e.y + Math.random() * e.h, 3, { col: BOSSES[e.kind].col, sp: 200, life: .6, size: 4, g: 600, sq: true });
    if (e.dead > 1.2 && !e.gone) { e.gone = true; if (this.onBoss) this.onBoss(e); this.lv.move(e.gate, 0, -16, 6); this.sfx('win'); this.burst(e.x + e.w / 2, e.y + e.h / 2, 40, { col: '#ffd36e', sp: 320, life: .9, add: true, size: 3 }); }
    return;
  }
  if (!e.awake) { if (this.p.x > e.x - 21 * T && this.state === 'play') { e.awake = 1; this.sfx('roar'); this.shake(6); this.say(e.name + ' بیدار شد!'); } else return; }
  if (e.stun > 0) { e.stun -= dt; return; }
  e.bt -= dt; if (e.bt > 0) return;
  const atk = e.atks[e.bp % e.atks.length]; e.bp++; e.anim = 1;
  e.bt = (e.gap - (3 - e.hp) * .3) * this.D.trapT;
  const L = this.lv;
  if (atk === 'wave') {
    const w = e.waves.find(q => q.hidden); if (!w) return;
    w.x = e.x - T; w.y = 14 * T; w.hidden = false; w.pop = 1; w.moves = []; L.move(w, -(w.x / T - (e.x / T - 25)), 0, 8);
    this.sfx('thud'); this.shake(5);
  } else if (atk === 'saw') {
    const s = e.saws.find(q => q.hidden); if (!s) return;
    s.x = e.x; s.y = 12 * T; s.hidden = false; s.moves = []; L.move(s, -6, -2.6, 7); L.move(s, -6, 2.9, 9); L.move(s, -14, 0, 6.5);
    this.sfx('whoosh');
  } else if (atk === 'rock') {
    const px = clamp(this.p.x / T, e.x / T - 24, e.x / T - 3), offs = [-2.2, 0, 2.4];
    e.rocks.forEach((r, i) => { r.gone = false; r.falling = false; r.vy = 0; r.moves = []; r.x = (px + offs[i] - .5 + (e.bp % 2) * .6) * T; r.y = 1 * T; r.hidden = false; r.pop = 1; L.fall(r, .65 + i * .12); });
    this.sfx('crack');
  }
};

/* ---------- drawing (2D views) ---------- */
function drawBoss(e, t, world) {
  const B = BOSSES[e.kind], x = e.x, y = e.y, w = e.w, h = e.h, die = e.hp <= 0 ? Math.min(1, e.dead / 1.2) : 0;
  const shakeX = e.stun > 0 || die ? Math.sin(t * 60) * 3 : 0, bob = e.awake ? Math.sin(t * 2.4) * 3 : 0;
  ctx.save(); ctx.translate(x + w / 2 + shakeX, y + h + bob); ctx.globalAlpha = 1 - die * .8; ctx.scale(1 + die * .15, 1 - die * .5);
  if (glowK() > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .35; ctx.drawImage(TEX.gRose, -w, -h * 1.4, w * 2, h * 1.6); ctx.restore(); }
  const base = B.col, dark = mixHex(base, '#000000', .45), lite = mixHex(base, '#ffffff', .25);
  // legs, body, arms
  ctx.fillStyle = dark; ctx.fillRect(-w * .38, -h * .22, w * .26, h * .22); ctx.fillRect(w * .12, -h * .22, w * .26, h * .22);
  const gr = ctx.createLinearGradient(0, -h, 0, -h * .2); gr.addColorStop(0, lite); gr.addColorStop(1, dark);
  ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-w * .46, -h * .92, w * .92, h * .74, 18) : ctx.rect(-w * .46, -h * .92, w * .92, h * .74); ctx.fill();
  const lift = e.anim * h * .25;
  ctx.fillStyle = base; ctx.save(); ctx.translate(-w * .46, -h * .7); ctx.rotate(-.5 - e.anim * .9); ctx.fillRect(-w * .2, -h * .08, w * .22, h * .45 + lift * .2); ctx.restore();
  ctx.save(); ctx.translate(w * .46, -h * .7); ctx.rotate(.5 + e.anim * .9); ctx.fillRect(-w * .02, -h * .08, w * .22, h * .45 + lift * .2); ctx.restore();
  // cracks grow as it takes hits
  ctx.strokeStyle = 'rgba(20,10,20,.6)'; ctx.lineWidth = 3; ctx.beginPath();
  for (let k = 0; k < 3 - Math.max(0, e.hp); k++) { const cx = (-.25 + k * .25) * w; ctx.moveTo(cx, -h * .9); ctx.lineTo(cx + 12, -h * .7); ctx.lineTo(cx - 6, -h * .52); ctx.lineTo(cx + 8, -h * .35); }
  ctx.stroke();
  // face: eyes look at you
  const look = clamp((world.p.x - (x + w / 2)) / 300, -1, 1) * 6, eyeC = e.stun > 0 ? '#ffffff' : B.eye;
  for (const s of [-1, 1]) { ctx.fillStyle = '#1a0f1a'; ctx.beginPath(); ctx.ellipse(s * w * .17, -h * .7, w * .1, h * .07, 0, 0, 7); ctx.fill();
    ctx.fillStyle = eyeC; ctx.beginPath(); ctx.arc(s * w * .17 + look, -h * .7, w * .045, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#1a0f1a'; ctx.fillRect(-w * .16, -h * .5 + e.anim * 6, w * .32, h * .06 + e.anim * 10);
  if (e.kind === 'king' || e.kind === 'dragon') { ctx.fillStyle = e.kind === 'king' ? '#ffd36e' : '#ff8a3d'; ctx.beginPath(); ctx.moveTo(-w * .3, -h * .92); for (let k = 0; k <= 4; k++) { ctx.lineTo(-w * .3 + k * w * .15, -h * (k % 2 ? 1.04 : 1.16)); } ctx.lineTo(w * .3, -h * .92); ctx.fill(); }
  if (e.kind === 'spider') { ctx.strokeStyle = dark; ctx.lineWidth = 6; for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(s * w * .4, -h * (.4 + k * .12)); ctx.lineTo(s * w * .7, -h * (.6 + k * .1)); ctx.lineTo(s * w * .8, -h * .05 * k); ctx.stroke(); } }
  if (e.hurt > 0) { ctx.globalAlpha = e.hurt * .75; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-w * .46, -h * .92, w * .92, h * .74, 18) : ctx.rect(-w * .46, -h * .92, w * .92, h * .74); ctx.fill(); ctx.globalAlpha = 1 - die * .8; }
  if (e.stun > 0) { ctx.fillStyle = '#ffd36e'; for (let k = 0; k < 3; k++) { const a = t * 5 + k * 2.1; ctx.beginPath(); ctx.arc(Math.cos(a) * w * .3, -h * 1.02 + Math.sin(a) * 6, 5, 0, 7); ctx.fill(); } }
  ctx.restore();
  // hearts over its head while it fights
  if (e.hp > 0 && e.awake) { ctx.font = '22px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ff5d8a'; for (let k = 0; k < 3; k++) { ctx.globalAlpha = k < e.hp ? 1 : .2; ctx.beginPath(); const hx = x + w / 2 + (k - 1) * 26, hy = y - 26; ctx.arc(hx - 5, hy, 6, 0, 7); ctx.arc(hx + 5, hy, 6, 0, 7); ctx.moveTo(hx - 11, hy + 2); ctx.lineTo(hx, hy + 14); ctx.lineTo(hx + 11, hy + 2); ctx.fill(); } ctx.globalAlpha = 1; }
}
