## World 2 — the lava planet: lava moats, bridges, guards, meteors, the forge.
class_name W2

static var built := false
static var lava: Array = []
static var bridges: Array = []
static var anim: Array = []
static var baseXs: Array = [Phys.X2 - 70, Phys.X2, Phys.X2 + 70]
static var baseZ := 34.0
static var moat := [12.0, 22.0]
static var plazaX := 112.0
static var playerPlot: BaseVis = null
static var keeper: Avatar = null
static var shopPos = null
static var planet: Node3D = null
static var belt_mat: StandardMaterial3D = null
static var lava_mat: StandardMaterial3D = null
static var PORTAL1 := Vector3(118, 0, -12)
static var PORTAL2 := Vector3(Phys.X2 - 103, 0, 0)

static func in_lava(x: float, z: float) -> bool:
	for r in lava:
		if x > r[0] and x < r[2] and z > r[1] and z < r[3]:
			return true
	return false

## a portal ring (used in every world); returns {g, ring, ring2, disc, colors}
static func make_portal(pos: Vector3, colors: Array, label: String, swirl: String) -> Dictionary:
	var g := Node3D.new(); g.position = pos; World.add_child(g)
	var frame := Geo.mat("#1a1020", {"m": 0.7, "r": 0.3, "e": colors[0], "ei": 0.4})
	for s in [-1, 1]:
		Geo.mesh(Geo.rbox(1.1, 7.6, 1.1, 0.2), frame, 0, 3.8, s * 3.9, 1, 1, 1, g)
	var ring := Geo.mesh(Geo.G("torus"), Geo.mat(colors[0], {"e": colors[0], "ei": 2}), 0, 3.8, 0, 3.4, 3.4, 4, g)
	var ring2 := Geo.mesh(Geo.G("torusThin"), Geo.add_mat(colors[1], 0.95), 0, 3.8, 0, 2.9, 2.9, 2.9, g, false)
	var disc := Geo.mesh(Geo.circle_g(3.2, 40), Geo.basic_mat("#ffffff", 0.85, {"map": Tex.get_tex(swirl), "side": true, "t": true}), 0, 3.8, 0, 1, 1, 1, g, false)
	disc.material_override.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	var sp := Sign.make([{"t": label, "size": 58, "color": "#fff", "weight": 900, "stroke": 6}], {"w": 640, "h": 140, "bg": "rgba(40,10,30,.9)", "border": colors[0]}, 7, 1.55); sp.position.y = 9; g.add_child(sp)
	return {"g": g, "ring": ring, "ring2": ring2, "disc": disc, "colors": colors}

static func anim_portal(P: Dictionary, dt: float, t: float) -> void:
	P.ring.basis = Geo.basis_xyz(t * 0.8, PI / 2, 0) * Basis.from_scale(Vector3(3.4, 3.4, 4))
	P.ring2.basis = Geo.basis_xyz(-t * 1.6, PI / 2, 0) * Basis.from_scale(Vector3(2.9, 2.9, 2.9))
	P.disc.basis = Geo.basis_xyz(t * 2.4, PI / 2, 0)
	if P.g.visible and randf() < dt * 25:
		var a := randf() * TAU; var p: Vector3 = P.g.position
		FX.one(p.x, p.y + 3.8 + sin(a) * 3, p.z + cos(a) * 3, {"vx": U.rnd(-1, 1), "vy": U.rnd(-0.5, 0.5), "vz": -cos(a) * 2, "life": 0.8, "size": 0.4, "color": U.pick(P.colors), "grav": 0, "drag": 0.4})

