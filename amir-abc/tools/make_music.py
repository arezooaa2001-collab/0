#!/usr/bin/env python3
"""Render "Night Drive", the AMIR ABC theme: an original 32-bar synthwave loop.

Everything is synthesised here (no samples), so the track is ours to ship.
The loop is seamless: reverb and delay tails that run past the last bar are
folded back onto the first bar.

Usage:  python3 make_music.py <out_dir>
Writes <out_dir>/music.mp3 (needs ffmpeg on PATH).
"""
import os
import subprocess
import sys
import tempfile
import wave

import numpy as np
import scipy.ndimage as nd
import scipy.signal as sg

SR = 44100
BPM = 100
BEAT = 60.0 / BPM
BAR = 4 * BEAT
STEP = BEAT / 4  # a 16th note
BARS = 32
LEN = int(round(BARS * BAR * SR))  # 76.8 s
TAIL = int(6 * SR)
N = LEN + TAIL
rng = np.random.default_rng(20261123)


# ----------------------------------------------------------------- helpers
def mtof(m):
    return 440.0 * 2.0 ** ((m - 69) / 12.0)


def stereo():
    return np.zeros((2, N))


def place(dst, sig, t0, pan=0.0, gain=1.0):
    """Add a mono (equal-power panned) or stereo signal into dst at time t0."""
    i = int(round(t0 * SR))
    if i >= N:
        return
    if sig.ndim == 1:
        a = (pan + 1) * np.pi / 4
        sig = np.vstack([sig * np.cos(a), sig * np.sin(a)]) * np.sqrt(2)
    n = min(sig.shape[1], N - i)
    dst[:, i:i + n] += gain * sig[:, :n]


def lp(fc, order=2):
    return sg.butter(order, min(fc, SR * 0.45), "low", fs=SR, output="sos")


def hp(fc, order=2):
    return sg.butter(order, fc, "high", fs=SR, output="sos")


def bp(lo, hi, order=2):
    return sg.butter(order, [lo, min(hi, SR * 0.45)], "band", fs=SR, output="sos")


def env(n, dur, a, d, s, r):
    """ADSR. dur = gate length (s); release r (s) starts at dur."""
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-5), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-5)))
    gate = min(int(dur * SR), n - 1)
    held = e[gate]
    rel = t >= dur
    e[rel] = held * np.exp(-(t[rel] - dur) / max(r / 5, 1e-5))
    fade = min(256, n)
    e[-fade:] *= np.linspace(1, 0, fade)
    return e


def blep_saw(freq, n, phase0=None):
    f = np.broadcast_to(np.asarray(freq, dtype=float), (n,))
    dt = f / SR
    p0 = rng.random() if phase0 is None else phase0
    ph = (p0 + np.cumsum(dt) - dt[0]) % 1.0
    y = 2 * ph - 1
    m = ph < dt
    x = ph[m] / dt[m]
    y[m] -= 2 * x - x * x - 1
    m = ph > 1 - dt
    x = (ph[m] - 1) / dt[m]
    y[m] -= x * x + 2 * x + 1
    return y


def blep_square(freq, n):
    p = rng.random()
    return 0.5 * (blep_saw(freq, n, p) - blep_saw(freq, n, (p + 0.5) % 1.0))


def additive(f, n, d0, dk, odd=False, maxh=48):
    """Band-limited saw/square whose upper harmonics die faster (a 'filter sweep')."""
    t = np.arange(n) / SR
    out = np.zeros(n)
    kmax = int(min(maxh, (SR * 0.45) / f))
    w = 2 * np.pi * f * t + rng.random() * 2 * np.pi
    for k in range(1, kmax + 1, 2 if odd else 1):
        out += np.exp(-t * (d0 + dk * (k - 1))) * np.sin(k * w) / k
    return out


# ------------------------------------------------------------- the score
CHORD = {"Am": [57, 60, 64, 71], "F": [53, 60, 64, 69], "C": [55, 60, 64, 67],
         "G": [55, 59, 62, 69], "E": [56, 59, 64, 68]}
ROOT = {"Am": 45, "F": 41, "C": 48, "G": 43, "E": 40}
ARP = {"Am": [69, 72, 76, 81], "F": [65, 69, 72, 77], "C": [67, 72, 76, 79],
       "G": [67, 71, 74, 79], "E": [68, 71, 76, 80]}
