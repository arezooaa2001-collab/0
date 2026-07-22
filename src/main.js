const features = [
  { title: 'زیرنویس هوشمند و Karaoke', text: 'شکستن سناریو به کپشن‌های کوتاه، زمان‌بندی‌شده و قابل خواندن با حالت هایلایت کلمه‌ای.', icon: '字幕' },
  { title: 'تایم‌لاین چندلایه', text: 'ساخت خودکار ترک‌های ویدیو، B-roll، صدا، متن، افکت، ترنزیشن و کالرگریدینگ.', icon: '🎞️' },
  { title: 'اصلاح رنگ حرفه‌ای', text: 'پروفایل‌های LUT مثل Teal & Orange، فیلم مات، شبکه اجتماعی و مونوکروم برای خروجی سینمایی.', icon: '🎨' },
  { title: 'میکس و مستر صدا', text: 'پریست پاکسازی پادکست، داکینگ موسیقی، بیس سینمایی و حالت ویدیوهای بی‌صدا.', icon: '🎚️' },
  { title: 'افکت و ترنزیشن پیشرفته', text: 'گلیچ، درخشش، نوآر، بلوم، لرزش کنترل‌شده، فریزفریم و اسلوموشن نمایشی.', icon: '⚡' },
  { title: 'خروجی آماده انتشار', text: 'پیشنهاد بیت‌ریت، رزولوشن، چک‌لیست کپشن، کاور، safe area و فرمت شبکه اجتماعی.', icon: '🚀' },
];

const tools = ['Ripple Cut', 'MultiCam', 'Speed Ramp', 'Motion Blur', 'Chroma Key', 'Noise Reduce', 'Beat Sync', 'Auto Reframe', 'LUT Studio', 'Audio Ducking', 'Keyframes', 'Masking', 'Stabilizer', '4K Export', 'Thumbnail', 'Safe Area'];
const assets = [
  { name: 'A-Cam اصلی', type: 'Video', meta: '4K · 60fps' },
  { name: 'B-roll محصول', type: 'Video', meta: '1080p · 24fps' },
  { name: 'Voice Over', type: 'Audio', meta: '-14 LUFS' },
  { name: 'Music Bed', type: 'Audio', meta: 'Ducking Ready' },
  { name: 'Logo Sting', type: 'Graphic', meta: 'Alpha' },
];

const featureGrid = document.querySelector('#featureGrid');
const toolPills = document.querySelector('#toolPills');
const assetList = document.querySelector('#assetList');
const scriptInput = document.querySelector('#scriptInput');
const captionStyle = document.querySelector('#captionStyle');
const aspectRatio = document.querySelector('#aspectRatio');
const effectStyle = document.querySelector('#effectStyle');
const colorGrade = document.querySelector('#colorGrade');
const audioPreset = document.querySelector('#audioPreset');
const exportPreset = document.querySelector('#exportPreset');
const generateBtn = document.querySelector('#generateBtn');
const captionPreview = document.querySelector('#captionPreview');
const exportSummary = document.querySelector('#exportSummary');
const trackList = document.querySelector('#trackList');
const monitor = document.querySelector('#monitor');
const monitorCaption = document.querySelector('#monitorCaption');
const timecode = document.querySelector('#timecode');
const durationBadge = document.querySelector('#durationBadge');
const renderQuality = document.querySelector('#renderQuality');
const audioMeter = document.querySelector('#audioMeter');
const playBtn = document.querySelector('#playBtn');
const publishChecklist = document.querySelector('#publishChecklist');

let isPlaying = false;
let playhead = 0;
let timerId;

function renderFeatures() {
  featureGrid.innerHTML = features.map((feature) => `
    <article class="feature-card">
      <span class="feature-card__icon">${feature.icon}</span>
      <h3>${feature.title}</h3>
      <p>${feature.text}</p>
      <span class="free-tag">Pro Demo</span>
    </article>
  `).join('');
}

function renderTools() {
  toolPills.innerHTML = tools.map((tool) => `<span class="tool-pill">${tool}<small>Active</small></span>`).join('');
}

function renderAssets() {
  assetList.innerHTML = assets.map((asset) => `
    <article class="asset-card">
      <strong>${asset.name}</strong>
      <span>${asset.type}</span>
      <small>${asset.meta}</small>
    </article>
  `).join('');
}

