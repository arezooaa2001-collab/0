## All static game data: rarities, mutations, memes (hand-made + procedural), upgrades, wardrobe, missions, events.
class_name Data

const RARITIES := [
	{"id": 0, "name": "معمولی", "color": "#c9d3da", "weight": 52.0},
	{"id": 1, "name": "غیرمعمول", "color": "#5fe05f", "weight": 26.0},
	{"id": 2, "name": "کمیاب", "color": "#47b2ff", "weight": 12.0},
	{"id": 3, "name": "حماسی", "color": "#b46bff", "weight": 6.0},
	{"id": 4, "name": "افسانه‌ای", "color": "#ffb81f", "weight": 2.6},
	{"id": 5, "name": "اسطوره‌ای", "color": "#ff4772", "weight": 0.95},
	{"id": 6, "name": "مخفی", "color": "#7af7ff", "weight": 0.3},
	{"id": 7, "name": "الهی", "color": "#fff27a", "weight": 0.08},
]
const MUTATIONS := [
	{"id": 0, "name": "", "mult": 1.0, "chance": 0.86, "color": "#ffffff", "scale": 1.0},
	{"id": 1, "name": "طلایی", "mult": 2.0, "chance": 0.09, "color": "#ffd23f", "scale": 1.0},
	{"id": 2, "name": "الماسی", "mult": 3.0, "chance": 0.04, "color": "#9ff0ff", "scale": 1.0},
	{"id": 3, "name": "رنگین‌کمانی", "mult": 6.0, "chance": 0.01, "color": "#ff7cf0", "scale": 1.0},
	{"id": 4, "name": "گدازه‌ای", "mult": 200.0, "chance": 0.0, "color": "#ff7a2a", "scale": 1.0},
	{"id": 5, "name": "کهکشانی", "mult": 600.0, "chance": 0.0, "color": "#c08cff", "scale": 1.0},
	{"id": 6, "name": "آسمانی", "mult": 2000.0, "chance": 0.0, "color": "#bff4ff", "scale": 1.0},
	{"id": 7, "name": "طوفانی", "mult": 6000.0, "chance": 0.0, "color": "#7ab8ff", "scale": 1.0},
	{"id": 8, "name": "غول‌پیکر", "mult": 20.0, "chance": 0.004, "color": "#ffb347", "scale": 1.9},
	{"id": 9, "name": "یخی", "mult": 20000.0, "chance": 0.0, "color": "#bfefff", "scale": 1.0},
	{"id": 10, "name": "شفقی", "mult": 60000.0, "chance": 0.0, "color": "#7dffb0", "scale": 1.0},
	{"id": 11, "name": "نئونی", "mult": 200000.0, "chance": 0.0, "color": "#ff5cf4", "scale": 1.0},
	{"id": 12, "name": "سیاه‌چاله‌ای", "mult": 600000.0, "chance": 0.0, "color": "#a98bff", "scale": 1.0},
]
# id, name, emoji, rarity, price, income/s, world flag (0 = world 1, 2 = lava, 3 = sky)
const CHARS_RAW := [
	["potato", "سیب‌زمینی خوابالو", "🥔", 0, 25, 1, 0], ["slipper", "دمپایی پرنده", "🩴", 0, 40, 2, 0], ["cucumber", "خیار عینکی", "🥒", 0, 60, 3, 0],
	["chick", "جوجه‌ی جیغ‌جیغو", "🐤", 0, 85, 4, 0], ["teapot", "قوری غرغرو", "🫖", 0, 120, 5, 0], ["cat", "گربه‌ی شوکه", "🙀", 1, 300, 9, 0],
	["melon", "هندونه‌ی خندون", "🍉", 1, 450, 13, 0], ["frog", "قورباغه‌ی فیلسوف", "🐸", 1, 650, 18, 0], ["bread", "نون بربری رقاص", "🥖", 1, 900, 24, 0],
	["dog", "سگ عینک‌دودی", "🐶", 2, 2500, 55, 0], ["eggplant", "بادمجون کاراته‌کا", "🍆", 2, 3600, 75, 0], ["penguin", "پنگوئن کت‌وشلواری", "🐧", 2, 5000, 100, 0],
	["samovar", "سماور جت‌دار", "🚀", 2, 7000, 135, 0], ["shark", "کوسه‌ی کتونی‌پوش", "🦈", 3, 18000, 300, 0], ["elephant", "فیل کاکتوسی", "🐘", 3, 26000, 420, 0],
	["banana", "موز فضانورد", "🍌", 3, 38000, 580, 0], ["croc", "تمساح هلیکوپتری", "🐊", 3, 52000, 760, 0], ["lion", "شیر سبیل‌طلا", "🦁", 4, 140000, 1800, 0],
	["pizzabot", "روبات پیتزایی", "🍕", 4, 200000, 2500, 0], ["owl", "جغد جادوگر", "🦉", 4, 280000, 3400, 0], ["dragon", "اژدهای زعفرونی", "🐉", 4, 400000, 4600, 0],
	["camel", "شتر دیسکو", "🐫", 5, 1200000, 12000, 0], ["eagle", "عقاب تاج‌دار", "🦅", 5, 1800000, 17000, 0], ["octopus", "اختاپوس دی‌جی", "🐙", 5, 2600000, 24000, 0],
	["ghost", "شبح گلیچی", "👻", 6, 9000000, 70000, 0], ["cosmiccat", "گربه‌ی کیهانی", "🌌", 6, 15000000, 110000, 0], ["simorgh", "سیمرغ نئونی", "🕊️", 7, 60000000, 400000, 0],
	["memeking", "پادشاه میم‌ها", "👑", 7, 120000000, 750000, 0],
	["sugar", "کله‌قند رقاص", "🧂", 0, 140, 6, 0], ["goldfish", "ماهی قرمز عید", "🐠", 1, 1200, 30, 0], ["paykan", "پیکان پرنده", "🚗", 2, 9000, 170, 0],
	["cooker", "زودپز موشکی", "🍲", 3, 70000, 950, 0], ["div", "دیو سفید", "👹", 4, 550000, 6200, 0], ["rostam", "رستم میمی", "🛡️", 5, 3500000, 32000, 0],
	["ninjacat", "گربه‌ی نینجا", "🥷", 6, 22000000, 160000, 0],
	["golem", "غول گدازه‌ای", "🌋", 6, 2200000, 16000, 2], ["jelly", "عروس دریایی کیهانی", "🪼", 6, 4000000, 28000, 2], ["phoenix", "ققنوس آتشین", "🔥", 7, 30000000, 200000, 2],
	["whale", "نهنگ ابری", "🐋", 6, 3000000, 25000, 3], ["unicorn", "تک‌شاخ رنگین‌کمانی", "🦄", 6, 6000000, 45000, 3], ["angel", "فرشته‌ی میم", "😇", 7, 50000000, 330000, 3],
]
const MEME_ADJ := [
	["عینکی", "glasses", "eyes"], ["تاج‌دار", "crown", "head"], ["پرنده", "wings", "back"], ["شاخدار", "horns", "head"], ["خوابالو", "sleepy", "eyes"],
	["عصبانی", "angry", "brow"], ["رقاص", "dance", "move"], ["نینجا", "ninja", "head"], ["کابوی", "cowboy", "head"], ["فضانورد", "helmet", "head"],
	["جادوگر", "wizard", "head"], ["دزد دریایی", "pirate", "eyes"], ["سرآشپز", "chef", "head"], ["هدفون‌دار", "phones", "ears"], ["سبیلو", "stache", "mouth"],
	["ریشو", "beard", "mouth"], ["گل‌به‌سر", "flower", "head"], ["شنل‌پوش", "cape", "back"], ["موشکی", "rocket", "move"], ["یخ‌زده", "icy", "skin"],
	["طلایی", "gold", "skin"], ["نورانی", "glow", "skin"], ["خال‌خالی", "spots", "pattern"], ["راه‌راه", "stripes", "pattern"], ["غول", "big", "size"],
	["کوچولو", "small", "size"], ["شیطون", "devil", "head"], ["فرشته", "halo", "back"], ["سه‌چشم", "three", "eyes"], ["یک‌چشم", "cyclops", "eyes"],
	["کاراته‌کا", "karate", "move"], ["خندان", "grin", "mouth"], ["گریان", "cry", "mouth"], ["عاشق", "hearts", "eyes"], ["پروفسور", "grad", "head"],
	["ورزشکار", "band", "ears"], ["کیهانی", "orbit", "pattern"], ["آتشین", "fire", "head"], ["پاپیونی", "bow", "neck"], ["دیسکویی", "disco", "head"],
	["کلاه‌کپی", "cap", "head"], ["رنگین‌کمانی", "rainbow", "pattern"], ["رباتیک", "antenna", "ears"], ["پشمالو", "fluffy", "pattern"], ["شال‌گردنی", "scarf", "neck"],
]
const MEME_NOUNS := {
	1: [["سیب", "🍎", "ball", "#ff4a4a", "leaf"], ["پرتقال", "🍊", "ball", "#ff9a1f", "leaf"], ["هندوانه", "🍉", "ball", "#3fae3f", "melon"], ["گوجه", "🍅", "ball", "#ff3a2a", "leaf"], ["لیمو", "🍋", "egg", "#ffe14a", "leaf"],
		["بادمجان", "🍆", "egg", "#6a2a8a", "leaf"], ["هویج", "🥕", "cone", "#ff8a1f", "leaf"], ["سیب‌زمینی", "🥔", "egg", "#c79a5b", ""], ["کیک", "🎂", "can", "#ffd6e8", "candle"], ["دونات", "🍩", "donut", "#f7a8c8", ""],
		["بستنی", "🍦", "cone", "#fff3e0", "scoop"], ["پیتزا", "🍕", "cone", "#ffcf5a", ""], ["همبرگر", "🍔", "can", "#c8843a", "bun"], ["ساندویچ", "🥪", "box", "#f2d29b", ""], ["کلوچه", "🍪", "can", "#d9a066", "chips"],
		["پنیر", "🧀", "box", "#ffd23f", "holes"], ["تخم‌مرغ", "🥚", "egg", "#fff8ec", ""], ["قارچ", "🍄", "blob", "#ff4a4a", "spots"], ["کاکتوس", "🌵", "bean", "#3fae5f", "spikes"], ["گربه", "🐱", "ball", "#ff9a3a", "catEars"],
		["سگ", "🐶", "ball", "#c8955a", "dogEars"], ["خرگوش", "🐰", "egg", "#f4f4f4", "longEars"], ["جوجه", "🐤", "ball", "#ffd23f", "beak"], ["پنگوئن", "🐧", "egg", "#2a2a3a", "beak"], ["خرس", "🐻", "ball", "#8a5a3a", "roundEars"],
		["میمون", "🐵", "ball", "#a0703a", "roundEars"], ["قورباغه", "🐸", "blob", "#5fd35f", ""], ["اردک", "🦆", "egg", "#ffffff", "beak"], ["موش", "🐭", "egg", "#b0b0b8", "roundEars"], ["جغد", "🦉", "egg", "#8a6a4a", "beak"],
		["قوری", "🫖", "ball", "#e05a5a", "spout"], ["سماور", "⚱️", "can", "#d0a040", "spout"], ["کتری", "🫖", "can", "#9ab0c0", "spout"], ["دمپایی", "🩴", "box", "#2f80ed", ""], ["جوراب", "🧦", "bean", "#ff6fcf", ""],
		["کتونی", "👟", "box", "#ffffff", ""], ["توپ", "⚽", "ball", "#ffffff", "holes"], ["جعبه", "📦", "box", "#c8955a", ""], ["یخچال", "🧊", "tall", "#e8f0f8", ""], ["تلویزیون", "📺", "box", "#3a3a4a", "screen"],
		["گوشی", "📱", "tall", "#222233", "screen"], ["ماشین", "🚗", "box", "#ff4a4a", "wheels"]],
	2: [["سنگ", "🪨", "gem", "#4a3a3a", "cracks"], ["شعله", "🔥", "cone", "#ff5a1f", "flame"], ["آتشفشان", "🌋", "cone", "#5a2a2a", "flame"], ["اژدها", "🐉", "bean", "#c0302a", "spikes"], ["مارمولک", "🦎", "bean", "#ff7a2a", "spikes"],
		["زغال", "⚫", "gem", "#1a1a1a", "cracks"], ["گوگرد", "🟡", "gem", "#e0d040", ""], ["جمجمه", "💀", "ball", "#e8e0d0", ""], ["شیطانک", "😈", "ball", "#9a2aff", ""], ["عقرب", "🦂", "blob", "#8a3a1a", "spikes"],
		["کرم آتشین", "🪱", "bean", "#ff6a4a", ""], ["ققنوس", "🐦‍🔥", "egg", "#ff7a1f", "beak"], ["کوره", "🏭", "box", "#4a3a3a", "flame"], ["مشعل", "🔦", "can", "#b06a2a", "flame"], ["بمب", "💣", "ball", "#2a2a2a", "fuse"],
		["ترقه", "🧨", "can", "#ff2a2a", "fuse"], ["فلفل", "🌶️", "bean", "#e01a1a", "leaf"], ["چای داغ", "☕", "can", "#8a4a2a", "steam"], ["غول سبز", "🧌", "ball", "#6a8a3a", "roundEars"], ["کریستال", "💎", "gem", "#b061ff", ""],
		["الماس", "💎", "gem", "#7af7ff", ""], ["شهاب", "☄️", "ball", "#ff8a3a", "flame"], ["خفاش", "🦇", "ball", "#3a2a4a", "catEars"], ["عنکبوت", "🕷️", "blob", "#2a1a2a", "legs8"], ["سوسک", "🪲", "blob", "#3a6a2a", "legs8"],
		["اسکلت", "☠️", "bean", "#f0e8d8", ""], ["کدو", "🎃", "ball", "#ff8a1f", "leaf"], ["تبر", "🪓", "tall", "#8a6a4a", ""], ["سپر", "🛡️", "box", "#9a9aaa", ""], ["پتک", "🔨", "box", "#7a7a8a", ""]],
	3: [["ابر", "☁️", "ball", "#ffffff", "puffs"], ["بالن", "🎈", "egg", "#ff4f8b", "string"], ["بادبادک", "🪁", "gem", "#ffd23f", "string"], ["ستاره", "⭐", "gem", "#ffe14a", "spikes"], ["ماه", "🌙", "ball", "#fff3a0", "craters"],
		["خورشید", "☀️", "ball", "#ffb000", "rays"], ["رنگین‌کمان", "🌈", "donut", "#ff7cf0", ""], ["پَر", "🪶", "cone", "#f0f0ff", ""], ["پرستو", "🐦", "egg", "#3a5aaa", "beak"], ["کبوتر", "🕊️", "egg", "#f4f4f4", "beak"],
		["طوطی", "🦜", "egg", "#3fd35f", "beak"], ["فلامینگو", "🦩", "bean", "#ff8ab8", "beak"], ["زنبور", "🐝", "ball", "#ffd23f", "bee"], ["پروانه", "🦋", "ball", "#58c4ff", "antennae"], ["هواپیما", "✈️", "bean", "#e8f0ff", "tailfin"],
		["هلیکوپتر", "🚁", "box", "#ff4a4a", "rotor"], ["موشک", "🚀", "cone", "#f0f0f0", "flame"], ["چتر", "☂️", "blob", "#b061ff", ""], ["فرفره", "🎐", "cone", "#3df2b0", "rotor"], ["حباب", "🫧", "ball", "#bff4ff", ""],
		["دانه‌ی برف", "❄️", "gem", "#e8f8ff", "spikes"], ["رعد", "⚡", "gem", "#ffe14a", ""], ["گردباد", "🌪️", "cone", "#b0bec5", "puffs"], ["اسب بالدار", "🦄", "egg", "#ffffff", "longEars"], ["اژدهای ابری", "🐲", "bean", "#9fd8ff", "spikes"],
		["نهنگ", "🐋", "egg", "#9fd8ff", "tailfin"], ["ماهی پرنده", "🐟", "egg", "#58c4ff", "tailfin"], ["جغد شب", "🦉", "egg", "#5a4a8a", "beak"], ["خفاش ابری", "🦇", "ball", "#7a6aaa", "catEars"], ["کروبی", "👼", "cone", "#fffaf0", ""],
		["شبح", "👻", "cone", "#f4f4ff", ""], ["قلعه", "🏰", "box", "#e0d8ff", "towers"], ["فانوس", "🏮", "can", "#ff4a3a", ""], ["زنگوله", "🔔", "cone", "#ffd23f", ""], ["ساعت", "⏰", "ball", "#ff6a6a", "bells"],
		["کتاب", "📖", "box", "#4a7aff", ""], ["کلاه", "🎩", "can", "#2a2a3a", ""], ["ماهواره", "🛰️", "box", "#c0c8d0", "panels"], ["سیاره", "🪐", "ball", "#ffb38a", "ring"], ["بشقاب پرنده", "🛸", "blob", "#9ab0c0", "ring"]],
	4: [["آدم‌برفی", "⛄", "ball", "#ffffff", "carrot"], ["پنگوئن", "🐧", "egg", "#1a2a3a", "beak"], ["خرس قطبی", "🐻‍❄️", "ball", "#f4f8ff", "roundEars"], ["فوک", "🦭", "bean", "#8a9aaa", ""], ["گوزن", "🦌", "bean", "#a0704a", "antlers"],
		["روباه قطبی", "🦊", "ball", "#f0f4ff", "catEars"], ["قالب یخ", "🧊", "box", "#bfefff", ""], ["کریستال یخ", "❄️", "gem", "#9fe8ff", "spikes"], ["دانه‌ی برف", "❄️", "gem", "#ffffff", "spikes"], ["سورتمه", "🛷", "box", "#c0302a", ""],
		["اسکی‌باز", "⛷️", "tall", "#ff4a4a", ""], ["ماموت", "🦣", "ball", "#8a5a3a", "tusks"], ["یتی", "👣", "ball", "#e8f0ff", "roundEars"], ["یخ در بهشت", "🍧", "cone", "#9fe8ff", "scoop"], ["کاکائو داغ", "☕", "can", "#6a3a1a", "steam"],
		["دستکش", "🧤", "bean", "#ff4f8b", ""], ["کلاه بافتنی", "🧶", "blob", "#3fae5f", "pompom"], ["گلوله‌برفی", "⚪", "ball", "#ffffff", ""], ["ایگلو", "🛖", "blob", "#e8f4ff", ""], ["نهنگ قاتل", "🐋", "egg", "#1a1a2a", "tailfin"],
		["ماهی یخی", "🐟", "egg", "#9fd8ff", "tailfin"], ["قندیل", "🔻", "cone", "#bfefff", ""], ["فانوس قطبی", "🏮", "can", "#3df2b0", ""], ["شفق", "🌌", "gem", "#7dffb0", ""], ["کوه یخ", "🏔️", "cone", "#e8f8ff", ""],
		["جغد برفی", "🦉", "egg", "#ffffff", "beak"], ["خرگوش برفی", "🐇", "egg", "#ffffff", "longEars"], ["اسنوبرد", "🏂", "tall", "#29b6ff", ""], ["شکلات داغ", "🍫", "box", "#5a3a1a", "steam"], ["شیر دریایی", "🦭", "bean", "#6a5a4a", "beak"]],
	5: [["فضانورد", "👨‍🚀", "bean", "#f0f0f0", "visor"], ["آدم فضایی", "👽", "egg", "#7aff6a", "antennae"], ["ربات", "🤖", "box", "#c0c8d0", "screen"], ["سیاره‌ی صورتی", "🪐", "ball", "#ff8ab8", "ring"], ["ماه کامل", "🌕", "ball", "#e0e0d0", "craters"],
		["شهاب‌سنگ", "☄️", "gem", "#7a6a5a", "flame"], ["سیاه‌چاله", "🕳️", "donut", "#2a1040", ""], ["دنباله‌دار", "💫", "cone", "#ffe14a", "flame"], ["ماهواره", "🛰️", "box", "#b0bec5", "panels"], ["موشک", "🚀", "cone", "#ff4a4a", "flame"],
		["بشقاب پرنده", "🛸", "blob", "#9fe8ff", "ring"], ["کهکشان", "🌌", "donut", "#9b6bff", ""], ["سحابی", "✨", "ball", "#ff3df2", "puffs"], ["تفنگ لیزری", "🔫", "tall", "#ff2a6a", ""], ["کریستال نئونی", "💠", "gem", "#3df2ff", ""],
		["گربه‌ی فضایی", "🐱", "ball", "#b061ff", "catEars"], ["هشت‌پای فضایی", "🐙", "ball", "#ff4fd8", "legs8"], ["کرم فضایی", "🪱", "bean", "#7aff6a", "antennae"], ["اژدهای نئونی", "🐉", "bean", "#3df2b0", "spikes"], ["روح دیجیتال", "👾", "box", "#ff3df2", ""],
		["دسته‌ی بازی", "🕹️", "can", "#2a2a3a", "stick"], ["دیسک", "💿", "donut", "#e0e0ff", ""], ["مکعب نئونی", "🧊", "box", "#29d9ff", ""], ["هرم", "🔺", "cone", "#ffd23f", ""], ["ماه‌نورد", "🛻", "box", "#c0c8d0", "wheels"],
		["خورشید سیاه", "🌑", "ball", "#2a1a3a", "rays"], ["اتم", "⚛️", "gem", "#7af7ff", "ring"], ["پیکسل", "🟪", "box", "#b061ff", ""], ["هولوگرام", "📡", "tall", "#3df2ff", "screen"], ["سایبورگ", "🦾", "bean", "#9aa0b0", "visor"]],
}
const PROC_PLAN := {1: [230, 200, 170, 140, 110, 80, 45, 25], 2: [0, 0, 0, 330, 270, 200, 130, 70], 3: [0, 0, 0, 0, 3800, 3000, 2100, 1100], 4: [0, 0, 0, 0, 0, 900, 700, 400], 5: [0, 0, 0, 0, 0, 800, 700, 500]}
const PROC_ADJ := {1: 1, 2: 1, 3: 2, 4: 2, 5: 2}
const PRICE_BAND := [[20, 160, 22], [250, 1300, 32], [2000, 9500, 48], [15000, 75000, 62], [120000, 600000, 80], [1e6, 4e6, 100], [7e6, 25e6, 125], [3e7, 1.3e8, 155]]

