const features = [
  {
    title: 'زیرنویس خودکار فارسی',
    text: 'تبدیل متن سناریو به کپشن‌های زمان‌بندی‌شده، کوتاه، خوانا و آماده انتشار بدون پرداخت.',
    icon: '字幕',
  },
  {
    title: 'استایل‌های حرفه‌ای رایگان',
    text: 'نئون، سینمایی، مینیمال، هایلایت کلمات و ظاهر مناسب ریلز و شورتز بدون قفل پریمیوم.',
    icon: '✨',
  },
  {
    title: 'افکت و جلوه کامل',
    text: 'گلیچ، درخشش، لرزش، بلوم، فریزفریم، اسلوموشن، ترنزیشن و فیلترهای رنگی رایگان.',
    icon: '⚡',
  },
  {
    title: 'ابزارهای تدوین موبایلی',
    text: 'برش، کراپ، سرعت، موسیقی، استیکر، متن، بک‌گراند، نسبت تصویر و خروجی شبکه اجتماعی.',
    icon: '🎬',
  },
  {
    title: 'قالب‌های آماده محتوا',
    text: 'قالب ریلز، شورتز، ولاگ، آموزشی، تبلیغاتی و کپشن‌های ترند برای شروع سریع‌تر.',
    icon: '🧩',
  },
  {
    title: 'بدون واترمارک نمایشی',
    text: 'در لادینو هیچ ابزار اصلی پشت پرداخت نیست و خروجی نمونه با پیام رایگان آماده می‌شود.',
    icon: '🆓',
  },
];

const tools = ['برش', 'تقسیم کلیپ', 'کراپ', 'چرخش', 'سرعت', 'موسیقی', 'ضبط صدا', 'متن', 'استیکر', 'فیلتر', 'ترنزیشن', 'حذف پس‌زمینه', 'نسبت تصویر', 'خروجی HD'];

const featureGrid = document.querySelector('#featureGrid');
const toolPills = document.querySelector('#toolPills');
const scriptInput = document.querySelector('#scriptInput');
const captionStyle = document.querySelector('#captionStyle');
const aspectRatio = document.querySelector('#aspectRatio');
const effectStyle = document.querySelector('#effectStyle');
const generateBtn = document.querySelector('#generateBtn');
const captionPreview = document.querySelector('#captionPreview');
const exportSummary = document.querySelector('#exportSummary');

function renderFeatures() {
  featureGrid.innerHTML = features
    .map(
      (feature) => `
        <article class="feature-card">
          <span class="feature-card__icon">${feature.icon}</span>
          <h3>${feature.title}</h3>
          <p>${feature.text}</p>
          <span class="free-tag">رایگان</span>
        </article>
      `,
    )
    .join('');
}

function renderTools() {
  toolPills.innerHTML = tools
    .map((tool) => `<span class="tool-pill">${tool}<small>Free</small></span>`)
    .join('');
}

function splitIntoCaptions(text) {
  return text
    .split(/[؛.!؟\n]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((line, index) => ({
      start: `00:${String(index * 3).padStart(2, '0')}`,
      end: `00:${String(index * 3 + 3).padStart(2, '0')}`,
      line,
    }));
}

function renderCaptions() {
  const captions = splitIntoCaptions(scriptInput.value);
  captionPreview.className = `caption-preview caption-preview--${captionStyle.value} caption-preview--${effectStyle.value}`;
  exportSummary.innerHTML = `
    <strong>پکیج خروجی لادینو:</strong>
    <span>${aspectRatio.value}</span>
    <span>${captionStyle.options[captionStyle.selectedIndex].text}</span>
    <span>${effectStyle.options[effectStyle.selectedIndex].text}</span>
    <span>رایگان و بدون واترمارک</span>
  `;
  captionPreview.innerHTML = captions.length
    ? captions
        .map(
          (caption) => `
            <div class="caption-chip">
              <time>${caption.start} → ${caption.end}</time>
              <strong>${caption.line}</strong>
            </div>
          `,
        )
        .join('')
    : '<p>برای ساخت زیرنویس رایگان، متن ویدیو را وارد کن.</p>';
}

renderFeatures();
renderTools();
renderCaptions();
generateBtn.addEventListener('click', renderCaptions);
captionStyle.addEventListener('change', renderCaptions);
aspectRatio.addEventListener('change', renderCaptions);
effectStyle.addEventListener('change', renderCaptions);
