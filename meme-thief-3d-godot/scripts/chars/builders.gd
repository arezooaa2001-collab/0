## Hand-made meme character builders (ported one-to-one from the original three.js builders).
class_name Builders

static func G(n: String) -> Array: return Geo.G(n)
static func M(c, o: Dictionary = {}) -> StandardMaterial3D: return Geo.mat(c, o)

static func build(id: String, B: PB) -> Dictionary:
	match id:
		"potato": return potato(B)
		"slipper": return slipper(B)
		"cucumber": return cucumber(B)
		"chick": return chick(B)
		"teapot": return teapot(B)
		"cat": return cat(B)
		"melon": return melon(B)
		"frog": return frog(B)
		"bread": return bread(B)
		"dog": return dog(B)
		"eggplant": return eggplant(B)
		"penguin": return penguin(B)
		"samovar": return samovar(B)
		"shark": return shark(B)
		"elephant": return elephant(B)
		"banana": return banana(B)
		"croc": return croc(B)
		"lion": return lion(B)
		"pizzabot": return pizzabot(B)
		"owl": return owl(B)
		"dragon": return dragon(B)
		"camel": return camel(B)
		"eagle": return eagle(B)
		"octopus": return octopus(B)
		"ghost": return ghost(B)
		"cosmiccat": return cosmiccat(B)
		"simorgh": return simorgh(B)
		"golem": return golem(B)
		"jelly": return jelly(B)
		"phoenix": return phoenix(B)
		"sugar": return sugar(B)
		"goldfish": return goldfish(B)
		"paykan": return paykan(B)
		"cooker": return cooker(B)
		"div": return div(B)
		"rostam": return rostam(B)
		"ninjacat": return ninjacat(B)
		"whale": return whale(B)
		"unicorn": return unicorn(B)
		"angel": return angel(B)
		"memeking": return memeking(B)
	return potato(B)

static func potato(B: PB) -> Dictionary:
	var b := B.body; var r := B.root
	B.P(G("sphere"), "#c79a5b", 0, 0.95, 0, 0.72, 0.86, 0.66, b, {"r": 0.85})
	for p in [[0.4, 1.3, 0.4], [-0.5, 0.8, 0.35], [0.3, 0.6, 0.5], [-0.2, 1.5, -0.4], [0.55, 1.0, -0.3]]:
		B.P(G("sphere"), "#9c7440", p[0], p[1], p[2], 0.08, 0.06, 0.08, b)
	for s in [-1.0, 1.0]:
		B.K(G("capsule"), "#3a2410", s * 0.22, 1.12, 0.6, 0.06, 0.12, 0.05, b).rz(PI / 2)
	B.K(G("sphere"), "#ff9db0", -0.38, 0.98, 0.52, 0.09, 0.06, 0.04, b); B.K(G("sphere"), "#ff9db0", 0.38, 0.98, 0.52, 0.09, 0.06, 0.04, b)
	B.smile(b, 0.86, 0.62, 0.1, "#3a2410")
	B.P(G("cone"), "#4f7dff", 0.15, 1.95, -0.05, 0.5, 0.75, 0.5, b).rz(-0.5)
	B.P(G("torus"), "#ffffff", 0.02, 1.72, -0.02, 0.48, 0.48, 0.9, b).rx(PI / 2)
	B.P(G("sphere"), "#ffffff", 0.52, 2.15, -0.05, 0.13, 0.13, 0.13, b)
	B.leg(r, "L1", -0.25, 0, 0.32, "#c79a5b", "#6b4a2a"); B.leg(r, "L2", 0.25, 0, 0.32, "#c79a5b", "#6b4a2a")
	B.arm(b, "A1", -0.68, 1.0, 0.35, "#c79a5b", "#c79a5b"); B.arm(b, "A2", 0.68, 1.0, 0.35, "#c79a5b", "#c79a5b")
	return {"type": "biped", "zz": true}

static func slipper(B: PB) -> Dictionary:
	var b := B.body
	B.P(Geo.rbox(0.9, 0.2, 1.9, 0.1), "#2f80ed", 0, 1.0, 0, 1, 1, 1, b, {"r": 0.6})
	B.P(Geo.rbox(0.86, 0.08, 1.86, 0.04), "#ffffff", 0, 1.13, 0, 1, 1, 1, b)
	for s in [-1.0, 1.0]:
		B.P(G("capsule"), "#ff4f8b", s * 0.25, 1.32, 0.15, 0.12, 0.35, 0.12, b).r(0.3, 0, s * 0.9)
	B.P(G("sphere"), "#ff4f8b", 0, 1.18, 0.55, 0.09, 0.07, 0.09, b)
	B.eyes(b, 1.3, 0.7, 0.17, 0.12); B.brows(b, 1.47, 0.78, 0.18, -0.3); B.smile(b, 1.18, 0.95, 0.09)
	B.wing(b, "W1", -0.42, 1.15, -0.2, 0.9, 0.6, "#ffffff", "#eaf2ff"); B.wing(b, "W2", 0.42, 1.15, -0.2, 0.9, 0.6, "#ffffff", "#eaf2ff")
	return {"type": "fly", "hover": 0.35}

static func cucumber(B: PB) -> Dictionary:
	var b := B.body; var r := B.root
	B.P(G("capsule"), "#3f9d3a", 0, 1.2, 0, 0.82, 0.75, 0.82, b, {"r": 0.5})
	for i in 14:
		var a := i * 2.4; var y := 0.6 + (i % 7) * 0.2
		B.P(G("sphere"), "#7fd36a", cos(a) * 0.4, y, sin(a) * 0.4, 0.05, 0.05, 0.05, b)
	B.P(G("sphere"), "#2e7a2b", 0, 1.95, 0, 0.2, 0.1, 0.2, b)
	B.eyes(b, 1.4, 0.36, 0.17, 0.11)
	for s in [-1.0, 1.0]:
		B.K(G("torus"), "#111111", s * 0.17, 1.4, 0.44, 0.17, 0.17, 0.3, b)
	B.K(G("box"), "#111111", 0, 1.42, 0.45, 0.12, 0.03, 0.03, b)
	B.smile(b, 1.12, 0.4, 0.12, "#1c3a10")
	B.leg(r, "L1", -0.18, 0, 0.42, "#3f9d3a", "#ff6b3d", 0.07); B.leg(r, "L2", 0.18, 0, 0.42, "#3f9d3a", "#ff6b3d", 0.07)
	B.arm(b, "A1", -0.43, 1.2, 0.45, "#3f9d3a", "#7fd36a", 0.06); B.arm(b, "A2", 0.43, 1.2, 0.45, "#3f9d3a", "#7fd36a", 0.06)
	return {"type": "biped"}

static func chick(B: PB) -> Dictionary:
	var b := B.body; var r := B.root
	B.P(G("sphere"), "#ffd84a", 0, 0.95, 0, 0.62, 0.66, 0.6, b, {"r": 0.7})
	for i in 3:
		B.P(G("cone"), "#ffd84a", (i - 1) * 0.1, 1.65, -0.05, 0.08, 0.22, 0.08, b).rz((i - 1) * 0.5)
	B.eyes(b, 1.15, 0.45, 0.2, 0.12, {"pupil": 0.4}); B.brows(b, 1.33, 0.53, 0.2, 0.45, "#3a2a00")
	B.K(G("cone"), "#ff8a1f", 0, 0.98, 0.65, 0.14, 0.24, 0.1, b).rx(PI / 2 - 0.35)
	B.K(G("cone"), "#ff6a00", 0, 0.86, 0.62, 0.12, 0.2, 0.08, b).rx(PI / 2 + 0.45)
	B.K(G("sphere"), "#7a1020", 0, 0.92, 0.6, 0.08, 0.06, 0.05, b)
	B.wing(b, "W1", -0.58, 1.0, 0, 0.4, 0.45, "#ffcb2a"); B.wing(b, "W2", 0.58, 1.0, 0, 0.4, 0.45, "#ffcb2a")
	B.leg(r, "L1", -0.2, 0, 0.38, "#ff8a1f", "#ff8a1f", 0.05); B.leg(r, "L2", 0.2, 0, 0.38, "#ff8a1f", "#ff8a1f", 0.05)
	return {"type": "biped", "scream": true}

static func teapot(B: PB) -> Dictionary:
	var b := B.body; var r := B.root
	B.P(G("sphere"), "#f2f6ff", 0, 0.95, 0, 0.62, 0.52, 0.62, b, {"r": 0.2, "m": 0.1})
	B.P(G("torus"), "#3b6fd6", 0, 0.95, 0, 0.6, 0.6, 0.6, b).rx(PI / 2)
	for i in 6:
		var a := i / 6.0 * TAU
		B.P(G("sphere"), "#3b6fd6", cos(a) * 0.5, 1.15, sin(a) * 0.5, 0.06, 0.06, 0.06, b)
	B.P(G("cyl"), "#f2f6ff", 0.72, 1.12, 0, 0.08, 0.6, 0.08, b).rz(-0.9)
	B.P(G("torus"), "#f2f6ff", -0.66, 1.0, 0, 0.26, 0.26, 0.6, b)
	B.P(G("hemi"), "#3b6fd6", 0, 1.4, 0, 0.36, 0.18, 0.36, b); B.P(G("sphere"), "#ffd23f", 0, 1.62, 0, 0.09, 0.09, 0.09, b, {"m": 0.8, "r": 0.3})
	B.eyes(b, 1.03, 0.52, 0.18, 0.1); B.brows(b, 1.18, 0.58, 0.18, 0.5); B.smile(b, 0.82, 0.57, 0.1, "#3a1020", false, PI)
	B.leg(r, "L1", -0.22, 0, 0.45, "#3b6fd6", "#1d3c80", 0.07); B.leg(r, "L2", 0.22, 0, 0.45, "#3b6fd6", "#1d3c80", 0.07)
	return {"type": "wobble", "steam": true}

