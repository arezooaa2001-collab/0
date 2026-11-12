## One base plot: floor, glass walls, entrance arch, three kiosks, safe house, pedestals, collect pad, console, laser barrier.
class_name BaseVis
extends RefCounted

const BASE_HX := 12.0
const BASE_HZ := 10.0
const BASE_BACK := 21.0
const FLOOR_Y := 0.3
const PED_Y := 0.55
const HOUSE_Z0 := 12.2
const HOUSE_H := 3.8
const DOOR_X := 3.8
const DOOR_W := 2.2
const DOOR_H := 2.9
const VAULT_LOCAL := [[-7.6, 17.6], [-2.8, 17.6], [2.8, 17.6], [7.6, 17.6]]
const KIOSKS := [[-7.6, "up"], [0.0, "speed"], [7.6, "wear"]]
const KIOSK_INFO := {"up": {"t": "🛒 ارتقا", "s": "ظرفیت و وسایل", "c": "#ff4f8b"}, "speed": {"t": "⚡ سرعت", "s": "دویدن و دزدی", "c": "#ffb000"}, "wear": {"t": "👕 لباس", "s": "تیپت را عوض کن", "c": "#b061ff"}}
static var SLOT_LOCAL: Array = []
static var FLAG_SHADER: Shader = null

var node: Node3D
var index := 0
var cx := 0.0
var cz := 0.0
var f := 1.0
var world := 1
var owner = null
var barrierActive := false
var forSale := false
var color := "#ffffff"
var slotPos: Array = []
var collectPos: Vector3
var consolePos: Vector3
var spawnPos: Vector3
var entrancePos: Vector3
var insidePos: Vector3
var frontYaw := 0.0
var kiosks: Array = []
var doorOut: Vector3
var doorIn: Vector3
var doorPos: Vector3
var doorYaw := 0.0
var door = null
var colDone := false
var vis: Node3D = null
var roof: Node3D = null
var ped: Array = []
var coin: MeshInstance3D
var btn: MeshInstance3D
var laser: Node3D
var laser_beams: Array = []
var trap: MeshInstance3D
var padLabel: Sign
var secLabel: Sign
var ownerTag: Sign
var signs: Array = []
var flags: Array = []
var floor_col = null

static func _static_init() -> void:
	for lz in [-1.8, 2.8, 7.2]:
		for lx in [-8.0, -2.7, 2.7, 8.0]:
			SLOT_LOCAL.append([lx, lz])

func _init(index_: int, cx_: float, cz_: float) -> void:
	index = index_; cx = cx_; cz = cz_
	f = 1.0 if cz > 0 else -1.0
	world = Phys.world_of(cx)
	node = Node3D.new()
	node.position = Vector3(cx, 0, cz)
	node.rotation.y = 0.0 if f == 1.0 else PI
	for lp in SLOT_LOCAL + VAULT_LOCAL:
		var w := to_world(lp[0], lp[1])
		slotPos.append(Vector3(w.x, PED_Y, w.y))
	var cp := to_world(7.5, -6.2); collectPos = Vector3(cp.x, FLOOR_Y, cp.y)
	var sc := to_world(-7.5, -6.2); consolePos = Vector3(sc.x, FLOOR_Y, sc.y)
	var sp := to_world(0, -4.8); spawnPos = Vector3(sp.x, FLOOR_Y, sp.y)
	var en := to_world(0, -12.5); entrancePos = Vector3(en.x, 0, en.y)
	var ins := to_world(0, -6.5); insidePos = Vector3(ins.x, FLOOR_Y, ins.y)
	frontYaw = PI if f == 1.0 else 0.0
	for k in KIOSKS:
		var fp := to_world(k[0], 9.05); var wp := to_world(k[0], 10.0)
		var root := Node3D.new(); root.position = Vector3(wp.x, 0, wp.y); root.rotation.y = frontYaw
		kiosks.append({"type": k[1], "pos": Vector3(fp.x, FLOOR_Y, fp.y), "keeper": {"root": root, "kiosk": true, "armL": Node3D.new(), "armR": Node3D.new()}})
	var dO := to_world(DOOR_X + DOOR_W / 2 - 0.38 - 0.43, 11.0); var dI := to_world(DOOR_X, 13.4); var dC := to_world(DOOR_X, HOUSE_Z0 + 0.15)
	doorOut = Vector3(dO.x, FLOOR_Y, dO.y); doorIn = Vector3(dI.x, FLOOR_Y, dI.y); doorPos = Vector3(dC.x, FLOOR_Y, dC.y)
	doorYaw = 0.0 if f == 1.0 else PI
	World.reserve(cx - BASE_HX - 1, cz - BASE_BACK - 1, cx + BASE_HX + 1, cz + BASE_BACK + 1)

