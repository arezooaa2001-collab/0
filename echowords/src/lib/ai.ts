// «معلم هوشمند»: an AI language tutor for a 9-year-old Persian speaker.
//
// Where the answers come from (first available wins):
//   1. Claude, when the app runs as a page inside Claude (claude.ai): no key needed.
//   2. Google Gemini or OpenAI ChatGPT with the family's own API key, saved only on this device.
import { decodeTo16kMono, recognizeSpeech } from './asr';
import { ALL_LANGS, isLangCode, type LangCode } from './langs';
import { nativeHasHttp, nativeHttp } from './native';

export type Provider = 'claude' | 'gemini' | 'openai' | 'custom';

export interface TutorItem {
  text: string;
  lang: LangCode | null;
  meaning: string;
  say: string;
  /** Exact voice for «🔊 تلفظ» (translations into languages outside the app's list). */
  voice?: { tag: string; name: string };
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

const INSTRUCTIONS = `You are «معلم مهربان» (Kind Teacher), a warm, friendly companion inside a learning app for a 9-year-old child whose first language is Persian.
- Talk naturally, like a kind, smart older friend. Answer whatever the child says or asks (questions about the world, science, animals, math, stories, jokes, games, feelings, school, languages…) with a real, helpful answer.
- Answer in the language the child writes in (usually simple, friendly Persian). Keep it short: 1 to 4 sentences unless the child asks for something longer, such as a story.
- Do NOT translate the child's messages and do NOT add English or other translations on your own. Translate only when the child explicitly asks for it (for example: «...» را به «انگلیسی» ترجمه کن, or "how do you say … in …").
- When the child does ask how to say or translate something: give it in that language's own script, and how to pronounce it written in Persian letters.
- Keep everything safe and suitable for a young child. If a request is not suitable, kindly change the subject. Never ask for personal information.
Reply ONLY with JSON, no other text, exactly in this shape:
{"reply": "<your answer>", "items": [{"text": "<word or phrase in the language being taught>", "lang": "<en|fr|zh|ja|hi|fa|other>", "meaning": "<meaning in Persian>", "say": "<pronunciation in Persian letters>"}]}
"items" is [] for normal conversation. Only when the child asked for a translation or a word in another language, list those words or phrases there (1 to 5).
If the child's question is an audio recording, also add "heard": exactly what the child said, in the language they spoke.`;

// ── Settings (kept inside the app only) ───────────────────────────────────
export type KeyProvider = 'gemini' | 'openai' | 'custom';

export interface AiSettings {
  provider: KeyProvider;
  key: string;
  model: string;
  /** Only for 'custom': the address of an OpenAI-compatible service, e.g. https://example.com/v1 */
  baseUrl?: string;
}

const KEY = 'echowords-ai';
export const DEFAULT_MODELS: Record<KeyProvider, string> = { gemini: 'gemini-2.5-flash', openai: 'gpt-4o-mini', custom: 'gpt-4o-mini' };

/** "https://host/v1/" or "https://host/v1/chat/completions" → "https://host/v1" */
export function normalizeBaseUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'https:') return null;
    return (u.origin + u.pathname).replace(/\/+$/, '').replace(/\/chat\/completions$/, '');
  } catch {
    return null;
  }
}

