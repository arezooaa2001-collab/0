## Extras: treasure chests, jump pads, hoverboard, pets, meme levels, the Thief King boss, achievements, UFO raid, fireworks.
class_name Extras

static var chests: Array = []
static var chestT := 25.0
static var padsW2 := false
static var padCd := 0.0
static var boss = null
static var bossT := 300.0
static var pets: Array = []
static var board: Node3D = null
static var riding := false
static var achT := 0.0
static var CHEST_MATS: Dictionary = {}
static var ufo: Dictionary = {"g": null, "beam": null, "t": 0.0, "dropT": 2.0, "x": 0.0, "leaving": 0.0}
static var fireworks: Dictionary = {"t": 2.0, "rockets": []}

# ---------------------------------------------------------------- meme levels
static func level_cost(u: Unit) -> float:
	return roundf(u.c.price * Data.MUTATIONS[u.mut].mult * 0.5 * (u.lvl + 1))

static func level_unit(o: Owner, slot: Dictionary) -> bool:
	var u: Unit = slot.unit
	if u == null or u.state != "slotted" or u.lvl >= 5:
		return false
	var cost := level_cost(u)
	if o.money < cost:
		Sound.play("error"); UI.toast("💸 برای ارتقای این میم " + U.fmt(cost) + " سکه لازم است", "bad")
		return false
	o.money -= cost; u.lvl += 1; u.recalc(); u.set_plate("base"); Game.stats.levels += 1
	FX.burst(Vector3(u.pos.x, u.pos.y + u.H, u.pos.z), {"count": 30, "color": ["#ffd23f", "#ffffff", "#3df2b0"], "speed": 4, "up": true, "life": 0.9})
	Sound.play("upgrade"); UI.toast("⭐ «" + u.c.name + "» سطح " + U.fa(u.lvl) + " شد! درآمد: " + U.fmt_inc(u.income * o.income_mult()), "good"); Game.schedule_save()
	return true

# ---------------------------------------------------------------- chests
static func chest_spot(w: int):
	for k in 60:
		var x: float; var z: float
		if w == 3:
			var isl = U.pick(W3.walk.slice(0, 6))
			x = U.rnd(isl[0] + 2, isl[2] - 2); z = U.rnd(isl[1] + 2, isl[3] - 2)
			if absf(z) < 3:
				continue
		elif w >= 4:
			var XW: float = EXW.D[w].X
			x = XW + U.rnd(-80, 80); z = (U.rnd(4, 24) if randf() < 0.7 else U.rnd(50, 60)) * (-1 if randf() < 0.5 else 1)
		elif w == 2:
			x = Phys.X2 + U.rnd(-100, 100); z = (U.rnd(4, 11) if randf() < 0.6 else U.rnd(25, 60)) * (-1 if randf() < 0.5 else 1)
		else:
			x = U.rnd(-145, 145)
			var r := randf()
			var sgn := -1.0 if randf() < 0.5 else 1.0
			z = U.rnd(4, 16) * sgn if r < 0.5 else ((World.LAYOUT.ringZ + U.rnd(-2, 2)) * sgn if r < 0.8 else U.rnd(20, 48) * sgn)
		var inside := false
		for b in World.bases:
			if b.contains(x, z, 2):
				inside = true
		if inside:
			continue
		if w == 2 and W2.in_lava(x, z):
			continue
		Nav.pick(x)
		if not Nav.open(x, z):
			continue
		var near := false
		for c in chests:
			if U.dist2(c.pos, Vector3(x, 0, z)) < 100:
				near = true
		if near:
			continue
		return Vector2(x, z)
	return null

