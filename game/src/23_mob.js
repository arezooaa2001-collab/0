/* ============================ MONSTERS ============================ */
// Little walkers and flyers. Jump on their heads to squash them (you bounce up); touch them from the side and you die.
// Walkers fall onto the floor and turn around at walls and at the edge of their floor; flyers sway along a short path.
// Everything depends only on time and the level, so the robot can plan around them like any other trap.
function mobSolidAt(w, x, y) { for (const s of w.act) if (w.isSolid(s) && !s.oneway && x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return s; return null; }
World.prototype.updMob = function (e, dt) {
  if (e.dead > 0) { e.dead += dt; if (e.dead > .55) e.gone = true; return; }
  e.lt = (e.lt || 0) + dt;
  if (e.kind === 'fly') { e.x = e.x0 + Math.sin(e.lt * e.sp) * e.range; e.y = e.y0 + Math.sin(e.lt * 2.6) * 10; e.vx = Math.cos(e.lt * e.sp) >= 0 ? 1 : -1; return; }
  e.vy = Math.min(900, (e.vy || 0) + 2000 * dt); let ny = e.y + e.vy * dt;
  const below = mobSolidAt(this, e.x + e.w / 2, ny + e.h);
  if (below && e.vy >= 0 && e.y + e.h <= below.y + 12) { ny = below.y - e.h; e.vy = 0; e.onG = true; } else e.onG = false;
  e.y = ny;
  if (e.onG) {
    const dir = e.vx >= 0 ? 1 : -1, nx = e.x + dir * e.spd * dt, front = dir > 0 ? nx + e.w : nx;
    const wall = mobSolidAt(this, front + dir, e.y + e.h * .5), floor = mobSolidAt(this, front + dir * 2, e.y + e.h + 4);
    if (wall || !floor) e.vx = -dir; else { e.x = nx; e.vx = dir; }
  }
  if (e.y > H + 120) e.gone = true;
};
// the player against a monster: from above it is squashed, otherwise the player dies
World.prototype.mobHit = function (e) {
  const p = this.p, g = p.g, box = { x: e.x + 4, y: e.y + 4, w: e.w - 8, h: e.h - 6 };
  if (!hit(p, box)) return false;
  const feet = g > 0 ? p.y + PHT : p.y, top = g > 0 ? e.y : e.y + e.h;
  if (p.vy * g > 30 && (g > 0 ? feet - top : top - feet) < e.h * .65) {
    e.dead = .001; p.vy = -PH.jump * .8 * g; p.onGround = false; p.ground = null; p.jumping = true; p.coy = 0;
    this.sfx('pop'); this.shake(4); this.burst(e.x + e.w / 2, e.y + e.h / 2, 16, { col: e.kind === 'fly' ? '#c59bff' : '#b47cff', sp: 220, life: .5, size: 3.5, g: 600, sq: true });
    if (!this.silent) this.parts.push({ x: e.x + e.w / 2, y: e.y - 8, vx: 0, vy: -50, life: .8, max: .8, size: 0, col: '#ffd36e', g: 0, drag: 0, txt: 'له شد! 🥾' });
    if (this.onStomp) this.onStomp(e);
    return false;
  }
  return true;
};
// a placed monster (x, y: the cell, in tiles, local to the section builder P)
function mobAdd(P, id, x, y, fly) {
  const e = fly ? P.add(id, { type: 'mob', kind: 'fly', x: (x + .1) * T, y: (y + .15) * T, w: .8 * T, h: .62 * T, range: 2.5 * T, sp: 1.3 * P.D.trapV, vx: 1, vy: 0, dead: 0 })
    : P.add(id, { type: 'mob', kind: 'walk', x: (x + .1) * T, y: (y + .3) * T, w: .8 * T, h: .7 * T, spd: 1.6 * T * P.D.trapV, vx: -1, vy: 0, dead: 0 });
  e.x0 = e.x; e.y0 = e.y; e.dyn = true; return e;
}
/* ---------- drawing (2D views) ---------- */
function drawMob(e, t) {
  const d = e.dead > 0 ? Math.min(1, e.dead / .5) : 0, cx = e.x + e.w / 2, by = e.y + e.h, dir = e.vx >= 0 ? 1 : -1;
  ctx.save(); ctx.globalAlpha = 1 - d * .9; ctx.translate(cx, by); ctx.scale(1 + d * .5, 1 - d * .75);
  if (e.kind === 'fly') {
    const fl = Math.sin(t * 18 + e.x * .01) * .7, h = e.h;
    ctx.fillStyle = '#3a1f5e';
    for (const s of [-1, 1]) { ctx.save(); ctx.translate(s * 8, -h * .6); ctx.rotate(s * (fl - .2)); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(s * 14, -10, s * 22, -2); ctx.quadraticCurveTo(s * 16, 0, s * 18, 6); ctx.quadraticCurveTo(s * 10, 3, 0, 4); ctx.closePath(); ctx.fill(); ctx.restore(); }
    const gr = ctx.createRadialGradient(-3, -h * .7, 2, 0, -h * .55, 13); gr.addColorStop(0, '#a87adf'); gr.addColorStop(1, '#4a2a7a');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(0, -h * .55, 11, 10, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#4a2a7a'; ctx.beginPath(); ctx.moveTo(-7, -h * .9); ctx.lineTo(-4, -h * 1.15); ctx.lineTo(-1, -h * .92); ctx.moveTo(7, -h * .9); ctx.lineTo(4, -h * 1.15); ctx.lineTo(1, -h * .92); ctx.fill();
    ctx.fillStyle = '#ff3d71'; ctx.beginPath(); ctx.arc(-4 + dir * 1.5, -h * .6, 2.4, 0, 7); ctx.arc(4 + dir * 1.5, -h * .6, 2.4, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-3, -h * .38); ctx.lineTo(-1.5, -h * .3); ctx.lineTo(0, -h * .38); ctx.moveTo(0, -h * .38); ctx.lineTo(1.5, -h * .3); ctx.lineTo(3, -h * .38); ctx.fill();
  } else {
    const step = e.onG && !d ? Math.sin(e.lt * 14) : 0, h = e.h;
    ctx.fillStyle = '#2a1640'; ctx.beginPath(); ctx.ellipse(-7 + step * 3, -2, 5, 3, 0, 0, 7); ctx.ellipse(7 - step * 3, -2, 5, 3, 0, 0, 7); ctx.fill();
    const gr = ctx.createLinearGradient(0, -h, 0, 0); gr.addColorStop(0, '#c08cff'); gr.addColorStop(1, '#6a3aa8');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(-15, -3); ctx.quadraticCurveTo(-16, -h - 2 + Math.abs(step) * 2, 0, -h - 3); ctx.quadraticCurveTo(16, -h - 2 + Math.abs(step) * 2, 15, -3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd36e'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 5, -h + 1); ctx.lineTo(s * 9, -h - 7); ctx.lineTo(s * 10, -h + 3); ctx.fill(); }
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(-5 + dir * 2, -h * .58, 4, 4.6, 0, 0, 7); ctx.ellipse(5 + dir * 2, -h * .58, 4, 4.6, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#1a0f26'; ctx.beginPath(); ctx.arc(-5 + dir * 3.5, -h * .56, 2.1, 0, 7); ctx.arc(5 + dir * 3.5, -h * .56, 2.1, 0, 7); ctx.fill();
    ctx.strokeStyle = '#1a0f26'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-9 + dir * 2, -h * .8); ctx.lineTo(-2 + dir * 2, -h * .7); ctx.moveTo(9 + dir * 2, -h * .8); ctx.lineTo(2 + dir * 2, -h * .7); ctx.stroke();
    ctx.fillStyle = '#1a0f26'; ctx.beginPath(); ctx.ellipse(dir * 2, -h * .3, 4, 2 + Math.abs(step), 0, 0, 7); ctx.fill();
  }
  ctx.restore();
}
