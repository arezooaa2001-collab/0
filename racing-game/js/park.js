// شهربازی: چرخ و فلک، چرخ گردون، ترن هوایی، صندلی پرنده، برج سقوط، ماشین برقی، زمین بازی و غرفه‌ها
// همه وسایل با دکمه تعامل قابل استفاده‌اند
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mulberry32, clamp, lerp, mergeGeos, optimizeStatic, fillAttr, vertexPBRMaterial, TAU, damp } from './utils.js';
import * as T from './textures.js';
import { mat } from './furniture.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const rb = (w, h, d, r = 0.05) => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));
function vc(geo, hex, metal = 0, rough = 0.6) { const c = new THREE.Color(hex); fillAttr(geo, 'color', [c.r, c.g, c.b]); fillAttr(geo, 'aMR', [metal, rough]); return geo; }
const VP = ['position', 'normal', 'uv', 'color', 'aMR'];
function beam(a, b, r, seg = 8) { // استوانه بین دو نقطه
  const d = b.clone().sub(a); const L = d.length(); const g = new THREE.CylinderGeometry(r, r, L, seg, 1); g.translate(0, L / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize()); g.applyQuaternion(q); g.translate(a.x, a.y, a.z); return g;
}
const bulbMat = () => new THREE.MeshStandardMaterial({ color: 0xfff4c2, emissive: 0xffd27a, emissiveIntensity: 1.6, roughness: 0.4 });