export function readAiSettings(): AiSettings | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (v && ['gemini', 'openai', 'custom'].includes(v.provider) && typeof v.key === 'string' && v.key.trim()) {
      const provider = v.provider as KeyProvider;
      const baseUrl = provider === 'custom' ? normalizeBaseUrl(String(v.baseUrl ?? '')) : null;
      if (provider === 'custom' && !baseUrl) return null;
      // Keys are often pasted with spaces, quotes or a line break around them.
      const key = v.key.replace(/[\s"'‘’“”]/g, '');
      return { provider, key, model: String(v.model || DEFAULT_MODELS[provider]).trim(), ...(baseUrl ? { baseUrl } : {}) };
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
    claudeSample =
      typeof c?.use === 'function'
        ? Promise.race([
            (c.use('sample') as Promise<SampleFn | null>).catch(() => null),
            new Promise<null>((r) => setTimeout(() => r(null), 5000)), // never wait forever for this
          ])
        : Promise.resolve(null);
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

export type AiErrorCode =
  | 'no_provider'
  | 'not_granted'
  | 'bad_key' // the service says the key itself is wrong
  | 'quota' // right key, but no credit / free limit used up / too many requests
  | 'blocked' // the service refuses this country or region
  | 'denied' // right key, but the service refuses this request (see the server's message)
  | 'unreachable' // this internet cannot reach the service at all (filtering, no connection)
  | 'timeout'
  | 'network'
  | 'other';

export class AiError extends Error {
  constructor(public code: AiErrorCode, message: string) {
    super(message);
  }
}

// ── Talking to the AI services ─────────────────────────────────────────────
// ── Step log (shown while waiting, and copied in «📋 کپی گزارش»). Never contains the key. ──
let logStart = 0;
const log: string[] = [];
const listeners = new Set<(line: string) => void>();
export function aiLogReset(): void {
  log.length = 0;
  logStart = performance.now();
}
export function aiLog(line: string): void {
  const s = `+${((performance.now() - logStart) / 1000).toFixed(1)}s ${line}`;
  log.push(s);
  if (log.length > 60) log.shift();
  for (const f of listeners) f(s);
}
export const aiLogLines = (): string[] => [...log];
export function onAiLog(f: (line: string) => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}
const host = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return '?';
  }
};

export interface AskOptions {
  signal?: AbortSignal;
  /** Live voice conversation: very short answers, read aloud. */
  live?: boolean;
}

/** Give up on one request after this long (a stalled connection must never hang the app). */
const timeoutMs = (): number => (globalThis as { __ECHOWORDS_AI_TIMEOUT__?: number }).__ECHOWORDS_AI_TIMEOUT__ ?? 14_000;

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];
const OPENAI_MODELS = ['gpt-4o-mini', 'gpt-4.1-mini', 'gpt-5-mini', 'gpt-4o'];

function instructions(live?: boolean): string {
  return live
    ? `${INSTRUCTIONS}\nThis is a LIVE spoken conversation: answer in at most 2 short, simple sentences, because they are read aloud.`
    : INSTRUCTIONS;
}

interface Req {
  url: string;
  headers: Record<string, string>;
  /** JSON text, or a form (audio upload). */
  body: string | FormData;
}

/**
 * One HTTPS POST with a time limit. In the Android app it is sent by Android itself
 * (no browser cross-site rules, explicit failure reasons); elsewhere by fetch.
 */
async function post(req: Req, signal?: AbortSignal, ms: number = timeoutMs()): Promise<{ status: number; body: string }> {
  if (signal?.aborted) throw new DOMException('cancelled', 'AbortError');
  if (nativeHasHttp()) {
    let bytes: Uint8Array;
    const headers = { ...req.headers };
    if (typeof req.body === 'string') bytes = new TextEncoder().encode(req.body);
    else {
      const packed = new Response(req.body); // lets the browser build the multipart body
      headers['Content-Type'] = packed.headers.get('content-type') ?? 'multipart/form-data';
      bytes = new Uint8Array(await packed.arrayBuffer());
    }
    aiLog(`→ ${host(req.url)} (Android)`);
    const r = await nativeHttp('POST', req.url, headers, bytes, ms, signal);
    if (signal?.aborted) throw new DOMException('cancelled', 'AbortError');
    if (r.ok) {
      aiLog(`← HTTP ${r.status} (${r.body.length} chars)`);
      return { status: r.status, body: r.body };
    }
    aiLog(`✗ Android: ${r.error} ${r.detail ?? ''}`.trim());
    if (r.error === 'timeout') throw new AiError('timeout', r.detail ?? 'timeout');
    // Android could not connect: try once more through the WebView's own network stack.
    if (typeof req.body === 'string') {
      try {
        return await browserPost(req, signal, ms);
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') throw e;
      }
    }
    throw new AiError(r.error === 'dns' || r.error === 'ssl' ? 'unreachable' : 'network', r.detail ?? r.error);
  }
  return browserPost(req, signal, ms);
}