func to_world(lx: float, lz: float) -> Vector2:
	return Vector2(cx + lx * f, cz + lz * f)
func to_local_xz(x: float, z: float) -> Vector2:
	return Vector2((x - cx) * f, (z - cz) * f)
func in_house(x: float, z: float, m: float = 0.0) -> bool:
	var l := to_local_xz(x, z)
	return absf(l.x) < 11.6 + m and l.y > HOUSE_Z0 + 0.3 - m and l.y < BASE_BACK - 0.4 + m
func contains(x: float, z: float, m: float = 0.0) -> bool:
	var l := to_local_xz(x, z)
	return absf(l.x) < BASE_HX - 0.4 + m and l.y > -BASE_HZ + 0.3 - m and l.y < BASE_BACK - 0.4 + m
func lbox(lx0: float, lz0: float, lx1: float, lz1: float, y0: float, y1: float, o: Dictionary = {}):
	if colDone:
		return null
	var a := to_world(lx0, lz0); var b := to_world(lx1, lz1)
	return Phys.add_box(a.x, y0, a.y, b.x, y1, b.y, o)

static func kiosk_sign(type: String) -> Sign:
	var k: Dictionary = KIOSK_INFO[type]
	return Sign.make([{"t": k.t, "size": 70, "color": "#fff", "weight": 900, "stroke": 6}, {"t": k.s, "size": 34, "color": "#fff", "weight": 800}], {"w": 384, "h": 180, "bg": k.c, "border": "#ffffff"}, 2.6, 1.22)

