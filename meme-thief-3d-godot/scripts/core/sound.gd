## Procedural audio (autoload "Sound"): every effect and the music loop are synthesised into WAV samples at start-up.
extends Node

const SR := 22050
var sfx: Dictionary = {}
var players: Array[AudioStreamPlayer] = []
var music_player: AudioStreamPlayer
var music_thread: Thread
var music_stream: AudioStreamWAV = null
var _music_ready := false
var inited := false
var pi := 0

const DEFS := {
	"click": [["tone", 900, 0.05, "square", 0.08]],
	"coin": [["tone", 1318, 0.08, "square", 0.12], ["tone", 1760, 0.16, "square", 0.12, 0, 0.07]],
	"buy": [["tone", 523, 0.14, "triangle", 0.22, 0, 0.0], ["tone", 659, 0.14, "triangle", 0.22, 0, 0.06], ["tone", 784, 0.14, "triangle", 0.22, 0, 0.12], ["tone", 1046, 0.14, "triangle", 0.22, 0, 0.18]],
	"error": [["tone", 180, 0.22, "sawtooth", 0.16, -60]],
	"jump": [["tone", 320, 0.16, "sine", 0.18, 380]],
	"land": [["noise", 0.08, 0.12, 400, 0.8]],
	"steal": [["noise", 0.35, 0.25, 2500, 1.2, 0, -2000], ["tone", 700, 0.3, "square", 0.1, -400, 0.05]],
	"success": [["tone", 523, 0.22, "square", 0.14, 0, 0.0], ["tone", 659, 0.22, "square", 0.14, 0, 0.08], ["tone", 784, 0.22, "square", 0.14, 0, 0.16], ["tone", 1046, 0.22, "square", 0.14, 0, 0.24], ["tone", 1318, 0.22, "square", 0.14, 0, 0.32], ["tone", 1568, 0.5, "triangle", 0.18, 0, 0.42]],
	"caught": [["tone", 600, 0.18, "sawtooth", 0.14, -50, 0.0], ["tone", 450, 0.18, "sawtooth", 0.14, -50, 0.12], ["tone", 300, 0.18, "sawtooth", 0.14, -50, 0.24]],
	"alarm": [["tone", 880, 0.18, "square", 0.12, 0, 0.0], ["tone", 620, 0.18, "square", 0.12, 0, 0.18], ["tone", 880, 0.18, "square", 0.12, 0, 0.36], ["tone", 620, 0.18, "square", 0.12, 0, 0.54], ["tone", 880, 0.18, "square", 0.12, 0, 0.72], ["tone", 620, 0.18, "square", 0.12, 0, 0.9]],
	"laser": [["tone", 1500, 0.4, "sawtooth", 0.12, -1200], ["tone", 2200, 0.3, "sine", 0.08, -1800, 0.05]],
	"wood": [["tone", 150, 0.07, "triangle", 0.22, -50], ["noise", 0.05, 0.16, 900, 3]],
	"wood2": [["tone", 128, 0.07, "triangle", 0.22, -40], ["noise", 0.05, 0.16, 760, 3]],
	"drill": [["tone", 180, 0.12, "sawtooth", 0.07, 0], ["noise", 0.1, 0.07, 3200, 1.2]],
	"zap": [["noise", 0.12, 0.2, 3000, 4], ["tone", 1200, 0.1, "square", 0.08, -800]],
	"rare": [["tone", 784, 0.35, "sine", 0.13, 0, 0.0], ["tone", 988, 0.35, "sine", 0.13, 0, 0.07], ["tone", 1175, 0.35, "sine", 0.13, 0, 0.14], ["tone", 1568, 0.35, "sine", 0.13, 0, 0.21], ["tone", 1976, 0.35, "sine", 0.13, 0, 0.28]],
	"rebirth": [["tone", 262, 0.5, "triangle", 0.16, 0, 0.0], ["tone", 330, 0.5, "triangle", 0.16, 0, 0.09], ["tone", 392, 0.5, "triangle", 0.16, 0, 0.18], ["tone", 523, 0.5, "triangle", 0.16, 0, 0.27], ["tone", 659, 0.5, "triangle", 0.16, 0, 0.36], ["tone", 784, 0.5, "triangle", 0.16, 0, 0.45], ["tone", 1046, 0.5, "triangle", 0.16, 0, 0.54]],
	"poof": [["noise", 0.2, 0.15, 900, 0.7, 0, -600]],
	"event": [["tone", 440, 0.25, "square", 0.1, 0, 0.0], ["tone", 554, 0.25, "square", 0.1, 0, 0.1], ["tone", 659, 0.25, "square", 0.1, 0, 0.2], ["tone", 880, 0.25, "square", 0.1, 0, 0.3]],
	"upgrade": [["tone", 392, 0.2, "triangle", 0.2, 60, 0.0], ["tone", 523, 0.2, "triangle", 0.2, 60, 0.07], ["tone", 784, 0.2, "triangle", 0.2, 60, 0.14]],
	"slap": [["noise", 0.12, 0.35, 1800, 1.5], ["tone", 220, 0.12, "square", 0.18, -120]],
	"whoosh": [["noise", 0.18, 0.12, 900, 0.8, 0, 1500]],
	"djump": [["tone", 520, 0.14, "sine", 0.16, 600]],
	"fuse": [["tone", 262, 0.3, "sawtooth", 0.07, 0, 0.0], ["tone", 392, 0.3, "sawtooth", 0.07, 0, 0.12], ["tone", 523, 0.3, "sawtooth", 0.07, 0, 0.24], ["tone", 784, 0.3, "sawtooth", 0.07, 0, 0.36], ["tone", 1046, 0.3, "sawtooth", 0.07, 0, 0.48], ["tone", 1568, 0.3, "sawtooth", 0.07, 0, 0.6], ["noise", 1.2, 0.08, 400, 0.5, 0, 3000]],
	"boom": [["noise", 0.6, 0.45, 180, 0.6, 0, -120], ["tone", 70, 0.5, "sine", 0.35, -40]],
	"portal": [["tone", 200, 0.9, "sawtooth", 0.12, 1400], ["tone", 300, 0.9, "sine", 0.16, 900, 0.05], ["noise", 0.8, 0.12, 600, 0.6, 0, 3000]],
	"mission": [["tone", 659, 0.18, "triangle", 0.18, 0, 0.0], ["tone", 880, 0.18, "triangle", 0.18, 0, 0.08], ["tone", 1175, 0.18, "triangle", 0.18, 0, 0.16]],
	"firework": [["tone", 700, 0.15, "triangle", 0.06], ["noise", 0.3, 0.06, 2500, 0.8, 0.05]],
}