async function browserPost(req: Req, signal?: AbortSignal, ms: number = timeoutMs()): Promise<{ status: number; body: string }> {
  aiLog(`→ ${host(req.url)} (browser)`);
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort);
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, ms);
  try {
    const res = await fetch(req.url, { method: 'POST', headers: req.headers, body: req.body, signal: ctrl.signal });
    const body = await res.text();
    aiLog(`← HTTP ${res.status} (${body.length} chars)`);
    return { status: res.status, body };
  } catch (e) {
    if (signal?.aborted) throw new DOMException('cancelled', 'AbortError');
    aiLog(`✗ browser: ${timedOut ? 'timeout' : String((e as Error)?.message ?? e)}`);
    if (timedOut) throw new AiError('timeout', 'No answer in time');
    throw new AiError('network', String((e as Error)?.message ?? e));
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/** The service's own error message, if the body has one. */
function serverMessage(body: string): string {
  try {
    const j = JSON.parse(body);
    const m = j?.error?.message ?? j?.error?.status ?? j?.message ?? (typeof j?.error === 'string' ? j.error : '');
    if (m) return String(m).replace(/\s+/g, ' ').slice(0, 220);
  } catch {
    /* not JSON (e.g. a block page) */
  }
  return body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 220);
}

/** Turn an error response into the real reason. Returns null when it is not a recognised failure. */
export function classify(status: number, body: string): AiError | null {
  const msg = serverMessage(body);
  const text = `${body.slice(0, 2000)}`;
  const say = (code: AiErrorCode) => new AiError(code, `HTTP ${status}: ${msg}`);
  if (/unsupported_country|country, region, or territory|location is not supported|not available in your (country|region)|banned the country/i.test(text)) return say('blocked');
  if (/invalid_api_key|incorrect api key|api key not valid|API_KEY_INVALID|invalid authentication|no api key|api key not found/i.test(text)) return say('bad_key');
  if (/insufficient_quota|exceeded your current quota|billing|RESOURCE_EXHAUSTED|quota|credit balance|payment required/i.test(text) || status === 402) return say('quota');
  if (status === 429) return say('quota');
  if (status === 401) return say('bad_key');
  if (status === 403) return say('denied');
  return null;
}

interface Attempt {
  model: string;
  /** Settings that some models refuse; switched off automatically when the service says so. */
  flags: { thinkingOff: boolean; jsonMode: boolean; temperature: boolean; legacyMaxTokens: boolean };
}

/**
 * One answer from a provider.
 * - a stall or network error is retried once;
 * - a model name that does not exist (404) moves on to the next one;
 * - a setting the model refuses (400) is switched off and the request repeated.
 */