function splitIntoCaptions(text) {
  return text.split(/[؛.!؟\n]+/).map((item) => item.trim()).filter(Boolean).map((line, index) => ({
    start: index * 4,
    end: index * 4 + Math.max(3, Math.min(6, Math.ceil(line.length / 18))),
    line,
  }));
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${secs}`;
}

function buildTracks(captions) {
  const duration = Math.max(24, captions.at(-1)?.end + 4 || 24);
  const trackData = [
    { name: 'V1 A-Cam', kind: 'video', clips: [42, 24, 34] },
    { name: 'V2 B-roll', kind: 'broll', clips: [18, 30, 22, 16] },
    { name: 'T1 Captions', kind: 'text', clips: captions.map((caption) => Math.max(12, caption.line.length)) },
    { name: 'FX Transitions', kind: 'fx', clips: [12, 12, 12, 12, 12] },
    { name: 'A1 Voice', kind: 'audio', clips: [74, 18] },
    { name: 'A2 Music', kind: 'music', clips: [100] },
  ];

  durationBadge.textContent = formatTime(duration);
  trackList.innerHTML = trackData.map((track) => `
    <div class="track track--${track.kind}">
      <strong>${track.name}</strong>
      <div class="track__clips">
        ${track.clips.map((width, index) => `<span style="--clip:${width}" title="clip ${index + 1}"></span>`).join('')}
      </div>
    </div>
  `).join('');
}

function renderChecklist(captions) {
  const items = [
    `زیرنویس: ${captions.length} کپشن کوتاه و خوانا`,
    `نسبت تصویر: ${aspectRatio.value} با safe area فعال`,
    `صدا: ${audioPreset.options[audioPreset.selectedIndex].text} و محدودسازی پیک`,
    `رنگ: LUT ${colorGrade.options[colorGrade.selectedIndex].text}`,
    `خروجی: ${exportPreset.options[exportPreset.selectedIndex].text} با کاور پیشنهادی`,
  ];
  publishChecklist.innerHTML = items.map((item) => `<li><span>✓</span>${item}</li>`).join('');
}

function renderProject() {
  const captions = splitIntoCaptions(scriptInput.value);
  const activeCaption = captions[Math.min(Math.floor(playhead / 4), Math.max(captions.length - 1, 0))];
  monitor.className = `monitor monitor--${aspectRatio.value.replace(':', '-')} monitor--${effectStyle.value} monitor--${colorGrade.value}`;
  monitorCaption.textContent = activeCaption?.line || 'برای ساخت پروژه، متن ویدیو را وارد کن.';
  captionPreview.className = `caption-preview caption-preview--${captionStyle.value} caption-preview--${effectStyle.value}`;
  renderQuality.textContent = exportPreset.value === 'youtube' ? '4K HDR' : '1080×1920';
  exportSummary.innerHTML = `
    <strong>پکیج خروجی:</strong>
    <span>${aspectRatio.value}</span>
    <span>${captionStyle.options[captionStyle.selectedIndex].text}</span>
    <span>${effectStyle.options[effectStyle.selectedIndex].text}</span>
    <span>${colorGrade.options[colorGrade.selectedIndex].text}</span>
    <span>${audioPreset.options[audioPreset.selectedIndex].text}</span>
  `;
  captionPreview.innerHTML = captions.length ? captions.map((caption) => `
    <div class="caption-chip">
      <time>${formatTime(caption.start)} → ${formatTime(caption.end)}</time>
      <strong>${caption.line}</strong>
    </div>
  `).join('') : '<p>برای ساخت زیرنویس هوشمند، متن ویدیو را وارد کن.</p>';
  buildTracks(captions);
  renderChecklist(captions);
}

function tick() {
  playhead = (playhead + 1) % 60;
  timecode.textContent = `00:${formatTime(playhead)}`;
  audioMeter.style.width = `${35 + Math.abs(Math.sin(playhead / 2)) * 60}%`;
  renderProject();
}

function togglePlayback() {
  isPlaying = !isPlaying;
  playBtn.textContent = isPlaying ? '⏸' : '▶';
  clearInterval(timerId);
  if (isPlaying) timerId = setInterval(tick, 850);
}

renderFeatures();
renderTools();
renderAssets();
renderProject();
generateBtn.addEventListener('click', renderProject);
[scriptInput, captionStyle, aspectRatio, effectStyle, colorGrade, audioPreset, exportPreset].forEach((control) => control.addEventListener('input', renderProject));
playBtn.addEventListener('click', togglePlayback);
