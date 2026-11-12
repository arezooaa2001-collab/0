## Shared helpers: Persian digits, number formatting, math and a deterministic RNG.
class_name U

const FA_DIG := "۰۱۲۳۴۵۶۷۸۹"
const TAU2 := TAU

static func fa(v) -> String:
	var s := str(v)
	var out := ""
	for ch in s:
		var c := ch.unicode_at(0)
		if c >= 48 and c <= 57:
			out += FA_DIG[c - 48]
		elif ch == ".":
			out += "٫"
		else:
			out += ch
	return out

static func fmt(n: float) -> String:
	n = floorf(maxf(0.0, n if is_finite(n) else 0.0))
	if n < 1000:
		return fa(int(n))
	var units := [[1e21, "سکستیلیون"], [1e18, "کوینتیلیون"], [1e15, "کوادریلیون"], [1e12, "تریلیون"], [1e9, "میلیارد"], [1e6, "میلیون"], [1e3, "هزار"]]
	for u in units:
		if n >= u[0]:
			var v: float = n / u[0]
			var s: String
			if v >= 100:
				s = "%.0f" % v
			elif v >= 10:
				s = "%.1f" % v
			else:
				s = "%.2f" % v
			if s.contains("."):
				s = s.rstrip("0").rstrip(".")
			return fa(s) + " " + u[1]
	return fa(int(n))

static func fmt_inc(n: float) -> String:
	return "+" + fmt(n) + " در ثانیه"

static func fmt_time(sec: float) -> String:
	var s := int(ceilf(maxf(0.0, sec)))
	var m := s / 60
	s = s % 60
	return fa("%d:%02d" % [m, s])

static func damp(a: float, b: float, k: float, dt: float) -> float:
	return a + (b - a) * (1.0 - exp(-k * dt))

static func rnd(a: float, b: float) -> float:
	return a + randf() * (b - a)

static func rndi(a: int, b: int) -> int:
	return int(floorf(rnd(a, b + 1)))

static func pick(arr: Array):
	return arr[randi() % arr.size()]

static func ang_diff(a: float, b: float) -> float:
	var d := fmod(b - a, TAU)
	if d > PI:
		d -= TAU
	if d < -PI:
		d += TAU
	return d

static func today_key() -> String:
	var d := Time.get_date_dict_from_system()
	return "%d-%d-%d" % [d.year, d.month, d.day]

static func yesterday_key() -> String:
	var t := Time.get_unix_time_from_system() - 86400.0
	var d := Time.get_date_dict_from_unix_time(int(t))
	return "%d-%d-%d" % [d.year, d.month, d.day]

static func col(hex: String) -> Color:
	return Color.html(hex)

static func dist2(a: Vector3, b: Vector3) -> float:
	return (a.x - b.x) * (a.x - b.x) + (a.z - b.z) * (a.z - b.z)

static func dist2xz(ax: float, az: float, bx: float, bz: float) -> float:
	return (ax - bx) * (ax - bx) + (az - bz) * (az - bz)

static func num(v, d: float, lo: float = 0.0, hi: float = 1e24) -> float:
	if v == null:
		return d
	var f: float
	if v is float or v is int:
		f = float(v)
	elif v is String and v.is_valid_float():
		f = v.to_float()
	else:
		return d
	if not is_finite(f):
		return d
	return clampf(f, lo, hi)

## mulberry32 — the same deterministic generator the original game used for procedural memes.
class Mulberry:
	var seed: int
	func _init(s: int) -> void:
		seed = s & 0xFFFFFFFF
	func next() -> float:
		seed = (seed + 0x6D2B79F5) & 0xFFFFFFFF
		var t: int = ((seed ^ (seed >> 15)) * (1 | seed)) & 0xFFFFFFFF
		t = ((t + ((t ^ (t >> 7)) * (61 | t))) ^ t) & 0xFFFFFFFF
		return float((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296.0
	func range(a: float, b: float) -> float:
		return a + next() * (b - a)
	func pick(arr: Array):
		return arr[int(floorf(next() * arr.size()))]
