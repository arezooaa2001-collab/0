// محیط: نور، آسمان، زمین شیدری، مناظر دور و ذرات آب‌وهوا
import * as THREE from 'three';
import { createSky, NOISE_GLSL } from './sky.js';
import { mulberry32, clamp, lerp } from './util.js';
import { makeSprite } from './textures.js';

const V3 = THREE.Vector3;

export class World {
  constructor(renderer, scene, quality) {
    this.renderer = renderer;
    this.scene = scene;
    this.quality = quality;
    this.time = 0;
    this.shared = {
      uFogColor: { value: new THREE.Color() },
      uFogDensity: { value: 0.004 },
      uSunDir: { value: new V3(0, 1, 0) },
      uSunColor: { value: new THREE.Color() },
      uHemiSky: { value: new THREE.Color() },
      uHemiGround: { value: new THREE.Color() },
      uTime: { value: 0 },
      uNight: { value: 0 },
    };
    this.sky = createSky();
    scene.add(this.sky);
    this.skyScene = new THREE.Scene();
    this.skyEnvMesh = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), this.sky.material);
    this.skyScene.add(this.skyEnvMesh);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envRT = null;

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.position.set(30, 60, 20);
    scene.add(this.sun);
    scene.add(this.sun.target);
    this.fill = new THREE.DirectionalLight(0xffffff, 0.35); // نور پشتی برای لبه‌ها
    scene.add(this.fill);
    scene.add(this.fill.target);
    this.setShadows(quality.shadows);

    scene.fog = new THREE.FogExp2(0xffffff, 0.004);
    this.sceneryGroup = new THREE.Group();
    scene.add(this.sceneryGroup);
    this.ground = null;
    this.weather = null;
    this.flash = 0;
    this.lightningTimer = 4;
    this.focus = new V3();
    this.sunDir = new V3(0, 1, 0);
    this.sprites = { soft: makeSprite('soft'), star: makeSprite('star') };
  }

  setShadows(size) {
    const s = this.sun;
    s.castShadow = size > 0;
    if (size > 0) {
      s.shadow.mapSize.set(size, size);
      const cam = s.shadow.camera;
      const half = size >= 4096 ? 34 : size >= 2048 ? 30 : 26;
      cam.left = -half; cam.right = half; cam.top = half; cam.bottom = -half;
      cam.near = 1; cam.far = 220;
      cam.updateProjectionMatrix();
      s.shadow.bias = -0.00035;
      s.shadow.normalBias = 0.035;
      s.shadow.radius = 3;
      if (s.shadow.map) {
        s.shadow.map.dispose();
        s.shadow.map = null;
      }
      this.shadowHalf = half;
    }
  }

  // اعمال محیط + نورپردازی خریداری‌شده
  apply(theme, lighting, custom, bounds) {
    this.theme = theme;
    const o = (lighting && lighting.o) || {};
    const c = (hex) => new THREE.Color(hex);
    let top = c(theme.sky.top), hor = c(theme.sky.horizon), bot = c(theme.sky.bottom);
    if (o.tint) {
      const t = c(o.tint);
      top.lerp(t, o.tintAmt * 0.9);
      hor.lerp(t, o.tintAmt * 0.7);
      bot.lerp(t, o.tintAmt * 0.8);
    }
    let sunColor = c(o.sunColor || theme.sun.color);
    let sunI = theme.sun.intensity * (o.sunMul ?? 1);
    let elev = o.elev ?? theme.sun.elev;
    let exposure = o.exposure ?? theme.exposure;
    let bloomMul = o.bloomMul ?? 1;
    let warmth = o.warmth ?? 0;
    if (custom && custom.enabled) {
      sunI *= custom.sun;
      elev = custom.elev;
      exposure *= custom.exposure;
      bloomMul *= custom.bloom;
      warmth += custom.warmth;
    }
    const night = Math.max(theme.night, o.night ?? 0);
    if (warmth) {
      const w = warmth > 0 ? c('#ff9a4d') : c('#7ab8ff');
      sunColor.lerp(w, Math.min(0.6, Math.abs(warmth)));
      hor.lerp(w, Math.min(0.35, Math.abs(warmth) * 0.6));
    }
    this.exposure = exposure;
    this.bloom = theme.bloom.map((v, i) => (i === 0 ? v * bloomMul : v));
    this.saturation = o.saturation ?? 1;
    this.contrast = o.contrast ?? 1;
    this.lightning = !!o.lightning;

    const az = THREE.MathUtils.degToRad(theme.sun.azim);
    const el = THREE.MathUtils.degToRad(clamp(elev, 2, 85));
    this.sunDir.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).normalize();

    const u = this.sky.material.uniforms;
    u.uTop.value.copy(top);
    u.uHorizon.value.copy(hor);
    u.uBottom.value.copy(bot);
    u.uSunDir.value.copy(this.sunDir);
    u.uSunColor.value.copy(sunColor).multiplyScalar(Math.min(1.4, 0.35 + sunI * 0.22));
    u.uSunSize.value = theme.sun.size;
    u.uClouds.value = o.clouds ?? theme.clouds;
    u.uStars.value = Math.max(theme.stars, o.stars ?? 0);
    u.uAurora.value = Math.max(theme.aurora || 0, o.aurora || 0);
    u.uNebula.value = theme.nebula || 0;
    u.uSynth.value = theme.id === 'synth' ? 1 : 0;

    this.sun.color.copy(sunColor);
    this.sun.intensity = sunI;
    this.hemi.color.copy(c(theme.hemi.sky)).lerp(top, 0.25);
    this.hemi.groundColor.copy(c(theme.hemi.ground));
    this.hemi.intensity = theme.hemi.intensity * (o.tint ? 0.85 + 0.3 * (1 - o.tintAmt) : 1);
    this.fill.color.copy(hor).lerp(c('#ffffff'), 0.3);
    this.fill.intensity = 0.25 + night * 0.25;

    const fogCol = hor.clone().lerp(bot, 0.15);
    this.scene.fog.color.copy(fogCol);
    this.scene.fog.density = theme.fog * (o.fogMul ?? 1);
    const sh = this.shared;
    sh.uFogColor.value.copy(fogCol);
    sh.uFogDensity.value = this.scene.fog.density;
    sh.uSunDir.value.copy(this.sunDir);
    sh.uSunColor.value.copy(sunColor).multiplyScalar(sunI * 0.32);
    sh.uHemiSky.value.copy(this.hemi.color).multiplyScalar(this.hemi.intensity * 0.55);
    sh.uHemiGround.value.copy(this.hemi.groundColor).multiplyScalar(this.hemi.intensity * 0.4);
    sh.uNight.value = night;
    this.night = night;
    this.skyColors = { top, hor, bot };

    // نقشهٔ محیطی از روی آسمان
    if (this.envRT) this.envRT.dispose();
    this.skyEnvMesh.material = this.sky.material;
    this.envRT = this.pmrem.fromScene(this.skyScene, 0, 0.1, 1000);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = 0.55 + (1 - night) * 0.25;

    this.buildGround(theme, bounds);
    this.buildScenery(theme, bounds);
    this.buildWeather(theme);
  }

  buildGround(theme, bounds) {
    if (this.ground) {
      this.scene.remove(this.ground);
      this.ground.geometry.dispose();
      this.ground.material.dispose();
      this.ground = null;
    }
    if (theme.ground === 'none') return;
    const type = theme.ground.toUpperCase();
    const mat = new THREE.ShaderMaterial({
      defines: { [`G_${type}`]: 1 },
      uniforms: {
        ...this.shared,
        uC1: { value: new THREE.Color(theme.groundColor[0]) },
        uC2: { value: new THREE.Color(theme.groundColor[1]) },
        uSkyTop: { value: this.skyColors.top },
        uSkyHor: { value: this.skyColors.hor },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        void main(){
          vec4 w = modelMatrix * vec4(position, 1.0);
          vWorld = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uFogColor, uSunDir, uSunColor, uHemiSky, uHemiGround, uC1, uC2, uSkyTop, uSkyHor;
        uniform float uFogDensity, uTime, uNight;
        varying vec3 vWorld;
        ${NOISE_GLSL}
        float waves(vec2 p){
          float h = 0.0;
          h += sin(p.x * 0.045 + uTime * 0.9) * 0.6;
          h += sin(p.y * 0.06 + p.x * 0.02 + uTime * 1.1) * 0.45;
          h += (vnoise(p * 0.12 + uTime * 0.25) - 0.5) * 1.1;
          h += (vnoise(p * 0.5 - uTime * 0.6) - 0.5) * 0.35;
          return h;
        }
        void main(){
          vec3 V = normalize(cameraPosition - vWorld);
          float dist = length(cameraPosition - vWorld);
          vec3 col;
          vec2 p = vWorld.xz;
          #if defined(G_OCEAN) || defined(G_SWAMP)
            float e = 0.6;
            float h0 = waves(p), hx = waves(p + vec2(e, 0.0)), hz = waves(p + vec2(0.0, e));
            vec3 N = normalize(vec3(h0 - hx, e * 1.6, h0 - hz));
            N = normalize(mix(N, vec3(0,1,0), smoothstep(150.0, 900.0, dist)));
            float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
            vec3 R = reflect(-V, N);
            vec3 skyR = mix(uSkyHor, uSkyTop, pow(clamp(R.y, 0.0, 1.0), 0.6));
            vec3 deep = uC1 * (uHemiSky * 0.8 + 0.25);
            col = mix(deep, skyR, 0.15 + fres * 0.75);
            float spec = pow(max(dot(R, uSunDir), 0.0), 260.0);
            float glit = pow(max(dot(R, uSunDir), 0.0), 18.0) * 0.15;
            col += uSunColor * (spec * 6.0 + glit);
            #ifdef G_SWAMP
              float alg = smoothstep(0.62, 0.8, fbm(p * 0.05 + uTime * 0.02));
              col = mix(col, uC2 * 1.6, alg * 0.5);
              col += uC2 * pow(vnoise(p * 0.8 + uTime), 12.0) * 2.0;
            #endif
          #elif defined(G_CLOUDS)
            vec2 q = p * 0.006 + vec2(uTime * 0.004, uTime * 0.002);
            float c = fbm(q * 3.0) * 0.7 + fbm(q * 9.0 + 2.0) * 0.3;
            float lit = clamp(0.55 + (c - 0.5) * 1.6, 0.0, 1.0);
            col = mix(uC2 * 0.75, uC1, lit) * (uHemiSky * 0.9 + uSunColor * 0.35 + 0.25);
            col += uSunColor * pow(lit, 4.0) * 0.25;
          #elif defined(G_LAVA)
            vec2 q = p * 0.02;
            float n = fbm(q + vec2(uTime * 0.03, -uTime * 0.02));
            float n2 = fbm(q * 3.0 - uTime * 0.05);
            float crack = smoothstep(0.42, 0.6, n) * (0.6 + n2 * 0.6);
            col = mix(uC1, uC2 * 1.7, crack);
            col += vec3(1.0, 0.7, 0.25) * pow(crack, 6.0) * 1.4;
          #elif defined(G_GRID)
            vec2 g = abs(fract(p / 12.0 - 0.5) - 0.5) / fwidth(p / 12.0);
            float line = 1.0 - min(min(g.x, g.y), 1.0);
            vec2 g2 = abs(fract(p / 60.0 - 0.5) - 0.5) / fwidth(p / 60.0);
            float line2 = 1.0 - min(min(g2.x, g2.y), 1.0);
            float fade = 1.0 - smoothstep(200.0, 900.0, dist);
            col = uC1 + uC2 * (line * 1.4 + line2 * 2.2) * fade;
            col += uC2 * 0.08;
          #elif defined(G_SAND)
            float d1 = sin(p.x * 0.03 + fbm(p * 0.01) * 6.0) * 0.5 + 0.5;
            float e = 1.0;
            float hh = d1 + fbm(p * 0.05) * 0.4;
            float hx2 = sin((p.x + e) * 0.03 + fbm((p + vec2(e,0.0)) * 0.01) * 6.0) * 0.5 + 0.5 + fbm((p + vec2(e,0.0)) * 0.05) * 0.4;
            vec3 N = normalize(vec3((hh - hx2) * 6.0, 1.0, 0.0));
            float diff = max(dot(N, uSunDir), 0.0);
            col = mix(uC1, uC2, d1) * (uHemiSky * 0.7 + uSunColor * diff * 0.9 + 0.1);
          #else
            // G_SNOW
            float n = fbm(p * 0.02);
            col = mix(uC2, uC1, 0.6 + n * 0.4) * (uHemiSky * 0.8 + uSunColor * 0.6 + 0.15);
            col += uSunColor * step(0.985, hash12(floor(p * 3.0))) * 0.8;
          #endif
          float fog = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist * 0.85);
          col = mix(col, uFogColor, clamp(fog, 0.0, 1.0));
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const geo = new THREE.PlaneGeometry(9000, 9000, 1, 1);
    geo.rotateX(-Math.PI / 2);
    this.ground = new THREE.Mesh(geo, mat);
    this.ground.frustumCulled = false;
    this.groundY = (bounds ? bounds.minY : 0) - (theme.ground === 'clouds' ? 30 : 48);
    this.ground.position.y = this.groundY;
    this.ground.renderOrder = -50;
    this.scene.add(this.ground);
  }

  clearScenery() {
    for (const ch of [...this.sceneryGroup.children]) {
      this.sceneryGroup.remove(ch);
      ch.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      });
    }
    this.beacons = null;
  }

  // ساختمان‌ها با شیدر پنجره
  buildingMaterial(theme) {
    return new THREE.ShaderMaterial({
      uniforms: {
        ...this.shared,
        uBase: { value: new THREE.Color(theme.id === 'neon' || theme.id === 'synth' ? '#14122a' : '#5c6576') },
        uWinA: { value: new THREE.Color('#ffc477') },
        uWinB: { value: new THREE.Color(theme.id === 'neon' ? '#ff4fd8' : '#8fd8ff') },
        uLit: { value: 0.16 + theme.night * 0.2 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorld; varying vec3 vN; varying float vId;
        void main(){
          vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
          vWorld = w.xyz;
          vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
          vId = float(gl_InstanceID);
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uFogColor, uSunDir, uSunColor, uHemiSky, uHemiGround, uBase, uWinA, uWinB;
        uniform float uFogDensity, uNight, uLit, uTime;
        varying vec3 vWorld; varying vec3 vN; varying float vId;
        ${NOISE_GLSL}
        void main(){
          vec3 N = normalize(vN);
          float diff = max(dot(N, uSunDir), 0.0);
          vec3 amb = mix(uHemiGround, uHemiSky, N.y * 0.5 + 0.5);
          vec3 base = uBase * (0.85 + 0.3 * hash12(vec2(vId, 3.0)));
          vec3 col = base * (amb + uSunColor * diff);
          if (abs(N.y) < 0.5) {
            float u = abs(N.x) > 0.5 ? vWorld.z : vWorld.x;
            vec2 cell = vec2(u / 3.2, vWorld.y / 3.6);
            vec2 f = fract(cell);
            float win = step(0.16, f.x) * step(f.x, 0.84) * step(0.2, f.y) * step(f.y, 0.8);
            float r = hash12(floor(cell) + vId * 7.13);
            float on = step(1.0 - uLit, r);
            vec3 wc = mix(uWinA, uWinB, step(0.72, hash12(floor(cell) * 1.7 + vId)));
            col = mix(col, col * 0.35 + vec3(0.03, 0.04, 0.06), win * 0.8);
            col += wc * win * on * (0.45 + uNight * 1.05) * (0.7 + 0.3 * hash12(floor(cell) + 9.0));
            // نور اتاق‌های تاریک
            col += vec3(0.25, 0.3, 0.4) * win * (1.0 - on) * 0.05 * (1.0 + uNight);
          } else {
            col *= 0.7;
          }
          float dist = length(cameraPosition - vWorld);
          float fog = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist * 0.85);
          col = mix(col, uFogColor, clamp(fog, 0.0, 1.0));
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
  }

  buildScenery(theme, bounds) {
    this.clearScenery();
    if (!bounds) return;
    const rng = mulberry32(theme.id.length * 977 + Math.floor(bounds.center.x));
    const q = this.quality.scenery;
    const path = bounds.points;
    const far = (x, z, clear) => {
      for (let i = 0; i < path.length; i += 2) {
        const p = path[i];
        const dx = p.x - x, dz = p.z - z;
        if (dx * dx + dz * dz < clear * clear) return false;
      }
      return true;
    };
    const cx = bounds.center.x, cz = bounds.center.z;
    const span = Math.max(120, bounds.radius);
    const g = this.groundY ?? bounds.minY - 48;

    if (theme.scenery === 'city') {
      const count = Math.floor(420 * q);
      const geo = new THREE.BoxGeometry(1, 1, 1);
      geo.translate(0, 0.5, 0);
      const mesh = new THREE.InstancedMesh(geo, this.buildingMaterial(theme), count);
      const m = new THREE.Matrix4();
      let n = 0;
      const beaconPos = [];
      for (let i = 0; i < count * 3 && n < count; i++) {
        const a = rng() * Math.PI * 2;
        const r = 30 + Math.pow(rng(), 0.7) * (span + 700);
        const x = cx + Math.sin(a) * r, z = cz + Math.cos(a) * r;
        const w = 12 + rng() * 26, d = 12 + rng() * 26;
        if (!far(x, z, 22 + Math.max(w, d) * 0.75)) continue;
        const h = (40 + rng() * rng() * 220) * (r > span ? 1.4 : 1) + (bounds.maxY - bounds.minY) * 0.6;
        m.compose(new V3(x, g, z), new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), rng() * 0.4), new V3(w, h, d));
        mesh.setMatrixAt(n++, m);
        if (h > 150 && rng() < 0.6) beaconPos.push(x, g + h + 1.5, z);
      }
      mesh.count = n;
      mesh.frustumCulled = false;
      this.sceneryGroup.add(mesh);
      if (beaconPos.length) {
        const bg = new THREE.BufferGeometry();
        bg.setAttribute('position', new THREE.Float32BufferAttribute(beaconPos, 3));
        const bm = new THREE.PointsMaterial({ color: 0xff2a2a, size: 6, map: this.sprites.soft, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false });
        this.beacons = new THREE.Points(bg, bm);
        this.sceneryGroup.add(this.beacons);
      }
    } else if (theme.scenery === 'mountains' || theme.scenery === 'mountainsWire' || theme.scenery === 'mesas') {
      const wire = theme.scenery === 'mountainsWire';
      const mesa = theme.scenery === 'mesas';
      const variants = 3;
      for (let v = 0; v < variants; v++) {
        const geo = mesa ? new THREE.CylinderGeometry(1, 1.15, 1, 18, 6) : new THREE.ConeGeometry(1, 1, 22, 10);
        geo.translate(0, 0.5, 0);
        const pos = geo.attributes.position;
        const vr = mulberry32(v * 31 + 5);
        const colors = [];
        const snow = new THREE.Color(theme.id === 'volcano' ? '#3a1a12' : '#f4f8ff');
        const rock = new THREE.Color(theme.id === 'volcano' ? '#1c1110' : mesa ? '#b9683a' : theme.id === 'frozen' ? '#6d86a3' : '#4a5160');
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
          const rr = Math.hypot(x, z);
          if (rr > 0.01 && y < 0.98) {
            const k = 1 + (vr() - 0.5) * (mesa ? 0.12 : 0.45);
            pos.setXYZ(i, x * k, y + (mesa ? 0 : (vr() - 0.5) * 0.06), z * k);
          }
          const c = mesa ? rock.clone().lerp(new THREE.Color('#e5a26a'), Math.sin(y * 20) * 0.5 + 0.5) : rock.clone().lerp(snow, y > 0.62 ? 1 : y > 0.5 ? (y - 0.5) / 0.12 : 0);
          colors.push(c.r, c.g, c.b);
        }
        geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geo.computeVertexNormals();
        const mat = wire
          ? new THREE.MeshBasicMaterial({ color: new THREE.Color(theme.trim).multiplyScalar(1.6), wireframe: true, fog: true, transparent: true, opacity: 0.85 })
          : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true });
        const count = Math.floor((mesa ? 26 : 22) * q);
        const mesh = new THREE.InstancedMesh(geo, mat, count);
        const m = new THREE.Matrix4();
        for (let i = 0; i < count; i++) {
          const a = rng() * Math.PI * 2;
          const r = span + (wire ? 700 : 250) + rng() * 900;
          const s = mesa ? 40 + rng() * 90 : 160 + rng() * 260;
          const h = mesa ? 60 + rng() * 140 + (bounds.maxY - g) : s * (wire ? 0.45 : 0.8 + rng() * 0.9) + (bounds.maxY - g) * (wire ? 0.2 : 0.5);
          m.compose(new V3(cx + Math.sin(a) * r, g - 5, cz + Math.cos(a) * r), new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), rng() * 6), new V3(s, h, s));
          mesh.setMatrixAt(i, m);
        }
        mesh.frustumCulled = false;
        this.sceneryGroup.add(mesh);
        if (wire) {
          const fillMat = new THREE.MeshBasicMaterial({ color: '#0a0118', fog: true });
          const fillMesh = new THREE.InstancedMesh(geo, fillMat, count);
          for (let i = 0; i < count; i++) {
            mesh.getMatrixAt(i, m);
            m.multiply(new THREE.Matrix4().makeScale(0.985, 0.985, 0.985));
            fillMesh.setMatrixAt(i, m);
          }
          fillMesh.frustumCulled = false;
          this.sceneryGroup.add(fillMesh);
        }
      }
    } else if (theme.scenery === 'islands' || theme.scenery === 'trees') {
      const trees = theme.scenery === 'trees';
      // جزیره‌های معلق
      const geo = new THREE.ConeGeometry(1, 1.4, 9, 4);
      geo.rotateX(Math.PI);
      geo.translate(0, -0.7, 0);
      const pos = geo.attributes.position;
      const vr = mulberry32(77);
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        if (y < -0.05) pos.setXYZ(i, pos.getX(i) * (0.8 + vr() * 0.4), y, pos.getZ(i) * (0.8 + vr() * 0.4));
      }
      geo.computeVertexNormals();
      const top = new THREE.CylinderGeometry(1.02, 1, 0.18, 9);
      top.translate(0, 0.05, 0);
      const count = Math.floor(70 * q);
      const rockMat = new THREE.MeshStandardMaterial({ color: trees ? '#3a2c22' : '#8a7a6a', roughness: 0.95, flatShading: true });
      const grassMat = new THREE.MeshStandardMaterial({ color: trees ? '#1f6b4a' : '#6fcf6a', roughness: 0.85, flatShading: true });
      const rocks = new THREE.InstancedMesh(geo, rockMat, count);
      const grass = new THREE.InstancedMesh(top, grassMat, count);
      const m = new THREE.Matrix4();
      let n = 0;
      const treeSpots = [];
      for (let i = 0; i < count * 4 && n < count; i++) {
        const a = rng() * Math.PI * 2;
        const r = 40 + rng() * (span + 500);
        const x = cx + Math.sin(a) * r, z = cz + Math.cos(a) * r;
        if (!far(x, z, 30)) continue;
        const s = 6 + rng() * 26;
        const y = bounds.minY - 20 + rng() * (bounds.maxY - bounds.minY + 60);
        m.compose(new V3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), rng() * 6), new V3(s, s * (0.7 + rng() * 0.6), s));
        rocks.setMatrixAt(n, m);
        grass.setMatrixAt(n, m);
        if (trees || rng() < 0.4) treeSpots.push([x, y + s * 0.12, z, s]);
        n++;
      }
      rocks.count = grass.count = n;
      rocks.frustumCulled = grass.frustumCulled = false;
      this.sceneryGroup.add(rocks, grass);
      if (treeSpots.length) {
        const trunk = new THREE.CylinderGeometry(0.06, 0.1, 1, 6);
        trunk.translate(0, 0.5, 0);
        const crown = new THREE.IcosahedronGeometry(0.32, 0);
        crown.translate(0, 1.05, 0);
        const tc = treeSpots.length * 3;
        const tm = new THREE.InstancedMesh(trunk, new THREE.MeshStandardMaterial({ color: '#5a3d26', roughness: 1 }), tc);
        const cm = new THREE.InstancedMesh(
          crown,
          new THREE.MeshStandardMaterial({ color: trees ? '#2a8f6a' : '#3f9d4a', roughness: 0.8, flatShading: true, emissive: trees ? '#0d6b4a' : '#000000', emissiveIntensity: trees ? 0.6 : 0 }),
          tc,
        );
        let k = 0;
        for (const [x, y, z, s] of treeSpots) {
          for (let j = 0; j < 3 && k < tc; j++) {
            const ox = (rng() - 0.5) * s * 0.9, oz = (rng() - 0.5) * s * 0.9;
            const ts = s * (0.35 + rng() * 0.45);
            m.compose(new V3(x + ox, y, z + oz), new THREE.Quaternion(), new V3(ts, ts, ts));
            tm.setMatrixAt(k, m);
            cm.setMatrixAt(k, m);
            k++;
          }
        }
        tm.count = cm.count = k;
        tm.frustumCulled = cm.frustumCulled = false;
        this.sceneryGroup.add(tm, cm);
      }
    } else if (theme.scenery === 'planet') {
      const pg = new THREE.SphereGeometry(1, 64, 32);
      const pmat = new THREE.ShaderMaterial({
        uniforms: { uSunDir: this.shared.uSunDir, uTime: this.shared.uTime },
        vertexShader: `varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(mat3(modelMatrix) * normal); vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
        fragmentShader: `uniform vec3 uSunDir; uniform float uTime; varying vec3 vN; varying vec3 vP; ${NOISE_GLSL}
          void main(){ float lat = vP.y; float b = fbm(vec2(lat * 6.0 + fbm(vP.xz * 3.0) * 1.5, uTime * 0.01));
            vec3 c = mix(vec3(0.85,0.45,0.25), vec3(0.95,0.85,0.65), b); c = mix(c, vec3(0.5,0.25,0.2), smoothstep(0.6,0.8,fbm(vP.xz*5.0+lat*3.0)));
            float d = max(dot(normalize(vN), uSunDir), 0.0); float rim = pow(1.0 - abs(dot(normalize(vN), vec3(0,0,1))), 3.0);
            vec3 col = c * (0.04 + d * 1.3) + vec3(0.4,0.6,1.0) * rim * 0.35 * (0.3 + d);
            gl_FragColor = vec4(col, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      });
      const planet = new THREE.Mesh(pg, pmat);
      planet.scale.setScalar(700);
      planet.position.set(cx - 1600, bounds.minY + 200, cz + 2400);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(1.35, 2.2, 96, 1),
        new THREE.MeshBasicMaterial({ color: '#d9c2a0', side: THREE.DoubleSide, transparent: true, opacity: 0.45, fog: false, depthWrite: false }),
      );
      ring.rotation.x = -1.2;
      ring.rotation.y = 0.3;
      planet.add(ring);
      const moon = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.MeshStandardMaterial({ color: '#9aa0ad', roughness: 1 }));
      moon.scale.setScalar(90);
      moon.position.set(cx + 900, bounds.maxY + 350, cz + 1500);
      this.sceneryGroup.add(planet, moon);
      // سازه‌های فضایی دور
      const truss = new THREE.BoxGeometry(1, 1, 1);
      const count = Math.floor(60 * q);
      const tm = new THREE.InstancedMesh(truss, new THREE.MeshStandardMaterial({ color: '#7d8597', metalness: 0.8, roughness: 0.35 }), count);
      const m = new THREE.Matrix4();
      for (let i = 0; i < count; i++) {
        const a = rng() * Math.PI * 2, r = span + 80 + rng() * 400;
        const long = rng() < 0.5;
        m.compose(
          new V3(cx + Math.sin(a) * r, bounds.minY + rng() * (bounds.maxY - bounds.minY + 100) - 30, cz + Math.cos(a) * r),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(rng() * 3, rng() * 3, rng() * 3)),
          long ? new V3(2, 2, 40 + rng() * 80) : new V3(10 + rng() * 20, 4, 10 + rng() * 20),
        );
        tm.setMatrixAt(i, m);
      }
      tm.frustumCulled = false;
      this.sceneryGroup.add(tm);
    }
  }

  buildWeather(theme) {
    if (this.weather) {
      this.scene.remove(this.weather);
      this.weather.geometry.dispose();
      this.weather.material.dispose();
      this.weather = null;
    }
    const kind = theme.weather;
    if (kind === 'none') return;
    const count = Math.floor((kind === 'stars' ? 900 : kind === 'snow' ? 1800 : 700) * this.quality.particles);
    const rng = mulberry32(99);
    const pos = new Float32Array(count * 3), rnd = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = rng() * 80;
      pos[i * 3 + 1] = rng() * 50;
      pos[i * 3 + 2] = rng() * 80;
      rnd[i] = rng();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 1));
    const cfg = {
      snow: { color: '#ffffff', size: 0.16, vel: [0.4, -1.6, 0.2], add: false, alpha: 0.9 },
      embers: { color: '#ff7a2a', size: 0.14, vel: [0.3, 2.2, 0.1], add: true, alpha: 1.0 },
      fireflies: { color: '#c6ff6a', size: 0.2, vel: [0.1, 0.15, 0.05], add: true, alpha: 1.0 },
      dust: { color: '#ffe2b8', size: 0.07, vel: [0.5, 0.05, 0.3], add: true, alpha: 0.5 },
      stars: { color: '#cfe0ff', size: 0.08, vel: [0, 0, -0.6], add: true, alpha: 0.8 },
    }[kind];
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: cfg.add ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: {
        uTime: this.shared.uTime,
        uCam: { value: new V3() },
        uColor: { value: new THREE.Color(cfg.color).multiplyScalar(cfg.add ? 2.2 : 1) },
        uVel: { value: new V3(...cfg.vel) },
        uSize: { value: cfg.size },
        uAlpha: { value: cfg.alpha },
        uMap: { value: this.sprites.soft },
        uPR: { value: this.renderer.getPixelRatio() },
        uKind: { value: ['snow', 'embers', 'fireflies', 'dust', 'stars'].indexOf(kind) },
      },
      vertexShader: /* glsl */ `
        attribute float aRnd;
        uniform float uTime, uSize, uPR, uKind;
        uniform vec3 uCam, uVel;
        varying float vA;
        void main(){
          vec3 box = vec3(80.0, 50.0, 80.0);
          vec3 p = position + uVel * uTime * (0.6 + aRnd * 0.8);
          p.x += sin(uTime * (0.5 + aRnd) + aRnd * 30.0) * (uKind == 2.0 ? 1.5 : 0.6);
          p.z += cos(uTime * (0.4 + aRnd) + aRnd * 17.0) * (uKind == 2.0 ? 1.5 : 0.6);
          p = mod(p - uCam + box * 0.5, box) - box * 0.5 + uCam;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float tw = uKind == 2.0 ? smoothstep(0.2, 1.0, sin(uTime * (1.5 + aRnd * 2.0) + aRnd * 40.0)) : uKind == 1.0 ? 0.5 + 0.5 * sin(uTime * 6.0 + aRnd * 20.0) : 1.0;
          vA = tw * smoothstep(40.0, 15.0, length(mv.xyz));
          gl_PointSize = uSize * (0.6 + aRnd * 0.8) * uPR * 600.0 / max(1.0, -mv.z);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap; uniform vec3 uColor; uniform float uAlpha;
        varying float vA;
        void main(){
          vec4 t = texture2D(uMap, gl_PointCoord);
          gl_FragColor = vec4(uColor, t.a * vA * uAlpha);
        }`,
    });
    this.weather = new THREE.Points(geo, mat);
    this.weather.frustumCulled = false;
    this.scene.add(this.weather);
  }

  update(dt, camera, focus) {
    this.time += dt;
    this.shared.uTime.value = this.time;
    this.sky.material.uniforms.uTime.value = this.time;
    this.sky.position.copy(camera.position);
    if (this.ground) {
      this.ground.position.x = camera.position.x;
      this.ground.position.z = camera.position.z;
    }
    if (this.weather) this.weather.material.uniforms.uCam.value.copy(camera.position);
    if (this.beacons) this.beacons.material.opacity = Math.sin(this.time * 3) > 0.2 ? 1 : 0.15;
    // سایه‌ها دنبال بازیکن، با گرد کردن به اندازهٔ تکسل برای جلوگیری از لرزش
    if (focus) {
      const dir = this.sunDir;
      const half = this.shadowHalf || 30;
      const size = this.sun.shadow.mapSize.x || 2048;
      const texel = (half * 2) / size;
      const W = this._w || (this._w = { right: new V3(), upv: new V3(), up: new V3(0, 1, 0.0001), snapped: new V3(), fd: new V3() });
      const right = W.right.crossVectors(dir, W.up).normalize();
      const upv = W.upv.crossVectors(right, dir).normalize();
      const r = Math.round(focus.dot(right) / texel) * texel;
      const u = Math.round(focus.dot(upv) / texel) * texel;
      const f = focus.dot(dir);
      const snapped = W.snapped.set(0, 0, 0).addScaledVector(right, r).addScaledVector(upv, u).addScaledVector(dir, f);
      this.sun.target.position.copy(snapped);
      this.sun.position.copy(snapped).addScaledVector(dir, 100);
      this.fill.target.position.copy(focus);
      this.fill.position.copy(focus).addScaledVector(W.fd.set(-dir.x, 0.4, -dir.z).normalize(), 50);
    }
    // رعدوبرق برای نورپردازی طوفانی
    if (this.lightning) {
      this.lightningTimer -= dt;
      if (this.lightningTimer < 0) {
        this.flash = 1;
        this.lightningTimer = 3 + Math.random() * 7;
        this.onThunder && this.onThunder();
      }
    }
    this.flash = Math.max(0, this.flash - dt * 3.5);
    const fl = this.flash > 0 ? this.flash * (Math.sin(this.time * 60) > 0 ? 1 : 0.4) : 0;
    this.sky.material.uniforms.uFlash.value = fl * 0.6;
    this.hemiBase = this.hemiBase ?? this.hemi.intensity;
  }
}