static func build() -> void:
	if built:
		return
	built = true
	var X2 := Phys.X2; var PX := plazaX; var m0: float = moat[0]; var m1: float = moat[1]
	var B := Phys.WORLD2
	var ground := Geo.mesh(Geo.plane_g(B.maxX - B.minX + 80, B.maxZ - B.minZ + 80), Geo.mat("#ffffff", {"map": Tex.get_tex("rock"), "rep": Vector2(70, 45), "emap": Tex.get_tex("rockGlow"), "e": "#ff5a1f", "ei": 0.7, "r": 0.95}), X2, 0, 0, 1, 1, 1, World, false)
	Geo.rot(ground, -PI / 2)
	World.ground_quad(X2 - PX, -m0, X2 + PX, m0, World.flat_mat(Tex.get_tex("obsidian"), "#ffffff", Vector2(PX / 2, 6)), 0.012)
	lava_mat = Geo.mat("#ffffff", {"map": Tex.get_tex("lava"), "rep": Vector2(40, 2), "emap": Tex.get_tex("lava"), "e": "#ffffff", "ei": 1.1, "r": 0.4}).duplicate()
	var bridgeMat := World.flat_mat(Tex.get_tex("obsidian"), "#ffb38a", Vector2(2, 3)); var rail := Geo.mat("#2a1a22", {"m": 0.6, "e": "#ff5a1f", "ei": 0.5})
	var b2 := Geo.Batcher.new()
	for s in [-1.0, 1.0]:
		var z0 := m0 if s > 0 else -m1; var z1 := m1 if s > 0 else -m0
		World.ground_quad(X2 - PX - 6, z0, X2 + PX + 6, z1, lava_mat, 0.03)
		var x := X2 - PX - 6
		for bx in baseXs:
			lava.append([x, z0, bx - 3, z1]); x = bx + 3
			World.ground_quad(bx - 3, z0, bx + 3, z1, bridgeMat, 0.06); bridges.append([bx - 3, z0, bx + 3, z1])
			for e in [-1, 1]:
				b2.add(Geo.G("box"), rail, bx + e * 2.9, 0.45, (z0 + z1) / 2, 0.2, 0.5, z1 - z0)
		lava.append([x, z0, X2 + PX + 6, z1])
		for bx in baseXs:
			World.ground_quad(bx - 3.5, s * m1, bx + 3.5, s * (baseZ - 9.5), bridgeMat, 0.05)
	b2.build(World)
	anim.append(func(dt: float, t: float) -> void:
		lava_mat.uv1_offset = Vector3(t * 0.04, sin(t * 0.3) * 0.1, 0); lava_mat.emission_energy_multiplier = 1 + sin(t * 2) * 0.15
		if Game.player != null and Phys.in_w2(Game.player.body.pos.x) and randf() < dt * 25:
			var r: Array = U.pick(lava)
			FX.one(U.rnd(r[0], r[2]), 0.2, U.rnd(r[1], r[3]), {"vx": U.rnd(-0.3, 0.3), "vy": U.rnd(1, 3), "vz": U.rnd(-0.3, 0.3), "life": 1.4, "size": U.rnd(0.2, 0.4), "color": U.pick(["#ffb000", "#ff5a1f", "#ffe14a"]), "grav": -1, "drag": 0.3}))
	# jagged obsidian walls
	var wallM := Geo.mat("#1a1018", {"r": 0.5, "m": 0.3, "e": "#ff3d00", "ei": 0.15, "flat": true}); var wb := Geo.Batcher.new()
	var x: float = B.minX
	while x <= B.maxX:
		for z in [B.minZ, B.maxZ]:
			wb.add(Geo.G("cone4"), wallM, x, 3, z, 3.4, U.rnd(5, 9), 2, U.rnd(0, 1))
		x += 6
	var z: float = B.minZ
	while z <= B.maxZ:
		for xx in [B.minX, B.maxX]:
			wb.add(Geo.G("cone4"), wallM, xx, 3, z, 2, U.rnd(5, 9), 3.4, U.rnd(0, 1))
		z += 6
	wb.build(World)
	Phys.add_box(B.minX - 2, 0, B.minZ - 2, B.maxX + 2, 6, B.minZ + 0.8); Phys.add_box(B.minX - 2, 0, B.maxZ - 0.8, B.maxX + 2, 6, B.maxZ + 2)
	Phys.add_box(B.minX - 2, 0, B.minZ, B.minX + 0.8, 6, B.maxZ); Phys.add_box(B.maxX - 0.8, 0, B.minZ, B.maxX + 2, 6, B.maxZ)
	# crystal belt
	var BT = Game.BELTS[1]
	belt_mat = World.build_belt_geometry(BT, "#1a1020", "belt2", "#ffffff", Geo.mat("#7af7ff", {"e": "#29d9ff", "ei": 1.4}), true, World)
	var rift := make_portal(Vector3(BT.x0 - 2.4, 0, 0), ["#ff3d00", "#ffd23f"], "🔥 شکاف گدازه", "swirl2"); rift.g.scale = Vector3(0.85, 0.85, 0.85)
	for s in [-1, 1]:
		Phys.add_box_c(BT.x0 - 2.4, 3.2, s * 3.3, 1, 6.4, 1)
	anim.append(func(dt: float, t: float) -> void: anim_portal(rift, dt, t))
	var furn := Node3D.new(); furn.position = Vector3(BT.x1 + 3.5, 0, 0); World.add_child(furn)
	Geo.mesh(Geo.rbox(5.4, 5, 6.6, 0.3), Geo.mat("#2a1a22", {"m": 0.6, "r": 0.4}), 0, 2.5, 0, 1, 1, 1, furn)
	Geo.mesh(Geo.G("box"), Geo.mat("#ff6a00", {"e": "#ff4a00", "ei": 2.5}), -2.65, 1.4, 0, 0.15, 2.2, 4.2, furn)
	Phys.add_box_c(BT.x1 + 3.5, 2.5, 0, 5.4, 5, 6.6)
	var fx1: float = BT.x1
	anim.append(func(dt: float, _t: float) -> void:
		if randf() < dt * 8:
			FX.one(fx1 + 4, 5.6, U.rnd(-2, 2), {"vx": U.rnd(-0.3, 0.3), "vy": U.rnd(1.5, 2.5), "vz": U.rnd(-0.3, 0.3), "life": 2, "size": 0.9, "color": "#3a2028", "grow": 0.7, "drag": 0.4}))
	# volcanoes, crystals, floating rocks
	var rockM := Geo.mat("#2a1c22", {"r": 0.95, "flat": true}); var glow := Geo.mat("#ff5a1f", {"e": "#ff4a00", "ei": 2.4})
	for v in [[X2 - 100, 55, 11, 18], [X2 + 100, -55, 12, 20], [X2 - 30, -58, 8, 13], [X2 + 40, 58, 9, 15], [X2 + 108, 48, 7, 11], [X2 - 108, -48, 7, 11]]:
		var vx: float = v[0]; var vz: float = v[1]; var r: float = v[2]; var h: float = v[3]
		Geo.mesh(Geo.cylinder_g(r * 0.28, r, h, 12), rockM, vx, h / 2, vz, 1, 1, 1, World)
		Geo.mesh(Geo.cylinder_g(r * 0.26, r * 0.26, 0.4, 12), glow, vx, h + 0.1, vz, 1, 1, 1, World, false)
		Phys.add_circle(vx, vz, r * 0.85, 0, h)
		anim.append(func(dt: float, _t: float) -> void:
			if randf() < dt * 10:
				FX.one(vx + U.rnd(-1, 1), h + 0.5, vz + U.rnd(-1, 1), {"vx": U.rnd(-1.5, 1.5), "vy": U.rnd(4, 8), "vz": U.rnd(-1.5, 1.5), "life": 1.8, "size": U.rnd(0.3, 0.6), "color": U.pick(["#ff5a1f", "#ffb000", "#ffe14a"]), "grav": -5, "drag": 0.2})
			if randf() < dt * 3:
				FX.one(vx, h + 1, vz, {"vx": U.rnd(-0.4, 0.4), "vy": 2.5, "vz": U.rnd(-0.4, 0.4), "life": 3, "size": 2, "color": "#3a2a30", "grow": 1, "drag": 0.3}))
	var cry := Geo.Batcher.new(); var cryM := Geo.mat("#ffffff", {"e": "#5a2a9a", "ei": 0.5, "r": 0.15, "m": 0.2, "flat": true})
	var ci := 0; var guard := 0
	while ci < 140 and guard < 3000:
		guard += 1
		var cx := U.rnd(B.minX + 4, B.maxX - 4); var cz := U.rnd(B.minZ + 4, B.maxZ - 4)
		var nearBase := false
		for bx in baseXs:
			if absf(cx - bx) < 15 and absf(cz) > baseZ - 13 and absf(cz) < baseZ + 24:
				nearBase = true
		if absf(cz) < moat[1] + 2 or nearBase or absf(cx - PORTAL2.x) < 6:
			continue
		var s := U.rnd(0.4, 1.4)
		cry.add(Geo.G("oct"), cryM, cx, s * 0.9, cz, s * 0.5, s * 1.5, s * 0.5, U.rnd(0, 3), U.rnd(-0.3, 0.3), U.rnd(-0.3, 0.3), U.pick(["#7af7ff", "#b061ff", "#ff4fd8", "#29d9ff"]))
		if s > 1:
			Phys.add_circle(cx, cz, s * 0.45, 0, s * 2)
		ci += 1
	cry.build(World)
	var floaters := Node3D.new(); World.add_child(floaters)
	var phs := []
	for i in 14:
		var fr := Geo.mesh(Geo.G("dodec"), rockM, U.rnd(B.minX, B.maxX), U.rnd(20, 40), U.rnd(-60, 60), U.rnd(2, 5), U.rnd(1.5, 3), U.rnd(2, 5), floaters)
		Geo.mesh(Geo.G("sphere"), glow, 0, -0.6, 0, 0.3 / fr.scale.x, 0.3 / fr.scale.y, 0.3 / fr.scale.z, fr, false)
		phs.append(randf() * 6)
	anim.append(func(dt: float, t: float) -> void:
		var i := 0
		for f in floaters.get_children():
			f.position.y += sin(t * 0.6 + phs[i]) * dt * 0.6; f.rotation.y += dt * 0.1
			i += 1)
	var welcome := Sign.make([{"t": "🌋 سیاره‌ی گدازه", "size": 72, "color": "#ffd23f", "weight": 900, "stroke": 6}, {"t": "گدازه می‌سوزاند · نگهبان‌ها بیدارند · شهاب‌سنگ می‌بارد", "size": 32, "color": "#fff", "weight": 800}], {"w": 768, "h": 220, "bg": "rgba(60,8,8,.92)", "border": "#ff5a1f"}, 11, 3.15)
	welcome.position = Vector3(X2, 9, 0); World.add_child(welcome)
	planet = Node3D.new(); World.add_child(planet); planet.visible = false
	Geo.mesh(Geo.G("sphere"), Geo.basic_mat("#ffffff", 1.0, {"map": Tex.get_tex("planet"), "nofog": true}), 0, 0, 0, 60, 60, 60, planet, false)
	var pr := Geo.mesh(Geo.G("torusThin"), Geo.basic_mat("#ffb38a", 0.6, {"nofog": true}), 0, 0, 0, 95, 95, 40, planet, false); Geo.rot(pr, 1.2, 0.3, 0)
	planet.get_child(0).extra_cull_margin = 16384; pr.extra_cull_margin = 16384
	# bases
	var first := World.bases.size()
	for zz in [baseZ, -baseZ]:
		for xx in baseXs:
			var bv := BaseVis.new(World.bases.size(), xx, zz); World.bases.append(bv); World.add_child(bv.node)
	playerPlot = World.bases[first + 1]
	playerPlot.build("#4a3a40", "پایگاه تو · منتظر توست", true)
	var k := 0
	for bi in [first, first + 2, first + 3, first + 4, first + 5]:
		var o := Owner.new(Game.owners.size(), Data.W2_NAMES[k], Data.W2_COLORS[k], false, World.bases[bi]); o.hard = true; Game.owners.append(o); o.base.build(o.color, o.name, false)
		var a := Agent.new(o, Data.W2_LOOKS[k], false); a.brain.aggr = U.rnd(1.5, 2.1); a.brain.stealCd = U.rnd(15, 35)
		Agent.new(o, Data.GUARD_LOOK, false, {"guard": o.base})
		o.apply_cap()
		k += 1
	for r in lava:
		World.reserve(r[0], r[1], r[2], r[3])
	Nav.build(2, func(x_: float, z_: float) -> bool: return in_lava(x_, z_))
	Portal.build2(); build_forge()
	BT.active = true
	Game.prefill_belt(BT, 600, 2.6, 3.6)
	UI.map_dirty()

