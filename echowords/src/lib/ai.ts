// «معلم هوشمند»: an AI language tutor for a 9-year-old Persian speaker.
//
// Where the answers come from (first available wins):
//   1. Claude, when the app runs as a page inside Claude (claude.ai): no key needed.
//   2. Google Gemini or OpenAI ChatGPT with the family's own API key, saved only on this device.
import { decodeTo16kMono, recognizeSpeech } from './asr';
import { ALL_LANGS, isLangCode, type LangCode } from './langs';

export type Provider = 'claude' | 'gemini' | 'openai';

export interface TutorItem {
  text: string;
  lang: LangCode | null;
  meaning: string;
  say: string;
}

export interface TutorReply {
  reply: string;
  items: TutorItem[];
  /** For a spoken question: what the child said (as understood). */
  heard?: string;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

const INSTRUCTIONS = `You are «معلم مهربان» (Kind Teacher), a warm, patient language tutor inside a learning app for a 9-year-old child whose first language is Persian.
- Always answer in simple, friendly Persian: 2 to 4 short sentences.
- The child mainly learns English (American and British) and may ask about French, Chinese, Japanese, Hindi or any other language.
- When asked how to say something in a language: give it in that language's own script, how to pronounce it written in Persian letters, and a tiny example if it helps.
- When given a picture: read the words in it, say which language they are, and translate them into Persian (and into English when they are not English).
- Keep everything safe and suitable for a young child. If a request is not suitable, kindly steer back to learning languages. Never ask for personal information.
Reply ONLY with JSON, no other text, exactly in this shape:
{"reply": "<Persian answer; foreign words in their own script>", "items": [{"text": "<word or short phrase in the language being taught>", "lang": "<en|fr|zh|ja|hi|fa|other>", "meaning": "<meaning in Persian>", "say": "<pronunciation in Persian letters>"}]}
"items" lists the foreign words or phrases you taught in this answer (0 to 5).
If the child's question is an audio recording, also add "heard": exactly what the child said, in the language they spoke.`;

// ── Settings (device only) ────────────────────────────────────────────────
export interface AiSettings {
  provider: 'gemini' | 'openai';
  key: string;
  model: string;
}

const KEY = 'echowords-ai';
export const DEFAULT_MODELS = { gemini: 'gemini-2.5-flash', openai: 'gpt-4o-mini' } as const;

export function readAiSettings(): AiSettings | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (v && (v.provider === 'gemini' || v.provider === 'openai') && typeof v.key === 'string' && v.key.trim()) {
      return { provider: v.provider, key: v.key.trim(), model: (v.model || DEFAULT_MODELS[v.provider as 'gemini' | 'openai']).trim() };
    }
  } catch {
    /* storage blocked */
  }
  return null;
}

export function saveAiSettings(s: AiSettings | null): void {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

// ── Claude inside claude.ai ───────────────────────────────────────────────
type SampleFn = ((input: unknown, opts?: Record<string, unknown>) => Promise<{ text: string }>) & {
  limits?: () => Promise<{ images?: unknown }>;
};

let claudeSample: Promise<SampleFn | null> | null = null;

/** The Claude «sample» capability, or null when this page is not running inside Claude. */
export function getClaude(): Promise<SampleFn | null> {
  if (!claudeSample) {
    const c = (window as unknown as { claude?: { use?: (n: string) => Promise<unknown> } }).claude;
    claudeSample = typeof c?.use === 'function' ? (c.use('sample') as Promise<SampleFn | null>).catch(() => null) : Promise.resolve(null);
  }
  return claudeSample;
}

export async function currentProvider(): Promise<Provider | null> {
  if (await getClaude()) return 'claude';
  return readAiSettings()?.provider ?? null;
}

// ── Helpers ───────────────────────────────────────────────────────────────
/** Pull the JSON object out of a model's answer (tolerates code fences or extra words). */
export function parseTutorReply(raw: string): TutorReply {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try {
      const j = JSON.parse(raw.slice(start, end + 1));
      const items: TutorItem[] = Array.isArray(j.items)
        ? j.items
            .filter((x: unknown) => x && typeof (x as TutorItem).text === 'string' && (x as TutorItem).text.trim())
            .slice(0, 5)
            .map((x: Record<string, unknown>) => ({
              text: String(x.text).trim().slice(0, 120),
              lang: isLangCode(x.lang) ? x.lang : null,
              meaning: typeof x.meaning === 'string' ? x.meaning.trim().slice(0, 120) : '',
              say: typeof x.say === 'string' ? x.say.trim().slice(0, 120) : '',
            }))
        : [];
      if (typeof j.reply === 'string' && j.reply.trim())
        return { reply: j.reply.trim(), items, ...(typeof j.heard === 'string' && j.heard.trim() ? { heard: j.heard.trim().slice(0, 300) } : {}) };
    } catch {
      /* fall through */
    }
  }
  return { reply: raw.trim() || '…', items: [] };
}

