// Track geometry: asphalt, kerbs, run-off, barriers, start/finish line, grid boxes, gantry
// with start lights and trackside banners.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { roadTextures, groundTexture, curbTexture, checkerTexture, wallTexture, bannerTexture } from './textures.js';
import { RNG } from '../core/utils.js';

/**
 * Builds a ribbon following the centre line between sample indices i0..i1 (inclusive, wraps).
 * `profile` is a list of [lateral d, height offset] from one side to the other (ascending
 * winding gives outward-facing normals, see notes in physics/track conventions).
 */
export function ribbon(track, i0, count, profile, uvFn) {
  const K = profile.length;
  const rows = count + 1;
  const pos = new Float32Array(rows * K * 3);
  const uv = new Float32Array(rows * K * 2);
  for (let r = 0; r < rows; r++) {
    const i = track.wrap(i0 + r);
    const sAbs = (i0 + r) * track.ds;
    for (let k = 0; k < K; k++) {
      const [d, h] = profile[k];
      const o = r * K + k;
      const x = track.px[i] + track.nx[i] * d;
      const z = track.pz[i] + track.nz[i] * d;
      pos[o * 3] = x;
      pos[o * 3 + 1] = track.py[i] + h;
      pos[o * 3 + 2] = z;
      const [u, v] = uvFn(k, sAbs, x, z);
      uv[o * 2] = u;
      uv[o * 2 + 1] = v;
    }
  }
  const idx = [];
  for (let r = 0; r < rows - 1; r++) {
    for (let k = 0; k < K - 1; k++) {
      const a = r * K + k, b = (r + 1) * K + k, c = r * K + k + 1, d = (r + 1) * K + k + 1;
      idx.push(a, b, c, c, b, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function runs(flags) {
  // contiguous [start, length] runs of truthy flags on a closed loop
  const n = flags.length;
  const out = [];
  let start = -1;
  for (let i = 0; i < n; i++) if (!flags[i]) { start = i; break; }
  if (start < 0) return [[0, n]];
  let i = (start + 1) % n, runStart = -1, len = 0;
  for (let c = 0; c < n; c++, i = (i + 1) % n) {
    if (flags[i]) {
      if (runStart < 0) { runStart = i; len = 0; }
      len++;
    } else if (runStart >= 0) {
      out.push([runStart, len]);
      runStart = -1;
    }
  }
  if (runStart >= 0) out.push([runStart, len]);
  return out;
}

export function buildTrackMeshes(track, look, tier, aniso) {
  const group = new THREE.Group();
  group.name = 'track';
  const n = track.n;
  const hw = track.halfWidth;
  const lambert = tier.material === 0;
  const Mat = (o) => (lambert ? new THREE.MeshLambertMaterial(stripPbr(o)) : new THREE.MeshStandardMaterial(o));
  const disposables = [];

  // ---- asphalt --------------------------------------------------------------------------------
  const tex = roadTextures(tier.texSize, { aniso, normals: tier.normalMaps, theme: look.id });
  const tiles = Math.max(1, Math.round(track.length / 20));
  const tileLen = track.length / tiles;
  const across = [];
  const steps = tier.index >= 3 ? 4 : 2;
  for (let k = 0; k <= steps; k++) across.push([-hw + (2 * hw * k) / steps, 0]);
  const roadGeo = ribbon(track, 0, n, across, (k, s) => [k / steps, s / tileLen]);
  const wet = look.wet;
  const roadMat = Mat({
    map: tex.map,
    normalMap: tex.normalMap || null,
    normalScale: new THREE.Vector2(0.6, 0.6),
    roughnessMap: tex.roughnessMap || null,
    roughness: wet ? 0.32 : 1,
    metalness: 0,
    color: wet ? new THREE.Color(0.62, 0.62, 0.66) : new THREE.Color(1, 1, 1),
    envMapIntensity: wet ? 1.4 : 0.6,
  });
  const road = new THREE.Mesh(roadGeo, roadMat);
  road.receiveShadow = true;
  group.add(road);
  disposables.push(roadGeo, roadMat);

  // ---- run-off (shoulders) -------------------------------------------------------------------------
  const shoulderTex = groundTexture(look.shoulder, Math.min(1024, tier.texSize), aniso);
  const shoulderMat = Mat({ map: shoulderTex, roughness: 1, metalness: 0, color: look.shoulderTint || 0xffffff });
  const wd = track.wallDist;
  const sUV = (k, s, x, z) => [x / 12, z / 12];
  const leftS = ribbon(track, 0, n, [[hw, -0.025], [(hw + wd) / 2, -0.04], [wd + 0.4, -0.06]], sUV);
  const rightS = ribbon(track, 0, n, [[-wd - 0.4, -0.06], [-(hw + wd) / 2, -0.04], [-hw, -0.025]], sUV);
  const shoulders = new THREE.Mesh(mergeGeometries([leftS, rightS]), shoulderMat);
  shoulders.receiveShadow = true;
  group.add(shoulders);
  disposables.push(shoulders.geometry, shoulderMat, leftS, rightS);

  // ---- kerbs -------------------------------------------------------------------------------------
  const cw = track.curbWidth;
  const curbGeos = [];
  for (const [start, len] of runs(track.curb)) {
    if (len < 3) continue;
    const uvC = (k, s) => [k / 2, s / 4];
    curbGeos.push(ribbon(track, start, len, [[hw - 0.05, 0.012], [hw + cw * 0.5, 0.055], [hw + cw, 0.012]], uvC));
    curbGeos.push(ribbon(track, start, len, [[-hw - cw, 0.012], [-hw - cw * 0.5, 0.055], [-hw + 0.05, 0.012]], uvC));
  }
  if (curbGeos.length) {
    const curbMat = Mat({ map: curbTexture(), roughness: 0.6, metalness: 0 });
    const curbs = new THREE.Mesh(mergeGeometries(curbGeos), curbMat);
    curbs.receiveShadow = true;
    group.add(curbs);
    disposables.push(curbs.geometry, curbMat, ...curbGeos);
  }

  // ---- barriers ----------------------------------------------------------------------------------
  const wallStyle = look.wall;
  const wallTex = wallTexture(wallStyle);
  const wallMat = Mat({ map: wallTex, roughness: wallStyle === 'concrete' ? 0.85 : 0.35, metalness: wallStyle === 'concrete' ? 0 : 0.6 });
  const wh = wallStyle === 'concrete' ? 1.05 : 0.85;
  const wUV = (k, s) => [s / 8, k === 0 ? 0 : 1];
  const wl = ribbon(track, 0, n, [[wd, -0.3], [wd, wh], [wd + 0.3, wh], [wd + 0.3, -0.3]], (k, s) => [s / 8, [0, 1, 1, 0][k]]);
  const wr = ribbon(track, 0, n, [[-wd - 0.3, -0.3], [-wd - 0.3, wh], [-wd, wh], [-wd, -0.3]], (k, s) => [s / 8, [0, 1, 1, 0][k]]);
  void wUV;
  const walls = new THREE.Mesh(mergeGeometries([wl, wr]), wallMat);
  walls.castShadow = tier.shadowType !== 'none';
  walls.receiveShadow = true;
  group.add(walls);
  disposables.push(walls.geometry, wallMat, wl, wr);
  if (wallStyle !== 'concrete') {
    // guard-rail posts
    const postGeo = new THREE.BoxGeometry(0.12, 1.0, 0.12);
    postGeo.translate(0, 0.2, 0);
    const postMat = Mat({ color: 0x8a939e, roughness: 0.5, metalness: 0.6 });
    const spacing = Math.max(2, Math.round(4 / track.ds));
    const count = Math.ceil(n / spacing) * 2;
    const posts = new THREE.InstancedMesh(postGeo, postMat, count);
    const m = new THREE.Matrix4();
    let c = 0;
    for (let i = 0; i < n; i += spacing) {
      for (const s of [1, -1]) {
        const d = s * (wd + 0.45);
        m.makeTranslation(track.px[i] + track.nx[i] * d, track.py[i], track.pz[i] + track.nz[i] * d);
        posts.setMatrixAt(c++, m);
      }
    }
    posts.count = c;
    posts.computeBoundingSphere();
    group.add(posts);
    disposables.push(postGeo, postMat);
  }

  // ---- start/finish line & grid boxes ---------------------------------------------------------------
  const lineGeo = ribbon(track, 0, 1, [[-hw, 0.008], [hw, 0.008]], (k, s) => [k, s / 2]);
  const lineMat = new THREE.MeshBasicMaterial({ map: checkerTexture(), polygonOffset: true, polygonOffsetFactor: -1 });
  lineMat.map.repeat.set(1, 1);
  const line = new THREE.Mesh(lineGeo, lineMat);
  group.add(line);
  disposables.push(lineGeo, lineMat);
  const boxes = [];
  for (let k = 0; k < 20; k++) {
    const slot = track.gridSlot(k);
    const i0 = Math.floor(slot.s / track.ds);
    const g = ribbon(track, i0, 1, [[slot.d - 1.3, 0.008], [slot.d + 1.3, 0.008]], () => [0, 0]);
    boxes.push(g);
  }
  const boxMat = new THREE.MeshBasicMaterial({ color: 0xe8e8e8, transparent: true, opacity: 0.75, polygonOffset: true, polygonOffsetFactor: -1 });
  const gridMesh = new THREE.Mesh(mergeGeometries(boxes), boxMat);
  group.add(gridMesh);
  disposables.push(gridMesh.geometry, boxMat, ...boxes);

  // ---- gantry with start lights ---------------------------------------------------------------
  const gantry = new THREE.Group();
  const g0 = track.pointAt(1.5, 0);
  gantry.position.set(g0.x, g0.y, g0.z);
  gantry.rotation.y = g0.heading;
  const metal = Mat({ color: 0x2b2f36, roughness: 0.45, metalness: 0.7 });
  const span = wd + 1;
  for (const s of [1, -1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.7, 8, 0.7), metal);
    p.position.set(s * span, 4, 0);
    p.castShadow = true;
    gantry.add(p);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(span * 2 + 0.7, 1.6, 0.8), metal);
  beam.position.set(0, 7.6, 0);
  beam.castShadow = true;
  gantry.add(beam);
  const bannerMat = new THREE.MeshBasicMaterial({ map: bannerTexture('شتاب', 'SHETAB RACING', '#d1132d') });
  for (const side of [1, -1]) {
    const b = new THREE.Mesh(new THREE.PlaneGeometry(span * 1.4, 1.4), bannerMat);
    b.position.set(0, 7.6, side * 0.41);
    b.rotation.y = side > 0 ? 0 : Math.PI;
    gantry.add(b);
  }
  const lights = [];
  const lightGeo = new THREE.SphereGeometry(0.28, 16, 12);
  for (let k = 0; k < 5; k++) {
    const mat = new THREE.MeshBasicMaterial({ color: 0x220000 });
    const l = new THREE.Mesh(lightGeo, mat);
    l.position.set((k - 2) * 0.9, 6.35, -0.45);
    gantry.add(l);
    lights.push(l);
  }
  group.add(gantry);
  disposables.push(metal, bannerMat, lightGeo);

  // ---- trackside banners -----------------------------------------------------------------------
  const rng = new RNG(track.stage.seed ^ 0xabc);
  const words = [
    ['شتاب', 'SHETAB'], ['نیترو', 'NITRO'], ['سرعت', 'SPEED'], ['قهرمان', 'CHAMPION'], ['مسابقه', 'RACE'], ['گاراژ', 'GARAGE'],
  ];
  const colors = ['#d1132d', '#0f62fe', '#ff8a00', '#18a058', '#7c3aed', '#0e9fbf'];
  const bannerCount = Math.round(6 + 6 * tier.props);
  const bGeo = new THREE.PlaneGeometry(9, 2.2);
  for (let k = 0; k < bannerCount; k++) {
    const i = Math.floor(rng.next() * n);
    if (i < 60 || i > n - 80) continue; // keep the start area clean
    const side = rng.next() < 0.5 ? 1 : -1;
    const wpick = words[rng.int(0, words.length - 1)];
    const mat = new THREE.MeshBasicMaterial({ map: bannerTexture(wpick[0], wpick[1], colors[k % colors.length]), side: THREE.DoubleSide });
    const b = new THREE.Mesh(bGeo, mat);
    const d = side * (wd + 1.4);
    b.position.set(track.px[i] + track.nx[i] * d, track.py[i] + 1.6, track.pz[i] + track.nz[i] * d);
    b.rotation.y = Math.atan2(track.nx[i] * -side, track.nz[i] * -side);
    group.add(b);
    disposables.push(mat);
  }
  disposables.push(bGeo);

  return {
    group,
    startLights: lights,
    roadMaterial: roadMat,
    dispose() {
      for (const d of disposables) d.dispose?.();
    },
  };
}

function stripPbr(o) {
  const { roughness, metalness, roughnessMap, normalMap, normalScale, envMapIntensity, ...rest } = o;
  return rest;
}