static var CHARS: Array = []
static var CHAR_BY_ID: Dictionary = {}
static var POOLS: Array = []
static var HAND_COUNT := 0
static var _ready_done := false

const WORLD_NAMES := ["", "میدان میم‌ها", "سیاره‌ی گدازه", "جزیره‌های آسمانی", "قطب یخی", "ماه نئونی"]
const WORLD_EMOJI := ["", "🏙️", "🌋", "🏝️", "❄️", "🌙"]
const W2_WEIGHTS := [0, 0, 0, 40, 30, 17, 9, 4]
const W3_WEIGHTS := [0, 0, 0, 0, 45, 30, 17, 8]
const W4_WEIGHTS := [0, 0, 0, 0, 0, 52, 32, 16]
const W5_WEIGHTS := [0, 0, 0, 0, 0, 44, 34, 22]
const PORTAL_WORTH := 550000000.0
const PORTAL3_WORTH := 1e12
const PORTAL4_WORTH := 1e14
const PORTAL5_WORTH := 5e15
const WORLD_MUTS := [null, null, [4, 5, 0.15], [6, 7, 0.12], [9, 10, 0.12], [11, 12, 0.12]]
const MAX_SLOTS := 12
const START_MONEY := 100.0

static func ezafe(n: String) -> String:
	if n.ends_with("ه"):
		return n + "‌ی"
	if n.ends_with("ا") or n.ends_with("و"):
		return n + "ی"
	return n

