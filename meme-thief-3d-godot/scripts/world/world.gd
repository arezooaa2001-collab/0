## World 1 (autoload "World"): ground, conveyor, base plots, shop, leaderboard, fusion machine and decor.
extends Node3D

const BELT := {"x0": -108.0, "x1": 107.5, "z": 0.0, "halfW": 1.9, "top": 0.4, "speed": 3.0}
const LAYOUT := {"baseXs": [-125.0, -75.0, -25.0, 25.0, 75.0, 125.0], "baseZ": 36.0, "plazaX": 150.0, "ringZ": 64.0, "roadXs": [-100.0, -50.0, 0.0, 50.0, 100.0], "bldZ": 79.5}

var bases: Array[BaseVis] = []
var reserved: Array = []
var anim: Array[Callable] = []
var detail: Node3D
var shopPos := Vector3(-127.5, 0, 0)
var boardPos := Vector3(132, 0, 0)
var fusionPos := Vector3(0, 0, 11.5)
var buildings: Array = []
var fountains: Array = []
var belt_mat: StandardMaterial3D
var lamp_mat: StandardMaterial3D
var stars: MeshInstance3D = null
var stars_mat: StandardMaterial3D
var board: Sign = null
var fusion: Dictionary = {}
var _sheet_mat: StandardMaterial3D = null
var clouds: Dictionary = {}
var srand := U.Mulberry.new(1337)

func reserve(x0: float, z0: float, x1: float, z1: float) -> void:
	reserved.append([minf(x0, x1), minf(z0, z1), maxf(x0, x1), maxf(z0, z1)])

func is_reserved(x: float, z: float, m: float = 0.0) -> bool:
	for r in reserved:
		if x > r[0] - m and x < r[2] + m and z > r[1] - m and z < r[3] + m:
			return true
	return false

func laser_sheet_mat() -> StandardMaterial3D:
	if _sheet_mat == null:
		_sheet_mat = StandardMaterial3D.new()
		_sheet_mat.albedo_texture = Tex.get_tex("sheet")
		_sheet_mat.albedo_color = Color(1, 1, 1, 0.55)
		_sheet_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		_sheet_mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
		_sheet_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		_sheet_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
		_sheet_mat.disable_fog = true
		_sheet_mat.uv1_scale = Vector3(3, 2, 1)
	return _sheet_mat

func flat_mat(map: Texture2D, color: String = "#ffffff", rep: Vector2 = Vector2.ONE) -> StandardMaterial3D:
	if map == null:
		return Geo.mat(color, {"r": 0.92})
	return Geo.mat(color, {"map": map, "rep": rep, "r": 0.92})

func ground_quad(x0: float, z0: float, x1: float, z1: float, material: Material, y: float, parent: Node3D = null) -> MeshInstance3D:
	var m := Geo.mesh(Geo.G("plane"), material, (x0 + x1) / 2, y, (z0 + z1) / 2, absf(x1 - x0), absf(z1 - z0), 1, parent if parent else self, false)
	Geo.rot(m, -PI / 2)
	return m

func build_world() -> void:
	detail = Node3D.new(); add_child(detail)
	_build_ground(); _build_conveyor(); _build_bases(); _build_shop_and_board(); _build_fusion(); _build_decor(); _build_stars(); build_pads_w1()
	detail.visible = S.Q().decor

func _build_ground() -> void:
	var W := Phys.WORLD1
	var g := Geo.mesh(Geo.plane_g(W.maxX - W.minX + 60, W.maxZ - W.minZ + 60), Geo.mat("#ffffff", {"map": Tex.get_tex("grass"), "rep": Vector2(60, 50), "r": 0.95}), 0, 0, 0, 1, 1, 1, self, false)
	Geo.rot(g, -PI / 2)
	var PX: float = LAYOUT.plazaX; var RZ: float = LAYOUT.ringZ
	ground_quad(-PX, -18, PX, 18, flat_mat(Tex.get_tex("tiles"), "#ffffff", Vector2(PX / 2, 9)), 0.012); reserve(-PX, -18, PX, 18)
	var roadH := flat_mat(Tex.get_tex("road"), "#ffffff", Vector2((PX + 3) / 3, 1))
	for zc in [-RZ, RZ]:
		ground_quad(-PX - 3, zc - 3, PX + 3, zc + 3, roadH, 0.02); reserve(-PX - 3, zc - 3, PX + 3, zc + 3)
	var roadV := flat_mat(Tex.get_tex("roadV"), "#ffffff", Vector2(1, (RZ - 21) / 6))
	for xc in LAYOUT.roadXs:
		for s in [-1, 1]:
			ground_quad(xc - 3, s * 18, xc + 3, s * (RZ - 3), roadV, 0.021); reserve(xc - 3, s * 18, xc + 3, s * (RZ - 3))
	var pathMat := flat_mat(Tex.get_tex("tiles"), "#fff4e0", Vector2(3, 3))
	for bx in LAYOUT.baseXs:
		for s in [-1, 1]:
			ground_quad(bx - 3.5, s * 18, bx + 3.5, s * (LAYOUT.baseZ - 9.5), pathMat, 0.022); reserve(bx - 3.5, s * 18, bx + 3.5, s * (LAYOUT.baseZ - 9.5))
	var hedgeMat := Geo.mat("#ffffff", {"map": Tex.get_tex("hedge"), "rep": Vector2(40, 1), "r": 1.0})
	var hedge := func(x0: float, z0: float, x1: float, z1: float) -> void:
		Geo.mesh(Geo.G("box"), hedgeMat, (x0 + x1) / 2, 1.4, (z0 + z1) / 2, absf(x1 - x0), 2.8, absf(z1 - z0), self)
		Phys.add_box(x0, 0, z0, x1, 2.8, z1)
	hedge.call(W.minX, W.minZ - 1, W.maxX, W.minZ + 0.6); hedge.call(W.minX, W.maxZ - 0.6, W.maxX, W.maxZ + 1)
	hedge.call(W.minX - 1, W.minZ, W.minX + 0.6, W.maxZ); hedge.call(W.maxX - 0.6, W.minZ, W.maxX + 1, W.maxZ)