export function buildPark(world, rect) {
  const G = new THREE.Group(); world.group.add(G);
  const cx = (rect.x0 + rect.x1) / 2, cz = (rect.z0 + rect.z1) / 2, W = rect.x1 - rect.x0;
  const rng = mulberry32(77);
  const park = { rides: [], paths: [], updaters: [], center: V(cx, 0, cz), bulbs: [] };
  const C = world.colliders, I = world.inter;
  const add = (geo, m, x = 0, y = 0, z = 0, parent = G) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.castShadow = true; me.receiveShadow = true; parent.add(me); return me; };
  const L = (x, z) => V(cx + x, 0, cz + z);

  // ---------- زمین، مسیرها، حصار و ورودی ----------
  const gm = new THREE.MeshStandardMaterial({ map: T.grass().map.clone(), roughness: 0.95, color: 0xdcefcf }); gm.map.repeat.set(40, 40); gm.map.needsUpdate = true;
  const lawn = add(new THREE.PlaneGeometry(W, W), gm, cx, 0.02, cz); lawn.rotation.x = -Math.PI / 2; lawn.castShadow = false;
  const paveM = new THREE.MeshStandardMaterial({ map: T.tiles('#d8c7a6', 6).clone(), roughness: 0.75, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }); paveM.map.repeat.set(1, 1); paveM.map.needsUpdate = true;
  const paths = [];
  const ring = new THREE.RingGeometry(58, 64, 96, 1); ring.rotateX(-Math.PI / 2); { const uv = ring.attributes.uv, p = ring.attributes.position; for (let k = 0; k < uv.count; k++) uv.setXY(k, p.getX(k) / 3, p.getZ(k) / 3); } paths.push(ring);
  for (const [x0, z0, x1, z1] of [[-W / 2, -3, -58, 3], [58, -3, W / 2, 3], [-3, -W / 2, 3, -58], [-3, 58, 3, W / 2], [-3, -58, 3, 58], [-58, -3, 58, 3]]) {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0); g.rotateX(-Math.PI / 2); g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
    const uv = g.attributes.uv, p = g.attributes.position; for (let k = 0; k < uv.count; k++) uv.setXY(k, p.getX(k) / 3, p.getZ(k) / 3); paths.push(g);
  }
  const pm = add(mergeGeos(paths), paveM, cx, 0.07, cz); pm.castShadow = false;
  // حصار فلزی دور پارک
  const fg = []; const fy = 1.6; const h2 = W / 2 - 0.6;
  for (const [ax, az, bx, bz] of [[-h2, -h2, h2, -h2], [h2, -h2, h2, h2], [h2, h2, -h2, h2], [-h2, h2, -h2, -h2]]) {
    const len = Math.hypot(bx - ax, bz - az); const n = Math.floor(len / 0.3);
    for (let k = 0; k <= n; k++) { const t = k / n; const x = lerp(ax, bx, t), z = lerp(az, bz, t); if (Math.abs(x) < 6 && Math.abs(Math.abs(z) - h2) < 0.1 || Math.abs(z) < 6 && Math.abs(Math.abs(x) - h2) < 0.1) continue; const b = new THREE.BoxGeometry(0.03, fy, 0.03); b.translate(x, fy / 2, z); fg.push(b); }
  }
  for (const s of [-1, 1]) for (const ax of ['x', 'z']) for (const y of [0.1, fy]) for (const side of [-1, 1]) {
    const len = h2 - 6; const b = ax === 'x' ? new THREE.BoxGeometry(len, 0.05, 0.05) : new THREE.BoxGeometry(0.05, 0.05, len);
    if (ax === 'x') b.translate(side * (6 + len / 2), y, s * h2); else b.translate(s * h2, y, side * (6 + len / 2)); fg.push(b);
  }
  add(mergeGeos(fg), mat(0x1f3b2c, 0.5, 0.6), cx, 0, cz).castShadow = false;
  // برخورد حصار (چهار ضلع با درگاه وسط)
  const fenceBox = (x0, z0, x1, z1) => C.box(cx + Math.min(x0, x1), cz + Math.min(z0, z1), cx + Math.max(x0, x1), cz + Math.max(z0, z1), 3);
  for (const s of [-1, 1]) { fenceBox(-h2, s * h2 - 0.2, -6, s * h2 + 0.2); fenceBox(6, s * h2 - 0.2, h2, s * h2 + 0.2); fenceBox(s * h2 - 0.2, -h2, s * h2 + 0.2, -6); fenceBox(s * h2 - 0.2, 6, s * h2 + 0.2, h2); }
  // دروازه ورودی با تابلو
  const signTex = T.signText('شهربازی قهرمان 🎡', '#7b1fa2', '#ffe066', 1024, 200, 120);
  for (const [x, z, ry] of [[-h2, 0, Math.PI / 2], [0, -h2, 0], [h2, 0, -Math.PI / 2], [0, h2, Math.PI]]) {
    const gg = new THREE.Group(); gg.position.set(cx + x, 0, cz + z); gg.rotation.y = ry; G.add(gg);
    for (const sx of [-6.5, 6.5]) { add(new THREE.CylinderGeometry(0.7, 0.8, 8, 16), mat(0xe63946, 0.5), sx, 4, 0, gg); add(new THREE.ConeGeometry(1.1, 2, 16), mat(0xffd166, 0.5), sx, 9, 0, gg); add(new THREE.SphereGeometry(0.3, 12, 8), mat(0xffffff, 0.3), sx, 10.2, 0, gg); }
    const arch = new THREE.TorusGeometry(6.5, 0.4, 10, 32, Math.PI); add(arch, mat(0xffd166, 0.4, 0.3), 0, 8, 0, gg);
    const sg = add(new THREE.PlaneGeometry(10, 2), new THREE.MeshStandardMaterial({ map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.35, side: THREE.DoubleSide }), 0, 7, 0.45, gg); sg.castShadow = false;
    for (const sx of [-6.5, 6.5]) { const a = V(cx, 0, cz).add(V(sx, 0, 0).applyAxisAngle(V(0, 1, 0), ry)).add(V(x, 0, z)); C.circle(a.x, a.z, 0.8, 3); }
  }

  // ---------- کمک: ثبت وسیله سواری ----------
  const addRide = (o) => { const r = { dur: 30, pose: 'ridePark', seatY: 0.46, ...o }; park.rides.push(r); I.add({ pos: o.at, r: o.r || 2.6, pri: 0.6, label: o.label, act: (g) => g.ride(r) }); return r; };
  const seatObj = (parent) => { const s = new THREE.Object3D(); parent.add(s); return s; };
  const near = (p, d = 220) => world.focus && world.focus.distanceToSquared(p) < d * d;

  // ---------- چرخ و فلک بزرگ ----------
  {
    const P = L(52, -52); const R = 20, H = 23.5, N = 16;
    const base = new THREE.Group(); base.position.copy(P); base.rotation.y = Math.PI / 4; G.add(base);
    const steel = mat(0xf1f3f5, 0.35, 0.7);
    const legs = []; for (const z of [-1.8, 1.8]) for (const x of [-9, 9]) legs.push(beam(V(x, 0, z * 2.2), V(0, H, z), 0.35, 10));
    for (const z of [-1.8, 1.8]) legs.push(beam(V(-6.5, 7, z * 1.9), V(6.5, 7, z * 1.9), 0.22, 8));
    add(mergeGeos(legs), steel, 0, 0, 0, base);
    add(new THREE.BoxGeometry(14, 0.8, 7), mat(0x495057, 0.8), 0, 0.4, 0, base);
    add(new THREE.BoxGeometry(5, 0.6, 3), mat(0xadb5bd, 0.7), 0, 1.0, 3.8, base); // سکوی سوار شدن
    const rotor = new THREE.Group(); rotor.position.set(0, H, 0); rotor.userData.dynamic = true; base.add(rotor);
    const rg = [];
    for (const z of [-1.4, 1.4]) { const t = new THREE.TorusGeometry(R, 0.22, 8, 96); t.translate(0, 0, z); rg.push(vc(t, 0xe63946, 0.5, 0.4)); const t2 = new THREE.TorusGeometry(R * 0.55, 0.15, 6, 64); t2.translate(0, 0, z); rg.push(vc(t2, 0xffffff, 0.6, 0.4)); }
    for (let k = 0; k < N; k++) { const a = k / N * TAU; const e = V(Math.cos(a) * R, Math.sin(a) * R, 0); for (const z of [-1.4, 1.4]) rg.push(vc(beam(V(0, 0, z * 0.5), V(e.x, e.y, z), 0.09, 6), 0xffffff, 0.7, 0.35)); rg.push(vc(beam(V(e.x, e.y, -1.4), V(e.x, e.y, 1.4), 0.08, 6), 0xffffff, 0.7, 0.35)); }
    const hub = new THREE.CylinderGeometry(1.2, 1.2, 3.6, 24); hub.rotateX(Math.PI / 2); rg.push(vc(hub, 0xffd166, 0.6, 0.3));
    add(mergeGeos(rg, VP), vertexPBRMaterial(), 0, 0, 0, rotor);
    // لامپ‌های رنگی روی چرخ
    const bg = []; for (let k = 0; k < 96; k++) { const a = k / 96 * TAU; for (const z of [-1.62, 1.62]) { const s = new THREE.SphereGeometry(0.13, 6, 4); s.translate(Math.cos(a) * R, Math.sin(a) * R, z); bg.push(s); } }
    const bm = bulbMat(); park.bulbs.push(bm); const bulbs = add(mergeGeos(bg), bm, 0, 0, 0, rotor); bulbs.castShadow = false;
    // کابین‌ها (Instanced، همیشه صاف)
    const cg = [vc(rb(2.0, 1.9, 1.6, 0.25), 0xffffff, 0.2, 0.4), vc(new THREE.CylinderGeometry(0.06, 0.06, 1.3, 6).translate(0, 1.55, 0), 0xcccccc, 0.8, 0.3)];
    const roof = rb(2.3, 0.18, 1.9, 0.08); roof.translate(0, 1.0, 0); cg.push(vc(roof, 0xffffff, 0.2, 0.4));
    for (const sx of [-1, 1]) { const w = new THREE.BoxGeometry(0.02, 0.8, 1.2); w.translate(sx * 1.0, 0.25, 0); cg.push(vc(w, 0x203040, 0.6, 0.1)); }
    const cabGeo = mergeGeos(cg, VP); cabGeo.translate(0, -2.2, 0);
    const cabs = new THREE.InstancedMesh(cabGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.2 }), N);
    cabs.material.onBeforeCompile = vertexPBRMaterial().onBeforeCompile; cabs.material.customProgramCacheKey = () => 'vpbr-cab';
    const colors = [0xe63946, 0xffd166, 0x06d6a0, 0x118ab2, 0x8338ec, 0xff70a6, 0xfb5607, 0x3a86ff];
    for (let k = 0; k < N; k++) cabs.setColorAt(k, new THREE.Color(colors[k % colors.length]));
    cabs.castShadow = true; cabs.userData.keep = true; cabs.frustumCulled = false; base.add(cabs);
    const seats = []; for (let k = 0; k < N; k++) { const s = seatObj(base); seats.push(s); }
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = V(1, 1, 1), tmp = V(0, 0, 0);
    let ang = 0;
    const place = () => { for (let k = 0; k < N; k++) { const a = k / N * TAU + ang; tmp.set(Math.cos(a) * R, H + Math.sin(a) * R, 0); m4.compose(tmp, q.identity(), one); cabs.setMatrixAt(k, m4); seats[k].position.set(tmp.x + 0.45, tmp.y - 3.0, 0.2); } cabs.instanceMatrix.needsUpdate = true; };
    place();
    const wp = P.clone();
    park.updaters.push((dt) => { if (!near(wp, 300) && !park.active) return; ang += dt * 0.09; rotor.rotation.z = ang; place(); });
    C.obox(P.x, P.z, 9.6, 4.6, Math.PI / 4, 3);
    const entry = V(0, 0, 6.6).applyAxisAngle(V(0, 1, 0), Math.PI / 4).add(P);
    addRide({ name: 'wheel', at: entry.clone().setY(1), label: 'سوار شدن چرخ و فلک بزرگ 🎡', dur: 45, exit: entry.clone(), text: 'از بالای چرخ و فلک کل شهر پیداست!',
      pick: () => { let best = 0, by = 1e9; for (let k = 0; k < N; k++) { const y = Math.sin(k / N * TAU + ang); if (y < by) { by = y; best = k; } } return seats[best]; }, yawOff: Math.PI / 2, excite: () => 0.2 });
  }

  // ---------- چرخ گردون (کاروسل) ----------
  {
    const P = L(-48, -48); const R = 8.5;
    const base = new THREE.Group(); base.position.copy(P); G.add(base);
    add(new THREE.CylinderGeometry(R + 0.6, R + 0.8, 0.5, 48), mat(0x8d6e63, 0.7), 0, 0.25, 0, base);
    const rotor = new THREE.Group(); rotor.userData.dynamic = true; base.add(rotor);
    const rg = [vc(new THREE.CylinderGeometry(R, R, 0.3, 48).translate(0, 0.62, 0), 0xf8f1e5, 0.1, 0.5), vc(new THREE.CylinderGeometry(1.3, 1.3, 6.4, 24).translate(0, 3.6, 0), 0xffd166, 0.5, 0.3)];
    for (let k = 0; k < 24; k++) { const a = k / 24 * TAU; rg.push(vc(new THREE.BoxGeometry(0.7, 0.9, 0.06).rotateY(-a + Math.PI / 2).translate(Math.cos(a) * 1.33, 4.2, Math.sin(a) * 1.33), k % 2 ? 0xe63946 : 0x3a86ff, 0.2, 0.3)); }
    const canopy = new THREE.ConeGeometry(R + 0.9, 3.0, 24, 1, true); canopy.translate(0, 8.2, 0); rg.push(vc(canopy, 0xffffff, 0, 0.6));
    const valance = new THREE.CylinderGeometry(R + 0.9, R + 0.9, 0.9, 24, 1, true); valance.translate(0, 6.3, 0); rg.push(vc(valance, 0xffffff, 0, 0.6));
    const top = new THREE.SphereGeometry(0.6, 12, 8); top.translate(0, 10, 0); rg.push(vc(top, 0xffd166, 0.7, 0.3));
    const rotorMesh = add(mergeGeos(rg, VP), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, side: THREE.DoubleSide }), 0, 0, 0, rotor);
    rotorMesh.material.onBeforeCompile = vertexPBRMaterial().onBeforeCompile; rotorMesh.material.customProgramCacheKey = () => 'vpbr-ds';
    // نوار راه‌راه سایبان
    const stripeTex = T.stripes('#e63946', '#fff4e0', 24);
    const sc = new THREE.Mesh(new THREE.ConeGeometry(R + 0.95, 3.0, 48, 1, true), new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 0.7, side: THREE.DoubleSide })); sc.position.y = 8.21; rotor.add(sc);
    const bg = []; for (let k = 0; k < 48; k++) { const a = k / 48 * TAU; const s = new THREE.SphereGeometry(0.11, 6, 4); s.translate(Math.cos(a) * (R + 0.95), 5.85, Math.sin(a) * (R + 0.95)); bg.push(s); }
    const bm = bulbMat(); park.bulbs.push(bm); rotor.add(new THREE.Mesh(mergeGeos(bg), bm));
    // اسب‌ها
    const hg = [];
    const horseC = 0xffffff;
    hg.push(vc(new THREE.CapsuleGeometry(0.28, 0.9, 3, 10).rotateX(Math.PI / 2), horseC, 0.1, 0.35));
    hg.push(vc(new THREE.CapsuleGeometry(0.13, 0.5, 2, 8).rotateX(-0.6).translate(0, 0.38, 0.62), horseC, 0.1, 0.35));
    hg.push(vc(new THREE.CapsuleGeometry(0.13, 0.34, 2, 8).rotateX(Math.PI / 2 - 0.3).translate(0, 0.62, 0.86), horseC, 0.1, 0.35));
    for (const [x, z, rx] of [[-0.14, 0.42, -0.7], [0.14, 0.42, 0.9], [-0.14, -0.42, 0.6], [0.14, -0.42, -0.5]]) hg.push(vc(new THREE.CapsuleGeometry(0.06, 0.55, 2, 6).translate(0, -0.3, 0).rotateX(rx).translate(x, -0.15, z), horseC, 0.1, 0.35));
    hg.push(vc(new THREE.BoxGeometry(0.06, 0.4, 0.4).rotateX(-0.6).translate(0, 0.55, 0.45), 0xffd166, 0.6, 0.3)); // یال
    hg.push(vc(new THREE.BoxGeometry(0.62, 0.1, 0.5).translate(0, 0.3, -0.05), 0xe63946, 0.1, 0.6)); // زین
    hg.push(vc(new THREE.CylinderGeometry(0.04, 0.04, 5.0, 8).translate(0, 0.9, 0), 0xffd166, 0.9, 0.2)); // میله
    const horseGeo = mergeGeos(hg, VP);
    const NH = 12; const horses = new THREE.InstancedMesh(horseGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4 }), NH);
    horses.material.onBeforeCompile = vertexPBRMaterial().onBeforeCompile; horses.material.customProgramCacheKey = () => 'vpbr-h';
    const hcols = [0xffffff, 0xf4d7b4, 0x6d4c41, 0xffffff, 0x9e9e9e, 0xf4d7b4];
    for (let k = 0; k < NH; k++) horses.setColorAt(k, new THREE.Color(hcols[k % hcols.length]));
    horses.castShadow = true; horses.userData.keep = true; rotor.add(horses);
    const seats = []; for (let k = 0; k < NH; k++) seats.push(seatObj(rotor));
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = V(1, 1, 1), tp = V(0, 0, 0);
    let a = 0, tt = 0;
    const place = () => { for (let k = 0; k < NH; k++) { const ak = k / NH * TAU; const rr = k % 2 ? R - 2.2 : R - 1.0; const y = 1.75 + Math.sin(tt * 2.2 + k * 1.7) * 0.32; tp.set(Math.cos(ak) * rr, y, Math.sin(ak) * rr); q.setFromAxisAngle(V(0, 1, 0), -ak); m4.compose(tp, q, one); horses.setMatrixAt(k, m4); seats[k].position.set(tp.x, y + 0.36, tp.z); seats[k].rotation.y = -ak; } horses.instanceMatrix.needsUpdate = true; };
    place();
    park.updaters.push((dt) => { if (!near(P) && !park.active) return; tt += dt; a += dt * 0.55; rotor.rotation.y = a; place(); });
    C.circle(P.x, P.z, R + 0.8, 3);
    const entry = P.clone().add(V(0, 0, R + 2.2));
    addRide({ name: 'carousel', at: entry.clone().setY(1), label: 'سوار شدن چرخ گردون 🐴', dur: 26, exit: entry.clone(), pick: () => seats[(Math.random() * NH) | 0], seatY: 0.42, pose: 'ridePark', excite: () => 0.3, text: 'اسب چرخ گردون بالا و پایین می‌رود 🎠' });
  }

  // ---------- ترن هوایی ----------
  {
    const pts = [[10, 2, 22], [35, 2, 22], [52, 10, 22], [68, 26, 22], [80, 30, 26], [89, 22, 32], [96, 5, 42], [100, 5, 58], [95, 16, 72], [83, 20, 80], [66, 8, 88], [48, 3, 96], [30, 9, 97], [17, 14, 88], [8, 8, 72], [4, 4, 52], [3, 2.5, 34]].map(([x, y, z]) => V(cx + x - 8, y, cz + z - 8));
    const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
    const Ltot = curve.getLength(); const NS = Math.ceil(Ltot / 1.2);
    const frames = []; const up = V(0, 1, 0);
    for (let k = 0; k <= NS; k++) { const u = k / NS; const p = curve.getPointAt(u % 1), t = curve.getTangentAt(u % 1); const r = V().crossVectors(up, t).normalize(); const n = V().crossVectors(t, r); frames.push({ p, t, r, n }); }
    const railPts = (off, dy) => frames.map((f) => f.p.clone().addScaledVector(f.r, off).addScaledVector(f.n, dy));
    const tube = (list, rad) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(list.slice(0, -1), true), NS * 2, rad, 6, true);
    const tg = [vc(tube(railPts(0.55, 0), 0.075), 0x1d4ed8, 0.8, 0.3), vc(tube(railPts(-0.55, 0), 0.075), 0x1d4ed8, 0.8, 0.3), vc(tube(railPts(0, -0.35), 0.13), 0xffd166, 0.7, 0.35)];
    for (let k = 0; k < NS; k += 1) { const f = frames[k]; const b = new THREE.BoxGeometry(1.3, 0.08, 0.14); const m = new THREE.Matrix4().makeBasis(f.r, f.n, f.t); m.setPosition(f.p.clone().addScaledVector(f.n, -0.12)); b.applyMatrix4(m); tg.push(vc(b, 0x6c757d, 0.6, 0.4)); }
    for (let k = 0; k < NS; k += 5) { const f = frames[k]; if (f.p.y < 1.4) continue; for (const s of [-0.5, 0.5]) tg.push(vc(beam(V(f.p.x + f.r.x * s, 0, f.p.z + f.r.z * s), f.p.clone().addScaledVector(f.r, s * 0.6).addScaledVector(f.n, -0.3), 0.12, 6), 0xf1f3f5, 0.6, 0.35)); if (k % 10 === 0 && f.p.y > 6) tg.push(vc(beam(V(f.p.x - f.r.x * 0.5, f.p.y * 0.5, f.p.z - f.r.z * 0.5), V(f.p.x + f.r.x * 0.5, f.p.y * 0.5, f.p.z + f.r.z * 0.5), 0.07, 5), 0xf1f3f5, 0.6, 0.35)); }
    add(mergeGeos(tg, VP), vertexPBRMaterial(), 0, 0, 0);
    // ایستگاه
    const st = L(15, 14 + 6);
    add(new THREE.BoxGeometry(24, 1.4, 4), mat(0x9a948a, 0.8), st.x, 0.7, st.z - 1.8 - 2.0);
    add(new THREE.BoxGeometry(26, 0.3, 9), mat(0x7b1fa2, 0.6), st.x, 5.2, st.z);
    for (const x of [-12, 12]) for (const z of [-4, 4]) add(new THREE.CylinderGeometry(0.15, 0.15, 5, 8), mat(0xf1f3f5, 0.4, 0.6), st.x + x, 2.6, st.z + z);
    const sgn = add(new THREE.PlaneGeometry(9, 1.6), new THREE.MeshStandardMaterial({ map: T.signText('ترن هوایی 🎢', '#7b1fa2', '#fff', 1024, 180, 110), side: THREE.DoubleSide }), st.x, 6.3, st.z - 4.6); sgn.rotation.y = Math.PI;
    C.box(st.x - 12, st.z - 5.8, st.x + 12, st.z - 1.8, 3);
    for (let k = 0; k < NS; k += 3) { const f = frames[k]; if (f.p.y > 3.2) continue; const d = Math.hypot(f.p.x - st.x, f.p.z - st.z); if (d < 13) continue; C.circle(f.p.x, f.p.z, 0.9, 3); }
    for (let k = 0; k < NS; k += 5) { const f = frames[k]; if (f.p.y >= 1.4) for (const s of [-0.5, 0.5]) C.circle(f.p.x + f.r.x * s, f.p.z + f.r.z * s, 0.25, 3); }
    // قطار: ۴ واگن
    const carG = [vc(rb(1.5, 0.7, 2.0, 0.2).translate(0, 0.35, 0), 0xe63946, 0.4, 0.35), vc(rb(1.3, 0.5, 0.25, 0.08).translate(0, 0.8, -0.85), 0x111111, 0.2, 0.6), vc(rb(1.2, 0.08, 0.9, 0.03).translate(0, 0.72, -0.2), 0x222222, 0, 0.8)];
    for (const sx of [-0.55, 0.55]) for (const sz of [-0.7, 0.7]) carG.push(vc(new THREE.CylinderGeometry(0.13, 0.13, 0.12, 12).rotateZ(Math.PI / 2).translate(sx, -0.02, sz), 0x333333, 0.7, 0.4));
    const front = rb(1.5, 0.9, 0.6, 0.25); front.translate(0, 0.45, 1.1); carG.push(vc(front, 0xffd166, 0.5, 0.3));
    const NC = 4; const cars = new THREE.InstancedMesh(mergeGeos(carG, VP), new THREE.MeshStandardMaterial({ vertexColors: true }), NC);
    cars.material.onBeforeCompile = vertexPBRMaterial().onBeforeCompile; cars.material.customProgramCacheKey = () => 'vpbr-car';
    cars.castShadow = true; cars.userData.keep = true; cars.frustumCulled = false; G.add(cars);
    const seats = []; for (let k = 0; k < NC; k++) seats.push(seatObj(G));
    let s = 0.02 * Ltot, v = 3;
    const m4 = new THREE.Matrix4(); const tmpT = V(), tmpR = V(), tmpN = V(); const q = new THREE.Quaternion();
    const place = () => {
      for (let k = 0; k < NC; k++) {
        const u = (((s - k * 2.3) % Ltot) + Ltot) % Ltot / Ltot;
        const p = curve.getPointAt(u); curve.getTangentAt(u, tmpT); tmpR.crossVectors(up, tmpT).normalize(); tmpN.crossVectors(tmpT, tmpR);
        m4.makeBasis(tmpR, tmpN, tmpT); m4.setPosition(p.x, p.y + 0.08, p.z); cars.setMatrixAt(k, m4);
        const se = seats[k]; se.position.copy(p).addScaledVector(tmpN, 0.66).addScaledVector(tmpT, -0.2); q.setFromRotationMatrix(m4); se.quaternion.copy(q);
      }
      cars.instanceMatrix.needsUpdate = true;
    };
    place();
    let wait = 0; const Hmax = 31;
    const coaster = { lap: 0 };
    park.updaters.push((dt) => {
      if (!near(L(50, 50), 320) && !park.active) return;
      const u = (s % Ltot) / Ltot; const p = curve.getPointAt(u); const t = curve.getTangentAt(u);
      if (wait > 0) { wait -= dt; v = 0; }
      else if (u < 0.26 && t.y > 0.05) v = damp(v, 3.6, 3, dt); // زنجیر بالابر
      else if (u > 0.93 || u < 0.03) { v = damp(v, 2.6, 2, dt); if (u > 0.985 && !coaster.stopped) { coaster.stopped = true; wait = 4; coaster.lap++; } }
      else v = Math.max(3.5, Math.sqrt(Math.max(0, 2 * 9.81 * (Hmax + 0.6 - p.y))) * 0.93);
      if (u > 0.1 && u < 0.5) coaster.stopped = false;
      s = (s + v * dt) % Ltot; coaster.v = v; place();
    });
    const entry = V(st.x, 0, st.z + 2.5);
    addRide({ name: 'coaster', onStart: () => { s = 0.988 * Ltot; v = 2; wait = 3; coaster.stopped = true; place(); }, at: entry.clone().setY(1), label: 'سوار شدن ترن هوایی 🎢', dur: 60, exit: entry.clone(), pick: () => seats[1], seatY: 0.42, yawOff: 0, excite: () => clamp((coaster.v - 6) / 14, 0, 1), text: 'آماده باش! ترن هوایی حرکت می‌کند 🎢', cam: 'seat',
      until: () => coaster.lap, done: (l0) => coaster.lap > l0 });
    park.coaster = coaster;
  }

  // ---------- صندلی پرنده ----------
  {
    const P = L(-50, 48); const Rr = 5.5, Hp = 10.5, N = 16, chain = 6;
    const base = new THREE.Group(); base.position.copy(P); G.add(base);
    add(new THREE.CylinderGeometry(9, 9.3, 0.3, 40), mat(0x8d99ae, 0.7), 0, 0.15, 0, base);
    add(new THREE.CylinderGeometry(0.7, 1.1, 12, 20), mat(0x3a86ff, 0.4, 0.5), 0, 6, 0, base);
    const top = new THREE.Group(); top.position.y = 12; top.userData.dynamic = true; base.add(top);
    const tg = [vc(new THREE.ConeGeometry(7.2, 2.2, 32).translate(0, 0.6, 0), 0xff70a6, 0.2, 0.5), vc(new THREE.CylinderGeometry(7.2, 7.2, 0.7, 32).translate(0, -0.85, 0), 0xffd166, 0.4, 0.4), vc(new THREE.SphereGeometry(0.7, 12, 8).translate(0, 1.9, 0), 0xffffff, 0.6, 0.3)];
    add(mergeGeos(tg, VP), vertexPBRMaterial(), 0, 0, 0, top);
    const bg = []; for (let k = 0; k < 40; k++) { const a = k / 40 * TAU; const s = new THREE.SphereGeometry(0.12, 6, 4); s.translate(Math.cos(a) * 7.25, -0.85, Math.sin(a) * 7.25); bg.push(s); }
    const bm = bulbMat(); park.bulbs.push(bm); top.add(new THREE.Mesh(mergeGeos(bg), bm));
    const chG = [vc(new THREE.CylinderGeometry(0.015, 0.015, chain, 4).translate(-0.25, -chain / 2, 0), 0xcccccc, 0.9, 0.3), vc(new THREE.CylinderGeometry(0.015, 0.015, chain, 4).translate(0.25, -chain / 2, 0), 0xcccccc, 0.9, 0.3), vc(rb(0.6, 0.08, 0.5, 0.03).translate(0, -chain, 0), 0x1d3557, 0.3, 0.5), vc(rb(0.6, 0.5, 0.06, 0.03).translate(0, -chain + 0.27, -0.24), 0x1d3557, 0.3, 0.5)];
    const chairs = new THREE.InstancedMesh(mergeGeos(chG, VP), new THREE.MeshStandardMaterial({ vertexColors: true }), N);
    chairs.material.onBeforeCompile = vertexPBRMaterial().onBeforeCompile; chairs.material.customProgramCacheKey = () => 'vpbr-ch';
    chairs.castShadow = true; chairs.userData.keep = true; chairs.frustumCulled = false; base.add(chairs);
    const seats = []; for (let k = 0; k < N; k++) seats.push(seatObj(base));
    let a = 0, w = 0, tt = rng() * 20; const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YZX'), one = V(1, 1, 1), tp = V(), so = V();
    const place = () => { const tilt = Math.atan2(w * w * (Rr + 3), 9.81) * 0.9; for (let k = 0; k < N; k++) { const ak = k / N * TAU + a; tp.set(Math.cos(ak) * Rr, Hp, Math.sin(ak) * Rr); e.set(0, -ak, tilt); q.setFromEuler(e); m4.compose(tp, q, one); chairs.setMatrixAt(k, m4); so.set(0, -chain + 0.06, 0.02).applyQuaternion(q).add(tp); seats[k].position.copy(so); seats[k].quaternion.copy(q); seats[k].rotateY(-Math.PI / 2); } chairs.instanceMatrix.needsUpdate = true; };
    place();
    park.updaters.push((dt) => { if (!near(P) && !park.active) return; tt += dt; const ph = tt % 36; const target = ph < 6 ? 0 : ph < 30 ? 1.25 : 0; w = damp(w, target, 0.6, dt); a += w * dt; top.rotation.y = -a; place(); });
    C.circle(P.x, P.z, 9.3, 3);
    const entry = P.clone().add(V(0, 0, -10.5));
    addRide({ name: 'swings', onStart: () => { tt = 3; }, at: entry.clone().setY(1), label: 'سوار شدن صندلی پرنده 🪂', dur: 30, exit: entry.clone(), pick: () => seats[(Math.random() * N) | 0], seatY: 0.46, excite: () => clamp(w / 1.25, 0, 1), text: 'صندلی‌ها به پرواز درآمدند!' });
  }

  // ---------- برج سقوط ----------
  {
    const P = L(72, 4); const Ht = 46;
    const base = new THREE.Group(); base.position.copy(P); G.add(base);
    add(new THREE.CylinderGeometry(6, 6.5, 0.6, 32), mat(0x6c757d, 0.8), 0, 0.3, 0, base);
    add(new THREE.CylinderGeometry(1.4, 1.8, Ht, 20), mat(0x212529, 0.35, 0.6), 0, Ht / 2, 0, base);
    add(new THREE.CylinderGeometry(2.4, 2.4, 2.2, 20), mat(0xe63946, 0.4, 0.4), 0, Ht + 1.1, 0, base);
    const bg = []; for (let y = 2; y < Ht; y += 1.5) for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + y; const s = new THREE.SphereGeometry(0.13, 6, 4); s.translate(Math.cos(a) * 1.55, y, Math.sin(a) * 1.55); bg.push(s); }
    const bm = bulbMat(); park.bulbs.push(bm); base.add(new THREE.Mesh(mergeGeos(bg), bm));
    const carr = new THREE.Group(); carr.userData.dynamic = true; base.add(carr);
    const rg = [vc(new THREE.TorusGeometry(2.6, 0.45, 10, 32).rotateX(Math.PI / 2), 0xffd166, 0.5, 0.35)];
    const NSeat = 10; for (let k = 0; k < NSeat; k++) { const a = k / NSeat * TAU; const sg = rb(0.6, 1.2, 0.5, 0.1); sg.translate(0, 0.2, 0); sg.rotateY(-a + Math.PI / 2); sg.translate(Math.cos(a) * 3.1, 0, Math.sin(a) * 3.1); rg.push(vc(sg, 0x1d3557, 0.3, 0.45)); const bar = new THREE.TorusGeometry(0.28, 0.04, 6, 12, Math.PI); bar.rotateY(-a); bar.translate(Math.cos(a) * 3.45, 0.55, Math.sin(a) * 3.45); rg.push(vc(bar, 0xcccccc, 0.9, 0.3)); }
    add(mergeGeos(rg, VP), vertexPBRMaterial(), 0, 0, 0, carr);
    const seats = []; for (let k = 0; k < NSeat; k++) { const a = k / NSeat * TAU; const s = seatObj(carr); s.position.set(Math.cos(a) * 3.55, -0.08, Math.sin(a) * 3.55); s.rotation.y = -a + Math.PI / 2; seats.push(s); }
    let tt = 0, y = 1.2, vy = 0; const st = { phase: 0 };
    park.updaters.push((dt) => {
      if (!near(P) && !park.active) return; tt += dt; const ph = tt % 30;
      if (ph < 6) { y = damp(y, 1.2, 4, dt); vy = 0; st.phase = 0; }
      else if (ph < 19) { y = lerp(1.2, Ht - 3, (ph - 6) / 13); st.phase = 1; }
      else if (ph < 22) { y = Ht - 3; st.phase = 2; }
      else { if (y > 10) { vy -= 9.81 * dt; y += vy * dt; st.phase = 3; } else { vy = damp(vy, 0, 3.5, dt); y = Math.max(1.2, y + vy * dt); st.phase = 4; } }
      carr.position.y = y; st.y = y;
    });
    C.circle(P.x, P.z, 6.4, 3);
    const entry = P.clone().add(V(-7.5, 0, 0));
    addRide({ name: 'drop', onStart: () => { tt = 2.5; y = 1.2; vy = 0; }, at: entry.clone().setY(1), label: 'سوار شدن برج سقوط ⬇️', dur: 30, exit: entry.clone(), pick: () => seats[5], seatY: 0.46, excite: () => (st.phase === 3 ? 1 : st.phase === 2 ? 0.6 : 0.15), text: 'بالا... بالا... و سقوط! 😱' });
  }

  // ---------- ماشین برقی (قابل رانندگی) ----------
  {
    const P = L(-4, 82); const aw = 30, ad = 18;
    const base = new THREE.Group(); base.position.copy(P); G.add(base);
    const floorM = new THREE.MeshStandardMaterial({ color: 0x8a939c, metalness: 0.8, roughness: 0.35 });
    add(new THREE.BoxGeometry(aw + 2, 0.3, ad + 2), mat(0x343a40, 0.8), 0, 0.15, 0, base);
    add(new THREE.BoxGeometry(aw, 0.05, ad), floorM, 0, 0.32, 0, base);
    const rail = []; for (const [x, z, w, d] of [[0, -ad / 2, aw, 0.4], [0, ad / 2, aw, 0.4], [-aw / 2, 0, 0.4, ad], [aw / 2, 0, 0.4, ad]]) { const b = new THREE.BoxGeometry(w, 0.5, d); b.translate(x, 0.55, z); rail.push(b); }
    add(mergeGeos(rail), mat(0xffd166, 0.5, 0.2), 0, 0, 0, base);
    for (const x of [-aw / 2, 0, aw / 2]) for (const z of [-ad / 2, ad / 2]) add(new THREE.CylinderGeometry(0.2, 0.2, 5, 8), mat(0xe63946, 0.4, 0.4), x, 2.8, z, base);
    add(new THREE.BoxGeometry(aw + 2, 0.4, ad + 2), mat(0x7b1fa2, 0.6), 0, 5.4, 0, base);
    const grid = new THREE.Mesh(new THREE.PlaneGeometry(aw, ad, 10, 6), new THREE.MeshBasicMaterial({ color: 0x555555, wireframe: true })); grid.rotation.x = Math.PI / 2; grid.position.y = 5.18; base.add(grid);
    const sg = add(new THREE.PlaneGeometry(9, 1.6), new THREE.MeshStandardMaterial({ map: T.signText('ماشین برقی ⚡', '#7b1fa2', '#fff', 1024, 180, 110), side: THREE.DoubleSide }), 0, 6.5, -ad / 2 - 1.05, base); sg.rotation.y = Math.PI;
    const bcG = [vc(rb(1.3, 0.45, 1.9, 0.2).translate(0, 0.45, 0), 0xffffff, 0.3, 0.3), vc(new THREE.TorusGeometry(0.85, 0.16, 8, 24).rotateX(Math.PI / 2).scale(0.85, 1, 1.15).translate(0, 0.3, 0), 0x111111, 0, 0.8), vc(rb(0.9, 0.45, 0.2, 0.06).translate(0, 0.85, -0.55), 0x222222, 0, 0.6), vc(new THREE.CylinderGeometry(0.03, 0.03, 4.4, 6).translate(0, 2.9, -0.75), 0x999999, 0.9, 0.3), vc(new THREE.TorusGeometry(0.17, 0.03, 6, 16).rotateX(-1.1).translate(0, 0.95, 0.3), 0x111111, 0, 0.6)];
    const NB = 8; const bcs = new THREE.InstancedMesh(mergeGeos(bcG, VP), new THREE.MeshStandardMaterial({ vertexColors: true }), NB);
    bcs.material.onBeforeCompile = vertexPBRMaterial().onBeforeCompile; bcs.material.customProgramCacheKey = () => 'vpbr-bc';
    const bcols = [0xe63946, 0x3a86ff, 0x06d6a0, 0xffd166, 0x8338ec, 0xff70a6, 0xfb5607, 0x118ab2];
    for (let k = 0; k < NB; k++) bcs.setColorAt(k, new THREE.Color(bcols[k]));
    bcs.castShadow = true; bcs.userData.keep = true; base.add(bcs);
    const cars = []; for (let k = 0; k < NB; k++) { const s = seatObj(base); cars.push({ x: (rng() - 0.5) * (aw - 4), z: (rng() - 0.5) * (ad - 4), yaw: rng() * TAU, v: 2, steer: 0, t: rng() * 3, seat: s }); }
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = V(1, 1, 1), tp = V();
    const sparks = { t: 0 };
    const bump = { ctrl: null, player: -1 };
    park.updaters.push((dt, t) => {
      if (!near(P) && !park.active) return;
      for (let k = 0; k < NB; k++) {
        const c = cars[k];
        if (k === bump.player && bump.ctrl) { const inp = bump.ctrl; c.v = damp(c.v, inp.throttle * 5.5, 2.5, dt); c.yaw -= inp.steer * dt * 2.2 * clamp(Math.abs(c.v) / 2, 0.3, 1) * Math.sign(c.v || 1); }
        else { c.t -= dt; if (c.t < 0) { c.t = 1 + rng() * 2.5; c.steer = (rng() - 0.5) * 2.4; } c.v = damp(c.v, 3.4, 1.5, dt); c.yaw += c.steer * dt; }
        c.x += Math.sin(c.yaw) * c.v * dt; c.z += Math.cos(c.yaw) * c.v * dt;
        const lx = aw / 2 - 1.1, lz = ad / 2 - 1.1;
        if (Math.abs(c.x) > lx) { c.x = Math.sign(c.x) * lx; c.yaw = -c.yaw; c.v *= -0.4; }
        if (Math.abs(c.z) > lz) { c.z = Math.sign(c.z) * lz; c.yaw = Math.PI - c.yaw; c.v *= -0.4; }
      }
      for (let a = 0; a < NB; a++) for (let b = a + 1; b < NB; b++) {
        const A = cars[a], B = cars[b]; const dx = B.x - A.x, dz = B.z - A.z; const d = Math.hypot(dx, dz);
        if (d < 1.9 && d > 0.001) { const push = (1.9 - d) / 2; const nx = dx / d, nz = dz / d; A.x -= nx * push; A.z -= nz * push; B.x += nx * push; B.z += nz * push; const imp = Math.abs(A.v) + Math.abs(B.v); A.v = -A.v * 0.5; B.v = -B.v * 0.5; if (imp > 3 && (a === bump.player || b === bump.player)) { bump.hit = 0.25; } }
      }
      for (let k = 0; k < NB; k++) { const c = cars[k]; tp.set(c.x, 0.33, c.z); q.setFromAxisAngle(V(0, 1, 0), c.yaw); m4.compose(tp, q, one); bcs.setMatrixAt(k, m4); c.seat.position.set(c.x - Math.sin(c.yaw) * 0.2, 0.62, c.z - Math.cos(c.yaw) * 0.2); c.seat.rotation.y = c.yaw; }
      bcs.instanceMatrix.needsUpdate = true;
    });
    C.box(P.x - aw / 2 - 1, P.z - ad / 2 - 1, P.x + aw / 2 + 1, P.z + ad / 2 + 1, 3);
    const entry = P.clone().add(V(0, 0, -ad / 2 - 2.2));
    addRide({ name: 'bumper', at: entry.clone().setY(1), label: 'سوار شدن ماشین برقی ⚡ (خودت رانندگی کن)', dur: 40, exit: entry.clone(), pick: () => { bump.player = 0; return cars[0].seat; }, seatY: 0.42, pose: 'drive', excite: () => 0.4, text: 'با جوی‌استیک یا کلیدها ماشین برقی را برانید و به بقیه بکوبید!',
      control: (inp) => { bump.ctrl = inp; }, onEnd: () => { bump.player = -1; bump.ctrl = null; }, bump });
  }

  // ---------- زمین بازی کودکان ----------
  {
    const P = L(-82, -4);
    const base = new THREE.Group(); base.position.copy(P); G.add(base);
    const sandM = new THREE.MeshStandardMaterial({ color: 0xe6cf98, roughness: 1 });
    add(new THREE.BoxGeometry(22, 0.1, 26), sandM, 0, 0.06, 0, base).castShadow = false;
    // تاب
    const frame = []; for (const x of [-3, 3]) { frame.push(beam(V(x, 0, -1.2), V(x, 3, 0), 0.07), beam(V(x, 0, 1.2), V(x, 3, 0), 0.07)); } frame.push(beam(V(-3.1, 3, 0), V(3.1, 3, 0), 0.08));
    add(mergeGeos(frame), mat(0x1d4ed8, 0.4, 0.6), 0, 0, -8, base);
    const swings = [];
    for (const x of [-1.4, 1.4]) {
      const piv = new THREE.Group(); piv.position.set(x, 3, -8); piv.userData.dynamic = true; base.add(piv);
      const sg = [vc(new THREE.CylinderGeometry(0.012, 0.012, 2.4, 4).translate(-0.25, -1.2, 0), 0xaaaaaa, 0.9, 0.3), vc(new THREE.CylinderGeometry(0.012, 0.012, 2.4, 4).translate(0.25, -1.2, 0), 0xaaaaaa, 0.9, 0.3), vc(new THREE.BoxGeometry(0.6, 0.05, 0.25).translate(0, -2.42, 0), 0x222222, 0, 0.7)];
      add(mergeGeos(sg, VP), vertexPBRMaterial(), 0, 0, 0, piv);
      const seat = seatObj(piv); seat.position.set(0, -2.4, 0);
      const sw = { piv, seat, amp: 0, ph: 0 }; swings.push(sw);
      addRide({ name: 'swing', at: P.clone().add(V(x, 1, -8 + 1.2)), r: 1.4, label: 'تاب بازی کردن', dur: 16, exit: P.clone().add(V(x, 0, -6.2)), pick: () => seat, seatY: 0.46, pose: 'swing', excite: () => sw.amp, onStart: () => { sw.active = true; }, onEnd: () => { sw.active = false; }, text: 'تاب می‌خوری... بالا و پایین 😊' });
    }
    park.updaters.push((dt, t) => { for (const s of swings) { s.amp = damp(s.amp, s.active ? 0.75 : 0, 0.5, dt); s.ph += dt * 2.2; s.piv.rotation.x = Math.sin(s.ph) * s.amp; } });
    C.box(P.x - 3.2, P.z - 9.3, P.x + 3.2, P.z - 9.0, 1); C.box(P.x - 3.2, P.z - 7, P.x + 3.2, P.z - 6.7, 1);
    // سرسره
    const sl = [];
    sl.push(beam(V(-0.4, 0, -1), V(-0.4, 2.6, -1), 0.05), beam(V(0.4, 0, -1), V(0.4, 2.6, -1), 0.05));
    for (let k = 0; k < 7; k++) { const b = new THREE.BoxGeometry(0.8, 0.05, 0.12); b.translate(0, 0.35 + k * 0.33, -1); sl.push(b); }
    add(mergeGeos(sl), mat(0xc0c4ca, 0.3, 0.8), 0, 0, 0, (() => { const gg = new THREE.Group(); gg.position.copy(P).add(V(6, 0, 4)); G.add(gg); return gg; })());
    const slideCurve = new THREE.CatmullRomCurve3([V(0, 2.6, -0.9), V(0, 2.3, 0), V(0, 1.2, 1.6), V(0, 0.45, 3.2), V(0, 0.4, 3.8)]);
    const slideG = new THREE.TubeGeometry(slideCurve, 24, 0.45, 10, false);
    const sm = add(slideG, new THREE.MeshStandardMaterial({ color: 0xff8800, roughness: 0.35, side: THREE.DoubleSide }), P.x + 6, 0.2, P.z + 4); sm.scale.set(1, 0.5, 1);
    const platf = add(new THREE.BoxGeometry(1.2, 0.1, 1.2), mat(0x06d6a0, 0.6), P.x + 6, 2.65, P.z + 3.1);
    C.box(P.x + 5.5, P.z + 2.8, P.x + 6.5, P.z + 8.2, 1);
    const slidePts = [V(0, 0, -1.6), V(0, 2.7, -0.95), V(0, 2.75, -0.6), ...[0.15, 0.35, 0.55, 0.75, 1].map((u) => slideCurve.getPoint(u).clone().setY(slideCurve.getPoint(u).y * 0.5 + 0.35))].map((p) => p.add(V(P.x + 6, 0, P.z + 4)));
    I.add({ pos: P.clone().add(V(6, 1, 2.2)), r: 1.8, label: 'سر خوردن از سرسره 🛝', act: (g) => g.path({ pts: slidePts, dur: 3.6, climb: 2, text: 'ویییی! 🛝' }) });
    // الاکلنگ
    const sawPiv = new THREE.Group(); sawPiv.position.copy(P).add(V(-6, 0.55, 4)); sawPiv.userData.dynamic = true; G.add(sawPiv);
    add(new THREE.BoxGeometry(0.3, 0.1, 4.2), mat(0xffd166, 0.6), 0, 0, 0, sawPiv);
    for (const z of [-1.9, 1.9]) add(new THREE.TorusGeometry(0.15, 0.03, 6, 12), mat(0x222222, 0.6), 0, 0.3, z, sawPiv);
    add(new THREE.CylinderGeometry(0.2, 0.3, 0.55, 12), mat(0x1d4ed8, 0.5), P.x - 6, 0.27, P.z + 4);
    const sawSeat = seatObj(sawPiv); sawSeat.position.set(0, 0.1, 1.75); sawSeat.rotation.y = Math.PI;
    const saw = { on: false, t: 0 };
    park.updaters.push((dt) => { saw.t += dt; sawPiv.rotation.x = saw.on ? Math.sin(saw.t * 2.4) * 0.2 : damp(sawPiv.rotation.x, 0.2, 2, dt); });
    addRide({ name: 'seesaw', at: P.clone().add(V(-6, 1, 6.4)), r: 1.6, label: 'بازی با الاکلنگ', dur: 14, exit: P.clone().add(V(-5, 0, 7)), pick: () => sawSeat, seatY: 0.46, pose: 'ridePark', excite: () => 0.5, onStart: () => { saw.on = true; }, onEnd: () => { saw.on = false; }, text: 'الاکلنگ بالا و پایین می‌رود' });
    // گنبد صخره‌نوردی
    const dome = new THREE.SphereGeometry(2.2, 10, 6, 0, TAU, 0, Math.PI / 2);
    const domeLines = new THREE.Mesh(new THREE.SphereGeometry(2.2, 10, 6, 0, TAU, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xe63946, wireframe: true })); domeLines.position.set(P.x + 5, 0.1, P.z - 3); G.add(domeLines);
    C.circle(P.x + 5, P.z - 3, 2.2, 1);
    I.add({ pos: P.clone().add(V(5, 1, -0.3)), r: 1.8, label: 'بالا رفتن از گنبد صخره‌نوردی', act: (g) => g.path({ pts: [P.clone().add(V(5, 0, -0.6)), P.clone().add(V(5, 1.2, -1.4)), P.clone().add(V(5, 2.3, -3)), P.clone().add(V(5, 2.3, -3)), P.clone().add(V(5, 1.2, -4.6)), P.clone().add(V(5, 0, -5.6))], dur: 5, pose: 'climb', text: 'از گنبد بالا رفتی! 🧗' }) });
    // اسب فنری
    const spring = new THREE.Group(); spring.position.copy(P).add(V(-6, 0, -2)); spring.userData.dynamic = true; G.add(spring);
    add(new THREE.CapsuleGeometry(0.25, 0.6, 3, 8).rotateX(Math.PI / 2), mat(0x06d6a0, 0.4), 0, 0.75, 0, spring); add(new THREE.SphereGeometry(0.22, 10, 8), mat(0x06d6a0, 0.4), 0, 1.05, 0.45, spring);
    add(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 8), mat(0x999999, 0.3, 0.8), P.x - 6, 0.25, P.z - 2);
    const springSeat = seatObj(spring); springSeat.position.set(0, 1.0, -0.1);
    const spr = { on: false, t: 0 };
    park.updaters.push((dt) => { spr.t += dt; spring.rotation.x = spr.on ? Math.sin(spr.t * 5) * 0.25 : damp(spring.rotation.x, 0, 3, dt); spring.rotation.z = spr.on ? Math.sin(spr.t * 3.3) * 0.1 : 0; });
    addRide({ name: 'spring', at: P.clone().add(V(-6, 1, -0.8)), r: 1.4, label: 'سوار شدن اسب فنری', dur: 10, exit: P.clone().add(V(-6, 0, -0.5)), pick: () => springSeat, seatY: 0.46, pose: 'ridePark', excite: () => 0.4, onStart: () => { spr.on = true; }, onEnd: () => { spr.on = false; } });
    // جعبه شن
    add(new THREE.BoxGeometry(4, 0.25, 4), mat(0x8a5a33, 0.7), P.x - 1, 0.12, P.z + 9).castShadow = false;
    add(new THREE.BoxGeometry(3.6, 0.05, 3.6), sandM, P.x - 1, 0.24, P.z + 9);
    const bucket = add(new THREE.CylinderGeometry(0.15, 0.11, 0.22, 12, 1, true), mat(0xe63946, 0.5), P.x - 1.6, 0.38, P.z + 8.6); bucket.material.side = THREE.DoubleSide;
    I.add({ pos: P.clone().add(V(-1, 0.6, 7)), r: 2, label: 'ساختن قلعه شنی 🏰', act: (g) => g.act('pickup', 3, { text: 'یک قلعه شنی زیبا ساختی 🏰', dust: true }) });
    C.box(P.x - 3, P.z + 7, P.x + 1, P.z + 11, 2);
  }

  // ---------- غرفه‌ها ----------
  const stall = (x, z, ry, title, color, act) => {
    const gg = new THREE.Group(); gg.position.set(cx + x, 0, cz + z); gg.rotation.y = ry; G.add(gg);
    add(rb(3.2, 1.1, 1.0, 0.04), mat(0xffffff, 0.5), 0, 0.55, 0.5, gg);
    add(new THREE.BoxGeometry(3.4, 2.6, 2.4), mat(color, 0.7), 0, 1.3, -0.9, gg);
    for (const sx of [-1.55, 1.55]) add(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 8), mat(0xffffff, 0.4), sx, 1.9, 0.95, gg);
    const awn = add(new THREE.BoxGeometry(3.6, 0.1, 1.6), new THREE.MeshStandardMaterial({ map: T.stripes('#ffffff', '#' + new THREE.Color(color).getHexString(), 12), roughness: 0.8 }), 0, 3.2, 0.4, gg); awn.rotation.x = 0.18;
    const sign = add(new THREE.PlaneGeometry(3.2, 0.6), new THREE.MeshStandardMaterial({ map: T.signText(title, '#1d1d2b', '#ffd166', 1024, 192, 100), emissive: 0xffffff, emissiveIntensity: 0.15 }), 0, 3.6, 1.0, gg); sign.material.emissiveMap = sign.material.map; sign.castShadow = false;
    gg.updateMatrixWorld(true);
    const c = V(0, 0, -0.4).applyMatrix4(gg.matrixWorld); C.obox(c.x, c.z, 1.8, 1.5, ry, 3);
    const ip = V(0, 1.2, 1.6).applyMatrix4(gg.matrixWorld);
    I.add({ pos: ip, r: 2.0, label: act.label, act: act.act });
    return gg;
  };
  stall(-20, -70, 0, 'پشمک 🍭', 0xff70a6, { label: 'خرید پشمک 🍭', act: (g) => g.act('eat', 2.5, { text: 'پشمک صورتی خیلی شیرین بود 🍭' }) });
  stall(20, -70, 0, 'بستنی 🍦', 0x3a86ff, { label: 'خرید بستنی 🍦', act: (g) => g.act('eat', 2.5, { text: 'بستنی وانیلی خنک خوردی 🍦' }) });
  stall(-70, -20, Math.PI / 2, 'ذرت بو داده 🍿', 0xffbe0b, { label: 'خرید پاپ‌کورن 🍿', act: (g) => g.act('eat', 2.5, { text: 'پاپ‌کورن داغ و تُرد بود 🍿' }) });
  stall(-70, 20, Math.PI / 2, 'بادکنک 🎈', 0x8338ec, { label: 'خرید بادکنک 🎈', act: (g) => g.act('wave', 2, { text: 'یک بادکنک قرمز خریدی و رهایش کردی 🎈', balloon: true }) });
  stall(20, 70, Math.PI, 'تیراندازی 🎯', 0x2a9d8f, { label: 'بازی تیراندازی 🎯', act: (g) => { const s = (Math.random() * 10) | 0; g.act('throw', 1.6, { text: s > 6 ? `${s} امتیاز! یک عروسک خرسی جایزه گرفتی 🧸` : `${s} امتیاز گرفتی، دوباره امتحان کن 🎯` }); } });
  stall(-20, 70, Math.PI, 'بلیط فروشی 🎟️', 0xe63946, { label: 'گرفتن نقشه شهربازی', act: (g) => g.act('reach', 1.5, { text: 'همه وسایل امروز رایگان است! سوار شو 🎟️' }) });
  stall(70, -24, -Math.PI / 2, 'آب‌میوه 🧃', 0x06d6a0, { label: 'خرید آب‌میوه 🧃', act: (g) => g.act('drink', 2.4, { text: 'آب پرتقال تازه خوردی 🧃' }) });

  // ---------- قدرت‌سنج (چکش) ----------
  {
    const P = L(36, -20);
    add(new THREE.BoxGeometry(0.5, 7, 0.3), mat(0xf8f1e5, 0.6), P.x, 3.5, P.z);
    const scale = add(new THREE.PlaneGeometry(0.4, 6.4), new THREE.MeshStandardMaterial({ map: (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 512; const x = c.getContext('2d'); const gr = x.createLinearGradient(0, 512, 0, 0); gr.addColorStop(0, '#06d6a0'); gr.addColorStop(0.5, '#ffd166'); gr.addColorStop(1, '#e63946'); x.fillStyle = gr; x.fillRect(0, 0, 64, 512); x.fillStyle = '#fff'; for (let k = 1; k < 10; k++) x.fillRect(0, k * 51, 64, 3); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })() }), P.x, 3.6, P.z + 0.16); scale.castShadow = false;
    const bell = add(new THREE.SphereGeometry(0.35, 14, 10, 0, TAU, 0, Math.PI / 2), mat(0xd4a531, 0.25, 1), P.x, 7.1, P.z); bell.material = bell.material.clone(); bell.material.emissive = new THREE.Color(0xffd166); bell.material.emissiveIntensity = 0; bell.userData.keep = true;
    const puck = add(new THREE.BoxGeometry(0.35, 0.25, 0.2), mat(0xe63946, 0.4), P.x, 0.6, P.z + 0.3); puck.userData.keep = true;
    add(new THREE.CylinderGeometry(0.45, 0.5, 0.3, 16), mat(0x333333, 0.6), P.x, 0.15, P.z + 0.9);
    C.box(P.x - 0.4, P.z - 0.3, P.x + 0.4, P.z + 1.3, 3);
    const hs = { y: 0.6, vy: 0, ring: 0 };
    park.updaters.push((dt) => { if (hs.vy !== 0 || hs.y > 0.6) { hs.vy -= 9.81 * dt; hs.y += hs.vy * dt; if (hs.y > 6.85) { hs.y = 6.85; hs.vy = -1; hs.ring = 1.2; } if (hs.y < 0.6) { hs.y = 0.6; hs.vy = 0; } puck.position.y = hs.y; } if (hs.ring > 0) { hs.ring -= dt; bell.material.emissiveIntensity = hs.ring > 0 ? 2 * Math.abs(Math.sin(hs.ring * 20)) : 0; } });
    I.add({ pos: V(P.x, 1, P.z + 2), r: 1.8, label: 'زدن چکش قدرت‌سنج 🔨', act: (g) => { const p = 0.45 + Math.random() * 0.6; g.act('throw', 1.1, { text: p > 0.95 ? 'دینگ! زنگ را به صدا درآوردی! 💪🔔' : `قدرت: ${Math.round(p * 100)}٪ — دوباره بزن!`, after: () => { hs.vy = Math.sqrt(2 * 9.81 * 6.4 * p); hs.y = 0.61; } }); } });
  }

  // ---------- وسایل عمومی: نیمکت، سطل، چراغ، درخت ----------
  for (let k = 0; k < 24; k++) {
    const a = k / 24 * TAU + 0.13; const r1 = 66.5, r2 = 55.5;
    if (k % 2 === 0) world.addBench(cx + Math.cos(a) * r1, cz + Math.sin(a) * r1, -a + Math.PI / 2 + Math.PI);
    else world.addBench(cx + Math.cos(a) * r2, cz + Math.sin(a) * r2, -a + Math.PI / 2);
    if (k % 3 === 1) world.addBin(cx + Math.cos(a + 0.06) * r1, cz + Math.sin(a + 0.06) * r1, -a - Math.PI / 2, 0x2e7d32);
    if (k % 2 === 1) { const x = cx + Math.cos(a + 0.12) * 65, z = cz + Math.sin(a + 0.12) * 65; const yaw = -a - Math.PI / 2 + Math.PI; const li = world.props.lamp.add(V(x, 0.03, z), yaw); world.props.lampHead.add(V(x, 0.03, z), yaw, 1, 0x555555); const lamp = { i: li, on: false, user: null, pos: V(x + Math.sin(yaw) * 1.65, 0.03, z + Math.cos(yaw) * 1.65), h: 6.7 }; world.lamps.push(lamp); C.circle(x, z, 0.2, 3); I.add({ pos: V(x, 1, z), r: 1.4, label: () => (lamp.on ? 'خاموش کردن چراغ' : 'روشن کردن چراغ'), act: (g) => { lamp.user = !lamp.on; lamp.on = !lamp.on; world.props.lampHead.setColor(li, lamp.on ? 0xfff0c8 : 0x555555); g.act('press', 0.5, {}); } }); }
  }
  for (let k = 0; k < 40; k++) { const a = rng() * TAU, r = 72 + rng() * 30; const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; if (Math.abs(x - cx) > W / 2 - 3 || Math.abs(z - cz) > W / 2 - 3) continue; if (Math.abs(x - cx) < 6 || Math.abs(z - cz) < 6) continue; if (C.inside(x, z, 3)) continue; (world.treeSpots = world.treeSpots || []).push([x, z, 0.9 + rng() * 0.4]); }
  // باغچه مرکزی و تابلو
  add(new THREE.CylinderGeometry(9, 9, 0.5, 40), mat(0x9a948a, 0.8), cx, 0.25, cz);
  const fl = []; for (let k = 0; k < 160; k++) { const a = rng() * TAU, r = Math.sqrt(rng()) * 8.4; const s = new THREE.SphereGeometry(0.18, 5, 4); s.translate(Math.cos(a) * r, 0.58 + rng() * 0.15, Math.sin(a) * r); fl.push(vc(s, [0xe63946, 0xffbe0b, 0xff70a6, 0xffffff, 0x8338ec][k % 5], 0, 0.8)); }
  fl.push(vc(new THREE.CylinderGeometry(8.6, 8.6, 0.06, 32).translate(0, 0.52, 0), 0x2e7d32, 0, 0.95));
  add(mergeGeos(fl, VP), vertexPBRMaterial(), cx, 0, cz);
  C.circle(cx, cz, 9.1, 3);
  I.add({ pos: V(cx, 0.8, cz + 9.8), r: 2.4, label: 'بوییدن گل‌های باغچه 🌷', act: (g) => g.act('reach', 2, { text: 'عطر گل‌ها همه جا پیچیده 🌷' }) });

  park.paths.push(Array.from({ length: 24 }, (_, k) => { const a = k / 24 * TAU; return [cx + Math.cos(a) * 61, cz + Math.sin(a) * 61]; }));
  park.paths.push([[cx - 2, cz - 56], [cx - 2, cz - 12], [cx + 2, cz - 12], [cx + 2, cz - 56]]);
  park.update = (dt, t) => { for (const u of park.updaters) u(dt, t); const k = 1.3 + Math.sin(t * 4) * 0.35; park.bulbs.forEach((b, i) => { b.emissiveIntensity = (world.night ? 2.6 : 1.0) * k; if (world.night) b.emissive.setHSL((t * 0.12 + i * 0.21) % 1, 0.9, 0.6); else b.emissive.setHex(0xffd27a); }); };
  world.updaters.push((dt, t) => park.update(dt, t));
  return park;
}
