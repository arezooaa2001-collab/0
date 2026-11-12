## World 3 — the sky islands: floating islands, narrow bridges, a void below, strong winds and lightning.
class_name W3

static var built := false
static var walk: Array = []
static var anim: Array = []
static var wind := {"next": 20.0, "on": 0.0, "dx": 1.0, "dz": 0.0}
static var arrival := Vector3(Phys.X3 + 89, 0, 0)
static var keeper: Avatar = null
static var shopPos = null
static var playerPlot: BaseVis = null
static var belt_mat: StandardMaterial3D = null
static var PORTAL3 := Vector3(Phys.X2 - 55, 0, 7.5)
static var PORTAL4 := Vector3(Phys.X3 + 95, 0, 0)
static var BASES := [[Phys.X3 - 55, 40.0], [Phys.X3, 40.0], [Phys.X3 + 55, 40.0], [Phys.X3 - 30, -40.0], [Phys.X3 + 30, -40.0]]
static var storm := {"t": 12.0, "strikes": []}

static func walkable(x: float, z: float, m: float = 0.0) -> bool:
	for r in walk:
		if x > r[0] + m and x < r[2] - m and z > r[1] + m and z < r[3] - m:
			return true
	return false

static func build_island(x0: float, z0: float, x1: float, z1: float, depth: float, tint: String) -> void:
	var w := x1 - x0; var d := z1 - z0; var cx := (x0 + x1) / 2; var cz := (z0 + z1) / 2
	Geo.mesh(Geo.G("box"), Geo.mat(tint, {"map": Tex.get_tex("grass"), "rep": Vector2(w / 4, d / 4), "r": 0.95}), cx, -0.6, cz, w, 1.2, d, World)
	var under := Geo.mesh(Geo.G("pyrSq"), Geo.mat("#8a6a50", {"r": 0.95, "flat": true}), cx, -1.2 - depth / 2, cz, w * 0.94, depth, d * 0.94, World); Geo.rot(under, PI)
	Phys.add_box(x0, -3, z0, x1, 0, z1, {"tag": "isl", "cam": false})
	walk.append([x0, z0, x1, z1])
	if randf() < 0.6:
		var ex := U.rnd(x0 + 2, x1 - 2); var ez := z0 if randf() < 0.5 else z1
		anim.append(func(dt: float, _t: float) -> void:
			if Game.player != null and Phys.in_w3(Game.player.body.pos.x) and randf() < dt * 20:
				FX.one(ex + U.rnd(-0.6, 0.6), -0.2, ez, {"vx": 0, "vy": -2, "vz": (-1.0 if ez == z0 else 1.0) * 0.8, "life": 2, "size": 0.5, "color": U.pick(["#bfe6ff", "#ffffff"]), "grav": -6, "drag": 0.1}))

static func build_bridge(x0: float, z0: float, x1: float, z1: float) -> void:
	var w := x1 - x0; var d := z1 - z0; var along := d > w; var b := Geo.Batcher.new(); var wood := Geo.mat("#ffffff", {"map": Tex.get_tex("wood"), "r": 0.8})
	var n := int(roundf((d if along else w) / 0.6))
	for i in n:
		var t := (i + 0.5) / n
		if along:
			b.add(Geo.G("box"), wood, (x0 + x1) / 2, -0.12, z0 + d * t, w, 0.22, 0.52)
		else:
			b.add(Geo.G("box"), wood, x0 + w * t, -0.12, (z0 + z1) / 2, 0.52, 0.22, d)
	b.build(World); Phys.add_box(x0, -0.3, z0, x1, 0, z1, {"tag": "bridge", "cam": false}); walk.append([x0, z0, x1, z1])