# 16 chords x 2 bars: intro (0-7), main x2 (8-23), break + build (24-31)
PROG = ["Am", "F", "C", "G"] * 3 + ["F", "G", "Am", "E"]

# (midi, start 16th, length in 16ths) over an 8-bar phrase
MELODY = [
    (76, 0, 3), (81, 3, 3), (83, 6, 2), (84, 8, 6), (83, 14, 2),
    (81, 16, 4), (79, 20, 2), (76, 22, 10),
    (81, 32, 3), (84, 35, 3), (83, 38, 2), (81, 40, 6), (79, 46, 2),
    (81, 48, 4), (76, 52, 12),
    (76, 64, 3), (79, 67, 3), (84, 70, 2), (86, 72, 6), (84, 78, 2),
    (83, 80, 4), (79, 84, 2), (76, 86, 10),
    (74, 96, 3), (79, 99, 3), (81, 102, 2), (83, 104, 6), (81, 110, 2),
    (79, 112, 4), (83, 116, 4), (81, 120, 8),
]
MELODY_2 = MELODY[:-2] + [(83, 116, 4), (84, 120, 8)]
BREAK_LEAD = [(84, 0, 24), (81, 24, 8), (83, 32, 24), (86, 56, 8),
              (84, 64, 24), (83, 88, 8), (80, 96, 16), (83, 112, 16)]


def bar_t(bar, step=0):
    return bar * BAR + step * STEP


def kick_bars():
    return list(range(0, 24)) + list(range(28, 32))


# ------------------------------------------------------------- instruments
def kick():
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    f = 47 + 118 * np.exp(-t / 0.028)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.20)
    click = sg.sosfilt(hp(1800), rng.standard_normal(n)) * np.exp(-t / 0.004) * 0.35
    k = np.tanh(2.0 * (body + click)) / np.tanh(2.0)
    k[-400:] *= np.linspace(1, 0, 400)
    return k


def snare():
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    tone = (np.sin(2 * np.pi * 182 * t) + 0.45 * np.sin(2 * np.pi * 329 * t)) * np.exp(-t / 0.045)
    noise = sg.sosfilt(bp(900, 9500), rng.standard_normal(n))
    body = noise * np.exp(-t / 0.14)
    clap = np.zeros(n)
    for off in (0.0, 0.011, 0.023):
        i = int(off * SR)
        tt = t[: n - i]
        clap[i:] += sg.sosfilt(bp(1000, 4200), rng.standard_normal(n - i)) * np.exp(-tt / 0.012)
    s = 0.55 * tone + 0.75 * body + 0.55 * clap
    s[-400:] *= np.linspace(1, 0, 400)
    return s / np.max(np.abs(s))


_METAL = [205.3, 304.4, 369.6, 522.7, 540.0, 800.0]


def hat(open_=False):
    n = int((0.32 if open_ else 0.09) * SR)
    t = np.arange(n) / SR
    metal = sum(blep_square(f * 1.0, n) for f in _METAL)
    noise = rng.standard_normal(n) * 0.6
    h = sg.sosfilt(bp(7000, 15000), metal + noise)
    h *= np.exp(-t / (0.085 if open_ else 0.018))
    h[-200:] *= np.linspace(1, 0, 200)
    return h / np.max(np.abs(h))


def crash():
    n = int(2.6 * SR)
    t = np.arange(n) / SR
    metal = sum(blep_square(f * 1.47, n) for f in _METAL)
    c = sg.sosfilt(hp(4500), metal * 0.4 + rng.standard_normal(n))
    c *= np.exp(-t / 0.7)
    c[-500:] *= np.linspace(1, 0, 500)
    return c / np.max(np.abs(c))


def riser(bars=1.0):
    n = int(bars * BAR * SR)
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    blocks = 64
    edges = np.linspace(0, n, blocks + 1).astype(int)
    zi = None
    for b in range(blocks):
        fc = 400 * (9000 / 400) ** (b / (blocks - 1))
        sos = bp(fc * 0.6, fc * 1.6)
        if zi is None:
            zi = np.zeros((sos.shape[0], 2))
        seg, zi = sg.sosfilt(sos, noise[edges[b]:edges[b + 1]], zi=zi)
        out[edges[b]:edges[b + 1]] = seg
    e = np.linspace(0, 1, n) ** 2.2
    return out * e / (np.max(np.abs(out * e)) + 1e-9)