static func spawn_chest(w: int, at, golden: bool):
	var sp = at if at != null else chest_spot(w)
	if sp == null:
		return null
	if CHEST_MATS.is_empty():
		CHEST_MATS = {"wood": Geo.mat("#b07a4e", {"map": Tex.get_tex("wood"), "r": 0.7}), "gold": Geo.mat("#ffd23f", {"m": 1, "r": 0.25}), "glow": Geo.mat("#fff3a0", {"e": "#ffd23f", "ei": 2})}
	var g := Node3D.new(); g.position = Vector3(sp.x, Phys.floor_at(sp.x, sp.y, 0.5, 2)[0], sp.y); World.add_child(g)
	var s := 1.6 if golden else 1.0
	Geo.mesh(Geo.rbox(1.2 * s, 0.7 * s, 0.85 * s, 0.06), CHEST_MATS.gold if golden else CHEST_MATS.wood, 0, 0.35 * s, 0, 1, 1, 1, g)
	for x in [-0.42, 0.42]:
		Geo.mesh(Geo.G("box"), CHEST_MATS.gold, x * s, 0.36 * s, 0, 0.1 * s, 0.74 * s, 0.9 * s, g)
	var lid := Node3D.new(); lid.position = Vector3(0, 0.7 * s, -0.42 * s); g.add_child(lid)
	var cy := Geo.mesh(Geo.G("cyl"), CHEST_MATS.gold if golden else CHEST_MATS.wood, 0, 0, 0.42 * s, 0.42 * s, 1.2 * s, 0.42 * s, lid); Geo.rot(cy, 0, 0, PI / 2)
	Geo.mesh(Geo.G("box"), CHEST_MATS.glow, 0, 0.05 * s, 0.86 * s, 0.22 * s, 0.22 * s, 0.06, lid)
	var pm := StandardMaterial3D.new(); pm.albedo_texture = Tex.get_tex("pillar"); pm.albedo_color = Color(1, 0.85, 0.29, 0.32); pm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; pm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; pm.blend_mode = BaseMaterial3D.BLEND_MODE_ADD; pm.cull_mode = BaseMaterial3D.CULL_DISABLED; pm.disable_fog = true
	Geo.mesh(Geo.G("pillar"), pm, 0, 6, 0, 0.9, 1, 0.9, g, false)
	var c := {"g": g, "lid": lid, "pos": g.position, "w": w, "t": 120.0 if golden else 90.0, "opening": -1.0, "golden": golden}
	chests.append(c)
	return c

static func chest_reward(c: Dictionary) -> void:
	var o := Game.player.owner; var inc := o.income_per_sec(); var w2: bool = c.w == 2; var w3: bool = c.w == 3; var mult := 6.0 if c.golden else 1.0
	Game.stats.chests += 1
	var r := randf()
	if c.golden or r < 0.25:
		var slot = o.free_slot(null, c.w)
		var rr: int
		if c.w >= 4:
			rr = 7 if c.golden else U.pick([5, 5, 6])
		elif w3:
			rr = 6 if c.golden else U.pick([4, 4, 5])
		elif w2:
			rr = 5 if c.golden else U.pick([3, 3, 4])
		else:
			rr = U.pick([4, 5]) if c.golden else U.pick([1, 2, 2, 3])
		var u := Unit.new(Data.pick_char(c.w, rr), Data.WORLD_MUTS[c.w][0] if c.w > 1 else 0)
		if slot != null:
			u.owner = o; u.slot = slot; slot.unit = u; slot.pending = 0.0; u.state = "transit"; u.pos = Vector3(c.pos.x, c.pos.y, c.pos.z); u.set_plate("base"); Game.set_transit(u, slot.base.slotPos[slot.li])
			Game.discover(u.c.id); UI.toast("🎁 از صندوق یک میم بیرون پرید: " + ((Data.MUTATIONS[u.mut].name + " · ") if Data.MUTATIONS[u.mut].name != "" else "") + u.c.name + "! دارد به پایگاهت می‌رود", "rare")
			if not c.golden:
				return
		else:
			o.money += u.price; UI.toast("🎁 جای خالی نبود؛ ارزش میم (" + U.fmt(u.price) + ") به پولت اضافه شد", "good"); u.dispose(false)
			if not c.golden:
				return
	if not c.golden and r > 0.85:
		Game.boostT = 60; Sound.play("event"); UI.toast("⚡ بوست! ۶۰ ثانیه درآمدت ۲ برابر شد", "rare")
		return
	var base_coins: float = 5e14 if c.w == 5 else (5e12 if c.w == 4 else (5e9 if w3 else (5e6 if w2 else 300.0)))
	var coins := roundf(maxf(base_coins, inc * U.rnd(40, 120)) * mult)
	o.money += coins; UI.float_text(c.pos, "+" + U.fmt(coins), "#ffd23f"); UI.toast("🎁 صندوق گنج: " + U.fmt(coins) + " سکه!", "good")

