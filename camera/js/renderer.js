// Draws the camera frame into the output canvas with the zoom crop applied.
// WebGL path: Catmull-Rom (bicubic) upscaling + halo-free sharpening on the GPU,
// and optional blending with the previous frame (used by slow motion).
// Falls back to a plain 2D canvas when WebGL is not available.

const VERTEX = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5);
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAGMENT = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D u_cur;
uniform sampler2D u_prev;
uniform vec2 u_texSize;
uniform vec4 u_crop;
uniform float u_mag;
uniform float u_sharp;
uniform float u_blend;
// Beauty mode. Positions are in source-frame pixels.
uniform float u_beauty;   // 1 when a face is tracked
uniform vec4 u_face;      // centre xy, radii zw
uniform float u_faceAng;
uniform vec4 u_eyeL;      // centre xy, half width, half height
uniform vec4 u_eyeR;
uniform vec4 u_irisL;     // centre xy, radius, 0
uniform vec4 u_irisR;
uniform vec4 u_nose;      // bridge top xy, tip zw
uniform float u_noseW;
uniform vec4 u_amt;       // skin smoothing, foundation, nose, eyes (0..1)
uniform vec4 u_irisCol;   // rgb, amount
varying vec2 v_uv;

const vec3 LUMA = vec3(0.299, 0.587, 0.114);

// 9-tap Catmull-Rom using hardware bilinear filtering.
vec3 catmullRom(sampler2D tex, vec2 uv) {
  vec2 pos = uv * u_texSize;
  vec2 p1 = floor(pos - 0.5) + 0.5;
  vec2 f = pos - p1;
  vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f));
  vec2 w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
  vec2 w2 = f * (0.5 + f * (2.0 - 1.5 * f));
  vec2 w3 = f * f * (-0.5 + 0.5 * f);
  vec2 w12 = w1 + w2;
  vec2 p0 = (p1 - 1.0) / u_texSize;
  vec2 p3 = (p1 + 2.0) / u_texSize;
  vec2 p12 = (p1 + w2 / w12) / u_texSize;
  vec3 c = vec3(0.0);
  c += texture2D(tex, vec2(p0.x, p0.y)).rgb * w0.x * w0.y;
  c += texture2D(tex, vec2(p12.x, p0.y)).rgb * w12.x * w0.y;
  c += texture2D(tex, vec2(p3.x, p0.y)).rgb * w3.x * w0.y;
  c += texture2D(tex, vec2(p0.x, p12.y)).rgb * w0.x * w12.y;
  c += texture2D(tex, vec2(p12.x, p12.y)).rgb * w12.x * w12.y;
  c += texture2D(tex, vec2(p3.x, p12.y)).rgb * w3.x * w12.y;
  c += texture2D(tex, vec2(p0.x, p3.y)).rgb * w0.x * w3.y;
  c += texture2D(tex, vec2(p12.x, p3.y)).rgb * w12.x * w3.y;
  c += texture2D(tex, vec2(p3.x, p3.y)).rgb * w3.x * w3.y;
  return c;
}

vec3 sampleSource(sampler2D tex, vec2 uv) {
  if (u_mag > 1.05) return catmullRom(tex, uv);
  return texture2D(tex, uv).rgb;
}

vec2 eyeWarp(vec2 p, vec4 e) {
  vec2 d = p - e.xy;
  float r = e.z * 1.7;
  float l = length(d);
  if (l >= r) return p;
  float t = l / r;
  return e.xy + d * (1.0 - u_amt.w * 0.16 * (1.0 - t * t));
}

// Bigger eyes and a slimmer nose: move where the output pixel samples the camera frame.
vec2 beautyWarp(vec2 uv) {
  vec2 p = uv * u_texSize;
  p = eyeWarp(p, u_eyeL);
  p = eyeWarp(p, u_eyeR);
  vec2 a = u_nose.xy;
  vec2 ax = u_nose.zw - a;
  float len = max(length(ax), 1.0);
  vec2 dir = ax / len;
  vec2 nrm = vec2(-dir.y, dir.x);
  vec2 q = p - a;
  float along = dot(q, dir) / len;
  float across = dot(q, nrm);
  float fall = smoothstep(-0.15, 0.3, along) * (1.0 - smoothstep(1.05, 1.35, along))
             * (1.0 - smoothstep(u_noseW * 1.3, u_noseW * 2.4, abs(across)));
  p = a + dir * dot(q, dir) + nrm * across * (1.0 + u_amt.z * 0.24 * fall);
  return p / u_texSize;
}

