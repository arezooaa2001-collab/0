const $ = (id) => document.getElementById(id);
const videoInput = $('videoInput');
const editor = $('editor');
const welcome = $('welcome');
const video = $('sourceVideo');
const canvas = $('previewCanvas');
const ctx = canvas.getContext('2d');
const statusEl = $('status');
const fileName = $('fileName');
const emptyPreview = $('emptyPreview');
const playBtn = $('playBtn');
const seek = $('seek');
const timeLabel = $('timeLabel');
const startTime = $('startTime');
const endTime = $('endTime');
const speed = $('speed');
const speedValue = $('speedValue');
const filter = $('filter');
const rotation = $('rotation');
const ratio = $('ratio');
const overlayText = $('overlayText');
const textSize = $('textSize');
const textPosition = $('textPosition');
const textBg = $('textBg');
const mute = $('mute');
const exportBtn = $('exportBtn');
const exportMessage = $('exportMessage');
const progress = document.querySelector('.progress');
const progressBar = $('progressBar');
let objectUrl = '';
let raf = 0;

function fmt(s) { if (!Number.isFinite(s)) s = 0; const m = Math.floor(s / 60); const sec = Math.floor(s % 60); return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`; }
function clamp(n,a,b) { return Math.min(Math.max(n,a),b); }
function setStatus(t) { statusEl.textContent = t; }
function chooseVideo() { videoInput.click(); }

function loadFile(file) {
  if (!file || !file.type.startsWith('video/')) return setStatus('فایل ویدیو نیست');
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(file);
  video.src = objectUrl; video.load(); fileName.textContent = file.name;
  welcome.hidden = true; editor.hidden = false; emptyPreview.hidden = false; setStatus('در حال آماده‌سازی…');
}
videoInput.addEventListener('change', () => loadFile(videoInput.files[0]));
$('newVideoBtn').addEventListener('click', chooseVideo);

video.addEventListener('loadedmetadata', () => {
  const d = video.duration || 0; endTime.value = d.toFixed(1); startTime.max = d; endTime.max = d; seek.max = d || 1; seek.value = 0;
  setStatus('آماده تدوین'); draw(); updateTime();
});
video.addEventListener('loadeddata', () => { emptyPreview.hidden = true; draw(); });
video.addEventListener('timeupdate', () => { seek.value = video.currentTime; updateTime(); draw(); });
video.addEventListener('play', () => { playBtn.textContent = '⏸'; renderLoop(); });
video.addEventListener('pause', () => { playBtn.textContent = '▶'; cancelAnimationFrame(raf); draw(); });
video.addEventListener('ended', () => { playBtn.textContent = '▶'; cancelAnimationFrame(raf); });
playBtn.addEventListener('click', () => video.paused ? video.play() : video.pause());
seek.addEventListener('input', () => { video.currentTime = Number(seek.value); draw(); updateTime(); });
function updateTime() { timeLabel.textContent = `${fmt(video.currentTime)} / ${fmt(video.duration)}`; }

function renderLoop() { cancelAnimationFrame(raf); const loop = () => { draw(); if (!video.paused) raf = requestAnimationFrame(loop); }; loop(); }
function cssFilter() {
  return ({none:'none', cinema:'contrast(1.12) saturate(0.88) sepia(.14)', vivid:'contrast(1.12) saturate(1.45)', mono:'grayscale(1)', warm:'sepia(.22) saturate(1.15)', cool:'hue-rotate(12deg) saturate(.95)'})[filter.value] || 'none';
}
function outputSize(w,h) {
  if (ratio.value === '9:16') { const oh = 720, ow = Math.round(oh*9/16); return [ow,oh]; }
  if (ratio.value === '1:1') { const o = 720; return [o,o]; }
  if (ratio.value === '16:9') { const ow = 1280; return [ow,Math.round(ow*9/16)]; }
  return [w,h];
}
function draw() {
  if (!video.videoWidth || !video.videoHeight) return;
  const [ow,oh] = outputSize(video.videoWidth, video.videoHeight);
  canvas.width = ow; canvas.height = oh;
  ctx.save(); ctx.clearRect(0,0,ow,oh); ctx.fillStyle = '#000'; ctx.fillRect(0,0,ow,oh);
  ctx.filter = cssFilter();
  const r = Number(rotation.value) * Math.PI / 180;
  const sourceRatio = video.videoWidth / video.videoHeight;
  let dw=ow, dh=oh;
  if (ratio.value !== 'original') { if (ow/oh > sourceRatio) { dh=oh; dw=dh*sourceRatio; } else { dw=ow; dh=dw/sourceRatio; } }
  ctx.translate(ow/2,oh/2); ctx.rotate(r); ctx.drawImage(video,-dw/2,-dh/2,dw,dh); ctx.restore();
  ctx.filter='none'; drawText(ow,oh);
}
function drawText(w,h) {
  const text = overlayText.value.trim(); if (!text) return;
  const size = Number(textSize.value); ctx.save(); ctx.font = `800 ${size}px Tahoma, Arial, sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
  const y = textPosition.value === 'top' ? size*1.7 : textPosition.value === 'center' ? h/2 : h-size*1.7;
  const max = w-32; let shown=text; while (ctx.measureText(shown).width>max && shown.length>3) shown='…'+shown.slice(1);
  const tw=ctx.measureText(shown).width+28, th=size+22;
  if (textBg.checked) { ctx.fillStyle='rgba(0,0,0,.58)'; roundRect(ctx,w/2-tw/2,y-th/2,tw,th,14); ctx.fill(); }
  ctx.fillStyle='#fff'; ctx.shadowColor='rgba(0,0,0,.8)'; ctx.shadowBlur=8; ctx.fillText(shown,w/2,y); ctx.restore();
}
function roundRect(c,x,y,w,h,r) { c.beginPath(); c.roundRect(x,y,w,h,r); }

