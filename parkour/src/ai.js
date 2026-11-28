// اتصال هوش مصنوعی برای چت آزاد: یا محیط Claude (قابلیت sample) یا کلید API در HTML/APK
import Anthropic from '@anthropic-ai/sdk';

export const AI_MODELS = [
  { id: 'claude-opus-5-5', name: 'Claude Opus 5.5 (پیش‌فرض)' },
  { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5' },
  { id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5 (سریع و ارزان)' },
];

const GAME_FACTS = `Game facts (answer correctly if asked): the game has 1000 levels that get harder; three modes: "رو به جلو" (forward, open from the start), "از بالا به پایین" (downhill, unlocks after beating level 10) and "از پایین به بالا" (climbing up a giant tower, unlocks after beating level 20); coins come from finishing levels (more for higher levels and better rank) plus coins collected along the course; the shop in the main menu sells speed, jump height, double jump and a coin magnet; lighting presets and platform color palettes are bought with coins in settings; checkpoints (glowing flags) save progress inside a level; obstacles include moving and crumbling platforms, lasers, swinging hammers, spinning sweepers, bounce pads, wall-run walls and slide-under bars.`;

function buildPrompt(ctx) {
  const people = ctx.personas
    .map((p) => `- id "${p.id}", name ${p.name}: ${p.personality} Typing style: ${p.style}`)
    .join('\n');
  const hist = ctx.history
    .slice(-14)
    .map((m) => `${m.name}: ${m.text}`)
    .join('\n');
  return `You write the chat replies of six other players in a 3D parkour racing game called "پارکور اوج". They are racing the human player, whose name is "${ctx.playerName}", right now, and they chat in the in-game chat like real young Iranian gamers.

The six players:
${people}

${GAME_FACTS}

Current situation: level ${ctx.level} of 1000, mode "${ctx.modeName}", environment "${ctx.themeName}". ${ctx.raceState}

Recent chat, oldest first:
${hist || '(empty)'}

${ctx.playerName} just wrote: ${JSON.stringify(ctx.text)}

Write what 1 or 2 of these players would naturally reply (3 only if the message clearly speaks to everyone; if the message names one of them, that one must reply). Rules:
- Use the language the human wrote in; for Persian use casual spoken Persian with correct half-spaces (نیم‌فاصله), like real chat messages. Keep each message short (under 140 characters), each in that player's own voice and personality.
- Respond to what the human actually said, and mention the race situation only when it fits.
- Stay in character as players of this game. Never write system-like text such as "پاسخ دریافت شد" or "as an AI". No markdown, no quotes around messages, no name prefix inside the text.
- Friendly vibe: light teasing is fine, never insults, vulgarity or anything inappropriate.

Reply with only JSON in exactly this shape: {"replies":[{"bot":"<id>","text":"<message>"}]}`;
}

function parseReplies(raw, personas) {
  let data = raw;
  if (typeof raw === 'string') {
    const a = raw.indexOf('{'), b = raw.lastIndexOf('}');
    if (a < 0 || b < a) return [];
    try {
      data = JSON.parse(raw.slice(a, b + 1));
    } catch (e) {
      return [];
    }
  }
  const list = Array.isArray(data) ? data : data && Array.isArray(data.replies) ? data.replies : [];
  const ids = new Set(personas.map((p) => p.id));
  return list
    .filter((r) => r && typeof r.text === 'string' && r.text.trim() && ids.has(String(r.bot)))
    .slice(0, 3)
    .map((r) => ({ bot: String(r.bot), text: r.text.trim().slice(0, 220) }));
}

export class AIChat {
  constructor(save) {
    this.save = save;
    this.sample = null;
    this.sampleDenied = false;
    this.detecting = null;
    this.lastError = '';
  }
  detect() {
    if (this.detecting) return this.detecting;
    this.detecting = (async () => {
      try {
        if (typeof window !== 'undefined' && window.claude && typeof window.claude.use === 'function') {
          this.sample = await window.claude.use('sample');
        }
      } catch (e) {
        this.sample = null;
      }
      return this.source();
    })();
    return this.detecting;
  }
  source() {
    if (this.sample && !this.sampleDenied) return 'claude';
    if (this.save.s.apiKey && this.save.s.apiKey.trim().length > 20) return 'key';
    return null;
  }

  async reply(ctx) {
    const src = this.source();
    if (!src) return { replies: [], error: 'none' };
    const prompt = buildPrompt(ctx);
    if (src === 'claude') {
      try {
        const data = await this.sample.json([{ role: 'user', content: prompt }], { modelTier: 'quick', cache: false });
        return { replies: parseReplies(data, ctx.personas) };
      } catch (e) {
        const code = e && e.code;
        if (code === 'not_granted' || code === 'sampling_disabled' || code === 'not_declared' || code === 'capability_disabled' || code === 'capability_removed') {
          this.sampleDenied = true;
          if (this.save.s.apiKey) return this.reply(ctx);
          return { replies: [], error: 'denied' };
        }
        if (code === 'invalid_json' && e.text) return { replies: parseReplies(e.text, ctx.personas) };
        return { replies: [], error: code === 'rate_limited' ? 'rate' : 'net' };
      }
    }
    // کلید API کاربر (فایل HTML یا APK)
    const model = this.save.s.model || 'claude-opus-5-5';
    const client = new Anthropic({ apiKey: this.save.s.apiKey.trim(), dangerouslyAllowBrowser: true, maxRetries: 1, timeout: 60000 });
    const base = {
      model,
      max_tokens: 4000,
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content: prompt }],
    };
    const withFallback = !model.startsWith('claude-haiku');
    try {
      let resp;
      try {
        resp = withFallback
          ? await client.beta.messages.create({ ...base, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
          : await client.messages.create(base);
      } catch (e) {
        // اگر پارامتر جایگزین پشتیبانی نشد، بدون آن دوباره
        if (withFallback && e instanceof Anthropic.BadRequestError) resp = await client.messages.create(base);
        else throw e;
      }
      if (resp.stop_reason === 'refusal') return { replies: [], error: 'refusal' };
      const text = resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
      return { replies: parseReplies(text, ctx.personas) };
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError) return { replies: [], error: 'auth' };
      if (e instanceof Anthropic.PermissionDeniedError) return { replies: [], error: 'auth' };
      if (e instanceof Anthropic.RateLimitError) return { replies: [], error: 'rate' };
      if (e instanceof Anthropic.NotFoundError) return { replies: [], error: 'model' };
      if (e instanceof Anthropic.APIConnectionError) return { replies: [], error: 'net' };
      return { replies: [], error: 'net' };
    }
  }
}

export const AI_ERRORS = {
  auth: 'کلید API قبول نشد. در تنظیمات ← چت هوشمند کلید را بررسی کن.',
  rate: 'فعلاً پیام زیاد فرستادی؛ چند لحظه بعد دوباره امتحان کن.',
  net: 'ارتباط با هوش مصنوعی برقرار نشد؛ بچه‌ها فعلاً با پیام‌های آماده جواب می‌دن.',
  model: 'این مدل در دسترس نیست؛ در تنظیمات مدل دیگری انتخاب کن.',
  denied: 'اجازهٔ استفاده از Claude داده نشد؛ برای چت آزاد کلید API را در تنظیمات وارد کن.',
  refusal: 'این پیام جواب داده نشد؛ یه چیز دیگه بگو.',
};