## generic belt geometry (used by every world); returns the scrolling belt material
func build_belt_geometry(B: Dictionary, frame_col: String, belt_tex: String, belt_tint: String, edge_mat: StandardMaterial3D, emissive: bool, parent: Node3D) -> StandardMaterial3D:
	var len: float = B.x1 - B.x0 + 0.5; var cx: float = (B.x0 + B.x1) / 2
	Geo.mesh(Geo.G("box"), Geo.mat(frame_col, {"m": 0.7, "r": 0.35}), cx, 0.17, 0, len, 0.34, 4.8, parent)
	var o := {"map": Tex.get_tex(belt_tex), "rep": Vector2(len / 2, 1), "r": 0.55, "m": 0.2}
	if emissive:
		o["emap"] = Tex.get_tex(belt_tex); o["e"] = "#ffffff"; o["ei"] = 0.35
	var bm: StandardMaterial3D = Geo.mat(belt_tint, o).duplicate()
	Geo.mesh(Geo.G("box"), bm, cx, 0.37, 0, len, 0.06, 3.8, parent, false)
	for s in [-1, 1]:
		Geo.mesh(Geo.G("box"), edge_mat, cx, 0.4, s * 2.15, len, 0.06, 0.18 if emissive else 0.3, parent)
	Phys.add_box(B.x0 - 0.25, 0, -2.4, B.x1 + 0.25, B.top, 2.4, {"tag": B.tag, "cam": false})
	return bm

func _build_conveyor() -> void:
	var B: Dictionary = Game.BELTS[0]
	belt_mat = build_belt_geometry(B, "#3b3f52", "belt", "#ffffff", Geo.mat("#ffd23f", {"r": 0.5}), false, self)
	var dark := Geo.mat("#22232c", {"m": 0.6, "r": 0.4})
	var b := Geo.Batcher.new()
	var x: float = B.x0
	while x <= B.x1:
		for s in [-1, 1]:
			b.add(Geo.G("cylLow"), dark, x, 0.2, s * 2.42, 0.16, 0.06, 0.16, 0, PI / 2)
		x += 2
	x = B.x0 + 4
	while x < B.x1:
		for s in [-1, 1]:
			b.add(Geo.G("box"), Geo.mat("#ff4f8b", {"e": "#ff4f8b", "ei": 0.7}), x, 0.42, s * 2.15, 1.2, 0.05, 0.32)
		x += 12
	b.build(self)
	# spawn portal
	var portal := Node3D.new(); portal.position = Vector3(B.x0 - 2.2, 0, 0); add_child(portal)
	var pil := Geo.mat("#5a4bd1", {"m": 0.5, "r": 0.3})
	for s in [-1, 1]:
		Geo.mesh(Geo.rbox(1.1, 6.4, 1.1, 0.15), pil, 0, 3.2, s * 3.3, 1, 1, 1, portal); Phys.add_box_c(B.x0 - 2.2, 3.2, s * 3.3, 1.1, 6.4, 1.1)
	Geo.mesh(Geo.rbox(1.4, 1, 8, 0.2), pil, 0, 6.6, 0, 1, 1, 1, portal)
	var ring := Geo.mesh(Geo.G("torus"), Geo.mat("#b28cff", {"e": "#8f5cff", "ei": 1.4, "m": 0.4}), 0, 3.3, 0, 2.7, 2.7, 2.7, portal)
	var ring2 := Geo.mesh(Geo.G("torusThin"), Geo.add_mat("#ff8fe0", 0.9), 0, 3.3, 0, 2.3, 2.3, 2.3, portal, false)
	var disc := Geo.mesh(Geo.circle_g(2.6, 32), Geo.basic_mat("#ffffff", 0.75, {"map": Tex.get_tex("swirl"), "side": true, "t": true}), 0, 3.3, 0, 1, 1, 1, portal, false)
	disc.material_override.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	var px: float = B.x0 - 2.2
	anim.append(func(dt: float, t: float) -> void:
		ring.basis = Geo.basis_xyz(t * 0.7, PI / 2, 0) * Basis.from_scale(Vector3(2.7, 2.7, 2.7))
		ring2.basis = Geo.basis_xyz(-t * 1.3, PI / 2, 0) * Basis.from_scale(Vector3(2.3, 2.3, 2.3))
		disc.basis = Geo.basis_xyz(t * 1.8, PI / 2, 0)
		if randf() < 0.3:
			FX.one(px, 3.3 + U.rnd(-2, 2), U.rnd(-2, 2), {"vx": U.rnd(0.5, 2), "vy": U.rnd(-0.3, 0.3), "vz": 0, "life": 1, "size": 0.35, "color": U.pick(["#c79bff", "#ff9fe8", "#ffffff"])}))
	var sp := Sign.make([{"t": "✨ دستگاه میم‌ساز ✨", "size": 52, "color": "#fff", "weight": 900}], {"bg": "rgba(90,60,200,.85)", "h": 128}, 6, 1.5); sp.position = Vector3(px, 8, 0); add_child(sp)
	# recycler
	var rec := Node3D.new(); rec.position = Vector3(B.x1 + 3.3, 0, 0); add_child(rec)
	Geo.mesh(Geo.rbox(5, 4.6, 6.4, 0.3), Geo.mat("#6c7a89", {"m": 0.6, "r": 0.35}), 0, 2.3, 0, 1, 1, 1, rec)
	Geo.mesh(Geo.G("box"), Geo.mat("#111111", {"r": 0.9}), -2.45, 1.4, 0, 0.2, 2.2, 4.2, rec)
	Geo.mesh(Geo.G("box"), Geo.mat("#ffd23f"), -2.5, 2.7, 0, 0.12, 0.25, 4.4, rec)
	var gears := []
	for s in [-1, 1]:
		gears.append(Geo.mesh(Geo.G("torus"), Geo.mat("#c0c8d0", {"m": 0.9, "r": 0.25}), 0, 3, s * 3.3, 1.2, 1.2, 3, rec))
	Geo.mesh(Geo.G("cyl"), Geo.mat("#59636e", {"m": 0.5}), 1.2, 5.6, 1.5, 0.5, 2, 0.5, rec)
	Phys.add_box_c(B.x1 + 3.3, 2.3, 0, 5, 4.6, 6.4)
	var rx: float = B.x1
	anim.append(func(dt: float, t: float) -> void:
		gears[0].basis = Geo.basis_xyz(0, 0, t * 2) * Basis.from_scale(Vector3(1.2, 1.2, 3))
		gears[1].basis = Geo.basis_xyz(0, 0, -t * 2) * Basis.from_scale(Vector3(1.2, 1.2, 3))
		if randf() < dt * 6:
			FX.one(rx + 4.5, 6.8, 1.5, {"vx": U.rnd(-0.3, 0.3), "vy": U.rnd(1.2, 2), "vz": U.rnd(-0.3, 0.3), "life": 2.2, "size": 0.9, "color": "#8a8f99", "grow": 0.6, "drag": 0.4}))
	var rs := Sign.make([{"t": "♻️ بازیافت", "size": 56, "color": "#fff", "weight": 900}], {"bg": "rgba(40,50,60,.85)", "h": 128}, 4.5, 1.2); rs.position = Vector3(B.x1 + 3.3, 5.9, -1.4); add_child(rs)

