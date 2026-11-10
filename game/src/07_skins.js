/* ============================ SKINS (bought with gems in the shop) ============================ */
// Body colours, hats and trails. Gems collected in any level are the money; ST.spent tracks what was spent.
const SKINS = {
  color: [
    { id: 'classic', n: 'کلاسیک', i: '🥚', p: 0 }, { id: 'mint', n: 'نعنایی', i: '🌿', p: 40, c: '#8ff0c8' }, { id: 'ice', n: 'یخی', i: '🧊', p: 70, c: '#bfe8ff' },
    { id: 'ruby', n: 'یاقوتی', i: '❤️', p: 60, c: '#ff7a8a' }, { id: 'shadow', n: 'سایه', i: '🖤', p: 90, c: '#6a5a8a' }, { id: 'gold', n: 'طلایی', i: '🏅', p: 120, c: '#ffd36e' },
    { id: 'galaxy', n: 'کهکشانی', i: '🌌', p: 200, c: '#b18cff', anim: true },
  ],
  hat: [
    { id: 'none', n: 'بدون کلاه', i: '🌱', p: 0 }, { id: 'cap', n: 'کلاه کپ', i: '🧢', p: 30 }, { id: 'party', n: 'کلاه جشن', i: '🎉', p: 50 },
    { id: 'horns', n: 'شاخ شیطون', i: '😈', p: 80 }, { id: 'halo', n: 'هاله‌ی فرشته', i: '😇', p: 100 }, { id: 'tophat', n: 'کلاه شاپو', i: '🎩', p: 120 },
    { id: 'crown', n: 'تاج پادشاهی', i: '👑', p: 150 }, { id: 'wizard', n: 'کلاه جادوگر', i: '🧙', p: 180 },
  ],
  trail: [
    { id: 'none', n: 'بدون رد', i: '·', p: 0 }, { id: 'sparkle', n: 'ستاره‌ریز', i: '✨', p: 60 }, { id: 'bubbles', n: 'حباب', i: '🫧', p: 70 },
    { id: 'hearts', n: 'قلب', i: '💖', p: 90 }, { id: 'fire', n: 'آتش', i: '🔥', p: 100 }, { id: 'rainbow', n: 'رنگین‌کمون', i: '🌈', p: 160 },
  ],
};
const skinOf = (slot) => { const w = (typeof ST !== 'undefined' && ST.wear) || {}; return SKINS[slot].find(s => s.id === w[slot]) || SKINS[slot][0]; };
// body colours of the hero (top, bottom) for the 2D views
function heroCols(t) {
  if (HERO_OVR) return [mixHex(HERO_OVR, '#ffffff', .45), mixHex(HERO_OVR, '#000000', .12)];
  const c = skinOf('color');
  if (!c.c) return [PAL.bodyTop, PAL.bodyBot];
  const base = c.anim ? hslHex((t * 60) % 360, .75, .72) : c.c;
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
  return true;
}
const skinBody3 = () => { const c = skinOf('color'); return c.c ? hexNum(c.c) : hexNum(colOf('player')); };