static func cat(B: PB) -> Dictionary:
	var b := B.body; var r := B.root
	B.P(G("capsule"), "#f0a040", 0, 0.75, -0.1, 0.62, 0.6, 0.62, b).rx(PI / 2)
	B.P(G("sphere"), "#f0a040", 0, 1.25, 0.55, 0.5, 0.45, 0.45, b)
	for s in [-1.0, 1.0]:
		B.P(G("cone"), "#f0a040", s * 0.3, 1.68, 0.5, 0.15, 0.3, 0.1, b).rz(-s * 0.3)
		B.K(G("cone"), "#ffb0c0", s * 0.3, 1.66, 0.54, 0.08, 0.18, 0.05, b).rz(-s * 0.3)
	for s in [-1.0, 1.0]:
		for i in 3:
			B.P(G("box"), "#d07a20", s * 0.15, 1.15 + i * 0.12, 0.22, 0.06, 0.04, 0.4, b)
	B.eyes(b, 1.32, 0.88, 0.17, 0.17, {"pupil": 0.25})
	B.K(G("sphere"), "#5a1020", 0, 1.06, 0.95, 0.09, 0.12, 0.05, b)
	for s in [-1.0, 1.0]:
		for k in 2:
			B.K(G("box"), "#ffffff", s * 0.42, 1.15 - k * 0.07, 0.86, 0.35, 0.015, 0.015, b).rz(s * (0.15 - k * 0.3))
	var t := B.pivot(b, "T", 0, 0.85, -0.7); B.P(G("capsule"), "#f0a040", 0, 0.35, -0.15, 0.12, 0.35, 0.12, t).rx(-0.5)
	B.leg(r, "L1", -0.22, 0.3, 0.5, "#f0a040", null, 0.1); B.leg(r, "L2", 0.22, 0.3, 0.5, "#f0a040", null, 0.1)
	B.leg(r, "L3", -0.22, -0.45, 0.5, "#f0a040", null, 0.1); B.leg(r, "L4", 0.22, -0.45, 0.5, "#f0a040", null, 0.1)
	return {"type": "quad"}

static func melon(B: PB) -> Dictionary:
	var b := B.body; var r := B.root
	var g := B.group(b, 0, 1.25, 0); g.rotation.x = PI / 2
	B.P(Geo.cyl(0.95, 0.95, 0.5, 24, false, -PI / 2, PI), M("#2f8a3a", {"r": 0.5}), 0, 0, 0, 1, 1, 1, g)
	B.P(Geo.cyl(0.85, 0.85, 0.52, 24, false, -PI / 2, PI), M("#ff4d6a", {"r": 0.5}), 0, 0, 0, 1, 1, 1, g)
	B.P(G("box"), "#ff4d6a", 0, 1.25, 0, 1.9, 0.04, 0.52, b)
	for i in 7:
		var a := PI + 0.35 + i * 0.4
		B.K(G("sphere"), "#111111", cos(a) * 0.55, 1.25 + sin(a) * 0.55, 0.27, 0.04, 0.06, 0.02, b)
	B.eyes(b, 1.02, 0.28, 0.25, 0.12); B.smile(b, 0.82, 0.27, 0.2, "#6a0a1a", true)
	B.leg(r, "L1", -0.25, 0, 0.35, "#2f8a3a", "#ffffff", 0.07); B.leg(r, "L2", 0.25, 0, 0.35, "#2f8a3a", "#ffffff", 0.07)
	B.arm(b, "A1", -0.8, 1.0, 0.4, "#2f8a3a", "#2f8a3a", 0.06); B.arm(b, "A2", 0.8, 1.0, 0.4, "#2f8a3a", "#2f8a3a", 0.06)
	return {"type": "hop"}

static func frog(B: PB) -> Dictionary:
	var b := B.body; var r := B.root
	B.P(G("sphere"), "#5cc45a", 0, 0.72, 0, 0.75, 0.6, 0.7, b, {"r": 0.4})
	B.P(G("sphere"), "#cdf5a8", 0, 0.62, 0.32, 0.55, 0.42, 0.45, b)
	for s in [-1.0, 1.0]:
		B.P(G("sphere"), "#5cc45a", s * 0.33, 1.22, 0.25, 0.25, 0.25, 0.25, b); B.eye(b, s * 0.33, 1.25, 0.38, 0.17, {"pupil": 0.5, "sy": 0.6, "ly": -0.2})
	B.K(G("box"), "#2a5a20", 0, 0.85, 0.66, 0.6, 0.04, 0.04, b)
	B.P(G("cyl"), "#d62a3a", 0.05, 1.5, 0.15, 0.5, 0.12, 0.45, b).rz(0.2); B.P(G("sphere"), "#d62a3a", 0.1, 1.6, 0.15, 0.06, 0.06, 0.06, b)
	B.P(G("cyl"), "#5a3010", 0.25, 0.82, 0.75, 0.03, 0.4, 0.03, b).r(PI / 2, 0, 0.3)
	B.P(G("cyl"), "#5a3010", 0.37, 0.9, 0.95, 0.09, 0.16, 0.09, b)
	B.leg(r, "L1", -0.4, 0.2, 0.22, "#4aa548", null, 0.13); B.leg(r, "L2", 0.4, 0.2, 0.22, "#4aa548", null, 0.13)
	return {"type": "hop", "pipe": true}

static func bread(B: PB) -> Dictionary:
	var b := B.body; var r := B.root
	B.P(Geo.rbox(0.9, 1.5, 0.4, 0.18), "#d9963e", 0, 1.25, 0, 1, 1, 1, b, {"r": 0.75})
	for i in 4:
		B.P(G("box"), "#b06a20", 0, 0.75 + i * 0.32, 0.2, 0.7, 0.05, 0.04, b)
	for i in 24:
		B.P(G("sphere"), "#fff3d0", U.rnd(-0.38, 0.38), U.rnd(0.6, 1.9), 0.21, 0.02, 0.035, 0.015, b)
	B.eyes(b, 1.55, 0.24, 0.16, 0.1); B.smile(b, 1.38, 0.23, 0.12, "#5a2a00", true)
	B.leg(r, "L1", -0.2, 0, 0.5, "#d9963e", "#ff4f8b", 0.06); B.leg(r, "L2", 0.2, 0, 0.5, "#d9963e", "#ff4f8b", 0.06)
	B.arm(b, "A1", -0.48, 1.4, 0.45, "#d9963e", "#ffffff", 0.06, 0.8); B.arm(b, "A2", 0.48, 1.4, 0.45, "#d9963e", "#ffffff", 0.06, 0.8)
	return {"type": "biped", "dance": true}

static func dog(B: PB) -> Dictionary:
	var b := B.body; var r := B.root
	B.P(G("capsule"), "#c98a4b", 0, 0.85, -0.15, 0.7, 0.6, 0.7, b).rx(PI / 2)
	B.P(G("sphere"), "#f4e6d0", 0, 0.75, 0.15, 0.4, 0.3, 0.5, b)
	B.P(G("sphere"), "#c98a4b", 0, 1.35, 0.55, 0.45, 0.42, 0.42, b)
	B.P(G("sphere"), "#f4e6d0", 0, 1.22, 0.88, 0.24, 0.18, 0.22, b); B.K(G("sphere"), "#111111", 0, 1.3, 1.08, 0.08, 0.06, 0.06, b)
	B.K(G("capsule"), "#ff7aa0", 0.05, 1.05, 1.0, 0.1, 0.12, 0.05, b).rx(0.4)
	for s in [-1.0, 1.0]:
		var e := B.pivot(b, "E1" if s < 0 else "E2", s * 0.38, 1.6, 0.5); B.P(G("sphere"), "#7a4a20", 0, -0.25, 0, 0.13, 0.3, 0.07, e); e.rotation.z = s * 0.3
	var gl := M("#0d0d14", {"m": 0.9, "r": 0.1})
	B.K(Geo.rbox(0.3, 0.16, 0.06, 0.03), gl, -0.17, 1.45, 0.94, 1, 1, 1, b); B.K(Geo.rbox(0.3, 0.16, 0.06, 0.03), gl, 0.17, 1.45, 0.94, 1, 1, 1, b)
	B.K(G("box"), "#0d0d14", 0, 1.5, 0.94, 0.7, 0.04, 0.04, b)
	B.K(G("box"), "#ffffff", -0.22, 1.49, 0.98, 0.08, 0.03, 0.01, b)
	var t := B.pivot(b, "T", 0, 1.0, -0.85); B.P(G("capsule"), "#c98a4b", 0, 0.22, 0, 0.12, 0.25, 0.12, t).rx(-0.6)
	for l in [["L1", -0.24, 0.3], ["L2", 0.24, 0.3], ["L3", -0.24, -0.55], ["L4", 0.24, -0.55]]:
		B.leg(r, l[0], l[1], l[2], 0.55, "#c98a4b", "#f4e6d0", 0.1)
	return {"type": "quad"}

static func eggplant(B: PB) -> Dictionary:
	var b := B.body; var r := B.root
	B.P(G("sphere"), "#6b2fa0", 0, 1.15, 0, 0.55, 0.85, 0.55, b, {"r": 0.25, "m": 0.1}).rz(0.08)
	for i in 5:
		var a := i / 5.0 * TAU
		B.P(G("cone"), "#3f9d3a", cos(a) * 0.2, 1.92, sin(a) * 0.2, 0.12, 0.3, 0.12, b).r(sin(a) * 1.2, 0, -cos(a) * 1.2)
	B.P(G("cyl"), "#3f9d3a", 0, 2.08, 0, 0.06, 0.25, 0.06, b)
	B.P(G("torus"), "#e02424", 0, 1.6, 0, 0.47, 0.47, 0.8, b).rx(PI / 2)
	B.P(G("box"), "#e02424", 0.1, 1.5, -0.5, 0.08, 0.35, 0.04, b).rz(0.5)
	B.P(G("torus"), "#111111", 0, 0.85, 0, 0.53, 0.53, 0.9, b).rx(PI / 2)
	B.eyes(b, 1.38, 0.44, 0.16, 0.1); B.brows(b, 1.5, 0.5, 0.17, 0.55); B.smile(b, 1.15, 0.5, 0.1, "#2a0a3a", false, PI)
	B.leg(r, "L1", -0.22, 0, 0.45, "#6b2fa0", "#ffffff", 0.07); B.leg(r, "L2", 0.22, 0, 0.45, "#6b2fa0", "#ffffff", 0.07)
	B.arm(b, "A1", -0.52, 1.25, 0.42, "#6b2fa0", "#ffffff", 0.07); B.arm(b, "A2", 0.52, 1.25, 0.42, "#6b2fa0", "#ffffff", 0.07)
	return {"type": "biped", "karate": true}