func build(color_: String, name: String, for_sale: bool) -> void:
	if vis:
		vis.queue_free()
	vis = Node3D.new(); node.add_child(vis); forSale = for_sale; color = color_
	var g := vis
	var col := Color.html(color)
	var b := Geo.Batcher.new()
	var dark := world == 2
	var baseTint := Color.html("#3a3038" if dark else "#ffffff")
	var floorMat := Geo.mat(baseTint.lerp(col, 0.18 if dark else 0.25), {"map": Tex.get_tex("tiles"), "rep": Vector2(6, 8), "r": 0.45 if dark else 0.7, "m": 0.3 if dark else 0.0})
	Geo.mesh(Geo.rbox(24, 0.3, BASE_HZ + BASE_BACK, 0.06), floorMat, 0, 0.15, (BASE_BACK - BASE_HZ) / 2, 1, 1, 1, g, false)
	floor_col = lbox(-BASE_HX, -BASE_HZ, BASE_HX, BASE_BACK, 0, FLOOR_Y, {"tag": "base" + str(index), "cam": false})
	var trim := Geo.mat(color, {"e": color, "ei": 0.35, "r": 0.4})
	b.add(Geo.G("box"), trim, 0, 0.31, -BASE_HZ + 0.12, 24, 0.04, 0.24); b.add(Geo.G("box"), trim, 0, 0.31, BASE_BACK - 0.12, 24, 0.04, 0.24)
	var wallMat := Geo.mat(Color.html("#2a2026" if dark else "#ffffff").lerp(col, 0.3 if dark else 0.45), {"map": Tex.get_tex("brick"), "rep": Vector2(4, 1), "r": 0.8, "e": color if dark else "#000000", "ei": 0.12 if dark else 0.0})
	var glass := Geo.glass_mat("#cfefff"); var metal := Geo.mat("#dfe6ee", {"m": 0.85, "r": 0.25}); var beam := Geo.mat(color, {"e": color, "ei": 0.55, "m": 0.3, "r": 0.35})
	var segs := [[-12, BASE_BACK - 0.4, 12, BASE_BACK], [-12, -10, -11.6, BASE_BACK], [11.6, -10, 12, BASE_BACK], [-12, -10, -3, -9.6], [3, -10, 12, -9.6]]
	for sgm in segs:
		var x0: float = sgm[0]; var z0: float = sgm[1]; var x1: float = sgm[2]; var z1: float = sgm[3]
		var sx := x1 - x0; var sz := z1 - z0; var mx := (x0 + x1) / 2; var mz := (z0 + z1) / 2
		b.add(Geo.G("box"), wallMat, mx, 0.9, mz, sx, 1.2, sz)
		Geo.mesh(Geo.G("box"), glass, mx, 2.3, mz, sx * 0.999, 1.6, sz * 0.6, g, false)
		b.add(Geo.G("box"), beam, mx, 3.25, mz, sx + 0.06, 0.3, sz + 0.06)
		b.add(Geo.G("box"), metal, mx, 1.52, mz, sx + 0.04, 0.08, sz + 0.08)
		var along := sx if sx > sz else sz
		var n := maxi(1, int(roundf(along / 4)))
		for i in range(n + 1):
			var t := float(i) / n
			var px := x0 + sx * t if sx > sz else mx
			var pz := mz if sx > sz else z0 + sz * t
			b.add(Geo.G("box"), metal, px, 1.8, pz, 0.28, 3.0, 0.28)
		lbox(x0, z0, x1, z1, 0, 3.4)
	for s in [-1, 1]:
		b.add(Geo.rbox(0.7, 5.4, 0.7, 0.1), beam, s * 3.35, 2.7, -9.8)
		lbox(s * 3.35 - 0.35, -10.15, s * 3.35 + 0.35, -9.45, 0, 5.4)
	b.add(Geo.rbox(7.6, 0.9, 0.8, 0.12), beam, 0, 5.4, -9.8)
	signs = []
	for s in [[-9.95, PI], [-9.65, 0.0]]:
		var sg := Sign.make([{"t": name, "size": 92, "color": "#fff", "weight": 900, "stroke": 8}, {"t": "پایگاه", "size": 44, "color": "#ffffff88", "weight": 800}], {"w": 768, "h": 256, "bg": color, "border": "rgba(255,255,255,.75)"}, 6.6, 2.2, false)
		sg.position = Vector3(0, 6.85, s[0]); sg.rotation.y = s[1]; g.add_child(sg); signs.append(sg)
	b.add(Geo.G("box"), metal, 0, 6.85, -9.8, 6.9, 2.4, 0.2)
	# kiosks
	var cab := Geo.mat("#f4f6fa", {"r": 0.5}); var dk := Geo.mat("#2a2f3e", {"m": 0.5, "r": 0.35}); var scr := Geo.mat("#14141e", {"r": 0.2, "e": "#29d9ff", "ei": 0.25}); var eyeM := Geo.mat("#7af7ff", {"e": "#29d9ff", "ei": 1.6})
	for k in KIOSKS:
		var lx: float = k[0]; var type: String = k[1]
		var kc: String = KIOSK_INFO[type].c
		var km := Geo.mat(kc, {"r": 0.45, "e": kc, "ei": 0.15}); var stripe := Geo.mat("#ffffff", {"r": 0.6})
		b.add(Geo.rbox(3.3, 1.1, 0.9, 0.08), cab, lx, 0.85, 10.1)
		b.add(Geo.G("box"), km, lx, 1.4, 10.1, 3.4, 0.1, 1.0)
		b.add(Geo.G("box"), km, lx, 0.85, 9.64, 3.32, 0.18, 0.02)
		b.add(Geo.G("box"), dk, lx, 2.25, 10.48, 3.3, 1.6, 0.2)
		b.add(Geo.G("box"), scr, lx, 2.35, 10.36, 2.6, 0.9, 0.04)
		for i in 6:
			b.add(Geo.G("box"), stripe if i % 2 else km, lx - 1.45 + i * 0.58, 3.25, 10.05, 0.58, 0.08, 1.1, 0, 0.32)
		for s in [-1, 1]:
			b.add(Geo.G("box"), dk, lx + s * 1.62, 1.9, 10.1, 0.12, 2.6, 0.9)
		b.add(Geo.G("sphere"), Geo.mat("#dfe6ee", {"m": 0.6, "r": 0.3}), lx, 1.85, 10.15, 0.34, 0.3, 0.3)
		b.add(Geo.G("box"), scr, lx, 1.88, 9.88, 0.44, 0.2, 0.04)
		for s in [-1, 1]:
			b.add(Geo.G("sphere"), eyeM, lx + s * 0.1, 1.88, 9.86, 0.05, 0.06, 0.03)
		b.add(Geo.G("cyl"), dk, lx, 2.22, 10.15, 0.02, 0.2, 0.02); b.add(Geo.G("sphere"), km, lx, 2.34, 10.15, 0.06, 0.06, 0.06)
		if type == "up":
			for i in 3:
				b.add(Geo.rbox(0.32, 0.3, 0.32, 0.04), Geo.mat(["#ffd23f", "#3df2b0", "#58c4ff"][i], {"r": 0.4}), lx - 1.1 + i * 0.35 + (1.5 if i > 1 else 0.0), 1.61, 9.85)
		elif type == "speed":
			b.add(Geo.rbox(0.5, 0.2, 0.26, 0.06), Geo.mat("#ff4f8b", {"r": 0.4}), lx - 1.05, 1.56, 9.85)
			b.add(Geo.G("oct"), Geo.mat("#ffe14a", {"e": "#ffb000", "ei": 0.8}), lx + 1.05, 1.72, 9.85, 0.14, 0.26, 0.06)
		else:
			b.add(Geo.G("capsule"), Geo.mat("#3df2b0", {"r": 0.7}), lx - 1.05, 1.72, 9.85, 0.36, 0.22, 0.2)
			b.add(Geo.G("cone"), Geo.mat("#ff4f8b", {"r": 0.6}), lx + 1.05, 1.66, 9.85, 0.2, 0.3, 0.2)
			b.add(Geo.G("cyl"), Geo.mat("#ff4f8b", {"r": 0.6}), lx + 1.05, 1.52, 9.85, 0.3, 0.04, 0.3)
		var sgk := kiosk_sign(type); sgk.position = Vector3(lx, 4.05, 10.05); g.add_child(sgk)
		lbox(lx - 1.7, 9.6, lx + 1.7, 10.6, 0, 3.2)
	# safe house
	var wood := Geo.mat("#d9a066", {"map": Tex.get_tex("wood"), "rep": Vector2(4, 1.5), "r": 0.85})
	var woodDark := Geo.mat("#8a5a32", {"map": Tex.get_tex("wood"), "rep": Vector2(1, 1), "r": 0.85})
	var planks := Geo.mat("#c8904e", {"map": Tex.get_tex("wood"), "rep": Vector2(10, 3), "r": 0.75})
	var hz1 := BASE_BACK - 0.4; var hd := hz1 - HOUSE_Z0; var hm := (HOUSE_Z0 + hz1) / 2; var dl := DOOR_X - DOOR_W / 2; var dr := DOOR_X + DOOR_W / 2
	Geo.mesh(Geo.G("box"), planks, 0, FLOOR_Y + 0.085, hm + 0.15, 23.2, 0.05, hd - 0.3, g, false)
	for xx in [[-11.6, dl], [dr, 11.6]]:
		var x0: float = xx[0]; var x1: float = xx[1]
		b.add(Geo.G("box"), wood, (x0 + x1) / 2, FLOOR_Y + HOUSE_H / 2, HOUSE_Z0 + 0.15, x1 - x0, HOUSE_H, 0.3)
		lbox(x0, HOUSE_Z0, x1, HOUSE_Z0 + 0.3, 0, HOUSE_H + FLOOR_Y)
	b.add(Geo.G("box"), wood, DOOR_X, FLOOR_Y + (DOOR_H + HOUSE_H) / 2, HOUSE_Z0 + 0.15, DOOR_W, HOUSE_H - DOOR_H, 0.3)
	lbox(dl, HOUSE_Z0, dr, HOUSE_Z0 + 0.3, FLOOR_Y + DOOR_H, FLOOR_Y + HOUSE_H)
	for s in [-1, 1]:
		b.add(Geo.G("box"), wood, s * 11.55, FLOOR_Y + HOUSE_H / 2, hm, 0.12, HOUSE_H, hd)
	b.add(Geo.G("box"), wood, 0, FLOOR_Y + HOUSE_H / 2, hz1 - 0.06, 23.2, HOUSE_H, 0.12)
	for x in [-11.6, dl - 0.1, dr + 0.1, 11.6]:
		b.add(Geo.G("box"), woodDark, x, FLOOR_Y + HOUSE_H / 2, HOUSE_Z0 + 0.15, 0.36, HOUSE_H, 0.4)
	b.add(Geo.G("box"), woodDark, 0, FLOOR_Y + HOUSE_H + 0.1, HOUSE_Z0 + 0.15, 23.6, 0.25, 0.42)
	for wx in [-8.5, -3.6, 8.4]:
		b.add(Geo.G("box"), woodDark, wx, FLOOR_Y + 2.0, HOUSE_Z0 - 0.02, 1.9, 1.4, 0.06)
		Geo.mesh(Geo.G("box"), glass, wx, FLOOR_Y + 2.0, HOUSE_Z0 - 0.06, 1.6, 1.1, 0.04, g, false)
		b.add(Geo.G("box"), woodDark, wx, FLOOR_Y + 2.0, HOUSE_Z0 - 0.08, 0.08, 1.1, 0.04)
		b.add(Geo.G("box"), woodDark, wx, FLOOR_Y + 1.25, HOUSE_Z0 - 0.15, 2.0, 0.1, 0.22)
	var vped := Geo.mat("#6b4423", {"r": 0.6}); var vtop := Geo.mat("#ffd23f", {"m": 0.9, "r": 0.25})
	for vl in VAULT_LOCAL:
		b.add(Geo.G("cyl"), vped, vl[0], 0.42, vl[1], 1.05, 0.24, 1.05); b.add(Geo.G("cyl"), vtop, vl[0], 0.56, vl[1], 0.95, 0.06, 0.95)
		var w := to_world(vl[0], vl[1])
		if not colDone:
			Phys.add_box_c(w.x, 0.3, w.y, 1.6, 0.5, 1.6, {"cam": false, "tag": "ped"})
	roof = Node3D.new(); g.add_child(roof)
	var roofM := Geo.mat("#b8603a", {"map": Tex.get_tex("roof"), "rep": Vector2(6, 2), "r": 0.8})
	var ry := FLOOR_Y + HOUSE_H + 0.2; var rl := Vector2(hd / 2 + 0.5, 2.7).length(); var ra := atan2(2.7, hd / 2 + 0.5)
	for s in [-1, 1]:
		var rp := Geo.mesh(Geo.G("box"), roofM, 0, ry + 1.35, hm + s * (hd / 4 + 0.25), 24.2, 0.22, rl, roof)
		Geo.rot(rp, s * ra)
	var gable := Geo.gable_g(4.6, 2.7, 0.3)
	for s in [-1, 1]:
		Geo.mesh(gable, wood, s * 11.7, ry, hm, 1, 1, hd / 9.2, roof)
	Geo.mesh(Geo.G("box"), woodDark, 0, ry + 2.75, hm, 24.4, 0.2, 0.3, roof)
	Geo.mesh(Geo.G("box"), Geo.mat("#8a3a2a", {"r": 0.9}), 7, ry + 2.4, hm + 1.8, 1, 2.2, 1, roof)
	var hs := Sign.make([{"t": "🏠 خانه‌ی امن", "size": 64, "color": "#fff", "weight": 900, "stroke": 6}, {"t": "۴ جای مخصوص میم‌های عزیزت", "size": 30, "color": "#fff", "weight": 800}], {"w": 384, "h": 150, "bg": "#8a5a32", "border": "#ffd23f"}, 2.6, 1.02)
	hs.position = Vector3(DOOR_X, FLOOR_Y + DOOR_H + 0.55, HOUSE_Z0 - 0.3); g.add_child(hs)
	# flags
	flags = []
	if FLAG_SHADER == null:
		FLAG_SHADER = Shader.new()
		FLAG_SHADER.code = "shader_type spatial; render_mode cull_disabled; uniform vec4 albedo : source_color = vec4(1.0); uniform float ph = 0.0;\nvoid vertex() { VERTEX.z += sin(VERTEX.x * 2.2 - TIME * 5.0 + ph) * 0.18 * (VERTEX.x / 1.8); }\nvoid fragment() { ALBEDO = albedo.rgb; EMISSION = albedo.rgb * 0.15; ROUGHNESS = 0.7; }"
	for s in [-1, 1]:
		b.add(Geo.G("cyl"), metal, s * 11.6, 3.5, -9.8, 0.08, 7, 0.08)
		var fm := ShaderMaterial.new(); fm.shader = FLAG_SHADER; fm.set_shader_parameter("albedo", col); fm.set_shader_parameter("ph", randf() * 6.0)
		var fl := Geo.mesh(Geo.grid_plane_g(1.8, 1.1, 8, 4, 0.9), fm, s * 11.6, 6.4, -9.8, 1, 1, 1, g)
		flags.append(fl)
	# pedestals
	ped = []
	var pedMat := Geo.mat("#e9edf3", {"m": 0.7, "r": 0.25}); var topMat := Geo.mat(color, {"r": 0.35, "m": 0.2})
	for i in SLOT_LOCAL.size():
		var lx: float = SLOT_LOCAL[i][0]; var lz: float = SLOT_LOCAL[i][1]
		b.add(Geo.G("cyl"), pedMat, lx, 0.38, lz, 1.05, 0.16, 1.05); b.add(Geo.G("cyl"), topMat, lx, 0.5, lz, 0.92, 0.08, 0.92)
		var ringM := Geo.mesh(Geo.G("torus"), Geo.add_mat(color, 0.85), lx, 0.56, lz, 1, 1, 0.4, g, false); Geo.rot(ringM, PI / 2)
		var lock := Sign.make([{"t": "🔒", "size": 120}], {"w": 128, "h": 128, "bg": false}, 0.9, 0.9); lock.position = Vector3(lx, 1.1, lz); g.add_child(lock)
		ped.append({"ring": ringM, "lock": lock})
		var w := to_world(lx, lz)
		if not colDone:
			Phys.add_box_c(w.x, 0.3, w.y, 1.6, 0.5, 1.6, {"cam": false, "tag": "ped"})
	# collect pad
	var padMat := Geo.mat("#2fe08a", {"e": "#2fe08a", "ei": 0.6, "r": 0.3})
	b.add(Geo.rbox(2.6, 0.12, 2.6, 0.05), padMat, 7.5, 0.34, -6.2)
	coin = Geo.mesh(Geo.G("cyl"), Geo.mat("#ffd23f", {"m": 1, "r": 0.25, "e": "#7a5200", "ei": 0.4}), 7.5, 1.4, -6.2, 0.45, 0.08, 0.45, g)
	padLabel = Sign.new(); padLabel.setup(3.2, 1.07, 384, 128, "rgba(10,60,40,.82)", "#2fe08a", true); padLabel.position = Vector3(7.5, 2.4, -6.2); g.add_child(padLabel)
	# security console
	b.add(Geo.rbox(1.3, 1.1, 0.9, 0.1), Geo.mat("#454b5e", {"m": 0.6, "r": 0.4}), -7.5, 0.85, -6.2)
	btn = Geo.mesh(Geo.G("hemi"), Geo.mat("#ff3344", {"e": "#ff2233", "ei": 0.8}), -7.5, 1.4, -6.2, 0.32, 0.22, 0.32, g)
	lbox(-8.15, -6.65, -6.85, -5.75, 0, 1.4)
	secLabel = Sign.new(); secLabel.setup(2.6, 0.87, 384, 128, "rgba(60,10,20,.8)", "#ff4a4a", true); secLabel.position = Vector3(-7.5, 2.3, -6.2); g.add_child(secLabel)
	# spawn marker
	var spm := Geo.mesh(Geo.G("ring"), Geo.add_mat("#ffffff", 0.35), 0, 0.33, -4.8, 1.1, 1.1, 1.1, g, false); Geo.rot(spm, -PI / 2)
	# laser barrier
	laser = Node3D.new(); g.add_child(laser); laser.visible = false
	laser_beams = []
	var lm := Geo.add_mat("#ff2a3a", 0.95)
	for i in 6:
		var lb := Geo.mesh(Geo.G("cylLow"), lm, 0, 0.55 + i * 0.5, -9.8, 0.045, 6, 0.045, laser, false); Geo.rot(lb, 0, 0, PI / 2); laser_beams.append(lb)
	var sheet := Geo.mesh(Geo.G("plane"), World.laser_sheet_mat(), 0, 1.85, -9.8, 6, 3.1, 1, laser, false)
	for s in [-1, 1]:
		b.add(Geo.G("box"), Geo.mat("#30303a", {"m": 0.7, "e": "#ff2a3a", "ei": 0.4}), s * 3.05, 1.8, -9.8, 0.2, 3, 0.35)
	# sticky trap decal
	trap = Geo.mesh(Geo.G("plane"), Geo.basic_mat("#b061ff", 0.35), 0, 0.33, -7.6, 6, 2.6, 1, g, false); Geo.rot(trap, -PI / 2); trap.visible = false
	b.build(g)
	ownerTag = Sign.new(); ownerTag.setup(5.4, 1.35, 512, 128, color + "dd", "#ffffff", true); ownerTag.position = Vector3(0, 9.2, 0); g.add_child(ownerTag)
	colDone = true
	if for_sale:
		padLabel.visible = false; secLabel.visible = false; coin.visible = false; btn.visible = false
	set_barrier(barrierActive)
	set_capacity(0 if for_sale else (owner.cap if owner else 4))