speed.addEventListener('input', () => { video.playbackRate=Number(speed.value); speedValue.textContent=`${speed.value}×`; });
[filter,rotation,ratio,overlayText,textSize,textPosition,textBg].forEach(el => el.addEventListener('input', draw));
[filter,rotation,ratio,textPosition].forEach(el => el.addEventListener('change', draw));
$('resetCut').addEventListener('click', () => { startTime.value=0; endTime.value=video.duration.toFixed(1); video.currentTime=0; });
[startTime,endTime].forEach(el => el.addEventListener('change', () => {
  const d=video.duration||0; let s=clamp(Number(startTime.value)||0,0,d); let e=clamp(Number(endTime.value)||d,0,d); if(e<=s)e=Math.min(d,s+.1); startTime.value=s.toFixed(1); endTime.value=e.toFixed(1); video.currentTime=s;
}));
mute.addEventListener('change', () => video.muted=mute.checked);

document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active')); document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active')); tab.classList.add('active'); $('tab-'+tab.dataset.tab).classList.add('active');
}));

function pickMime() { const list=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm']; return list.find(x=>MediaRecorder.isTypeSupported(x)) || ''; }
async function exportVideo() {
  if (!video.src || !video.videoWidth) return setStatus('اول یک ویدیو انتخاب کن');
  if (!window.MediaRecorder || !canvas.captureStream) return setStatus('این مرورگر خروجی گرفتن را پشتیبانی نمی‌کند');
  const mime=pickMime(); if(!mime) return setStatus('فرمت خروجی پشتیبانی نمی‌شود');
  const d=video.duration||0; const s=clamp(Number(startTime.value)||0,0,d); const e=clamp(Number(endTime.value)||d,0,d); if(e<=s) return setStatus('بازه برش درست نیست');
  exportBtn.disabled=true; progress.hidden=false; progressBar.style.width='0%'; exportMessage.textContent='در حال ساخت خروجی…'; setStatus('در حال خروجی گرفتن');
  const stream=canvas.captureStream(30); const audioCtx=new AudioContext(); const dest=audioCtx.createMediaStreamDestination();
  let sourceNode=null;
  try { if(!mute.checked) { sourceNode=audioCtx.createMediaElementSource(video); sourceNode.connect(dest); } } catch(e) {}
  if(!mute.checked && dest.stream.getAudioTracks().length) stream.addTrack(dest.stream.getAudioTracks()[0]);
  const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:6_000_000}); const chunks=[];
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
  const done=new Promise(resolve=>recorder.onstop=resolve); recorder.start(200); video.currentTime=s; video.playbackRate=Number(speed.value); video.muted=mute.checked;
  await video.play();
  await new Promise(resolve=>{ const tick=()=>{ const pct=clamp((video.currentTime-s)/(e-s),0,1); progressBar.style.width=`${pct*100}%`; if(video.currentTime>=e-0.03 || video.ended) resolve(); else requestAnimationFrame(tick); }; tick(); });
  video.pause(); recorder.stop(); await done; try{audioCtx.close();}catch(e){}
  const blob=new Blob(chunks,{type:mime}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`ladino-${Date.now()}.webm`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  progressBar.style.width='100%'; exportMessage.textContent=`تمام شد! خروجی ${(blob.size/1024/1024).toFixed(1)} MB آماده شد.`; setStatus('خروجی آماده است'); exportBtn.disabled=false;
}
exportBtn.addEventListener('click', exportVideo);
setInterval(() => { if(!video.paused && Number(endTime.value)>0 && video.currentTime>=Number(endTime.value)) video.pause(); },100);
