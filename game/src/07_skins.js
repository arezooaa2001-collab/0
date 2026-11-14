/* ============================ SKINS (bought with gems in the shop) ============================ */
// Body colours, hats and trails. Gems collected in any level are the money; ST.spent tracks what was spent.
const SKINS = {
  color: [
    { id: 'classic', n: 'کلاسیک', i: '🥚', p: 0 }, { id: 'mint', n: 'نعنایی', i: '🌿', p: 40, c: '#8ff0c8' }, { id: 'ice', n: 'یخی', i: '🧊', p: 70, c: '#bfe8ff' },
    { id: 'ruby', n: 'یاقوتی', i: '❤️', p: 60, c: '#ff7a8a' }, { id: 'shadow', n: 'سایه', i: '🖤', p: 90, c: '#6a5a8a' }, { id: 'gold', n: 'طلایی', i: '🏅', p: 120, c: '#ffd36e' },
    { id: 'galaxy', n: 'کهکشانی', i: '🌌', p: 200, c: '#b18cff', anim: true },
    { id: 'neon', n: 'نئونی', i: '💚', p: 0, lvl: 2, c: '#39ffb4' }, { id: 'aurora', n: 'شفق قطبی', i: '🌠', p: 0, lvl: 15, c: '#7affc8', anim: 'aurora' },
  ],
  hat: [
    { id: 'none', n: 'بدون کلاه', i: '🌱', p: 0 }, { id: 'cap', n: 'کلاه کپ', i: '🧢', p: 30 }, { id: 'party', n: 'کلاه جشن', i: '🎉', p: 50 },
    { id: 'horns', n: 'شاخ شیطون', i: '😈', p: 80 }, { id: 'halo', n: 'هاله‌ی فرشته', i: '😇', p: 100 }, { id: 'tophat', n: 'کلاه شاپو', i: '🎩', p: 120 },
    { id: 'crown', n: 'تاج پادشاهی', i: '👑', p: 150 }, { id: 'wizard', n: 'کلاه جادوگر', i: '🧙', p: 180 },
    { id: 'viking', n: 'کلاه وایکینگ', i: '⚔️', p: 0, lvl: 6 }, { id: 'ninja', n: 'سربند نینجا', i: '🥷', p: 0, lvl: 18 },
  ],
  trail: [
    { id: 'none', n: 'بدون رد', i: '·', p: 0 }, { id: 'sparkle', n: 'ستاره‌ریز', i: '✨', p: 60 }, { id: 'bubbles', n: 'حباب', i: '🫧', p: 70 },
    { id: 'hearts', n: 'قلب', i: '💖', p: 90 }, { id: 'fire', n: 'آتش', i: '🔥', p: 100 }, { id: 'rainbow', n: 'رنگین‌کمون', i: '🌈', p: 160 },
    { id: 'snow', n: 'دونه‌ی برف', i: '❄️', p: 0, lvl: 4 }, { id: 'bolt', n: 'صاعقه', i: '⚡', p: 0, lvl: 12 },
  ],
  // a little friend that flies with you and fetches gems near you
  pet: [
    { id: 'none', n: 'بدون همراه', i: '·', p: 0 }, { id: 'cat', n: 'گربه', i: '🐱', p: 80, c: '#ffb36b' }, { id: 'bird', n: 'پرنده', i: '🐦', p: 90, c: '#7af7ff' },
    { id: 'ghost', n: 'روح کوچولو', i: '👻', p: 110, c: '#efe8ff' }, { id: 'star', n: 'ستاره', i: '⭐', p: 130, c: '#ffd36e' }, { id: 'robot', n: 'ربات', i: '🤖', p: 150, c: '#a8b4d8' },
    { id: 'dragon', n: 'اژدها', i: '🐲', p: 200, c: '#6ff3a4' },
    { id: 'phoenix', n: 'ققنوس', i: '🔥', p: 0, lvl: 10, c: '#ff8a3a' }, { id: 'ufo', n: 'بشقاب‌پرنده', i: '🛸', p: 0, lvl: 20, c: '#9ef9ff' },
  ],
  // what happens when you die
  boom: [
    { id: 'classic', n: 'کلاسیک', i: '💥', p: 0 }, { id: 'confetti', n: 'کاغذ رنگی', i: '🎉', p: 60 }, { id: 'hearts', n: 'قلب‌ها', i: '💕', p: 70 },
    { id: 'pixel', n: 'پیکسلی', i: '👾', p: 80 }, { id: 'soul', n: 'روح پرواز', i: '👼', p: 90 }, { id: 'firework', n: 'آتیش‌بازی', i: '🎆', p: 120 },
    { id: 'blackhole', n: 'سیاه‌چاله', i: '🕳️', p: 0, lvl: 8 }, { id: 'nova', n: 'ابرنواختر', i: '🌟', p: 0, lvl: 25 },
  ],
};
const petOn = () => skinOf('pet').id !== 'none';
// the pet: follows you, or flies to a gem close to you and brings it (world.pet holds its position)
function petStep(world, dt) {
  if (world.silent || !petOn()) { world.pet = null; return; }
  const p = world.p, P = world.pet || (world.pet = { x: p.x, y: p.y - 40, face: 1, gem: null });
  let tx = p.x + PW / 2 - p.face * 30, ty = p.y - 26 + Math.sin(world.time * 3) * 6;
  if (!P.gem || P.gem.gone) { P.gem = null; let best = 150; for (const e of world.act) if (e.type === 'gem' && !e.gone) { const d = Math.hypot(e.x - (p.x + PW / 2), e.y - (p.y + PHT / 2)); if (d < best) { best = d; P.gem = e; } } }
  if (P.gem) { tx = P.gem.x; ty = P.gem.y; }
  const k = Math.min(1, dt * (P.gem ? 9 : 6)); P.face = tx > P.x ? 1 : -1; P.x += (tx - P.x) * k; P.y += (ty - P.y) * k;
  if (P.gem && Math.hypot(P.gem.x - P.x, P.gem.y - P.y) < 16) { world.grabGem(P.gem); P.gem = null; }
}
function drawPet(world, t) {
  const P = world.pet; if (!P) return;
  const id = skinOf('pet').id, c = skinOf('pet').c, g = ctx, f = P.face;
  g.save(); g.translate(P.x, P.y + Math.sin(t * 5) * 2); g.scale(f, 1);
  if (glowK() > 0) { g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = .4; g.drawImage(TEX.gCyan, -24, -24, 48, 48); g.restore(); }
  const eyes = (x, y) => { g.fillStyle = '#1a1030'; g.beginPath(); g.arc(x - 3.5, y, 2, 0, 7); g.arc(x + 3.5, y, 2, 0, 7); g.fill(); };
  g.fillStyle = c;
  if (id === 'cat') { g.beginPath(); g.arc(0, 0, 9, 0, 7); g.fill(); g.beginPath(); g.moveTo(-8, -4); g.lineTo(-7, -14); g.lineTo(-2, -8); g.moveTo(8, -4); g.lineTo(7, -14); g.lineTo(2, -8); g.fill(); g.strokeStyle = c; g.lineWidth = 3; g.beginPath(); g.moveTo(-8, 4); g.quadraticCurveTo(-18, 6, -16, -4 + Math.sin(t * 6) * 3); g.stroke(); eyes(2, -1); }
  else if (id === 'bird') { g.beginPath(); g.ellipse(0, 0, 9, 7, 0, 0, 7); g.fill(); g.fillStyle = mixHex(c, '#000000', .2); g.beginPath(); g.ellipse(-3, -2 + Math.sin(t * 22) * 4, 6, 3, -.4, 0, 7); g.fill(); g.fillStyle = '#ffb347'; g.beginPath(); g.moveTo(8, -1); g.lineTo(13, 1); g.lineTo(8, 3); g.fill(); eyes(4, -2); }
  else if (id === 'ghost') { g.globalAlpha = .85; g.beginPath(); g.arc(0, -2, 9, Math.PI, 0); g.lineTo(9, 9); for (let k = 0; k < 4; k++) g.lineTo(9 - (k + .5) * 4.5, 9 - (k % 2 ? 0 : 4) + Math.sin(t * 8 + k) * 1.5); g.lineTo(-9, 9); g.closePath(); g.fill(); g.globalAlpha = 1; eyes(1, -2); }
  else if (id === 'star') { g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5 + t, r = k % 2 ? 4.5 : 11; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); eyes(0, 0); }
  else if (id === 'robot') { g.fillRect(-8, -8, 16, 15); g.fillStyle = '#2a2547'; g.fillRect(-6, -5, 12, 6); g.fillStyle = '#7af7ff'; g.fillRect(-4, -3, 3, 2); g.fillRect(1, -3, 3, 2); g.strokeStyle = c; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -8); g.lineTo(0, -13); g.stroke(); g.fillStyle = '#ff5d8a'; g.beginPath(); g.arc(0, -14, 2.2, 0, 7); g.fill(); }
  else if (id === 'phoenix') {
    if (glowK() > 0) { g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = .7; g.drawImage(TEX.gGold, -26, -22, 52, 44); g.restore(); }
    g.fillStyle = '#ffb347'; g.beginPath(); g.moveTo(-8, 2); g.quadraticCurveTo(-22, 6 + Math.sin(t * 9) * 4, -26, -6 + Math.sin(t * 7) * 3); g.quadraticCurveTo(-16, 0, -8, -3); g.fill();
    g.fillStyle = c; g.beginPath(); g.ellipse(0, 0, 9, 7, 0, 0, 7); g.fill();
    g.fillStyle = '#ffd36e'; g.beginPath(); g.moveTo(-2, -3); g.lineTo(-9, -15 - Math.sin(t * 20) * 5); g.lineTo(4, -5); g.fill();
    g.fillStyle = '#ff5d3a'; g.beginPath(); g.moveTo(3, -6); g.lineTo(5, -13); g.lineTo(8, -6); g.fill();
    g.fillStyle = '#ffe28a'; g.beginPath(); g.moveTo(9, 0); g.lineTo(14, 1); g.lineTo(9, 3); g.fill(); eyes(4, -1);
    if (world.parts && !world.silent && Math.random() < .3) world.parts.push({ x: P.x - f * 14, y: P.y + 2, vx: -f * 30, vy: -20 - Math.random() * 30, life: .5, max: .5, size: 3, col: Math.random() < .5 ? '#ff7a2a' : '#ffd36e', g: 0, drag: 1.5, add: true });
  }
  else if (id === 'ufo') {
    if (glowK() > 0) { g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = .25 + Math.sin(t * 6) * .1; g.fillStyle = '#9ef9ff'; g.beginPath(); g.moveTo(-6, 4); g.lineTo(6, 4); g.lineTo(12, 30); g.lineTo(-12, 30); g.fill(); g.restore(); }
    g.fillStyle = 'rgba(190,240,255,.75)'; g.beginPath(); g.arc(0, -3, 7, Math.PI, 0); g.fill(); eyes(0, -4);
    g.fillStyle = '#8a96b8'; g.beginPath(); g.ellipse(0, 0, 15, 5, 0, 0, 7); g.fill();
    for (let k = 0; k < 4; k++) { g.fillStyle = Math.floor(t * 6 + k) % 2 ? '#ffd36e' : '#ff5d8a'; g.beginPath(); g.arc(-10 + k * 6.6, 1, 1.6, 0, 7); g.fill(); }
  }
  else if (id === 'dragon') { g.beginPath(); g.ellipse(0, 0, 10, 7, 0, 0, 7); g.fill(); g.fillStyle = mixHex(c, '#000000', .25); g.beginPath(); g.moveTo(-2, -4); g.lineTo(-10, -14 - Math.sin(t * 14) * 4); g.lineTo(-12, -2); g.fill(); g.fillStyle = '#ffb347'; g.beginPath(); g.arc(12, 0, 2 + Math.random() * 1.5, 0, 7); g.fill(); eyes(4, -2); }
  g.restore();
}
// death effects (the world's own burst stays for 'classic')
function deathFx(world, cx, cy) {
  const id = skinOf('boom').id; if (id === 'classic') return false;
  const P = (o) => world.parts.push(Object.assign({ x: cx, y: cy, vx: 0, vy: 0, life: 1, max: 1, size: 4, col: '#fff', g: 0, drag: 1.5 }, o));
  const R = (a, b) => a + Math.random() * (b - a), n = Math.round(30 * GFX.fx * Perf.fxK) + 6;
  if (id === 'confetti') for (let i = 0; i < n * 1.6; i++) P({ vx: R(-380, 380), vy: R(-620, -120), g: 900, drag: 1.4, sq: true, size: R(3, 6), life: 1.3, max: 1.3, col: hslHex(R(0, 360), .9, .62) });
  else if (id === 'hearts') for (let i = 0; i < n; i++) P({ vx: R(-220, 220), vy: R(-320, -60), g: -60, drag: 1.6, heart: true, size: R(5, 9), life: 1.2, max: 1.2, col: Math.random() < .5 ? '#ff5d8a' : '#ff9ac8' });
  else if (id === 'pixel') { const [a, b] = heroCols(world.time || 0); for (let i = 0; i < 24; i++) P({ x: cx + (i % 6 - 2.5) * 5, y: cy + (Math.floor(i / 6) - 1.5) * 6, vx: R(-260, 260), vy: R(-420, -80), g: 1100, drag: .6, sq: true, size: 6, life: 1.1, max: 1.1, col: i % 3 ? a : b }); }
  else if (id === 'soul') { P({ soul: true, vy: -70, size: 14, life: 1.4, max: 1.4, drag: 0, col: '#efe8ff' }); for (let i = 0; i < n / 2; i++) P({ vx: R(-80, 80), vy: R(-200, -40), add: true, size: R(2, 3.5), life: .9, max: .9, col: '#d8e8ff' }); }
  else if (id === 'blackhole') {
    // everything is pulled into a dark swirl, then it pops
    world.parts.push({ x: cx, y: cy, vx: 0, vy: 0, life: .9, max: .9, size: 0, col: '#7b3fe0', g: 0, drag: 0, ring: true });
    for (let i = 0; i < n * 1.4; i++) { const a = R(0, 7), r = R(50, 120); P({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, vx: -Math.cos(a) * r * 1.6 + Math.sin(a) * 160, vy: -Math.sin(a) * r * 1.6 - Math.cos(a) * 160, drag: .2, add: true, size: R(2, 4), life: .65, max: .65, col: Math.random() < .5 ? '#c59bff' : '#7af7ff' }); }
    P({ vx: 0, vy: 0, size: 18, life: .7, max: .7, drag: 0, col: '#05020f', sq: true });
  }
  else if (id === 'nova') {
    for (let r = 0; r < 2; r++) world.parts.push({ x: cx, y: cy, vx: 0, vy: 0, life: .5 + r * .3, max: .5 + r * .3, size: 0, col: r ? '#ffd36e' : '#fff', g: 0, drag: 0, ring: true });
    for (let i = 0; i < n * 2.2; i++) { const a = i / (n * 2.2) * Math.PI * 2, sp = R(260, 560); P({ vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 2.2, add: true, size: R(2.5, 5), life: R(.6, 1.1), max: 1.1, col: hslHex(R(30, 60), 1, R(.6, .85)) }); }
    if (!world.silent) world.flash = Math.max(world.flash || 0, .8);
  }
  else if (id === 'firework') for (let r = 0; r < 3; r++) { const col = ['#ffd36e', '#ff5d8a', '#7af7ff'][r], ox = R(-30, 30), oy = R(-60, -20); for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, sp = R(160, 260); P({ x: cx + ox, y: cy + oy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 300, drag: 1.8, add: true, size: 3, life: .9 + r * .15, max: .9 + r * .15, col }); } }
  return true;
}
const petBody3 = () => { const c = skinOf('pet').c; return c ? hexNum(c) : 0xffffff; };
const skinOf = (slot) => { const w = (typeof ST !== 'undefined' && ST.wear) || {}; return SKINS[slot].find(s => s.id === w[slot]) || SKINS[slot][0]; };
// body colours of the hero (top, bottom) for the 2D views
function heroCols(t) {
  if (HERO_OVR) return [mixHex(HERO_OVR, '#ffffff', .45), mixHex(HERO_OVR, '#000000', .12)];
  const c = skinOf('color');
  if (!c.c) return [PAL.bodyTop, PAL.bodyBot];
  const base = c.anim === 'aurora' ? hslHex(150 + Math.sin(t * 1.3) * 70, .8, .7) : c.anim ? hslHex((t * 60) % 360, .75, .72) : c.c;
  return [mixHex(base, '#ffffff', .45), mixHex(base, '#000000', .12)];
}
// hat drawn on top of the 2D hero (origin at the feet, f = facing, body top at y = -34)
function drawHat(t, f) {
  const h = skinOf('hat').id; if (h === 'none' || HERO_OVR) return false;
  const g = ctx; g.save(); g.lineJoin = 'round';
  if (h === 'cap') { g.fillStyle = '#ff5d5d'; g.beginPath(); g.arc(0, -32, 13, Math.PI, 0); g.fill(); g.fillRect(f > 0 ? 4 : -22, -33, 18, 4); g.fillStyle = '#fff'; g.beginPath(); g.arc(0, -44, 2.5, 0, 7); g.fill(); }
  else if (h === 'party') { g.fillStyle = '#6ff3c4'; g.beginPath(); g.moveTo(-10, -32); g.lineTo(10, -32); g.lineTo(2, -58); g.closePath(); g.fill(); g.strokeStyle = '#ff5dbb'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(-7, -40); g.lineTo(7, -42); g.moveTo(-4, -49); g.lineTo(5, -50); g.stroke(); g.fillStyle = '#ffd36e'; g.beginPath(); g.arc(2, -59, 4, 0, 7); g.fill(); }
  else if (h === 'horns') { g.fillStyle = '#ff3d4a'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 6, -33); g.quadraticCurveTo(s * 14, -40, s * 16, -50); g.quadraticCurveTo(s * 9, -42, s * 1, -34); g.closePath(); g.fill(); } }
  else if (h === 'halo') { const y = -50 + Math.sin(t * 3) * 1.5; if (glowK() > 0) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = .6; g.drawImage(TEX.gGold, -26, y - 16, 52, 32); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; } g.strokeStyle = '#ffe28a'; g.lineWidth = 3.5; g.beginPath(); g.ellipse(0, y, 13, 4, 0, 0, 7); g.stroke(); }
  else if (h === 'tophat') { g.fillStyle = '#1c1426'; g.fillRect(-15, -36, 30, 4); g.fillRect(-10, -56, 20, 21); g.fillStyle = '#ff5d8a'; g.fillRect(-10, -42, 20, 4); }
  else if (h === 'crown') { g.fillStyle = '#ffc94a'; g.beginPath(); g.moveTo(-13, -33); g.lineTo(-13, -46); g.lineTo(-7, -39); g.lineTo(0, -50); g.lineTo(7, -39); g.lineTo(13, -46); g.lineTo(13, -33); g.closePath(); g.fill(); g.strokeStyle = '#a8741a'; g.lineWidth = 1.5; g.stroke(); g.fillStyle = '#ff3d71'; g.beginPath(); g.arc(0, -38, 2.6, 0, 7); g.fill(); g.fillStyle = '#7af7ff'; g.beginPath(); g.arc(-7, -37, 2, 0, 7); g.arc(7, -37, 2, 0, 7); g.fill(); }
  else if (h === 'viking') {
    g.fillStyle = '#9aa0b4'; g.beginPath(); g.arc(0, -32, 13, Math.PI, 0); g.fill(); g.fillStyle = '#6a5a3a'; g.fillRect(-14, -34, 28, 4);
    g.fillStyle = '#efe6d0'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 11, -38); g.quadraticCurveTo(s * 22, -42, s * 21, -56); g.quadraticCurveTo(s * 15, -46, s * 7, -42); g.closePath(); g.fill(); }
    g.fillStyle = '#c9cfe0'; g.fillRect(-1.5, -45, 3, 10);
  }
  else if (h === 'ninja') {
    g.fillStyle = '#e8384f'; g.fillRect(-14, -30, 28, 5); g.fillStyle = '#c0c8d8'; g.fillRect(-4, -30, 8, 5);
    for (const k of [0, 1]) { g.fillStyle = '#e8384f'; g.beginPath(); const sw = Math.sin(t * 12 + k) * 4; g.moveTo(-f * 13, -29); g.quadraticCurveTo(-f * (22 + k * 4), -31 + sw, -f * (30 + k * 3), -24 + sw + k * 4); g.lineTo(-f * 13, -26); g.fill(); }
  }
  else if (h === 'wizard') { g.fillStyle = '#5a3aa8'; g.beginPath(); g.ellipse(0, -33, 18, 4, 0, 0, 7); g.fill(); g.beginPath(); g.moveTo(-12, -34); g.lineTo(12, -34); g.quadraticCurveTo(4, -50, -f * 8, -66); g.closePath(); g.fill(); g.fillStyle = '#ffd36e'; for (const [x, y] of [[-3, -42], [3, -50], [-1, -56]]) { g.beginPath(); g.arc(x, y, 1.8, 0, 7); g.fill(); } }
  g.restore(); return true;
}
// trail particles behind a moving hero (2D views and the 3D platformer view both read world.parts)
function emitTrail(world, t) {
  const tr = skinOf('trail').id; if (tr === 'none' || !world || world.silent || world.state !== 'play') return;
  const p = world.p, moving = Math.abs(p.vx) > 40 || !p.onGround; if (!moving || Math.random() > .55 * GFX.fx * Perf.fxK) return;
  const x = p.x + PW / 2 - p.face * 10, y = p.y + PHT * .55 + (Math.random() - .5) * 10;
  const q = { x, y, vx: -p.face * 20 + (Math.random() - .5) * 30, vy: (Math.random() - .5) * 30, life: .7, max: .7, size: 3, col: '#fff', g: 0, drag: 1.5, add: true };
  if (tr === 'sparkle') { q.col = Math.random() < .5 ? '#ffe28a' : '#ffffff'; q.size = 2.5; }
  else if (tr === 'fire') { q.col = Math.random() < .5 ? '#ff7a2a' : '#ffd36e'; q.vy = -60 - Math.random() * 40; q.size = 4; q.life = q.max = .45; }
  else if (tr === 'rainbow') { q.col = hslHex((t * 300 + Math.random() * 60) % 360, .9, .65); q.add = false; q.sq = true; q.size = 5; q.vx *= .3; q.vy *= .3; }
  else if (tr === 'hearts') { q.col = '#ff7ab8'; q.vy = -30; q.size = 4.5; }
  else if (tr === 'bubbles') { q.col = '#9ef9ff'; q.vy = -40; q.ring2 = true; q.size = 4; q.add = false; }
  else if (tr === 'snow') { q.col = '#f4fbff'; q.vy = 25 + Math.random() * 20; q.vx *= .4; q.size = 2.5 + Math.random() * 1.5; q.add = false; q.life = q.max = 1.1; q.drag = .4; }
  else if (tr === 'bolt') { q.col = Math.random() < .5 ? '#9ef9ff' : '#ffffff'; q.size = 2 + Math.random() * 2.5; q.life = q.max = .22; q.vx = (Math.random() - .5) * 260; q.vy = (Math.random() - .5) * 260; q.sq = true; }
  world.parts.push(q);
}
// 3D hats for buildHeroMesh (units: hero is about 1.6 tall, top of the head near y = 1.37)
function buildHat3(g, keep) {
  const h = skinOf('hat').id; if (h === 'none') return false;
  const L = c => keep(new THREE.MeshLambertMaterial({ color: c })), B = c => keep(new THREE.MeshBasicMaterial({ color: c }));
  const add = (geo, mat, x, y, z, rx = 0, rz = 0) => { const m = new THREE.Mesh(keep(geo), mat); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); g.add(m); return m; };
  if (h === 'cap') { add(new THREE.SphereGeometry(.42, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), L(0xff5d5d), 0, 1.3, 0); add(new THREE.BoxGeometry(.5, .05, .4), L(0xff5d5d), 0, 1.32, -.45); }
  else if (h === 'party') add(new THREE.ConeGeometry(.28, .7, 12), L(0x6ff3c4), 0, 1.7, 0);
  else if (h === 'horns') for (const s of [-1, 1]) add(new THREE.ConeGeometry(.08, .45, 8), L(0xff3d4a), s * .25, 1.55, 0, 0, -s * .5);
  else if (h === 'halo') add(new THREE.TorusGeometry(.32, .04, 8, 24), B(0xffe28a), 0, 1.85, 0, Math.PI / 2);
  else if (h === 'tophat') { add(new THREE.CylinderGeometry(.42, .42, .05, 18), L(0x1c1426), 0, 1.36, 0); add(new THREE.CylinderGeometry(.28, .28, .5, 18), L(0x1c1426), 0, 1.62, 0); add(new THREE.CylinderGeometry(.285, .285, .08, 18), L(0xff5d8a), 0, 1.44, 0); }
  else if (h === 'crown') { add(new THREE.CylinderGeometry(.3, .3, .2, 10, 1, true), keep(new THREE.MeshLambertMaterial({ color: 0xffc94a, side: THREE.DoubleSide })), 0, 1.44, 0); for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; add(new THREE.ConeGeometry(.06, .18, 6), L(0xffc94a), Math.cos(a) * .3, 1.63, Math.sin(a) * .3); } }
  else if (h === 'wizard') { add(new THREE.CylinderGeometry(.55, .55, .04, 18), L(0x5a3aa8), 0, 1.36, 0); add(new THREE.ConeGeometry(.32, .95, 14), L(0x5a3aa8), 0, 1.85, 0); }
  else if (h === 'viking') { add(new THREE.SphereGeometry(.43, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), L(0x9aa0b4), 0, 1.28, 0); for (const s of [-1, 1]) add(new THREE.ConeGeometry(.08, .45, 8), L(0xefe6d0), s * .42, 1.55, 0, 0, -s * .7); }
  else if (h === 'ninja') add(new THREE.TorusGeometry(.4, .06, 8, 22), L(0xe8384f), 0, 1.2, 0, Math.PI / 2);
  return true;
}
const skinBody3 = () => { const c = skinOf('color'); return c.c ? hexNum(c.c) : hexNum(colOf('player')); };