async function generate(
  st: AiSettings,
  build: (a: Attempt) => Req,
  read: (json: unknown) => string,
  models: string[],
  signal?: AbortSignal,
  ms?: number,
): Promise<string> {
  let last: unknown = new AiError('other', 'no answer');
  for (const model of [...new Set([st.model, ...models])]) {
    const a: Attempt = {
      model,
      flags: { thinkingOff: st.provider === 'gemini' && /flash/i.test(model), jsonMode: true, temperature: true, legacyMaxTokens: true },
    };
    let tries = 0;
    let adapts = 0;
    let missing = false;
    while (tries < 2) {
      tries++;
      try {
        aiLog(`${st.provider} ${model}${tries > 1 ? ' (again)' : ''}`);
        const { status, body } = await post(build(a), signal, ms);
        if (status >= 200 && status < 300) return read(JSON.parse(body));
        aiLog(`  ${serverMessage(body).slice(0, 160)}`);
        if (status === 404 || (status === 400 && /model.*(not found|does not exist|not supported)|unknown model|invalid model/i.test(body))) {
          last = new AiError('other', `HTTP ${status}: model "${model}" not found — ${serverMessage(body)}`);
          missing = true;
          break;
        }
        if (status === 400 && adapts < 4) {
          // The model refuses one of our optional settings: drop it and ask again.
          const f = a.flags;
          let changed = true;
          if (f.thinkingOff && /thinking/i.test(body)) f.thinkingOff = false;
          else if (f.legacyMaxTokens && /max_tokens|max_completion_tokens/i.test(body)) f.legacyMaxTokens = false;
          else if (f.temperature && /temperature/i.test(body)) f.temperature = false;
          else if (f.jsonMode && /response_format|json|responseMimeType/i.test(body)) f.jsonMode = false;
          else changed = false;
          if (changed) {
            adapts++;
            tries--;
            continue;
          }
        }
        const known = classify(status, body);
        if (known && known.code !== 'quota') throw known;
        last = known ?? new AiError('other', `HTTP ${status}: ${serverMessage(body)}`);
        if (status === 429 || status >= 500) continue; // busy: one more try
        throw last;
      } catch (e) {
        if (e instanceof AiError && (e.code === 'network' || (e.code === 'timeout' && !ms))) {
          last = e;
          continue; // one more try
        }
        throw e;
      }
    }
    if (!missing) break;
  }
  throw last;
}

const geminiText = (j: unknown) =>
  ((j as { candidates?: { content?: { parts?: { text?: string }[] } }[] })?.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
const openaiText = (j: unknown) => String((j as { choices?: { message?: { content?: string } }[] })?.choices?.[0]?.message?.content ?? '');

function geminiRequest(st: AiSettings, contents: unknown[], live?: boolean) {
  return ({ model, flags }: Attempt): Req => ({
    url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': st.key },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: instructions(live) }] },
      contents,
      generationConfig: {
        ...(flags.jsonMode ? { responseMimeType: 'application/json' } : {}),
        ...(flags.temperature ? { temperature: 0.4 } : {}),
        maxOutputTokens: live ? 300 : 600,
        // No silent "thinking" first: answers start in about a second.
        ...(flags.thinkingOff ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
      },
    }),
  });
}