static func ensure() -> void:
	if _ready_done:
		return
	_ready_done = true
	CHARS = []
	for i in CHARS_RAW.size():
		var a = CHARS_RAW[i]
		var w: int = 1 if a[6] == 0 else a[6]
		CHARS.append({"idx": i, "id": a[0], "name": a[1], "emoji": a[2], "rarity": a[3], "price": float(a[4]), "income": float(a[5]), "w": w, "proc": null})
	HAND_COUNT = CHARS.size()
	_gen_proc_memes()
	CHAR_BY_ID = {}
	for c in CHARS:
		CHAR_BY_ID[c.id] = c
	POOLS = [null]
	for w in range(1, 6):
		var per := []
		for r in RARITIES:
			var hand := []
			var proc := []
			for c in CHARS:
				if c.rarity != r.id:
					continue
				if c.proc != null:
					if c.w == w:
						proc.append(c)
				else:
					var ok := false
					match w:
						1: ok = c.w == 1
						2: ok = c.w == 2 or (c.w == 1 and r.id >= 3)
						3: ok = c.w == 3 or (c.w == 1 and r.id >= 4)
						_: ok = r.id >= 5
					if ok:
						hand.append(c)
			per.append({"hand": hand, "proc": proc})
		POOLS.append(per)

static func _gen_proc_memes() -> void:
	var taken := {}
	for c in CHARS:
		taken[c.name] = true
	for w in range(1, 6):
		var R := U.Mulberry.new(7919 * w + 13)
		var nouns: Array = MEME_NOUNS[w]
		var plan: Array = PROC_PLAN[w]
		var na: int = PROC_ADJ[w]
		var combos := []
		for ni in nouns.size():
			for a in MEME_ADJ.size():
				if na == 1:
					combos.append([ni, a])
					continue
				for b in range(a + 1, MEME_ADJ.size()):
					if MEME_ADJ[a][2] != MEME_ADJ[b][2]:
						combos.append([ni, a, b])
		var i := combos.size() - 1
		while i > 0:
			var j := int(floorf(R.next() * (i + 1)))
			var t = combos[i]
			combos[i] = combos[j]
			combos[j] = t
			i -= 1
		var ci := 0
		var k := 0
		for r in plan.size():
			var cnt: int = plan[r]
			var n := 0
			while n < cnt and ci < combos.size():
				var cb: Array = combos[ci]
				ci += 1
				var N: Array = nouns[cb[0]]
				var adj := cb.slice(1)
				var name: String = ezafe(N[0])
				for ai in adj:
					name += " " + MEME_ADJ[ai][0]
				if taken.has(name):
					continue
				taken[name] = true
				var band: Array = PRICE_BAND[r]
				var lo: float = band[0]
				var hi: float = band[1]
				var pay: float = band[2]
				var price: float = roundf(lo * pow(hi / lo, R.next()))
				var income: float = maxf(1.0, roundf(price / (pay * (0.9 + R.next() * 0.2))))
				CHARS.append({"idx": CHARS.size(), "id": "m%d_%05d" % [w, k], "name": name, "emoji": N[1], "rarity": r, "price": price, "income": income, "w": w,
					"proc": {"noun": N, "adj": adj, "seed": int(floorf(R.next() * 1e9))}})
				k += 1
				n += 1