static func update_chests(dt: float) -> void:
	var pl := Game.player
	if pl == null:
		return
	var w := Phys.world_of(pl.body.pos.x)
	if Game.playing:
		chestT -= dt
		if chestT <= 0:
			chestT = U.rnd(40, 70)
			var n := 0
			for c in chests:
				if c.w == w and c.opening < 0:
					n += 1
			if n < 3 and (w != 2 or W2.built) and (w != 3 or W3.built):
				if spawn_chest(w, null, false) != null:
					UI.toast("🎁 یک صندوق گنج در نقشه ظاهر شد! (نقطه‌ی طلایی روی نقشه)", "rare"); Sound.play("rare")
	for i in range(chests.size() - 1, -1, -1):
		var c: Dictionary = chests[i]
		if c.opening < 0:
			c.g.rotation.y += dt * 0.6
			c.t -= dt; c.lid.rotation.x = sin(Game.time * 6) * 0.04
			if randf() < dt * 6:
				FX.one(c.pos.x + U.rnd(-0.6, 0.6), c.pos.y + U.rnd(0.4, 1.4), c.pos.z + U.rnd(-0.6, 0.6), {"vx": 0, "vy": 1, "vz": 0, "life": 1, "size": 0.25, "color": "#ffd23f", "grav": 0, "drag": 0.5})
			var rr := 2.6 if c.golden else 1.8
			if Game.playing and U.dist2(pl.body.pos, c.pos) < rr * rr and absf(pl.body.pos.y - c.pos.y) < 2:
				c.opening = 0.0; Sound.play("success")
				FX.burst(Vector3(c.pos.x, c.pos.y + 1, c.pos.z), {"count": 80 if c.golden else 40, "color": ["#ffd23f", "#fff3a0", "#ffffff"], "speed": 7, "up": true, "life": 1.2, "grav": -9})
				chest_reward(c)
			elif c.t <= 0:
				c.g.queue_free(); chests.remove_at(i)
		else:
			c.opening += dt; c.lid.rotation.x = -minf(1.9, c.opening * 4)
			if c.opening > 1.6:
				c.g.queue_free(); chests.remove_at(i)

# ---------------------------------------------------------------- jump pads
static func build_pads_w2() -> void:
	if padsW2 or not W2.built:
		return
	padsW2 = true
	for x in [Phys.X2 - 35, Phys.X2 + 35]:
		for s in [-1.0, 1.0]:
			World.make_pad(x, s * 9, [0.0, s], "#ff5a1f"); World.make_pad(x, s * 27, [0.0, -s], "#ff5a1f")

static func update_pads(dt: float) -> void:
	if W2.built and not padsW2:
		build_pads_w2()
	padCd -= dt
	var a := Game.player
	if a == null:
		return
	for p in World.pads:
		p.ar.position.y = (0.6 if p.dir != null else 1.2) + sin(Game.time * 4) * 0.15
		p.top.scale.y = 0.06 * (1 + sin(Game.time * 6) * 0.3)
		if padCd > 0 or not Game.playing:
			continue
		var b := a.body
		if b.pos.y > 0.7 or (b.pos.x - p.x) * (b.pos.x - p.x) + (b.pos.z - p.z) * (b.pos.z - p.z) > 1.25 * 1.25 or b.vel.y > 1:
			continue
		padCd = 0.6
		var w2 := Phys.in_w2(p.x)
		if p.dir != null:
			var pw = p.power if p.power != null else [11.0, 13.0]
			b.vel = Vector3(p.dir[0] * pw[0], pw[1], p.dir[1] * pw[0]); a.fling = 1.5
		else:
			var hs := Vector2(b.vel.x, b.vel.z).length()
			b.vel = Vector3(b.vel.x * 1.4, 17, b.vel.z * 1.4)
			if hs > 1:
				a.fling = 0.6
		b.grounded = false; a.coyote = 0; a.jumpHeld = true
		Sound.play("djump"); FX.burst(Vector3(p.x, 0.4, p.z), {"count": 24, "color": ["#ff5a1f", "#ffd23f"] if w2 else ["#3df2b0", "#ffffff"], "speed": 5, "up": true, "life": 0.6})

# ---------------------------------------------------------------- hoverboard
static func toggle_board() -> void:
	var a := Game.player; var o := a.owner
	if o.up.board == 0:
		Sound.play("error"); UI.toast("🛹 اسکیت‌برد پرنده را از فروشگاه دنیای اول بخر", "bad")
		return
	if a.carrying != null:
		UI.toast("🛹 با میم دزدی نمی‌شود سوار اسکیت‌برد شد", "bad")
		return
	riding = not riding; Sound.play("djump" if riding else "click")
	UI.toast("🛹 سوار شدی! ۷۵٪ تندتر" if riding else "🛹 پیاده شدی", "")

