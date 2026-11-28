// سیستم چت با رقبا: پیام‌های پیشنهادی، پاسخ طبیعی، گفت‌وگوی خودجوش بر اساس رویدادهای مسابقه
import { BOT_PERSONAS, CATEGORIES, SUGGESTED, REPLIES, SPECIFIC_REPLIES, EVENT_LINES, KEYWORDS, FALLBACK_REPLIES } from './chat-data.js';
import { AI_ERRORS } from './ai.js';
import { fa } from './util.js';

export { BOT_PERSONAS, CATEGORIES, SUGGESTED };

export class ChatSystem {
  constructor(game, ai) {
    this.game = game;
    this.ai = ai;
    this.log = [];
    this.recent = [];
    this.pending = 0;
    this.lastEventT = -99;
    this.botLastT = {};
    this.hintShown = false;
    this.onMessage = null;
    this.onTyping = null;
  }
  get personas() {
    return BOT_PERSONAS;
  }
  playerName() {
    return (this.game.save.s.playerName || 'تو').slice(0, 18);
  }
  now() {
    return performance.now() / 1000;
  }
  push(msg) {
    msg.time = this.now();
    this.log.push(msg);
    if (this.log.length > 120) this.log.shift();
    this.onMessage && this.onMessage(msg);
  }
  system(text) {
    this.push({ from: 'system', text });
  }

  fill(text, persona) {
    const others = BOT_PERSONAS.filter((p) => p.id !== persona.id);
    const other = others[Math.floor(Math.random() * others.length)];
    return text
      .replaceAll('{player}', this.playerName())
      .replaceAll('{me}', persona.name)
      .replaceAll('{level}', fa(this.game.level || 1))
      .replaceAll('{other}', other.name);
  }
  pickLine(list) {
    if (!list || !list.length) return null;
    const fresh = list.filter((x) => !this.recent.includes(x));
    const src = fresh.length ? fresh : list;
    const line = src[Math.floor(Math.random() * src.length)];
    this.recent.push(line);
    if (this.recent.length > 40) this.recent.shift();
    return line;
  }
  pickBots(n, text = '') {
    // اگر اسم کسی آمده، او جواب بدهد
    const named = BOT_PERSONAS.filter((p) => text.includes(p.name) || text.toLowerCase().includes(p.tag.toLowerCase()));
    const rest = BOT_PERSONAS.filter((p) => !named.includes(p)).sort(() => Math.random() - 0.5);
    return [...named, ...rest].slice(0, Math.max(n, named.length));
  }
  botSay(persona, text, delay = 0) {
    this.pending++;
    const typing = Math.min(3.2, 0.6 + text.length * 0.035) + delay;
    setTimeout(() => this.onTyping && this.onTyping(persona, true), delay * 1000);
    setTimeout(() => {
      this.pending--;
      this.onTyping && this.onTyping(persona, false);
      this.push({ from: 'bot', bot: persona.id, name: persona.name, text });
      this.botLastT[persona.id] = this.now();
      this.game.onBotChat && this.game.onBotChat(persona.id, text);
    }, typing * 1000);
  }

  // پیام پیشنهادی
  sendSuggested(item) {
    this.push({ from: 'player', name: this.playerName(), text: item.text });
    const pool = item.id && SPECIFIC_REPLIES[item.id] ? SPECIFIC_REPLIES[item.id] : REPLIES[item.cat];
    const n = item.cat === 'greet' || item.cat === 'bye' || item.cat === 'emoji' ? (Math.random() < 0.6 ? 2 : 3) : Math.random() < 0.55 ? 1 : 2;
    const bots = this.pickBots(n, item.text);
    let delay = 0.5 + Math.random() * 0.8;
    bots.forEach((p, i) => {
      const line = this.pickLine(i > 0 && !item.id ? REPLIES[item.cat] : pool) || this.pickLine(FALLBACK_REPLIES);
      this.botSay(p, this.fill(line, p), delay);
      delay += 1.2 + Math.random() * 1.6;
    });
  }

  // پیام آزاد
  async sendFree(text) {
    text = text.trim().slice(0, 300);
    if (!text) return;
    this.push({ from: 'player', name: this.playerName(), text });
    await this.ai.detect();
    const src = this.ai.source();
    if (src) {
      const guess = this.pickBots(1, text)[0];
      this.onTyping && this.onTyping(guess, true);
      const res = await this.ai.reply({
        personas: BOT_PERSONAS,
        playerName: this.playerName(),
        level: this.game.level || 1,
        modeName: this.game.modeName ? this.game.modeName() : '',
        themeName: this.game.themeName ? this.game.themeName() : '',
        raceState: this.game.raceSummary ? this.game.raceSummary() : '',
        history: this.log.filter((m) => m.from !== 'system').map((m) => ({ name: m.from === 'player' ? this.playerName() : m.name, text: m.text })),
        text,
      });
      this.onTyping && this.onTyping(guess, false);
      if (res.replies && res.replies.length) {
        let delay = 0.1;
        for (const r of res.replies) {
          const p = BOT_PERSONAS.find((x) => x.id === r.bot);
          this.botSay(p, r.text, delay);
          delay += 1 + Math.random() * 1.2;
        }
        return;
      }
      if (res.error && res.error !== 'refusal' && !this._errShown) {
        this._errShown = true;
        this.system(AI_ERRORS[res.error] || AI_ERRORS.net);
      }
    } else if (!this.hintShown) {
      this.hintShown = true;
      setTimeout(() => this.system('برای اینکه بچه‌ها به هر حرفی که می‌زنی کاملاً طبیعی جواب بدن، بازی رو داخل Claude باز کن یا کلید API رو در «تنظیمات ← چت هوشمند» وارد کن. فعلاً با پیام‌های آماده جواب می‌دن.'), 2600);
    }
    this.keywordReply(text);
  }

  keywordReply(text) {
    const low = text.toLowerCase();
    let hit = null;
    for (const k of KEYWORDS) {
      if (k.words.some((w) => low.includes(w.toLowerCase()))) { hit = k; break; }
    }
    const pool = hit ? (hit.id && SPECIFIC_REPLIES[hit.id]) || REPLIES[hit.cat] : FALLBACK_REPLIES;
    const bots = this.pickBots(Math.random() < 0.6 ? 1 : 2, text);
    let delay = 0.6 + Math.random();
    for (const p of bots) {
      this.botSay(p, this.fill(this.pickLine(pool) || this.pickLine(FALLBACK_REPLIES), p), delay);
      delay += 1.3 + Math.random() * 1.5;
    }
  }

  // رویدادهای مسابقه -> گفت‌وگوی خودجوش
  event(kind, botId, chance = 0.5) {
    if (!this.game.save.s.botChat) return;
    const t = this.now();
    if (t - this.lastEventT < 5.5 || Math.random() > chance) return;
    let persona = botId ? BOT_PERSONAS.find((p) => p.id === botId) : null;
    if (!persona) persona = BOT_PERSONAS[Math.floor(Math.random() * BOT_PERSONAS.length)];
    if (t - (this.botLastT[persona.id] || -99) < 14) return;
    const line = this.pickLine(EVENT_LINES[kind]);
    if (!line) return;
    this.lastEventT = t;
    this.botLastT[persona.id] = t;
    this.botSay(persona, this.fill(line, persona), 0.3 + Math.random() * 0.8);
  }
  clear() {
    this.log = [];
  }
}