float ellipseMask(vec2 p, vec2 c, vec2 r, float ang, float soft) {
  vec2 d = p - c;
  float cs = cos(ang);
  float sn = sin(ang);
  vec2 q = vec2(cs * d.x + sn * d.y, -sn * d.x + cs * d.y) / r;
  return 1.0 - smoothstep(1.0 - soft, 1.0, length(q));
}

float skinMask(vec3 c) {
  float y = dot(c, LUMA);
  float cb = (c.b - y) * 0.564;
  float cr = (c.r - y) * 0.713;
  return smoothstep(-0.24, -0.17, cb) * (1.0 - smoothstep(0.01, 0.06, cb))
       * smoothstep(-0.01, 0.03, cr) * (1.0 - smoothstep(0.2, 0.27, cr))
       * smoothstep(0.08, 0.2, y);
}

// Edge-preserving blur (24 taps on two rings): smooths skin, keeps eyes, brows and lips sharp.
vec3 smoothSkin(vec2 uv, vec3 c, float radius) {
  vec2 st = vec2(radius) / u_texSize;
  vec3 acc = c;
  float wsum = 1.0;
  for (int i = 0; i < 12; i++) {
    float ang = float(i) * 0.5236;
    vec2 o = vec2(cos(ang), sin(ang)) * st;
    vec3 s1 = texture2D(u_cur, uv + o).rgb;
    vec3 s2 = texture2D(u_cur, uv + o * 2.3).rgb;
    vec3 d1 = s1 - c;
    vec3 d2 = s2 - c;
    float w1 = exp(-dot(d1, d1) * 70.0);
    float w2 = exp(-dot(d2, d2) * 70.0) * 0.8;
    acc += s1 * w1 + s2 * w2;
    wsum += w1 + w2;
  }
  return acc / wsum;
}

vec3 applyIris(vec3 c, vec2 p, vec4 iris, vec4 eye) {
  float d = length(p - iris.xy) / max(iris.z, 1.0);
  float open = smoothstep(0.12, 0.22, eye.w / max(eye.z, 1.0));
  float inEye = ellipseMask(p, eye.xy, vec2(eye.z * 0.95, eye.w * 1.05), u_faceAng, 0.35);
  float ring = (1.0 - smoothstep(0.8, 1.0, d)) * smoothstep(0.3, 0.45, d);
  float y = dot(c, LUMA);
  float m = ring * inEye * open * (1.0 - smoothstep(0.55, 0.75, y)) * u_irisCol.a;
  vec3 tinted = u_irisCol.rgb * clamp(y * 2.2 + 0.18, 0.0, 1.1);
  return mix(c, tinted, m * 0.85);
}

vec3 beauty(vec2 uv, vec2 outUv, vec3 c) {
  vec2 p = uv * u_texSize;
  float face = ellipseMask(p, u_face.xy, u_face.zw, u_faceAng, 0.18);
  if (face < 0.003) return c;
  float eyes = max(ellipseMask(p, u_eyeL.xy, vec2(u_eyeL.z * 1.25, u_eyeL.w * 2.2), u_faceAng, 0.4),
                   ellipseMask(p, u_eyeR.xy, vec2(u_eyeR.z * 1.25, u_eyeR.w * 2.2), u_faceAng, 0.4));
  float skin = skinMask(c) * face * (1.0 - eyes);
  if (skin > 0.01 && u_amt.x > 0.0) {
    vec3 sm = smoothSkin(uv, c, u_face.z * 0.022);
    c = mix(c, sm, skin * u_amt.x * 0.9);
  }
  if (u_amt.y > 0.0) {
    // Foundation: even out redness, lift and lighten the skin tone.
    float y = dot(c, LUMA);
    vec3 even = mix(c, vec3(y) * vec3(1.07, 0.99, 0.93), 0.14);
    vec3 lifted = 1.0 - (1.0 - even) * (1.0 - 0.28 * u_amt.y);
    c = mix(c, lifted, skin * u_amt.y);
  }
  if (u_amt.z > 0.0) {
    // Nose contour: a highlight down the bridge, soft shadows along both sides.
    vec2 po = outUv * u_texSize;
    vec2 ax = u_nose.zw - u_nose.xy;
    float len = max(length(ax), 1.0);
    vec2 dir = ax / len;
    vec2 q = po - u_nose.xy;
    float along = dot(q, dir) / len;
    float u = dot(q, vec2(-dir.y, dir.x)) / max(u_noseW, 1.0);
    float span = smoothstep(0.0, 0.25, along) * (1.0 - smoothstep(0.85, 1.05, along));
    float hl = exp(-u * u * 9.0) * span;
    float sh = exp(-(abs(u) - 1.0) * (abs(u) - 1.0) * 7.0) * span * (1.0 - smoothstep(0.75, 1.0, along));
    c = c * (1.0 - 0.16 * u_amt.z * sh) + 0.07 * u_amt.z * hl;
  }
  if (u_amt.w > 0.0) {
    // Brighter whites of the eyes.
    float y = dot(c, LUMA);
    float white = smoothstep(0.45, 0.7, y) * (1.0 - smoothstep(0.08, 0.2, length(c - vec3(y))));
    c += white * eyes * u_amt.w * 0.08;
  }
  if (u_irisCol.a > 0.0) {
    c = applyIris(c, p, u_irisL, u_eyeL);
    c = applyIris(c, p, u_irisR, u_eyeR);
  }
  return c;
}

