// World content: speed routes, loops, rails, tubes, springs, platforms, puzzles, city, ruins, fortress, sky isles,
// moon base, special stage, waterfall + secret tunnel, collectibles. Everything placed here is real and interactive.
import * as THREE from 'three';
import { heightAt, ZONES, WORLD } from './terrain.js';
import { rng, lerp, canvasTex } from '../util.js';
import { G, bus } from '../game.js';

const H = heightAt;
export const ANCHORS = {};
const A = (id, x, z, y) => (ANCHORS[id] = new THREE.Vector3(x, y ?? H(x, z), z));

// main speed routes (polylines of [x,z])
export const ROUTES = [
  [[0, 0], [60, 40], [120, 110], [120, 200], [60, 260], [-40, 240], [-60, 140], [-20, 60], [0, 0]],
  [[40, -10], [200, 0], [350, 30], [560, 40], [640, 80]],
  [[0, -40], [-30, -200], [-80, -400], [-120, -560], [-80, -700], [-60, -820]],
  [[-40, -20], [-200, -100], [-380, -160], [-520, -140], [-620, -240], [-700, -320]],
  [[-20, 40], [-150, 200], [-280, 380], [-380, 560], [-400, 640]],
  [[30, -30], [200, -150], [300, -230], [460, -380], [600, -500], [680, -560]],
  [[640, 120], [600, 300], [520, 460], [470, 580]],
  [[-300, 300], [-500, 320], [-700, 330], [-820, 380]],
  [[-620, -300], [-640, -500], [-660, -700], [-640, -860]],
  [[-400, 640], [-200, 800], [0, 900], [40, 960]],
  [[430, 620], [250, 850], [100, 930]],
];

