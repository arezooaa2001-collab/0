// WebGL renderer + post-processing chain driven by the selected graphics preset.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

const SpeedBlurShader = {
  name: 'SpeedBlurShader',
  defines: { SAMPLES: 8 },
  uniforms: {
    tDiffuse: { value: null },
    strength: { value: 0 },
    center: { value: new THREE.Vector2(0.5, 0.48) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float strength;
    uniform vec2 center;
    varying vec2 vUv;
    void main() {
      vec2 dir = vUv - center;
      float amt = strength * smoothstep(0.1, 0.8, length(dir));
      vec4 acc = vec4(0.0);
      for (int i = 0; i < SAMPLES; i++) {
        float t = float(i) / float(SAMPLES);
        acc += texture2D(tDiffuse, vUv - dir * amt * t);
      }
      gl_FragColor = acc / float(SAMPLES);
    }`,
};

const GradeShader = {
  name: 'GradeShader',
  uniforms: {
    tDiffuse: { value: null },
    vignette: { value: 0.35 },
    grain: { value: 0 },
    aberration: { value: 0 },
    saturation: { value: 1.08 },
    contrast: { value: 1.04 },
    tint: { value: new THREE.Color(1, 1, 1) },
    time: { value: 0 },
    flash: { value: 0 },
  },
  vertexShader: SpeedBlurShader.vertexShader,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float vignette, grain, aberration, saturation, contrast, time, flash;
    uniform vec3 tint;
    varying vec2 vUv;
    float rand(vec2 c) { return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 d = vUv - 0.5;
      vec3 col;
      if (aberration > 0.0) {
        col.r = texture2D(tDiffuse, vUv + d * aberration).r;
        col.g = texture2D(tDiffuse, vUv).g;
        col.b = texture2D(tDiffuse, vUv - d * aberration).b;
      } else {
        col = texture2D(tDiffuse, vUv).rgb;
      }
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, saturation);
      col = (col - 0.5) * contrast + 0.5;
      col *= tint;
      float v = smoothstep(0.95, 0.3, length(d) * 1.15);
      col *= mix(1.0, v, vignette);
      col += (rand(vUv * (time + 1.0)) - 0.5) * grain;
      col = mix(col, vec3(1.0, 0.92, 0.8), flash);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }`,
};

export class Gfx {
  constructor(container) {
    this.container = container;
    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
      alpha: false,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.setClearColor(0x0b0f1a, 1);
    renderer.info.autoReset = false;
    // shadow maps are rendered once per frame (not again for AO / reflection passes)
    renderer.shadowMap.autoUpdate = false;
    renderer.domElement.className = 'game-canvas';
    container.appendChild(renderer.domElement);
    this.renderer = renderer;
    const gl = renderer.getContext();
    this.caps = {
      maxSamples: gl.getParameter(gl.MAX_SAMPLES) || 0,
      maxTexture: renderer.capabilities.maxTextureSize,
      maxAnisotropy: renderer.capabilities.getMaxAnisotropy(),
      maxRenderbuffer: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) || 4096,
    };
    this.scene = null;
    this.camera = null;
    this.composer = null;
    this.passes = {};
    this.tier = null;
    this.speedBlur = 0;
    this.flash = 0;
    this.grade = { saturation: 1.08, contrast: 1.04, tint: new THREE.Color(1, 1, 1), vignette: 0.35 };
    this.time = 0;
    this.width = 1;
    this.height = 1;
    this.pixelRatio = 1;
    this.contextLost = false;
    renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.contextLost = true;
      this.onContextLost?.();
    });
    renderer.domElement.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;
      this.onContextRestored?.();
    });
    this.#measure();
  }

  #measure() {
    const w = Math.max(1, this.container.clientWidth || window.innerWidth);
    const h = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.width = w;
    this.height = h;
  }

  #pixelRatioFor(tier) {
    const dpr = window.devicePixelRatio || 1;
    let pr = Math.min(dpr, tier.dprCap) * tier.scale;
    pr = Math.min(pr, Math.sqrt(tier.maxPixels / (this.width * this.height)));
    const maxDim = Math.min(this.caps.maxRenderbuffer, this.caps.maxTexture) * 0.98;
    pr = Math.min(pr, maxDim / this.width, maxDim / this.height);
    return Math.max(0.35, pr);
  }

  setTier(tier) {
    const prev = this.tier;
    this.tier = tier;
    const r = this.renderer;
    const shadowsOn = tier.shadowType !== 'none';
    const type = tier.shadowType === 'soft' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    const shadowChanged = !prev || prev.shadowType !== tier.shadowType;
    r.shadowMap.enabled = shadowsOn;
    r.shadowMap.type = type;
    r.shadowMap.needsUpdate = true;
    if (shadowChanged && this.scene) this.#refreshMaterials(this.scene);
    this.resize(true);
  }

  #refreshMaterials(scene) {
    scene.traverse((o) => {
      const m = o.material;
      if (!m) return;
      if (Array.isArray(m)) m.forEach((x) => (x.needsUpdate = true));
      else m.needsUpdate = true;
    });
  }

  /** Sets the active scene/camera and rebuilds the pass chain. */
  setView(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.#buildComposer();
  }

  #disposeComposer() {
    if (!this.composer) return;
    for (const p of this.composer.passes) p.dispose?.();
    this.composer.dispose();
    this.composer = null;
    this.passes = {};
  }

  #buildComposer() {
    this.#disposeComposer();
    const tier = this.tier;
    if (!tier || !this.scene || !this.camera) return;
    const usePost = tier.index > 0;
    if (!usePost) return; // "Low" renders straight to the canvas for maximum speed
    const r = this.renderer;
    const w = Math.round(this.width * this.pixelRatio);
    const h = Math.round(this.height * this.pixelRatio);
    const samples = Math.min(tier.msaa, this.caps.maxSamples);
    const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples });
    const composer = new EffectComposer(r, rt);
    composer.setPixelRatio(this.pixelRatio);
    composer.setSize(this.width, this.height);
    composer.addPass(new RenderPass(this.scene, this.camera));
    if (tier.ao) {
      try {
        const ao = new GTAOPass(this.scene, this.camera, w, h);
        ao.output = GTAOPass.OUTPUT.Default;
        ao.blendIntensity = 0.85;
        ao.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.5, thickness: 2, scale: 1, samples: tier.aoSamples });
        ao.updatePdMaterial({ samples: 12, rings: 2, radius: 6 });
        composer.addPass(ao);
        this.passes.ao = ao;
      } catch (e) {
        console.warn('AO disabled', e);
      }
    }
    if (tier.motionBlur > 0) {
      const blur = new ShaderPass({ ...SpeedBlurShader, defines: { SAMPLES: tier.motionBlur } });
      blur.enabled = false;
      composer.addPass(blur);
      this.passes.blur = blur;
    }
    if (tier.bloom > 0) {
      const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), tier.bloom, 0.55, 0.82);
      composer.addPass(bloom);
      this.passes.bloom = bloom;
    }
    composer.addPass(new OutputPass());
    if (tier.grade) {
      const grade = new ShaderPass(GradeShader);
      grade.uniforms.grain.value = tier.grain;
      grade.uniforms.aberration.value = tier.aberration;
      composer.addPass(grade);
      this.passes.grade = grade;
    }
    if (tier.fxaa) {
      const fxaa = new ShaderPass(FXAAShader);
      fxaa.uniforms.resolution.value.set(1 / w, 1 / h);
      composer.addPass(fxaa);
      this.passes.fxaa = fxaa;
    }
    this.composer = composer;
  }

  resize(force = false) {
    const prevW = this.width, prevH = this.height;
    this.#measure();
    if (!this.tier) return;
    const pr = this.#pixelRatioFor(this.tier);
    const changed = force || pr !== this.pixelRatio || prevW !== this.width || prevH !== this.height;
    if (!changed) return;
    this.pixelRatio = pr;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(this.width, this.height, true);
    if (this.camera) {
      this.camera.aspect = this.width / this.height;
      this.camera.updateProjectionMatrix();
    }
    this.#buildComposer();
  }

  setGrade(g) {
    Object.assign(this.grade, g);
  }

  render(dt) {
    if (this.contextLost || !this.scene || !this.camera) return;
    this.time += dt;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 3);
    this.renderer.info.reset();
    this.renderer.shadowMap.needsUpdate = true;
    if (!this.composer) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    const { blur, grade, ao } = this.passes;
    if (blur) {
      blur.enabled = this.speedBlur > 0.004;
      blur.uniforms.strength.value = this.speedBlur;
    }
    if (ao) {
      ao.camera = this.camera;
    }
    if (grade) {
      const u = grade.uniforms;
      u.time.value = this.time % 100;
      u.saturation.value = this.grade.saturation;
      u.contrast.value = this.grade.contrast;
      u.tint.value.copy(this.grade.tint);
      u.vignette.value = this.grade.vignette;
      u.flash.value = this.flash;
    }
    this.composer.render(dt);
  }

  get maxAnisotropy() {
    return this.caps.maxAnisotropy;
  }

  dispose() {
    this.#disposeComposer();
    this.renderer.dispose();
  }
}
