/* Ladino — built-in WebGL effects. Each effect body defines `vec4 effect(vec2 uv)`.
   Available in every effect: u_tex, u_res, u_time, u_amt (0..1 intensity), tex(uv), luma(), hash(), noise(), rgb2hsv(), hsv2rgb(), PI */
(function () {
  const L = (window.L = window.L || {});

  L.FX_PRELUDE = `precision highp float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_res;
uniform float u_time;
uniform float u_amt;
#define PI 3.14159265359
vec4 tex(vec2 uv){ return texture2D(u_tex, clamp(uv, 0.0, 1.0)); }
float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), f.x), mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), f.x), f.y); }
vec3 rgb2hsv(vec3 c){ vec4 K = vec4(0.0,-1.0/3.0,2.0/3.0,-1.0); vec4 p = mix(vec4(c.bg,K.wz), vec4(c.gb,K.xy), step(c.b,c.g));
  vec4 q = mix(vec4(p.xyw,c.r), vec4(c.r,p.yzx), step(p.x,c.r)); float d = q.x - min(q.w,q.y); float e = 1.0e-10;
  return vec3(abs(q.z + (q.w-q.y)/(6.0*d+e)), d/(q.x+e), q.x); }
vec3 hsv2rgb(vec3 c){ vec4 K = vec4(1.0,2.0/3.0,1.0/3.0,3.0); vec3 p = abs(fract(c.xxx + K.xyz)*6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p-K.xxx,0.0,1.0), c.y); }
vec3 sobel(vec2 uv){ vec2 px = 1.0/u_res;
  float tl=luma(tex(uv+px*vec2(-1.,1.)).rgb), t=luma(tex(uv+px*vec2(0.,1.)).rgb), tr=luma(tex(uv+px*vec2(1.,1.)).rgb);
  float l=luma(tex(uv+px*vec2(-1.,0.)).rgb), r=luma(tex(uv+px*vec2(1.,0.)).rgb);
  float bl=luma(tex(uv+px*vec2(-1.,-1.)).rgb), b=luma(tex(uv+px*vec2(0.,-1.)).rgb), br=luma(tex(uv+px*vec2(1.,-1.)).rgb);
  float gx = -tl-2.0*l-bl+tr+2.0*r+br; float gy = -tl-2.0*t-tr+bl+2.0*b+br; return vec3(sqrt(gx*gx+gy*gy)); }
`;
  L.FX_MAIN = `
void main(){ vec4 c = effect(v_uv); gl_FragColor = vec4(clamp(c.rgb, 0.0, 1.0), 1.0); }`;

  // helper to write colour-grade effects quickly
  const grade = (expr) => `vec4 effect(vec2 uv){ vec4 o = tex(uv); vec3 c = o.rgb; float l = luma(c); vec3 g = ${expr}; return vec4(mix(c, g, u_amt), 1.0); }`;

  const E = [
    // ---------- رنگ ----------
    { id: 'bw', name: 'سیاه و سفید', cat: 'رنگ', glsl: grade('vec3(l)') },
    { id: 'sepia', name: 'سپیا', cat: 'رنگ', glsl: grade('vec3(dot(c,vec3(.393,.769,.189)), dot(c,vec3(.349,.686,.168)), dot(c,vec3(.272,.534,.131)))') },
    { id: 'warm', name: 'گرم', cat: 'رنگ', glsl: grade('c*vec3(1.12,1.02,.82)+vec3(.04,.02,0.)') },
    { id: 'cool', name: 'سرد', cat: 'رنگ', glsl: grade('c*vec3(.86,1.0,1.18)+vec3(0.,.01,.04)') },
    { id: 'vivid', name: 'زنده', cat: 'رنگ', glsl: `vec4 effect(vec2 uv){ vec3 c = tex(uv).rgb; vec3 h = rgb2hsv(c); h.y = clamp(h.y*1.7,0.,1.); vec3 g = hsv2rgb(h); g = (g-.5)*1.12+.5; return vec4(mix(c,g,u_amt),1.); }` },
    { id: 'golden', name: 'ساعت طلایی', cat: 'رنگ', glsl: grade('mix(c*vec3(1.15,.98,.75), vec3(1.,.78,.4), .18*(1.-l))+vec3(.03,.01,0.)') },
    { id: 'duotone', name: 'دوتون', cat: 'رنگ', glsl: grade('mix(vec3(.12,.02,.38), vec3(1.,.55,.25), smoothstep(.05,.95,l))') },
    { id: 'tritone', name: 'سه‌تون نئونی', cat: 'رنگ', glsl: grade('l<.5 ? mix(vec3(.05,0.,.2), vec3(1.,.1,.6), l*2.) : mix(vec3(1.,.1,.6), vec3(.4,1.,1.), (l-.5)*2.)') },
    { id: 'invert', name: 'نگاتیو', cat: 'رنگ', glsl: grade('1.0-c') },
    { id: 'hue', name: 'رنگین‌کمانی', cat: 'رنگ', glsl: `vec4 effect(vec2 uv){ vec3 c = tex(uv).rgb; vec3 h = rgb2hsv(c); h.x = fract(h.x + u_time*.15 + uv.x*.3); h.y = max(h.y,.55); return vec4(mix(c,hsv2rgb(h),u_amt),1.); }` },
    { id: 'colorpop', name: 'رنگ انتخابی قرمز', cat: 'رنگ', glsl: `vec4 effect(vec2 uv){ vec3 c = tex(uv).rgb; vec3 h = rgb2hsv(c); float d = min(abs(h.x), abs(1.-h.x)); float k = smoothstep(.09,.03,d)*smoothstep(.15,.35,h.y); vec3 g = mix(vec3(luma(c)), c*1.1, k); return vec4(mix(c,g,u_amt),1.); }` },
    { id: 'infrared', name: 'مادون قرمز', cat: 'رنگ', glsl: grade('vec3(clamp(c.g*1.3+.1,0.,1.), c.r*.55, c.b*.9+.1)') },
    { id: 'thermal', name: 'حرارتی', cat: 'رنگ', glsl: grade('l<.33 ? mix(vec3(0.,0.,.25), vec3(.6,0.,.8), l*3.) : (l<.66 ? mix(vec3(.6,0.,.8), vec3(1.,.4,0.), (l-.33)*3.) : mix(vec3(1.,.4,0.), vec3(1.,1.,.6), (l-.66)*3.))') },
    // ---------- سینمایی ----------
    { id: 'cinema', name: 'سینمایی', cat: 'سینمایی', glsl: grade('(mix(c*vec3(.82,1.,1.12), c*vec3(1.18,1.,.82), smoothstep(.2,.8,l))-.5)*1.1+.5') },
    { id: 'letterbox', name: 'نوار سینمایی', cat: 'سینمایی', glsl: `vec4 effect(vec2 uv){ vec4 o = tex(uv); float b = .5 - .13*u_amt; return abs(uv.y-.5) > b ? vec4(0.,0.,0.,1.) : o; }` },
    { id: 'noir', name: 'نوآر', cat: 'سینمایی', glsl: `vec4 effect(vec2 uv){ vec3 c = tex(uv).rgb; float l = smoothstep(.15,.85,luma(c)); float v = 1.-.55*length(uv-.5)*1.4; vec3 g = vec3(l*v); return vec4(mix(c,g,u_amt),1.); }` },
    { id: 'dramatic', name: 'دراماتیک', cat: 'سینمایی', glsl: `vec4 effect(vec2 uv){ vec3 c = tex(uv).rgb; float l = luma(c); vec3 g = mix(vec3(l), c, .45); g = (g-.5)*1.45+.5; g *= 1. - .6*pow(length(uv-.5)*1.3, 2.); return vec4(mix(c,g,u_amt),1.); }` },
    { id: 'vintage', name: 'وینتیج', cat: 'سینمایی', glsl: `vec4 effect(vec2 uv){ vec3 c = tex(uv).rgb; vec3 s = vec3(dot(c,vec3(.393,.769,.189)), dot(c,vec3(.349,.686,.168)), dot(c,vec3(.272,.534,.131))); vec3 g = mix(c, s, .6)*.9+.08; g *= 1.-.5*pow(length(uv-.5)*1.25,2.); g += (hash(uv*u_res+u_time)-.5)*.08; return vec4(mix(c,g,u_amt),1.); }` },
    { id: 'vignette', name: 'سایه دور', cat: 'سینمایی', glsl: `vec4 effect(vec2 uv){ vec3 c = tex(uv).rgb; float v = smoothstep(.85, .25, length((uv-.5)*vec2(1.,u_res.y/u_res.x)*1.6)); return vec4(c*mix(1., v, u_amt*.9),1.); }` },
    { id: 'grain', name: 'دانه فیلم', cat: 'سینمایی', glsl: `vec4 effect(vec2 uv){ vec3 c = tex(uv).rgb; float n = hash(floor(uv*u_res)+fract(u_time*7.)*91.)-.5; return vec4(c + n*.28*u_amt,1.); }` },
    { id: 'lightleak', name: 'نشت نور', cat: 'سینمایی', glsl: `vec4 effect(vec2 uv){ vec3 c = tex(uv).rgb; float t = u_time*.35; vec2 p1 = vec2(.15+.25*sin(t), .8+.1*cos(t*1.3)); vec2 p2 = vec2(.9+.1*cos(t*.7), .2+.3*sin(t*.9)); vec3 leak = vec3(1.,.45,.1)*smoothstep(.75,0.,distance(uv,p1)) + vec3(1.,.2,.5)*smoothstep(.7,0.,distance(uv,p2)); vec3 g = 1.-(1.-c)*(1.-leak*.85); return vec4(mix(c,g,u_amt),1.); }` },
    { id: 'dreamy', name: 'رویایی', cat: 'سینمایی', glsl: `vec4 effect(vec2 uv){ vec3 c = tex(uv).rgb; vec2 px = 3./u_res; vec3 b = vec3(0.); for(int i=-3;i<=3;i++){ for(int j=-3;j<=3;j++){ b += tex(uv+vec2(float(i),float(j))*px).rgb; } } b /= 49.; vec3 g = 1.-(1.-c)*(1.-b*.8); g = mix(g, g*vec3(1.05,.97,1.08), .5); return vec4(mix(c,g,u_amt),1.); }` },
    // ---------- رترو ----------
    { id: 'vhs', name: 'VHS قدیمی', cat: 'رترو', glsl: `vec4 effect(vec2 uv){ float j = (noise(vec2(uv.y*40., u_time*8.))-.5)*.012*u_amt; float band = step(.985, fract(uv.y*1.5 - u_time*.3))*.03*u_amt; vec2 q = uv + vec2(j+band, 0.); float r = tex(q+vec2(.004*u_amt,0.)).r, g = tex(q).g, b = tex(q-vec2(.004*u_amt,0.)).b; vec3 c = vec3(r,g,b); c *= .92+.08*sin(uv.y*u_res.y*1.5); c += (hash(uv*u_res+u_time)-.5)*.1*u_amt; c = mix(tex(uv).rgb, c*vec3(1.02,.98,1.05), u_amt); return vec4(c,1.); }` },
    { id: 'scanlines', name: 'اسکن‌لاین', cat: 'رترو', glsl: `vec4 effect(vec2 uv){ vec3 c = tex(uv).rgb; float s = .5+.5*sin(uv.y*u_res.y*1.6); return vec4(c*(1.-u_amt*.45*s),1.); }` },
    { id: 'pixel', name: 'پیکسلی', cat: 'رترو', glsl: `vec4 effect(vec2 uv){ float s = 2. + u_amt*28.; vec2 cell = s/u_res; vec2 q = (floor(uv/cell)+.5)*cell; return vec4(tex(q).rgb,1.); }` },
    { id: 'gameboy', name: 'گیم‌بوی', cat: 'رترو', glsl: `vec4 effect(vec2 uv){ vec2 cell = 3./u_res; vec2 q = (floor(uv/cell)+.5)*cell; vec3 o = tex(uv).rgb; float l = luma(tex(q).rgb); vec3 g = l<.25? vec3(.06,.22,.06) : l<.5? vec3(.19,.38,.19) : l<.75? vec3(.55,.67,.06) : vec3(.61,.74,.06); return vec4(mix(o,g,u_amt),1.); }` },
    { id: 'posterize', name: 'پوستری', cat: 'رترو', glsl: grade('floor(c*mix(12.,3.,u_amt)+.5)/mix(12.,3.,u_amt)') },
    { id: 'popart', name: 'پاپ آرت', cat: 'رترو', glsl: `vec4 effect(vec2 uv){ vec2 q = fract(uv*2.); vec2 id = floor(uv*2.); vec3 c = tex(q).rgb; float l = luma(c); vec3 a = id.x<1.? (id.y<1.? vec3(1.,.9,0.):vec3(1.,.1,.5)) : (id.y<1.? vec3(0.,.8,1.):vec3(.5,1.,.2)); vec3 g = mix(a*.25, a, step(.45,l)); return vec4(mix(tex(uv).rgb, g, u_amt),1.); }` },
    { id: 'halftone', name: 'هاف‌تون', cat: 'رترو', glsl: `vec4 effect(vec2 uv){ float s = 7.; vec2 p = uv*u_res; vec2 cell = floor(p/s)*s + s*.5; vec3 c = tex(cell/u_res).rgb; float l = luma(c); float r = (1.-l)*s*.62; float d = length(p-cell); vec3 g = mix(vec3(1.,.98,.92), c*.5, smoothstep(r+.8,r-.8,d)); return vec4(mix(tex(uv).rgb, g, u_amt),1.); }` },
    // ---------- دیجیتال ----------
    { id: 'glitch', name: 'گلیچ', cat: 'دیجیتال', glsl: `vec4 effect(vec2 uv){ float t = floor(u_time*12.); float blk = step(.72, hash(vec2(floor(uv.y*18.), t))); float sh = (hash(vec2(t, floor(uv.y*18.)))-.5)*.12*u_amt*blk; vec2 q = uv + vec2(sh, 0.); float o = .012*u_amt*(.4+blk); vec3 c = vec3(tex(q+vec2(o,0.)).r, tex(q).g, tex(q-vec2(o,0.)).b); c = mix(c, 1.-c, step(.97, hash(vec2(t*1.7, floor(uv.y*6.))))*u_amt*.7); return vec4(c,1.); }` },
    { id: 'rgbsplit', name: 'جدایی رنگ', cat: 'دیجیتال', glsl: `vec4 effect(vec2 uv){ vec2 d = (uv-.5)*.03*u_amt + vec2(.006*u_amt*sin(u_time*2.),0.); return vec4(tex(uv+d).r, tex(uv).g, tex(uv-d).b, 1.); }` },
    { id: 'matrix', name: 'ماتریکس', cat: 'دیجیتال', glsl: `vec4 effect(vec2 uv){ vec3 o = tex(uv).rgb; float l = luma(o); float col = floor(uv.x*70.); float sp = .25 + hash(vec2(col,1.))*.6; float y = fract(uv.y + u_time*sp + hash(vec2(col,2.))); float trail = smoothstep(.0,.35,y)*step(y,.35+.0) ; float glyph = step(.5, hash(floor(vec2(uv.x*70., uv.y*45.)) + floor(u_time*6.))); vec3 g = vec3(0.,l*.9,l*.25) + vec3(.2,1.,.4)*glyph*(1.-y)*.55; return vec4(mix(o,g,u_amt),1.); }` },
    { id: 'nightvision', name: 'دید در شب', cat: 'دیجیتال', glsl: `vec4 effect(vec2 uv){ vec3 o = tex(uv).rgb; float l = luma(o)*1.6; l += (hash(uv*u_res+u_time*13.)-.5)*.25; l *= .85+.15*sin(uv.y*u_res.y*1.2); float v = smoothstep(.75,.3,length(uv-.5)); vec3 g = vec3(.1,1.,.25)*l*v; return vec4(mix(o,g,u_amt),1.); }` },
    { id: 'cyber', name: 'سایبرپانک', cat: 'دیجیتال', glsl: `vec4 effect(vec2 uv){ vec3 c = tex(uv).rgb; float l = luma(c); vec3 g = mix(vec3(.05,.0,.18), mix(vec3(1.,.0,.6), vec3(0.,1.,1.), smoothstep(.35,.85,l)), smoothstep(.0,.6,l)); g += vec3(.0,.6,1.)*sobel(uv)*.6; g *= .9+.1*sin(uv.y*u_res.y*.9); return vec4(mix(c,g,u_amt),1.); }` },
    { id: 'edgeglow', name: 'نئون لبه‌ها', cat: 'دیجیتال', glsl: `vec4 effect(vec2 uv){ vec3 o = tex(uv).rgb; float e = sobel(uv).r*2.2; vec3 col = hsv2rgb(vec3(fract(uv.x*.6+uv.y*.4+u_time*.2), .9, 1.)); vec3 g = o*.12 + col*e; return vec4(mix(o,g,u_amt),1.); }` },
    { id: 'hologram', name: 'هولوگرام', cat: 'دیجیتال', glsl: `vec4 effect(vec2 uv){ float j = (hash(vec2(floor(uv.y*120.), floor(u_time*20.)))-.5)*.006*u_amt; vec3 c = tex(uv+vec2(j,0.)).rgb; float l = luma(c); vec3 g = vec3(.2,.85,1.)*(l*1.3) * (.75+.25*sin(uv.y*u_res.y*.8 - u_time*12.)); g += vec3(.2,.6,1.)*sobel(uv)*.8; return vec4(mix(tex(uv).rgb, g, u_amt),1.); }` },
    { id: 'strobe', name: 'فلاش', cat: 'دیجیتال', glsl: `vec4 effect(vec2 uv){ vec3 c = tex(uv).rgb; float f = step(.82, fract(u_time*2.2)); return vec4(mix(c, vec3(1.)-c*.2, f*u_amt*.8),1.); }` },
    // ---------- هنری ----------
    { id: 'sketch', name: 'طراحی مدادی', cat: 'هنری', glsl: `vec4 effect(vec2 uv){ vec3 o = tex(uv).rgb; float e = sobel(uv).r; float g = 1. - smoothstep(.05,.5,e); g *= .92 + .08*hash(floor(uv*u_res*.5)); vec3 paper = vec3(.97,.95,.9)*g; return vec4(mix(o,paper,u_amt),1.); }` },
    { id: 'comic', name: 'کمیک', cat: 'هنری', glsl: `vec4 effect(vec2 uv){ vec3 o = tex(uv).rgb; vec3 h = rgb2hsv(o); h.y = min(1., h.y*1.5); vec3 c = floor(hsv2rgb(h)*4.+.5)/4.; float e = sobel(uv).r; c *= 1.-smoothstep(.25,.45,e); return vec4(mix(o,c,u_amt),1.); }` },
    { id: 'emboss', name: 'برجسته', cat: 'هنری', glsl: `vec4 effect(vec2 uv){ vec3 o = tex(uv).rgb; vec2 px = 1.5/u_res; float e = luma(tex(uv-px).rgb) - luma(tex(uv+px).rgb); vec3 g = vec3(.5 + e*2.5); return vec4(mix(o,g,u_amt),1.); }` },
    { id: 'watercolor', name: 'آبرنگ', cat: 'هنری', glsl: `vec4 effect(vec2 uv){ vec3 o = tex(uv).rgb; vec2 w = vec2(noise(uv*12.+u_time*.1), noise(uv*12.+7.))-.5; vec3 c = tex(uv + w*.012).rgb; c = floor(c*6.+.5)/6.; c = mix(c, vec3(1.), .12) * (.9+.1*noise(uv*80.)); c *= 1.-.35*sobel(uv).r; return vec4(mix(o,c,u_amt),1.); }` },
    { id: 'crystal', name: 'کریستالی', cat: 'هنری', glsl: `vec4 effect(vec2 uv){ vec2 p = uv*vec2(u_res.x/u_res.y,1.)*14.; vec2 i = floor(p); vec2 f = fract(p); float md = 9.; vec2 mc = vec2(0.); for(int y=-1;y<=1;y++){ for(int x=-1;x<=1;x++){ vec2 g = vec2(float(x),float(y)); vec2 o = vec2(hash(i+g), hash(i+g+19.)); vec2 r = g + o - f; float d = dot(r,r); if(d<md){ md=d; mc = i+g+o; } } } vec2 cuv = mc/14./vec2(u_res.x/u_res.y,1.); vec3 c = tex(cuv).rgb*(1.-md*.25); return vec4(mix(tex(uv).rgb, c, u_amt),1.); }` },
    { id: 'blur', name: 'محو', cat: 'هنری', glsl: `vec4 effect(vec2 uv){ vec2 px = (1.+u_amt*5.)/u_res; vec3 b = vec3(0.); float w = 0.; for(int i=-4;i<=4;i++){ for(int j=-4;j<=4;j++){ float k = exp(-float(i*i+j*j)/12.); b += tex(uv+vec2(float(i),float(j))*px).rgb*k; w += k; } } return vec4(b/w,1.); }` },
    { id: 'sharpen', name: 'تیز', cat: 'هنری', glsl: `vec4 effect(vec2 uv){ vec2 px = 1./u_res; vec3 c = tex(uv).rgb; vec3 s = c*5. - tex(uv+vec2(px.x,0.)).rgb - tex(uv-vec2(px.x,0.)).rgb - tex(uv+vec2(0.,px.y)).rgb - tex(uv-vec2(0.,px.y)).rgb; return vec4(mix(c,s,u_amt),1.); }` },
    // ---------- اعوجاج ----------
    { id: 'wave', name: 'موج', cat: 'اعوجاج', glsl: `vec4 effect(vec2 uv){ vec2 q = uv + vec2(sin(uv.y*22.+u_time*3.)*.012, cos(uv.x*18.+u_time*2.5)*.008)*u_amt; return vec4(tex(q).rgb,1.); }` },
    { id: 'ripple', name: 'موج آب', cat: 'اعوجاج', glsl: `vec4 effect(vec2 uv){ vec2 d = uv-.5; float r = length(d); vec2 q = uv + normalize(d+1e-5)*sin(r*45.-u_time*6.)*.012*u_amt*smoothstep(.8,0.,r); return vec4(tex(q).rgb,1.); }` },
    { id: 'underwater', name: 'زیر آب', cat: 'اعوجاج', glsl: `vec4 effect(vec2 uv){ vec2 q = uv + vec2(noise(uv*6.+u_time*.6), noise(uv*6.-u_time*.5))*.025*u_amt - .0125*u_amt; vec3 c = tex(q).rgb; float caus = pow(noise(uv*20.+u_time*.8)*noise(uv*14.-u_time*.6)*2., 3.); vec3 g = c*vec3(.55,.85,1.05) + vec3(.0,.08,.15) + caus*.35; return vec4(mix(tex(uv).rgb, g, u_amt),1.); }` },
    { id: 'swirl', name: 'گرداب', cat: 'اعوجاج', glsl: `vec4 effect(vec2 uv){ vec2 d = uv-.5; float r = length(d); float a = (1.-smoothstep(0.,.55,r))*u_amt*4.*sin(u_time*.6+.6); float s = sin(a), c = cos(a); vec2 q = vec2(c*d.x-s*d.y, s*d.x+c*d.y)+.5; return vec4(tex(q).rgb,1.); }` },
    { id: 'fisheye', name: 'چشم ماهی', cat: 'اعوجاج', glsl: `vec4 effect(vec2 uv){ vec2 d = uv-.5; float r = length(d); vec2 q = .5 + d*(1. - u_amt*.5*(1.-r*r*2.)); vec3 c = tex(q).rgb; return vec4(c*smoothstep(.75,.6,r*(1.+u_amt*.2)),1.); }` },
    { id: 'mirror', name: 'آینه‌ای', cat: 'اعوجاج', glsl: `vec4 effect(vec2 uv){ vec2 q = uv; if(q.x>.5) q.x = 1.-q.x; return vec4(mix(tex(uv).rgb, tex(q).rgb, step(.01,u_amt)),1.); }` },
    { id: 'kaleido', name: 'کلایدوسکوپ', cat: 'اعوجاج', glsl: `vec4 effect(vec2 uv){ vec2 d = (uv-.5)*vec2(u_res.x/u_res.y,1.); float a = atan(d.y,d.x) + u_time*.15; float r = length(d); float seg = PI/3.; a = mod(a, seg*2.); a = abs(a-seg); vec2 q = vec2(cos(a),sin(a))*r/vec2(u_res.x/u_res.y,1.)+.5; return vec4(mix(tex(uv).rgb, tex(q).rgb, u_amt),1.); }` },
    { id: 'tiles', name: 'کاشی چهارتایی', cat: 'اعوجاج', glsl: `vec4 effect(vec2 uv){ float n = 1. + floor(u_amt*3.+.5); vec2 q = fract(uv*n); vec3 c = tex(q).rgb; vec2 e = abs(q-.5); c *= smoothstep(.5,.49,max(e.x,e.y)); return vec4(c,1.); }` },
    { id: 'shake', name: 'لرزش', cat: 'اعوجاج', glsl: `vec4 effect(vec2 uv){ float t = u_time*18.; vec2 o = (vec2(noise(vec2(t,1.)), noise(vec2(1.,t)))-.5)*.035*u_amt; return vec4(tex((uv-.5)*(1.-.04*u_amt)+.5+o).rgb,1.); }` },
    { id: 'pulse', name: 'ضربان زوم', cat: 'اعوجاج', glsl: `vec4 effect(vec2 uv){ float p = pow(.5+.5*sin(u_time*PI*2.), 4.); vec2 q = (uv-.5)*(1.-.08*u_amt*p)+.5; return vec4(tex(q).rgb*(1.+.15*u_amt*p),1.); }` },
    // ---------- طبیعت ----------
    { id: 'snow', name: 'برف', cat: 'طبیعت', glsl: `vec4 effect(vec2 uv){ vec3 c = tex(uv).rgb; vec2 a = vec2(u_res.x/u_res.y,1.); float s = 0.; for(int k=0;k<3;k++){ float fk = float(k); float sc = 18.+fk*14.; vec2 p = uv*a*sc + vec2(sin(u_time*.7+fk)*.8, u_time*(1.4+fk*.5)); vec2 i = floor(p); vec2 f = fract(p)-.5; vec2 o = vec2(hash(i), hash(i+3.))-.5; float d = length(f-o*.6); s += smoothstep(.09-fk*.02, .0, d)*step(.55, hash(i+9.)); } return vec4(c*mix(1.,.92,u_amt) + s*u_amt, 1.); }` },
    { id: 'rain', name: 'باران', cat: 'طبیعت', glsl: `vec4 effect(vec2 uv){ vec3 c = tex(uv).rgb*mix(1.,.8,u_amt); vec2 p = vec2(uv.x*90. + uv.y*8., uv.y*6. + u_time*9.); vec2 i = floor(p); float r = step(.9, hash(vec2(i.x, i.y))); float f = fract(p.y); float d = r * smoothstep(.0,.08,f) * smoothstep(.45,.08,f) * smoothstep(.5,.0,abs(fract(p.x)-.5)); return vec4(c + d*.55*u_amt*vec3(.8,.9,1.),1.); }` },
    { id: 'fireflies', name: 'کرم شب‌تاب', cat: 'طبیعت', glsl: `vec4 effect(vec2 uv){ vec3 c = tex(uv).rgb; vec2 a = vec2(u_res.x/u_res.y,1.); vec3 g = vec3(0.); for(int k=0;k<14;k++){ float fk = float(k); vec2 p = vec2(hash(vec2(fk,1.)), hash(vec2(fk,2.))); p += .1*vec2(sin(u_time*(.5+hash(vec2(fk,3.)))+fk), cos(u_time*(.4+hash(vec2(fk,4.)))+fk*2.)); float d = length((uv-p)*a); float tw = .6+.4*sin(u_time*3.+fk*7.); g += vec3(1.,.85,.35)*(.0025/(d*d+.0006))*tw*.06; } return vec4(c*mix(1.,.75,u_amt) + g*u_amt, 1.); }` },
    { id: 'sunrays', name: 'پرتو خورشید', cat: 'طبیعت', glsl: `vec4 effect(vec2 uv){ vec3 c = tex(uv).rgb; vec2 s = vec2(.8,.95); vec2 d = uv-s; float a = atan(d.y,d.x); float rays = pow(.5+.5*sin(a*18.+u_time*.8),3.)*smoothstep(1.2,0.,length(d)); vec3 g = c + vec3(1.,.85,.5)*rays*.45 + vec3(1.,.7,.3)*smoothstep(.5,0.,length(d))*.35; return vec4(mix(c,g,u_amt),1.); }` },
  ];
  E.forEach((e) => (e.builtin = true));
  L.EFFECTS = E;
  L.EFFECT_CATS = ['همه', 'فعال', 'رنگ', 'سینمایی', 'رترو', 'دیجیتال', 'هنری', 'اعوجاج', 'طبیعت', 'هوش مصنوعی'];
})();