static func penguin(B: PB) -> Dictionary:
	var b := B.body; var r := B.root
	B.P(G("sphere"), "#1d1f2e", 0, 1.1, 0, 0.6, 0.85, 0.55, b, {"r": 0.35})
	B.P(G("sphere"), "#ffffff", 0, 1.0, 0.22, 0.45, 0.65, 0.38, b)
	B.eyes(b, 1.55, 0.42, 0.15, 0.09)
	B.K(G("cone"), "#ff9f1a", 0, 1.42, 0.58, 0.09, 0.22, 0.07, b).rx(PI / 2)
	for s in [-1.0, 1.0]:
		B.P(G("cone"), "#e02424", s * 0.12, 1.25, 0.58, 0.08, 0.16, 0.06, b).rz(s * PI / 2)
	B.P(G("sphere"), "#e02424", 0, 1.25, 0.6, 0.04, 0.04, 0.04, b)
	B.P(G("cyl"), "#0b0b10", 0, 2.25, 0, 0.3, 0.45, 0.3, b, {"r": 0.3}); B.P(G("cyl"), "#0b0b10", 0, 2.03, 0, 0.45, 0.04, 0.45, b); B.P(G("cyl"), "#e02424", 0, 2.1, 0, 0.31, 0.07, 0.31, b)
	B.arm(b, "A1", -0.55, 1.35, 0.55, "#1d1f2e", null, 0.08, 0.35); B.arm(b, "A2", 0.55, 1.35, 0.55, "#1d1f2e", null, 0.08, 0.35)
	B.leg(r, "L1", -0.2, 0.05, 0.3, "#ff9f1a", "#ff9f1a", 0.06); B.leg(r, "L2", 0.2, 0.05, 0.3, "#ff9f1a", "#ff9f1a", 0.06)
	return {"type": "biped", "waddle": true}

static func samovar(B: PB) -> Dictionary:
	var b := B.body
	var gold := {"m": 1.0, "r": 0.22}
	B.P(G("cyl"), "#d4a73a", 0, 0.55, 0, 0.45, 0.2, 0.45, b, gold); B.P(G("cyl"), "#d4a73a", 0, 0.75, 0, 0.18, 0.3, 0.18, b, gold)
	B.P(G("sphere"), "#e8c25a", 0, 1.25, 0, 0.62, 0.62, 0.62, b, gold)
	B.P(G("torus"), "#b8862a", 0, 1.25, 0, 0.62, 0.62, 0.7, b, gold).rx(PI / 2)
	B.P(G("cyl"), "#d4a73a", 0, 1.9, 0, 0.25, 0.25, 0.25, b, gold); B.P(G("sphere"), "#2f80ed", 0, 2.2, 0, 0.28, 0.22, 0.28, b, {"r": 0.2}); B.P(G("sphere"), "#ffd23f", 0, 2.42, 0, 0.07, 0.07, 0.07, b, gold)
	B.P(G("cyl"), "#b8862a", 0, 0.98, 0.65, 0.05, 0.3, 0.05, b, gold).rx(PI / 2)
	for s in [-1.0, 1.0]:
		B.P(G("torus"), "#b8862a", s * 0.68, 1.35, 0, 0.16, 0.16, 0.6, b, gold).ry(PI / 2)
	B.eyes(b, 1.4, 0.55, 0.2, 0.12); B.brows(b, 1.56, 0.6, 0.2, -0.2); B.smile(b, 1.15, 0.6, 0.12)
	for s in [-1.0, 1.0]:
		B.P(G("cyl"), "#59636e", s * 0.32, 1.1, -0.6, 0.16, 0.6, 0.16, b, {"m": 0.8, "r": 0.3}).rx(PI / 2)
		var fl := B.pivot(b, "FL1" if s < 0 else "FL2", s * 0.32, 1.1, -0.95)
		B.K(G("cone"), M("#ff9a1f", {"e": "#ff7a00", "ei": 2}), 0, 0, -0.3, 0.14, 0.6, 0.14, fl).rx(-PI / 2)
		B.K(G("cone"), Geo.add_mat("#fff27a", 0.9), 0, 0, -0.2, 0.08, 0.4, 0.08, fl).rx(-PI / 2)
	return {"type": "fly", "hover": 0.45, "flames": true}

static func shark(B: PB) -> Dictionary:
	var b := B.body; var r := B.root
	B.P(G("sphere"), "#7d93a8", 0, 1.35, 0, 0.55, 0.62, 1.2, b, {"r": 0.35}).rx(-0.15)
	B.P(G("sphere"), "#eef2f6", 0, 1.15, 0.2, 0.42, 0.42, 0.95, b)
	B.P(G("cone"), "#6a8196", 0, 2.05, -0.2, 0.32, 0.6, 0.12, b).rx(-0.4)
	var tl := B.pivot(b, "T", 0, 1.45, -1.15)
	for s in [-1.0, 1.0]:
		B.P(G("cone"), "#6a8196", 0, s * 0.3, -0.25, 0.1, 0.65, 0.22, tl).rx(-PI / 2 + s * 0.8)
	for s in [-1.0, 1.0]:
		B.P(G("cone"), "#6a8196", s * 0.55, 1.1, 0.3, 0.12, 0.5, 0.25, b).rz(s * 2.2)
	B.eyes(b, 1.55, 0.95, 0.25, 0.1, {"pupil": 0.65})
	B.K(G("box"), "#3a1020", 0, 1.15, 1.12, 0.5, 0.12, 0.08, b)
	for i in 6:
		B.K(G("cone"), "#ffffff", -0.2 + i * 0.08, 1.2, 1.15, 0.03, 0.09, 0.03, b).rx(PI)
	B.leg(r, "L1", -0.25, 0, 0.75, "#7d93a8", "#2f80ed", 0.1); B.leg(r, "L2", 0.25, 0, 0.75, "#7d93a8", "#2f80ed", 0.1)
	for s in [-1.0, 1.0]:
		B.K(Geo.rbox(0.28, 0.06, 0.42, 0.02), "#ffffff", s * 0.25, 0.02, 0.06, 1, 1, 1, r)
	return {"type": "biped"}

static func elephant(B: PB) -> Dictionary:
	var b := B.body; var r := B.root
	B.P(G("sphere"), "#5aa860", 0, 1.25, -0.1, 0.85, 0.75, 1.0, b, {"r": 0.55})
	B.P(G("sphere"), "#5aa860", 0, 1.6, 0.85, 0.55, 0.52, 0.5, b)
	for i in 30:
		var th := U.rnd(0, TAU); var ph := U.rnd(0.2, 1.6)
		var x := cos(th) * sin(ph) * 0.85; var y := 1.25 + cos(ph) * 0.75; var z := -0.1 + sin(th) * sin(ph) * 1.0
		B.P(G("cone"), "#f6f0c0", x, y, z, 0.03, 0.12, 0.03, b).look_at(Vector3(x * 2, y * 2 - 1.25, z * 2)).rotx(PI / 2)
	for s in [-1.0, 1.0]:
		var e := B.pivot(b, "E1" if s < 0 else "E2", s * 0.5, 1.7, 0.7); B.P(G("sphere"), "#ff8fb5", s * 0.25, 0, 0, 0.35, 0.42, 0.06, e)
	var tr := B.pivot(b, "T", 0, 1.45, 1.25)
	for i in 5:
		B.P(G("sphere"), "#5aa860", 0, -i * 0.15, i * 0.05, 0.16 - i * 0.015, 0.16 - i * 0.015, 0.16 - i * 0.015, tr)
	B.eyes(b, 1.78, 1.25, 0.2, 0.1)
	B.P(G("sphere"), "#ff4f8b", 0, 2.15, 0.85, 0.12, 0.08, 0.12, b)
	for i in 5:
		var a := i / 5.0 * TAU
		B.P(G("sphere"), "#ffd0e0", cos(a) * 0.14, 2.15, 0.85 + sin(a) * 0.14, 0.09, 0.05, 0.09, b)
	for l in [["L1", -0.4, 0.45], ["L2", 0.4, 0.45], ["L3", -0.4, -0.6], ["L4", 0.4, -0.6]]:
		B.leg(r, l[0], l[1], l[2], 0.65, "#4f9a55", "#e8e0b0", 0.17)
	return {"type": "quad"}

static func banana(B: PB) -> Dictionary:
	var b := B.body; var r := B.root
	var y0 := 0.9
	var pts := [[0, 0], [0.12, 0.35], [0.2, 0.7], [0.18, 1.05], [0.08, 1.35]]
	for i in pts.size():
		B.P(G("sphere"), "#ffd84a", pts[i][0] - 0.1, y0 + pts[i][1], 0, 0.36 - absf(i - 2) * 0.05, 0.3, 0.33, b, {"r": 0.45})
	B.P(G("cyl"), "#6b4a20", -0.02, y0 + 1.62, 0, 0.06, 0.25, 0.06, b)
	var h := B.K(G("sphere"), Geo.glass_mat("#d9f2ff"), 0.05, y0 + 1.05, 0.05, 0.62, 0.62, 0.62, b); h.solo = true
	B.P(G("torus"), "#e6ebf2", 0.05, y0 + 0.55, 0.05, 0.55, 0.55, 1, b, {"m": 0.6, "r": 0.3}).rx(PI / 2)
	B.P(Geo.rbox(0.6, 0.7, 0.3, 0.08), "#e6ebf2", 0, y0 + 0.4, -0.45, 1, 1, 1, b, {"m": 0.2})
	B.P(G("cyl"), "#999999", 0.3, y0 + 1.75, 0, 0.02, 0.4, 0.02, b); B.K(G("sphere"), M("#ff3344", {"e": "#ff2233", "ei": 2}), 0.3, y0 + 1.97, 0, 0.06, 0.06, 0.06, b)
	B.eyes(b, y0 + 1.05, 0.3, 0.13, 0.09); B.smile(b, y0 + 0.85, 0.32, 0.09)
	B.leg(r, "L1", -0.18, 0, 0.6, "#e6ebf2", "#7a8494", 0.1); B.leg(r, "L2", 0.18, 0, 0.6, "#e6ebf2", "#7a8494", 0.1)
	B.arm(b, "A1", -0.42, y0 + 0.55, 0.45, "#e6ebf2", "#7a8494", 0.08); B.arm(b, "A2", 0.42, y0 + 0.55, 0.45, "#e6ebf2", "#7a8494", 0.08)
	return {"type": "fly", "hover": 0.25, "floaty": true}

