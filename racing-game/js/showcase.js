// صحنه پس‌زمینه منو: ماشین بازیکن روی بخشی از پیست با آسمان و نور زنده (برای پیش‌نمایش تنظیم نور)
import * as THREE from 'three';
import { Outdoor } from './engine.js';
import { buildCar } from './cars.js';
import { buildBike } from './bikes.js';
import { freeModel } from './garage.js';
import { PATTERN_UNIFORMS, createCrowd } from './human.js';
import * as T from './textures.js';
import { mulberry32, optimizeStatic } from './utils.js';

export class Showcase {
  constructor(app) {
    this.app = app;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 14000);
    this.outdoor = new Outdoor(app.engine, this.scene);
    const g = T.grass(); g.map.repeat.set(160, 160); g.normal.repeat.set(160, 160);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshStandardMaterial({ map: g.map, normalMap: g.normal, roughness: 0.95, color: 0xd8e8c8 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; this.scene.add(ground);
    const a = T.asphalt();
    const am = a.map.clone(); am.repeat.set(4, 100); am.needsUpdate = true; const an = a.normal.clone(); an.repeat.set(4, 100); an.needsUpdate = true;
    const road = new THREE.Mesh(new THREE.PlaneGeometry(14, 400), new THREE.MeshStandardMaterial({ map: am, normalMap: an, roughness: 0.9, color: 0xc8c8cc }));
    road.rotation.x = -Math.PI / 2; road.position.y = 0.02; road.receiveShadow = true; this.scene.add(road);
    const lineM = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.6 });
    for (const x of [-6.6, 6.6]) { const l = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 400), lineM); l.rotation.x = -Math.PI / 2; l.position.set(x, 0.03, 0); this.scene.add(l); }
    // کرب قرمز و سفید
    const kg = new THREE.BoxGeometry(1.2, 0.08, 1.5);
    const kRed = new THREE.MeshStandardMaterial({ color: 0xd8141c, roughness: 0.55 }), kWhite = new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.55 });
    const kerbs = new THREE.Group();
    for (const x of [-7.6, 7.6]) for (let k = -40; k < 40; k++) { const kb = new THREE.Mesh(kg, k % 2 ? kRed : kWhite); kb.position.set(x, 0.04, k * 1.5); kb.receiveShadow = true; kerbs.add(kb); }
    this.scene.add(kerbs); optimizeStatic(kerbs);
    // خط شروع
    const chk = new THREE.Mesh(new THREE.PlaneGeometry(14, 1.6), new THREE.MeshStandardMaterial({ map: T.checker(16, 2), roughness: 0.7 }));
    chk.rotation.x = -Math.PI / 2; chk.position.set(0, 0.035, 6); this.scene.add(chk);
    // دیوار تبلیغاتی
    const ad = T.adWall(); const adc = ad.clone(); adc.repeat.set(6, 1); adc.needsUpdate = true;
    for (const x of [-12, 12]) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.1, 300), new THREE.MeshStandardMaterial({ map: adc, roughness: 0.6 })); w.position.set(x, 0.55, 0); w.castShadow = true; w.receiveShadow = true; this.scene.add(w); }
    // درخت‌ها
    const rng = mulberry32(4);
    const fol = new THREE.ConeGeometry(2.2, 6, 9); fol.translate(0, 5, 0);
    const trunkG = new THREE.CylinderGeometry(0.2, 0.3, 2.5, 6); trunkG.translate(0, 1.25, 0);
    const N = 160; const fm = new THREE.InstancedMesh(fol, new THREE.MeshStandardMaterial({ color: 0x2a5d32, roughness: 0.9 }), N); const tm = new THREE.InstancedMesh(trunkG, new THREE.MeshStandardMaterial({ color: 0x4a3423 }), N);
    const m4 = new THREE.Matrix4();
    for (let k = 0; k < N; k++) { const side = k % 2 ? 1 : -1; const x = side * (22 + rng() * 120), z = (rng() - 0.5) * 380, s = 0.7 + rng() * 0.8; m4.makeScale(s, s, s); m4.setPosition(x, 0, z); fm.setMatrixAt(k, m4); tm.setMatrixAt(k, m4); }
    fm.castShadow = true; tm.castShadow = true; this.scene.add(fm, tm);
    // جایگاه کوچک با طرفداران آتشین
    const stand = new THREE.Group(); const sm = new THREE.MeshStandardMaterial({ map: T.concrete(), color: 0xcfd2d6, roughness: 0.9 });
    const places = [];
    for (let r = 0; r < 6; r++) { const b = new THREE.Mesh(new THREE.BoxGeometry(30, 1.2 + r * 0.45, 0.85), sm); b.userData.stand = true; b.position.set(0, (1.2 + r * 0.45) / 2, -r * 0.85 - 0.42); b.receiveShadow = true; stand.add(b); for (let k = 0; k < 50; k++) if (rng() < 0.75) places.push({ pos: new THREE.Vector3(-14.5 + k * 0.58, 1.2 + r * 0.45, -r * 0.85 - 0.6), yaw: 0 }); }
    stand.position.set(-15, 0, 0); stand.rotation.y = Math.PI / 2; this.scene.add(stand);
    stand.updateMatrixWorld(true);
    const pl = places.map((p) => ({ pos: p.pos.clone().applyMatrix4(stand.matrixWorld), yaw: Math.PI / 2 }));
    this.crowd = createCrowd(pl, { rng: mulberry32(9), shirtFn: () => '#ff3a1a', patternFn: () => 1, qualityHi: true, nearDist: 40 });
    optimizeStatic(stand);
    this.scene.add(this.crowd.group);
    this.carHolder = new THREE.Group(); this.scene.add(this.carHolder);
    this.t = 0;
  }
  setCar(def, custom) {
    while (this.carHolder.children.length) { const c = this.carHolder.children[0]; this.carHolder.remove(c); freeModel(c); }
    const m = buildCar(def, custom, { isPlayer: true, team: 0xff5a00, number: custom.number || 7 });
    m.root.rotation.y = Math.PI * 0.08; m.setVisualState({ steer: -0.3 });
    this.carHolder.add(m.root); this.model = m;
    if (this.beam) this.beam = null;
  }
  setBike(def) {
    while (this.carHolder.children.length) { const c = this.carHolder.children[0]; this.carHolder.remove(c); freeModel(c); }
    const m = buildBike(def, { isPlayer: true, rider: true });
    m.root.rotation.y = Math.PI * 0.08; m.root.scale.setScalar(1.15); m.setVisualState({ steer: -0.3, latAcc: 0 });
    this.carHolder.add(m.root); this.model = m;
  }
  applyLight(timeKey, light) {
    this.outdoor.apply(timeKey, light);
    const night = timeKey === 'night';
    if (night && !this.spot) {
      this.spot = new THREE.SpotLight(0xfff1d0, 150, 90, 0.5, 0.5, 1.4); this.spot.position.set(0, 0.8, 2.2); this.spot.target.position.set(0, 0, 30);
    }
    if (this.spot && this.model) { if (night) this.model.root.add(this.spot, this.spot.target); else this.model.root.remove(this.spot, this.spot.target); }
  }
  update(dt) {
    this.t += dt; PATTERN_UNIFORMS.uTime.value += dt;
    const a = this.t * 0.08 + 0.6;
    this.camera.position.set(Math.sin(a) * 9.5, 2.2 + Math.sin(this.t * 0.2) * 0.4, Math.cos(a) * 9.5);
    // در صفحه پهن، ماشین را کمی به سمت چپ قاب ببریم تا منو روی راست باشد
    // منو در سمت راست است (راست‌چین)؛ ماشین را به سمت چپ قاب ببریم
    const off = this.app.engine.aspect > 1.2 ? 2.4 : 0;
    const look = new THREE.Vector3(Math.cos(a) * off, 0.7, -Math.sin(a) * off);
    this.camera.lookAt(look);
    this.outdoor.update(dt, new THREE.Vector3(0, 0, 0), this.camera);
    this.crowd.update(this.t, 0.4 + 0.4 * Math.sin(this.t * 0.5), this.carHolder.position, this.camera.position);
    if (this.model) this.model.setVisualState({ steer: -0.3, spin: 0, rpm: 900 + Math.sin(this.t * 3) * 100 });
    this.app.engine.finalPass.uniforms.uSpeed.value = 0; this.app.engine.finalPass.uniforms.uFlash.value = 0;
    this.app.engine.render(this.scene, this.camera, dt);
  }
}
