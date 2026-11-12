import * as THREE from 'three';

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const BRIGHT = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 texel;
uniform float threshold;
varying vec2 vUv;
void main() {
  // 4-tap box downsample keeps the bloom from flickering
  vec3 c = texture2D(tDiffuse, vUv + texel * vec2(-1.0, -1.0)).rgb;
  c += texture2D(tDiffuse, vUv + texel * vec2(1.0, -1.0)).rgb;
  c += texture2D(tDiffuse, vUv + texel * vec2(-1.0, 1.0)).rgb;
  c += texture2D(tDiffuse, vUv + texel * vec2(1.0, 1.0)).rgb;
  c *= 0.25;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float k = smoothstep(threshold, threshold * 1.8 + 0.15, l);
  gl_FragColor = vec4(min(c * k, vec3(24.0)), 1.0);
}`;

const BLUR = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 dir;
varying vec2 vUv;
void main() {
  vec3 s = texture2D(tDiffuse, vUv).rgb * 0.227027;
  s += (texture2D(tDiffuse, vUv + dir * 1.3846).rgb + texture2D(tDiffuse, vUv - dir * 1.3846).rgb) * 0.316216;
  s += (texture2D(tDiffuse, vUv + dir * 3.2308).rgb + texture2D(tDiffuse, vUv - dir * 3.2308).rgb) * 0.070270;
  gl_FragColor = vec4(s, 1.0);
}`;

const FINAL = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tB1;
uniform sampler2D tB2;
uniform sampler2D tB3;
uniform float bloom;
uniform float exposure;
uniform float vignette;
uniform float ca;
uniform float radial;
uniform float grain;
uniform float time;
uniform float saturation;
uniform float contrast;
uniform vec3 tint;
uniform vec2 res;
varying vec2 vUv;