static func croc(B: PB) -> Dictionary:
	var b := B.body; var r := B.root
	B.P(Geo.rbox(0.9, 0.6, 2.0, 0.25), "#3e8a3a", 0, 0.95, -0.1, 1, 1, 1, b, {"r": 0.5})
	for i in 6:
		B.P(G("cone"), "#2f6e2c", 0, 1.3, -0.9 + i * 0.32, 0.08, 0.18, 0.12, b)
	B.P(Geo.rbox(0.6, 0.3, 0.9, 0.12), "#3e8a3a", 0, 0.95, 1.3, 1, 1, 1, b)
	for i in 6:
		for s in [-1.0, 1.0]:
			B.K(G("cone"), "#ffffff", s * 0.28, 0.8, 0.95 + i * 0.13, 0.03, 0.08, 0.03, b).rx(PI)
	for s in [-1.0, 1.0]:
		B.P(G("sphere"), "#3e8a3a", s * 0.22, 1.35, 0.75, 0.15, 0.15, 0.15, b); B.eye(b, s * 0.22, 1.4, 0.82, 0.1, {"iris": "#ffd23f"})
	var tl := B.pivot(b, "T", 0, 0.95, -1.1); B.P(G("cone"), "#3e8a3a", 0, 0, -0.5, 0.25, 1.0, 0.18, tl).rx(-PI / 2)
	B.P(G("cyl"), "#59636e", 0, 1.55, 0, 0.06, 0.5, 0.06, b, {"m": 0.8})
	var sp := B.pivot(b, "SP", 0, 1.82, 0)
	B.P(G("box"), "#2d3142", 0, 0, 0, 3.0, 0.05, 0.2, sp, {"m": 0.6}); B.P(G("box"), "#2d3142", 0, 0, 0, 0.2, 0.05, 3.0, sp, {"m": 0.6}); B.P(G("sphere"), "#ffd23f", 0, 0.05, 0, 0.12, 0.08, 0.12, sp)
	var sx := B.pivot(tl, "SPX", 0.15, 0.2, -0.9); B.P(G("box"), "#2d3142", 0, 0, 0, 0.03, 0.7, 0.1, sx)
	for l in [["L1", -0.35, 0.55], ["L2", 0.35, 0.55], ["L3", -0.35, -0.65], ["L4", 0.35, -0.65]]:
		B.leg(r, l[0], l[1], l[2], 0.4, "#3e8a3a", "#2f6e2c", 0.1)
	return {"type": "fly", "hover": 0.6, "heli": true}

static func lion(B: PB) -> Dictionary:
	var b := B.body; var r := B.root
	B.P(G("capsule"), "#e0a54a", 0, 1.05, -0.2, 0.8, 0.7, 0.8, b).rx(PI / 2)
	for i in 16:
		var a := i / 16.0 * TAU
		B.P(G("sphere"), "#b8641e" if i % 2 else "#d07a28", cos(a) * 0.55, 1.72 + sin(a) * 0.55, 0.55, 0.3, 0.3, 0.25, b)
	B.P(G("sphere"), "#e8b05a", 0, 1.72, 0.7, 0.5, 0.48, 0.42, b)
	for s in [-1.0, 1.0]:
		B.P(G("sphere"), "#e8b05a", s * 0.38, 2.15, 0.6, 0.12, 0.12, 0.06, b)
	B.eyes(b, 1.85, 1.05, 0.17, 0.1, {"iris": "#3a2a00"}); B.brows(b, 1.98, 1.12, 0.17, -0.3, "#7a4210")
	B.K(G("sphere"), "#6a3010", 0, 1.68, 1.12, 0.1, 0.07, 0.06, b)
	var gm := M("#ffd23f", {"m": 1, "r": 0.2})
	for s in [-1.0, 1.0]:
		B.K(G("capsule"), gm, s * 0.28, 1.55, 1.08, 0.12, 0.42, 0.12, b).rz(s * 1.2)
		B.K(G("sphere"), gm, s * 0.55, 1.7, 1.0, 0.08, 0.08, 0.08, b)
	var t := B.pivot(b, "T", 0, 1.15, -1.0); B.P(G("capsule"), "#e0a54a", 0, 0.3, -0.25, 0.1, 0.35, 0.1, t).rx(-0.8); B.P(G("sphere"), "#b8641e", 0, 0.58, -0.5, 0.16, 0.16, 0.16, t)
	for l in [["L1", -0.28, 0.35], ["L2", 0.28, 0.35], ["L3", -0.28, -0.65], ["L4", 0.28, -0.65]]:
		B.leg(r, l[0], l[1], l[2], 0.62, "#e0a54a", "#f4dcae", 0.13)
	return {"type": "quad"}

static func pizzabot(B: PB) -> Dictionary:
	var b := B.body; var r := B.root
	var metal := {"m": 0.85, "r": 0.25}
	B.P(Geo.rbox(0.95, 0.9, 0.7, 0.12), "#d63a3a", 0, 1.15, 0, 1, 1, 1, b, metal)
	B.P(Geo.rbox(0.5, 0.35, 0.05, 0.04), "#1a1a24", 0, 1.2, 0.36, 1, 1, 1, b)
	for i in 3:
		var c: String = ["#3df2b0", "#ffd23f", "#ff4f8b"][i]
		B.K(G("box"), M(c, {"e": c, "ei": 1.5}), -0.15 + i * 0.15, 1.2, 0.39, 0.08, 0.08, 0.02, b)
	var hg := B.group(b, 0, 1.62, 0)
	B.P(Geo.cyl(0.75, 0.75, 0.14, 3), M("#ffcc4d", {"r": 0.6}), 0, 0.75, 0, 1, 1, 1, hg).rx(PI / 2)
	B.P(Geo.cyl(0.66, 0.66, 0.15, 3), M("#ff9f1a", {"r": 0.7}), 0, 0.72, 0.005, 1, 1, 1, hg).rx(PI / 2)
	B.P(Geo.rbox(1.36, 0.22, 0.24, 0.08), "#d9963e", 0, 1.15, 0, 1, 1, 1, hg)
	for xy in [[-0.22, 0.95], [0.2, 0.9], [0, 0.5], [0.05, 0.25]]:
		B.P(G("cyl"), "#c0392b", xy[0], xy[1], 0.09, 0.09, 0.03, 0.09, hg).rx(PI / 2)
	for s in [-1.0, 1.0]:
		B.K(G("sphere"), M("#4ff7ff", {"e": "#29d9ff", "ei": 2}), s * 0.17, 0.72, 0.1, 0.09, 0.09, 0.04, hg)
	B.K(G("box"), "#5a1010", 0, 0.48, 0.09, 0.2, 0.04, 0.02, hg)
	B.P(G("cyl"), "#999999", 0, 1.45, 0, 0.02, 0.4, 0.02, hg); B.K(G("sphere"), M("#ff3344", {"e": "#ff2233", "ei": 2}), 0, 1.68, 0, 0.07, 0.07, 0.07, hg)
	B.arm(b, "A1", -0.58, 1.45, 0.55, "#a8b0bb", "#59636e", 0.08); B.arm(b, "A2", 0.58, 1.45, 0.55, "#a8b0bb", "#59636e", 0.08)
	B.leg(r, "L1", -0.25, 0, 0.7, "#a8b0bb", "#59636e", 0.1); B.leg(r, "L2", 0.25, 0, 0.7, "#a8b0bb", "#59636e", 0.1)
	return {"type": "biped", "robot": true}

static func owl(B: PB) -> Dictionary:
	var b := B.body; var r := B.root
	B.P(G("sphere"), "#8a5a3a", 0, 1.15, 0, 0.7, 0.8, 0.62, b, {"r": 0.7})
	B.P(G("sphere"), "#e8d2b0", 0, 1.0, 0.3, 0.5, 0.55, 0.38, b)
	for s in [-1.0, 1.0]:
		B.P(G("sphere"), "#f4e6d0", s * 0.25, 1.5, 0.45, 0.25, 0.25, 0.12, b); B.eye(b, s * 0.25, 1.5, 0.5, 0.17, {"iris": "#ff9f1a", "pupil": 0.6})
	B.K(G("cone"), "#ffcf3f", 0, 1.33, 0.62, 0.07, 0.18, 0.06, b).rx(PI)
	B.P(G("cone"), "#3b2aa0", 0, 2.35, -0.05, 0.6, 1.1, 0.6, b, {"r": 0.6}).rz(0.15)
	B.P(G("cyl"), "#3b2aa0", 0, 1.82, 0, 0.75, 0.05, 0.75, b)
	for i in 6:
		B.K(G("oct"), M("#ffe14a", {"e": "#ffcc00", "ei": 1.2}), cos(i * 1.7) * 0.32, 2.0 + i * 0.12, sin(i * 1.7) * 0.32, 0.06, 0.06, 0.06, b)
	B.wing(b, "W1", -0.62, 1.25, 0, 0.6, 0.8, "#6b4428"); B.wing(b, "W2", 0.62, 1.25, 0, 0.6, 0.8, "#6b4428")
	B.P(G("cyl"), "#7a4b2a", 0.8, 1.0, 0.3, 0.04, 1.6, 0.04, b)
	B.K(G("sphere"), M("#7ff7ff", {"e": "#40e0ff", "ei": 2.2}), 0.8, 1.85, 0.3, 0.14, 0.14, 0.14, b)
	B.leg(r, "L1", -0.22, 0, 0.32, "#ffcf3f", "#ffcf3f", 0.05); B.leg(r, "L2", 0.22, 0, 0.32, "#ffcf3f", "#ffcf3f", 0.05)
	return {"type": "hop", "magic": "#7ff7ff"}

