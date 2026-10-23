import * as THREE from 'three';
import { clamp, smoothstep } from './util.js';

const vert = /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;
const frag = /* glsl */ `
varying vec3 vDir;
uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom;
uniform vec3 sunDir; uniform vec3 sunColor; uniform vec3 moonDir;
uniform float night; uniform float cloudT;
float hash(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float n2(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f);
  float a=fract(sin(dot(i,vec2(127.1,311.7)))*43758.5453);
  float b=fract(sin(dot(i+vec2(1,0),vec2(127.1,311.7)))*43758.5453);
  float c=fract(sin(dot(i+vec2(0,1),vec2(127.1,311.7)))*43758.5453);
  float d=fract(sin(dot(i+vec2(1,1),vec2(127.1,311.7)))*43758.5453);
  return mix(mix(a,b,f.x),mix(c,d,f.x),f.y); }
void main(){
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = h > 0.0 ? mix(horizon, top, pow(clamp(h,0.0,1.0), 0.5)) : mix(horizon, bottom, clamp(-h*5.0,0.0,1.0));
  float sd = max(dot(d, sunDir), 0.0);
  col += sunColor * (pow(sd, 1500.0) * 30.0 + pow(sd, 18.0) * 0.45 + pow(sd, 3.0) * 0.12);
  // soft clouds
  if (h > 0.02) {
    vec2 uv = d.xz / (h + 0.15) * 1.6 + vec2(cloudT, cloudT*0.3);
    float c = n2(uv) * 0.55 + n2(uv*2.1) * 0.3 + n2(uv*4.3) * 0.15;
    c = smoothstep(0.55, 0.85, c) * smoothstep(0.02, 0.25, h);
    vec3 cc = mix(vec3(1.0,0.97,0.94), vec3(0.12,0.14,0.2), night) + sunColor*0.15;
    col = mix(col, cc, c*0.7);
  }
  if (night > 0.01 && h > 0.0) {
    float s = hash(floor(d * 380.0));
    col += vec3(step(0.9972, s) * night * smoothstep(0.0, 0.25, h) * 1.4);
  }
  float md = max(dot(d, moonDir), 0.0);
  col += vec3(0.95,0.95,1.0) * smoothstep(0.99965, 0.9998, md) * night * 1.6 + vec3(0.25,0.3,0.5) * pow(md, 60.0) * night * 0.5;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const KEYS = [
  // hour, top, horizon, sunColor, sunI, hemi, fog
  [0, '#060b1c', '#141c36', '#000000', 0, 0.42, '#0e1528'],
  [4.8, '#08102a', '#1c2442', '#000000', 0, 0.44, '#161d34'],
  [5.8, '#2a3b66', '#d88a62', '#ff9a50', 0.6, 0.35, '#8a7080'],
  [7, '#3f73c0', '#e8c8a8', '#ffd9a8', 2.2, 0.75, '#c6c6c8'],
  [9, '#2e6ad0', '#a9cbea', '#fff4e0', 3.0, 0.95, '#b9d0e6'],
  [16, '#2e6ad0', '#b4d0ea', '#fff0d8', 3.0, 0.95, '#bcd2e6'],
  [17.8, '#3d5f9e', '#f0b07a', '#ffb070', 2.0, 0.7, '#d0a890'],
  [18.8, '#26315e', '#e0704a', '#ff7040', 0.6, 0.4, '#7a5060'],
  [19.8, '#0d1430', '#2c2646', '#000000', 0, 0.45, '#1c1c34'],
  [24, '#060b1c', '#141c36', '#000000', 0, 0.42, '#0e1528'],
];
const ca = new THREE.Color(), cb = new THREE.Color();
function mixHex(a, b, t, out) {
  ca.set(a);
  cb.set(b);
  return out.copy(ca).lerp(cb, t);
}

export class Sky {
  constructor() {
    this.uniforms = {
      top: { value: new THREE.Color() },
      horizon: { value: new THREE.Color() },
      bottom: { value: new THREE.Color('#3a3a3a') },
      sunDir: { value: new THREE.Vector3(0, 1, 0) },
      moonDir: { value: new THREE.Vector3(0, 1, 0) },
      sunColor: { value: new THREE.Color() },
      night: { value: 0 },
      cloudT: { value: 0 },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: vert,
      fragmentShader: frag,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -100;
    this.state = {
      sunDir: new THREE.Vector3(),
      sunColor: new THREE.Color(),
      fog: new THREE.Color(),
      sunI: 0,
      hemi: 0,
      night: 0,
    };
  }
  /** hour in [0,24). Updates uniforms and returns lighting state. */
  update(hour, dt) {
    let i = 0;
    while (i < KEYS.length - 2 && hour >= KEYS[i + 1][0]) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    const t = clamp((hour - a[0]) / (b[0] - a[0]), 0, 1);
    const u = this.uniforms;
    mixHex(a[1], b[1], t, u.top.value);
    mixHex(a[2], b[2], t, u.horizon.value);
    mixHex(a[3], b[3], t, u.sunColor.value);
    const s = this.state;
    s.sunI = a[4] + (b[4] - a[4]) * t;
    s.hemi = a[5] + (b[5] - a[5]) * t;
    mixHex(a[6], b[6], t, s.fog);
    const ang = ((hour - 6) / 12) * Math.PI;
    s.sunDir.set(Math.cos(ang) * 0.8, Math.sin(ang), -0.42).normalize();
    u.sunDir.value.copy(s.sunDir);
    u.moonDir.value.set(-s.sunDir.x, Math.max(0.25, -s.sunDir.y), 0.3).normalize();
    s.night = 1 - smoothstep(-0.12, 0.12, Math.sin(ang));
    u.night.value = s.night;
    u.bottom.value.copy(s.fog).multiplyScalar(0.6);
    s.sunColor.copy(u.sunColor.value);
    u.cloudT.value += dt * 0.004;
    return s;
  }
}