func _build_bases() -> void:
	for z in [LAYOUT.baseZ, -LAYOUT.baseZ]:
		for x in LAYOUT.baseXs:
			var b := BaseVis.new(bases.size(), x, z)
			bases.append(b); add_child(b.node)

func _build_shop_and_board() -> void:
	var SX := -135.0
	var g := Node3D.new(); g.position = Vector3(SX, 0, 0); add_child(g)
	var wall := Geo.mat("#ffe1ef", {"map": Tex.get_tex("brick"), "rep": Vector2(3, 1), "r": 0.8})
	var b := Geo.Batcher.new()
	b.add(Geo.G("box"), wall, -5.8, 2.5, 0, 0.4, 5, 14); b.add(Geo.G("box"), wall, 0, 2.5, -7, 12, 5, 0.4); b.add(Geo.G("box"), wall, 0, 2.5, 7, 12, 5, 0.4)
	Phys.add_box(SX - 6, 0, -7.2, SX - 5.6, 5, 7.2); Phys.add_box(SX - 6, 0, -7.2, SX + 6, 5, -6.8); Phys.add_box(SX - 6, 0, 6.8, SX + 6, 5, 7.2)
	b.add(Geo.rbox(12.6, 0.5, 14.8, 0.15), Geo.mat("#ff4f8b", {"r": 0.5}), 0, 5.2, 0)
	var awn := Geo.mesh(Geo.G("box"), Geo.mat("#ffffff", {"map": Tex.get_tex("stripe"), "rep": Vector2(6, 1), "r": 0.6}), 7, 4.4, 0, 3, 0.12, 14.6, g); Geo.rot(awn, 0, 0, -0.35)
	b.add(Geo.rbox(1.4, 1.1, 9, 0.1), Geo.mat("#8a5a35", {"r": 0.6}), 3.6, 0.55, 0)
	b.add(Geo.G("box"), Geo.mat("#ffd23f", {"m": 0.6, "r": 0.3}), 3.6, 1.14, 0, 1.5, 0.08, 9.1)
	Phys.add_box(SX + 2.9, 0, -4.5, SX + 4.3, 1.1, 4.5)
	for i in 4:
		for j in 2:
			b.add(Geo.G("box"), Geo.mat("#b07a4e"), -5.2, 1 + j * 1.6, -4.5 + i * 3, 1, 0.12, 2.6)
	b.add(Geo.G("box"), Geo.mat("#e8f5ff", {"m": 0.2, "r": 0.2}), 0, 0.05, 0, 11.6, 0.1, 13.6)
	var goods := ["#ff6b6b", "#ffd23f", "#3df2b0", "#58c4ff", "#b061ff"]
	for i in 16:
		b.add(Geo.G("sphere") if i % 2 else Geo.G("box"), Geo.mat(goods[i % 5], {"r": 0.4}), -5, 1.3 + (i % 2) * 1.6, -5.4 + (i / 2) * 1.5, 0.35, 0.35, 0.35)
	b.build(g)
	var sign := Sign.make([{"t": "🛒 فروشگاه ارتقا", "size": 74, "color": "#fff", "weight": 900, "stroke": 6}], {"w": 640, "h": 160, "bg": "rgba(255,79,139,.92)"}, 8, 2); sign.position = Vector3(SX + 3, 7.2, 0); add_child(sign)
	var coin := Geo.mesh(Geo.G("cyl"), Geo.mat("#ffd23f", {"m": 1, "r": 0.2, "e": "#6a4400", "ei": 0.3}), SX + 3, 9.6, 0, 1, 0.15, 1, self)
	anim.append(func(_dt: float, t: float) -> void: coin.basis = Geo.basis_xyz(PI / 2, 0, t * 1.6) * Basis.from_scale(Vector3(1, 0.15, 1)))
	reserve(SX - 7, -8, SX + 8, 8)
	# leaderboard screen
	var BX := 138.0
	var lb := Node3D.new(); lb.position = Vector3(BX, 0, 0); add_child(lb)
	var steel := Geo.mat("#4a5163", {"m": 0.8, "r": 0.3})
	for s in [-1, 1]:
		Geo.mesh(Geo.rbox(1, 11, 1, 0.12), steel, 0, 5.5, s * 7.5, 1, 1, 1, lb); Phys.add_box_c(BX, 5.5, s * 7.5, 1, 11, 1)
	Geo.mesh(Geo.rbox(1, 8, 15.4, 0.2), steel, 0.3, 6.6, 0, 1, 1, 1, lb); Phys.add_box_c(BX + 0.3, 6.6, 0, 1, 8, 15.4)
	board = Sign.new(); board.setup(14.6, 7.3, 1024, 512, "rgba(14,10,40,.95)", "#ffd23f", false)
	board.position = Vector3(-0.25, 6.6, 0); board.rotation.y = -PI / 2; lb.add_child(board)
	var ls := Sign.make([{"t": "🏆 جدول برترها", "size": 70, "color": "#fff", "weight": 900, "stroke": 6}], {"w": 640, "h": 160, "bg": "rgba(255,170,0,.92)"}, 7, 1.75); ls.position = Vector3(BX - 1, 11.8, 0); add_child(ls)
	reserve(BX - 5, -9, BX + 3, 9)