static func dragon(B: PB) -> Dictionary:
	var b := B.body; var r := B.root
	B.P(G("sphere"), "#ff8c1a", 0, 1.2, -0.1, 0.65, 0.6, 1.0, b, {"r": 0.4})
	B.P(G("sphere"), "#ffd27a", 0, 1.05, 0.15, 0.45, 0.42, 0.8, b)
	B.P(G("capsule"), "#ff8c1a", 0, 1.75, 0.65, 0.35, 0.6, 0.35, b).rx(0.5)
	B.P(G("sphere"), "#ff8c1a", 0, 2.2, 0.95, 0.4, 0.35, 0.5, b); B.P(G("sphere"), "#ff8c1a", 0, 2.1, 1.3, 0.25, 0.2, 0.28, b)
	for s in [-1.0, 1.0]:
		B.P(G("cone"), "#fff1c8", s * 0.2, 2.6, 0.8, 0.07, 0.4, 0.07, b).r(-0.5, 0, -s * 0.3)
	for s in [-1.0, 1.0]:
		B.eye(b, s * 0.2, 2.32, 1.18, 0.09, {"iris": "#ff2a00", "glow": true, "pupil": 0.7})
	for i in 6:
		B.P(G("cone"), "#c0392b", 0, 1.8 - i * 0.05, 0.3 - i * 0.28, 0.08, 0.25, 0.15, b)
	B.wing(b, "W1", -0.5, 1.55, -0.1, 1.3, 1.0, "#c0392b", "#ff6b3d"); B.wing(b, "W2", 0.5, 1.55, -0.1, 1.3, 1.0, "#c0392b", "#ff6b3d")
	var t := B.pivot(b, "T", 0, 1.1, -1.0)
	for i in 5:
		B.P(G("sphere"), "#ff8c1a", 0, -i * 0.08, -i * 0.25, 0.22 - i * 0.035, 0.22 - i * 0.035, 0.22, t)
	B.P(G("cone"), "#c0392b", 0, -0.45, -1.35, 0.15, 0.3, 0.1, t).rx(-PI / 2)
	for l in [["L1", -0.32, 0.4], ["L2", 0.32, 0.4], ["L3", -0.32, -0.55], ["L4", 0.32, -0.55]]:
		B.leg(r, l[0], l[1], l[2], 0.65, "#ff8c1a", "#7a2a10", 0.12)
	return {"type": "quad", "fire": true}

static func camel(B: PB) -> Dictionary:
	var b := B.body; var r := B.root
	B.P(G("sphere"), "#d8b07a", 0, 1.45, -0.1, 0.62, 0.55, 1.0, b, {"r": 0.7})
	B.P(G("sphere"), "#cfa46a", 0, 1.95, -0.45, 0.4, 0.4, 0.4, b); B.P(G("sphere"), "#cfa46a", 0, 1.95, 0.3, 0.38, 0.38, 0.38, b)
	B.P(G("capsule"), "#d8b07a", 0, 2.0, 0.95, 0.28, 0.8, 0.28, b).rx(0.6)
	B.P(G("sphere"), "#d8b07a", 0, 2.5, 1.3, 0.28, 0.26, 0.42, b)
	for s in [-1.0, 1.0]:
		B.K(G("sphere"), M("#ff4fd8", {"m": 0.6, "r": 0.1, "e": "#ff00c8", "ei": 0.4}), s * 0.14, 2.58, 1.62, 0.12, 0.1, 0.04, b)
	B.K(G("box"), "#222222", 0, 2.6, 1.62, 0.2, 0.03, 0.03, b); B.smile(b, 2.38, 1.66, 0.09)
	var disco := B.pivot(b, "SP", 0, 2.75, -0.1)
	B.P(G("ico2"), M("#dfe6ee", {"m": 1, "r": 0.08, "flat": true}), 0, 0, 0, 0.42, 0.42, 0.42, disco)
	B.P(G("cyl"), "#999999", 0, 2.45, -0.1, 0.02, 0.3, 0.02, b)
	var t := B.pivot(b, "T", 0, 1.5, -1.05); B.P(G("capsule"), "#d8b07a", 0, -0.25, 0, 0.08, 0.25, 0.08, t)
	for l in [["L1", -0.3, 0.5], ["L2", 0.3, 0.5], ["L3", -0.3, -0.6], ["L4", 0.3, -0.6]]:
		B.leg(r, l[0], l[1], l[2], 1.0, "#d8b07a", "#8a6a3a", 0.1)
	return {"type": "quad", "disco": true}

static func eagle(B: PB) -> Dictionary:
	var b := B.body; var r := B.root
	B.P(G("sphere"), "#7a4b2a", 0, 1.3, 0, 0.55, 0.75, 0.55, b, {"r": 0.6})
	B.P(G("sphere"), "#ffffff", 0, 2.0, 0.12, 0.42, 0.42, 0.42, b)
	B.K(G("cone"), "#ffcf3f", 0, 1.92, 0.58, 0.1, 0.3, 0.1, b).rx(PI / 2 + 0.4)
	B.eyes(b, 2.08, 0.45, 0.17, 0.08, {"iris": "#ffb300"}); B.brows(b, 2.18, 0.5, 0.17, 0.4, "#5a3a1a")
	var crown := B.group(b, 0, 2.42, 0.08)
	B.P(Geo.cyl(0.28, 0.25, 0.18, 12, true), M("#ffd23f", {"m": 1, "r": 0.2, "side": true}), 0, 0, 0, 1, 1, 1, crown)
	var gm := M("#ffd23f", {"m": 1, "r": 0.2})
	for i in 6:
		var a := i / 6.0 * TAU
		B.P(G("cone"), gm, cos(a) * 0.26, 0.15, sin(a) * 0.26, 0.05, 0.14, 0.05, crown)
		B.K(G("oct"), M(["#ff2a6a", "#29d9ff", "#3df2b0"][i % 3], {"m": 0.3, "r": 0.1}), cos(a) * 0.27, 0.0, sin(a) * 0.27, 0.04, 0.05, 0.04, crown)
	B.wing(b, "W1", -0.5, 1.6, 0, 1.6, 1.0, "#6b3e22", "#a86a3a"); B.wing(b, "W2", 0.5, 1.6, 0, 1.6, 1.0, "#6b3e22", "#a86a3a")
	for i in 3:
		B.P(G("sphere"), "#5a361c", (i - 1) * 0.15, 0.7, -0.4, 0.12, 0.45, 0.06, b).rx(-0.6)
	B.leg(r, "L1", -0.2, 0, 0.6, "#ffcf3f", "#ffcf3f", 0.06); B.leg(r, "L2", 0.2, 0, 0.6, "#ffcf3f", "#ffcf3f", 0.06)
	return {"type": "fly", "hover": 0.5, "bigWings": true}

static func octopus(B: PB) -> Dictionary:
	var b := B.body
	B.P(G("sphere"), "#c04ae0", 0, 1.65, 0, 0.75, 0.8, 0.7, b, {"r": 0.35})
	for i in 9:
		B.P(G("sphere"), "#e08af5", cos(i * 1.9) * 0.6, 1.5 + (i % 3) * 0.35, 0.3 + sin(i * 1.9) * 0.2, 0.07, 0.07, 0.04, b)
	B.eyes(b, 1.62, 0.6, 0.24, 0.15, {"pupil": 0.5}); B.smile(b, 1.3, 0.62, 0.14, "#3a0a4a", true)
	B.P(G("halfTorus"), "#1d1f2e", 0, 1.9, 0, 0.78, 0.82, 1.2, b, {"m": 0.5, "r": 0.3})
	for s in [-1.0, 1.0]:
		B.P(G("cyl"), "#1d1f2e", s * 0.78, 1.62, 0, 0.22, 0.14, 0.22, b, {"m": 0.5}).rz(PI / 2)
		B.K(G("cyl"), M("#3df2b0", {"e": "#3df2b0", "ei": 1.5}), s * 0.86, 1.62, 0, 0.16, 0.02, 0.16, b).rz(PI / 2)
	var te := B.pivot(b, "TE", 0, 0.95, 0)
	for i in 8:
		var a := i / 8.0 * TAU
		var tg := B.group(te, cos(a) * 0.45, 0, sin(a) * 0.45, "TG%d" % i); tg.rotation.y = -a
		for k in 4:
			B.P(G("sphere"), "#b03ad0", 0.15 + k * 0.2, -0.25 - k * 0.15, 0, 0.17 - k * 0.03, 0.17 - k * 0.03, 0.17 - k * 0.03, tg)
	B.P(Geo.rbox(1.3, 0.25, 0.6, 0.06), "#22232c", 0, 1.0, 0.95, 1, 1, 1, b, {"m": 0.6})
	var sp := B.pivot(b, "SP", -0.32, 1.14, 0.95); B.P(G("cyl"), "#111111", 0, 0, 0, 0.24, 0.03, 0.24, sp); B.K(G("box"), M("#ff4f8b", {"e": "#ff4f8b", "ei": 1.5}), 0.12, 0.02, 0, 0.12, 0.02, 0.03, sp)
	var sp2 := B.pivot(b, "SP2", 0.32, 1.14, 0.95); B.P(G("cyl"), "#111111", 0, 0, 0, 0.24, 0.03, 0.24, sp2); B.K(G("box"), M("#58c4ff", {"e": "#58c4ff", "ei": 1.5}), 0.12, 0.02, 0, 0.12, 0.02, 0.03, sp2)
	return {"type": "wobble", "notes": true}

static func ghost(B: PB) -> Dictionary:
	var b := B.body
	var gm := M("#eafcff", {"r": 0.2, "t": 0.88, "e": "#7af7ff", "ei": 0.35})
	B.P(G("sphere"), gm, 0, 1.6, 0, 0.7, 0.7, 0.7, b)
	B.P(Geo.cyl(0.7, 0.85, 0.9, 20, true), gm, 0, 1.15, 0, 1, 1, 1, b)
	for i in 8:
		var a := i / 8.0 * TAU
		B.P(G("sphere"), gm, cos(a) * 0.78, 0.7, sin(a) * 0.78, 0.2, 0.2, 0.2, b)
	for s in [-1.0, 1.0]:
		B.K(G("sphere"), "#0a0a14", s * 0.22, 1.7, 0.6, 0.12, 0.2, 0.06, b)
	B.K(G("sphere"), "#0a0a14", 0, 1.35, 0.66, 0.12, 0.16, 0.05, b)
	var g1 := B.pivot(b, "GL1", 0.05, 0, 0); B.P(G("sphere"), Geo.add_mat("#ff2af0", 0.35), 0, 1.6, 0, 0.72, 0.72, 0.72, g1)
	var g2 := B.pivot(b, "GL2", -0.05, 0, 0); B.P(G("sphere"), Geo.add_mat("#29d9ff", 0.35), 0, 1.6, 0, 0.72, 0.72, 0.72, g2)
	B.arm(b, "A1", -0.72, 1.4, 0.4, gm, null, 0.1, 0.8); B.arm(b, "A2", 0.72, 1.4, 0.4, gm, null, 0.1, 0.8)
	return {"type": "fly", "hover": 0.4, "glitch": true}