static func pick_char(w: int, r: int) -> Dictionary:
	var k := r
	while k >= 0:
		var P: Dictionary = POOLS[w][k]
		if P.hand.size() > 0 and (P.proc.size() == 0 or randf() < 0.3):
			return U.pick(P.hand)
		if P.proc.size() > 0:
			return U.pick(P.proc)
		k -= 1
	return CHARS[0]

static func weights_of(w: int) -> Array:
	match w:
		2: return W2_WEIGHTS
		3: return W3_WEIGHTS
		4: return W4_WEIGHTS
		5: return W5_WEIGHTS
	var out := []
	for r in RARITIES:
		out.append(r.weight)
	return out

static func world_mut(w: int) -> int:
	var m = WORLD_MUTS[w] if w < WORLD_MUTS.size() else null
	if m == null:
		return 0
	return m[1] if randf() < m[2] else m[0]

static func chars_of_world(w: int) -> Array:
	var out := []
	for c in CHARS:
		if c.w == w:
			out.append(c)
	out.sort_custom(func(a, b): return a.rarity < b.rarity or (a.rarity == b.rarity and a.price < b.price))
	return out

# ---------------------------------------------------------------- upgrades
static func _cost(base: float, mult: float) -> Callable:
	return func(l: int) -> float: return roundf(base * pow(mult, l))