func build_building(x: float, z: float, w: float, d: float, h: float, color: String, faceSign: float) -> void:
	var g := Node3D.new(); g.position = Vector3(x, 0, z); add_child(g)
	var tex := Tex.windows(color, 0.2)
	var body := Geo.mat("#ffffff", {"map": tex, "rep": Vector2(maxf(1, roundf(w / 5)), maxf(1, roundf(h / 6))), "r": 0.75})
	var m := Geo.mesh(Geo.G("box"), body, 0, h / 2, 0, w, h, d, g)
	var trim := Geo.mat("#ffffff", {"r": 0.5})
	Geo.mesh(Geo.G("box"), trim, 0, h + 0.2, 0, w + 0.4, 0.4, d + 0.4, g)
	if h < 11:
		Geo.mesh(Geo.G("pyrSq"), Geo.mat("#ffffff", {"map": Tex.get_tex("roof"), "rep": Vector2(3, 3), "r": 0.8}), 0, h + 0.4 + 1.6, 0, w * 1.1, 3.2, d * 1.1, g)
	else:
		Geo.mesh(Geo.G("box"), Geo.mat("#c9ced6", {"m": 0.6, "r": 0.3}), w * 0.2, h + 1, d * 0.1, 2, 1.4, 2, g)
		Geo.mesh(Geo.G("cyl"), Geo.mat("#9aa3ae", {"m": 0.7}), -w * 0.25, h + 1.2, 0, 0.6, 1.8, 0.6, g)
	Geo.mesh(Geo.G("box"), Geo.mat("#7a4b2a", {"r": 0.6}), 0, 1.3, faceSign * (d / 2 + 0.05), 2, 2.6, 0.12, g)
	var aw := Geo.mesh(Geo.G("box"), Geo.mat(U.pick(["#ff4f8b", "#3df2b0", "#58c4ff", "#ffd23f"])), 0, 2.9, faceSign * (d / 2 + 0.6), 3, 0.15, 1.3, g); Geo.rot(aw, faceSign * 0.25)
	Phys.add_box(x - w / 2, 0, z - d / 2, x + w / 2, h + 0.4, z + d / 2)
	reserve(x - w / 2 - 1, z - d / 2 - 1, x + w / 2 + 1, z + d / 2 + 1)
	buildings.append({"x": x, "z": z, "w": w, "d": d, "color": color})

func build_windmill(x: float, z: float) -> void:
	var g := Node3D.new(); g.position = Vector3(x, 0, z); add_child(g)
	Geo.mesh(Geo.cylinder_g(1.6, 2.6, 12, 12), Geo.mat("#fff3e6", {"map": Tex.get_tex("brick"), "rep": Vector2(3, 3), "r": 0.8}), 0, 6, 0, 1, 1, 1, g)
	Geo.mesh(Geo.G("cone"), Geo.mat("#ffffff", {"map": Tex.get_tex("roof"), "rep": Vector2(3, 3), "r": 0.8}), 0, 13.3, 0, 2.2, 2.6, 2.2, g)
	var hub := Node3D.new(); hub.position = Vector3(0, 11.5, 2.4); g.add_child(hub)
	Geo.mesh(Geo.G("sphere"), Geo.mat("#7a4b2a"), 0, 0, 0, 0.5, 0.5, 0.5, hub)
	var bm := Geo.Batcher.new()
	for i in 4:
		bm.add(Geo.G("box"), Geo.mat("#ffffff", {"map": Tex.get_tex("wood"), "r": 0.8}), 0, 0, 0, 1.3, 6.4, 0.1)
		# blade offset (0,3.6,0) rotated by i*PI/2 about z
		var a := i * PI / 2
		bm.add(Geo.G("box"), Geo.mat("#ffffff", {"map": Tex.get_tex("wood"), "r": 0.8}), -sin(a) * 3.6, cos(a) * 3.6, 0, 1.3, 6.4, 0.1, 0, 0, a)
	bm.build(hub)
	Phys.add_circle(x, z, 2.6, 0, 13)
	anim.append(func(dt: float, _t: float) -> void: hub.rotation.z += dt * 0.9)
	reserve(x - 4, z - 4, x + 4, z + 4)