static func update_board(dt: float) -> void:
	var a := Game.player
	if a == null:
		return
	if riding and (a.owner.up.board == 0 or a.carrying != null or not Game.playing):
		riding = false
	if board == null:
		var g := Node3D.new()
		Geo.mesh(Geo.rbox(0.62, 0.09, 1.5, 0.04), Geo.mat("#1b1446", {"m": 0.6, "r": 0.3}), 0, 0, 0, 1, 1, 1, g)
		Geo.mesh(Geo.G("box"), Geo.mat("#58c4ff", {"e": "#29d9ff", "ei": 2}), 0, -0.06, 0, 0.5, 0.03, 1.3, g)
		for z in [-0.5, 0.5]:
			Geo.mesh(Geo.G("cyl"), Geo.mat("#ff4f8b", {"e": "#ff2af0", "ei": 1.5}), 0, -0.09, z, 0.12, 0.05, 0.12, g)
		g.position.y = 0.06; g.visible = false; a.av.root.add_child(g); board = g
	board.visible = riding
	if riding:
		board.rotation.z = sin(Game.time * 3) * 0.04
		if randf() < dt * 30:
			var p := a.body.pos
			FX.one(p.x - sin(a.yaw) * 0.7, p.y + 0.15, p.z - cos(a.yaw) * 0.7, {"vx": U.rnd(-0.3, 0.3), "vy": -0.2, "vz": U.rnd(-0.3, 0.3), "life": 0.5, "size": 0.25, "color": U.pick(["#58c4ff", "#ff4fd8"]), "grav": 0, "drag": 1})

# ---------------------------------------------------------------- pets
const PET_DEFS := [["petCat", "cat"], ["petBird", "chick"], ["petDrag", "dragon"]]
class Pet:
	var key := ""
	var vis: Dictionary
	var spec: Dictionary
	var root: Node3D
	var ph := 0.0
	var seed := 0.0
	var yaw := 0.0
	var pos: Vector3:
		get: return root.position
		set(v): root.position = v

static func update_pets(dt: float) -> void:
	var a := Game.player
	if a == null:
		return
	var o := a.owner
	for pd in PET_DEFS:
		var key: String = pd[0]; var cid: String = pd[1]
		var pet: Pet = null
		for p in pets:
			if p.key == key:
				pet = p
		if o.up[key] > 0 and pet == null:
			var vis := Chars.obtain_visual(cid, 0)
			var root := Node3D.new(); root.add_child(vis.root); vis.root.scale = Vector3(0.38, 0.38, 0.38); World.add_child(root)
			vis.root.position = Vector3.ZERO; root.position = a.body.pos
			pet = Pet.new(); pet.key = key; pet.vis = vis; pet.spec = vis.spec; pet.root = root; pet.seed = randf() * 10
			pets.append(pet)
			FX.burst(Vector3(a.body.pos.x, a.body.pos.y + 1.5, a.body.pos.z), {"count": 20, "color": ["#ff6fcf", "#ffffff"], "speed": 3, "life": 0.6})
		elif o.up[key] == 0 and pet != null:
			pet.root.remove_child(pet.vis.root); Chars.release_visual(pet.vis); pet.root.queue_free(); pets.erase(pet)
	for i in pets.size():
		var pet: Pet = pets[i]
		var side := (i - (pets.size() - 1) / 2.0) * 1.1; var b := a.body.pos; var fy := a.yaw
		var tx := b.x - sin(fy) * 1.6 + cos(fy) * side; var tz := b.z - cos(fy) * 1.6 - sin(fy) * side; var ty := a.renderY + 1.2 + sin(Game.time * 3 + i) * 0.15
		if (pet.pos.x - tx) * (pet.pos.x - tx) + (pet.pos.z - tz) * (pet.pos.z - tz) > 900:
			pet.pos = Vector3(tx, ty, tz)
		var ox := pet.pos.x; var oz := pet.pos.z
		pet.pos = Vector3(U.damp(pet.pos.x, tx, 6, dt), U.damp(pet.pos.y, ty, 6, dt), U.damp(pet.pos.z, tz, 6, dt))
		var mv := Vector2(pet.pos.x - ox, pet.pos.z - oz).length() / maxf(dt, 1e-3)
		if mv > 0.5:
			pet.yaw = atan2(pet.pos.x - ox, pet.pos.z - oz)
		pet.root.rotation.y = U.damp(pet.root.rotation.y, pet.yaw, 8, dt)
		pet.root.visible = not S.firstPerson or i > 0
		Chars.animate_unit(pet, dt, Game.time, mv > 0.8)

