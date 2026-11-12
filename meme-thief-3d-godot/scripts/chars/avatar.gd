## Humanoid avatar (player, rivals, guards, shopkeepers) built from primitives, plus its procedural animation.
class_name Avatar

var root: Node3D
var body: Node3D
var head: Node3D
var legL: Node3D
var legR: Node3D
var armL: Node3D
var armR: Node3D
var blob: MeshInstance3D
var phase := 0.0
var lean := 0.0
var bank := 0.0
var squash := 0.0
var kiosk := false

static func G(n: String) -> Array: return Geo.G(n)
static func M(c, o: Dictionary = {}) -> StandardMaterial3D: return Geo.mat(c, o)

static func hair_cap(B: PB, head: Node3D, o: Dictionary) -> void:
	B.P(G("hemi"), M(o.hairC, {"r": 0.7}), 0, 0.04, -0.02, 0.32, 0.27, 0.32, head)

static func build(o: Dictionary) -> Avatar:
	var av := Avatar.new()
	var B := PB.new()
	var root := B.root; var body := B.body
	body.name = "AVBODY"
	var skin := M(o.skin, {"r": 0.55}); var shirt := M(o.shirt, {"r": 0.6}); var pants := M(o.pants, {"r": 0.7}); var shoe := M(o.shoes, {"r": 0.5})
	var legL := B.pivot(root, "legL", -0.16, 0.86, 0); var legR := B.pivot(root, "legR", 0.16, 0.86, 0)
	for lg in [legL, legR]:
		B.P(G("capsule"), pants, 0, -0.42, 0, 0.27, 0.4, 0.27, lg); B.P(Geo.rbox(0.26, 0.16, 0.4, 0.06), shoe, 0, -0.78, 0.06, 1, 1, 1, lg); B.P(G("box"), M("#ffffff"), 0, -0.85, 0.06, 0.27, 0.03, 0.41, lg)
	B.P(Geo.rbox(0.66, 0.72, 0.38, 0.14), shirt, 0, 1.22, 0, 1, 1, 1, body)
	B.P(G("box"), pants, 0, 0.9, 0, 0.6, 0.12, 0.34, body)
	B.P(G("cyl"), M(o.accent, {"e": o.accent, "ei": 0.3}), 0, 1.3, 0.2, 0.11, 0.02, 0.11, body).rx(PI / 2)
	var acc: String = o.get("acc", "none")
	if acc != "cape" and acc != "jetpack" and acc != "wings":
		B.P(Geo.rbox(0.46, 0.5, 0.22, 0.08), M(o.accent, {"r": 0.5}), 0, 1.25, -0.29, 1, 1, 1, body)
	var head := B.group(body, 0, 1.86, 0, "head")
	B.P(G("sphere"), skin, 0, 0, 0, 0.3, 0.31, 0.29, head)
	B.P(G("cyl"), skin, 0, -0.24, 0, 0.1, 0.12, 0.1, head)
	for s in [-1.0, 1.0]:
		B.P(G("sphere"), M("#ffffff", {"r": 0.2}), s * 0.11, 0.03, 0.24, 0.07, 0.08, 0.05, head); B.P(G("sphere"), M("#1b1446", {"r": 0.2}), s * 0.11, 0.02, 0.28, 0.04, 0.05, 0.03, head); B.P(G("sphere"), skin, s * 0.3, -0.02, 0, 0.06, 0.08, 0.05, head)
	B.P(G("halfTorus"), M("#7a2a2a"), 0, -0.1, 0.26, 0.08, 0.06, 0.05, head).rz(PI)
	var hair: String = o.get("hair", "spiky")
	var hairC: String = o.get("hairC", "#3a2410")
	var hat: String = o.get("hat", o.accent)
	match hair:
		"cap":
			B.P(G("hemi"), M(hat, {"r": 0.5}), 0, 0.05, 0, 0.32, 0.3, 0.32, head); B.P(G("cyl"), M(hat), 0, 0.07, 0.25, 0.22, 0.03, 0.2, head)
		"crown":
			B.P(G("hemi"), M(hairC, {"r": 0.7}), 0, 0.04, -0.02, 0.32, 0.26, 0.32, head)
			B.P(Geo.cyl(0.2, 0.18, 0.14, 10, true), M("#ffd23f", {"m": 1, "r": 0.2, "side": true}), 0, 0.32, 0, 1, 1, 1, head)
		"buns":
			B.P(G("hemi"), M(hairC, {"r": 0.7}), 0, 0.04, -0.02, 0.32, 0.28, 0.32, head)
			for s in [-1.0, 1.0]:
				B.P(G("sphere"), M(hairC, {"r": 0.7}), s * 0.22, 0.25, -0.05, 0.12, 0.12, 0.12, head)
		"phones":
			B.P(G("hemi"), M(hairC, {"r": 0.7}), 0, 0.04, -0.02, 0.32, 0.27, 0.32, head)
			B.P(G("halfTorus"), M("#222222", {"m": 0.5}), 0, 0.05, 0, 0.34, 0.34, 0.4, head).ry(PI / 2)
			for s in [-1.0, 1.0]:
				B.P(G("cyl"), M(o.accent, {"e": o.accent, "ei": 0.6}), s * 0.32, 0.0, 0, 0.1, 0.06, 0.1, head).rz(PI / 2)
		"beanie":
			var hc := M(hat, {"r": 0.9})
			B.P(G("hemi"), hc, 0, 0.06, 0, 0.33, 0.33, 0.33, head); B.P(G("torus"), hc, 0, 0.08, 0, 0.32, 0.32, 0.9, head).rx(PI / 2); B.P(G("sphere"), M("#ffffff", {"r": 1.0}), 0, 0.42, 0, 0.09, 0.09, 0.09, head)
		"tophat":
			hair_cap(B, head, o)
			var hm := M("#1b1b22", {"r": 0.4})
			B.P(G("cyl"), hm, 0, 0.22, 0, 0.42, 0.03, 0.42, head); B.P(G("cyl"), hm, 0, 0.45, 0, 0.22, 0.45, 0.22, head); B.P(G("cyl"), M(o.accent, {"r": 0.5}), 0, 0.29, 0, 0.225, 0.07, 0.225, head)
		"cowboy":
			hair_cap(B, head, o)
			var br := M("#8a5a2a", {"r": 0.8})
			B.P(G("cyl"), br, 0, 0.18, 0, 0.52, 0.03, 0.52, head); B.P(G("cyl"), br, 0, 0.32, 0, 0.24, 0.26, 0.24, head); B.P(G("cyl"), M("#3a2410"), 0, 0.22, 0, 0.245, 0.05, 0.245, head)
		"chef":
			hair_cap(B, head, o)
			var wh := M("#ffffff", {"r": 0.8})
			B.P(G("cyl"), wh, 0, 0.32, 0, 0.26, 0.3, 0.26, head)
			for i in 4:
				B.P(G("sphere"), wh, cos(i * 1.57) * 0.13, 0.52, sin(i * 1.57) * 0.13, 0.17, 0.14, 0.17, head)
		"ninja":
			B.P(G("hemi"), M(hairC, {"r": 0.8}), 0, 0.04, -0.02, 0.32, 0.29, 0.32, head)
			var red := M(o.accent, {"r": 0.6})
			B.P(G("torus"), red, 0, 0.1, 0, 0.31, 0.31, 0.6, head).rx(PI / 2)
			for s in [-1.0, 1.0]:
				B.P(G("box"), red, s * 0.06, 0.0, -0.36, 0.06, 0.28, 0.03, head).r(0.4, 0, s * 0.4)
		"wizard":
			hair_cap(B, head, o)
			var wz := M("#4a2a8a", {"r": 0.6})
			B.P(G("cyl"), wz, 0, 0.18, 0, 0.48, 0.03, 0.48, head); B.P(G("cone"), wz, 0, 0.5, -0.03, 0.27, 0.62, 0.27, head).rx(-0.18); B.P(G("oct"), M("#ffe14a", {"e": "#ffd000", "ei": 1.4}), 0, 0.42, 0.21, 0.06, 0.06, 0.03, head)
		"helmet":
			hair_cap(B, head, o)
			var h := B.P(G("sphere"), Geo.glass_mat("#d9f2ff"), 0, 0.02, 0.02, 0.42, 0.42, 0.42, head); h.solo = true
			B.P(G("torus"), M("#c0c8d0", {"m": 0.7, "r": 0.3}), 0, -0.3, 0, 0.36, 0.36, 1.4, head).rx(PI / 2)
		"horns":
			hair_cap(B, head, o)
			for s in [-1.0, 1.0]:
				B.P(G("cone"), M("#d01a2a", {"r": 0.4}), s * 0.16, 0.34, 0, 0.06, 0.22, 0.06, head).rz(-s * 0.35)
		"halo":
			hair_cap(B, head, o)
			B.P(G("torus"), M("#ffe14a", {"e": "#ffd000", "ei": 2.2}), 0, 0.5, 0, 0.22, 0.22, 0.6, head).rx(PI / 2)
		_:
			B.P(G("hemi"), M(hairC, {"r": 0.7}), 0, 0.05, -0.02, 0.32, 0.3, 0.33, head)
			for i in 3:
				B.P(G("cone"), M(hairC, {"r": 0.7}), (i - 1) * 0.12, 0.3, 0.05, 0.07, 0.16, 0.07, head).rx(0.5)
	var armL := B.pivot(body, "armL", -0.43, 1.5, 0); var armR := B.pivot(body, "armR", 0.43, 1.5, 0)
	for a in [armL, armR]:
		B.P(G("capsule"), shirt, 0, -0.18, 0, 0.2, 0.2, 0.2, a); B.P(G("capsule"), skin, 0, -0.45, 0, 0.17, 0.2, 0.17, a); B.P(G("sphere"), skin, 0, -0.66, 0, 0.1, 0.1, 0.1, a)
	match acc:
		"cape":
			B.P(G("cape"), M(o.accent, {"r": 0.6, "side": true}), 0, 1.12, -0.02, 1, 1, 1, body)
		"glasses":
			var gl := M("#111118", {"m": 0.6, "r": 0.15})
			for s in [-1.0, 1.0]:
				B.P(G("box"), gl, s * 0.11, 0.03, 0.29, 0.15, 0.09, 0.03, head)
			B.P(G("box"), gl, 0, 0.05, 0.29, 0.1, 0.025, 0.025, head)
		"scarf":
			var sc := M(o.accent, {"r": 0.9})
			B.P(G("torus"), sc, 0, 1.6, 0, 0.24, 0.24, 1.8, body).rx(PI / 2); B.P(G("box"), sc, 0.12, 1.36, 0.2, 0.12, 0.38, 0.05, body)
		"jetpack":
			var jm := M("#c0c8d0", {"m": 0.8, "r": 0.25})
			for s in [-1.0, 1.0]:
				B.P(G("cyl"), jm, s * 0.13, 1.25, -0.33, 0.11, 0.55, 0.11, body); B.P(G("cone"), M(o.accent, {"e": o.accent, "ei": 1.2}), s * 0.13, 0.9, -0.33, 0.08, 0.16, 0.08, body).rx(PI)
		"wings":
			for s in [-1.0, 1.0]:
				var wg := B.group(body, s * 0.12, 1.4, -0.24); wg.basis = Geo.basis_xyz(0.15, -s * 0.5, s * 0.35)
				for i in 3:
					B.P(G("sphere"), M("#fff3c0" if i == 1 else "#ffffff", {"r": 0.5}), s * (0.32 + i * 0.12), 0.1 - i * 0.12, 0, 0.32 - i * 0.06, 0.2 - i * 0.03, 0.05, wg).rz(s * (0.3 + i * 0.2))
	B.bake()
	av.root = root; av.body = body; av.head = head; av.legL = legL; av.legR = legR; av.armL = armL; av.armR = armR
	av.blob = Geo.mesh(G("plane"), Chars.blob_mat, 0, 0.03, 0, 1.4, 1.4, 1, root, false); Geo.rot(av.blob, -PI / 2)
	return av