static func build() -> void:
	if built:
		return
	built = true
	var X3 := Phys.X3
	var tints := ["#bff0c0", "#ffe0f0", "#d8f0ff", "#fff2c0", "#e0d8ff", "#c8ffe8"]
	build_island(X3 - 76, -12, X3 + 76, 12, 22, "#d8ffd8")
	for i in BASES.size():
		var cx: float = BASES[i][0]; var cz: float = BASES[i][1]
		build_island(cx - 15, 27 if cz > 0 else -63, cx + 15, 63 if cz > 0 else -27, 18, tints[i])
	build_island(X3 - 104, -10, X3 - 84, 10, 12, "#fff2c0"); build_island(X3 + 84, -10, X3 + 104, 10, 12, "#e0d8ff")
	for bc in BASES:
		var cx: float = bc[0]; var cz: float = bc[1]
		build_bridge(cx - 1.6, 12 if cz > 0 else -27, cx + 1.6, 27 if cz > 0 else -12)
	build_bridge(X3 - 84, -1.8, X3 - 76, 1.8); build_bridge(X3 + 76, -1.8, X3 + 84, 1.8)
	World.ground_quad(X3 - 74, -11, X3 + 74, 11, World.flat_mat(Tex.get_tex("tiles"), "#fff8f0", Vector2(37, 6)), 0.012)
	var sea := Geo.mesh(Geo.plane_g(900, 600), Geo.basic_mat("#ffffff"), X3, -55, 0, 1, 1, 1, World, false); Geo.rot(sea, -PI / 2)
	var puff := Geo.Batcher.new(); var puffM := Geo.mat("#ffffff", {"r": 1.0, "e": "#e8f4ff", "ei": 0.45, "flat": true})
	for i in 160:
		var r := U.rnd(4, 11)
		var px := X3 + U.rnd(-170, 170); var py := U.rnd(-45, -8); var pz := U.rnd(-130, 130)
		if walkable(px, pz, -10) and py > -25:
			py -= 20
		puff.add(Geo.G("ico"), puffM, px, py, pz, r * 1.4, r * 0.7, r)
	puff.build(World, false)
	var BT = Game.BELTS[2]
	belt_mat = World.build_belt_geometry(BT, "#e8f4ff", "belt", "#b8d8ff", Geo.mat("#ffffff", {"e": "#9fe8ff", "ei": 1.2}), false, World)
	var rift := W2.make_portal(Vector3(BT.x0 - 2.4, 0, 0), ["#9fe8ff", "#ffffff"], "☁️ دروازه‌ی ابرها", "swirl6"); rift.g.scale = Vector3(0.85, 0.85, 0.85)
	for s in [-1, 1]:
		Phys.add_box_c(BT.x0 - 2.4, 3.2, s * 3.3, 1, 6.4, 1)
	anim.append(func(dt: float, t: float) -> void: W2.anim_portal(rift, dt, t))
	Geo.mesh(Geo.G("sphere"), Geo.mat("#ffffff", {"r": 1.0, "e": "#e8f4ff", "ei": 0.4}), BT.x1 + 3.5, 2.2, 0, 3, 2.4, 3.4, World); Phys.add_circle(BT.x1 + 3.5, 0, 3, 0, 4.5)
	var rb := Node3D.new(); rb.position = Vector3(X3, 0, 0); World.add_child(rb)
	var rcols := ["#ff4f8b", "#ffa31a", "#ffd23f", "#3df2b0", "#58c4ff", "#b061ff"]
	for i in 6:
		Geo.mesh(Geo.torus(26 - i * 0.9, 0.45, 8, 48, PI), Geo.basic_mat(rcols[i], 0.55, {"nofog": true}), 0, -2, -14, 1, 1, 1, rb, false)
	var balloons := []
	for i in 6:
		var g := Node3D.new(); g.position = Vector3(X3 + U.rnd(-90, 90), U.rnd(14, 26), U.rnd(-50, 50)); World.add_child(g)
		Geo.mesh(Geo.G("sphere"), Geo.mat(U.pick(["#ff4f8b", "#ffd23f", "#58c4ff", "#3df2b0"]), {"r": 0.5}), 0, 0, 0, 2.4, 2.9, 2.4, g)
		Geo.mesh(Geo.G("box"), Geo.mat("#ffffff", {"map": Tex.get_tex("wood")}), 0, -3.6, 0, 1.2, 0.8, 1.2, g)
		balloons.append(g)
	anim.append(func(dt: float, t: float) -> void:
		for i in balloons.size():
			var g: Node3D = balloons[i]
			g.position.y += sin(t * 0.5 + i) * dt * 0.5; g.position.x += dt * 0.6
			if g.position.x > X3 + 120:
				g.position.x = X3 - 120)
	var welcome := Sign.make([{"t": "🏝️ جزیره‌های آسمانی", "size": 72, "color": "#0d3b66", "weight": 900}, {"t": "از لبه‌ها نیفت · باد و صاعقه · پل‌ها نرده ندارند", "size": 32, "color": "#1b1446", "weight": 800}], {"w": 768, "h": 220, "bg": "rgba(255,255,255,.92)", "border": "#29b6ff"}, 11, 3.15)
	welcome.position = Vector3(X3, 9, 0); World.add_child(welcome)
	# sky station
	var SX := X3 - 94
	var g := Node3D.new(); g.position = Vector3(SX, 0, 0); World.add_child(g)
	var wall := Geo.mat("#ffffff", {"r": 0.6}); var trim := Geo.mat("#29b6ff", {"e": "#29b6ff", "ei": 0.3}); var sb := Geo.Batcher.new()
	sb.add(Geo.G("box"), wall, -5.5, 2.4, 0, 0.4, 4.8, 12); sb.add(Geo.G("box"), wall, 0, 2.4, -6, 11, 4.8, 0.4); sb.add(Geo.G("box"), wall, 0, 2.4, 6, 11, 4.8, 0.4)
	sb.add(Geo.rbox(11.6, 0.4, 12.8, 0.15), trim, 0, 5, 0); sb.add(Geo.rbox(1.3, 1.1, 7, 0.1), Geo.mat("#ffca28", {"r": 0.5}), 3, 0.55, 0)
	sb.build(g)
	Phys.add_box(SX - 5.7, 0, -6.2, SX - 5.3, 4.8, 6.2); Phys.add_box(SX - 5.5, 0, -6.2, SX + 5.5, 4.8, -5.8); Phys.add_box(SX - 5.5, 0, 5.8, SX + 5.5, 4.8, 6.2); Phys.add_box(SX + 2.35, 0, -3.5, SX + 3.65, 1.1, 3.5)
	var hot := Node3D.new(); hot.position = Vector3(SX, 11, 0); World.add_child(hot)
	Geo.mesh(Geo.G("sphere"), Geo.mat("#ff4f8b", {"r": 0.5}), 0, 0, 0, 3, 3.6, 3, hot)
	var ht := Geo.mesh(Geo.G("torus"), Geo.mat("#ffd23f"), 0, -1.2, 0, 2.8, 2.8, 2.8, hot); Geo.rot(ht, PI / 2)
	anim.append(func(_dt: float, t: float) -> void: hot.position.y = 11 + sin(t) * 0.4)
	var sign := Sign.make([{"t": "🎈 ایستگاه هوایی", "size": 74, "color": "#0d3b66", "weight": 900}, {"t": "وسایل مخصوص جزیره‌ها", "size": 34, "color": "#1b1446", "weight": 800}], {"w": 640, "h": 200, "bg": "rgba(255,255,255,.95)", "border": "#29b6ff"}, 8, 2.5); sign.position = Vector3(SX + 2, 7, 0); World.add_child(sign)
	keeper = Avatar.build(Data.W3_KEEPER_LOOK)
	keeper.root.position = Vector3(SX + 1.2, 0.1, 0); keeper.root.rotation.y = PI / 2; Game.agents_node.add_child(keeper.root)
	shopPos = Vector3(SX + 6.5, 0, 0)
	var first := World.bases.size()
	for bc in BASES:
		var bv := BaseVis.new(World.bases.size(), bc[0], bc[1]); World.bases.append(bv); World.add_child(bv.node)
	playerPlot = World.bases[first + 1]; playerPlot.build("#a0c4ff", "پایگاه تو · منتظر توست", true)
	var k := 0
	for bi in [first, first + 2, first + 3, first + 4]:
		var o := Owner.new(Game.owners.size(), Data.W3_NAMES[k], Data.W3_COLORS[k], false, World.bases[bi]); o.hard = true; Game.owners.append(o); o.base.build(o.color, o.name, false)
		var a := Agent.new(o, Data.W3_LOOKS[k], false); a.brain.aggr = U.rnd(2.2, 2.8); a.brain.stealCd = U.rnd(8, 18)
		Agent.new(o, Data.SKY_GUARD_LOOK, false, {"guard": o.base}); o.apply_cap(); o.elite3 = true
		k += 1
	for bc in BASES:
		var cx: float = bc[0]; var s := signf(bc[1])
		World.make_pad(cx + 7, s * 9.5, [0.0, s], "#9fe8ff", [19.0, 15.0]); World.make_pad(cx - 7, s * 28.3, [0.0, -s], "#9fe8ff", [19.0, 15.0])
	Portal3.p4 = W2.make_portal(PORTAL4, ["#29d9ff", "#3df2b0"], "🌍 برگشت به میدان میم‌ها", "swirl3")
	for s in [-1, 1]:
		Phys.add_box_c(PORTAL4.x, 3.8, s * 3.9, 1.1, 7.6, 1.1)
	Nav.build(3, func(x: float, z: float) -> bool: return not walkable(x, z, 0.75))
	BT.active = true
	Game.prefill_belt(BT, 520, 2.4, 3.4)
	UI.map_dirty()