# ---------------------------------------------------------------- the Thief King
class Boss:
	var w := 1
	var av: Avatar
	var body: Phys.Body
	var hp := 14
	var maxHp := 14
	var life := 130.0
	var stompCd := 4.0
	var stun := 0.0
	var path: Array = []
	var pi := 0
	var target: BaseVis = null
	var drainT := 0.0
	var yaw := 0.0
	var retarget := 0.0
	var label: Sign
	func _init(w_: int) -> void:
		w = w_
		var B = Game.belt_of_world(w)
		var sp := Vector2(B.x0 + 4, 7)
		av = Avatar.build(Data.BOSS_LOOK)
		av.root.scale = Vector3(2.3, 2.3, 2.3); Game.agents_node.add_child(av.root)
		Geo.mesh(Geo.cyl(0.5, 0.75, 1.2, 14, true, PI * 0.65, PI * 0.7), Geo.mat("#c0143c", {"r": 0.6, "side": true}), 0, 1.15, -0.05, 1, 1, 1, av.body)
		body = Phys.Body.new(sp.x, 0.1, sp.y, 1.0, 3.8)
		label = Sign.new(); label.setup(4.2 / 2.3, 1.3 / 2.3, 512, 160, "rgba(40,0,20,.9)", "#ff2a3a", true); label.position.y = 2.75; av.root.add_child(label)
		draw_label()
	func draw_label() -> void:
		var n := maxi(0, hp); var bar := ""
		for i in n:
			bar += "▮"
		for i in maxHp - n:
			bar += "▯"
		label.set_lines("hp" + str(n), [{"t": "👹 رئیس دزدها", "size": 52, "color": "#ffd23f", "weight": 900, "stroke": 5}, {"t": bar, "size": 40, "color": "#ff4a4a", "weight": 900}])
	func pick_target() -> void:
		var bases := []; var mine := []
		for b in World.bases:
			if b.owner != null and b.world == w:
				bases.append(b)
				if b.owner.isPlayer:
					mine.append(b)
		if bases.is_empty():
			return
		var b: BaseVis = U.pick(mine) if (mine.size() > 0 and randf() < 0.45) else U.pick(bases)
		target = b; path = Nav.find_path(body.pos.x, body.pos.z, b.insidePos.x, b.insidePos.z); pi = 0
	func hit(dmg: int) -> void:
		hp -= dmg; stun = maxf(stun, 0.5); draw_label(); Game.CAM.shake = 0.15
		FX.burst(Vector3(body.pos.x, body.pos.y + 3.5, body.pos.z), {"count": 30, "color": ["#ffd23f", "#ff4a4a", "#ffffff"], "speed": 6, "life": 0.6})
		if hp <= 0:
			defeat()
		else:
			UI.toast("👹 رئیس دزدها: " + U.fa(hp) + " جان مانده!", "")
	func defeat() -> void:
		Game.stats.bossKills += 1; Sound.play("rebirth"); UI.banner("👑 رئیس دزدها شکست خورد!", "صندوق طلایی‌اش را باز کن")
		var p := body.pos
		Extras.spawn_chest(w, Vector2(p.x, p.z), true)
		FX.burst(Vector3(p.x, p.y + 2, p.z), {"count": 90, "color": ["#ffd23f", "#ff2a3a", "#ffffff", "#b061ff"], "speed": 10, "up": true, "life": 1.4})
		remove()
	func remove() -> void:
		av.root.queue_free(); Extras.boss = null
	func stomp() -> void:
		stompCd = 5.5
		var p := body.pos
		Sound.play("boom"); Game.CAM.shake = 0.3
		FX.burst(Vector3(p.x, 0.4, p.z), {"count": 60, "color": ["#b061ff", "#ff2a3a", "#3a2028"], "speed": 10, "life": 0.8, "grav": -6})
		for a in Game.agents:
			if U.dist2(a.body.pos, p) > 6.5 * 6.5 or absf(a.body.pos.y - p.y) > 3:
				continue
			if a.isPlayer and Game.reflect:
				stun = 2.5; hit(4); UI.toast("🛡️ سپر برگشت: رئیس دزدها خودش ضربه خورد!", "good")
				if Extras.boss == null:
					return
				continue
			a.stun(1.5)
			var dir := Vector3(a.body.pos.x - p.x, 0, a.body.pos.z - p.z).normalized()
			a.body.vel = Vector3(dir.x * 11, 8, dir.z * 11); a.fling = 0.5
			if a.carrying != null:
				Game.return_unit(a.carrying)
			if a.isPlayer:
				UI.toast("👹 رئیس دزدها زمین را لرزاند و گیجت کرد!", "bad")
	func update(dt: float) -> void:
		life -= dt
		var b := body; var p := b.pos
		if p.y < -15:
			UI.toast("👹 رئیس دزدها از جزیره افتاد!", "good"); remove()
			return
		if life <= 0:
			UI.toast("👹 رئیس دزدها با سکه‌هایی که دزدید فرار کرد…", "bad")
			FX.burst(Vector3(p.x, 2, p.z), {"count": 40, "color": ["#b061ff", "#ffffff"], "speed": 6, "life": 0.8}); remove()
			return
		stompCd -= dt; stun -= dt; retarget -= dt
		var mx := 0.0; var mz := 0.0
		if stun <= 0:
			if path.is_empty() or pi >= path.size() or retarget <= 0:
				if target == null or retarget <= 0 or not target.contains(p.x, p.z):
					pick_target(); retarget = U.rnd(14, 20)
			if pi < path.size():
				var wp: Vector2 = path[pi]
				var dx := wp.x - p.x; var dz := wp.y - p.z; var d := Vector2(dx, dz).length()
				if d < 1.2:
					pi += 1
				else:
					mx = dx / d; mz = dz / d
			if stompCd <= 0:
				for a in Game.agents:
					if U.dist2(a.body.pos, p) < 5.5 * 5.5:
						stomp()
						break
			if Extras.boss == null:
				return
			if target != null and target.contains(p.x, p.z):
				drainT -= dt
				if drainT <= 0:
					drainT = 1
					var ow: Owner = target.owner; var took := 0.0
					for s in ow.slots:
						if s.base == target:
							var k: float = s.pending * 0.35
							s.pending -= k; took += k
					if took >= 1:
						FX.burst(Vector3(p.x, p.y + 3, p.z), {"count": 10, "color": ["#ffd23f"], "speed": 3, "life": 0.6})
						if ow.isPlayer:
							UI.toast("💸 رئیس دزدها دارد سکه‌های پایگاهت را می‌دزدد! با سیلی بزنش", "bad")
		var sp := 4.6; var acc := 20 * dt
		b.vel.x += clampf(mx * sp - b.vel.x, -acc, acc); b.vel.z += clampf(mz * sp - b.vel.z, -acc, acc)
		Phys.step_body(b, minf(dt, 0.05))
		if dt > 0.05:
			Phys.step_body(b, dt - 0.05)
		if Vector2(b.vel.x, b.vel.z).length() > 0.4:
			yaw = yaw + U.ang_diff(yaw, atan2(b.vel.x, b.vel.z)) * minf(1.0, dt * 6)
		av.root.position = b.pos; av.root.rotation.y = yaw
		av.animate(dt, {"speed": Vector2(b.vel.x, b.vel.z).length() * 1.4, "grounded": b.grounded, "t": Game.time, "turn": 0, "stunned": stun > 0})

