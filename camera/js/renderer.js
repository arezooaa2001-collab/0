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
varying vec2 v_uv;

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

void main() {
  vec2 uv = u_crop.xy + v_uv * u_crop.zw;
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
    const opts = { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true, premultipliedAlpha: false, powerPreference: 'high-performance' };
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
      for (const name of ['u_cur', 'u_prev', 'u_texSize', 'u_crop', 'u_mag', 'u_sharp', 'u_blend']) this.u[name] = gl.getUniformLocation(prog, name);
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