func set_capacity(cap: int) -> void:
	for i in ped.size():
		ped[i].lock.visible = i >= cap
		ped[i].ring.visible = i < cap

func set_barrier(on: bool) -> void:
	barrierActive = on
	if laser:
		laser.visible = on

func set_sign_name(name: String) -> void:
	for sg in signs:
		sg.set_lines("", [{"t": name, "size": 92, "color": "#fff", "weight": 900, "stroke": 8}, {"t": "پایگاه", "size": 44, "color": "#ffffff88", "weight": 800}])

func update(dt: float, t: float) -> void:
	if coin == null:
		return
	coin.basis = Geo.basis_xyz(PI / 2, 0, t * 2) * Basis.from_scale(Vector3(0.45, 0.08, 0.45))
	coin.position.y = 1.4 + sin(t * 2) * 0.12
	if laser.visible:
		for i in laser_beams.size():
			var lb: MeshInstance3D = laser_beams[i]
			var sx := 0.04 + sin(t * 30 + i) * 0.012
			lb.basis = Geo.basis_xyz(0, 0, PI / 2) * Basis.from_scale(Vector3(sx, 6, sx))
	btn.material_override = Geo.mat("#33ff88", {"e": "#22ff77", "ei": 0.9}) if barrierActive else Geo.mat("#ff3344", {"e": "#ff2233", "ei": 0.8})