static func update_boss(dt: float) -> void:
	if boss != null:
		boss.update(dt)
		return
	if not Game.playing or not Game.tutorialDone or Game.player == null:
		return
	bossT -= dt
	if bossT <= 0:
		bossT = U.rnd(420, 660)
		boss = Boss.new(Phys.world_of(Game.player.body.pos.x)); Sound.play("alarm"); UI.banner("👹 رئیس دزدها آمد!", "سکه‌های پایگاه‌ها را می‌دزدد · ۱۴ سیلی بزن تا شکست بخورد")

# ---------------------------------------------------------------- achievements
static func owns_rarity(r: int) -> bool:
	for s in Game.owners[0].slots:
		if s.unit != null and s.unit.c.rarity >= r:
			return true
	return false
static func has_world(w: int) -> bool:
	for b in Game.owners[0].bases:
		if b.world == w:
			return true
	return false
static func max_lvl() -> int:
	var m := 0
	for s in Game.owners[0].slots:
		if s.unit != null:
			m = maxi(m, s.unit.lvl)
	return m
static func has_giant() -> bool:
	for s in Game.owners[0].slots:
		if s.unit != null and s.unit.mut == 8:
			return true
	return false

static var ACHIEVEMENTS: Array = [
	{"id": "buy1", "t": "اولین خرید", "e": "🛒", "p": func(): return [Game.stats.bought, 1], "r": 200},
	{"id": "buy50", "t": "معتاد خرید", "e": "🛍️", "p": func(): return [Game.stats.bought, 50], "r": 30000},
	{"id": "steal1", "t": "دزد تازه‌کار", "e": "🦹", "p": func(): return [Game.stats.stolen, 1], "r": 1000},
	{"id": "steal25", "t": "استاد دزدی", "e": "🎭", "p": func(): return [Game.stats.stolen, 25], "r": 2e6},
	{"id": "catch10", "t": "پلیس محله", "e": "👮", "p": func(): return [Game.stats.caught, 10], "r": 50000},
	{"id": "slap100", "t": "سیلی‌زن حرفه‌ای", "e": "🥊", "p": func(): return [Game.stats.slaps, 100], "r": 100000},
	{"id": "rich1m", "t": "میلیونر", "e": "💰", "p": func(): return [Game.owners[0].net_worth(), 1e6], "r": 100000, "money": true},
	{"id": "rich1b", "t": "میلیاردر", "e": "💎", "p": func(): return [Game.owners[0].net_worth(), 1e9], "r": 1e8, "money": true},
	{"id": "rich1t", "t": "تریلیونر", "e": "👑", "p": func(): return [Game.owners[0].net_worth(), 1e12], "r": 1e11, "money": true},
	{"id": "bases3", "t": "زمین‌دار", "e": "🏘️", "p": func(): return [Game.owners[0].bases.size(), 3], "r": 1e6},
	{"id": "portal", "t": "مسافر کهکشان", "e": "🌀", "p": func(): return [1 if Game.portalUnlocked else 0, 1], "r": 5e7},
	{"id": "fuse5", "t": "کیمیاگر", "e": "⚗️", "p": func(): return [Game.stats.fuses, 5], "r": 200000},
	{"id": "chest10", "t": "گنج‌یاب", "e": "🎁", "p": func(): return [Game.stats.chests, 10], "r": 300000},
	{"id": "boss1", "t": "شکارچی رئیس", "e": "👹", "p": func(): return [Game.stats.bossKills, 1], "r": 1e6},
	{"id": "lvl5", "t": "مربی میم", "e": "⭐", "p": func(): return [Extras.max_lvl(), 5], "r": 1e6},
	{"id": "legend", "t": "شکارچی افسانه", "e": "🦁", "p": func(): return [1 if Extras.owns_rarity(4) else 0, 1], "r": 500000},
	{"id": "divine", "t": "لمس خدایان", "e": "🕊️", "p": func(): return [1 if Extras.owns_rarity(7) else 0, 1], "r": 5e7},
	{"id": "rebirth1", "t": "تولد دوباره", "e": "♻️", "p": func(): return [Game.owners[0].rebirths, 1], "r": 1e6},
	{"id": "sky", "t": "فاتح آسمان", "e": "🏝️", "p": func(): return [1 if Extras.has_world(3) else 0, 1], "r": 1e11},
	{"id": "giant", "t": "صاحب غول", "e": "🗿", "p": func(): return [1 if Extras.has_giant() else 0, 1], "r": 1e6},
	{"id": "ice", "t": "فاتح قطب", "e": "❄️", "p": func(): return [1 if Extras.has_world(4) else 0, 1], "r": 1e14},
	{"id": "moon", "t": "فاتح ماه", "e": "🌙", "p": func(): return [1 if Extras.has_world(5) else 0, 1], "r": 5e15},
	{"id": "book100", "t": "کلکسیونر", "e": "📗", "p": func(): return [Game.discovered.size(), 100], "r": 1e7},
	{"id": "book", "t": "دانشنامه‌ی بزرگ", "e": "📖", "p": func(): return [Game.discovered.size(), 500], "r": 1e10},
	{"id": "book2k", "t": "استاد دانشنامه", "e": "📚", "p": func(): return [Game.discovered.size(), 2000], "r": 1e13},
]