def bass_note(m, dur, accent=1.0):
    f = mtof(m)
    n = int((dur + 0.04) * SR)
    t = np.arange(n) / SR
    body = additive(f, n, 2.5, 0.75 / accent, maxh=40)
    sub = np.sin(2 * np.pi * f * t) * 0.55
    sig = np.tanh(1.4 * (body + sub))
    return sig * env(n, dur, 0.003, 0.18, 0.7, 0.04)


def arp_note(m, dur, bright):
    f = mtof(m)
    n = int((dur + 0.35) * SR)
    sig = additive(f, n, 5.0, 1.1 / bright, odd=True, maxh=36)
    sig += 0.35 * additive(f * 2.0, n, 7.0, 2.0 / bright, maxh=12)
    return sig * env(n, dur, 0.002, 0.12, 0.35, 0.3)


def pad_chord(notes, dur, cutoff):
    n = int((dur + 1.8) * SR)
    out = np.zeros((2, n))
    for m in notes:
        f = mtof(m)
        for ch, cents in ((0, -11), (0, 4), (1, -4), (1, 11)):
            out[ch] += blep_saw(f * 2 ** (cents / 1200), n)
        out[0] += 0.4 * blep_saw(f * 0.5 * 2 ** (3 / 1200), n)
        out[1] += 0.4 * blep_saw(f * 0.5 * 2 ** (-3 / 1200), n)
    sos = lp(cutoff, 4)
    out = sg.sosfilt(sos, out, axis=1)
    e = env(n, dur, 0.55, 1.2, 0.85, 1.8)
    return out * e / (len(notes) * 2.4)


def lead_note(m, dur, soft=False):
    f0 = mtof(m)
    rel = 0.35 if soft else 0.18
    n = int((dur + rel) * SR)
    t = np.arange(n) / SR
    depth = np.clip((t - 0.22) / 0.3, 0, 1) * 16  # cents, delayed vibrato
    f = f0 * 2 ** (depth * np.sin(2 * np.pi * 5.3 * t) / 1200)
    sig = 0.55 * blep_saw(f * 2 ** (6 / 1200), n) + 0.55 * blep_saw(f * 2 ** (-6 / 1200), n)
    sig += 0.30 * blep_square(f * 0.5, n)
    sig = sg.sosfilt(lp(2600 if soft else 4200, 2), sig)
    a = 0.09 if soft else 0.008
    return sig * env(n, dur, a, 0.25, 0.78, rel)


# ------------------------------------------------------------------ effects
def pingpong(x, delay, fb, taps=7, tone=4200):
    mono = x.sum(axis=0) * 0.5
    wet = np.zeros_like(x)
    d = int(delay * SR)
    for k in range(1, taps + 1):
        ch = (k - 1) % 2
        s = k * d
        if s >= N:
            break
        wet[ch, s:] += mono[: N - s] * fb ** k
    return sg.sosfilt(lp(tone), sg.sosfilt(hp(250), wet, axis=1), axis=1)


def reverb(x, seconds=3.2, tau=0.5, pre=0.025):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = np.zeros((2, n))
    for c in range(2):
        noise = rng.standard_normal(n)
        bright = sg.sosfilt(lp(8000), noise)
        dark = sg.sosfilt(lp(2200), noise)
        mixw = np.clip(t / seconds * 1.6, 0, 1)
        ir[c] = (bright * (1 - mixw) + dark * mixw) * np.exp(-t / tau)
    ir[:, : int(pre * SR)] = 0
    ir /= np.sqrt(np.sum(ir ** 2, axis=1, keepdims=True))
    out = np.vstack([sg.oaconvolve(x[c], ir[c])[:N] for c in range(2)])
    return sg.sosfilt(hp(180), out, axis=1)


def limiter(x, ceiling=0.89, look=0.004, release=0.08):
    w = max(3, int(look * SR))
    peak = nd.maximum_filter1d(np.max(np.abs(x), axis=0), size=w * 2 + 1)
    g = np.minimum(1.0, ceiling / np.maximum(peak, 1e-9))
    g = nd.minimum_filter1d(g, size=w * 2 + 1)
    g = nd.uniform_filter1d(g, size=w * 2 + 1)
    # slow release so gain changes do not flutter
    rel = np.exp(-1.0 / (release * SR))
    g = sg.lfilter([1 - rel], [1, -rel], g)
    g = np.minimum(g, nd.minimum_filter1d(np.minimum(1.0, ceiling / np.maximum(peak, 1e-9)), size=w * 2 + 1))
    return x * g