func build_fountain(x: float, z: float) -> void:
	var g := Node3D.new(); g.position = Vector3(x, 0, z); add_child(g)
	var stone := Geo.mat("#f0e6d8", {"map": Tex.get_tex("tiles"), "rep": Vector2(4, 1), "r": 0.7})
	Geo.mesh(Geo.cylinder_g(3, 3.2, 0.7, 28, true), Geo.mat("#f0e6d8", {"map": Tex.get_tex("tiles"), "rep": Vector2(4, 1), "r": 0.7, "side": true}), 0, 0.35, 0, 1, 1, 1, g)
	var tr := Geo.mesh(Geo.G("torus"), stone, 0, 0.7, 0, 3, 3, 3, g); Geo.rot(tr, PI / 2)
	var water := Geo.mesh(Geo.circle_g(2.95, 28), Geo.mat("#3fb7ff", {"r": 0.05, "m": 0.3, "t": 0.8}), 0, 0.55, 0, 1, 1, 1, g, false); Geo.rot(water, -PI / 2)
	Geo.mesh(Geo.G("cyl"), stone, 0, 1.2, 0, 0.4, 1.8, 0.4, g)
	var hemi := Geo.mesh(Geo.G("hemi"), stone, 0, 2.3, 0, 1.1, 1, 1.1, g); Geo.rot(hemi, PI)
	Phys.add_circle(x, z, 3.15, 0, 0.75); Phys.add_circle(x, z, 0.5, 0, 2.4)
	fountains.append({"x": x, "z": z})
	anim.append(func(dt: float, t: float) -> void:
		water.position.y = 0.55 + sin(t * 2) * 0.02
		if randf() < dt * 30:
			var a := randf() * TAU
			FX.one(x, 2.4, z, {"vx": cos(a) * 1.3, "vy": U.rnd(3, 4.5), "vz": sin(a) * 1.3, "life": 0.9, "size": 0.28, "color": "#cdefff", "grav": -9, "drag": 0.2}))
	reserve(x - 4, z - 4, x + 4, z + 4)

func _multimesh(geo: Array, mat: StandardMaterial3D, count: int, parent: Node3D, shadow: bool = true) -> MultiMeshInstance3D:
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.mesh = Geo.mesh_of(geo)
	mm.instance_count = count
	var mi := MultiMeshInstance3D.new()
	mi.multimesh = mm
	var m: StandardMaterial3D = mat.duplicate()
	m.vertex_color_use_as_albedo = true
	mi.material_override = m
	if not shadow:
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(mi)
	return mi