vec3 postRRTFit(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}
vec3 postAces(vec3 color) {
  const mat3 IN = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 OUT = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  color *= exposure / 0.6;
  color = OUT * postRRTFit(IN * color);
  return clamp(color, 0.0, 1.0);
}
vec3 postSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
float postHash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}
void main() {
  vec2 d = vUv - 0.5;
  vec3 col;
  if (radial > 0.001) {
    // speed blur: smear toward the centre of the screen
    col = vec3(0.0);
    for (int i = 0; i < 6; i++) {
      float k = float(i) / 5.0;
      vec2 uv = vUv - d * radial * k;
      col += vec3(texture2D(tScene, uv + d * ca).r, texture2D(tScene, uv).g, texture2D(tScene, uv - d * ca).b);
    }
    col /= 6.0;
  } else if (ca > 0.0001) {
    col = vec3(texture2D(tScene, vUv + d * ca).r, texture2D(tScene, vUv).g, texture2D(tScene, vUv - d * ca).b);
  } else {
    col = texture2D(tScene, vUv).rgb;
  }
  vec3 b = texture2D(tB1, vUv).rgb * 0.55 + texture2D(tB2, vUv).rgb * 0.3 + texture2D(tB3, vUv).rgb * 0.25;
  col += b * bloom;
  col = postAces(col);
  // grading: saturation, contrast and a time-of-day tint
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, saturation);
  col = (col - 0.5) * contrast + 0.5;
  col *= tint;
  col = clamp(col, 0.0, 1.0);
  // vignette
  float v = smoothstep(0.95, 0.25, length(d * vec2(res.x / res.y, 1.0)) * 0.95);
  col *= mix(1.0, v, vignette);
  col = postSRGB(col);
  // fine grain also hides banding in the sky
  col += (postHash(vUv * res + fract(time) * 91.7) - 0.5) * grain;
  gl_FragColor = vec4(col, 1.0);
}`;

/**
 * Post-processing: HDR scene → bloom (3 blurred mip levels) → ACES tone mapping → grading,
 * vignette, chromatic aberration / speed blur and film grain.
 * level 1 = grading + vignette, 2 = + bloom, 3 = + speed effects and grain.
 */
export class Post {
  constructor(renderer, level) {
    this.R = renderer;
    this.level = level;
    this.enabled = level > 0;
    if (!this.enabled) return;
    const gl2 = renderer.capabilities.isWebGL2;
    const half = gl2 && (renderer.extensions.has('EXT_color_buffer_half_float') || renderer.extensions.has('EXT_color_buffer_float'));
    this.hdr = half;
    // without float targets the 8-bit linear buffer clips and bands: render straight to the screen instead
    if (!half) {
      this.enabled = false;
      return;
    }
    const type = THREE.HalfFloatType;
    const opts = { type, depthBuffer: false, stencilBuffer: false };
    this.rt = new THREE.WebGLRenderTarget(4, 4, { type, samples: gl2 ? 4 : 0 });
    this.rt.texture.colorSpace = THREE.LinearSRGBColorSpace;
    this.bl = [0, 1, 2].map(() => [new THREE.WebGLRenderTarget(4, 4, opts), new THREE.WebGLRenderTarget(4, 4, opts)]);
    this.black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    this.black.needsUpdate = true;
    const mk = (frag, uniforms) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
    this.mBright = mk(BRIGHT, { tDiffuse: { value: null }, texel: { value: new THREE.Vector2() }, threshold: { value: half ? 1.7 : 0.86 } });
    this.mBlur = mk(BLUR, { tDiffuse: { value: null }, dir: { value: new THREE.Vector2() } });
    this.mFinal = mk(FINAL, {
      tScene: { value: null }, tB1: { value: this.black }, tB2: { value: this.black }, tB3: { value: this.black },
      bloom: { value: 0 }, exposure: { value: 1 }, vignette: { value: 0.35 }, ca: { value: 0 }, radial: { value: 0 }, grain: { value: 0 },
      time: { value: 0 }, saturation: { value: 1.08 }, contrast: { value: 1.06 }, tint: { value: new THREE.Vector3(1, 1, 1) }, res: { value: new THREE.Vector2(1, 1) },
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    this.quad = new THREE.Mesh(geo, this.mFinal);
    this.quad.frustumCulled = false;
    this.qScene = new THREE.Scene();
    this.qScene.add(this.quad);
    this.qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.size = new THREE.Vector2();
  }
  setSize() {
    if (!this.enabled) return;
    this.R.getDrawingBufferSize(this.size);
    const w = Math.max(4, this.size.x), h = Math.max(4, this.size.y);
    this.rt.setSize(w, h);
    this.bl.forEach((pair, i) => {
      const s = 4 << i; // 1/4, 1/8, 1/16
      for (const t of pair) t.setSize(Math.max(2, Math.round(w / s)), Math.max(2, Math.round(h / s)));
    });
    this.mFinal.uniforms.res.value.set(w, h);
  }
  pass(mat, target) {
    this.quad.material = mat;
    this.R.setRenderTarget(target);
    this.R.render(this.qScene, this.qCam);
  }
  /** per-frame look: bloom stronger at night, warm at sunset, cool at night, speed effects */
  tune({ night = 0, dusk = 0, speed = 0, nitro = false, time = 0, flash = 0 }) {
    if (!this.enabled) return;
    const u = this.mFinal.uniforms;
    u.bloom.value = this.level >= 2 ? 0.2 + night * 0.22 + flash : 0;
    u.time.value = time;
    u.tint.value.set(1 + dusk * 0.06 - night * 0.04, 1 - night * 0.01, 1 - dusk * 0.06 + night * 0.06);
    u.saturation.value = 1.06 - night * 0.1;
    u.contrast.value = 1.04;
    u.vignette.value = 0.3 + night * 0.12;
    const fast = Math.max(0, Math.min(1, (speed - 25) / 30));
    u.ca.value = this.level >= 3 ? fast * 0.003 + (nitro ? 0.003 : 0) : 0;
    u.radial.value = this.level >= 3 ? fast * 0.018 + (nitro ? 0.022 : 0) : 0;
    u.grain.value = this.level >= 3 ? 0.035 : 0.012;
  }
  /** no motion effects (photo mode, pause, menu, jail): the speed blur would freeze on screen */
  calm() {
    if (!this.enabled) return;
    const u = this.mFinal.uniforms;
    u.ca.value = 0;
    u.radial.value = 0;
  }
  render(scene, camera) {
    const R = this.R;
    if (!this.enabled) return R.render(scene, camera);
    if (this.rt.width < 8) this.setSize();
    const u = this.mFinal.uniforms;
    u.exposure.value = R.toneMappingExposure;
    R.setRenderTarget(this.rt);
    R.render(scene, camera);
    if (this.level >= 2) {
      this.mBright.uniforms.tDiffuse.value = this.rt.texture;
      this.mBright.uniforms.texel.value.set(2 / this.rt.width, 2 / this.rt.height);
      let src = null;
      this.bl.forEach(([a, b], i) => {
        // bright pass into the first level, then each level blurs a downsampled copy of the one above
        if (i === 0) this.pass(this.mBright, a);
        else {
          this.mBlur.uniforms.tDiffuse.value = src.texture;
          this.mBlur.uniforms.dir.value.set(0, 0);
          this.pass(this.mBlur, a);
        }
        this.mBlur.uniforms.tDiffuse.value = a.texture;
        this.mBlur.uniforms.dir.value.set(1 / a.width, 0);
        this.pass(this.mBlur, b);
        this.mBlur.uniforms.tDiffuse.value = b.texture;
        this.mBlur.uniforms.dir.value.set(0, 1 / a.height);
        this.pass(this.mBlur, a);
        src = a;
      });
      u.tB1.value = this.bl[0][0].texture;
      u.tB2.value = this.bl[1][0].texture;
      u.tB3.value = this.bl[2][0].texture;
    }
    u.tScene.value = this.rt.texture;
    this.pass(this.mFinal, null);
  }
}