/** OpenAI, or any service that speaks the same protocol at `baseUrl`. */
function openaiRequest(st: AiSettings, messages: unknown[], live?: boolean) {
  const base = st.provider === 'custom' && st.baseUrl ? st.baseUrl : 'https://api.openai.com/v1';
  return ({ model, flags }: Attempt): Req => ({
    url: `${base}/chat/completions`,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${st.key}` },
    body: JSON.stringify({
      model,
      messages,
      ...(flags.jsonMode ? { response_format: { type: 'json_object' } } : {}),
      ...(flags.temperature ? { temperature: 0.4 } : {}),
      ...(flags.legacyMaxTokens ? { max_tokens: live ? 300 : 600 } : { max_completion_tokens: live ? 1200 : 2000 }),
    }),
  });
}

// ── Ask the tutor ─────────────────────────────────────────────────────────
/** `history` ends with the child's latest message; `image` is an optional photo to read. */
export async function askTutor(history: ChatTurn[], image?: Blob | null, signalOrOpts?: AbortSignal | AskOptions): Promise<TutorReply> {
  const opts: AskOptions = signalOrOpts instanceof AbortSignal ? { signal: signalOrOpts } : (signalOrOpts ?? {});
  const claude = await getClaude();
  if (claude) {
    const input = `${instructions(opts.live)}\n\nConversation so far:\n${transcript(history)}\n\n${
      image ? 'The child also sent the attached picture.\n' : ''
    }Now write the Teacher's next answer as the JSON object.`;
    try {
      const out = await Promise.race([
        claude(input, { modelTier: 'quick', cache: false, ...(image ? { images: [image] } : {}), ...(opts.signal ? { signal: opts.signal } : {}) }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new AiError('timeout', 'No answer in time')), timeoutMs() * 2)),
      ]);
      return parseTutorReply(out.text);
    } catch (e) {
      if (e instanceof AiError) throw e;
      const code = (e as { code?: string })?.code;
      throw new AiError(code === 'not_granted' ? 'not_granted' : 'other', String((e as Error)?.message ?? e));
    }
  }

  const st = readAiSettings();
  if (!st) throw new AiError('no_provider', 'No AI configured');
  const imageB64 = image ? await blobToBase64(image) : null;
  const recent = history.slice(-10);
  if (st.provider === 'gemini') {
    const contents = recent.map((h, i) => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [
        { text: h.text },
        ...(image && imageB64 && i === recent.length - 1 ? [{ inline_data: { mime_type: image.type || 'image/jpeg', data: imageB64 } }] : []),
      ],
    }));
    return parseTutorReply(await generate(st, geminiRequest(st, contents, opts.live), geminiText, GEMINI_MODELS, opts.signal));
  }
  const messages: unknown[] = [{ role: 'system', content: instructions(opts.live) }];
  for (const [i, h] of recent.entries()) {
    if (image && i === recent.length - 1 && h.role === 'user') {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: h.text },
          { type: 'image_url', image_url: { url: `data:${image.type || 'image/jpeg'};base64,${imageB64}` } },
        ],
      });
    } else messages.push({ role: h.role, content: h.text });
  }
  // A custom service has its own model names: do not guess others for it.
  const text = await generate(st, openaiRequest(st, messages, opts.live), openaiText, st.provider === 'openai' ? OPENAI_MODELS : [], opts.signal);
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
export async function askTutorByVoice(history: ChatTurn[], audio: Blob, opts: AskOptions = {}, image: Blob | null = null): Promise<TutorReply> {
  const st = (await getClaude()) ? null : readAiSettings();
  if (!st || st.provider === 'custom') {
    // Claude, a custom service, or nothing configured: understand the speech on this device, then ask with text.
    const heard = (await recognizeSpeech(audio, 'auto', ALL_LANGS)).trim();
    if (!heard) throw new AiError('other', 'nothing heard');
    const r = await askTutor([...history, { role: 'user', text: heard }], image, opts);
    return { ...r, heard };
  }
  const wav = await toWav(audio);
  if (st.provider === 'openai') {
    const form = new FormData();
    form.append('file', new File([wav], 'question.wav', { type: 'audio/wav' }));
    form.append('model', 'whisper-1');
    const { status, body } = await post({ url: 'https://api.openai.com/v1/audio/transcriptions', headers: { Authorization: `Bearer ${st.key}` }, body: form }, opts.signal);
    if (status < 200 || status >= 300) throw classify(status, body) ?? new AiError('other', `HTTP ${status}: ${serverMessage(body)}`);
    const heard = String(JSON.parse(body)?.text ?? '').trim();
    if (!heard) throw new AiError('other', 'nothing heard');
    const r = await askTutor([...history, { role: 'user', text: heard }], image, opts);
    return { ...r, heard };
  }
  // Gemini: send the audio with the question; it understands the speech itself.
  const contents = [
    ...history.slice(-9).map((h) => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.text }] })),
    {
      role: 'user',
      parts: [
        { text: image ? 'The child asked this by voice (audio attached) while showing the camera picture.' : 'The child asked this by voice (audio attached).' },
        { inline_data: { mime_type: 'audio/wav', data: await blobToBase64(wav) } },
        ...(image ? [{ inline_data: { mime_type: image.type || 'image/jpeg', data: await blobToBase64(image) } }] : []),
      ],
    },
  ];
  return parseTutorReply(await generate(st, geminiRequest(st, contents, opts.live), geminiText, GEMINI_MODELS, opts.signal));
}