func _build_decor() -> void:
	var pal := ["#ffd6a5", "#bde0fe", "#ffc8dd", "#caffbf", "#fdffb6", "#e0c3fc", "#ffadad", "#a0c4ff"]
	var BZ: float = LAYOUT.bldZ
	var xs := []
	var x := -140.0
	while x <= 140.1:
		xs.append(roundf(x)); x += 23.33
	for i in xs.size():
		var xx: float = xs[i]
		build_building(xx + U.rnd(-1, 1), BZ, U.rnd(12, 16), U.rnd(8, 9.5), U.pick([7, 9, 13, 16, 19]), pal[i % 8], -1)
		if i == 3 or i == 10:
			build_windmill(xx, -BZ + 0.5)
		else:
			build_building(xx + U.rnd(-1, 1), -BZ, U.rnd(12, 16), U.rnd(8, 9.5), U.pick([7, 9, 13, 16, 19]), pal[(i + 3) % 8], 1)
	build_fountain(-50, 10); build_fountain(50, -10); build_fountain(-100, -10); build_fountain(100, 10)
	# trees
	var W := Phys.WORLD1
	var trees := []
	var guard := 0
	while trees.size() < 170 and guard < 9000:
		guard += 1
		var tx: float = srand.next() * (W.maxX - W.minX - 6) + W.minX + 3; var tz: float = srand.next() * (W.maxZ - W.minZ - 6) + W.minZ + 3
		if is_reserved(tx, tz, 2.2):
			continue
		var close := false
		for t in trees:
			if (t.x - tx) * (t.x - tx) + (t.z - tz) * (t.z - tz) < 25:
				close = true
				break
		if close:
			continue
		trees.append({"x": tx, "z": tz, "s": 0.8 + srand.next() * 0.6, "kind": 1 if srand.next() < 0.3 else 0})
	var trunkMat := Geo.mat("#9b6a42", {"map": Tex.get_tex("wood"), "r": 0.9})
	var leafMat := Geo.mat("#ffffff", {"r": 0.85, "flat": true})
	var trunkIM := _multimesh(Geo.G("cyl"), trunkMat, trees.size(), self)
	var leafIM := _multimesh(Geo.G("ico"), leafMat, trees.size() * 3, self)
	var pineIM := _multimesh(Geo.G("cone"), leafMat, trees.size() * 2, self)
	var li := 0; var pi_ := 0
	var leafCols := ["#4caf50", "#66bb6a", "#7cc95a", "#3f9e45", "#8bd16b", "#f58fb5"]
	for i in trees.size():
		var t: Dictionary = trees[i]
		trunkIM.multimesh.set_instance_transform(i, Transform3D(Basis.from_scale(Vector3(0.28 * t.s, 2.8 * t.s, 0.28 * t.s)), Vector3(t.x, 1.4 * t.s, t.z)))
		trunkIM.multimesh.set_instance_color(i, Color.WHITE)
		if t.kind == 0:
			for k in 3:
				var r: float = (1.7 if k == 1 else 1.3) * t.s
				leafIM.multimesh.set_instance_transform(li, Transform3D(Basis(Vector3.UP, float(k)) * Basis.from_scale(Vector3(r, r * 0.9, r)), Vector3(t.x + (k - 1) * 0.7 * t.s, (3 + (0.9 if k == 1 else 0.0)) * t.s, t.z + ((k * 37) % 3 - 1) * 0.5 * t.s)))
				leafIM.multimesh.set_instance_color(li, Color.html(leafCols[(i + (5 if i % 7 == 0 else k)) % 6]))
				li += 1
		else:
			for k in 2:
				pineIM.multimesh.set_instance_transform(pi_, Transform3D(Basis.from_scale(Vector3((1.8 - k * 0.5) * t.s, 2.6 * t.s, (1.8 - k * 0.5) * t.s)), Vector3(t.x, (3.2 + k * 1.4) * t.s, t.z)))
				pineIM.multimesh.set_instance_color(pi_, Color.html("#2f8a4a" if k else "#267a40"))
				pi_ += 1
		Phys.add_circle(t.x, t.z, 0.38 * t.s, 0, 4)
	leafIM.multimesh.visible_instance_count = li; pineIM.multimesh.visible_instance_count = pi_
	# bushes + flowers (detail)
	var bushIM := _multimesh(Geo.G("ico"), leafMat, 300, detail)
	var flowerIM := _multimesh(Geo.G("sphere"), Geo.mat("#ffffff", {"r": 0.6}), 700, detail, false)
	var bi := 0; var fi := 0
	var addBush := func(bx: float, bz: float, s: float) -> void:
		if bi >= 300:
			return
		bushIM.multimesh.set_instance_transform(bi, Transform3D(Basis.from_scale(Vector3(0.9 * s, 0.7 * s, 0.9 * s)), Vector3(bx, 0.4 * s, bz)))
		bushIM.multimesh.set_instance_color(bi, Color.html(U.pick(["#3f9e45", "#4caf50", "#5cb85c", "#2e8b57"])))
		bi += 1
	for bs in bases:
		for s in [-1, 1]:
			for k in range(-3, 4):
				var w: Vector2 = bs.to_world(s * 13, k * 2.8)
				addBush.call(w.x, w.y, U.rnd(0.8, 1.2))
	guard = 0
	while bi < 300 and guard < 5000:
		guard += 1
		var bx := U.rnd(-155, 155); var bz := U.rnd(-76, 76)
		if not is_reserved(bx, bz, 0.8):
			addBush.call(bx, bz, U.rnd(0.6, 1.3))
	guard = 0
	while fi < 700 and guard < 9000:
		guard += 1
		var fx := U.rnd(-155, 155); var fz := U.rnd(-76, 76)
		if is_reserved(fx, fz, 0.4):
			continue
		var s := U.rnd(0.09, 0.16)
		flowerIM.multimesh.set_instance_transform(fi, Transform3D(Basis.from_scale(Vector3(s, s, s)), Vector3(fx, 0.15, fz)))
		flowerIM.multimesh.set_instance_color(fi, Color.html(U.pick(["#ff6b9d", "#ffd23f", "#ffffff", "#b28cff", "#ff8a3d"])))
		fi += 1
	bushIM.multimesh.visible_instance_count = bi; flowerIM.multimesh.visible_instance_count = fi
	# streetlights, benches, flower pots
	var b := Geo.Batcher.new()
	var pole := Geo.mat("#2d3142", {"m": 0.7, "r": 0.35})
	lamp_mat = StandardMaterial3D.new(); lamp_mat.albedo_color = Color.html("#fff6c8"); lamp_mat.emission_enabled = true; lamp_mat.emission = Color.html("#ffe9a0"); lamp_mat.emission_energy_multiplier = 1.3
	var light := func(lx: float, lz: float) -> void:
		b.add(Geo.G("cylLow"), pole, lx, 2.4, lz, 0.1, 4.8, 0.1); b.add(Geo.G("box"), pole, lx, 4.85, lz, 0.9, 0.1, 0.16); b.add(Geo.G("sphere"), lamp_mat, lx + 0.4, 4.7, lz, 0.24, 0.2, 0.24)
		Phys.add_circle(lx, lz, 0.18, 0, 5)
	x = -147
	while x <= 147:
		for s in [-1, 1]:
			var near_road := false
			for rx in LAYOUT.roadXs:
				if absf(rx - x) < 4:
					near_road = true
			if not near_road:
				light.call(x, s * (LAYOUT.ringZ - 3.7))
		x += 14
	x = -144
	while x <= 144:
		for s in [-1, 1]:
			var skip := false
			for bx in LAYOUT.baseXs:
				if absf(bx - x) < 6:
					skip = true
			for rx in LAYOUT.roadXs:
				if absf(rx - x) < 4:
					skip = true
			if not skip:
				light.call(x, s * 17.4)
		x += 16
	var benchWood := Geo.mat("#ffffff", {"map": Tex.get_tex("wood"), "r": 0.8})
	for bx in [-112, -88, -62, -38, -12, 12, 38, 62, 88, 112]:
		for bz_ry in [[15.5, PI], [-15.5, 0.0]]:
			var bz: float = bz_ry[0]; var ry: float = bz_ry[1]
			b.add(Geo.G("box"), benchWood, bx, 0.5, bz, 2.2, 0.1, 0.6, ry)
			b.add(Geo.G("box"), benchWood, bx - sin(ry) * 0.28, 0.85, bz - cos(ry) * 0.28, 2.2, 0.5, 0.08, ry)
			for s in [-1, 1]:
				b.add(Geo.G("box"), pole, bx + cos(ry) * s * 0.9, 0.25, bz - sin(ry) * s * 0.9, 0.1, 0.5, 0.5, ry)
			Phys.add_box_c(bx, 0.5, bz, 2.2, 1, 0.8, {"cam": false})
	var pot := Geo.mat("#d9774a", {"r": 0.7})
	for px in [-80, -30, 30, 80]:
		for pz in [5.5, -5.5]:
			b.add(Geo.G("cyl"), pot, px, 0.4, pz, 0.7, 0.8, 0.7); b.add(Geo.G("ico"), leafMat, px, 1.1, pz, 0.8, 0.6, 0.8, 0, 0, 0, "#5cb85c")
			Phys.add_circle(px, pz, 0.75, 0, 0.8)
	b.build(self)
	var ws := Sign.make([{"t": "به میدان میم‌ها خوش آمدی!", "size": 64, "color": "#fff", "weight": 900, "stroke": 6}, {"t": "بخر · جمع کن · بدزد", "size": 40, "color": "#ffd23f", "weight": 800}], {"w": 768, "h": 220, "bg": "rgba(43,31,105,.9)"}, 11, 3.15)
	ws.position = Vector3(0, 9, 0); add_child(ws)
	# balloons
	var bcols := ["#ff4f8b", "#ffd23f", "#3df2b0", "#58c4ff", "#b061ff"]
	var groups := []
	for gp in [Vector3(-50, 0, 10), Vector3(50, 0, -10)]:
		var balloons := Node3D.new(); balloons.position = gp; add_child(balloons)
		for i in 5:
			Geo.mesh(Geo.G("sphere"), Geo.mat(bcols[i], {"r": 0.25, "m": 0.1}), cos(i * 1.3) * 0.8, 6 + i * 0.3, sin(i * 1.3) * 0.8, 0.55, 0.7, 0.55, balloons)
		groups.append(balloons)
	anim.append(func(_dt: float, t: float) -> void:
		for grp in groups:
			var i := 0
			for m in grp.get_children():
				m.position.y = 6 + i * 0.3 + sin(t * 1.4 + i) * 0.25
				i += 1)
	# clouds
	var cloudIM := _multimesh(Geo.G("ico"), Geo.mat("#ffffff", {"r": 1.0, "e": "#dbe9ff", "ei": 0.35, "flat": true}), 26 * 5, self, false)
	var list := []
	var ci := 0
	for i in 26:
		var ccx := U.rnd(-320, 320); var ccz := U.rnd(-220, 220); var ccy := U.rnd(55, 95); var s := U.rnd(4, 9)
		for k in 5:
			list.append({"i": ci, "ox": (k - 2) * s * 0.9, "oy": (k % 2) * s * 0.3, "oz": U.rnd(-1, 1) * s * 0.4, "r": s * (1.3 if k == 2 else U.rnd(0.7, 1)), "cx": ccx, "cy": ccy, "cz": ccz})
			cloudIM.multimesh.set_instance_color(ci, Color.WHITE)
			ci += 1
	cloudIM.extra_cull_margin = 16384
	clouds = {"im": cloudIM, "list": list}
	anim.append(func(dt: float, _t: float) -> void:
		for c in list:
			c.cx += dt * 1.6
			if c.cx > 340:
				c.cx -= 680
			cloudIM.multimesh.set_instance_transform(c.i, Transform3D(Basis.from_scale(Vector3(c.r, c.r * 0.6, c.r)), Vector3(c.cx + c.ox, c.cy + c.oy, c.cz + c.oz))))