static func cosmiccat(B: PB) -> Dictionary:
	var b := B.body
	var space := M("#1a1458", {"r": 0.3, "m": 0.2, "e": "#3a1a9a", "ei": 0.6})
	B.P(G("sphere"), space, 0, 1.0, 0, 0.62, 0.55, 0.6, b)
	B.P(G("sphere"), space, 0, 1.6, 0.15, 0.48, 0.44, 0.44, b)
	for s in [-1.0, 1.0]:
		B.P(G("cone"), space, s * 0.28, 2.02, 0.12, 0.14, 0.3, 0.1, b).rz(-s * 0.3)
	for i in 26:
		var th := U.rnd(0, TAU); var ph := U.rnd(0, PI)
		B.K(G("oct"), M("#ffffff", {"e": "#ffffff", "ei": 2}), cos(th) * sin(ph) * 0.61, 1.0 + cos(ph) * 0.55, sin(th) * sin(ph) * 0.6, 0.025, 0.025, 0.025, b)
	for s in [-1.0, 1.0]:
		B.eye(b, s * 0.18, 1.68, 0.5, 0.11, {"iris": "#ffe14a", "glow": true, "pupil": 0.8, "sy": 1.2})
	B.smile(b, 1.45, 0.56, 0.08, "#ff9fe8")
	var orb := B.pivot(b, "OR", 0, 1.3, 0)
	B.P(G("sphere"), M("#ff8a3d", {"e": "#ff5a00", "ei": 0.6}), 1.1, 0.2, 0, 0.18, 0.18, 0.18, orb)
	B.P(G("sphere"), M("#58c4ff", {"e": "#2a7aff", "ei": 0.4}), -1.0, -0.1, 0.4, 0.14, 0.14, 0.14, orb)
	B.P(G("torus"), Geo.add_mat("#ffe9a0", 0.8), -1.0, -0.1, 0.4, 0.26, 0.26, 0.26, orb).rx(1.2)
	B.P(G("torusThin"), Geo.add_mat("#b28cff", 0.6), 0, 0, 0, 1.1, 1.1, 1.1, orb).rx(PI / 2)
	var t := B.pivot(b, "T", 0, 0.8, -0.55); B.P(G("capsule"), space, 0, 0.35, -0.2, 0.12, 0.35, 0.12, t).rx(-0.4)
	return {"type": "fly", "hover": 0.5, "cosmic": true}

static func _neon(c: String) -> StandardMaterial3D: return M(c, {"e": c, "ei": 0.9, "r": 0.3})

static func simorgh(B: PB) -> Dictionary:
	var b := B.body
	B.P(G("sphere"), _neon("#29d9ff"), 0, 1.5, 0, 0.5, 0.6, 0.75, b)
	B.P(G("sphere"), _neon("#ff2af0"), 0, 2.2, 0.45, 0.32, 0.32, 0.32, b)
	B.P(G("capsule"), _neon("#7a5cff"), 0, 1.9, 0.3, 0.25, 0.4, 0.25, b).rx(0.6)
	B.K(G("cone"), "#ffd23f", 0, 2.15, 0.82, 0.07, 0.25, 0.07, b).rx(PI / 2 + 0.3)
	for s in [-1.0, 1.0]:
		B.eye(b, s * 0.14, 2.28, 0.68, 0.07, {"iris": "#ffffff", "glow": true})
	for i in 5:
		B.P(G("cone"), _neon(["#ffd23f", "#ff2af0", "#29d9ff", "#3df2b0", "#ff8a3d"][i]), (i - 2) * 0.08, 2.55 + (i % 2) * 0.05, 0.35, 0.03, 0.35, 0.03, b).rz((i - 2) * 0.25)
	B.wing(b, "W1", -0.45, 1.75, 0, 1.9, 1.2, _neon("#7a5cff"), _neon("#29d9ff")); B.wing(b, "W2", 0.45, 1.75, 0, 1.9, 1.2, _neon("#7a5cff"), _neon("#29d9ff"))
	var t := B.pivot(b, "T", 0, 1.4, -0.65)
	for i in 7:
		B.P(G("sphere"), _neon(["#ff2af0", "#ffd23f", "#29d9ff", "#3df2b0", "#ff8a3d", "#7a5cff", "#ff2af0"][i]), (i - 3) * 0.2, -0.4, -0.9, 0.09, 0.08, 0.95, t).r(0.35, (i - 3) * 0.18, 0)
	return {"type": "fly", "hover": 0.8, "bigWings": true, "neon": true}

static func golem(B: PB) -> Dictionary:
	var b := B.body; var r := B.root
	var rock := M("#3a2a2a", {"r": 0.9, "flat": true}); var lava := M("#ff6a00", {"e": "#ff4a00", "ei": 2.2})
	B.P(G("dodec"), rock, 0, 1.3, 0, 0.85, 0.9, 0.7, b); B.P(G("dodec"), rock, 0, 2.15, 0.1, 0.45, 0.42, 0.42, b)
	for i in 12:
		var a := i * 2.3
		B.K(G("box"), lava, cos(a) * 0.62, 0.8 + (i % 6) * 0.18, sin(a) * 0.5 + 0.12, 0.06, 0.28, 0.05, b).rz(a)
	for s in [-1.0, 1.0]:
		B.K(G("sphere"), M("#ffe14a", {"e": "#ffb000", "ei": 2.5}), s * 0.16, 2.2, 0.48, 0.08, 0.06, 0.05, b)
	B.K(G("box"), lava, 0, 2.0, 0.5, 0.26, 0.05, 0.04, b)
	for s in [-1.0, 1.0]:
		B.P(G("dodec"), rock, s * 0.6, 2.0, -0.1, 0.25, 0.22, 0.25, b)
	var a1 := B.arm(b, "A1", -0.85, 1.7, 0.7, "#4a3434", null, 0.14, 0.35); var a2 := B.arm(b, "A2", 0.85, 1.7, 0.7, "#4a3434", null, 0.14, 0.35)
	for a in [a1, a2]:
		B.P(G("dodec"), rock, 0, -0.82, 0, 0.3, 0.3, 0.3, a); B.K(G("sphere"), lava, 0, -0.82, 0.2, 0.08, 0.08, 0.08, a)
	B.leg(r, "L1", -0.3, 0, 0.55, "#3a2a2a", "#1a1010", 0.16); B.leg(r, "L2", 0.3, 0, 0.55, "#3a2a2a", "#1a1010", 0.16)
	return {"type": "biped", "karate": true, "lava": true}

static func jelly(B: PB) -> Dictionary:
	var b := B.body
	var bell := M("#ff6fcf", {"e": "#ff2af0", "ei": 0.8, "t": 0.78, "r": 0.2})
	B.P(G("hemi"), bell, 0, 1.6, 0, 0.9, 0.75, 0.9, b); B.P(G("torus"), M("#ffd0f5", {"e": "#ff8ae8", "ei": 1.2}), 0, 1.6, 0, 0.88, 0.88, 0.6, b).rx(PI / 2)
	B.K(G("sphere"), M("#7af7ff", {"e": "#29d9ff", "ei": 2}), 0, 1.85, 0, 0.35, 0.3, 0.35, b)
	B.eyes(b, 1.85, 0.72, 0.24, 0.11, {"pupil": 0.5}); B.smile(b, 1.68, 0.8, 0.1, "#7a0a4a")
	var te := B.pivot(b, "TE", 0, 1.55, 0)
	for i in 8:
		var a := i / 8.0 * TAU
		var tg := B.group(te, cos(a) * 0.55, 0, sin(a) * 0.55, "TG%d" % i); tg.rotation.y = -a
		for k in 5:
			B.P(G("sphere"), M("#ff9ae8" if k % 2 else "#7af7ff", {"e": "#ff4fd8" if k % 2 else "#29d9ff", "ei": 1.2, "t": 0.85}), 0.05, -0.22 - k * 0.2, 0, 0.08 - k * 0.008, 0.12, 0.08 - k * 0.008, tg)
	return {"type": "fly", "hover": 0.7, "floaty": true}

static func _fire(c: String) -> StandardMaterial3D: return M(c, {"e": c, "ei": 1.5, "r": 0.4})

static func phoenix(B: PB) -> Dictionary:
	var b := B.body
	B.P(G("sphere"), _fire("#ff6a00"), 0, 1.55, 0, 0.5, 0.6, 0.75, b)
	B.P(G("sphere"), _fire("#ffb000"), 0, 2.25, 0.45, 0.33, 0.33, 0.33, b)
	B.K(G("cone"), "#ffe14a", 0, 2.2, 0.82, 0.08, 0.26, 0.08, b).rx(PI / 2 + 0.3)
	for s in [-1.0, 1.0]:
		B.eye(b, s * 0.14, 2.33, 0.7, 0.07, {"iris": "#ffffff", "glow": true})
	for i in 5:
		B.P(G("cone"), _fire(["#ffe14a", "#ff6a00", "#ff2a00", "#ffb000", "#ffe14a"][i]), (i - 2) * 0.09, 2.62, 0.3, 0.05, 0.4, 0.05, b).rz((i - 2) * 0.25)
	B.wing(b, "W1", -0.45, 1.8, 0, 2.0, 1.3, _fire("#ff4a00"), _fire("#ffd23f")); B.wing(b, "W2", 0.45, 1.8, 0, 2.0, 1.3, _fire("#ff4a00"), _fire("#ffd23f"))
	var t := B.pivot(b, "T", 0, 1.4, -0.65)
	for i in 7:
		B.P(G("cone"), _fire(["#ff2a00", "#ffb000", "#ff6a00", "#ffe14a", "#ff6a00", "#ffb000", "#ff2a00"][i]), (i - 3) * 0.16, -0.3, -0.9, 0.12, 1.6, 0.05, t).r(-PI / 2 + 0.35, (i - 3) * 0.12, 0)
	return {"type": "fly", "hover": 0.9, "bigWings": true, "fire": true}