# --------------------------------------------------------------- arrange it
def render():
    kck = stereo()
    hats = stereo()
    snr = stereo()
    bass = stereo()
    pads = stereo()
    arps = stereo()
    lead = stereo()
    fx = stereo()

    K, S = kick(), snare()
    HC, HO, CR = hat(False), hat(True), crash()

    # pump envelope for side-chain ducking
    pump = np.zeros(N)
    pn = int(0.45 * SR)
    pt = np.arange(pn) / SR
    pshape = np.exp(-pt / 0.13) * np.minimum(1, pt / 0.006)

    for bar in kick_bars():
        for beat in range(4):
            t0 = bar_t(bar, beat * 4)
            place(kck, K, t0)
            i = int(round(t0 * SR))
            seg = pump[i:i + pn]
            np.maximum(seg, pshape[: len(seg)], out=seg)

    def duck(x, depth):
        return x * (1 - depth * pump)

    for bar in range(32):
        main = 8 <= bar < 24
        build = 28 <= bar < 32
        # snare
        if main or (build and bar < 31):
            for beat in (1, 3):
                place(snr, S, bar_t(bar, beat * 4), gain=0.62)
        if bar == 31:
            steps = [0, 2, 4, 6, 8, 9, 10, 11, 12, 13, 14, 15]
            for j, st in enumerate(steps):
                v = 0.22 + 0.5 * (j / (len(steps) - 1)) ** 1.5
                place(snr, S, bar_t(bar, st), gain=v)
        # hats
        if bar < 8 or build:
            for st in (2, 6, 10, 14):
                place(hats, HC, bar_t(bar, st), pan=0.25, gain=0.20)
        elif main:
            for st in range(16):
                if st % 4 == 2:
                    place(hats, HO, bar_t(bar, st), pan=0.25, gain=0.17)
                else:
                    v = 0.16 if st % 2 == 0 else 0.10
                    place(hats, HC, bar_t(bar, st), pan=0.25, gain=v * rng.uniform(0.85, 1.1))

    for bar in (0, 8, 16, 24):
        place(fx, CR, bar_t(bar), pan=-0.2, gain=0.20)
    for bar in (7, 23, 31):
        place(fx, riser(1.0), bar_t(bar), gain=0.16)

    # harmony
    for ci, name in enumerate(PROG):
        bar0 = ci * 2
        t0 = bar_t(bar0)
        main = 8 <= bar0 < 24
        brk = bar0 >= 24
        # pads (filter opens through the intro and across the break)
        if bar0 < 8:
            cut = 900 + 350 * ci
        elif main:
            cut = 2300
        else:
            cut = 1500 + 450 * (ci - 12)
        place(pads, pad_chord(CHORD[name], 2 * BAR - 0.05, cut), t0, gain=0.9 if brk else 0.75)

        # bass: straight 8ths, octave lift at the end of each chord
        if not (24 <= bar0 < 28):
            r = ROOT[name]
            for b in range(2):
                for e8 in range(8):
                    m = r + 12 if (b == 1 and e8 == 7) else r
                    acc = 1.25 if e8 % 2 == 0 else 1.0
                    place(bass, bass_note(m, STEP * 2 * 0.82, acc), bar_t(bar0 + b, e8 * 2),
                          gain=0.42 * (1.0 if e8 % 2 == 0 else 0.85))
        else:
            # break: one long, soft root note per chord
            place(bass, bass_note(ROOT[name], 2 * BAR - 0.2, 0.6), t0, gain=0.30)

        # arp
        pat = [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 2, 3, 1, 2]
        tones = ARP[name]
        for b in range(2):
            for st in range(16):
                bar = bar0 + b
                if bar < 8:
                    bright = 0.55 + 0.06 * bar
                elif main:
                    bright = 1.0
                else:
                    bright = 0.8 + 0.06 * (bar - 24)
                m = tones[pat[st]]
                v = 0.15 if st % 4 == 0 else 0.11
                place(arps, arp_note(m, STEP * 0.8, bright), bar_t(bar, st), gain=v)

    # lead
    for start_bar, phrase, layer in ((8, MELODY, False), (16, MELODY_2, True)):
        for m, st, ln in phrase:
            t0 = bar_t(start_bar) + st * STEP
            dur = ln * STEP * 0.94
            place(lead, lead_note(m, dur), t0, gain=0.30)
            if layer:
                place(lead, lead_note(m - 12, dur), t0, gain=0.17)
    for m, st, ln in BREAK_LEAD:
        place(lead, lead_note(m, ln * STEP * 0.96, soft=True), bar_t(24) + st * STEP, gain=0.24)

    # side-chain and effects
    bass = duck(bass, 0.55)
    pads = duck(pads, 0.6)
    arps = duck(arps, 0.35)

    arps = arps + pingpong(arps, BEAT * 0.75, 0.42)
    lead = lead + pingpong(lead, BEAT * 0.75, 0.30, tone=3200) * 0.8

    bass = sg.sosfilt(lp(3200), bass, axis=1)

    # balance the stems by perceived loudness over the main section
    stems = {"kick": kck, "snare": snr, "hats": hats, "bass": bass, "pads": pads,
             "arps": arps, "lead": lead}
    for k, target in TARGETS.items():
        stems[k] *= 10 ** ((target - loudness(stems[k])) / 20)
    fx *= 10 ** ((TARGETS["kick"] - 14 - loudness(fx, whole=True)) / 20)

    send = (0.02 * stems["kick"] + 0.45 * stems["snare"] + 0.05 * stems["hats"] + 0.25 * stems["pads"]
            + 0.35 * stems["arps"] + 0.35 * stems["lead"] + 0.4 * fx)
    wet = duck(reverb(send), 0.3)
    wet *= 10 ** ((TARGETS["kick"] - 11 - loudness(wet)) / 20)

    mix = sum(stems.values()) + fx + wet
    mix = sg.sosfilt(hp(28), mix, axis=1)
    stems["fx"], stems["wet"] = fx, wet
    return mix, stems