static func seed_owner(o: Owner) -> void:
	o.hard = true; o.money = U.rndi(1, 4) * 1e12; o.up.cap = U.rndi(2, 4); o.up.secDur = 3; o.up.trap = U.rndi(1, 3); o.up.speed = 3
	var n := U.rndi(4, mini(o.cap, 7))
	for i in n:
		var x := randf() * 100; var r := 4
		for k in range(4, 8):
			x -= Data.W3_WEIGHTS[k]
			if x <= 0:
				r = k
				break
		var u := Unit.new(Data.pick_char(3, r), 7 if randf() < 0.1 else 6)
		u.owner = o; u.slot = o.slots[i]; o.slots[i].unit = u; u.state = "slotted"; u.place_at_slot(); u.set_plate("base")
	o.apply_cap()

static func arrive() -> void:
	var o := Game.player.owner
	if playerPlot != null and playerPlot.owner == null:
		Game.claim_plot(o, playerPlot, true); UI.banner("🏝️ به جزیره‌های آسمانی خوش آمدی!", "یک جزیره‌ی رایگان گرفتی · مواظب لبه‌ها، باد و پل‌های بی‌نرده باش"); Sound.play("success"); Game.schedule_save(true)
	else:
		UI.toast("🏝️ جزیره‌های آسمانی — میم‌های اینجا ۲۰۰۰ برابر می‌ارزند", "rare")

