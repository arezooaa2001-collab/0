// 3D showroom used behind the main menu and in the garage: turntable, studio lighting,
// reflective floor and drag / pinch to orbit.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CarVisual, createSharedCarMaterials } from '../gfx/carModel.js';
import { radialTexture } from '../gfx/textures.js';
import { carById } from '../core/config.js';
import { clamp, damp } from '../core/utils.js';

export class Garage {
  constructor(app) {
    this.app = app;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x07090f);
    this.scene.fog = new THREE.Fog(0x07090f, 14, 40);
    this.camera = new THREE.PerspectiveCamera(38, app.gfx.width / app.gfx.height, 0.1, 100);
    this.yaw = 0.7;
    this.pitch = 0.18;
    this.dist = 10;
    this.targetDist = 10;
    this.autoSpin = true;
    this.offsetX = 0;
    this.turntable = new THREE.Group();
    this.scene.add(this.turntable);
    this.#studio();
    this.#bindOrbit();
  }

  #studio() {
    const tier = this.app.tier;
    const s = this.scene;
    const pmrem = new THREE.PMREMGenerator(this.app.gfx.renderer);
    const room = new RoomEnvironment();
    this.envRT = pmrem.fromScene(room, 0.03);
    s.environment = this.envRT.texture;
    s.environmentIntensity = 0.85;
    room.dispose?.();
    pmrem.dispose();

    const floorMat = new THREE.MeshStandardMaterial({ color: 0x101319, roughness: 0.32, metalness: 0.4 });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 64), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    s.add(floor);
    const plateMat = new THREE.MeshStandardMaterial({ color: 0x1a1e27, roughness: 0.25, metalness: 0.75 });
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.75, 0.12, 96), plateMat);
    plate.position.y = 0.06;
    plate.receiveShadow = true;
    this.turntable.add(plate);
    const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.15, 0.3) });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.7, 0.025, 8, 128), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.12;
    this.turntable.add(ring);
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 14),
      new THREE.MeshBasicMaterial({ map: radialTexture('studio', [[0, 'rgba(255,60,90,0.22)'], [0.5, 'rgba(60,90,255,0.06)'], [1, 'rgba(0,0,0,0)']]), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.01;
    s.add(glow);

    s.add(new THREE.HemisphereLight(0xb8c6ff, 0x101015, 0.6));
    const key = new THREE.SpotLight(0xffffff, 260, 30, 0.6, 0.6, 2);
    key.position.set(3, 9, 4);
    key.target.position.set(0, 0.5, 0);
    key.castShadow = tier.shadowType !== 'none';
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0004;
    s.add(key, key.target);
    const rimA = new THREE.PointLight(0xff3366, 40, 18, 2);
    rimA.position.set(-5, 2.5, -4);
    const rimB = new THREE.PointLight(0x3a7bff, 40, 18, 2);
    rimB.position.set(5, 2.5, -3);
    s.add(rimA, rimB);
    this.lights = { key, rimA, rimB };
  }

  #bindOrbit() {
    const el = this.app.gfx.renderer.domElement;
    const pts = new Map();
    let lastPinch = 0;
    el.addEventListener('pointerdown', (e) => {
      if (!this.active) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.autoSpin = false;
      clearTimeout(this.spinTimer);
    });
    window.addEventListener('pointermove', (e) => {
      if (!this.active || !pts.has(e.pointerId)) return;
      const p = pts.get(e.pointerId);
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (pts.size === 1) {
        this.yaw -= dx * 0.008;
        this.pitch = clamp(this.pitch + dy * 0.004, 0.02, 0.75);
      } else if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (lastPinch) this.targetDist = clamp(this.targetDist * (lastPinch / d), 6, 15);
        lastPinch = d;
      }
    });
    const up = (e) => {
      if (!pts.delete(e.pointerId)) return;
      lastPinch = 0;
      if (!pts.size) this.spinTimer = setTimeout(() => (this.autoSpin = true), 3500);
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    el.addEventListener('wheel', (e) => {
      if (!this.active) return;
      this.targetDist = clamp(this.targetDist + Math.sign(e.deltaY) * 0.6, 6, 15);
    }, { passive: true });
  }

  /** Shows a car model (rebuilt when the graphics preset changed). */
  showCar(carId, color) {
    const tier = this.app.tier;
    if (!this.shared || this.sharedTier !== tier.index) {
      if (this.shared) for (const m of Object.values(this.shared)) m.dispose?.();
      this.shared = createSharedCarMaterials(tier);
      this.sharedTier = tier.index;
      this.carKey = null;
    }
    const key = `${carId}:${tier.index}`;
    if (this.carKey === key && this.car) {
      this.car.setColor(color);
      return;
    }
    this.car?.dispose();
    const def = carById(carId);
    this.car = new CarVisual(def, color, tier, this.shared, { castShadow: tier.shadowType !== 'none' });
    this.car.root.position.y = 0.12;
    this.turntable.add(this.car.root);
    this.carKey = key;
    this.dummy = {
      x: 0, z: 0, heading: 0, a: def.phys.wheelbase * (1 - def.phys.frontWeight), b: def.phys.wheelbase * def.phys.frontWeight,
      proj: { height: 0.12, grade: 0, tx: 0, tz: 1, s: 0 }, pitch: 0, roll: 0, wheelAngle: 0, delta: 0,
      controls: { brake: 0, handbrake: false }, nitroActive: false, u: 0, surface: 0, speed: 0,
    };
    this.car.update(this.dummy, 0, this.app.tier.realism, 0);
    this.pop = 1;
  }

  setColor(color) {
    this.car?.setColor(color);
  }

  setActive(v) {
    this.active = v;
  }

  /** Horizontal framing offset (car moves aside on wide screens to make room for panels). */
  setFraming(offsetX) {
    this.offsetX = offsetX;
  }

  update(dt) {
    if (this.autoSpin) this.yaw += dt * 0.25;
    this.dist = damp(this.dist, this.targetDist, 6, dt);
    const c = this.camera;
    const aspect = this.app.gfx.width / this.app.gfx.height;
    const fit = aspect < 1 ? 1.45 : 1;
    const d = this.dist * fit;
    c.position.set(Math.sin(this.yaw) * Math.cos(this.pitch) * d, 0.9 + Math.sin(this.pitch) * d, Math.cos(this.yaw) * Math.cos(this.pitch) * d);
    c.lookAt(0, 0.65, 0);
    if (this.offsetX) {
      // shift the view so the car sits beside the UI panel
      c.setViewOffset(1000, 1000, this.offsetX * 1000, 0, 1000, 1000);
    } else if (c.view) {
      c.clearViewOffset();
    }
    if (this.car) {
      if (this.pop > 0) {
        this.pop = Math.max(0, this.pop - dt * 2.5);
        const k = 1 - this.pop * this.pop * 0.12;
        this.car.root.scale.setScalar(k);
      }
      this.dummy.wheelAngle += 0;
    }
    this.lights.rimA.intensity = 40 + Math.sin(performance.now() / 900) * 8;
  }

  dispose() {
    this.car?.dispose();
    if (this.shared) for (const m of Object.values(this.shared)) m.dispose?.();
    this.envRT?.dispose();
  }
}