# relative perceived loudness (dB) of each part in the full section
TARGETS = {"kick": 0.0, "snare": -2.0, "bass": -3.0, "lead": -3.5, "pads": -8.0,
           "arps": -8.5, "hats": -13.0}
_K1 = sg.butter(2, 1500, "high", fs=SR, output="sos")
_K2 = sg.butter(2, 60, "high", fs=SR, output="sos")


def loudness(x, whole=False):
    """Rough BS.1770-style loudness: +4 dB above ~1.5 kHz, roll off the deep lows."""
    part = x if whole else x[:, int(bar_t(8) * SR):int(bar_t(24) * SR)]
    y = sg.sosfilt(_K2, part + 0.585 * sg.sosfilt(_K1, part, axis=1), axis=1)
    return 10 * np.log10(np.mean(y ** 2) + 1e-12)


def main():
    out_dir = sys.argv[1] if len(sys.argv) > 1 else "."
    os.makedirs(out_dir, exist_ok=True)
    mix, stems = render()

    # fold tails onto the start so the loop is seamless
    out = mix[:, :LEN].copy()
    out[:, :TAIL] += mix[:, LEN:LEN + TAIL]

    for k, v in stems.items():
        print(f"  {k:6s} loudness {loudness(v):6.1f} dB")

    out /= np.max(np.abs(out))
    out *= 10 ** (4 / 20)  # drive ~4 dB into the limiter
    out = limiter(out)
    out = np.clip(out, -0.95, 0.95)
    rms = np.sqrt(np.mean(out ** 2))
    print(f"  master peak {20*np.log10(np.max(np.abs(out))):.1f} dBFS, rms {20*np.log10(rms):.1f} dBFS, "
          f"length {LEN / SR:.2f}s")

    pcm = (out.T * 32767).astype("<i2")
    with tempfile.TemporaryDirectory() as tmp:
        wav_path = os.path.join(tmp, "music.wav")
        with wave.open(wav_path, "wb") as w:
            w.setnchannels(2)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes(pcm.tobytes())
        mp3 = os.path.join(out_dir, "music.mp3")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav_path,
                        "-c:a", "libmp3lame", "-b:a", "160k", mp3], check=True)
        if os.environ.get("KEEP_WAV"):
            subprocess.run(["cp", wav_path, os.path.join(out_dir, "music.wav")], check=True)
    print("  wrote", mp3, os.path.getsize(mp3) // 1024, "KB")


if __name__ == "__main__":
    main()