static func _fixed(v: float) -> Callable:
	return func(_l: int) -> float: return v

static var UPGRADES: Dictionary = {
	"cap": {"name": "ظرفیت پایگاه", "emoji": "🏠", "max": 8, "desc": func(l): return "جای میم: " + U.fa(4 + l) + " → " + U.fa(5 + l), "cost": _cost(250, 2.6)},
	"income": {"name": "دستگاه پول‌ساز", "emoji": "💸", "max": 10, "desc": func(l): return "درآمد +" + U.fa(l * 10) + "٪ → +" + U.fa((l + 1) * 10) + "٪", "cost": _cost(1000, 2.8)},
	"speed": {"name": "کتونی فشفشه", "emoji": "👟", "max": 8, "desc": func(l): return "سرعت دویدن همیشه +" + U.fa(l * 7) + "٪ → +" + U.fa((l + 1) * 7) + "٪", "cost": _cost(400, 3)},
	"carrySpeed": {"name": "کفش دزد فرز", "emoji": "🏃", "max": 8, "desc": func(l): return "سرعت موقع بردن میم دزدی +" + U.fa(l * 8) + "٪ → +" + U.fa((l + 1) * 8) + "٪", "cost": _cost(700, 3)},
	"secDur": {"name": "باتری لیزر", "emoji": "🔋", "max": 5, "desc": func(l): return "مدت سپر: " + U.fa(25 + l * 10) + " → " + U.fa(35 + l * 10) + " ثانیه", "cost": _cost(500, 3)},
	"secCd": {"name": "خنک‌کننده‌ی سپر", "emoji": "❄️", "max": 5, "desc": func(l): return "آماده‌سازی: " + U.fa(70 - l * 8) + " → " + U.fa(62 - l * 8) + " ثانیه", "cost": _cost(800, 3)},
	"trap": {"name": "تله‌ی چسبناک", "emoji": "🕸️", "max": 3, "desc": func(l): return "دزدها توی پایگاهت " + U.fa(l * 10) + "٪ → " + U.fa((l + 1) * 10) + "٪ کندتر", "cost": _cost(3000, 4)},
	"magnet": {"name": "آهن‌ربای سکه", "emoji": "🧲", "max": 1, "desc": func(_l): return "هر ۵ ثانیه پول‌ها خودکار جمع می‌شوند", "cost": _fixed(6000)},
	"jump": {"name": "کفش فنری", "emoji": "🦘", "max": 1, "desc": func(_l): return "پرش دوبل: وسط هوا دوباره بپر", "cost": _fixed(15000)},
	"lavaBoots": {"shop": 2, "name": "چکمه‌ی ضدگدازه", "emoji": "🥾", "max": 1, "desc": func(_l): return "روی گدازه راه برو؛ دیگر نمی‌سوزی و میمت نمی‌افتد", "cost": _fixed(3e9)},
	"meteorShield": {"shop": 2, "name": "کلاه ضدشهاب", "emoji": "⛑️", "max": 1, "desc": func(_l): return "شهاب‌سنگ‌ها دیگر به تو آسیبی نمی‌زنند", "cost": _fixed(6e9)},
	"cloak": {"shop": 2, "name": "شنل سایه", "emoji": "🦇", "max": 3, "desc": func(l): return "نگهبان‌ها تا وقتی میم برنداشته‌ای نمی‌بینندت؛ صاحب‌خانه دیرتر می‌فهمد و نگهبان " + U.fa((l + 1) * 10) + "٪ کندتر دنبالت می‌کند", "cost": _cost(2e9, 4)},
	"turbo": {"shop": 2, "name": "موتور جت دزدی", "emoji": "🚀", "max": 3, "desc": func(l): return "سرعت با میم دزدی در سیاره‌ی گدازه: +" + U.fa(l * 12) + "٪ → +" + U.fa((l + 1) * 12) + "٪", "cost": _cost(1.5e9, 3)},
	"hook": {"shop": 2, "name": "قلاب دزدی", "emoji": "🪝", "max": 1, "desc": func(_l): return "از فاصله‌ی دورتر (۴ متر) میم را قاپ بزن", "cost": _fixed(4e9)},
	"guardBot": {"shop": 2, "name": "ربات نگهبان شخصی", "emoji": "🤖", "max": 1, "desc": func(_l): return "یک ربات نگهبان برای پایگاهت در سیاره‌ی گدازه؛ دزدها را می‌گیرد", "cost": _fixed(1e10)},
	"board": {"name": "اسکیت‌برد پرنده", "emoji": "🛹", "max": 1, "desc": func(_l): return "با دکمه‌ی 🛹 (کلید H) سوار شو و ۷۵٪ تندتر برو (موقع دزدی پیاده می‌شوی)", "cost": _fixed(25000)},
	"petCat": {"name": "پت: گربه‌ی سکه‌ای", "emoji": "🐱", "max": 1, "desc": func(_l): return "دنبالت می‌آید و درآمدت را ۱۵٪ بیشتر می‌کند", "cost": _fixed(50000)},
	"petBird": {"name": "پت: جوجه‌ی تیزپا", "emoji": "🐤", "max": 1, "desc": func(_l): return "دنبالت می‌آید و ۱۰٪ تندتر می‌دوی", "cost": _fixed(120000)},
	"petDrag": {"name": "پت: اژدهاک کوچولو", "emoji": "🐲", "max": 1, "desc": func(_l): return "سیلی‌هایت ۴۰٪ زودتر آماده می‌شوند و یک ثانیه بیشتر گیج می‌کنند", "cost": _fixed(400000)},
	"glider": {"shop": 3, "name": "پاراگلایدر", "emoji": "🪂", "max": 1, "desc": func(_l): return "وقتی از جزیره می‌افتی آرام سُر می‌خوری و می‌توانی به لبه برگردی", "cost": _fixed(2e11)},
	"anchor": {"shop": 3, "name": "چکمه‌ی لنگر", "emoji": "⚓", "max": 1, "desc": func(_l): return "باد شدید دیگر هلت نمی‌دهد", "cost": _fixed(3e11)},
	"cloudJump": {"shop": 3, "name": "کفش ابری", "emoji": "☁️", "max": 1, "desc": func(_l): return "در جزیره‌ها پرش سه‌گانه: دو بار وسط هوا بپر", "cost": _fixed(5e11)},
	"lightRod": {"shop": 3, "name": "برق‌گیر", "emoji": "🔱", "max": 1, "desc": func(_l): return "صاعقه‌های جزیره‌ها دیگر به تو نمی‌خورند", "cost": _fixed(8e11)},
	"spikes": {"shop": 4, "name": "کفش میخ‌دار", "emoji": "🥾", "max": 1, "desc": func(_l): return "روی یخ لیز نمی‌خوری و دقیق می‌دوی", "cost": _fixed(4e14)},
	"furCoat": {"shop": 4, "name": "پالتوی خزدار", "emoji": "🧥", "max": 1, "desc": func(_l): return "کولاک دیگر کندت نمی‌کند", "cost": _fixed(7e14)},
	"snowShield": {"shop": 4, "name": "سپر برفی", "emoji": "🛡️", "max": 1, "desc": func(_l): return "گلوله‌برفی‌های غول‌پیکر دیگر پرتت نمی‌کنند", "cost": _fixed(1.2e15)},
	"jetpack": {"shop": 5, "name": "جت‌پک", "emoji": "🎒", "max": 1, "desc": func(_l): return "روی ماه سه بار وسط هوا بپر", "cost": _fixed(2e16)},
	"laserSuit": {"shop": 5, "name": "لباس ضدلیزر", "emoji": "🥼", "max": 1, "desc": func(_l): return "لیزرهای چرخان دیگر به تو آسیب نمی‌زنند", "cost": _fixed(5e16)},
	"moonBoots": {"shop": 5, "name": "چکمه‌ی ماه‌نورد", "emoji": "👢", "max": 3, "desc": func(l): return "سرعت روی ماه با میم دزدی: +" + U.fa(l * 15) + "٪ → +" + U.fa((l + 1) * 15) + "٪", "cost": _cost(1e16, 3)},
	"slap": {"name": "دستکش سیلی", "emoji": "🥊", "max": 3, "desc": func(l): return "زمان استراحت ضربه: " + U.fa("%.1f" % (3.5 - l * 0.8)) + " → " + U.fa("%.1f" % (2.7 - l * 0.8)) + " ثانیه", "cost": _cost(2500, 4)},
}
static var UP_KEYS: Array = UPGRADES.keys()
const SPEED_KEYS := ["speed", "carrySpeed"]
static func up_shop(k: String) -> int:
	return UPGRADES[k].get("shop", 1)