func _ready() -> void:
	var idx := AudioServer.bus_count
	AudioServer.add_bus(idx); AudioServer.set_bus_name(idx, "SFX")
	AudioServer.add_bus(idx + 1); AudioServer.set_bus_name(idx + 1, "Music")
	for i in 10:
		var p := AudioStreamPlayer.new()
		p.bus = "SFX"
		add_child(p)
		players.append(p)
	music_player = AudioStreamPlayer.new()
	music_player.bus = "Music"
	add_child(music_player)
	apply()

## first user gesture: build the sample bank (cheap) and start the music render in a thread
func init() -> void:
	if inited:
		return
	inited = true
	for k in DEFS.keys():
		sfx[k] = _render(DEFS[k])
	music_thread = Thread.new()
	music_thread.start(_render_music)

func apply() -> void:
	AudioServer.set_bus_volume_db(0, linear_to_db(maxf(0.0001, S.volume)))
	AudioServer.set_bus_volume_db(AudioServer.get_bus_index("SFX"), 0.0 if S.sfx else -80.0)
	AudioServer.set_bus_volume_db(AudioServer.get_bus_index("Music"), linear_to_db(0.32) if S.music else -80.0)

func _process(_dt: float) -> void:
	if music_thread and not _music_ready and not music_thread.is_alive():
		music_stream = music_thread.wait_to_finish()
		music_thread = null
		_music_ready = true
		if music_stream:
			music_player.stream = music_stream
			music_player.play()

func play(name: String) -> void:
	if not inited or not S.sfx or not sfx.has(name):
		return
	var p := players[pi]
	pi = (pi + 1) % players.size()
	p.stream = sfx[name]
	p.play()

## play an ad-hoc tone (fireworks)
func tone(freq: float, dur: float, type: String = "sine", vol: float = 0.3) -> void:
	if not inited:
		return
	var p := players[pi]
	pi = (pi + 1) % players.size()
	p.stream = _render([["tone", freq, dur, type, vol]])
	p.play()

static func _wave(type: String, ph: float) -> float:
	var f := ph - floorf(ph)
	match type:
		"square": return 1.0 if f < 0.5 else -1.0
		"sawtooth": return 2.0 * f - 1.0
		"triangle": return 1.0 - 4.0 * absf(f - 0.5)
	return sin(f * TAU)

## events: ["tone", freq, dur, type, vol, slide, delay] | ["noise", dur, vol, f, q, delay, sweep]
static func _render(events: Array) -> AudioStreamWAV:
	var total := 0.0
	for e in events:
		if e[0] == "tone":
			total = maxf(total, float(e[2]) + (float(e[6]) if e.size() > 6 else 0.0) + 0.05)
		else:
			total = maxf(total, float(e[1]) + (float(e[5]) if e.size() > 5 else 0.0) + 0.05)
	var n := int(total * SR) + 1
	var buf := PackedFloat32Array()
	buf.resize(n)
	buf.fill(0.0)
	for e in events:
		if e[0] == "tone":
			_tone(buf, float(e[1]), float(e[2]), str(e[3]), float(e[4]), float(e[5]) if e.size() > 5 else 0.0, float(e[6]) if e.size() > 6 else 0.0)
		else:
			_noise(buf, float(e[1]), float(e[2]), float(e[3]), float(e[4]) if e.size() > 4 else 1.0, float(e[5]) if e.size() > 5 else 0.0, float(e[6]) if e.size() > 6 else 0.0)
	return _to_wav(buf)

