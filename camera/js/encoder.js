// MP4 writer built on WebCodecs + mp4-muxer (vendor/mp4-muxer.js).
// Used by the fast (time-lapse) and slow-motion modes, where every frame needs its own
// timestamp — something MediaRecorder cannot do.

const AVC_CODECS = ['avc1.640034', 'avc1.640033', 'avc1.64002a', 'avc1.640028', 'avc1.4d0034', 'avc1.4d0028', 'avc1.42e034', 'avc1.42e028', 'avc1.42e01f'];
const VP9_CODECS = ['vp09.00.51.08', 'vp09.00.41.08', 'vp09.00.31.08'];

export function webCodecsSupported() {
  return typeof window.VideoEncoder === 'function'
    && typeof window.VideoFrame === 'function'
    && typeof window.Mp4Muxer === 'object';
}

async function findConfig(width, height, fps, bitrate) {
  const candidates = [...AVC_CODECS.map((c) => ['avc', c]), ...VP9_CODECS.map((c) => ['vp9', c])];
  for (const [kind, codec] of candidates) {
    const config = { codec, width, height, bitrate: Math.round(bitrate), framerate: fps };
    if (kind === 'avc') config.avc = { format: 'avc' };
    try {
      const res = await VideoEncoder.isConfigSupported(config);
      if (res && res.supported) return { kind, config };
    } catch {
      /* try the next codec */
    }
  }
  return null;
}

function even(n) { return Math.max(2, Math.floor(n / 2) * 2); }

// Returns a writer for the largest size (<= requested) that this device can encode.
export async function createMp4Writer({ width, height, fps = 30, bitrate }) {
  if (!webCodecsSupported()) throw new Error('webcodecs-unsupported');
  const sizes = [[width, height]];
  for (const maxSide of [2560, 1920, 1280]) {
    const s = maxSide / Math.max(width, height);
    if (s < 1) sizes.push([even(width * s), even(height * s)]);
  }
  for (const [w, h] of sizes) {
    const found = await findConfig(w, h, fps, bitrate * (w * h) / (width * height));
    if (found) return new Mp4Writer(found, w, h);
  }
  throw new Error('codec-unsupported');
}

class Mp4Writer {
  constructor({ kind, config }, width, height) {
    this.width = width;
    this.height = height;
    this.count = 0;
    this.dropped = 0;
    this.lastKey = -Infinity;
    this.lastTs = -1;
    this.error = null;
    const { Muxer, ArrayBufferTarget } = window.Mp4Muxer;
    this.muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: { codec: kind, width, height },
      fastStart: 'in-memory',
      firstTimestampBehavior: 'offset',
    });
    this.encoder = new VideoEncoder({
      output: (chunk, meta) => {
        try { this.muxer.addVideoChunk(chunk, meta); } catch (err) { this.error = err; }
      },
      error: (err) => { this.error = err; },
    });
    this.encoder.configure(config);
  }

  get busy() {
    return this.encoder.state !== 'configured' || this.encoder.encodeQueueSize > 4;
  }

  // Encodes the current content of `source` (a canvas). Returns false when the frame was skipped.
  addFrame(source, timestampUs, durationUs) {
    if (this.error) throw this.error;
    const ts = Math.round(timestampUs);
    if (ts <= this.lastTs) return false;
    if (this.busy) { this.dropped++; return false; }
    let src = source;
    if (source.width !== this.width || source.height !== this.height) {
      if (!this.scaler) {
        this.scaler = document.createElement('canvas');
        this.scaler.width = this.width;
        this.scaler.height = this.height;
        this.scalerCtx = this.scaler.getContext('2d', { alpha: false });
        this.scalerCtx.imageSmoothingQuality = 'high';
      }
      this.scalerCtx.drawImage(source, 0, 0, this.width, this.height);
      src = this.scaler;
    }
    const frame = new VideoFrame(src, { timestamp: ts, duration: Math.round(durationUs) });
    const keyFrame = this.count === 0 || ts - this.lastKey >= 2e6;
    if (keyFrame) this.lastKey = ts;
    try {
      this.encoder.encode(frame, { keyFrame });
    } finally {
      frame.close();
    }
    this.lastTs = ts;
    this.count++;
    return true;
  }

  async finish() {
    if (this.count === 0) { this.abort(); throw new Error('no-frames'); }
    await this.encoder.flush();
    if (this.error) throw this.error;
    this.encoder.close();
    this.muxer.finalize();
    return new Blob([this.muxer.target.buffer], { type: 'video/mp4' });
  }

  abort() {
    try { if (this.encoder.state !== 'closed') this.encoder.close(); } catch { /* already closed */ }
  }
}
