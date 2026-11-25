// چت با آدم‌هایی که نجاتشان داده‌ای: پیام‌های پیشنهادی با جواب‌های طبیعی (همه نسخه‌ها)
// و نوشتن پیام دلخواه فقط وقتی بازی داخل Claude باز شده (پاسخ را Claude در نقش آن آدم می‌دهد)
import * as THREE from 'three';
import { clamp, damp, wrapAngle } from './utils.js';

const $ = (id) => document.getElementById(id);
const pick = (a) => a[(Math.random() * a.length) | 0];
const NAMES_F = ['سارا', 'مریم', 'نرگس', 'زهرا', 'لیلا', 'فاطمه', 'نازنین', 'الهام', 'پریسا', 'مهسا'];
const NAMES_M = ['علی', 'رضا', 'حسین', 'امیر', 'مهدی', 'کاوه', 'بهرام', 'سینا', 'آرش', 'محمد'];
export const SUGGESTED = ['خواهش می‌کنم', 'تشکر', 'هر وقت خواستی بیام', 'مرسی', 'حالت خوبه؟', 'مراقب خودت باش', 'خداحافظ'];

// جواب‌های طبیعی و متنوع، بسته به اینکه از چه چیزی نجات پیدا کرده
const REPLIES = {
  greet: {
    choke: ['سلام دوباره! هنوزم باورم نمیشه... اگه تو نبودی الان اینجا نبودم 🙏', 'وای تویی! بیا اینجا، می‌خواستم درست و حسابی ازت تشکر کنم ❤️', 'سلام قهرمان! گلوم هنوز یه کم می‌سوزه ولی حالم خیلی بهتره 😊'],
    fire: ['سلام! هنوز بوی دود تو لباسامه... ولی زنده‌ام، به لطف تو 🙏', 'تویی که منو از اون آتیش بیرون آوردی! خدا خیرت بده ❤️', 'سلام قهرمان! آتش‌نشان‌ها گفتن اگه دو دقیقه دیرتر می‌رسیدی... نمی‌خوام بهش فکر کنم 😢']
  },
  'خواهش می‌کنم': {
    choke: ['تو جون منو نجات دادی، این کم‌ترین کاریه که می‌تونم بکنم! 🙏', 'نه واقعاً، کار بزرگی کردی. از این به بعد غذامو آروم‌تر می‌خورم 😅', 'خیلی فروتنی! ولی من این لطفت رو هیچ‌وقت یادم نمیره ❤️'],
    fire: ['هنوزم دارم می‌لرزم... ولی تو با این آرامشت خیالم رو راحت می‌کنی 😊', 'خونه‌م سوخت ولی مهم اینه که زنده‌ام. همه‌ش به خاطر توئه ❤️', 'تو واقعاً یه آتش‌نشان به دنیا اومدی! خیلی شجاعی 🔥👏']
  },
  'تشکر': {
    choke: ['نه بابا، من باید ازت تشکر کنم! 😄', 'منم ازت ممنونم که این‌قدر مهربونی 🌟', 'تشکر از تو! اگه یه روز کمک خواستی، اول به من بگو 💪'],
    fire: ['من باید تشکر کنم! تو منو از وسط شعله‌ها بیرون آوردی 🙏', 'منم ازت ممنونم! تو بهترین همسایه این محله‌ای 😊', 'تشکر از تو قهرمان! یه روز جبران می‌کنم 💛']
  },
  'هر وقت خواستی بیام': {
    choke: ['حتماً! شماره‌ت رو ذخیره کردم 📱 خیالم خیلی راحت‌تر شد', 'چه خوب که آدمی مثل تو تو این شهره 😊 حتماً خبرت می‌کنم', 'قول میدی؟ پس دفعه بعد که شام درست کردم، دعوتت می‌کنم! 🍲'],
    fire: ['مرسی! تا خونه‌م رو درست کنن پیش خواهرم می‌مونم، ولی حتماً خبرت می‌کنم 📱', 'وای چه دلگرمی خوبی! یه همسایه قهرمان دارم 😄', 'حتماً! وقتی خونه ساخته شد، اولین مهمونم تویی 🏡']
  },
  'مرسی': {
    choke: ['مرسی از تو! 😊', 'قربونت برم، تو بهترینی 🌟', 'مرسی که اومدی بهم سر زدی 💛'],
    fire: ['مرسی از تو! هیچ‌وقت فراموشت نمی‌کنم 🙏', 'قربونت، خیلی لطف کردی 😊', 'مرسی قهرمان! 💪']
  },
  'حالت خوبه؟': {
    choke: ['آره، الان راحت نفس می‌کشم! فقط گلوم یه ذره درد می‌کنه 😌', 'خیلی بهترم، مرسی که پرسیدی! یه لیوان آب خوردم حالم جا اومد 💧', 'آره خوبم، فقط هنوز یه کم ترسیده‌ام 😅'],
    fire: ['یه کم سرفه می‌کنم ولی خوبم. آتش‌نشان‌ها گفتن چیز خطرناکی نیست 😮‍💨', 'بهترم! فقط دلم برای عکس‌های خونه‌م تنگ میشه... 😢', 'آره، خداروشکر سالمم. تو چی؟ دستت نسوخت؟']
  },
  'مراقب خودت باش': {
    choke: ['تو هم همین‌طور! تو همیشه دنبال کارهای خطرناکی 😄', 'چشم! تو هم یواش رانندگی کن 🚗', 'حتماً! تو هم مراقب خودت باش قهرمان 💛'],
    fire: ['تو هم! دیگه وارد خونه‌های آتیش‌گرفته نشو... البته جز برای نجات کسی 😅', 'حتماً، دیگه اجاق رو روشن نمی‌ذارم 🔥', 'تو هم مراقب خودت باش، شهر به تو نیاز داره 🦸']
  },
  'خداحافظ': {
    choke: ['خداحافظ قهرمان! مواظب خودت باش 👋', 'به سلامت! باز هم ببینمت 😊', 'خداحافظ! هیچ‌وقت لطفت رو یادم نمیره 🙏'],
    fire: ['خداحافظ! برم پیش خانواده‌م، نگرانم هستن 👋', 'به امید دیدار قهرمان! 😊', 'خداحافظ! هر جا رفتی، خدا پشت و پناهت 🙏']
  }
};
const MOODS = { 'خواهش می‌کنم': 'wave', 'تشکر': 'clap', 'هر وقت خواستی بیام': 'clap', 'مرسی': 'wave', 'حالت خوبه؟': 'idle', 'مراقب خودت باش': 'wave', 'خداحافظ': 'wave' };