func _build_fusion() -> void:
	var P0 := fusionPos
	var g := Node3D.new(); g.position = P0; add_child(g)
	var steel := Geo.mat("#3a3f58", {"m": 0.8, "r": 0.3}); var neon := Geo.mat("#b061ff", {"e": "#a040ff", "ei": 1.6}); var gold := Geo.mat("#ffd23f", {"m": 1, "r": 0.2})
	Geo.mesh(Geo.G("cyl"), steel, 0, 0.3, 0, 2.6, 0.6, 2.6, g)
	var t1 := Geo.mesh(Geo.G("torus"), neon, 0, 0.62, 0, 2.55, 2.55, 1, g); Geo.rot(t1, PI / 2)
	Geo.mesh(Geo.G("cyl"), steel, 0, 1.0, 0, 1.5, 0.8, 1.5, g)
	Geo.mesh(Geo.G("hemi"), Geo.glass_mat("#d9b8ff"), 0, 1.4, 0, 1.45, 1.6, 1.45, g, false)
	var core := Geo.mesh(Geo.G("ico"), Geo.mat("#ff6fcf", {"e": "#ff2af0", "ei": 2}), 0, 2.1, 0, 0.45, 0.45, 0.45, g)
	var rings := []
	for i in 3:
		rings.append(Geo.mesh(Geo.G("torusThin"), Geo.add_mat(["#ff6fcf", "#7af7ff", "#ffd23f"][i], 0.9), 0, 2.1, 0, 0.9 + i * 0.25, 0.9 + i * 0.25, 0.9 + i * 0.25, g, false))
	for i in 3:
		var a := i / 3.0 * TAU + PI / 2
		var x := cos(a) * 2.1; var z := sin(a) * 2.1
		Geo.mesh(Geo.G("cyl"), steel, x, 1.2, z, 0.35, 2.4, 0.35, g); Geo.mesh(Geo.G("sphere"), neon, x, 2.55, z, 0.32, 0.32, 0.32, g)
		var rod := Geo.mesh(Geo.G("cyl"), gold, x * 0.55, 2.55, z * 0.55, 0.06, 1.6, 0.06, g); Geo.rot(rod, 0, -a, PI / 2)
	var sign := Sign.make([{"t": "⚗️ دستگاه ترکیب", "size": 66, "color": "#fff", "weight": 900, "stroke": 6}, {"t": "۳ میم یکسان ← ۱ میم کمیاب‌تر", "size": 34, "color": "#ffd23f", "weight": 800}], {"w": 640, "h": 200, "bg": "rgba(90,30,160,.92)"}, 6.4, 2); sign.position = Vector3(P0.x, 5.6, P0.z); add_child(sign)
	Phys.add_circle(P0.x, P0.z, 2.65, 0, 3.2, {"cam": true})
	fusion = {"core": core, "rings": rings, "boost": 0.0}
	anim.append(func(dt: float, t: float) -> void:
		var k: float = 1 + fusion.boost * 4
		fusion.boost = maxf(0.0, fusion.boost - dt * 0.4)
		for i in 3:
			var r: MeshInstance3D = rings[i]
			var sc := 0.9 + i * 0.25
			r.basis = Geo.basis_xyz(t * (0.8 + i * 0.5) * k, t * (0.5 + i * 0.3) * k, 0) * Basis.from_scale(Vector3(sc, sc, sc))
		var cs: float = 0.45 + sin(t * 4) * 0.05 + fusion.boost * 0.3
		core.basis = Basis(Vector3.UP, t * 2 * k) * Basis.from_scale(Vector3(cs, cs, cs))
		if randf() < dt * (3 + fusion.boost * 40):
			FX.one(P0.x + U.rnd(-1, 1), 2.1 + U.rnd(-0.6, 0.6), P0.z + U.rnd(-1, 1), {"vx": U.rnd(-0.5, 0.5), "vy": U.rnd(0.5, 2), "vz": U.rnd(-0.5, 0.5), "life": 1, "size": 0.3, "color": U.pick(["#ff6fcf", "#7af7ff", "#ffd23f"]), "grav": 0, "drag": 0.5}))
	reserve(P0.x - 4, P0.z - 4, P0.x + 4, P0.z + 4)