function transcript(history: ChatTurn[]): string {
  return history
    .slice(-10)
    .map((h) => `${h.role === 'user' ? 'Child' : 'Teacher'}: ${h.text}`)
    .join('\n');
}

async function blobToBase64(b: Blob): Promise<string> {
  const buf = new Uint8Array(await b.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

export class AiError extends Error {
  constructor(public code: 'no_provider' | 'not_granted' | 'bad_key' | 'network' | 'blocked' | 'other', message: string) {
    super(message);
  }
}

// ── Ask the tutor ─────────────────────────────────────────────────────────
/** `history` ends with the child's latest message; `image` is an optional photo to read. */
export async function askTutor(history: ChatTurn[], image?: Blob | null, signal?: AbortSignal): Promise<TutorReply> {
  const claude = await getClaude();
  if (claude) {
    const input = `${INSTRUCTIONS}\n\nConversation so far:\n${transcript(history)}\n\n${
      image ? 'The child also sent the attached picture.\n' : ''
    }Now write the Teacher's next answer as the JSON object.`;
    try {
      const out = await claude(input, { modelTier: 'quick', cache: false, ...(image ? { images: [image] } : {}), ...(signal ? { signal } : {}) });
      return parseTutorReply(out.text);
    } catch (e) {
      const code = (e as { code?: string })?.code;
      throw new AiError(code === 'not_granted' ? 'not_granted' : 'other', String((e as Error)?.message ?? e));
    }
  }

  const st = readAiSettings();
  if (!st) throw new AiError('no_provider', 'No AI configured');
  let res: Response;
  try {
    const imageB64 = image ? await blobToBase64(image) : null;
    if (st.provider === 'gemini') {
      const contents = history.slice(-10).map((h, i, arr) => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [
          { text: h.text },
          ...(image && imageB64 && i === arr.length - 1 ? [{ inline_data: { mime_type: image.type || 'image/jpeg', data: imageB64 } }] : []),
        ],
      }));
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(st.model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': st.key },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: INSTRUCTIONS }] },
          contents,
          generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
        }),
        signal,
      });
    } else {
      const messages: unknown[] = [{ role: 'system', content: INSTRUCTIONS }];
      const recent = history.slice(-10);
      for (const [i, h] of recent.entries()) {
        const last = i === recent.length - 1;
        if (image && last && h.role === 'user') {
          messages.push({
            role: 'user',
            content: [
              { type: 'text', text: h.text },
              { type: 'image_url', image_url: { url: `data:${image.type || 'image/jpeg'};base64,${imageB64}` } },
            ],
          });
        } else messages.push({ role: h.role, content: h.text });
      }
      res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${st.key}` },
        body: JSON.stringify({ model: st.model, messages, response_format: { type: 'json_object' }, temperature: 0.4 }),
        signal,
      });
    }
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw e;
    throw new AiError('network', String((e as Error)?.message ?? e));
  }
  const body = await res.text();
  if (res.status === 401 || res.status === 403) throw new AiError(/location|region|country|unsupported_country/i.test(body) ? 'blocked' : 'bad_key', body.slice(0, 300));
  if (res.status === 400 && /API key/i.test(body)) throw new AiError('bad_key', body.slice(0, 300));
  if (res.status === 400 && /location|region|country/i.test(body)) throw new AiError('blocked', body.slice(0, 300));
  if (!res.ok) throw new AiError('other', `HTTP ${res.status}: ${body.slice(0, 300)}`);
  const j = JSON.parse(body);
  const text: string =
    st.provider === 'gemini'
      ? (j?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('')
      : (j?.choices?.[0]?.message?.content ?? '');
  return parseTutorReply(text);
}

/** Shrink a photo before sending it (keeps it fast and small). */
export async function shrinkImage(src: Blob, maxSide = 1024): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(src);
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b ?? src), 'image/jpeg', 0.85));
  } catch {
    return src;
  }
}

// ── Spoken questions (when the phone's speech recognition is not available) ──

/** 16 kHz mono 16-bit WAV: a format every AI service accepts. */
export async function toWav(audio: Blob): Promise<Blob> {
  const samples = await decodeTo16kMono(audio);
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o: number, x: string) => [...x].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + samples.length * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, 16000, true);
  v.setUint32(28, 32000, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i])) * 0x7fff, true);
  return new Blob([buf], { type: 'audio/wav' });
}

/**
 * Ask with a voice recording. Gemini listens to the audio itself; ChatGPT uses OpenAI's
 * speech-to-text first; Claude uses the on-device recogniser first.
 */
export async function askTutorByVoice(history: ChatTurn[], audio: Blob): Promise<TutorReply> {
  const st = (await getClaude()) ? null : readAiSettings();
  if (!st) {
    // Claude (or nothing configured): understand the speech on this device, then ask with text.
    const heard = (await recognizeSpeech(audio, 'auto', ALL_LANGS)).trim();
    if (!heard) throw new AiError('other', 'nothing heard');
    const r = await askTutor([...history, { role: 'user', text: heard }]);
    return { ...r, heard };
  }
  const wav = await toWav(audio);
  if (st.provider === 'openai') {
    const form = new FormData();
    form.append('file', new File([wav], 'question.wav', { type: 'audio/wav' }));
    form.append('model', 'whisper-1');
    let res: Response;
    try {
      res = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${st.key}` }, body: form });
    } catch (e) {
      throw new AiError('network', String((e as Error)?.message ?? e));
    }
    if (res.status === 401) throw new AiError('bad_key', await res.text());
    if (!res.ok) throw new AiError('other', `HTTP ${res.status}`);
    const heard = String((await res.json())?.text ?? '').trim();
    if (!heard) throw new AiError('other', 'nothing heard');
    const r = await askTutor([...history, { role: 'user', text: heard }]);
    return { ...r, heard };
  }
  // Gemini: send the audio with the question.
  const b64 = await blobToBase64(wav);
  const contents = [
    ...history.slice(-9).map((h) => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.text }] })),
    { role: 'user', parts: [{ text: 'The child asked this by voice (audio attached).' }, { inline_data: { mime_type: 'audio/wav', data: b64 } }] },
  ];
  let res: Response;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(st.model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': st.key },
      body: JSON.stringify({ system_instruction: { parts: [{ text: INSTRUCTIONS }] }, contents, generationConfig: { responseMimeType: 'application/json', temperature: 0.4 } }),
    });
  } catch (e) {
    throw new AiError('network', String((e as Error)?.message ?? e));
  }
  const body = await res.text();
  if (res.status === 401 || res.status === 403 || (res.status === 400 && /API key/i.test(body))) throw new AiError(/location|region|country/i.test(body) ? 'blocked' : 'bad_key', body.slice(0, 300));
  if (!res.ok) throw new AiError(/location|region|country/i.test(body) ? 'blocked' : 'other', body.slice(0, 300));
  const j = JSON.parse(body);
  return parseTutorReply((j?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join(''));
}