export class ChatSystem {
  constructor(game) {
    this.g = game; this.friends = []; this.cur = null; this.sample = null; this.busy = false;
    this.bindUI();
    // فقط داخل Claude: امکان نوشتن پیام دلخواه
    try { if (window.claude?.use) window.claude.use('sample').then((s) => { this.sample = s || null; this.refreshInput(); }).catch(() => {}); } catch (e) { /* نسخه APK/HTML */ }
  }
  bindUI() {
    if (ChatSystem.bound) { ChatSystem.inst = this; this.refreshInput(); return; }
    ChatSystem.bound = true; ChatSystem.inst = this;
    const chips = $('chChips');
    chips.innerHTML = SUGGESTED.map((t) => `<button class="chip-msg" data-m="${t}">${t}</button>`).join('');
    chips.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => ChatSystem.inst?.send(b.dataset.m, true)));
    $('chClose').addEventListener('click', () => ChatSystem.inst?.close());
    $('chForm').addEventListener('submit', (e) => { e.preventDefault(); const inp = $('chInput'); const t = inp.value.trim(); if (!t) return; inp.value = ''; ChatSystem.inst?.send(t.slice(0, 300), false); });
    $('chInput').addEventListener('keydown', (e) => e.stopPropagation());
  }
  refreshInput() {
    const on = !!this.sample;
    $('chForm').hidden = !on;
    $('chNote').textContent = on ? 'می‌توانی پیام دلخواهت را هم بنویسی؛ جوابش را Claude در نقش این آدم می‌دهد.' : 'در این نسخه فقط پیام‌های پیشنهادی هست. برای نوشتن پیام دلخواه، بازی را داخل Claude باز کن.';
  }

  addFriend(h, { kind = 'choke', pos, yaw = 0 } = {}) {
    const female = h.opts?.hairStyle === 'long';
    const f = { h, kind, name: pick(female ? NAMES_F : NAMES_M), pos: pos.clone(), yaw, t: 0, life: 170, mood: 'wave', moodT: 2.5, leaving: false, hist: [], greeted: false, talkT: 0 };
    h.root.quaternion.identity(); h.root.position.copy(f.pos); h.root.rotation.set(0, yaw, 0);
    if (!h.root.parent) this.g.scene.add(h.root);
    this.friends.push(f);
    this.g.toast(`${f.name} می‌خواهد با تو حرف بزند 💬 نزدیکش برو`);
    return f;
  }
  prompt() {
    const g = this.g; if (g.state !== 'foot') return null; const p = g.p.pos;
    let best = null, bd = 2.3;
    for (const f of this.friends) { if (f.leaving) continue; const d = Math.hypot(f.pos.x - p.x, f.pos.z - p.z); if (d < bd && Math.abs(f.pos.y - p.y) < 1.2) { bd = d; best = f; } }
    if (!best) return null;
    return { label: `💬 چت با ${best.name}`, pos: best.pos.clone().setY(best.pos.y + 1.6), pri: 3, act: () => this.openChat(best) };
  }
  openChat(f) {
    const g = this.g; this.cur = f; g.state = 'chat'; f.life = Math.max(f.life, 120); g.ach?.unlock('chat');
    $('chName').textContent = f.name; $('cChat').hidden = false; this.refreshInput(); this.render();
    if (!f.greeted) { f.greeted = true; this.reply(f, pick(REPLIES.greet[f.kind]), 'wave', 600); }
  }
  close() {
    const g = this.g; $('cChat').hidden = true; if (g.state === 'chat') g.state = 'foot'; this.cur = null; g.say('');
  }
  render() {
    const f = this.cur; if (!f) return; const log = $('chLog'); log.textContent = '';
    for (const m of f.hist) { const d = document.createElement('div'); d.className = 'ch-msg ' + (m.me ? 'me' : 'them') + (m.typing ? ' typing' : ''); d.textContent = m.text; log.appendChild(d); }
    log.scrollTop = log.scrollHeight;
    $('chChips').querySelectorAll('button').forEach((b) => { b.disabled = this.busy; });
    $('chSend').disabled = this.busy;
  }
  reply(f, text, mood = 'idle', delay = 900) {
    this.busy = true; const tm = { me: false, text: '...', typing: true }; f.hist.push(tm); this.render();
    this.g.timers.push({ t: delay / 1000, fn: () => { tm.text = text; tm.typing = false; this.busy = false; f.mood = mood; f.moodT = 2.4; this.g.say(text, f.h.j.head); this.g.sfx('click'); this.render(); } });
  }
  send(text, suggested) {
    const f = this.cur; if (!f || this.busy) return;
    f.hist.push({ me: true, text }); this.render();
    if (suggested || !this.sample) {
      const r = REPLIES[text] || REPLIES['مرسی'];
      this.reply(f, pick(r[f.kind] || r.choke), MOODS[text] || 'idle', 700 + Math.random() * 700);
      if (text === 'خداحافظ') this.g.timers.push({ t: 3.2, fn: () => { if (this.cur === f) this.close(); this.leave(f); } });
      return;
    }
    this.askClaude(f, text);
  }
  async askClaude(f, text) {
    const ctx = f.kind === 'choke' ? 'غذا در گلویت گیر کرده بود و داشتی خفه می‌شدی؛ قهرمان با مانور هایملیخ نجاتت داد و تو بعدش کلی سرفه کردی.' : 'خانه‌ات آتش گرفته بود و گیر افتاده بودی؛ قهرمان وارد خانه شد، تو را روی شانه‌اش گذاشت و بیرون آورد. خانه‌ات سوخته ولی سالمی.';
    const rules = `تو نقش «${f.name}» را در یک بازی ویدیویی فارسی به اسم «قهرمان پیست» بازی می‌کنی و با قهرمان بازی (بازیکن) چت می‌کنی. چند دقیقه پیش: ${ctx} حالا در شهر کنار قهرمان ایستاده‌ای. طبیعی، گرم و دوستانه جواب بده؛ فارسی محاوره‌ای، کوتاه (حداکثر دو جمله)، می‌توانی یک ایموجی بگذاری. در نقش بمان و از دنیای بازی حرف بزن (شهر، شهربازی، خانه‌ات، ماشین قهرمان، ماموریت‌ها). اگر حرفی نامناسب یا بی‌ربط بود، مودبانه حرف را به بازی برگردان. فقط متن جواب را بنویس.`;
    const turns = [{ role: 'user', content: rules }];
    for (const m of f.hist.slice(-12)) if (!m.typing && m.text) turns.push({ role: m.me ? 'user' : 'assistant', content: m.text });
    if (turns[turns.length - 1].role !== 'user') turns.push({ role: 'user', content: text });
    this.busy = true; const tm = { me: false, text: '...', typing: true }; f.hist.push(tm); this.render();
    try {
      const { text: out } = await this.sample(turns, { modelTier: 'quick', cache: false, onText: ({ text: t }) => { tm.text = t; tm.typing = false; this.render(); } });
      tm.text = out.trim(); tm.typing = false; f.mood = /خداحافظ|به سلامت/.test(out) ? 'wave' : 'idle'; f.moodT = 2.4; this.g.say(tm.text.slice(0, 120), f.h.j.head);
    } catch (e) {
      tm.typing = false;
      if (e && (e.code === 'not_granted' || e.code === 'sampling_disabled' || e.code === 'capability_disabled' || e.code === 'not_declared')) { this.sample = null; this.refreshInput(); tm.text = pick(REPLIES['مرسی'][f.kind]); }
      else tm.text = e?.text || (e?.code === 'rate_limited' ? 'ببخشید، یه کم صبر کن... الان نمی‌تونم زیاد حرف بزنم 😅' : 'ببخشید، نفهمیدم چی گفتی 😅 دوباره بگو؟');
    }
    this.busy = false; this.render();
  }
  leave(f) { if (f.leaving) return; f.leaving = true; f.t = 0; const a = Math.random() * Math.PI * 2; f.dir = new THREE.Vector3(Math.sin(a), 0, Math.cos(a)); }
  update(dt) {
    const g = this.g; const p = g.playerWorldPos(new THREE.Vector3());
    for (let k = this.friends.length - 1; k >= 0; k--) {
      const f = this.friends[k]; f.t += dt; const H = f.h;
      if (!f.leaving) { f.life -= dt; if (f.life <= 0 || f.pos.distanceTo(p) > 90) { if (this.cur === f) this.close(); this.leave(f); } }
      if (f.leaving) {
        f.pos.addScaledVector(f.dir, dt * 1.4); f.pos.y = g.world.groundAt(f.pos.x, f.pos.z); f.yaw = Math.atan2(f.dir.x, f.dir.z);
        g.world.colliders.resolve(f.pos, 0.3, 1, f.pos.y);
        H.root.position.copy(f.pos); H.root.rotation.set(0, f.yaw, 0); H.walk(dt, 1.4);
        if (f.t > 9) { H.root.parent?.remove(H.root); this.friends.splice(k, 1); }
        continue;
      }
      // رو به قهرمان، با حالت‌های شاد و نفس کشیدن
      const d = f.pos.distanceTo(p); const face = d < 12 ? Math.atan2(p.x - f.pos.x, p.z - f.pos.z) : f.yaw;
      f.yaw += wrapAngle(face - f.yaw) * Math.min(1, dt * 3);
      H.root.position.copy(f.pos); H.root.rotation.set(0, f.yaw, 0);
      f.moodT -= dt; const mood = f.moodT > 0 ? f.mood : (this.cur === f ? 'idle' : (Math.sin(f.t * 0.4) > 0.85 ? 'wave' : 'idle'));
      H.anim(mood, f.t);
      if (this.cur === f && f.hist.length && f.hist[f.hist.length - 1].typing) { H.j.head.rotation.x += Math.sin(f.t * 8) * 0.05; }
      H.blend(dt, 10);
      if (this.cur === f) H.lookAtWorld(g.human.j.head.getWorldPosition(new THREE.Vector3()), 1.0);
    }
    if (this.cur && g.state === 'chat') {
      // قهرمان رو به آدم می‌ایستد
      const f = this.cur; const a = Math.atan2(f.pos.x - g.p.pos.x, f.pos.z - g.p.pos.z); g.p.yaw += wrapAngle(a - g.p.yaw) * Math.min(1, dt * 5);
      g.human.root.position.copy(g.p.pos); g.human.root.rotation.set(0, g.p.yaw, 0); g.human.anim('idle', g.t);
      if (f.pos.distanceTo(g.p.pos) > 4) this.close();
    }
  }
  dispose() { for (const f of this.friends) f.h.root.parent?.remove(f.h.root); this.friends.length = 0; this.close(); }
}