static func up_cost(k: String, l: int) -> float:
	return UPGRADES[k].cost.call(l)

# ---------------------------------------------------------------- wardrobe
const WEAR_COLORS := [["#2fe08a", "سبز نعنایی"], ["#ff4f8b", "صورتی"], ["#4f8cff", "آبی"], ["#ffd23f", "زرد"], ["#ff5252", "قرمز"], ["#b061ff", "بنفش"], ["#1b1b22", "مشکی"], ["#ffffff", "سفید"], ["#ff9a1f", "نارنجی"], ["#00c2d1", "فیروزه‌ای"], ["#8a5a3a", "قهوه‌ای"], ["#2b3a67", "سرمه‌ای"], ["#c0c8d0", "نقره‌ای"], ["#ffc93c", "طلایی"]]
const WEAR := {
	"set": {"t": "🎭 ست کامل", "items": [
		["ninja", "🥷 نینجا", 4e5, {"shirt": "#1b1b22", "pants": "#1b1b22", "shoes": "#1b1b22", "hair": "ninja", "hairC": "#1b1b22", "accent": "#e02424", "acc": "none"}],
		["chef", "👨‍🍳 سرآشپز", 1.5e5, {"shirt": "#ffffff", "pants": "#1b1b22", "shoes": "#1b1b22", "hair": "chef", "accent": "#ff5252", "acc": "scarf"}],
		["cowboy", "🤠 کابوی", 1e5, {"shirt": "#c8843a", "pants": "#2b3a67", "shoes": "#8a5a3a", "hair": "cowboy", "accent": "#ffd23f", "acc": "none"}],
		["wizard", "🧙 جادوگر", 1.5e6, {"shirt": "#4a2a8a", "pants": "#2a1a4a", "shoes": "#4a2a8a", "hair": "wizard", "accent": "#ffd23f", "acc": "cape"}],
		["hero", "🦸 ابرقهرمان", 8e6, {"shirt": "#2f6fd6", "pants": "#e02424", "shoes": "#e02424", "hair": "spiky", "hairC": "#1b1b22", "accent": "#e02424", "acc": "cape"}],
		["astro", "👨‍🚀 فضانورد", 5e6, {"shirt": "#f4f4f4", "pants": "#f4f4f4", "shoes": "#c0c8d0", "hair": "helmet", "accent": "#ff7a2a", "acc": "jetpack"}],
		["king", "👑 پادشاه", 3e7, {"shirt": "#c0143c", "pants": "#ffd23f", "shoes": "#ffd23f", "hair": "crown", "hairC": "#3a2410", "accent": "#ffd23f", "acc": "cape"}],
		["devil", "😈 شیطون", 6e7, {"shirt": "#c0143c", "pants": "#1b1b22", "shoes": "#1b1b22", "hair": "horns", "hairC": "#1b1b22", "accent": "#1b1b22", "acc": "cape"}],
		["angel", "😇 فرشته", 1.5e8, {"shirt": "#ffffff", "pants": "#ffffff", "shoes": "#ffd23f", "hair": "halo", "hairC": "#ffd23f", "accent": "#ffd23f", "acc": "wings"}],
		["frost", "❄️ یخی", 1e15, {"shirt": "#7fdbff", "pants": "#ffffff", "shoes": "#ffffff", "hair": "beanie", "hat": "#ffffff", "accent": "#29b6ff", "acc": "scarf"}],
		["neon", "🌙 نئونی", 1e17, {"shirt": "#1b1b22", "pants": "#1b1b22", "shoes": "#ff3df2", "hair": "phones", "hairC": "#ff3df2", "accent": "#3df2ff", "acc": "glasses"}],
	]},
	"hair": {"t": "🎩 کلاه و مو", "key": "hair", "items": [["spiky", "🧑 موی سیخ‌سیخی", 0], ["cap", "🧢 کلاه کپی", 3000], ["buns", "👧 موی گوجه‌ای", 3000], ["beanie", "🧶 کلاه بافتنی", 8000], ["phones", "🎧 هدفون", 20000], ["tophat", "🎩 کلاه شاپو", 50000], ["cowboy", "🤠 کلاه کابوی", 80000], ["chef", "👨‍🍳 کلاه آشپزی", 120000], ["ninja", "🥷 سربند نینجا", 250000], ["wizard", "🧙 کلاه جادوگری", 1e6], ["helmet", "👨‍🚀 کلاه فضانوردی", 3e6], ["horns", "😈 شاخ", 5e6], ["crown", "👑 تاج", 2e7], ["halo", "😇 هاله‌ی نور", 1e8]]},
	"acc": {"t": "✨ اکسسوری", "key": "acc", "items": [["none", "🎒 کوله‌پشتی ساده", 0], ["glasses", "🕶️ عینک آفتابی", 30000], ["scarf", "🧣 شال‌گردن", 60000], ["cape", "🦸 شنل", 2e5], ["jetpack", "🚀 جت‌پک تزئینی", 2e6], ["wings", "🪽 بال فرشته", 1e7]]},
	"shirt": {"t": "👕 پیراهن", "key": "shirt", "colors": 2000},
	"pants": {"t": "👖 شلوار", "key": "pants", "colors": 2000},
	"shoes": {"t": "👟 کفش", "key": "shoes", "colors": 1500},
	"accent": {"t": "🎨 رنگ کوله و شنل", "key": "accent", "colors": 1500},
	"hairC": {"t": "💇 رنگ مو", "key": "hairC", "colors": 1000},
	"skin": {"t": "🙂 رنگ پوست", "key": "skin", "items": [["#ffcf9e", "روشن", 0], ["#f1c27d", "گندمی", 0], ["#e0ac69", "برنزه", 0], ["#c68642", "سبزه", 0], ["#8d5524", "تیره", 0]]},
}
static func wear_items(cat: String) -> Array:
	var C: Dictionary = WEAR[cat]
	if C.has("colors"):
		var out := []
		for cn in WEAR_COLORS:
			out.append([cn[0], cn[1], float(C.colors) * 2500.0 if cn[0] == "#ffc93c" else float(C.colors)])
		return out
	return C.items