void main() {
  vec2 uv0 = u_crop.xy + v_uv * u_crop.zw;
  vec2 uv = u_beauty > 0.5 ? beautyWarp(uv0) : uv0;
  vec3 c = sampleSource(u_cur, uv);
  if (u_sharp > 0.001) {
    vec2 px = 1.0 / u_texSize;
    vec3 n = texture2D(u_cur, uv + vec2(0.0, -px.y)).rgb;
    vec3 s = texture2D(u_cur, uv + vec2(0.0, px.y)).rgb;
    vec3 e = texture2D(u_cur, uv + vec2(px.x, 0.0)).rgb;
    vec3 w = texture2D(u_cur, uv + vec2(-px.x, 0.0)).rgb;
    vec3 blur = (n + s + e + w) * 0.25;
    vec3 lo = min(min(min(n, s), min(e, w)), c);
    vec3 hi = max(max(max(n, s), max(e, w)), c);
    // Unsharp mask clamped to the local range: steeper edges without halos.
    c = clamp(c + (c - blur) * u_sharp, lo - 0.01, hi + 0.01);
  }
  if (u_blend > 0.001) c = mix(c, sampleSource(u_prev, uv), u_blend);
  if (u_beauty > 0.5) c = beauty(uv, uv0, c);
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.kind = 'none';
    this.ready = false;
    this.texSize = [[0, 0], [0, 0]];
    this.cur = 0;
    this.frames = 0;
    this.source = null;
    this.sourceW = 0;
    this.sourceH = 0;
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.ready = false; });
    canvas.addEventListener('webglcontextrestored', () => { this.initGL(); });
    if (!this.initGL()) this.init2D();
  }

  initGL() {
    const opts = { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, premultipliedAlpha: false, powerPreference: 'high-performance' };
    let gl = null;
    try { gl = this.canvas.getContext('webgl', opts) || this.canvas.getContext('experimental-webgl', opts); } catch { gl = null; }
    if (!gl) return false;
    try {
      const prog = gl.createProgram();
      for (const [type, src] of [[gl.VERTEX_SHADER, VERTEX], [gl.FRAGMENT_SHADER, FRAGMENT]]) {
        const sh = gl.createShader(type);
        gl.shaderSource(sh, src);
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) || 'shader');
        gl.attachShader(prog, sh);
      }
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || 'link');
      gl.useProgram(prog);

      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'a_pos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      this.tex = [0, 1].map(() => {
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
        return t;
      });
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

      this.u = {};
      for (const name of ['u_cur', 'u_prev', 'u_texSize', 'u_crop', 'u_mag', 'u_sharp', 'u_blend', 'u_beauty', 'u_face', 'u_faceAng',
        'u_eyeL', 'u_eyeR', 'u_irisL', 'u_irisR', 'u_nose', 'u_noseW', 'u_amt', 'u_irisCol']) this.u[name] = gl.getUniformLocation(prog, name);
      gl.uniform1i(this.u.u_cur, 0);
      gl.uniform1i(this.u.u_prev, 1);
      this.gl = gl;
      this.kind = 'webgl';
      this.ready = true;
      this.texSize = [[0, 0], [0, 0]];
      this.frames = 0;
      return true;
    } catch (err) {
      console.warn('WebGL renderer unavailable', err);
      this.gl = null;
      return false;
    }
  }

  init2D() {
    // A canvas that already has a WebGL context cannot switch, so use a replacement canvas.
    let ctx = null;
    try { ctx = this.canvas.getContext('2d', { alpha: false }); } catch { ctx = null; }
    if (!ctx) {
      const fresh = this.canvas.cloneNode(false);
      this.canvas.replaceWith(fresh);
      this.canvas = fresh;
      ctx = fresh.getContext('2d', { alpha: false });
    }
    this.ctx = ctx;
    this.kind = '2d';
    this.ready = !!ctx;
  }

  setSize(w, h) {
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  // Upload a new camera frame. The previously uploaded frame stays available for blending.
  upload(source, sw, sh) {
    this.source = source;
    this.sourceW = sw;
    this.sourceH = sh;
    if (this.kind !== 'webgl' || !this.ready) return this.kind === '2d';
    const gl = this.gl;
    const next = 1 - this.cur;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex[next]);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    } catch (err) {
      return false;
    }
    this.texSize[next] = [sw, sh];
    this.cur = next;
    this.frames++;
    return true;
  }

  // Beauty settings for the next draws: null turns it off. `face` is in source-frame pixels.
  setBeauty(face, amounts, irisColor) {
    this.beautyFace = face && face.vw === this.sourceW && face.vh === this.sourceH ? face : null;
    this.beautyAmt = amounts;
    this.irisColor = irisColor;
  }

  applyBeautyUniforms(gl) {
    const f = this.beautyFace;
    gl.uniform1f(this.u.u_beauty, f ? 1 : 0);
    if (!f) return;
    const a = this.beautyAmt;
    gl.uniform4f(this.u.u_face, f.cx, f.cy, f.rx, f.ry);
    gl.uniform1f(this.u.u_faceAng, f.angle);
    gl.uniform4f(this.u.u_eyeL, f.eyeL.x, f.eyeL.y, f.eyeL.halfW, f.eyeL.halfH);
    gl.uniform4f(this.u.u_eyeR, f.eyeR.x, f.eyeR.y, f.eyeR.halfW, f.eyeR.halfH);
    gl.uniform4f(this.u.u_irisL, f.irisL.x, f.irisL.y, f.irisL.r, 0);
    gl.uniform4f(this.u.u_irisR, f.irisR.x, f.irisR.y, f.irisR.r, 0);
    gl.uniform4f(this.u.u_nose, f.nose.x0, f.nose.y0, f.nose.x1, f.nose.y1);
    gl.uniform1f(this.u.u_noseW, f.nose.w);
    gl.uniform4f(this.u.u_amt, a.smooth, a.foundation, a.nose, a.eyes);
    const ic = this.irisColor;
    gl.uniform4f(this.u.u_irisCol, ic ? ic[0] : 0, ic ? ic[1] : 0, ic ? ic[2] : 0, ic ? 0.75 : 0);
  }

  // crop: normalized {x, y, w, h} inside the source frame.
  draw({ crop, sharp = 0, blend = 0 }) {
    const W = this.canvas.width;
    const H = this.canvas.height;
    const mag = W / Math.max(1, crop.w * this.sourceW);
    if (this.kind === 'webgl') {
      if (!this.ready) return;
      const gl = this.gl;
      const prev = 1 - this.cur;
      const [pw, ph] = this.texSize[prev];
      const canBlend = blend > 0 && this.frames > 1 && pw === this.sourceW && ph === this.sourceH;
      gl.viewport(0, 0, W, H);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.tex[this.cur]);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.tex[canBlend ? prev : this.cur]);
      gl.uniform2f(this.u.u_texSize, this.sourceW, this.sourceH);
      gl.uniform4f(this.u.u_crop, crop.x, crop.y, crop.w, crop.h);
      gl.uniform1f(this.u.u_mag, mag);
      gl.uniform1f(this.u.u_sharp, sharp);
      gl.uniform1f(this.u.u_blend, canBlend ? blend : 0);
      this.applyBeautyUniforms(gl);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    } else if (this.kind === '2d' && this.source) {
      const ctx = this.ctx;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(this.source,
        crop.x * this.sourceW, crop.y * this.sourceH, crop.w * this.sourceW, crop.h * this.sourceH,
        0, 0, W, H);
    }
  }
}
