// گنبد آسمان با شیدر: گرادیان، خورشید، ابر رویه‌ای، ستاره، شفق و سحابی
import * as THREE from 'three';

export const NOISE_GLSL = /* glsl */ `
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash13(vec3 p3){ p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash12(i), hash12(i+vec2(1,0)), u.x), mix(hash12(i+vec2(0,1)), hash12(i+vec2(1,1)), u.x), u.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for(int i=0;i<5;i++){ s += a*vnoise(p); p = p*2.03 + vec2(1.7,9.2); a *= 0.5; } return s; }
float fbm3(vec2 p){ float s = 0.0, a = 0.5; for(int i=0;i<3;i++){ s += a*vnoise(p); p = p*2.07 + vec2(3.1,1.3); a *= 0.5; } return s; }
`;

export function createSkyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uBottom: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0, 0.3, 1).normalize() },
      uSunColor: { value: new THREE.Color(1, 1, 1) },
      uSunSize: { value: 1 },
      uTime: { value: 0 },
      uClouds: { value: 0.4 },
      uStars: { value: 0 },
      uAurora: { value: 0 },
      uNebula: { value: 0 },
      uFlash: { value: 0 },
      uSynth: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main(){
        vDir = position;
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop, uHorizon, uBottom, uSunDir, uSunColor;
      uniform float uSunSize, uTime, uClouds, uStars, uAurora, uNebula, uFlash, uSynth;
      varying vec3 vDir;
      ${NOISE_GLSL}
      void main(){
        vec3 d = normalize(vDir);
        float h = d.y;
        float up = clamp(h, 0.0, 1.0);
        vec3 col = mix(uHorizon, uTop, pow(up, 0.5));
        col = mix(col, uBottom, smoothstep(0.0, -0.35, h));
        float sd = max(dot(d, uSunDir), 0.0);
        // هالهٔ افق به سمت خورشید
        col += uSunColor * pow(sd, 5.0) * 0.45 * (1.0 - smoothstep(-0.1, 0.7, h));
        col += uSunColor * pow(sd, 48.0) * 0.7;
        // قرص خورشید (HDR برای bloom)
        float disc = smoothstep(1.0 - 0.0011 * uSunSize, 1.0 - 0.0007 * uSunSize, sd);
        if (uSynth > 0.5) {
          // خورشید راه‌راه سبک سینث‌ویو
          vec3 sv = normalize(vec3(uSunDir.x, 0.0, uSunDir.z));
          float stripes = step(0.5, fract((d.y - uSunDir.y) * 90.0 + uTime * 0.4)) + step(0.02, d.y - uSunDir.y + 0.015);
          disc = smoothstep(1.0 - 0.006 * uSunSize, 1.0 - 0.0055 * uSunSize, sd) * clamp(stripes, 0.0, 1.0);
          vec3 sunGrad = mix(vec3(1.0, 0.2, 0.55), vec3(1.0, 0.85, 0.3), smoothstep(-0.05, 0.12, d.y - uSunDir.y + 0.06));
          col += sunGrad * disc * 4.0;
        } else {
          col += uSunColor * disc * 14.0;
        }
        // سحابی
        if (uNebula > 0.0) {
          vec2 q = d.xz / (abs(d.y) + 0.6) * 1.4 + d.y;
          float n = fbm(q * 1.3 + 4.0);
          float n2 = fbm(q * 2.6 - 7.0);
          vec3 neb = mix(vec3(0.35, 0.05, 0.6), vec3(0.0, 0.5, 0.9), n2) * pow(n, 3.0) * 1.6;
          neb += vec3(1.0, 0.25, 0.5) * pow(fbm(q * 3.1 + 11.0), 5.0) * 1.2;
          col += neb * uNebula;
        }
        // ستاره‌ها
        if (uStars > 0.0) {
          vec3 sp = d * 380.0;
          vec3 cell = floor(sp);
          float r = hash13(cell);
          float tw = 0.6 + 0.4 * sin(uTime * (1.0 + r * 4.0) + r * 50.0);
          float star = step(0.9975, r) * smoothstep(0.42, 0.0, length(fract(sp) - 0.5));
          col += vec3(0.85 + r * 0.3, 0.9, 1.0) * star * tw * uStars * 2.2 * smoothstep(-0.02, 0.15, h);
        }
        // شفق قطبی
        if (uAurora > 0.0 && h > 0.0) {
          vec2 q = d.xz / (h + 0.25);
          float band = fbm(vec2(q.x * 0.7 + uTime * 0.03, q.y * 0.25));
          float curtain = smoothstep(0.35, 0.75, band) * smoothstep(0.05, 0.35, h) * (1.0 - smoothstep(0.55, 0.95, h));
          float ripple = 0.6 + 0.4 * sin(q.x * 9.0 + uTime * 0.8 + band * 10.0);
          vec3 ac = mix(vec3(0.1, 1.0, 0.55), vec3(0.5, 0.2, 1.0), smoothstep(0.2, 0.7, h));
          col += ac * curtain * ripple * uAurora * 1.3;
        }
        // ابرها (صفحهٔ تصویری روی آسمان)
        if (uClouds > 0.0 && h > -0.02) {
          vec2 uv = d.xz / (h + 0.09) * 0.55;
          uv += vec2(uTime * 0.006, uTime * 0.0035);
          float c = fbm(uv * 1.6);
          float c2 = fbm3(uv * 4.5 + 3.0);
          float cov = smoothstep(1.0 - uClouds, 1.0 - uClouds + 0.32, c * 0.78 + c2 * 0.3);
          float lit = pow(sd, 3.0);
          vec3 cloudCol = mix(uHorizon * 0.65 + uTop * 0.25, vec3(1.0), 0.35) + uSunColor * (0.25 + lit * 1.1);
          vec3 shade = mix(uTop, uHorizon, 0.5) * 0.55;
          vec3 cc = mix(shade, cloudCol, smoothstep(0.3, 0.9, c2 + lit * 0.4));
          float fade = smoothstep(-0.02, 0.18, h);
          col = mix(col, cc, cov * fade * 0.92);
        }
        col += vec3(0.8, 0.85, 1.0) * uFlash;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

export function createSky() {
  const geo = new THREE.SphereGeometry(4500, 48, 24);
  const mat = createSkyMaterial();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -100;
  return mesh;
}