static func wear_cat(key: String) -> String:
	for c in WEAR.keys():
		if WEAR[c].get("key", "") == key:
			return c
	return ""

# ---------------------------------------------------------------- missions / events / misc
static var MISSION_DEFS: Array = [
	{"id": "buy", "emoji": "🛒", "t": func(n): return "از نوار نقاله " + U.fa(n) + " میم بخر", "n": [3, 5, 8]},
	{"id": "steal", "emoji": "🦹", "t": func(n): return U.fa(n) + " میم از پایگاه حریف‌ها بدزد", "n": [1, 2, 3]},
	{"id": "collect", "emoji": "💰", "t": func(n): return U.fmt(n) + " سکه از سکوهای سبز جمع کن", "n": "income"},
	{"id": "catch", "emoji": "👮", "t": func(n): return U.fa(n) + " دزد را بگیر", "n": [1, 2]},
	{"id": "slap", "emoji": "🥊", "t": func(n): return U.fa(n) + " بار با سیلی یک حریف را گیج کن", "n": [2, 4, 6]},
	{"id": "rare", "emoji": "💎", "t": func(_n): return "یک میم «کمیاب» یا بهتر بخر", "n": [1]},
	{"id": "shield", "emoji": "🛡️", "t": func(n): return U.fa(n) + " بار سپر لیزری را روشن کن", "n": [1, 2]},
	{"id": "shop", "emoji": "🎁", "t": func(n): return U.fa(n) + " ارتقا از مغازه بخر", "n": [1, 2]},
	{"id": "fuse", "emoji": "⚗️", "t": func(_n): return "در دستگاه ترکیب، ۳ میم یکسان را ترکیب کن", "n": [1]},
	{"id": "djump", "emoji": "🦘", "t": func(n): return U.fa(n) + " بار پرش دوبل بزن", "n": [3, 6], "needs": "jump"},
]
const DAILY := [500, 1000, 2500, 5000, 10000, 25000, 60000]
const OWNER_COLORS := ["#2fe08a", "#ff5252", "#4f8cff", "#ffa31a", "#b061ff", "#ff6fcf", "#00c2d1", "#ffd23f"]
const PLAYER_PLOT := 2
const NPC_PLOTS := [0, 4, 5, 6, 7, 9, 11]
const SALE_PLOTS := [1, 3, 8, 10]
const NPC_NAMES := ["شاهین", "رها", "بابک", "نازی", "کوروش", "سارا", "آرش"]
const EVENTS := [
	{"id": "golden", "name": "باران طلایی", "desc": "همه‌ی درآمدها دو برابر!", "emoji": "🌧️💰"},
	{"id": "lucky", "name": "ساعت شانس", "desc": "میم‌های کمیاب بیشتر می‌آیند!", "emoji": "🍀"},
	{"id": "sale", "name": "حراج بزرگ", "desc": "قیمت‌های نوار ۳۰٪ ارزان‌تر!", "emoji": "🏷️"},
	{"id": "raid", "name": "شب دزدها", "desc": "حریف‌ها بیشتر دزدی می‌کنند!", "emoji": "🦹"},
	{"id": "turbo", "name": "نوار توربو", "desc": "نوار نقاله تندتر می‌چرخد!", "emoji": "⚡"},
	{"id": "ufo", "name": "حمله‌ی یوفوها", "desc": "یک یوفو میم‌های کمیاب و غول‌پیکر روی نوار می‌اندازد!", "emoji": "🛸"},
]
const LOOKS := [
	{"skin": "#ffcf9e", "shirt": "#2fe08a", "pants": "#2b3a67", "shoes": "#ffffff", "hair": "spiky", "hairC": "#3a2410", "accent": "#ffd23f"},
	{"skin": "#f1c27d", "shirt": "#ff5252", "pants": "#222831", "shoes": "#ff5252", "hair": "cap", "hairC": "#111111", "accent": "#ffffff", "hat": "#111827"},
	{"skin": "#ffdbac", "shirt": "#4f8cff", "pants": "#f5f5f5", "shoes": "#4f8cff", "hair": "buns", "hairC": "#8b4513", "accent": "#ff6fcf"},
	{"skin": "#c68642", "shirt": "#ffa31a", "pants": "#3b2f2f", "shoes": "#111111", "hair": "phones", "hairC": "#1a1a1a", "accent": "#3df2b0"},
	{"skin": "#ffe0bd", "shirt": "#b061ff", "pants": "#1b1446", "shoes": "#ffd23f", "hair": "crown", "hairC": "#e8c07a", "accent": "#ffd23f"},
	{"skin": "#8d5524", "shirt": "#ff6fcf", "pants": "#2b3a67", "shoes": "#ffffff", "hair": "spiky", "hairC": "#2a1a10", "accent": "#58c4ff"},
	{"skin": "#f3d1b0", "shirt": "#00c2d1", "pants": "#3a2f5a", "shoes": "#ff4f8b", "hair": "buns", "hairC": "#c0392b", "accent": "#ffd23f"},
	{"skin": "#e0ac69", "shirt": "#ffd23f", "pants": "#1b1446", "shoes": "#2fe08a", "hair": "cap", "hairC": "#111111", "accent": "#ff5252", "hat": "#ff5252"},
]
const W2_NAMES := ["غول گدازه", "ملکه‌ی آتش", "شبح سیاه", "ربات X-9", "جادوگر سرخ"]
const W2_COLORS := ["#ff3d00", "#ff1f8e", "#7d5cff", "#00e5ff", "#c0ff00"]
const W2_LOOKS := [
	{"skin": "#7a4a3a", "shirt": "#3a0d0d", "pants": "#120808", "shoes": "#ff3d00", "hair": "crown", "hairC": "#1a0a0a", "accent": "#ff3d00"},
	{"skin": "#ffd8c0", "shirt": "#8a0f3a", "pants": "#1a0814", "shoes": "#ff1f8e", "hair": "buns", "hairC": "#ff1f8e", "accent": "#ffd23f"},
	{"skin": "#b9b2e6", "shirt": "#1a1430", "pants": "#0a0814", "shoes": "#7d5cff", "hair": "spiky", "hairC": "#0a0814", "accent": "#7d5cff"},
	{"skin": "#9aa3ae", "shirt": "#1d2a33", "pants": "#11161b", "shoes": "#00e5ff", "hair": "phones", "hairC": "#11161b", "accent": "#00e5ff"},
	{"skin": "#e0ac69", "shirt": "#4a1a00", "pants": "#1b0c05", "shoes": "#c0ff00", "hair": "cap", "hairC": "#111111", "accent": "#c0ff00", "hat": "#c0ff00"},
]
const GUARD_LOOK := {"skin": "#aab3bf", "shirt": "#2d3142", "pants": "#1b1e2a", "shoes": "#ff2a3a", "hair": "cap", "hairC": "#111111", "accent": "#ff2a3a", "hat": "#ff2a3a"}
const PLAYER_GUARD_LOOK := {"skin": "#cfd6df", "shirt": "#2fe08a", "pants": "#1b1e2a", "shoes": "#2fe08a", "hair": "cap", "hairC": "#111111", "accent": "#2fe08a", "hat": "#2fe08a"}
const W3_NAMES := ["کاپیتان طوفان", "ملکه‌ی ابر", "شبح باد", "عقاب سیاه"]
const W3_COLORS := ["#29b6ff", "#ff9de2", "#b0bec5", "#ffca28"]
const W3_LOOKS := [
	{"skin": "#e0ac69", "shirt": "#0d3b66", "pants": "#1b1b2a", "shoes": "#29b6ff", "hair": "cap", "hairC": "#111111", "accent": "#ffd23f", "hat": "#0d3b66"},
	{"skin": "#ffe0d0", "shirt": "#ff9de2", "pants": "#ffffff", "shoes": "#ff9de2", "hair": "crown", "hairC": "#f4f4ff", "accent": "#9fe8ff"},
	{"skin": "#cfd8dc", "shirt": "#eceff1", "pants": "#90a4ae", "shoes": "#ffffff", "hair": "phones", "hairC": "#ffffff", "accent": "#29b6ff"},
	{"skin": "#8d5524", "shirt": "#263238", "pants": "#111111", "shoes": "#ffca28", "hair": "spiky", "hairC": "#111111", "accent": "#ffca28"},
]
const SKY_GUARD_LOOK := {"skin": "#ffffff", "shirt": "#29b6ff", "pants": "#eceff1", "shoes": "#ffca28", "hair": "phones", "hairC": "#eceff1", "accent": "#ffca28"}
const SHOPKEEPER_LOOK := {"skin": "#ffcf9e", "shirt": "#ff4f8b", "pants": "#2b3a67", "shoes": "#111111", "hair": "cap", "hairC": "#222222", "accent": "#ffd23f", "hat": "#ffd23f"}
const W2_KEEPER_LOOK := {"skin": "#9aa3ae", "shirt": "#3a1a10", "pants": "#1a0c08", "shoes": "#ff5a1f", "hair": "cap", "hairC": "#111111", "accent": "#ff5a1f", "hat": "#2a2a2a"}
const W3_KEEPER_LOOK := {"skin": "#ffe0bd", "shirt": "#29b6ff", "pants": "#0d3b66", "shoes": "#ffca28", "hair": "cap", "hairC": "#111111", "accent": "#ffca28", "hat": "#ffca28"}
const BOSS_LOOK := {"skin": "#6a4a3a", "shirt": "#3a0a4a", "pants": "#140818", "shoes": "#ffd23f", "hair": "crown", "hairC": "#111111", "accent": "#ff2a3a"}

static func shop_keeper_name(w: int) -> String:
	match w:
		2: return "🔥 آهنگر گدازه"
		3: return "🪂 خلبان ایستگاه"
		4: return "🧭 کاشف قطبی"
		5: return "🔬 دانشمند ماه"
	return "🛍️ مغازه‌دار"

static func sec_duration(o) -> float: return 25.0 + o.up.secDur * 10.0
static func sec_cooldown(o) -> float: return 70.0 - o.up.secCd * 8.0
static func rebirth_cost(r: int) -> float: return 1000000.0 * pow(5.0, r)
static func slap_cooldown(o) -> float: return (3.5 - o.up.slap * 0.8) * (0.6 if o.up.petDrag > 0 else 1.0)
