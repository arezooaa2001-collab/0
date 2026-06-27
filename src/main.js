const features = [
  {
    title: 'زیرنویس خودکار فارسی',
    text: 'تبدیل گفتار یا متن سناریو به کپشن‌های کوتاه، خوانا و آماده انتشار.',
    icon: '字幕',
  },
  {
    title: 'زیرنویس‌های خفن',
    text: 'استایل نئون، سینمایی، تایپ‌نویس، هایلایت کلمات و انیمیشن ضرب‌آهنگ.',
    icon: '✨',
  },
  {
    title: 'افکت و جلوه حرفه‌ای',
    text: 'گلیچ، لرزش، بلوم، فریزفریم، اسلوموشن، ترنزیشن و فیلترهای رنگی.',
    icon: '⚡',
  },
  {
    title: 'ابزارهای شبیه اینشات',
    text: 'برش، کراپ، سرعت، موسیقی، استیکر، متن، بک‌گراند، نسبت تصویر و خروجی شبکه اجتماعی.',
    icon: '🎬',
  },
  {
    title: 'قالب‌های آماده',
    text: 'قالب ریلز، شورتز، ولاگ، آموزشی، تبلیغاتی و کپشن‌های ترند.',
    icon: '🧩',
  },
  {
    title: 'رایگان و سریع',
    text: 'هسته محصول بدون پرداخت طراحی شده و برای اجرا در مرورگر سبک است.',
    icon: '🆓',
  },
];

const featureGrid = document.querySelector('#featureGrid');
const scriptInput = document.querySelector('#scriptInput');
const captionStyle = document.querySelector('#captionStyle');
const generateBtn = document.querySelector('#generateBtn');
const captionPreview = document.querySelector('#captionPreview');

function renderFeatures() {
  featureGrid.innerHTML = features
    .map(
      (feature) => `
        <article class="feature-card">
          <span class="feature-card__icon">${feature.icon}</span>
          <h3>${feature.title}</h3>
          <p>${feature.text}</p>
        </article>
      `,
    )
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
  captionPreview.className = `caption-preview caption-preview--${captionStyle.value}`;
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
    : '<p>برای ساخت زیرنویس، متن ویدیو را وارد کن.</p>';
}

renderFeatures();
renderCaptions();
generateBtn.addEventListener('click', renderCaptions);
captionStyle.addEventListener('change', renderCaptions);
