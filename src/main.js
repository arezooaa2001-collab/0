const toolCopy = {
  cut: ['برش رایگان', 'قسمت‌های اضافه را حذف کن و کلیپ را برای ریلز یا شورتز آماده کن.'],
  crop: ['کراپ و کادر رایگان', 'کادر و نسبت تصویر را بدون پرداخت تغییر بده.'],
  speed: ['کنترل سرعت رایگان', 'اسلوموشن، فست‌موشن و تنظیم ریتم کلیپ بدون قفل پریمیوم.'],
  music: ['موسیقی رایگان', 'موزیک، صدای ضبط‌شده و افکت صوتی را به پروژه اضافه کن.'],
  caption: ['زیرنویس خودکار رایگان', 'متن فارسی را به زیرنویس روی ویدیو و ترک تایم‌لاین تبدیل کن.'],
  sticker: ['استیکر رایگان', 'استیکر، ایموجی و برچسب‌های ترند را روی ویدیو بگذار.'],
  filter: ['فیلتر و افکت رایگان', 'رنگ، نور، گلیچ و حالت سینمایی را بدون پرداخت امتحان کن.'],
  transition: ['ترنزیشن رایگان', 'بین کلیپ‌ها حرکت نرم، زوم، محو شدن و اسلاید اضافه کن.'],
};

const freeFeatures = ['بدون واترمارک', 'بدون خرید درون‌برنامه‌ای', 'همه ابزارها باز', 'خروجی HD رایگان'];

const toolButtons = document.querySelectorAll('.tool-button');
const toolTitle = document.querySelector('#toolTitle');
const toolDescription = document.querySelector('#toolDescription');
const freeList = document.querySelector('#freeList');
const captionInput = document.querySelector('#captionInput');
const liveCaption = document.querySelector('#liveCaption');
const captionTrack = document.querySelector('#captionTrack');
const ratioSelect = document.querySelector('#ratioSelect');
const styleSelect = document.querySelector('#styleSelect');
const filterSelect = document.querySelector('#filterSelect');
const videoPreview = document.querySelector('#videoPreview');
const videoInput = document.querySelector('#videoInput');
const videoPlayer = document.querySelector('#videoPlayer');
const emptyState = document.querySelector('#emptyState');
const fileName = document.querySelector('#fileName');
const timelineStatus = document.querySelector('#timelineStatus');
const exportBtn = document.querySelector('#exportBtn');

function setActiveTool(tool) {
  const [title, description] = toolCopy[tool];
  toolTitle.textContent = title;
  toolDescription.textContent = description;
  toolButtons.forEach((button) => button.classList.toggle('is-active', button.dataset.tool === tool));
  timelineStatus.textContent = `${title} فعال شد؛ این قابلیت رایگان است`;
}

function renderFreeFeatures() {
  freeList.innerHTML = freeFeatures.map((feature) => `<span>${feature}</span>`).join('');
}

function refreshPreviewClasses() {
  videoPreview.className = `video-preview ${ratioSelect.value} ${styleSelect.value} ${filterSelect.value}`;
}

function updateCaption() {
  const caption = captionInput.value.trim() || 'متن زیرنویس لادینو';
  liveCaption.textContent = caption;
  captionTrack.textContent = caption.length > 26 ? `${caption.slice(0, 26)}…` : caption;
}

function loadVideo(event) {
  const [file] = event.target.files;
  if (!file) return;

  videoPlayer.src = URL.createObjectURL(file);
  videoPlayer.hidden = false;
  emptyState.hidden = true;
  fileName.textContent = file.name;
  timelineStatus.textContent = 'ویدیو وارد شد؛ تمام ابزارهای تدوین رایگان هستند';
}

function showExportReady() {
  timelineStatus.textContent = 'خروجی رایگان و بدون واترمارک آماده شد';
  exportBtn.textContent = 'آماده خروجی ✓';
}

toolButtons.forEach((button) => {
  button.addEventListener('click', () => setActiveTool(button.dataset.tool));
});

captionInput.addEventListener('input', updateCaption);
ratioSelect.addEventListener('change', refreshPreviewClasses);
styleSelect.addEventListener('change', refreshPreviewClasses);
filterSelect.addEventListener('change', refreshPreviewClasses);
videoInput.addEventListener('change', loadVideo);
exportBtn.addEventListener('click', showExportReady);

renderFreeFeatures();
refreshPreviewClasses();
updateCaption();