func _build_stars() -> void:
	var pts := PackedVector3Array()
	for i in 600:
		var th := randf() * TAU; var ph := acos(U.rnd(0.05, 1)); var r := 450.0
		pts.append(Vector3(sin(ph) * cos(th) * r, cos(ph) * r, sin(ph) * sin(th) * r))
	stars = Geo.points_mesh(pts, Color(1, 1, 1, 0), 2.2)
	stars.extra_cull_margin = 16384
	stars_mat = stars.material_override
	add_child(stars)

# ---------------------------------------------------------------- jump pads (world geometry; logic lives in Extras)
var pads: Array = []
func make_pad(x: float, z: float, dir, color: String, power = null) -> Dictionary:
	var g := Node3D.new(); g.position = Vector3(x, 0, z); add_child(g)
	Geo.mesh(Geo.G("cyl"), Geo.mat("#2d3142", {"m": 0.7, "r": 0.3}), 0, 0.08, 0, 1.35, 0.16, 1.35, g)
	var top := Geo.mesh(Geo.G("cyl"), Geo.mat(color, {"e": color, "ei": 1.4}), 0, 0.18, 0, 1.1, 0.06, 1.1, g)
	for i in 3:
		var tr := Geo.mesh(Geo.G("torus"), Geo.mat("#c0c8d0", {"m": 0.9, "r": 0.2}), 0, 0.05 + i * 0.05, 0, 0.7, 0.7, 0.5, g); Geo.rot(tr, PI / 2)
	var ar := Geo.mesh(Geo.G("cone"), Geo.add_mat("#ffffff", 0.85), 0, 1.2, 0, 0.35, 0.7, 0.35, g, false)
	if dir != null:
		# ZXY order: point the cone along `dir`
		ar.basis = Basis(Vector3.BACK, -atan2(dir[0], dir[1])) * Basis(Vector3.RIGHT, PI / 2) * Basis.from_scale(Vector3(0.35, 0.7, 0.35))
		ar.position.y = 0.6
	var p := {"g": g, "x": x, "z": z, "dir": dir, "top": top, "ar": ar, "power": power}
	pads.append(p)
	return p

func build_pads_w1() -> void:
	for xz in [[-90, 10], [90, -10], [-40, -11], [40, 11], [-125, -11], [125, 11], [0, -11]]:
		make_pad(xz[0], xz[1], null, "#3df2b0")

func update(dt: float, t: float) -> void:
	for f in anim:
		f.call(dt, t)
	if belt_mat:
		belt_mat.uv1_offset.x -= Game.belt_speed(Game.BELTS[0]) * dt / 2.0
	if _sheet_mat:
		_sheet_mat.uv1_offset.y = t * 1.5
	for b in bases:
		b.update(dt, t)
