import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiError, askRaw, askTutor } from '../lib/ai';

const message = (text: string, extra: Record<string, unknown> = {}) => ({
  id: 'msg_1',
  type: 'message',
  role: 'assistant',
  model: 'claude-opus-5-5',
  content: [{ type: 'text', text }],
  stop_reason: 'end_turn',
  stop_sequence: null,
  usage: { input_tokens: 10, output_tokens: 5 },
  ...extra,
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const sse = (events: Record<string, unknown>[]) =>
  new Response(events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join(''), { status: 200, headers: { 'content-type': 'text/event-stream' } });

interface Sent {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}
let sent: Sent[] = [];
const record = (input: unknown, init?: RequestInit) => {
  const headers: Record<string, string> = {};
  new Headers(init?.headers).forEach((v, k) => (headers[k] = v));
  sent.push({ url: String(input instanceof Request ? input.url : input), headers, body: JSON.parse(String(init?.body ?? '{}')) });
};

beforeEach(() => {
  sent = [];
  localStorage.setItem('echowords-ai', JSON.stringify({ provider: 'anthropic', key: 'sk-ant-test', model: 'claude-opus-5-5' }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  delete (window as unknown as { EchoWordsAndroid?: unknown }).EchoWordsAndroid;
});

describe('Claude through the Claude API (the family key, no claude.ai page)', () => {
  it('asks Claude Opus 5.5 with the key, the tutor instructions, low effort and server-side fallbacks', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: unknown, init?: RequestInit) => {
      record(input, init);
      return json(message('{"reply":"سلام! خوبی؟ 😊","items":[]}'));
    }));
    const r = await askTutor([{ role: 'user', text: 'سلام' }]);
    expect(r.reply).toBe('سلام! خوبی؟ 😊');
    const s = sent[0];
    expect(s.url).toMatch(/^https:\/\/api\.anthropic\.com\/v1\/messages/);
    expect(s.headers.authorization).toBe('Bearer sk-ant-test');
    expect(s.headers['anthropic-version']).toBeTruthy();
    expect(s.headers['anthropic-beta']).toContain('server-side-fallback-2026-07-01');
    expect(s.body.model).toBe('claude-opus-5-5');
    expect(s.body.fallbacks).toBe('default');
    expect(s.body.output_config).toEqual({ effort: 'low' });
    expect(String(s.body.system)).toMatch(/Kind Teacher/);
    expect(s.body.messages).toEqual([{ role: 'user', content: 'سلام' }]);
  });

  it('a safety decline is reported (never an empty answer)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(message('', { content: [], stop_reason: 'refusal', stop_details: { type: 'refusal', category: null, explanation: '' } }))));
    await expect(askTutor([{ role: 'user', text: 'x' }])).rejects.toMatchObject({ code: 'refused' });
  });

  it('a wrong key is reported as a wrong key', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }, 401)));
    const e = await askTutor([{ role: 'user', text: 'x' }]).catch((x) => x);
    expect(e).toBeInstanceOf(AiError);
    expect(e.code).toBe('bad_key');
  });

  it('no credit is reported as quota', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ type: 'error', error: { type: 'invalid_request_error', message: 'Your credit balance is too low to access the Anthropic API.' } }, 400)));
    await expect(askTutor([{ role: 'user', text: 'x' }])).rejects.toMatchObject({ code: 'quota' });
  });

  it('a model that refuses server-side fallbacks gets the request again without them', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: unknown, init?: RequestInit) => {
      record(input, init);
      return sent.length === 1
        ? json({ type: 'error', error: { type: 'invalid_request_error', message: 'fallbacks: not supported for this model' } }, 400)
        : json(message('{"reply":"ok","items":[]}'));
    }));
    localStorage.setItem('echowords-ai', JSON.stringify({ provider: 'anthropic', key: 'sk-ant-test', model: 'claude-haiku-5-5' }));
    expect((await askTutor([{ role: 'user', text: 'x' }])).reply).toBe('ok');
    expect(sent).toHaveLength(2);
    expect(sent[1].body.fallbacks).toBeUndefined();
    expect(sent[1].body.model).toBe('claude-haiku-5-5');
  });

  it('Android app: if the WebView cannot connect, Android\'s own HTTPS is used', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }));
    const calls: { url: string; headers: Record<string, string> }[] = [];
    (window as unknown as { EchoWordsAndroid: unknown }).EchoWordsAndroid = {
      httpRequest: (id: string, _m: string, url: string, headersJson: string) => {
        calls.push({ url, headers: JSON.parse(headersJson) });
        setTimeout(() => (window as unknown as { __ewNative: { done: (i: string, j: string) => void } }).__ewNative.done(id, JSON.stringify({ ok: true, status: 200, body: JSON.stringify(message('{"reply":"از راه اندروید","items":[]}')) })), 5);
      },
    };
    expect((await askTutor([{ role: 'user', text: 'x' }])).reply).toBe('از راه اندروید');
    expect(calls[0].url).toMatch(/api\.anthropic\.com\/v1\/messages/);
    expect(calls[0].headers.authorization).toBe('Bearer sk-ant-test');
  });

  it('games: the answer is streamed (progress shown) with high effort and a large output limit', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: unknown, init?: RequestInit) => {
      record(input, init);
      const m = message('', { content: [], stop_reason: null, usage: { input_tokens: 10, output_tokens: 0 } });
      return sse([
        { type: 'message_start', message: m },
        { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '<!DOCTYPE html><html>' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '<body>game</body></html>' } },
        { type: 'content_block_stop', index: 0 },
        { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 20 } },
        { type: 'message_stop' },
      ]);
    }));
    const progress: number[] = [];
    const r = await askRaw('Build games.', [{ role: 'user', text: 'a game' }], { tier: 'complex', maxTokens: 32000, timeoutMs: 60000, onProgress: (n) => progress.push(n) });
    expect(r).toEqual({ text: '<!DOCTYPE html><html><body>game</body></html>', truncated: false });
    expect(progress.length).toBeGreaterThanOrEqual(2);
    expect(sent[0].body.stream).toBe(true);
    expect(sent[0].body.max_tokens).toBe(64000);
    expect(sent[0].body.output_config).toEqual({ effort: 'high' });
    expect(sent[0].body.system).toBe('Build games.');
  });
});