static func seed_owner(o: Owner) -> void:
	o.hard = true; o.money = U.rndi(200, 800) * 1e6; o.up.cap = U.rndi(2, 4); o.up.secDur = 2; o.up.trap = U.rndi(1, 3); o.up.speed = 2
	var n := U.rndi(4, mini(o.cap, 7))
	for i in n:
		var x := randf() * 100; var r := 3
		for k in range(3, 8):
			x -= Data.W2_WEIGHTS[k]
			if x <= 0:
				r = k
				break
		var u := Unit.new(Data.pick_char(2, r), 5 if randf() < 0.1 else 4)
		u.owner = o; u.slot = o.slots[i]; o.slots[i].unit = u; u.state = "slotted"; u.place_at_slot(); u.set_plate("base")
	o.apply_cap()

static func build_forge() -> void:
	var SX := Phys.X2 + 108
	var g := Node3D.new(); g.position = Vector3(SX, 0, 0); World.add_child(g)
	shopPos = Vector3(SX - 7.5, 0, 0)
	var wall := Geo.mat("#2a1a22", {"r": 0.7, "e": "#ff3d00", "ei": 0.08}); var metal := Geo.mat("#3a3f58", {"m": 0.85, "r": 0.3}); var glow := Geo.mat("#ff6a00", {"e": "#ff4a00", "ei": 2.5})
	var b := Geo.Batcher.new()
	b.add(Geo.G("box"), wall, 5.8, 2.6, 0, 0.4, 5.2, 14); b.add(Geo.G("box"), wall, 0, 2.6, -7, 12, 5.2, 0.4); b.add(Geo.G("box"), wall, 0, 2.6, 7, 12, 5.2, 0.4)
	b.add(Geo.rbox(12.6, 0.5, 14.8, 0.15), Geo.mat("#1a1018", {"m": 0.6, "r": 0.4}), 0, 5.45, 0)
	b.add(Geo.rbox(1.4, 1.1, 9, 0.1), metal, -3.6, 0.55, 0); b.add(Geo.G("box"), glow, -3.6, 1.13, 0, 1.5, 0.06, 9.1)
	b.add(Geo.G("cyl"), metal, 2.5, 0.5, -4.5, 1.6, 1, 1.6); b.add(Geo.G("box"), glow, 2.5, 1.05, -4.5, 2.6, 0.1, 2.6)
	b.add(Geo.G("box"), metal, 1.2, 0.6, 4.2, 1.8, 0.5, 0.8); b.add(Geo.G("box"), metal, 1.2, 0.25, 4.2, 0.6, 0.5, 0.5)
	for i in 5:
		b.add(Geo.G("box"), Geo.mat(["#7af7ff", "#ff5a1f", "#b061ff", "#ffd23f", "#3df2b0"][i], {"e": ["#29d9ff", "#ff4a00", "#7a3cff", "#ffb000", "#1fbf86"][i], "ei": 0.9}), 5.3, 2 + (i % 2) * 1.2, -4 + i * 2, 0.4, 0.6, 1)
	b.build(g)
	Phys.add_box(SX + 5.6, 0, -7.2, SX + 6, 5.2, 7.2); Phys.add_box(SX - 6, 0, -7.2, SX + 6, 5.2, -6.8); Phys.add_box(SX - 6, 0, 6.8, SX + 6, 5.2, 7.2)
	Phys.add_box(SX - 4.3, 0, -4.5, SX - 2.9, 1.1, 4.5); Phys.add_circle(SX + 2.5, -4.5, 1.7, 0, 1.1)
	anim.append(func(dt: float, _t: float) -> void:
		if randf() < dt * 14:
			FX.one(SX + 2.5 + U.rnd(-1, 1), 1.2, -4.5 + U.rnd(-1, 1), {"vx": U.rnd(-0.4, 0.4), "vy": U.rnd(1.5, 3), "vz": U.rnd(-0.4, 0.4), "life": 0.9, "size": 0.3, "color": U.pick(["#ffb000", "#ff5a1f", "#ffe14a"]), "grav": -2, "drag": 0.4}))
	var sign := Sign.make([{"t": "🔥 کارگاه گدازه", "size": 74, "color": "#ffd23f", "weight": 900, "stroke": 6}, {"t": "ابزار مخصوص دزدی در سیاره‌ی گدازه", "size": 32, "color": "#fff", "weight": 800}], {"w": 640, "h": 200, "bg": "rgba(60,10,10,.95)", "border": "#ff5a1f"}, 8, 2.5); sign.position = Vector3(SX - 3, 7.6, 0); World.add_child(sign)
	keeper = Avatar.build(Data.W2_KEEPER_LOOK)
	keeper.root.position = Vector3(SX - 1.4, 0.1, 0); keeper.root.rotation.y = -PI / 2; Game.agents_node.add_child(keeper.root)
	World.reserve(SX - 7, -8, SX + 7, 8)

static func ensure_player_guard() -> void:
	var o: Owner = Game.owners[0] if Game.owners.size() > 0 else null
	if o == null or o.up.guardBot == 0 or o.guards.size() > 0:
		return
	for b in o.bases:
		if b.world == 2:
			Agent.new(o, Data.PLAYER_GUARD_LOOK, false, {"guard": b})
			return

static func update(dt: float, t: float) -> void:
	for f in anim:
		f.call(dt, t)
	if belt_mat:
		belt_mat.uv1_offset.x -= Game.belt_speed(Game.BELTS[1]) * dt / 2.0
