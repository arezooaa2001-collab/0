// گاراژ مخصوص: نمایشگاه ماشین با کف براق انعکاسی، صفحه چرخان، نورپردازی استودیویی و پوشش ماشین‌های قفل
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { buildCar, buildCarCover } from './cars.js';
import { PATTERN_UNIFORMS } from './human.js';
import * as T from './textures.js';
import { clamp, damp, lerp } from './utils.js';

export class Garage {
  constructor(app) {
    this.app = app;
    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07080b);
    this.camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.05, 200);
    RectAreaLightUniformsLib.init();
    const pm = app.engine.pmrem;
    this.envRT = pm.fromScene(new RoomEnvironment(), 0.03);
    scene.environment = this.envRT.texture;
    scene.fog = new THREE.Fog(0x07080b, 18, 45);
    // کف انعکاسی
    const w = Math.max(256, Math.round(window.innerWidth * 0.5)), h = Math.max(256, Math.round(window.innerHeight * 0.5));
    this.mirror = new Reflector(new THREE.PlaneGeometry(60, 60), { clipBias: 0.003, textureWidth: w, textureHeight: h, color: 0x8a8f99 });
    this.mirror.rotation.x = -Math.PI / 2; scene.add(this.mirror);
    const ft = T.garageFloor(); ft.repeat.set(6, 6);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ map: ft, transparent: true, opacity: 0.8, roughness: 0.4, metalness: 0.1 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = 0.004; floor.receiveShadow = true; scene.add(floor);
    // دیوارها
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x14161b, roughness: 0.8, metalness: 0.2 });
    const room = new THREE.Mesh(new THREE.BoxGeometry(36, 10, 36), wallMat); room.material.side = THREE.BackSide; room.position.y = 5; scene.add(room);
    // پنل‌های دیواری و نوار نور نارنجی
    const ledMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff6a00, emissiveIntensity: 3 });
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x1d2129, roughness: 0.5, metalness: 0.5 });
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2; const g = new THREE.Group(); g.rotation.y = a;
      for (let j = -3; j <= 3; j++) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(4.6, 6, 0.2), panelMat); p.position.set(j * 4.9, 3.6, -17.8); g.add(p);
        const led = new THREE.Mesh(new THREE.BoxGeometry(0.08, 6, 0.1), ledMat); led.position.set(j * 4.9 + 2.45, 3.6, -17.65); g.add(led);
      }
      const strip = new THREE.Mesh(new THREE.BoxGeometry(34, 0.1, 0.1), ledMat); strip.position.set(0, 0.3, -17.7); g.add(strip);
      scene.add(g);
    }
    // تابلو گاراژ
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.6), new THREE.MeshStandardMaterial({ map: T.signText('گاراژ مخصوص قهرمان', '#000000', '#ff8a00', 1024, 164, 110), emissive: 0xffffff, emissiveIntensity: 1.4, transparent: true }));
    sign.material.emissiveMap = sign.material.map; sign.position.set(0, 7.4, -17.6); scene.add(sign);
    // سقف و چراغ‌ها
    const ceilMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveIntensity: 2.2 });
    for (const [x, z] of [[-3, 0], [3, 0], [0, -3.5], [0, 3.5]]) { const c = new THREE.Mesh(new THREE.BoxGeometry(x ? 0.5 : 6, 0.05, x ? 6 : 0.5), ceilMat); c.position.set(x, 8.9, z); scene.add(c); }
    const ra1 = new THREE.RectAreaLight(0xffffff, 6, 7, 1.4); ra1.position.set(0, 6, 2.5); ra1.lookAt(0, 0, 0); scene.add(ra1);
    const ra2 = new THREE.RectAreaLight(0xffe0c0, 4, 7, 1.4); ra2.position.set(0, 6, -2.5); ra2.lookAt(0, 0, 0); scene.add(ra2);
    const ra3 = new THREE.RectAreaLight(0xff8a40, 3, 1, 4); ra3.position.set(-6, 2, 0); ra3.lookAt(0, 0.8, 0); scene.add(ra3);
    const spot = new THREE.SpotLight(0xffffff, 260, 30, 0.55, 0.6, 1.6); spot.position.set(4, 9, 5); spot.castShadow = true; spot.shadow.mapSize.set(2048, 2048); spot.shadow.bias = -0.0002; spot.shadow.normalBias = 0.02;
    scene.add(spot, spot.target);
    scene.add(new THREE.HemisphereLight(0xbcc8ff, 0x201810, 0.35));
    // صفحه چرخان
    this.turn = new THREE.Group(); scene.add(this.turn);
    const disk = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.5, 0.14, 64), new THREE.MeshStandardMaterial({ color: 0x22252c, metalness: 0.85, roughness: 0.25 }));
    disk.position.y = 0.07; disk.receiveShadow = true; this.turn.add(disk);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.45, 0.035, 8, 96), ledMat); ring.rotation.x = Math.PI / 2; ring.position.y = 0.12; scene.add(ring);
    for (let k = 0; k < 24; k++) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.005, 0.6), new THREE.MeshStandardMaterial({ color: 0x3a3e47, metalness: 0.9, roughness: 0.3 })); const a = k / 24 * Math.PI * 2; l.position.set(Math.cos(a) * 2.9, 0.142, Math.sin(a) * 2.9); l.rotation.y = -a; this.turn.add(l); }
    this.carHolder = new THREE.Group(); this.carHolder.position.y = 0.14; this.turn.add(this.carHolder);
    // وسایل گاراژ: لاستیک‌ها و کابینت ابزار
    const tireG = new THREE.TorusGeometry(0.33, 0.13, 12, 28); tireG.rotateX(Math.PI / 2);
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x121214, roughness: 0.9 });
    for (const [x, z, n] of [[-9, -12, 5], [-10.2, -11.4, 4], [9.5, -12.5, 6], [12, 8, 3]]) for (let k = 0; k < n; k++) { const t = new THREE.Mesh(tireG, tireMat); t.position.set(x, 0.13 + k * 0.26, z); t.castShadow = true; scene.add(t); }
    const toolMat = new THREE.MeshPhysicalMaterial({ color: 0xc4141c, metalness: 0.3, roughness: 0.3, clearcoat: 1 });
    for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(new RoundedBoxGeometry(1.6, 1.1, 0.7, 3, 0.05), toolMat); b.position.set(-5 + k * 1.7, 0.55, -16.8); b.castShadow = true; scene.add(b); }
    // هولوگرام قفل
    const lc = document.createElement('canvas'); lc.width = 256; lc.height = 256; const lx = lc.getContext('2d');
    lx.strokeStyle = '#ffb000'; lx.lineWidth = 16; lx.beginPath(); lx.arc(128, 100, 50, Math.PI, 0); lx.stroke();
    lx.fillStyle = '#ffb000'; lx.beginPath(); lx.roundRect(58, 100, 140, 110, 18); lx.fill(); lx.fillStyle = '#1a0d00'; lx.font = "900 80px 'Vazirmatn', sans-serif"; lx.textAlign = 'center'; lx.textBaseline = 'middle'; lx.fillText('؟', 128, 160);
    const lt = new THREE.CanvasTexture(lc); lt.colorSpace = THREE.SRGBColorSpace;
    this.lock = new THREE.Sprite(new THREE.SpriteMaterial({ map: lt, transparent: true, depthWrite: false, color: 0xffffff }));
    this.lock.scale.set(1.2, 1.2, 1); this.lock.position.set(0, 2.6, 0); scene.add(this.lock);
    this.orbit = { th: 0.7, ph: 0.32, r: 8.2, thT: 0.7, phT: 0.32, rT: 8.2, idle: 0 };
    this.inside = false; this.active = false;
    this.bindPointer();
  }

  bindPointer() {
    const el = this.app.engine.renderer.domElement;
    let down = false, lx = 0, ly = 0; const pts = new Map(); let pinch = 0;
    el.addEventListener('pointerdown', (e) => { if (!this.active) return; down = true; lx = e.clientX; ly = e.clientY; pts.set(e.pointerId, e); this.orbit.idle = 0; });
    window.addEventListener('pointerup', (e) => { down = false; pts.delete(e.pointerId); pinch = 0; });
    window.addEventListener('pointermove', (e) => {
      if (!this.active || !down) return;
      pts.set(e.pointerId, e);
      if (pts.size === 2) {
        const [a, b] = [...pts.values()]; const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        if (pinch) this.orbit.rT = clamp(this.orbit.rT * (pinch / d), 4.2, 14); pinch = d; return;
      }
      const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
      if (this.inside) { this.lookYaw = (this.lookYaw || 0) - dx * 0.005; this.lookPitch = clamp((this.lookPitch || 0) - dy * 0.004, -0.8, 0.6); }
      else { this.orbit.thT -= dx * 0.008; this.orbit.phT = clamp(this.orbit.phT + dy * 0.005, 0.05, 1.2); }
      this.orbit.idle = 0;
    });
    el.addEventListener('wheel', (e) => { if (!this.active) return; this.orbit.rT = clamp(this.orbit.rT * (1 + Math.sign(e.deltaY) * 0.08), 4.2, 14); }, { passive: true });
  }

  setCar(def, custom, { covered = false, player = true } = {}) {
    while (this.carHolder.children.length) { const c = this.carHolder.children[0]; this.carHolder.remove(c); c.traverse((o) => o.geometry?.dispose?.()); }
    this.covered = covered;
    if (covered) {
      const cv = buildCarCover(def); this.carHolder.add(cv); this.model = null;
    } else {
      const m = buildCar(def, custom, { isPlayer: player, team: 0xff5a00, number: custom.number || 7 });
      m.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
      this.carHolder.add(m.root); this.model = m;
      m.setVisualState({ steer: 0.25, spin: 0 });
    }
    this.lock.visible = covered;
    if (this.inside && !this.model) this.inside = false;
  }

  toggleInside() { if (!this.model) return false; this.inside = !this.inside; this.lookYaw = 0; this.lookPitch = 0; return this.inside; }

  update(dt) {
    const o = this.orbit; o.idle += dt;
    PATTERN_UNIFORMS.uTime.value += dt;
    if (!this.inside) {
      if (o.idle > 2.5) o.thT += dt * 0.18;
      o.th = damp(o.th, o.thT, 6, dt); o.ph = damp(o.ph, o.phT, 6, dt); o.r = damp(o.r, o.rT, 6, dt);
      this.camera.position.set(Math.sin(o.th) * Math.cos(o.ph) * o.r, 0.9 + Math.sin(o.ph) * o.r, Math.cos(o.th) * Math.cos(o.ph) * o.r);
      this.camera.lookAt(0, 0.75, 0); this.camera.fov = 42;
      this.turn.rotation.y = damp(this.turn.rotation.y, 0, 2, dt);
      if (this.model?.driver) this.model.driver.j.head.visible = true;
    } else if (this.model) {
      // نمای داخل: از صندلی کنار راننده به داخل ماشین
      const m = this.model; this.turn.rotation.y = 0;
      m.root.updateMatrixWorld(true);
      // دوربین بین دو صندلی جلو، کمی عقب‌تر: راننده، فرمان، دنده، داشبورد و پدال‌ها دیده می‌شوند
      const eye = m.eye.clone(); eye.x = 0; eye.y += 0.02; eye.z -= 0.28;
      m.body.localToWorld(eye);
      this.camera.position.copy(eye);
      const yaw = 0.12 + (this.lookYaw || 0), pitch = -0.42 + (this.lookPitch || 0);
      const q = new THREE.Quaternion(); m.body.getWorldQuaternion(q);
      this.camera.quaternion.copy(q).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, Math.PI + yaw, 0, 'YXZ')));
      this.camera.fov = 70;
      const t = performance.now() / 1000;
      m.setVisualState({ steer: Math.sin(t * 0.8) * 0.5, spin: 0, gear: 1 + Math.floor(t / 2) % 5, throttle: (Math.sin(t * 2) + 1) / 2, brake: 0, speedKmh: 60 + Math.sin(t) * 40, rpm: 3000 + Math.sin(t * 2) * 2000 });
    }
    this.camera.updateProjectionMatrix();
    this.lock.position.y = 2.5 + Math.sin(performance.now() / 600) * 0.12;
    this.lock.material.rotation = Math.sin(performance.now() / 900) * 0.15;
    this.app.engine.finalPass.uniforms.uSpeed.value = 0;
    this.app.engine.render(this.scene, this.camera, dt);
  }
}