static func _tone(buf: PackedFloat32Array, freq: float, dur: float, type: String, vol: float, slide: float, delay: float) -> void:
	var start := int(delay * SR)
	var cnt := int((dur + 0.05) * SR)
	var fe := maxf(30.0, freq + slide)
	var ph := 0.0
	var att := 0.012
	for i in cnt:
		var idx := start + i
		if idx >= buf.size():
			break
		var tt := float(i) / SR
		var f := freq
		if slide != 0.0 and dur > 0.0:
			f = freq * pow(fe / freq, minf(1.0, tt / dur))
		ph += f / SR
		var g: float
		if tt < att:
			g = 0.0001 * pow(vol / 0.0001, tt / att)
		elif tt < dur:
			g = vol * pow(0.0001 / vol, (tt - att) / maxf(0.001, dur - att))
		else:
			g = 0.0
		buf[idx] += _wave(type, ph) * g

static func _noise(buf: PackedFloat32Array, dur: float, vol: float, f: float, q: float, delay: float, sweep: float) -> void:
	var start := int(delay * SR)
	var cnt := int((dur + 0.05) * SR)
	var fe := maxf(60.0, f + sweep)
	var x1 := 0.0; var x2 := 0.0; var y1 := 0.0; var y2 := 0.0
	var b0 := 0.0; var b1 := 0.0; var b2 := 0.0; var a1 := 0.0; var a2 := 0.0
	var rng := RandomNumberGenerator.new()
	rng.seed = int(f * 1000.0 + dur * 7.0)
	for i in cnt:
		var idx := start + i
		if idx >= buf.size():
			break
		var tt := float(i) / SR
		if i % 32 == 0:
			var fc := f
			if sweep != 0.0 and dur > 0.0:
				fc = f * pow(fe / f, minf(1.0, tt / dur))
			fc = clampf(fc, 20.0, SR * 0.45)
			var w0 := TAU * fc / SR
			var alpha := sin(w0) / (2.0 * maxf(0.05, q))
			var a0 := 1.0 + alpha
			b0 = alpha / a0; b1 = 0.0; b2 = -alpha / a0
			a1 = -2.0 * cos(w0) / a0; a2 = (1.0 - alpha) / a0
		var x0 := rng.randf() * 2.0 - 1.0
		var y0 := b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
		x2 = x1; x1 = x0; y2 = y1; y1 = y0
		var g := vol * pow(0.0001 / vol, minf(1.0, tt / maxf(0.001, dur))) if tt < dur else 0.0
		buf[idx] += y0 * g * 2.0

static func _to_wav(buf: PackedFloat32Array, loop: bool = false) -> AudioStreamWAV:
	var bytes := PackedByteArray()
	bytes.resize(buf.size() * 2)
	for i in buf.size():
		var s := int(clampf(buf[i], -1.0, 1.0) * 32767.0)
		bytes.encode_s16(i * 2, s)
	var w := AudioStreamWAV.new()
	w.format = AudioStreamWAV.FORMAT_16_BITS
	w.mix_rate = SR
	w.stereo = false
	w.data = bytes
	if loop:
		w.loop_mode = AudioStreamWAV.LOOP_FORWARD
		w.loop_begin = 0
		w.loop_end = buf.size()
	return w

## cheerful procedural loop: bass + plucked chords + lead (64 eighth-notes at 112 bpm)
static func _render_music() -> AudioStreamWAV:
	var bpm := 112.0
	var sp := 60.0 / bpm / 2.0
	var prog := [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]]
	var lead := [76, 0, 74, 72, 0, 72, 74, 76, 77, 0, 76, 74, 72, 0, 69, 0, 72, 0, 71, 72, 74, 0, 72, 71, 69, 0, 67, 0, 69, 71, 72, 0]
	var mf := func(m: int) -> float: return 440.0 * pow(2.0, (m - 69) / 12.0)
	var events := []
	for st in 64:
		var bar := (st / 8) % 4
		var ch: Array = prog[bar]
		var t0 := st * sp
		if st % 2 == 0:
			events.append(["tone", mf.call(ch[0] - 24), sp * 1.6, "triangle", 0.32, 0, t0])
		if st % 4 == 2:
			for m in ch:
				events.append(["tone", mf.call(m), sp * 1.2, "square", 0.035, 0, t0])
		var ln: int = lead[st % 32]
		if ln != 0 and (st / 32) % 2 == 1:
			events.append(["tone", mf.call(ln), sp * 0.9, "square", 0.05, 0, t0])
		if st % 4 == 0:
			events.append(["tone", 90, 0.12, "sine", 0.25, -40, t0])
	var n := int(64 * sp * SR)
	var buf := PackedFloat32Array()
	buf.resize(n + int(0.3 * SR))
	buf.fill(0.0)
	for e in events:
		_tone(buf, float(e[1]), float(e[2]), str(e[3]), float(e[4]), float(e[5]), float(e[6]))
	# fold the tail back onto the start so the loop is seamless
	for i in range(n, buf.size()):
		buf[i - n] += buf[i]
	buf.resize(n)
	return _to_wav(buf, true)