/** Settings «امتحان اتصال»: one tiny question, with how long it took. */
export async function testConnection(): Promise<{ ok: true; ms: number; provider: Provider } | { ok: false; error: AiError | Error }> {
  const started = performance.now();
  try {
    const provider = (await currentProvider()) ?? 'gemini';
    await askTutor([{ role: 'user', text: 'سلام' }], null, { live: true });
    return { ok: true, ms: Math.round(performance.now() - started), provider };
  } catch (e) {
    return { ok: false, error: e as Error };
  }
}

// ── Long free-form answers (the game studio) ───────────────────────────────
export interface RawOptions {
  signal?: AbortSignal;
  /** 'complex' = take time to think (code); 'quick' = answer at once. */
  tier: 'quick' | 'complex';
  maxTokens: number;
  /** Limit for one request. */
  timeoutMs: number;
  /** Characters received so far (Claude streams; other services report once at the end). */
  onProgress?: (chars: number) => void;
}

/** One free-form answer (not JSON): `system` instructions plus a conversation ending with the user. */
export async function askRaw(system: string, turns: ChatTurn[], opts: RawOptions): Promise<{ text: string; truncated: boolean }> {
  const claude = await getClaude();
  if (claude) {
    aiLog(`claude ${opts.tier}`);
    const input = [
      { role: 'user' as const, content: `${system}\n\n---\n\n${turns[0]?.text ?? ''}` },
      ...turns.slice(1).map((t) => ({ role: t.role, content: t.text })),
    ];
    try {
      const out = (await claude(input, {
        modelTier: opts.tier === 'complex' ? 'complex' : 'quick',
        cache: false,
        onText: ({ text }: { text: string }) => opts.onProgress?.(text.length),
        ...(opts.signal ? { signal: opts.signal } : {}),
      })) as { text: string; truncated?: boolean };
      return { text: out.text, truncated: !!out.truncated };
    } catch (e) {
      if (e instanceof AiError) throw e;
      if ((e as Error)?.name === 'AbortError') throw e;
      const code = (e as { code?: string })?.code;
      throw new AiError(code === 'not_granted' ? 'not_granted' : 'other', String((e as Error)?.message ?? e));
    }
  }
  const st = readAiSettings();
  if (!st) throw new AiError('no_provider', 'No AI configured');
  let truncated = false;
  if (st.provider === 'gemini') {
    const build = ({ model, flags }: Attempt): Req => ({
      url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': st.key },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: turns.map((t) => ({ role: t.role === 'user' ? 'user' : 'model', parts: [{ text: t.text }] })),
        generationConfig: {
          ...(flags.temperature ? { temperature: 0.7 } : {}),
          maxOutputTokens: opts.maxTokens,
          ...(opts.tier === 'quick' && flags.thinkingOff ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      }),
    });
    const read = (j: unknown) => {
      const c = (j as { candidates?: { finishReason?: string }[] })?.candidates?.[0];
      truncated = c?.finishReason === 'MAX_TOKENS';
      return geminiText(j);
    };
    const text = await generate({ ...st }, build, read, GEMINI_MODELS, opts.signal, opts.timeoutMs);
    opts.onProgress?.(text.length);
    return { text, truncated };
  }
  const base = st.provider === 'custom' && st.baseUrl ? st.baseUrl : 'https://api.openai.com/v1';
  const build = ({ model, flags }: Attempt): Req => ({
    url: `${base}/chat/completions`,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${st.key}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: system }, ...turns.map((t) => ({ role: t.role, content: t.text }))],
      ...(flags.temperature ? { temperature: 0.7 } : {}),
      ...(flags.legacyMaxTokens ? { max_tokens: opts.maxTokens } : { max_completion_tokens: opts.maxTokens }),
    }),
  });
  const read = (j: unknown) => {
    truncated = (j as { choices?: { finish_reason?: string }[] })?.choices?.[0]?.finish_reason === 'length';
    return openaiText(j);
  };
  const text = await generate({ ...st }, build, read, st.provider === 'custom' ? [] : OPENAI_MODELS, opts.signal, opts.timeoutMs);
  opts.onProgress?.(text.length);
  return { text, truncated };
}