static func update_achievements(dt: float) -> void:
	achT -= dt
	if achT > 0 or not Game.playing:
		return
	achT = 2
	for a in ACHIEVEMENTS:
		if Game.ach.has(a.id):
			continue
		var vn: Array = a.p.call()
		if float(vn[0]) >= float(vn[1]):
			Game.ach[a.id] = true; Game.owners[0].money += a.r; Sound.play("mission"); UI.toast("🏅 دستاورد: " + a.e + " " + a.t + " — جایزه " + U.fmt(a.r) + " سکه", "rare"); Game.schedule_save()

static func update(dt: float) -> void:
	if Game.boostT > 0:
		Game.boostT = maxf(0.0, Game.boostT - dt)
	update_chests(dt); update_pads(dt); update_board(dt); update_pets(dt); update_boss(dt); update_achievements(dt)

# ---------------------------------------------------------------- UFO raid event
static func ensure_ufo() -> void:
	if ufo.g != null:
		return
	var g := Node3D.new(); World.add_child(g)
	Geo.mesh(Geo.G("sphere"), Geo.mat("#c0c8d0", {"m": 0.9, "r": 0.2}), 0, 0, 0, 4.2, 0.9, 4.2, g)
	Geo.mesh(Geo.G("hemi"), Geo.glass_mat("#9fe8ff"), 0, 0.5, 0, 1.8, 1.4, 1.8, g, false)
	for i in 10:
		var a := i / 10.0 * TAU
		var c: String = ["#ff4f8b", "#ffd23f", "#3df2b0"][i % 3]
		Geo.mesh(Geo.G("sphere"), Geo.mat(c, {"e": c, "ei": 2}), cos(a) * 3.6, -0.1, sin(a) * 3.6, 0.25, 0.25, 0.25, g)
	var beam := Geo.mesh(Geo.cylinder_g(0.6, 2.4, 16, 20, true), Geo.add_mat("#9fffb0", 0.25), 0, -8.4, 0, 1, 1, 1, g, false)
	ufo.beam = beam; ufo.g = g; g.visible = false