export function buildWorld(L) {
  const r = rng(99);
  const yaw = (a, b) => Math.atan2(b[0] - a[0], b[1] - a[1]);

  // ---------------------------------------------------------- hub
  A('hub', 0, 0); A('start', 0, 6);
  L.checkpointPost(6, 4, 0);
  L.ringCircle(0, H(0, 0) + 1.2, 0, 14, 24);
  L.spring(10, H(10, -10), -10, [0, 1, 0], 30); L.ringLine([10, H(10, -10) + 8, -10], [10, H(10, -10) + 22, -10], 6, 0, false);
  L.sign(-12, 18, 0.4, '#3ad0ff'); L.sign(18, -14, -0.6, '#ffcc33');
  L.capsule(-8, H(-8, -8) + 1.2, -8, 'shield'); L.capsule(14, H(14, 10) + 1.2, 10, 'magnet');
  L.cannon(-22, -6, [120, 232.5, -120], { flight: 4.2 }); // to the sky isles
  for (let i = 0; i < 10; i++) { const a2 = i / 10 * Math.PI * 2; L.addRing(Math.cos(a2) * 24, H(Math.cos(a2) * 24, Math.sin(a2) * 24) + 2.2, Math.sin(a2) * 24, { move: { speed: 1.2, phase: a2, ax: 2.5, ay: 1.2, az: 2.5 } }); }
  L.dashPad(4, 22, 0, 55); L.dashPad(22, -2, Math.PI / 2, 55);

  // ---------------------------------------------------------- routes: rings, pads, capsules, cages, crates
  const powers = ['speed', 'magnet', 'shield', 'invinc', 'energy', 'elecShield', 'fireShield', 'waterShield', 'ringx2', 'rings10', 'xpx2', 'lowgrav', 'slowmo', 'energy'];
  ROUTES.forEach((route, ri) => {
    for (let i = 0; i < route.length - 1; i++) {
      const a = route[i], b = route[i + 1]; const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const groups = Math.floor(len / 34);
      for (let g = 0; g < groups; g++) {
        const t0 = (g + 0.2) / groups, t1 = t0 + 10 / len;
        const p0 = [lerp(a[0], b[0], t0), lerp(a[1], b[1], t0)], p1 = [lerp(a[0], b[0], t1), lerp(a[1], b[1], t1)];
        if ((g + ri) % 4 === 3) L.ringArc(p0, p1, 7, 4); else L.ringLine(p0, p1, 6);
      }
      if (len > 90 && (i + ri) % 2 === 0) { const t = 0.08; const x = lerp(a[0], b[0], t), z = lerp(a[1], b[1], t); L.dashPad(x, z, yaw(a, b), 58); }
      if ((i + ri) % 3 === 1) { const x = lerp(a[0], b[0], 0.55) + 6, z = lerp(a[1], b[1], 0.55); L.capsule(x, H(x, z) + 1.3, z, powers[(i * 3 + ri) % powers.length]); }
      if ((i + ri) % 3 === 2) { const x = lerp(a[0], b[0], 0.4) - 7, z = lerp(a[1], b[1], 0.4) + 3; L.cage(x, z); }
      if ((i + ri) % 2 === 1) { const x = lerp(a[0], b[0], 0.7) + 5, z = lerp(a[1], b[1], 0.7) - 4; L.breakable(x, z, 'crate'); L.breakable(x + 1.6, z, 'crate'); }
    }
  });

  // ---------------------------------------------------------- loops, corkscrews, tubes, hoops
  L.loop(120, 150, 0); L.loop(560, 40, 1.523); L.loop(-520, -140, -1.429); L.loop(-120, -560, -2.897);
  L.corkscrew([240, 8], [320, 26], 6, 1); L.corkscrew([-40, -260], [-62, -340], 6, 1);
  const tA = H(-620, -520) + 1.2, tB = H(-660, -700) + 1.2; L.dashPad(-614, -505, Math.atan2(-6, -15), 55);
  L.tubeRide([[-620, tA, -520], [-630, tA + 3, -545], [-640, tA + 24, -590], [-655, Math.max(tA, tB) + 30, -640], [-662, tB + 14, -680], [-660, tB + 1, -705]], 64);
  L.hoop(60, H(60, 40) + 6, 40, Math.atan2(60, 70), -0.25, 55); L.hoop(-200, H(-200, -100) + 5, -100, Math.atan2(-180, -60), 0, 58);
  L.hoop(450, H(450, 33) + 5, 33, Math.PI / 2, 0, 60);

  // ---------------------------------------------------------- rails (incl. parallel pairs for switching)
  const lineRail = (a, b, lift, off = 0, step = 22) => {
    const n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)); const dx = b[0] - a[0], dz = b[1] - a[1]; const L2 = Math.hypot(dx, dz); const sx = -dz / L2 * off, sz = dx / L2 * off;
    const pts = []; for (let i = 0; i <= n; i++) { const t = i / n; const x = lerp(a[0], b[0], t) + sx, z = lerp(a[1], b[1], t) + sz; pts.push([x, H(x, z) + lift + Math.sin(t * Math.PI) * lift * 0.6, z]); }
    return L.railFrom(pts);
  };
  lineRail([60, 40], [120, 105], 3, -4); lineRail([60, 40], [120, 105], 3, 4, 22);
  lineRail([-250, 270], [-185, 100], 4, 6); lineRail([-250, 270], [-185, 100], 4, 12);
  lineRail([-380, 600], [-200, 300], 4, 0, 18);
  lineRail([200, -150], [300, -225], 3.5, 8); lineRail([-80, -420], [-115, -540], 3, 7);
  lineRail([600, 300], [520, 460], 3.5, -6); lineRail([-640, -500], [-660, -690], 4, 10);
  L.spring(-388, H(-388, 600), 607, [0, 1, 0], 22);

  // ---------------------------------------------------------- meadow extras
  A('raceMeadow', -60, 140);
  for (let i = 0; i < 4; i++) L.bouncePad(-120 + i * 14, 40 + i * 8, 18 + i * 3);
  L.ringLine([-120, H(-120, 40) + 10, 40], [-78, H(-78, 64) + 18, 64], 10, 0, false);
  L.movingPlatform([80, H(80, -60) + 6, -60], [80, H(80, -60) + 6, -100], [5, 0.8, 5], 7);
  L.rotatingPlatform(-80, H(-80, -90) + 5, -90, [14, 0.8, 3], 0.7);
  L.spring(-80, H(-80, -90) + 1, -80, [0, 1, 0], 18);
  for (let i = 0; i < 5; i++) L.vanishPlatform(40 + i * 7, H(40, 80) + 4 + i * 1.5, 80, 2.5, 1.5, i * 0.5);
  L.spring(33, H(33, 80), 80, [0, 1, 0], 16);
  for (let i = 0; i < 4; i++) { const x = -20 - i * 9, z = -120; L.collapsePlatform(x, H(x, z) + 6 + i * 2, z); }
  L.spring(-14, H(-14, -120), -120, [0, 1, 0], 17);
  L.balloon(-50, H(-50, -120) + 16, -120); L.balloon(-60, H(-60, -120) + 22, -125); L.balloon(-70, H(-70, -120) + 28, -130);
  L.collectible('red', 0, -70, H(-70, -130) + 34, -130);
  L.collectible('red', 1, 120, H(120, 150) + 19.5, 147);
  L.checkpointPost(120, 210, 0); L.checkpointPost(260, -10, 1.5);
  L.collectible('map', 0, 30, H(30, 30) + 1, 30);
  L.collectible('chest', 0, -40, H(-40, 230), 236, {}); L.collectible('key', 0, 64, H(64, 262) + 1.2, 262);
  L.collectible('token', 0, -64, H(-64, 146) + 1.2, 146);
  A('titan', 300, -230); A('vexArena', -330, -420);
  L.checkpointPost(240, -190, 0.8); L.checkpointPost(-290, -380, 0.6);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; L.box(-330 + Math.cos(a) * 52, H(-330, -420) + 4, -420 + Math.sin(a) * 52, 3, 8, 3, L.M.stone, { surface: 'rock' }); }

  // ---------------------------------------------------------- forest
  L.checkpointPost(-520, -200, 0); L.collectible('map', 1, -600, H(-600, -240) + 1, -240);
  L.collectible('red', 2, -560, H(-560, -300) + 12, -300); L.spring(-560, H(-560, -300), -300, [0, 1, 0], 24);
  L.collectible('chest', 1, -700, H(-700, -330), -330, { locked: true }); L.collectible('token', 1, -660, H(-660, -180) + 1.2, -180);
  for (let i = 0; i < 6; i++) L.bouncePad(-640 + i * 6, -260 - i * 9, 17 + i * 2);
  L.collectible('red', 3, -604, H(-604, -314) + 28, -314);
  // waterfall, secret tunnel and hidden chamber
  const wf = { x: -660, z: 120 }; const by = H(wf.x, wf.z);
  A('waterfall', wf.x + 14, wf.z);
  L.box(wf.x - 4, by + 16, wf.z - 17.5, 8, 32, 25, L.M.stone, { surface: 'rock' }); L.box(wf.x - 4, by + 16, wf.z + 17.5, 8, 32, 25, L.M.stone, { surface: 'rock' });
  L.box(wf.x - 4, by + 19, wf.z, 8, 26, 10, L.M.stone, { surface: 'rock' }); // block above the opening
  G.nature.addWaterfall(wf.x + 0.3, by + 32, by, wf.z, Math.PI / 2, 14);
  L.box(wf.x - 22, by + 7.5, wf.z - 6, 28, 15, 2, L.M.stone); L.box(wf.x - 22, by + 7.5, wf.z + 6, 28, 15, 2, L.M.stone); L.box(wf.x - 22, by + 6.5, wf.z, 28, 1, 12, L.M.stone);
  L.box(wf.x - 44, by + 8, wf.z - 15, 16, 16, 2, L.M.stone); L.box(wf.x - 44, by + 8, wf.z + 15, 16, 16, 2, L.M.stone); L.box(wf.x - 52, by + 8, wf.z, 2, 16, 30, L.M.stone); L.box(wf.x - 44, by + 16.5, wf.z, 18, 1, 32, L.M.stone);
  L.box(wf.x - 36.5, by + 11, wf.z - 9, 1, 10, 10, L.M.stone); L.box(wf.x - 36.5, by + 11, wf.z + 9, 1, 10, 10, L.M.stone);
  L.collectible('shard', 0, wf.x - 44, by + 2.2, wf.z); L.collectible('red', 4, wf.x - 48, by + 1.5, wf.z - 10); L.collectible('crystal', 0, wf.x - 40, by + 1, wf.z + 11); L.collectible('crystal', 1, wf.x - 48, by + 1, wf.z + 11);
  for (let i = 0; i < 6; i++) L.addRing(wf.x - 10 - i * 4, by + 1.2, wf.z);

  // ---------------------------------------------------------- desert
  L.checkpointPost(640, 90, 0); L.collectible('map', 2, 700, H(700, 60) + 1, 60);
  A('raceDesert', 520, 260); A('oasis', 720, 200, 0);
  for (let i = 0; i < 4; i++) L.box(760 + i * 12, H(760, 0) + 2 + i * 3, 0, 8, 4 + i * 6, 8, L.M.stone, { surface: 'sand' });
  L.collectible('red', 5, 796, H(760, 0) + 2 + 3 * 3 + 12, 0);
  A('lumiTop', 796, 0, H(760, 0) + 22.2);
  L.collectible('chest', 2, 724, H(724, 230), 230); L.collectible('key', 1, 560, H(560, 300) + 12, 300); L.spring(560, H(560, 300), 300, [0, 1, 0], 24);
  L.collectible('red', 6, 715, -1.8, 200); // under the oasis water
  L.collectible('token', 2, 610, H(610, 380) + 1.2, 380);
  // sky highway: elevated road segments from desert toward the city
  { let x = 640, z = 0, y = H(640, 0) + 24; L.spring(640, H(640, 12), 12, [0, 1, -0.25], 30);
    for (let i = 0; i < 9; i++) { const nx = x + 14, nz = z - 42; const yy = y + Math.sin(i * 0.7) * 3; const yw = Math.atan2(nx - x, nz - z); L.box((x + nx) / 2, yy, (z + nz) / 2, 7, 0.8, 44.5, L.M.platMove, { yaw: yw, surface: 'metal' }); L.ringLine([x, yy + 1.5, z], [nx, yy + 1.5, nz], 6, 0, false); if (i % 3 === 0) L.dashPad((x + nx) / 2, (z + nz) / 2, yw, 62, yy + 0.4); x = nx; z = nz; }
    A('skyHighwayEnd', x, z, y); }

  // ---------------------------------------------------------- snow
  L.checkpointPost(-400, 620, 0); L.collectible('map', 3, -360, H(-360, 680) + 1, 680);
  L.collectible('red', 7, -460, H(-460, 720) + 1.5, 720); L.collectible('crystal', 2, -420, H(-420, 760) + 1, 760); L.collectible('crystal', 3, -300, H(-300, 720) + 1, 720);
  L.collectible('chest', 3, -480, H(-480, 600), 600); L.collectible('key', 2, -330, H(-330, 560) + 1.2, 560);
  { const ix = -300, iz = 560, iy = H(ix, iz) + 0.2; const ice = new THREE.MeshPhysicalMaterial({ color: 0xcfefff, roughness: 0.05, metalness: 0.1, clearcoat: 1, transparent: true, opacity: 0.85 });
    for (let i = 0; i < 6; i++) L.box(ix + (i % 3) * 10, iy, iz + Math.floor(i / 3) * 10, 10, 0.3, 10, ice, { surface: 'snow' }); }
  // ice cave (interior camera)
  { const cx = -470, cz = 760, cy = H(cx, cz); L.box(cx, cy + 9, cz, 26, 1, 26, L.M.stone); L.box(cx - 13, cy + 4.5, cz, 1, 9, 26, L.M.stone); L.box(cx + 13, cy + 4.5, cz, 1, 9, 26, L.M.stone); L.box(cx, cy + 4.5, cz + 13, 26, 9, 1, L.M.stone);
    L.collectible('crystal', 4, cx, cy + 1.2, cz + 6); L.collectible('crystal', 5, cx - 6, cy + 1.2, cz + 4); L.cage(cx + 6, cz + 6); }

  // ---------------------------------------------------------- volcano
  A('crater', 430, 690, 108); L.checkpointPost(470, 580, 0.5); L.collectible('map', 4, 500, H(500, 560) + 1, 560);
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; const x = 430 + Math.cos(a) * (i === 0 ? 0 : 34), z = 690 + Math.sin(a) * (i === 0 ? 0 : 34); L.physics.addCyl({ x, y: 104, z, r: i === 0 ? 12 : 8, hy: 4, surface: 'rock' }); L.mesh(L.cyl(i === 0 ? 12 : 8, i === 0 ? 13 : 9, 8, 20), L.M.stone, x, 104, z); }
  L.cannon(470, 600, [430, 109, 690], { flight: 2.8 });
  L.collectible('red', 8, 430, 128, 690); L.collectible('chest', 4, 380, H(380, 560), 560, { locked: true });
  L.collectible('token', 3, 520, H(520, 640) + 1.2, 640);

  // ---------------------------------------------------------- coast & tropical islands
  L.checkpointPost(-80, -700, 0); L.collectible('map', 5, -40, H(-40, -740) + 1, -740);
  A('krakenArena', -80, -1000, 1);
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; L.box(-80 + Math.cos(a) * 40, 0.6, -1000 + Math.sin(a) * 40, 12, 1.2, 12, L.M.wood, { yaw: -a, surface: 'grass' }); }
  L.box(-80, 0.6, -1000, 16, 1.2, 16, L.M.wood, { surface: 'grass' });
  for (let i = 0; i < 6; i++) L.box(-80 + Math.sin(i) * 3, 0.6, -880 - i * 18, 6, 1.2, 10, L.M.wood, { surface: 'grass' }); // pier to the arena
  L.collectible('red', 9, -160, H(-160, -820) + 1.5, -820); L.collectible('chest', 5, -10, H(-10, -860), -860);
  L.collectible('red', 10, -110, -5, -990); // underwater
  for (let i = 0; i < 6; i++) L.addRing(-104 - i * 2, -4, -984 + i * 2);

  // ---------------------------------------------------------- neon city (buildings, rooftop rails, speed tube)
  A('city', 680, -560); L.checkpointPost(695, -520, 0.8); L.collectible('map', 6, 700, 17, -520);
  { const rr = rng(7); const bm = cityMaterial(L.p); const geos = []; const CY = 16;
    for (let gx = -4; gx <= 4; gx++) for (let gz = -4; gz <= 4; gz++) {
      if (Math.abs(gx) + Math.abs(gz) < 2 || (gx === 0 || gz === 0)) continue;
      const x = 680 + gx * 44, z = -560 + gz * 44; if (Math.hypot(gx, gz) > 4.6) continue;
      const w = 18 + rr() * 12, d = 18 + rr() * 12, h = 10 + rr() * rr() * 70;
      const g = new THREE.BoxGeometry(w, h, d); const uv = g.attributes.uv; const n = g.attributes.normal;
      for (let i = 0; i < uv.count; i++) { const ny = Math.abs(n.getY(i)); const sx = Math.abs(n.getX(i)) > 0.5 ? d : w; uv.setXY(i, uv.getX(i) * (ny > 0.5 ? 0.01 : sx / 4), uv.getY(i) * (ny > 0.5 ? 0.01 : h / 4)); }
      g.translate(x, CY + h / 2, z); geos.push(g);
      L.physics.addBox({ x, y: CY + h / 2, z, hx: w / 2, hy: h / 2, hz: d / 2, surface: 'metal' });
      if (rr() < 0.35) L.addRing(x, CY + h + 1.2, z);
    }
    const merged = mergeBoxes(geos); const mesh = new THREE.Mesh(merged, bm); mesh.castShadow = L.p.shadow > 0; mesh.receiveShadow = true; L.group.add(mesh);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; L.sign(680 + Math.cos(a) * 30, -560 + Math.sin(a) * 30, -a, ['#ff3a8a', '#3ad0ff', '#ffcc33'][i % 3]); }
    L.railFrom([[520, 30, -556], [560, 33, -560], [600, 34, -564], [650, 31, -560]]);
    L.spring(512, 16, -556, [0, 1, 0.12], 26);
    const ct = L.tubeRide([[680, 17.2, -470], [680, 19, -500], [690, 40, -560], [680, 30, -620], [680, 17.2, -660]], 60);
    { const q = new THREE.Vector3(); ct.pointAt(ct.length * 0.5, q); L.collectible('red', 11, q.x, q.y + 0.6, q.z); } L.collectible('chest', 6, 860, 16, -560, { locked: true }); L.collectible('key', 3, 520, 17.2, -560);
    L.dashPad(680, -440, Math.PI, 60, 16); L.dashPad(680, -455, Math.PI, 60, 16); }

  // ---------------------------------------------------------- ancient ruins + shrine puzzle
  L.checkpointPost(-700, 330, 0); L.collectible('map', 7, -760, H(-760, 300) + 1, 300);
  { const sx = -820, sz = 380, sy = H(sx, sz); A('shrine', sx, sz);
    // temple: walls around a chamber, a door on the south side
    L.box(sx, sy + 5, sz + 8, 16, 10, 1.2, L.M.stone, { surface: 'rock' }); L.box(sx - 8, sy + 5, sz, 1.2, 10, 16, L.M.stone); L.box(sx + 8, sy + 5, sz, 1.2, 10, 16, L.M.stone);
    L.box(sx - 5.5, sy + 5, sz - 8, 5, 10, 1.2, L.M.stone); L.box(sx + 5.5, sy + 5, sz - 8, 5, 10, 1.2, L.M.stone); L.box(sx, sy + 10.5, sz, 17, 1, 17, L.M.stone);
    const door = L.door(sx, sz - 8, 0, 6, 9, { y: sy });
    if (G.save.flags.shrineSolved) door.setOpen(true);
    L.collectible('shard', 1, sx, sy + 2, sz + 2);
    const plates = [];
    const check = () => { if (plates.every((p) => p.latched)) { door.setOpen(true); if (!G.save.flags.shrineSolved) { G.save.flags.shrineSolved = 1; G.hud.toast('puzzle_solved', 'good'); bus.emit('puzzle', 'shrine'); } } };
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + 0.5; const p = L.pressurePlate(sx + Math.cos(a) * 22, sz + Math.sin(a) * 22 - 6, (on, pl) => { if (on && !pl.latched) { pl.latched = true; G.hud.toast('plate_on', 'info', { n: plates.filter((q) => q.latched).length }); setTimeout(() => { if (!G.save.flags.shrineSolved) pl.latched = false; }, 9000); check(); } }); plates.push(p); }
    // energy barrier + switch puzzle guarding a chest
    const ch = H(-775, 420); L.box(-775, ch + 3, 427.5, 13, 6, 1, L.M.stone); L.box(-775, ch + 3, 412.5, 13, 6, 1, L.M.stone); L.box(-781.5, ch + 3, 420, 1, 6, 16, L.M.stone); L.box(-775, ch + 6.5, 420, 14, 1, 17, L.M.stone);
    const bar = L.door(-768.5, 420, Math.PI / 2, 14, 6, { barrier: true, y: ch });
    L.box(-740, H(-740, 440) + 6, 440, 3, 12, 3, L.M.stone); L.spring(-744.5, H(-744.5, 440), 440, [0, 1, 0], 30);
    L.switchPost(-740, 440, (on) => bar.setOpen(on), { y: H(-740, 440) + 12 });
    L.collectible('chest', 7, -775, H(-775, 420), 420, { locked: true });
    L.collectible('crystal', 6, -840, H(-840, 300) + 1, 300); L.collectible('crystal', 7, -860, H(-860, 340) + 1, 340); L.collectible('crystal', 8, -700, H(-700, 420) + 1, 420); L.collectible('crystal', 9, -720, H(-720, 260) + 1, 260);
    L.collectible('red', 12, -900, H(-900, 420) + 1.5, 420);
    // multi-stage platforming tower
    for (let i = 0; i < 8; i++) { const a = i * 0.9; L.box(-650 + Math.cos(a) * 10, H(-650, 420) + 3 + i * 3.4, 420 + Math.sin(a) * 10, 4, 0.8, 4, L.M.stone); }
    L.collectible('red', 13, -650, H(-650, 420) + 32, 420); A('towerTop', -650, 420, H(-650, 420) + 30.2); L.box(-650, H(-650, 420) + 29.5, 420, 5, 0.8, 5, L.M.stone);
    for (let i = 0; i < 4; i++) L.breakable(-690 + i * 3, 300, 'rock', { reward: i === 1 ? 'invinc' : undefined }); }

  // ---------------------------------------------------------- crystal canyon + cave
  L.checkpointPost(-640, -500, 0); L.collectible('map', 8, -680, H(-680, -760) + 1, -760);
  { const cx = -700, cz = -800, cy = H(cx, cz);
    L.box(cx, cy + 8.5, cz, 34, 1, 34, L.M.stone); L.box(cx - 17, cy + 4, cz, 1, 8, 34, L.M.stone); L.box(cx + 17, cy + 4, cz, 1, 8, 34, L.M.stone); L.box(cx, cy + 4, cz - 17, 34, 8, 1, L.M.stone);
    for (let i = 0; i < 6; i++) L.collectible('crystal', 10 + i, cx - 12 + i * 5, cy + 1.2, cz - 8 + (i % 2) * 6);
    L.collectible('red', 14, cx, cy + 1.5, cz - 12); L.collectible('key', 4, cx + 10, cy + 1.2, cz - 12); }
  for (let i = 0; i < 4; i++) L.collectible('crystal', 16 + i, -620 + i * 12, H(-620 + i * 12, -620) + 1, -620);
  L.collectible('chest', 8, -600, H(-600, -900), -900); L.collectible('token', 4, -700, H(-700, -650) + 1.2, -650);

  // ---------------------------------------------------------- iron fortress, factory, underground lab
  A('fortress', 40, 960, 30); L.checkpointPost(20, 860, 0); L.collectible('map', 9, 60, 31, 880);
  { const fy = 30;
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; if (i % 4 === 2) continue; L.box(40 + Math.cos(a) * 128, fy + 7, 960 + Math.sin(a) * 128, 50, 14, 4, L.M.dark, { yaw: -a + Math.PI / 2 }); }
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.2; L.physics.addCyl({ x: 40 + Math.cos(a) * 128, y: fy + 12, z: 960 + Math.sin(a) * 128, r: 6, hy: 12 }); L.mesh(L.cyl(6, 7, 24, 16), L.M.metal, 40 + Math.cos(a) * 128, fy + 12, 960 + Math.sin(a) * 128); }
    // factory hall with pistons and gears (moving obstacles)
    L.box(-30, fy + 10, 1030, 40, 1, 30, L.M.dark); L.box(-50, fy + 5, 1030, 1, 10, 30, L.M.dark); L.box(-10, fy + 5, 1045, 40, 10, 1, L.M.dark);
    for (let i = 0; i < 4; i++) L.piston(-42 + i * 9, 1030, fy, 6, 2.6, i * 0.6);
    L.gear(-30, fy + 14, 1016, 4, 0.8); L.gear(-14, fy + 16, 1016, 3, -1.2);
    for (let i = 0; i < 6; i++) L.addRing(-42 + i * 6, fy + 1.2, 1030);
    L.collectible('chest', 9, -40, fy, 1040); L.collectible('red', 15, -20, fy + 1.4, 1040);
    // timed door: switch opens a door for 8 s
    const td = L.door(100, 900, 0.3, 6, 7, { y: fy, timed: 8 });
    L.switchPost(80, 890, () => td.setOpen(true, 8), { y: fy });
    L.box(108, fy + 3.5, 912, 1, 7, 12, L.M.dark, { yaw: 0.3 }); L.box(92, fy + 3.5, 916, 1, 7, 12, L.M.dark, { yaw: 0.3 }); L.box(102, fy + 7.5, 916, 18, 1, 14, L.M.dark, { yaw: 0.3 });
    L.collectible('chest', 10, 103, fy, 918, { locked: true });
    // underground laboratory (sunken pit with roof)
    const lx = 150, lz = 1010, ly = 9; A('lab', lx, lz, ly);
    L.box(lx, fy + 0.6, lz, 70, 1.2, 70, L.M.dark);
    L.box(lx, (ly + fy) / 2, lz - 36, 72, fy - ly, 2, L.M.dark); L.box(lx, (ly + fy) / 2, lz + 36, 72, fy - ly, 2, L.M.dark); L.box(lx + 36, (ly + fy) / 2, lz, 2, fy - ly, 72, L.M.dark);
    L.box(lx - 36, (ly + fy) / 2 + 5, lz, 2, fy - ly - 10, 72, L.M.dark);
    for (let i = 0; i < 10; i++) L.box(lx - 44 + i * 1.0, fy - i * 2.1 - 0.5, lz + 26, 3.2, 1, 6, L.M.metal);
    for (let i = 0; i < 5; i++) L.cage(lx - 20 + i * 10, lz - 20, { y: ly, tag: 'lab' });
    L.collectible('red', 16, lx + 20, ly + 1.4, lz + 20); L.capsule(lx, ly + 1.3, lz, 'energy');
    // portal to the moon base
    L.portal([-60, fy, 1000, 0], [ZONES.moon.c[0] + 20, ZONES.moon.c[1], ZONES.moon.c[2] + 20, Math.PI], 0x6af0ff);
    L.railFrom([[-10, fy + 14, 840], [40, fy + 17, 836], [90, fy + 14, 846]]); L.spring(-14, fy, 846, [0, 1, 0.2], 20);
    L.collectible('red', 17, 40, fy + 24, 960); }

  // ---------------------------------------------------------- sky isles (floating islands)
  { const isles = [[120, 230, -120, 14], [165, 238, -150, 10], [210, 246, -130, 9], [245, 258, -170, 11], [230, 270, -215, 8], [185, 284, -235, 10], [140, 262, -205, 9], [100, 250, -170, 8]];
    const grass = L.p.mat === 0 ? new THREE.MeshLambertMaterial({ color: 0x5cb84a }) : new THREE.MeshStandardMaterial({ color: 0x5cb84a, roughness: 0.9 });
    const rock = L.p.mat === 0 ? new THREE.MeshLambertMaterial({ color: 0x8a7a68 }) : new THREE.MeshStandardMaterial({ color: 0x8a7a68, roughness: 0.95 });
    isles.forEach(([x, y, z, rad], i) => {
      L.physics.addCyl({ x, y: y - 1, z, r: rad, hy: 1, surface: 'grass' });
      L.mesh(L.cyl(rad, rad * 0.95, 2, 24), grass, x, y - 1, z); L.mesh(new THREE.ConeGeometry(rad * 0.95, rad * 2.2, 12).rotateX(Math.PI), rock, x, y - 2 - rad * 1.1, z);
      L.ringCircle(x, y + 1.2, z, rad * 0.6, 8);
      if (i === 0) { A('sky0', x, z, y); L.checkpointPost(x + 4, z + 4, 0, y); }
    });
    for (let i = 0; i < isles.length - 1; i++) { const a = isles[i], b = isles[i + 1]; if (i % 2 === 0) L.railFrom([[a[0], a[1] + 1.2, a[2]], [(a[0] + b[0]) / 2, Math.max(a[1], b[1]) + 6, (a[2] + b[2]) / 2], [b[0], b[1] + 1.2, b[2]]]); else { const px = a[0] + (b[0] - a[0]) * 0.25, pz = a[2] + (b[2] - a[2]) * 0.25, T = 1.7; const v = new THREE.Vector3((b[0] - px) / T, (b[1] + 1 - (a[1] + 1)) / T + 0.5 * 34 * 1.12 * T, (b[2] - pz) / T); L.spring(px, a[1], pz, [v.x, v.y, v.z], v.length(), { lock: T * 0.8 }); } }
    L.movingPlatform([175, 264, -228], [150, 258, -215], [5, 0.8, 5], 6);
    L.gravityZone(185, 300, -235, 22, 0.45);
    L.collectible('shard', 2, 185, 289, -235); L.collectible('red', 18, 245, 268, -170);
    for (let i = 0; i < 8; i++) L.addRing(160 + i * 4, 250 + Math.sin(i) * 2, -190, { move: { speed: 1.6, phase: i * 0.6, ax: 0, ay: 3, az: 4 } });
    L.giantRing(205, 279, -222, 0); }

  // ---------------------------------------------------------- moon base (low gravity)
  { const [mx, my, mz] = ZONES.moon.c; A('moon', mx, mz, my);
    L.physics.addCyl({ x: mx, y: my - 10, z: mz, r: 190, hy: 10, surface: 'rock' });
    const moonMat = L.p.mat === 0 ? new THREE.MeshLambertMaterial({ color: 0x9a9aa4 }) : new THREE.MeshStandardMaterial({ color: 0x9a9aa4, roughness: 1, map: canvasTex(256, 256, (g) => { g.fillStyle = '#9a9aa4'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(40,40,50,${Math.random() * 0.25})`; g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 18, 0, 7); g.fill(); } }, { repeat: true }) });
    if (moonMat.map) moonMat.map.repeat.set(12, 12);
    L.mesh(L.cyl(190, 160, 20, 48), moonMat, mx, my - 10, mz);
    for (let i = 0; i < 14; i++) { const a = r() * 6.28, d = 30 + r() * 140; const x = mx + Math.cos(a) * d, z = mz + Math.sin(a) * d; const cr = 5 + r() * 10; L.mesh(new THREE.TorusGeometry(cr, 1.2, 6, 24).rotateX(Math.PI / 2), moonMat, x, my, z); }
    const dome = new THREE.MeshStandardMaterial({ color: 0xdfe8ff, metalness: 0.6, roughness: 0.2 });
    for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28; const x = mx + Math.cos(a) * 60, z = mz + Math.sin(a) * 60; L.mesh(new THREE.SphereGeometry(10, 24, 12, 0, 6.28, 0, Math.PI / 2), dome, x, my, z); L.physics.addCyl({ x, y: my + 4, z, r: 9, hy: 4 }); }
    for (let i = 0; i < 4; i++) L.box(mx - 30 + i * 20, my + 2 + i * 4, mz - 40, 8, 1, 8, L.M.platMove);
    L.collectible('shard', 3, mx + 30, my + 18, mz - 40); L.collectible('red', 19, mx - 120, my + 1.5, mz + 60);
    for (let i = 0; i < 6; i++) L.collectible('crystal', 20 + i, mx + Math.cos(i) * 100, my + 1, mz + Math.sin(i) * 100);
    for (let i = 0; i < 4; i++) L.collectible('crystal', 26 + i, mx - 60 + i * 10, my + 1, mz + 120);
    L.ringCircle(mx, my + 1.5, mz, 40, 30); L.checkpointPost(mx + 12, mz + 12, 0, my);
    L.portal([mx - 20, my, mz - 20, 0], [8, H(8, -24), -24, Math.PI], 0x6af0ff); }

  // ---------------------------------------------------------- special stage arena + giant rings in the world
  { const [sx, sy, sz] = ZONES.special.c; A('special', sx + 80, sz, sy + 1);
    for (let i = 0; i < 36; i++) { const a = i / 36 * Math.PI * 2; const y = sy + Math.sin(a * 3) * 8; L.box(sx + Math.cos(a) * 80, y, sz + Math.sin(a) * 80, 10, 0.8, 16, L.M.platMove, { yaw: -a }); if (i % 6 === 3) L.spring(sx + Math.cos(a) * 80, y + 0.4, sz + Math.sin(a) * 80, [0, 1, 0], 18); }
    for (let i = 0; i < 90; i++) { const a = i / 90 * Math.PI * 2; L.addRing(sx + Math.cos(a) * 80, sy + Math.sin(a * 3) * 8 + 1.4 + (i % 9 === 4 ? 6 : 0), sz + Math.sin(a) * 80); } }
  L.giantRing(-655, H(-655, -720) + 6, -720, 1);
  L.giantRing(470, H(470, 760) + 5, 760, 2);
  // more cages to rescue
  for (let i = 0; i < 10; i++) { const x = (r() * 2 - 1) * 800, z = (r() * 2 - 1) * 800; if (H(x, z) > 2) L.cage(x, z); }

  L.buildRingMesh();
}

function cityMaterial(p) {
  const tex = canvasTex(64, 64, (g) => { g.fillStyle = '#1b2030'; g.fillRect(0, 0, 64, 64); for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const on = Math.random() < 0.55; g.fillStyle = on ? ['#ffd27a', '#9fe8ff', '#ff9ad6'][Math.floor(Math.random() * 3)] : '#2a3248'; g.fillRect(x * 16 + 3, y * 16 + 4, 10, 9); } }, { repeat: true });
  if (p.mat === 0) return new THREE.MeshLambertMaterial({ map: tex, emissiveMap: tex, emissive: 0x555555 });
  return new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.5, metalness: 0.4, roughness: 0.35 });
}
function mergeBoxes(geos) {
  let n = 0, ni = 0; for (const g of geos) { n += g.attributes.position.count; ni += g.index.count; }
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), idx = new Uint32Array(ni);
  let o = 0, oi = 0;
  for (const g of geos) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); uv.set(g.attributes.uv.array, o * 2); const I = g.index.array; for (let i = 0; i < I.length; i++) idx[oi + i] = I[i] + o; o += g.attributes.position.count; oi += I.length; g.dispose(); }
  const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); m.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); m.setIndex(new THREE.BufferAttribute(idx, 1)); m.computeBoundingSphere(); return m;
}