static func sugar(B: PB) -> Dictionary:
	var b := B.body; var r := B.root
	B.P(G("cone"), "#f8f8f4", 0, 1.25, 0, 0.62, 1.6, 0.62, b, {"r": 0.85})
	B.P(G("cyl"), "#2f6fd6", 0, 0.62, 0, 0.6, 0.34, 0.6, b, {"r": 0.6}); B.P(G("torus"), "#ffd23f", 0, 0.8, 0, 0.6, 0.6, 0.6, b).rx(PI / 2)
	for i in 12:
		B.P(G("sphere"), "#ffffff", U.rnd(-0.3, 0.3), U.rnd(0.9, 1.8), 0.3, 0.03, 0.03, 0.02, b)
	B.eyes(b, 1.35, 0.33, 0.13, 0.09); B.smile(b, 1.15, 0.36, 0.09, "#5a3a20", true)
	B.leg(r, "L1", -0.2, 0, 0.45, "#f8f8f4", "#2f6fd6", 0.06); B.leg(r, "L2", 0.2, 0, 0.45, "#f8f8f4", "#2f6fd6", 0.06)
	B.arm(b, "A1", -0.42, 1.05, 0.42, "#f8f8f4", "#ffffff", 0.06, 0.7); B.arm(b, "A2", 0.42, 1.05, 0.42, "#f8f8f4", "#ffffff", 0.06, 0.7)
	return {"type": "biped", "dance": true}

static func goldfish(B: PB) -> Dictionary:
	var b := B.body; var r := B.root
	var h := B.K(G("sphere"), Geo.glass_mat("#d9f2ff"), 0, 1.25, 0, 0.75, 0.7, 0.75, b); h.solo = true
	B.P(G("cyl"), "#3fb7ff", 0, 1.0, 0, 0.66, 0.42, 0.66, b, {"t": 0.6, "r": 0.1})
	var f := B.pivot(b, "T", 0, 1.25, 0)
	B.P(G("sphere"), M("#ff6a00", {"e": "#ff4a00", "ei": 0.3}), 0, 0, 0.05, 0.28, 0.22, 0.38, f)
	B.P(G("cone"), "#ff8a1f", 0, 0, -0.42, 0.2, 0.3, 0.06, f).rx(PI / 2)
	for s in [-1.0, 1.0]:
		B.eye(f, s * 0.13, 0.06, 0.28, 0.06)
	B.P(G("torus"), "#e8f5ff", 0, 1.88, 0, 0.42, 0.42, 0.6, b, {"m": 0.3}).rx(PI / 2)
	for i in 3:
		B.P(G("sphere"), "#9fd36a", (i - 1) * 0.35, 0.68, -0.35, 0.12, 0.1, 0.12, b)
	B.leg(r, "L1", -0.25, 0, 0.48, "#ff8a1f", "#ff6a00", 0.06); B.leg(r, "L2", 0.25, 0, 0.48, "#ff8a1f", "#ff6a00", 0.06)
	return {"type": "hop"}

static func paykan(B: PB) -> Dictionary:
	var b := B.body
	var body := M("#f2e8d0", {"m": 0.4, "r": 0.35})
	B.P(Geo.rbox(1.1, 0.5, 2.1, 0.12), body, 0, 1.2, 0, 1, 1, 1, b)
	B.P(Geo.rbox(0.95, 0.42, 1.05, 0.1), body, 0, 1.62, -0.1, 1, 1, 1, b)
	var w := B.K(G("box"), Geo.glass_mat("#bfe6ff"), 0, 1.62, 0.43, 0.84, 0.34, 0.05, b); w.solo = true
	for s in [-1.0, 1.0]:
		for z in [-0.65, 0.65]:
			B.P(G("cyl"), "#1b1b22", s * 0.56, 0.95, z, 0.24, 0.16, 0.24, b, {"r": 0.8}).rz(PI / 2)
			B.P(G("cyl"), "#c0c8d0", s * 0.62, 0.95, z, 0.12, 0.04, 0.12, b, {"m": 0.9}).rz(PI / 2)
	for s in [-1.0, 1.0]:
		B.K(G("sphere"), M("#fff3a0", {"e": "#ffe14a", "ei": 2}), s * 0.36, 1.25, 1.06, 0.1, 0.1, 0.05, b)
	B.P(G("box"), "#c0c8d0", 0, 1.0, 1.08, 1.0, 0.1, 0.06, b, {"m": 0.9})
	for s in [-1.0, 1.0]:
		B.eye(b, s * 0.2, 1.65, 0.48, 0.1)
	B.wing(b, "W1", -0.55, 1.35, 0, 0.9, 0.5, "#ffffff", "#ffd6e8"); B.wing(b, "W2", 0.55, 1.35, 0, 0.9, 0.5, "#ffffff", "#ffd6e8")
	return {"type": "fly", "hover": 0.5}

static func cooker(B: PB) -> Dictionary:
	var b := B.body
	var steel := {"m": 0.95, "r": 0.2}
	B.P(G("cyl"), "#c9d1d9", 0, 1.15, 0, 0.6, 0.85, 0.6, b, steel); B.P(G("hemi"), "#aeb6bf", 0, 1.57, 0, 0.62, 0.22, 0.62, b, steel)
	B.P(G("box"), "#1b1b22", 0.8, 1.45, 0, 0.6, 0.1, 0.12, b); B.P(G("cyl"), "#1b1b22", 0, 1.82, 0, 0.08, 0.22, 0.08, b)
	B.K(G("sphere"), M("#ff4a4a", {"e": "#ff2a2a", "ei": 1.5}), 0, 1.98, 0, 0.07, 0.07, 0.07, b)
	for i in 3:
		var a := i / 3.0 * TAU
		B.P(G("cone"), "#ff4f8b", cos(a) * 0.55, 0.62, sin(a) * 0.55, 0.12, 0.45, 0.3, b).ry(-a)
	B.eyes(b, 1.25, 0.58, 0.2, 0.11); B.brows(b, 1.4, 0.62, 0.2, -0.3); B.smile(b, 1.02, 0.6, 0.12, "#3a1020", true)
	var fl := B.pivot(b, "FL1", 0, 0.68, 0); B.K(G("cone"), M("#ff9a1f", {"e": "#ff7a00", "ei": 2}), 0, -0.3, 0, 0.3, 0.6, 0.3, fl).rx(PI)
	var fl2 := B.pivot(b, "FL2", 0, 0.68, 0); B.K(G("cone"), Geo.add_mat("#fff27a", 0.9), 0, -0.2, 0, 0.16, 0.4, 0.16, fl2).rx(PI)
	return {"type": "fly", "hover": 0.7, "flames": true, "steam": true}

static func div(B: PB) -> Dictionary:
	var b := B.body; var r := B.root
	var fur := M("#f4f4f0", {"r": 1.0, "flat": true})
	B.P(G("ico"), fur, 0, 1.5, 0, 0.95, 1.05, 0.8, b); B.P(G("ico"), fur, 0, 2.45, 0.1, 0.55, 0.5, 0.5, b)
	for s in [-1.0, 1.0]:
		B.P(G("cone"), "#3a2a20", s * 0.3, 2.95, 0.05, 0.1, 0.55, 0.1, b, {"r": 0.5}).rz(-s * 0.5)
	for s in [-1.0, 1.0]:
		B.eye(b, s * 0.18, 2.52, 0.48, 0.1, {"iris": "#ff2a2a", "glow": true, "pupil": 0.7})
	B.K(G("box"), "#5a1010", 0, 2.25, 0.5, 0.36, 0.08, 0.05, b)
	for s in [-1.0, 1.0]:
		B.K(G("cone"), "#ffffff", s * 0.12, 2.18, 0.52, 0.04, 0.12, 0.04, b).rx(PI)
	var a1 := B.arm(b, "A1", -0.95, 2.0, 0.85, "#e8e8e0", "#e8e8e0", 0.16, 0.35); B.arm(b, "A2", 0.95, 2.0, 0.85, "#e8e8e0", "#e8e8e0", 0.16, 0.35)
	B.P(G("cyl"), "#6b4a2a", 0, -1.0, 0.3, 0.12, 1.4, 0.12, a1); B.P(G("sphere"), "#6b4a2a", 0, -1.65, 0.3, 0.24, 0.3, 0.24, a1)
	B.leg(r, "L1", -0.38, 0, 0.7, "#e8e8e0", "#3a2a20", 0.2); B.leg(r, "L2", 0.38, 0, 0.7, "#e8e8e0", "#3a2a20", 0.2)
	return {"type": "biped", "karate": true}

static func rostam(B: PB) -> Dictionary:
	var b := B.body; var r := B.root
	var skin := "#e0ac69"; var armor := M("#e09a3a", {"r": 0.6}); var gold := M("#ffd23f", {"m": 1, "r": 0.2})
	B.P(Geo.rbox(0.85, 0.95, 0.5, 0.15), armor, 0, 1.5, 0, 1, 1, 1, b)
	for i in 14:
		B.P(G("sphere"), "#3a2410", U.rnd(-0.38, 0.38), U.rnd(1.1, 1.9), 0.26, 0.05, 0.04, 0.02, b)
	B.P(G("sphere"), skin, 0, 2.3, 0, 0.36, 0.38, 0.34, b)
	B.P(G("cone"), gold, 0, 2.78, 0, 0.36, 0.42, 0.36, b); B.P(G("cyl"), gold, 0, 2.6, 0, 0.4, 0.08, 0.4, b); B.P(G("box"), "#c0143c", 0, 2.95, -0.1, 0.06, 0.3, 0.3, b)
	B.eyes(b, 2.36, 0.3, 0.12, 0.07); B.brows(b, 2.45, 0.33, 0.12, -0.35, "#1a0a00")
	for s in [-1.0, 1.0]:
		B.K(G("capsule"), "#1a0a00", s * 0.18, 2.18, 0.32, 0.09, 0.28, 0.09, b).rz(s * 1.3)
	var a1 := B.arm(b, "A1", -0.55, 1.85, 0.6, armor, skin, 0.11, 0.3); B.arm(b, "A2", 0.55, 1.85, 0.6, armor, skin, 0.11, 0.3)
	B.P(G("cyl"), "#8a6a3a", 0, -0.9, 0.2, 0.05, 1.0, 0.05, a1); B.P(G("dodec"), gold, 0, -1.45, 0.2, 0.22, 0.22, 0.22, a1)
	B.P(G("cyl"), M("#c0143c", {"r": 0.6, "side": true}), 0, 1.4, -0.32, 0.5, 1.2, 0.08, b)
	B.leg(r, "L1", -0.22, 0, 0.95, "#6b4a2a", "#3a2410", 0.12); B.leg(r, "L2", 0.22, 0, 0.95, "#6b4a2a", "#3a2410", 0.12)
	return {"type": "biped", "karate": true, "royal": true}