static func update_ufo(dt: float) -> void:
	var active: bool = Game.event != null and Game.event.id == "ufo"
	if not active and (ufo.g == null or not ufo.g.visible):
		return
	ensure_ufo()
	var g: Node3D = ufo.g
	var B = Game.BELTS[0]
	if active and not g.visible:
		g.visible = true; ufo.x = B.x0 + 10; ufo.leaving = 0; g.position = Vector3(ufo.x, 40, 0)
	ufo.t += dt
	if not active:
		ufo.leaving += dt; g.position.y += dt * 25; g.position.x += dt * 20
		if ufo.leaving > 3:
			g.visible = false
		return
	ufo.x += sin(ufo.t * 0.35) * dt * 14; ufo.x = clampf(ufo.x, B.x0 + 6, B.x1 - 25)
	g.position = Vector3(ufo.x, U.damp(g.position.y, 17, 2, dt), sin(ufo.t * 0.8) * 1.5); g.rotation.y += dt * 1.5
	ufo.beam.material_override.albedo_color.a = 0.18 + sin(ufo.t * 8) * 0.08
	ufo.dropT -= dt
	var blocked := false
	for u in B.list:
		if absf(u.pos.x - ufo.x) < 3.5:
			blocked = true
	if ufo.dropT <= 0 and not blocked:
		ufo.dropT = U.rnd(3, 5)
		var x := randf() * 100
		var r := 3 if x < 50 else (4 if x < 80 else (5 if x < 95 else 6))
		var u := Unit.new(Data.pick_char(1, r), 8 if randf() < 0.06 else Game.roll_mut())
		u.belt = B; u.state = "belt"; u.pos = Vector3(ufo.x, B.top, 0); u.yaw = PI / 2; u.rot_y = u.yaw; u.root.rotation.y = u.yaw; u.set_plate("shop"); B.list.append(u)
		FX.burst(Vector3(ufo.x, 2, 0), {"count": 40, "color": ["#9fffb0", "#ffffff", Data.RARITIES[r].color], "speed": 6, "up": true, "life": 0.9})
		if Game.playing and Game.player != null and Phys.world_of(Game.player.body.pos.x) == 1:
			Sound.play("rare")
			if r >= 5 or u.mut == 8:
				UI.toast("🛸 یوفو یک میم " + ("غول‌پیکر " if u.mut == 8 else "") + Data.RARITIES[r].name + " روی نوار انداخت: " + u.c.name + "!", "rare")

static func update_fireworks(dt: float) -> void:
	var pl := Game.player
	if pl == null or Phys.world_of(pl.body.pos.x) != 1 or Day.k > 0.35:
		fireworks.rockets = []
		return
	fireworks.t -= dt
	if fireworks.t <= 0:
		fireworks.t = U.rnd(1.2, 2.8)
		fireworks.rockets.append({"x": pl.body.pos.x + U.rnd(-45, 45), "y": 1.0, "z": clampf(pl.body.pos.z + U.rnd(-30, 30), -16, 16), "vy": U.rnd(20, 26), "fuse": U.rnd(1, 1.4)})
	for i in range(fireworks.rockets.size() - 1, -1, -1):
		var r: Dictionary = fireworks.rockets[i]
		r.fuse -= dt; r.y += r.vy * dt; r.vy -= 9 * dt
		FX.one(r.x, r.y, r.z, {"vx": U.rnd(-0.3, 0.3), "vy": -1, "vz": U.rnd(-0.3, 0.3), "life": 0.4, "size": 0.3, "color": "#ffd23f", "grav": 0})
		if r.fuse <= 0:
			var cols = U.pick([["#ff4f8b", "#ffd23f"], ["#3df2b0", "#58c4ff"], ["#b061ff", "#ffffff"], ["#ff7a00", "#ffe14a"]])
			FX.burst(Vector3(r.x, r.y, r.z), {"count": 70, "color": cols, "speed": 12, "life": 1.6, "grav": -3, "drag": 1.4, "size": 0.5})
			if U.dist2(pl.body.pos, Vector3(r.x, 0, r.z)) < 3600:
				Sound.play("firework")
			fireworks.rockets.remove_at(i)