static func update(dt: float, t: float) -> void:
	for f in anim:
		f.call(dt, t)
	if belt_mat:
		belt_mat.uv1_offset.x -= Game.belt_speed(Game.BELTS[2]) * dt / 2.0
	update_wind(dt)

static func update_wind(dt: float) -> void:
	var w := wind; var pl := Game.player
	if pl == null or not Game.playing:
		return
	var here := Phys.in_w3(pl.body.pos.x)
	if w.on > 0:
		w.on -= dt
		for a in Game.agents:
			var p := a.body.pos
			if not Phys.in_w3(p.x) or a.isGuard:
				continue
			if a.isPlayer and a.owner.up.anchor > 0:
				continue
			var sheltered := false
			for b in World.bases:
				if b.world == 3 and b.contains(p.x, p.z, 0.5):
					sheltered = true
			if sheltered:
				continue
			a.body.pos.x += w.dx * 4.6 * dt; a.body.pos.z += w.dz * 4.6 * dt
		if here and randf() < dt * 60:
			var p := pl.body.pos
			FX.one(p.x - w.dx * 12 + U.rnd(-10, 10), p.y + U.rnd(0.5, 4), p.z - w.dz * 12 + U.rnd(-10, 10), {"vx": w.dx * 18, "vy": 0, "vz": w.dz * 18, "life": 1, "size": 0.25, "color": "#ffffff", "grav": 0, "drag": 0})
	elif here:
		w.next -= dt
		if w.next <= 0:
			var a := randf() * TAU
			w.dx = cos(a); w.dz = sin(a); w.on = 5; w.next = U.rnd(9, 17); Sound.play("whoosh")
			UI.toast("🌬️ باد شدید! (چکمه‌ی لنگر نگهت داشته)" if pl.owner.up.anchor > 0 else "🌬️ باد شدید! از لبه‌ها دور شو", "bad")