static func ninjacat(B: PB) -> Dictionary:
	var b := B.body; var r := B.root
	var black := M("#15151d", {"r": 0.5})
	B.P(G("capsule"), black, 0, 1.15, 0, 0.6, 0.45, 0.55, b); B.P(G("sphere"), black, 0, 1.8, 0.05, 0.42, 0.4, 0.4, b)
	for s in [-1.0, 1.0]:
		B.P(G("cone"), black, s * 0.25, 2.18, 0.02, 0.13, 0.3, 0.1, b).rz(-s * 0.3)
	B.P(G("torus"), "#e02424", 0, 1.95, 0.02, 0.42, 0.42, 0.7, b).rx(PI / 2)
	B.P(G("box"), "#e02424", 0.1, 1.85, -0.45, 0.06, 0.4, 0.04, b).rz(0.6)
	for s in [-1.0, 1.0]:
		B.eye(b, s * 0.15, 1.85, 0.36, 0.09, {"iris": "#7aff6a", "glow": true, "pupil": 0.6, "sy": 0.6})
	B.P(G("box"), M("#dfe6ee", {"m": 1, "r": 0.15}), 0.35, 1.5, -0.38, 0.06, 1.3, 0.12, b).rz(-0.7)
	var t := B.pivot(b, "T", 0, 0.85, -0.4); B.P(G("capsule"), black, 0, 0.3, -0.25, 0.1, 0.35, 0.1, t).rx(-0.7)
	B.arm(b, "A1", -0.42, 1.4, 0.45, black, black, 0.08); B.arm(b, "A2", 0.42, 1.4, 0.45, black, black, 0.08)
	B.leg(r, "L1", -0.2, 0, 0.55, black, "#2a2a36", 0.09); B.leg(r, "L2", 0.2, 0, 0.55, black, "#2a2a36", 0.09)
	return {"type": "biped", "karate": true}

static func whale(B: PB) -> Dictionary:
	var b := B.body
	var blue := M("#9fd8ff", {"r": 0.4, "e": "#5aa8ff", "ei": 0.25})
	B.P(G("sphere"), blue, 0, 1.6, 0, 0.95, 0.85, 1.55, b); B.P(G("sphere"), "#f4fbff", 0, 1.25, 0.25, 0.7, 0.5, 1.2, b)
	for s in [-1.0, 1.0]:
		B.eye(b, s * 0.55, 1.7, 1.05, 0.11)
	B.smile(b, 1.35, 1.35, 0.25, "#3a5a8a")
	var t := B.pivot(b, "T", 0, 1.7, -1.4)
	for s in [-1.0, 1.0]:
		B.P(G("sphere"), blue, s * 0.45, 0.2, -0.3, 0.5, 0.12, 0.3, t).ry(s * 0.4)
	B.wing(b, "W1", -0.85, 1.35, 0.2, 0.8, 0.4, "#9fd8ff"); B.wing(b, "W2", 0.85, 1.35, 0.2, 0.8, 0.4, "#9fd8ff")
	for i in 5:
		B.P(G("sphere"), M("#ffffff", {"r": 1.0, "t": 0.9}), U.rnd(-0.3, 0.3), 2.5 + i * 0.12, 0.5 - i * 0.05, 0.22 - i * 0.03, 0.18, 0.22 - i * 0.03, b)
	return {"type": "fly", "hover": 0.9, "floaty": true}

static func unicorn(B: PB) -> Dictionary:
	var b := B.body; var r := B.root
	var wht := M("#ffffff", {"r": 0.5})
	B.P(G("capsule"), wht, 0, 1.25, -0.1, 0.65, 0.6, 0.65, b).rx(PI / 2)
	B.P(G("capsule"), wht, 0, 1.75, 0.6, 0.32, 0.4, 0.32, b).rx(0.6)
	B.P(G("sphere"), wht, 0, 2.1, 0.85, 0.3, 0.3, 0.42, b)
	B.K(G("cone"), M("#ffd23f", {"m": 0.8, "r": 0.2, "e": "#ffb000", "ei": 0.6}), 0, 2.55, 0.95, 0.06, 0.55, 0.06, b).rx(0.3)
	for s in [-1.0, 1.0]:
		B.eye(b, s * 0.17, 2.16, 1.18, 0.07, {"iris": "#b061ff", "pupil": 0.7})
	var cols := ["#ff4f8b", "#ffa31a", "#ffd23f", "#3df2b0", "#58c4ff", "#b061ff"]
	for i in 6:
		B.K(G("sphere"), M(cols[i], {"e": cols[i], "ei": 0.6}), 0, 2.3 - i * 0.1, 0.55 - i * 0.12, 0.1, 0.14, 0.12, b)
	var t := B.pivot(b, "T", 0, 1.3, -0.75)
	for i in 6:
		B.K(G("sphere"), M(cols[i], {"e": cols[i], "ei": 0.6}), 0, -0.1 - i * 0.12, -0.15 - i * 0.05, 0.1, 0.14, 0.1, t)
	B.wing(b, "W1", -0.4, 1.55, 0, 1.2, 0.8, "#ffffff", "#ffe0f5"); B.wing(b, "W2", 0.4, 1.55, 0, 1.2, 0.8, "#ffffff", "#ffe0f5")
	for l in [["L1", -0.25, 0.35], ["L2", 0.25, 0.35], ["L3", -0.25, -0.5], ["L4", 0.25, -0.5]]:
		B.leg(r, l[0], l[1], l[2], 0.9, "#ffffff", "#ffd23f", 0.09)
	return {"type": "quad"}

static func angel(B: PB) -> Dictionary:
	var b := B.body
	var robe := M("#fffaf0", {"r": 0.6, "e": "#fff3c0", "ei": 0.25})
	B.P(G("cone"), robe, 0, 1.15, 0, 0.6, 1.5, 0.6, b); B.P(G("sphere"), "#ffd9b0", 0, 2.1, 0, 0.36, 0.38, 0.34, b)
	B.P(G("hemi"), "#ffd23f", 0, 2.22, -0.02, 0.38, 0.32, 0.36, b, {"r": 0.6})
	B.eyes(b, 2.12, 0.28, 0.12, 0.08); B.smile(b, 1.95, 0.32, 0.09, "#a04040")
	B.K(G("torus"), M("#ffe14a", {"e": "#ffd000", "ei": 2.4}), 0, 2.62, 0, 0.32, 0.32, 0.5, b).rx(PI / 2)
	B.wing(b, "W1", -0.35, 1.7, -0.2, 1.8, 1.3, "#ffffff", "#fff3c0"); B.wing(b, "W2", 0.35, 1.7, -0.2, 1.8, 1.3, "#ffffff", "#fff3c0")
	B.arm(b, "A1", -0.42, 1.65, 0.5, robe, "#ffd9b0", 0.08, 0.6); B.arm(b, "A2", 0.42, 1.65, 0.5, robe, "#ffd9b0", 0.08, 0.6)
	return {"type": "fly", "hover": 0.8, "bigWings": true}

static func memeking(B: PB) -> Dictionary:
	var b := B.body; var r := B.root
	B.P(G("sphere"), M("#ffcf3f", {"m": 0.7, "r": 0.25}), 0, 1.35, 0, 0.95, 0.9, 0.85, b)
	B.P(Geo.cyl(0.98, 1.25, 1.6, 20, true, PI * 0.6, PI * 0.8), M("#c0143c", {"r": 0.6, "side": true}), 0, 1.15, -0.05, 1, 1, 1, b)
	B.P(G("torus"), M("#ffffff", {"r": 0.9}), 0, 1.95, -0.1, 0.8, 0.8, 1.4, b).rx(PI / 2 + 0.2)
	var crown := B.group(b, 0, 2.3, 0)
	var gold := M("#ffd23f", {"m": 1, "r": 0.15})
	B.P(Geo.cyl(0.5, 0.45, 0.32, 16, true), M("#ffd23f", {"m": 1, "r": 0.15, "side": true}), 0, 0, 0, 1, 1, 1, crown)
	for i in 8:
		var a := i / 8.0 * TAU
		B.P(G("cone"), gold, cos(a) * 0.48, 0.28, sin(a) * 0.48, 0.08, 0.26, 0.08, crown); B.P(G("sphere"), gold, cos(a) * 0.48, 0.44, sin(a) * 0.48, 0.05, 0.05, 0.05, crown)
	for i in 4:
		var a := i / 4.0 * TAU + 0.4
		var c: String = ["#ff2a6a", "#29d9ff", "#3df2b0", "#b061ff"][i]
		B.K(G("oct"), M(c, {"m": 0.2, "r": 0.05, "e": c, "ei": 0.5}), cos(a) * 0.5, 0.02, sin(a) * 0.5, 0.07, 0.09, 0.05, crown)
	B.eyes(b, 1.55, 0.78, 0.28, 0.13, {"pupil": 0.5, "ly": -0.3, "sy": 0.6}); B.brows(b, 1.76, 0.84, 0.28, -0.35, "#7a4a00", 0.24)
	B.smile(b, 1.18, 0.8, 0.28, "#7a2a00", false, -0.25)
	B.P(G("cyl"), gold, 1.05, 1.2, 0.35, 0.05, 1.6, 0.05, b).rz(-0.2)
	B.K(G("sphere"), M("#ff2af0", {"e": "#ff2af0", "ei": 1.6}), 1.2, 2.0, 0.35, 0.16, 0.16, 0.16, b)
	B.leg(r, "L1", -0.35, 0, 0.45, "#ffcf3f", "#c0143c", 0.12); B.leg(r, "L2", 0.35, 0, 0.45, "#ffcf3f", "#c0143c", 0.12)
	return {"type": "wobble", "royal": true}