## st: {speed, grounded, carrying, turn, t, stunned, receive, slap, ride}
func animate(dt: float, st: Dictionary) -> void:
	var speed: float = st.get("speed", 0.0)
	var grounded: bool = st.get("grounded", true)
	var t: float = st.get("t", 0.0)
	var k := clampf(speed / 6.5, 0.0, 1.6)
	if grounded:
		phase += dt * (3 + speed * 1.55)
	var s := sin(phase); var amp := minf(1.05, k * 0.75) if grounded else 0.0
	var lL := s * amp; var lR := -s * amp; var aL := -s * amp * 0.9; var aR := s * amp * 0.9; var azL := 0.08; var azR := -0.08
	if not grounded:
		lL = -0.6; lR = 0.35; aL = -2.6; aR = -2.6; azL = 0.5; azR = -0.5
	if st.get("carrying", false):
		aL = -2.9 + sin(t * 6) * 0.05; aR = -2.9 - sin(t * 6) * 0.05; azL = 0.25; azR = -0.25
	if st.get("receive", false) and not st.get("carrying", false):
		aL = -1.35; aR = -1.35; azL = 0.15; azR = -0.15
	if st.get("ride", false):
		lL = -0.35; lR = 0.35
		if not st.get("carrying", false) and not (st.get("slap", 0.0) > 0):
			aL = -0.3; aR = 0.3; azL = 0.9; azR = -0.9
	if st.get("slap", 0.0) > 0:
		aR = -1.9 + (0.32 - st.slap) * 4; azR = -1.1
	if st.get("stunned", false):
		aL = -1.2 + sin(t * 20) * 0.6; aR = -1.2 - sin(t * 20) * 0.6; azL = 1; azR = -1
	var d := 18.0
	legL.rotation.x = U.damp(legL.rotation.x, lL, d, dt); legR.rotation.x = U.damp(legR.rotation.x, lR, d, dt)
	armL.rotation.x = U.damp(armL.rotation.x, aL, d, dt); armR.rotation.x = U.damp(armR.rotation.x, aR, d, dt)
	armL.rotation.z = U.damp(armL.rotation.z, azL, d, dt); armR.rotation.z = U.damp(armR.rotation.z, azR, d, dt)
	lean = U.damp(lean, k * 0.12 if grounded else -0.05, 8, dt); bank = U.damp(bank, clampf(-st.get("turn", 0.0) * 0.06, -0.3, 0.3) * k, 8, dt)
	squash = U.damp(squash, 0.0, 10, dt)
	var breathe := sin(t * 2.2) * 0.012
	body.position.y = (absf(cos(phase)) * 0.07 * minf(1.0, k) if grounded else 0.0) - squash * 0.15
	body.basis = Geo.basis_xyz(lean, 0, bank) * Basis.from_scale(Vector3(1 + squash * 0.12, 1 + breathe - squash * 0.15, 1 + squash * 0.12))
	head.rotation.y = sin(t * 0.7) * 0.15 * (1 - minf(1.0, k))