static func update_lightning(dt: float) -> void:
	var pl := Game.player
	if pl == null or not built:
		return
	var here := Phys.in_w3(pl.body.pos.x) and Game.playing
	if here:
		storm.t -= dt
		if storm.t <= 0:
			storm.t = U.rnd(3.5, 7)
			var p := pl.body.pos; var aim := randf() < 0.45
			var x := p.x + (U.rnd(-1.5, 1.5) if aim else U.rnd(-14, 14)); var z := p.z + (U.rnd(-1.5, 1.5) if aim else U.rnd(-14, 14))
			if walkable(x, z):
				var ring := Geo.mesh(Geo.G("ring08"), Geo.basic_mat("#ffe14a", 0.9, {"side": true}).duplicate(), x, 0.06, z, 2.8, 2.8, 2.8, World, false); Geo.rot(ring, -PI / 2)
				storm.strikes.append({"x": x, "z": z, "t": 1.4, "ring": ring})
	for i in range(storm.strikes.size() - 1, -1, -1):
		var s: Dictionary = storm.strikes[i]
		s.t -= dt
		s.ring.material_override.albedo_color.a = 0.4 + 0.5 * absf(sin(s.t * 14))
		var sc: float = 2.8 * (0.6 + 0.4 * s.t / 1.4)
		s.ring.basis = Geo.basis_xyz(-PI / 2, 0, 0) * Basis.from_scale(Vector3(sc, sc, sc))
		if s.t > 0:
			continue
		s.ring.queue_free(); storm.strikes.remove_at(i)
		var bolt := Geo.mesh(Geo.G("cyl"), Geo.add_mat("#fff7c0", 1.0), s.x, 20, s.z, 0.35, 40, 0.35, World, false)
		World.get_tree().create_timer(0.14).timeout.connect(func(): bolt.queue_free())
		FX.burst(Vector3(s.x, 0.5, s.z), {"count": 40, "color": ["#fff7c0", "#ffe14a", "#9fe8ff"], "speed": 8, "life": 0.7, "up": true}); Sound.play("boom")
		if U.dist2(pl.body.pos, Vector3(s.x, 0, s.z)) < 900:
			Game.CAM.shake = maxf(Game.CAM.shake, 0.35); UI.flash()
		for a in Game.agents:
			if a.isGuard or a.stunned or not Phys.in_w3(a.body.pos.x):
				continue
			var p := a.body.pos; var dx: float = p.x - s.x; var dz: float = p.z - s.z
			if dx * dx + dz * dz > 2.7 * 2.7:
				continue
			if a.isPlayer and a.owner.up.lightRod > 0:
				UI.toast("🔱 برق‌گیر صاعقه را خنثی کرد!", "good")
				continue
			EXW.knock(a, dx if dx != 0 else 1.0, dz, 7, 1.6, "⚡ صاعقه خوردی!")
