## Procedural meme builder: noun -> body shape, adjectives -> visible traits (deterministic per meme).
class_name ProcBuild

const PROC_ACC := ["#ff4f8b", "#ffd23f", "#3df2b0", "#58c4ff", "#b061ff", "#ff7a2a", "#ffffff", "#2a2a3a"]
const RAINBOW := ["#ff4f8b", "#ffa31a", "#ffd23f", "#3df2b0", "#58c4ff", "#b061ff"]

static func G(n: String) -> Array: return Geo.G(n)
static func M(c, o: Dictionary = {}) -> StandardMaterial3D: return Geo.mat(c, o)

static func build(c: Dictionary, B: PB) -> Dictionary:
	var b := B.body; var r := B.root
	var R := U.Mulberry.new(c.proc.seed)
	var N: Array = c.proc.noun
	var F := {}
	for a in c.proc.adj:
		F[Data.MEME_ADJ[a][1]] = true
	var rp := func(arr: Array): return arr[int(floorf(R.next() * arr.size()))]
	var rr := func(a: float, z: float) -> float: return a + R.next() * (z - a)
	var shape: String = N[2]; var extra: String = N[4]
	var col: String = N[3]
	var bo := {"r": 0.55}
	if F.has("gold"):
		col = "#ffc93c"; bo.merge({"m": 1.0, "r": 0.22}, true)
	if F.has("icy"):
		col = "#c8f2ff"; bo.merge({"m": 0.3, "r": 0.08, "e": "#5ad8ff", "ei": 0.3}, true)
	if F.has("glow"):
		bo.merge({"e": col, "ei": 0.5}, true)
	if shape == "gem":
		bo["flat"] = true
	var BM := M(col, bo)
	var accs := []
	for x in PROC_ACC:
		if x != col:
			accs.append(x)
	var acc: String = rp.call(accs); var acc2: String = rp.call(PROC_ACC); var dark := "#2a1a22"
	var fly: bool = F.has("wings") or F.has("rocket") or extra == "string" or extra == "rotor" or (F.has("halo") and R.next() < 0.6) or ((shape == "gem" or shape == "donut") and R.next() < 0.5)
	var legH: float = 0.0 if fly else rr.call(0.28, 0.5)
	var noLegs: bool = (not fly) and R.next() < 0.12
	var base: float = 0.0 if noLegs else legH
	var cy: float; var hh: float; var hw: float; var fz: float; var fy: float; var top: float
	match shape:
		"ball":
			var s: float = rr.call(0.66, 0.84); hw = s; hh = s; cy = base + s
			B.P(G("sphere"), BM, 0, cy, 0, s, s * 0.96, s * 0.94, b); fy = cy + s * 0.18; fz = s * 0.9; top = cy + s * 0.96
		"egg":
			var s: float = rr.call(0.55, 0.68); hw = s; hh = s * 1.32; cy = base + hh
			B.P(G("sphere"), BM, 0, cy, 0, s, hh, s * 0.9, b); fy = cy + hh * 0.25; fz = s * 0.84; top = cy + hh
		"bean":
			var s: float = rr.call(0.48, 0.6); hw = s; hh = rr.call(0.85, 1.05); cy = base + hh
			B.P(G("capsule"), BM, 0, cy, 0, s * 2, hh, s * 1.9, b); fy = cy + hh * 0.42; fz = s * 0.92; top = cy + hh
		"box", "tall":
			hw = rr.call(0.4, 0.5) if shape == "tall" else rr.call(0.6, 0.78); hh = rr.call(0.95, 1.15) if shape == "tall" else rr.call(0.55, 0.72); cy = base + hh
			B.P(Geo.rbox(1, 1, 1, 0.14), BM, 0, cy, 0, hw * 2, hh * 2, hw * 1.5, b); fy = cy + hh * 0.3; fz = hw * 0.76; top = cy + hh
		"can":
			hw = rr.call(0.52, 0.66); hh = rr.call(0.55, 0.78); cy = base + hh
			B.P(G("cyl"), BM, 0, cy, 0, hw, hh * 2, hw, b); B.K(G("torus"), M(acc, {"r": 0.4}), 0, cy + hh, 0, hw, hw, 0.9, b).rx(PI / 2)
			fy = cy + hh * 0.2; fz = hw * 0.98; top = cy + hh
		"cone":
			hw = rr.call(0.62, 0.78); hh = rr.call(0.8, 1.0); cy = base + hh
			B.P(G("cone"), BM, 0, cy, 0, hw, hh * 2, hw, b); fy = cy - hh * 0.25; fz = hw * 0.62; top = cy + hh
		"gem":
			hw = rr.call(0.6, 0.75); hh = rr.call(0.85, 1.05); cy = base + hh + (0.0 if fly else 0.05)
			B.P(G("oct"), BM, 0, cy, 0, hw, hh, hw, b); fy = cy + hh * 0.08; fz = hw * 0.86; top = cy + hh
		"donut":
			hw = 0.96; hh = 0.96; cy = base + hh
			B.P(G("donut"), BM, 0, cy, 0, 1, 1, 1.1, b); B.K(G("donut"), M(acc, {"r": 0.4}), 0, cy + 0.08, 0.06, 0.98, 0.9, 1.05, b)
			fy = cy + 0.62; fz = 0.38; top = cy + hh
		_:
			hw = rr.call(0.78, 0.92); hh = rr.call(0.48, 0.6); cy = base + hh
			B.P(G("sphere"), BM, 0, cy, 0, hw, hh, hw * 0.9, b); fy = cy + hh * 0.2; fz = hw * 0.82; top = cy + hh
	var glassFace: bool = extra == "screen" or (F.has("antenna") and R.next() < 0.3)
	if glassFace:
		B.K(G("box"), M("#14141e", {"r": 0.2, "e": "#29d9ff", "ei": 0.15}), 0, fy - 0.02, fz + 0.02, hw * 1.15, hh * 0.7, 0.04, b)
	# eyes
	var er: float = rr.call(0.1, 0.15) * (1.1 if hw > 0.7 else 1.0); var sep: float = minf(hw * 0.42, 0.32); var ez: float = fz + 0.01
	var eo := {"lx": rr.call(-0.25, 0.25), "ly": rr.call(-0.2, 0.2)}
	if glassFace:
		eo.merge({"iris": "#3df2ff", "glow": true, "pupil": 0.8}, true)
	if F.has("hearts"):
		eo.merge({"iris": "#ff2a6a", "glow": true, "pupil": 0.85}, true)
	if F.has("sleepy"):
		eo["sy"] = 0.4
	if F.has("cyclops"):
		B.eye(b, 0, fy + 0.04, ez, er * 1.7, eo)
	elif F.has("three"):
		B.eyes(b, fy, ez, sep, er * 0.9, eo); B.eye(b, 0, fy + er * 2, ez - 0.02, er * 0.85, eo)
	elif F.has("pirate"):
		B.eye(b, sep, fy, ez, er, eo)
		B.K(G("cyl"), "#111111", -sep, fy, ez + 0.03, er * 1.2, 0.04, er * 1.2, b).rx(PI / 2)
		B.K(G("box"), "#111111", 0, fy + er * 0.9, ez - 0.02, hw * 2.05, 0.05, 0.05, b).rz(0.35)
	else:
		B.eyes(b, fy, ez, sep, er, eo)
	if F.has("angry"):
		B.brows(b, fy + er * 1.5, ez + 0.03, sep, -0.4, dark, er * 1.5)
	elif F.has("sleepy"):
		B.brows(b, fy + er * 0.9, ez + 0.04, sep, 0.05, "#888888" if col == "#2a2a3a" else dark, er * 1.6)
	if F.has("glasses"):
		var gm := M("#1b1b22", {"r": 0.3, "m": 0.5})
		for s in [-1.0, 1.0]:
			B.K(G("torus"), gm, s * sep, fy, ez + 0.06, er * 1.45, er * 1.45, 0.6, b)
		B.K(G("box"), gm, 0, fy + 0.02, ez + 0.06, sep * 0.8, 0.035, 0.035, b)
	# mouth
	var my: float = fy - er * 2.2 - 0.04; var mz: float = fz + (0.06 if shape == "cone" else 0.0)
	if F.has("cry"):
		var m := B.smile(b, my - 0.04, mz, 0.1, dark); m.rot.z = 0
		for s in [-1.0, 1.0]:
			B.K(G("sphere"), M("#7ad8ff", {"r": 0.1, "e": "#3fb7ff", "ei": 0.4}), s * sep, fy - er * 1.5, ez + 0.03, 0.045, 0.08, 0.04, b)
	else:
		B.smile(b, my, mz, 0.17 if F.has("grin") else rr.call(0.08, 0.13), dark, F.has("grin") or R.next() < 0.35, rr.call(-0.15, 0.15))
	if F.has("stache"):
		for s in [-1.0, 1.0]:
			B.K(G("capsule"), "#2a1608", s * 0.11, my + 0.07, mz + 0.05, 0.08, 0.14, 0.07, b).rz(s * 1.2)
	if F.has("beard"):
		B.K(G("sphere"), M("#5a3a20", {"r": 1.0, "flat": true}), 0, my - 0.12, mz - 0.08, hw * 0.55, 0.26, 0.2, b)
	if R.next() < 0.45 and not glassFace:
		for s in [-1.0, 1.0]:
			B.K(G("sphere"), "#ff9db0", s * (sep + er * 1.2), fy - er * 1.4, ez - 0.02, 0.07, 0.045, 0.03, b)
	# noun extras
	var ex := func(k: String) -> bool: return extra == k
	if ex.call("leaf"):
		B.K(G("cyl"), "#6b4a2a", 0, top + 0.1, 0, 0.04, 0.22, 0.04, b); B.K(G("sphere"), "#3fae3f", 0.13, top + 0.16, 0, 0.16, 0.05, 0.08, b).rz(-0.4)
	if ex.call("melon"):
		for i in 5:
			B.K(G("torus"), "#1f6e2a", 0, cy, 0, hw * 1.0, hw * 1.0, 0.6, b).ry(i / 5.0 * PI)
	if ex.call("candle"):
		B.K(G("cyl"), "#ffffff", 0, top + 0.2, 0, 0.05, 0.4, 0.05, b); B.K(G("cone"), M("#ffb000", {"e": "#ff7a00", "ei": 2}), 0, top + 0.47, 0, 0.06, 0.14, 0.06, b)
	if ex.call("scoop"):
		B.K(G("sphere"), M(rp.call(["#ffd6e8", "#c8f0ff", "#fff3a0", "#d0ffd8"]), {"r": 0.6}), 0, top + 0.2, 0, hw * 0.85, hw * 0.7, hw * 0.85, b)
	if ex.call("bun"):
		B.K(G("hemi"), "#d9a066", 0, top - 0.05, 0, hw * 1.05, 0.38, hw * 1.05, b)
		for i in 7:
			var a: float = R.next() * TAU; var d: float = R.next() * hw * 0.6
			B.K(G("sphere"), "#fff8e0", cos(a) * d, top + 0.27, sin(a) * d, 0.04, 0.025, 0.06, b)
	if ex.call("chips") or ex.call("holes") or ex.call("spots") or F.has("spots"):
		var sc: String = "#ffffff" if ex.call("spots") else (acc if F.has("spots") else ("#c8a020" if ex.call("holes") else "#5a3010"))
		for i in 9:
			var a: float = rr.call(-1.3, 1.3); var yy: float = cy + rr.call(-0.6, 0.6) * hh
			B.K(G("sphere"), sc, sin(a) * hw * 0.94, yy, cos(a) * hw * 0.92, 0.09, 0.09, 0.05, b).look_at(Vector3(0, yy, 0))
	if ex.call("spikes"):
		for i in 7:
			var a := i / 7.0 * TAU
			B.K(G("cone"), M(acc, {"r": 0.4}), sin(a) * hw * 0.55, top - 0.05 - (i % 2) * 0.1, cos(a) * hw * 0.55 - 0.05, 0.09, 0.32, 0.09, b).r(cos(a) * 0.5, 0, -sin(a) * 0.5)
	if ex.call("catEars"):
		for ns in [["E1", -1.0], ["E2", 1.0]]:
			var e := B.pivot(b, ns[0], ns[1] * hw * 0.5, top - 0.12, 0)
			B.K(G("cone"), BM, 0, 0.2, 0, 0.17, 0.42, 0.1, e); B.K(G("cone"), "#ff9db0", 0, 0.17, 0.04, 0.09, 0.26, 0.05, e)
	if ex.call("roundEars"):
		for s in [-1.0, 1.0]:
			B.K(G("sphere"), BM, s * hw * 0.62, top - 0.08, 0, 0.2, 0.2, 0.1, b); B.K(G("sphere"), "#ff9db0", s * hw * 0.62, top - 0.08, 0.06, 0.11, 0.11, 0.05, b)
	if ex.call("longEars"):
		for ns in [["E1", -1.0], ["E2", 1.0]]:
			var e := B.pivot(b, ns[0], ns[1] * hw * 0.35, top - 0.08, 0)
			B.K(G("capsule"), BM, 0, 0.36, 0, 0.2, 0.42, 0.12, e); B.K(G("capsule"), "#ff9db0", 0, 0.36, 0.04, 0.1, 0.32, 0.06, e)
	if ex.call("dogEars"):
		for s in [-1.0, 1.0]:
			B.K(G("capsule"), "#6b4a2a", s * hw * 0.95, fy, 0, 0.22, 0.32, 0.12, b).rz(s * 0.25)
	if ex.call("beak") or ex.call("carrot"):
		B.K(G("cone"), M("#ff7a1f" if ex.call("carrot") else "#ffb000", {"r": 0.5}), 0, fy - er * 1.4, fz + 0.12, 0.1, 0.28, 0.1, b).rx(PI / 2)
	if ex.call("spout"):
		B.K(G("cyl"), BM, hw * 1.05, cy, 0, 0.08, 0.6, 0.08, b).rz(-0.9); B.K(G("torus"), BM, -hw * 0.98, cy, 0, 0.3, 0.3, 0.8, b).ry(PI / 2)
	if ex.call("wheels"):
		for s in [-1.0, 1.0]:
			for zz in [-0.4, 0.4]:
				B.K(G("cyl"), "#1b1b22", s * hw * 0.95, base + 0.22, zz, 0.2, 0.12, 0.2, b).rz(PI / 2)
	if ex.call("cracks"):
		for i in 4:
			var a: float = rr.call(-1, 1)
			B.K(G("box"), M("#ff6a00", {"e": "#ff4a00", "ei": 2}), sin(a) * hw * 0.9, cy + rr.call(-0.5, 0.5) * hh, cos(a) * hw * 0.88, 0.04, rr.call(0.2, 0.45), 0.03, b).rz(rr.call(-0.6, 0.6))
	if ex.call("flame") or F.has("fire"):
		var f1 := B.pivot(b, "FL1", 0, top - 0.05, 0); B.K(G("cone"), M("#ff9a1f", {"e": "#ff6a00", "ei": 2.2}), 0, 0.25, 0, 0.26, 0.55, 0.26, f1)
		var f2 := B.pivot(b, "FL2", 0, top - 0.05, 0); B.K(G("cone"), Geo.add_mat("#fff27a", 0.9), 0, 0.2, 0, 0.13, 0.36, 0.13, f2)
	if ex.call("fuse"):
		B.K(G("cyl"), "#8a6a3a", 0.15, top + 0.15, 0, 0.03, 0.3, 0.03, b).rz(-0.4); B.K(G("sphere"), M("#ffe14a", {"e": "#ffb000", "ei": 3}), 0.24, top + 0.3, 0, 0.07, 0.07, 0.07, b)
	if ex.call("puffs"):
		for i in 6:
			var a := i / 6.0 * TAU
			B.K(G("ico"), M(col if F.has("glow") else "#ffffff", {"r": 1.0, "flat": true}), cos(a) * hw * 0.95, cy + rr.call(-0.3, 0.3), sin(a) * hw * 0.8 - 0.1, 0.3, 0.26, 0.3, b)
	if ex.call("string"):
		B.K(G("cyl"), "#ffffff", 0, cy - hh - 0.5, 0, 0.015, 1, 0.015, b)
	if ex.call("rays"):
		for i in 8:
			var a := i / 8.0 * TAU
			B.K(G("cone"), M("#ffd23f", {"e": "#ffb000", "ei": 0.8}), cos(a) * hw * 1.2, cy + sin(a) * hw * 1.2, -0.1, 0.12, 0.34, 0.06, b).rz(a - PI / 2)
	if ex.call("craters"):
		var cc := Color.html(col)
		var ccol := "#b0a890" if (cc.r + cc.g + cc.b) / 3.0 > 0.53 else "#555555"
		for i in 5:
			var a: float = rr.call(-1.2, 1.2); var yy: float = cy + rr.call(-0.5, 0.5) * hh
			B.K(G("sphere"), ccol, sin(a) * hw * 0.93, yy, cos(a) * hw * 0.9, 0.13, 0.13, 0.05, b).look_at(Vector3(0, yy, 0))
	if ex.call("bee"):
		for yy in [-0.3, 0.1]:
			B.K(G("torus"), "#1b1b22", 0, cy + yy * hh, 0, hw * 0.98, hw * 0.98, 1.4, b).rx(PI / 2)
	if ex.call("antennae") or F.has("antenna"):
		for s in [-1.0, 1.0]:
			B.K(G("cyl"), "#555555", s * 0.18, top + 0.2, 0, 0.025, 0.42, 0.025, b).rz(-s * 0.3)
			var ac: String = "#ff2a3a" if F.has("antenna") else acc
			B.K(G("sphere"), M(ac, {"e": ac, "ei": 1}), s * 0.29, top + 0.42, 0, 0.07, 0.07, 0.07, b)
	if ex.call("tailfin"):
		B.K(G("cone"), BM, 0, cy + 0.1, -hw * 1.05, 0.08, 0.45, 0.35, b).rx(-PI / 2)
	if ex.call("rotor"):
		var sp := B.pivot(b, "SP", 0, top + 0.12, 0)
		B.K(G("cyl"), "#333333", 0, 0, 0, 0.05, 0.2, 0.05, sp); B.K(G("box"), "#333333", 0, 0.1, 0, 2.2, 0.04, 0.16, sp); B.K(G("box"), "#333333", 0, 0.1, 0, 0.16, 0.04, 2.2, sp)
	if ex.call("towers"):
		for s in [-1.0, 1.0]:
			B.K(G("cyl"), BM, s * hw * 0.8, top + 0.2, 0, 0.16, 0.5, 0.16, b); B.K(G("cone"), "#c0143c", s * hw * 0.8, top + 0.6, 0, 0.2, 0.32, 0.2, b)
	if ex.call("bells"):
		for s in [-1.0, 1.0]:
			B.K(G("hemi"), "#ffd23f", s * hw * 0.5, top - 0.02, 0, 0.22, 0.2, 0.22, b, {"m": 0.9, "r": 0.2})
	if ex.call("panels"):
		for s in [-1.0, 1.0]:
			B.K(G("box"), M("#2f6fd6", {"m": 0.5, "r": 0.2, "e": "#1a3a8a", "ei": 0.3}), s * (hw + 0.45), cy, 0, 0.7, 0.04, 0.4, b)
	if ex.call("ring"):
		B.K(G("torusThin"), M(acc, {"e": acc, "ei": 0.4}), 0, cy, 0, hw * 1.55, hw * 1.55, 6, b).r(1.25, 0.2, 0)
	if ex.call("antlers"):
		for s in [-1.0, 1.0]:
			B.K(G("cyl"), "#8a6a3a", s * 0.25, top + 0.25, 0, 0.04, 0.55, 0.04, b).rz(-s * 0.45); B.K(G("cyl"), "#8a6a3a", s * 0.42, top + 0.38, 0, 0.03, 0.3, 0.03, b).rz(s * 0.4)
	if ex.call("tusks"):
		for s in [-1.0, 1.0]:
			B.K(G("cone"), "#fffaf0", s * 0.2, my - 0.08, fz + 0.1, 0.06, 0.4, 0.06, b).rx(2.4)
	if ex.call("pompom"):
		B.K(G("sphere"), M(acc, {"r": 1.0}), 0, top + 0.12, 0, 0.18, 0.18, 0.18, b)
	if ex.call("visor"):
		B.K(G("sphere"), M("#ffcf3f", {"m": 1, "r": 0.1}), 0, fy, fz - 0.05, hw * 0.75, er * 2.4, 0.2, b)
	if ex.call("stick"):
		B.K(G("cyl"), "#111111", 0, top + 0.25, 0, 0.05, 0.5, 0.05, b); B.K(G("sphere"), "#ff2a3a", 0, top + 0.52, 0, 0.14, 0.14, 0.14, b)
	if ex.call("legs8"):
		for i in 6:
			var s: float = 1.0 if i % 2 else -1.0; var zz: float = (i / 2 - 1) * 0.35
			B.K(G("capsule"), dark, s * (hw + 0.15), base * 0.5 + 0.12, zz, 0.08, 0.3, 0.08, b).rz(s * 1.1)
	if ex.call("screen") and not F.has("antenna"):
		B.K(G("cyl"), "#333333", 0, top + 0.2, 0, 0.03, 0.4, 0.03, b)
	if ex.call("steam"):
		B.K(G("cyl"), M(acc, {"r": 0.4}), 0, top + 0.02, 0, hw * 0.5, 0.06, hw * 0.5, b)
	# adjective accessories (head)
	var hat := func(y: float) -> float: return top + y
	if F.has("crown"):
		var g := M("#ffd23f", {"m": 1, "r": 0.18})
		B.K(Geo.cyl(0.34, 0.3, 0.24, 14, true), M("#ffd23f", {"m": 1, "r": 0.18, "side": true}), 0, hat.call(0.1), 0, 1, 1, 1, b)
		for i in 5:
			var a := i / 5.0 * TAU
			B.K(G("cone"), g, cos(a) * 0.32, hat.call(0.3), sin(a) * 0.32, 0.06, 0.2, 0.06, b)
		B.K(G("oct"), M("#ff2a6a", {"e": "#ff2a6a", "ei": 0.6}), 0, hat.call(0.12), 0.33, 0.06, 0.08, 0.04, b)
	if F.has("horns"):
		for s in [-1.0, 1.0]:
			B.K(G("cone"), "#f4ecd8", s * hw * 0.45, hat.call(0.1), 0, 0.09, 0.42, 0.09, b).rz(-s * 0.45)
	if F.has("devil"):
		for s in [-1.0, 1.0]:
			B.K(G("cone"), "#d01a2a", s * hw * 0.4, hat.call(0.05), 0.05, 0.07, 0.26, 0.07, b).rz(-s * 0.35)
		var t := B.pivot(b, "T", 0, cy - hh * 0.5, -hw * 0.85)
		B.K(G("capsule"), "#d01a2a", 0, 0.05, -0.25, 0.06, 0.25, 0.06, t).rx(-1); B.K(G("cone4"), "#d01a2a", 0, 0.28, -0.48, 0.1, 0.18, 0.04, t)
	if F.has("ninja"):
		B.K(G("torus"), "#e02424", 0, fy + er * 1.9, 0, hw * 0.98, hw * 0.98, 1.2, b).rx(PI / 2); B.K(G("box"), "#e02424", 0.08, fy + er * 1.3, -hw * 0.95, 0.05, 0.35, 0.04, b).rz(0.5)
	if F.has("cowboy"):
		B.K(G("cyl"), "#8a5a2a", 0, hat.call(0.02), 0, 0.62, 0.05, 0.62, b); B.K(G("cyl"), "#8a5a2a", 0, hat.call(0.2), 0, 0.3, 0.36, 0.3, b); B.K(G("cyl"), "#3a2410", 0, hat.call(0.08), 0, 0.31, 0.08, 0.31, b)
	if F.has("helmet"):
		var h := B.K(G("sphere"), Geo.glass_mat("#d9f2ff"), 0, fy, 0.02, hw * 1.12, hw * 1.0, hw * 1.08, b); h.solo = true
		B.K(G("torus"), "#c0c8d0", 0, fy - hw * 0.72, 0, hw * 0.78, hw * 0.78, 1.6, b).rx(PI / 2)
	if F.has("wizard"):
		B.K(G("cyl"), "#4a2a8a", 0, hat.call(0.02), 0, 0.55, 0.05, 0.55, b); B.K(G("cone"), "#4a2a8a", 0, hat.call(0.42), 0, 0.33, 0.8, 0.33, b).rz(-0.15)
		B.K(G("oct"), M("#ffe14a", {"e": "#ffd000", "ei": 1.5}), 0.05, hat.call(0.35), 0.28, 0.07, 0.07, 0.03, b)
	if F.has("chef"):
		B.K(G("cyl"), "#ffffff", 0, hat.call(0.16), 0, 0.3, 0.32, 0.3, b)
		for i in 4:
			B.K(G("sphere"), "#ffffff", cos(i * 1.57) * 0.18, hat.call(0.38), sin(i * 1.57) * 0.18, 0.2, 0.17, 0.2, b)
	if F.has("flower"):
		var fx := hw * 0.35
		B.K(G("sphere"), "#ffd23f", fx, hat.call(0.12), 0.05, 0.08, 0.08, 0.05, b)
		for i in 6:
			var a := i / 6.0 * TAU
			B.K(G("sphere"), M("#ff4f8b" if acc == "#2a2a3a" else acc, {"r": 0.5}), fx + cos(a) * 0.13, hat.call(0.12) + sin(a) * 0.13, 0.04, 0.08, 0.08, 0.04, b)
	if F.has("grad"):
		B.K(G("cyl"), "#1b1b22", 0, hat.call(0.08), 0, 0.26, 0.16, 0.26, b); B.K(G("box"), "#1b1b22", 0, hat.call(0.18), 0, 0.7, 0.04, 0.7, b).ry(0.785); B.K(G("cyl"), "#ffd23f", 0.28, hat.call(0.05), 0.0, 0.02, 0.28, 0.02, b)
	if F.has("disco"):
		var sp := B.pivot(b, "SP", 0, hat.call(0.3), 0)
		B.K(G("ico0"), M("#e0e8f0", {"m": 1, "r": 0.05, "flat": true}), 0, 0, 0, 0.26, 0.26, 0.26, sp); B.K(G("cyl"), "#888888", 0, hat.call(0.05), 0, 0.02, 0.1, 0.02, b)
	if F.has("cap"):
		B.K(G("hemi"), M(acc2, {"r": 0.6}), 0, hat.call(-0.12), 0, hw * 0.72, 0.32, hw * 0.72, b); B.K(G("box"), M(acc2, {"r": 0.6}), 0, hat.call(-0.1), hw * 0.62, hw * 0.9, 0.04, 0.4, b)
	if F.has("phones"):
		B.K(G("halfTorus"), "#1b1b22", 0, fy + 0.05, 0, hw * 1.02, hw * 1.02, 0.5, b)
		for s in [-1.0, 1.0]:
			B.K(G("cyl"), M(acc, {"r": 0.4}), s * hw * 1.0, fy + 0.02, 0, 0.17, 0.12, 0.17, b).rz(PI / 2)
	if F.has("band"):
		B.K(G("torus"), M(acc, {"r": 0.7}), 0, fy + er * 1.9, 0, hw * 0.96, hw * 0.96, 1.5, b).rx(PI / 2)
	if F.has("bow"):
		var bc := M("#e02424" if acc == "#ffffff" else acc, {"r": 0.5})
		for s in [-1.0, 1.0]:
			B.K(G("cone"), bc, s * 0.12, my - 0.22, fz - 0.02, 0.1, 0.18, 0.06, b).rz(s * PI / 2)
		B.K(G("sphere"), bc, 0, my - 0.22, fz, 0.05, 0.05, 0.05, b)
	if F.has("scarf"):
		var sc := M("#e02424" if acc == "#2a2a3a" else acc, {"r": 0.9})
		B.K(G("torus"), sc, 0, my - 0.2, 0, hw * 0.9, hw * 0.9, 2.2, b).rx(PI / 2); B.K(G("box"), sc, hw * 0.4, my - 0.45, fz - 0.05, 0.16, 0.45, 0.06, b)
	if F.has("karate"):
		B.K(G("torus"), "#111111", 0, cy - hh * 0.35, 0, hw * 0.98, hw * 0.98, 1.6, b).rx(PI / 2)
	# patterns
	if F.has("stripes") or F.has("rainbow"):
		for i in 3:
			var yy: float = cy + (i - 1) * hh * 0.45
			var rad: float
			if shape == "cone":
				rad = hw * (0.5 - (yy - cy) / (2 * hh)) * 1.02
			elif shape == "can":
				rad = hw * 1.01
			else:
				rad = hw * sqrt(maxf(0.1, 1 - pow((yy - cy) / hh, 2))) * 1.01
			var pm := M(RAINBOW[i * 2], {"e": RAINBOW[i * 2], "ei": 0.3}) if F.has("rainbow") else M(acc, {"r": 0.5})
			B.K(G("torus"), pm, 0, yy, 0, rad, rad, 1.3, b).rx(PI / 2)
	if F.has("orbit"):
		var o := B.pivot(b, "OR", 0, cy, 0)
		for i in 3:
			var a := i / 3.0 * TAU
			B.K(G("sphere"), M(RAINBOW[i * 2 + 1], {"e": RAINBOW[i * 2 + 1], "ei": 1.4}), cos(a) * (hw + 0.4), sin(i * 2.1) * 0.3, sin(a) * (hw + 0.4), 0.08, 0.08, 0.08, o)
	if F.has("fluffy"):
		for i in 10:
			var a: float = R.next() * TAU; var yy: float = cy + rr.call(-0.7, 0.7) * hh
			B.K(G("ico0"), M(col, {"r": 1.0, "flat": true}), cos(a) * hw * 0.92, yy, sin(a) * hw * 0.88 - 0.05, 0.18, 0.16, 0.18, b)
	# back
	if F.has("wings"):
		var wc: String = rp.call(["#ffffff", "#ffe0f5", "#d0f0ff", acc])
		B.wing(b, "W1", -hw * 0.75, cy + 0.15, -0.15, 1.1, 0.7, wc, "#ffffff"); B.wing(b, "W2", hw * 0.75, cy + 0.15, -0.15, 1.1, 0.7, wc, "#ffffff")
	if F.has("halo"):
		B.K(G("torus"), M("#ffe14a", {"e": "#ffd000", "ei": 2.2}), 0, top + 0.35, 0, 0.3, 0.3, 0.6, b).rx(PI / 2)
		if not F.has("wings"):
			B.wing(b, "W1", -hw * 0.7, cy + 0.2, -0.2, 0.7, 0.5, "#ffffff"); B.wing(b, "W2", hw * 0.7, cy + 0.2, -0.2, 0.7, 0.5, "#ffffff")
	if F.has("cape"):
		B.K(Geo.cyl(hw * 1.02, hw * 1.25, hh * 1.7, 16, true, PI * 0.6, PI * 0.8), M(rp.call(["#c0143c", "#4a2a8a", "#1b1b22", "#2f6fd6"]), {"r": 0.6, "side": true}), 0, cy - hh * 0.1, -0.04, 1, 1, 1, b)
	if F.has("rocket"):
		var f1 := B.pivot(b, "FL1", 0, cy - hh, 0); B.K(G("cone"), M("#ff9a1f", {"e": "#ff7a00", "ei": 2}), 0, -0.28, 0, 0.26, 0.56, 0.26, f1).rx(PI)
		var f2 := B.pivot(b, "FL2", 0, cy - hh, 0); B.K(G("cone"), Geo.add_mat("#fff27a", 0.9), 0, -0.2, 0, 0.14, 0.4, 0.14, f2).rx(PI)
	# limbs
	var type := "fly" if fly else ("wobble" if noLegs else "biped")
	if not fly and not noLegs:
		var lc = rp.call([col, dark, acc2]); var shoe: String = rp.call(["#2a2a3a", "#ff4f8b", "#ffffff", "#2f6fd6", "#ffd23f"]); var lx: float = minf(hw * 0.45, 0.3); var th: float = rr.call(0.07, 0.11)
		B.leg(r, "L1", -lx, 0, legH, lc, shoe, th); B.leg(r, "L2", lx, 0, legH, lc, shoe, th)
		if R.next() < 0.62 or F.has("karate") or F.has("dance"):
			var al: float = rr.call(0.35, 0.5); var ay: float = cy + (-hh * 0.2 if shape == "cone" else hh * 0.05)
			var ax: float = hw * 0.7 if shape == "cone" else (hw + 0.05 if (shape == "tall" or shape == "box") else hw * 0.96)
			B.arm(b, "A1", -ax, ay, al, lc, col, th * 0.85); B.arm(b, "A2", ax, ay, al, lc, col, th * 0.85)
		else:
			type = "hop" if R.next() < 0.6 else "biped"
	return {"type": type, "hover": rr.call(0.4, 0.8) if fly else 0.0, "dance": F.has("dance"), "karate": F.has("karate"), "steam": extra == "steam", "waddle": shape == "egg" and not fly, "bigWings": F.has("wings") and R.next() < 0.3, "scaleMul": 1.25 if F.has("big") else (0.8 if F.has("small") else 1.0)}
