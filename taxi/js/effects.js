import * as THREE from 'three';

const vert = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
uniform float uScale;
varying float vA;
void main(){
  vA = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const frag = /* glsl */ `
uniform vec3 uColor;
varying float vA;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.05, length(c)) * vA;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor, a);
}`;

export class Particles {
  constructor(scene, { max = 300, color = 0x888888, additive = false } = {}) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.parts = [];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.uniforms = { uColor: { value: new THREE.Color(color) }, uScale: { value: 500 } };
    this.mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    this.geo = g;
    scene.add(this.points);
  }
  emit(x, y, z, vx, vy, vz, life, size, grow = 1, alpha = 0.6, drag = 1) {
    if (this.parts.length >= this.max) this.parts.shift();
    this.parts.push({ x, y, z, vx, vy, vz, life, t: 0, size, grow, alpha, drag });
  }
  update(dt, gravity = 0) {
    const P = this.parts;
    let n = 0;
    for (let i = 0; i < P.length; i++) {
      const p = P[i];
      p.t += dt;
      if (p.t >= p.life) continue;
      p.vy -= gravity * dt;
      const d = Math.exp(-p.drag * dt);
      p.vx *= d; p.vy *= d; p.vz *= d;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const k = p.t / p.life;
      this.pos[n * 3] = p.x; this.pos[n * 3 + 1] = p.y; this.pos[n * 3 + 2] = p.z;
      this.size[n] = p.size * (1 + k * p.grow);
      this.alpha[n] = p.alpha * (1 - k) * Math.min(1, p.t * 8);
      P[n] = p;
      n++;
    }
    P.length = n;
    this.geo.setDrawRange(0, n);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
  }
  setScale(h, fov) {
    this.uniforms.uScale.value = h / (2 * Math.tan((fov * Math.PI) / 360));
  }
}
