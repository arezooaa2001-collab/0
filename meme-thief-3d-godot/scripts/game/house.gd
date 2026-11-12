## Safe house behind every base: 4 vault slots, an iron door with a lock, electric drills.
class_name House

const DOOR_PRICE := 1e9
const DRILL_PRICE := 2.5e10
const DOOR_REPAIR := 2e8
const DRILL_DUR := {"npc": 13.0, "player": 8.0}
static var drills: Array = []
static var raidT := 600.0
static var stepD := 0.0
static var stepK := 0
static var roofBase: BaseVis = null
static var sndT := 0.0
static var MATS: Dictionary = {}

static func mats() -> Dictionary:
	if MATS.is_empty():
		MATS = {"steel": Geo.mat("#6a7380", {"m": 0.92, "r": 0.32}), "dark": Geo.mat("#2a2f38", {"m": 0.8, "r": 0.4}), "rivet": Geo.mat("#aab3bf", {"m": 1, "r": 0.2}),
			"red": Geo.mat("#ff2a3a", {"e": "#ff2a3a", "ei": 2.2}), "green": Geo.mat("#3df27a", {"e": "#22ff66", "ei": 2.2}), "burnt": Geo.mat("#2a2220", {"m": 0.6, "r": 0.7}), "hole": Geo.mat("#050505", {"r": 1.0})}
	return MATS

static func locked(b: BaseVis) -> bool:
	return b.door != null and b.door.state != "broken"

static func build_drill_tool() -> Node3D:
	var g := Node3D.new()
	var y := Geo.mat("#ffcf3f", {"r": 0.4}); var k := Geo.mat("#1b1b22", {"r": 0.5}); var st := Geo.mat("#c0c8d0", {"m": 1, "r": 0.2})
	Geo.mesh(Geo.rbox(0.16, 0.34, 0.2, 0.05), y, 0, -0.66, 0.02, 1, 1, 1, g); Geo.mesh(Geo.rbox(0.13, 0.18, 0.15, 0.04), k, 0, -0.62, -0.13, 1, 1, 1, g)
	Geo.mesh(Geo.G("cyl"), k, 0, -0.86, 0.02, 0.06, 0.08, 0.06, g)
	var bit := Node3D.new(); bit.name = "bit"; bit.position = Vector3(0, -0.9, 0.02); g.add_child(bit)
	Geo.mesh(Geo.G("cyl"), st, 0, -0.16, 0, 0.025, 0.32, 0.025, bit); var cn := Geo.mesh(Geo.G("cone"), st, 0, -0.35, 0, 0.03, 0.08, 0.03, bit); Geo.rot(cn, PI)
	for i in 4:
		var bx := Geo.mesh(Geo.G("box"), st, 0, -0.08 - i * 0.07, 0, 0.07, 0.012, 0.012, bit); Geo.rot(bx, 0, i * 0.8, 0)
	return g

static func install(b: BaseVis, silent: bool) -> void:
	if b.door != null:
		b.door.g.visible = true
		return
	var M := mats()
	var g := Node3D.new(); g.position = Vector3(BaseVis.DOOR_X - BaseVis.DOOR_W / 2, BaseVis.FLOOR_Y, BaseVis.HOUSE_Z0 + 0.15); b.node.add_child(g)
	var DW := BaseVis.DOOR_W; var DH := BaseVis.DOOR_H
	for x in [-0.08, DW + 0.08]:
		Geo.mesh(Geo.G("box"), M.steel, x, DH / 2, 0, 0.16, DH + 0.1, 0.42, g)
	Geo.mesh(Geo.G("box"), M.steel, DW / 2, DH + 0.05, 0, DW + 0.32, 0.16, 0.42, g)
	var panel := Node3D.new(); g.add_child(panel)
	var slab := Geo.mesh(Geo.G("box"), M.steel, DW / 2, DH / 2, 0, DW - 0.04, DH - 0.04, 0.14, panel)
	for yy in [0.45, 1.45, 2.45]:
		Geo.mesh(Geo.G("box"), M.dark, DW / 2, yy, -0.085, DW - 0.12, 0.13, 0.03, panel)
		for i in 6:
			Geo.mesh(Geo.G("sphere"), M.rivet, 0.15 + i * (DW - 0.3) / 5, yy, -0.105, 0.03, 0.03, 0.02, panel)
	var lock := Node3D.new(); lock.position = Vector3(DW - 0.38, 1.3, -0.1); panel.add_child(lock)
	Geo.mesh(Geo.rbox(0.3, 0.5, 0.1, 0.03), M.dark, 0, 0, 0, 1, 1, 1, lock)
	var led := Geo.mesh(Geo.G("box"), M.red, 0, 0.15, -0.055, 0.12, 0.06, 0.01, lock)
	for i in 9:
		Geo.mesh(Geo.G("box"), M.rivet, -0.06 + (i % 3) * 0.06, 0.02 - (i / 3) * 0.06, -0.055, 0.035, 0.035, 0.01, lock)
	var kn := Geo.mesh(Geo.G("cyl"), M.rivet, -0.06, -0.3, -0.12, 0.025, 0.25, 0.025, lock); Geo.rot(kn, 0, 0, PI / 2)
	var hole := Geo.mesh(Geo.G("cyl"), M.hole, DW - 0.38, 1.3, -0.075, 0.14, 0.02, 0.14, panel); Geo.rot(hole, PI / 2); hole.visible = false
	var lbl := Sign.new(); lbl.setup(2.2, 0.66, 320, 96, "#3a3f4e", "rgba(255,255,255,.35)", true); lbl.position = Vector3(DW / 2, DH + 0.75, -0.4); lbl.visible = false; g.add_child(lbl)
	var a := b.to_world(BaseVis.DOOR_X - DW / 2, BaseVis.HOUSE_Z0); var c := b.to_world(BaseVis.DOOR_X + DW / 2, BaseVis.HOUSE_Z0 + 0.3)
	var col := Phys.add_box(a.x, 0, a.y, c.x, BaseVis.FLOOR_Y + DH, c.y, {"cam": false, "tag": "door"})
	var lp := b.to_world(BaseVis.DOOR_X + DW / 2 - 0.38, BaseVis.HOUSE_Z0 - 0.1)
	b.door = {"state": "closed", "g": g, "panel": panel, "slab": slab, "lock": lock, "led": led, "hole": hole, "label": lbl, "col": col, "ang": 0.0, "target": 0.0, "openT": 0.0, "fall": 0.0, "lockPos": Vector3(lp.x, BaseVis.FLOOR_Y + 1.3, lp.y), "repairT": 0.0}
	if not silent:
		FX.burst(Vector3(b.doorPos.x, 1.6, b.doorPos.z), {"count": 40, "color": ["#c0c8d0", "#ffd23f", "#ffffff"], "speed": 5, "life": 0.9}); Sound.play("boom")

static func remove(b: BaseVis) -> void:
	var d = b.door
	if d == null:
		return
	d.g.queue_free(); d.col.minY = 100; d.col.maxY = 101; b.door = null

static func reset_all() -> void:
	for b in World.bases:
		remove(b)
	for s in drills.duplicate():
		stop(s, "reset")

static func set_solid(b: BaseVis, on: bool) -> void:
	var d = b.door
	d.col.minY = 0.0 if on else 100.0; d.col.maxY = (BaseVis.FLOOR_Y + BaseVis.DOOR_H) if on else 101.0

static func open(b: BaseVis, t: float = 6.0) -> void:
	var d = b.door
	if d == null or d.state == "broken":
		return
	d.state = "open"; d.target = -1.75; d.openT = t; set_solid(b, false); d.led.material_override = mats().green; Sound.play("click")

static func close(b: BaseVis) -> void:
	var d = b.door
	if d == null or d.state == "broken":
		return
	d.state = "closed"; d.target = 0.0; set_solid(b, true); d.led.material_override = mats().red; Sound.tone(220, 0.12, "square", 0.12)

static func smash(b: BaseVis) -> void:
	var d = b.door
	if d == null:
		return
	d.state = "broken"; d.target = -2.05; d.fall = 0.16; d.openT = 0; set_solid(b, false)
	d.lock.visible = false; d.hole.visible = true; d.led.material_override = mats().burnt; d.slab.material_override = mats().burnt
	d.repairT = 150.0 if (b.owner != null and not b.owner.isPlayer) else 0.0
	FX.burst(d.lockPos, {"count": 50, "color": ["#ffb000", "#ffd23f", "#ffffff", "#ff5a1f"], "speed": 7, "life": 0.9}); Sound.play("boom")
	for i in 8:
		FX.one(d.lockPos.x, d.lockPos.y, d.lockPos.z, {"vx": U.rnd(-0.5, 0.5), "vy": U.rnd(0.5, 1.5), "vz": U.rnd(-0.5, 0.5), "life": 2.5, "size": 1.1, "color": "#4a4a52", "grow": 0.8, "drag": 0.4})

static func repair(b: BaseVis) -> void:
	var d = b.door
	if d == null:
		return
	d.slab.material_override = mats().steel; d.lock.visible = true; d.hole.visible = false; d.fall = 0; d.state = "open"; close(b)
	FX.burst(Vector3(b.doorPos.x, 1.6, b.doorPos.z), {"count": 30, "color": ["#c0c8d0", "#ffffff"], "speed": 4, "life": 0.7})

static func start_drill(a: Agent, b: BaseVis):
	if b.door == null or b.door.state != "closed":
		return null
	for s in drills:
		if s.base == b or s.a == a:
			return null
	a.body.pos.x = b.doorOut.x; a.body.pos.z = b.doorOut.z; a.body.vel = Vector3.ZERO; a.yaw = b.doorYaw
	var s := {"a": a, "base": b, "t": 0.0, "dur": DRILL_DUR.player if a.isPlayer else DRILL_DUR.npc, "tool": build_drill_tool(), "spot": b.doorOut, "sparkT": 0.0}
	a.av.armR.add_child(s.tool); a.drilling = s; drills.append(s); b.door.label.visible = true
	if not a.isPlayer and b.owner != null and b.owner.isPlayer:
		UI.banner("🚨 " + a.owner.name + " با دریل برقی آمده!", "دارد در آهنی خانه‌ی امنت را سوراخ می‌کند — برو جلویش را بگیر!"); Sound.play("alarm")
	elif a.isPlayer and b.owner != null:
		UI.toast("🔩 دریل روشن شد! تکان نخور… " + b.owner.name + " و نگهبان‌هایش ممکن است سر برسند", "rare")
		if b.owner.agent != null and b.owner.agent.brain != null and not b.owner.agent.stunned:
			b.owner.agent.brain.set_state("return")
	return s

static func stop(s: Dictionary, why: String) -> void:
	var i := drills.find(s)
	if i < 0:
		return
	drills.remove_at(i)
	if s.tool.get_parent():
		s.tool.get_parent().remove_child(s.tool)
	s.tool.queue_free()
	s.a.drilling = null
	if s.base.door != null:
		s.base.door.label.visible = false
	if why == "done":
		return
	FX.burst(Vector3(s.a.body.pos.x, s.a.body.pos.y + 1.3, s.a.body.pos.z), {"count": 18, "color": ["#ffcf3f", "#1b1b22", "#c0c8d0"], "speed": 4, "life": 0.7})
	if s.base.owner != null and s.base.owner.isPlayer and not s.a.isPlayer and why != "reset":
		UI.banner("🛑 جلوی دریل را گرفتی!", s.a.owner.name + " فرار کرد و در خانه‌ات سالم ماند"); Sound.play("success"); Game.stats.caught += 1
	elif s.a.isPlayer and why != "reset":
		UI.toast("🛑 دریل‌کاری نیمه‌کاره ماند! (دریلت سالم است)", "bad")
	if not s.a.isPlayer and s.a.brain != null and why != "reset":
		s.a.brain.set_state("return")

## rivals: walk to the door, drill it, then go for the best vault meme
static func brain(br: Brain, dt: float) -> void:
	var a := br.a; var p := a.body.pos; var b := br.drillBase
	if b == null or b.door == null or (b.door.state == "broken" and a.drilling == null):
		var best = null
		if b != null and b.owner != null:
			for s in b.owner.slots:
				if s.vault and s.base == b and s.unit != null and s.unit.state == "slotted" and (best == null or s.unit.income > best.unit.income):
					best = s
		if best != null:
			br.set_state("steal", {"unit": best.unit, "victim": b.owner})
		else:
			br.set_state("return")
		br.run = true
		return
	if a.drilling != null:
		a.move = Vector2.ZERO
		return
	if b.door.state == "open":
		br.set_state("return")
		return
	if br.path.is_empty():
		if not br.go_to(b.doorOut.x, b.doorOut.z):
			br.set_state("return")
			return
	br.run = true
	var r := "arrived" if U.dist2(p, b.doorOut) < 0.8 * 0.8 else br.follow(dt)
	if r == "arrived" or U.dist2(p, b.doorOut) < 0.8 * 0.8:
		a.move = Vector2.ZERO
		if start_drill(a, b) == null:
			br.set_state("return")
	elif r == "fail" or br.t > 60:
		br.set_state("return")

static func raid_target():
	var o: Owner = Game.owners[0]
	var bs := []
	for b in o.bases:
		if locked(b) and b.door.state == "closed":
			for s in o.slots:
				if s.vault and s.base == b and s.unit != null and s.unit.state == "slotted":
					bs.append(b)
					break
	if bs.is_empty():
		return null
	var b: BaseVis = U.pick(bs)
	var cands := []
	for a in Game.agents:
		if not a.isPlayer and not a.isGuard and a.brain != null and a.owner.base.world == b.world and a.carrying == null and not a.stunned and a.drilling == null and ["idle", "wander", "return"].has(a.brain.state):
			cands.append(a)
	return [b, U.pick(cands)] if cands.size() > 0 else null

static func update(dt: float) -> void:
	var pl := Game.player
	if pl == null:
		return
	for b in World.bases:
		var d = b.door
		if d == null:
			continue
		d.ang = U.damp(d.ang, d.target, 6, dt); d.panel.rotation.y = d.ang; d.panel.rotation.z = U.damp(d.panel.rotation.z, d.fall, 3, dt)
		if d.state == "open":
			d.openT -= dt
			if d.openT <= 0:
				var near := false
				for ag in Game.agents:
					if U.dist2(ag.body.pos, b.doorPos) < 1.5 * 1.5:
						near = true
				if not near:
					close(b)
		if d.state == "broken" and d.repairT > 0:
			d.repairT -= dt
			if d.repairT <= 0:
				repair(b)
	for s in drills.duplicate():
		var a: Agent = s.a; var d = s.base.door
		if d == null or d.state != "closed":
			stop(s, "reset")
			continue
		if a.stunned or U.dist2(a.body.pos, s.spot) > 1.6 * 1.6 or (a.isPlayer and a.carrying != null):
			stop(s, "stopped")
			continue
		s.t += dt; a.yaw = s.base.doorYaw
		var k: float = minf(1.0, s.t / s.dur)
		d.label.set_bg("#c0143c" if k > 0.7 else "#3a3f4e", "rgba(255,255,255,.35)")
		d.label.set_lines("p" + str(int(k * 20)), [{"t": "🔩 " + U.fa(int(k * 100)) + "٪", "size": 58, "color": "#fff", "weight": 900, "stroke": 6}])
		s.tool.get_node("bit").rotation.y += dt * 60
		s.sparkT -= dt
		if s.sparkT <= 0:
			s.sparkT = 0.03
			FX.one(d.lockPos.x + U.rnd(-0.05, 0.05), d.lockPos.y + U.rnd(-0.05, 0.05), d.lockPos.z, {"vx": U.rnd(-3, 3), "vy": U.rnd(0, 4), "vz": U.rnd(-3, 3), "life": 0.5, "size": 0.12, "color": U.pick(["#ffb000", "#ffe14a", "#ffffff"]), "grav": -14, "drag": 0.1})
		if U.dist2(pl.body.pos, d.lockPos) < 1600:
			sndT -= dt
			if sndT <= 0:
				sndT = 0.11; Sound.play("drill")
		if s.t >= s.dur:
			stop(s, "done"); smash(s.base)
			if a.isPlayer:
				a.owner.drills = maxi(0, a.owner.drills - 1); UI.banner("💥 در را سوراخ کردی!", "برو داخل خانه‌ی " + s.base.owner.name + " و یک میم خاص بدزد")
			elif s.base.owner != null and s.base.owner.isPlayer:
				UI.banner("💥 در خانه‌ی امنت سوراخ شد!", a.owner.name + " دارد میم خاصت را می‌دزدد — بگیرش!"); Sound.play("alarm"); a.brain.drillBase = s.base
	if Game.playing and Game.tutorialDone and Game.graceT <= 0:
		raidT -= dt
		if raidT <= 0:
			raidT = U.rnd(480, 1000)
			var t = raid_target()
			if t != null:
				t[1].brain.set_state("drill", {"drillBase": t[0]}); t[1].brain.run = true
			else:
				raidT = U.rnd(120, 240)
	var p := pl.body.pos
	var hb: BaseVis = null
	for b in World.bases:
		if b.in_house(p.x, p.z):
			hb = b
	if hb != roofBase:
		if roofBase != null and roofBase.roof != null:
			roofBase.roof.visible = true
		if hb != null and hb.roof != null:
			hb.roof.visible = false
		roofBase = hb
	if hb != null and pl.body.grounded and not Extras.riding:
		stepD += Vector2(pl.body.vel.x, pl.body.vel.z).length() * dt
		if stepD > (0.95 if pl.sprint else 0.7):
			stepD = 0; stepK ^= 1; Sound.play("wood" if stepK else "wood2")
	else:
		stepD = 0.6

static func seed_rival(o: Owner) -> void:
	if o.isPlayer or o.agent == null:
		return
	var b := o.base
	if randf() < (0.6 if o.hard else 0.3):
		install(b, true)
	var best := []
	for s in o.slots:
		if not s.vault and s.unit != null and s.unit.state == "slotted" and s.base == b:
			best.append(s)
	best.sort_custom(func(x, y): return x.unit.income > y.unit.income)
	best = best.slice(0, U.rndi(1, 2))
	var vs := []
	for s in o.slots:
		if s.vault and s.base == b and s.unit == null:
			vs.append(s)
	for i in best.size():
		if i >= vs.size():
			break
		var s = best[i]; var v = vs[i]; var u: Unit = s.unit
		s.unit = null; v.unit = u; u.slot = v; u.place_at_slot()

static func move_unit(o: Owner, from: Dictionary, to: Dictionary) -> bool:
	var u: Unit = from.unit
	if u == null or u.state != "slotted" or to.unit != null:
		return false
	from.unit = null; to.unit = u; to.pending += from.pending; from.pending = 0.0; u.slot = to; u.state = "transit"; u.set_plate("base")
	if to.vault or from.vault:
		var b: BaseVis = to.base
		if b.door != null and b.door.state == "closed":
			open(b, 6)
	Game.set_transit(u, to.base.slotPos[to.li]); Sound.play("click"); Game.schedule_save()
	return true

static func to_vault(o: Owner, s: Dictionary) -> bool:
	var v = null
	for x in o.slots:
		if x.vault and x.base == s.base and x.unit == null:
			v = x
			break
	if v == null:
		UI.toast("🏠 خانه‌ی امن این پایگاه پر است (۴ جا)", "bad")
		return false
	var ok := move_unit(o, s, v)
	if ok:
		UI.toast("🏠 «" + v.unit.c.name + "» دارد به خانه‌ی امن می‌رود", "good")
	return ok

static func from_vault(o: Owner, s: Dictionary) -> bool:
	var f = o.free_slot(s.base)
	if f == null:
		f = o.free_slot()
	if f == null:
		UI.toast("🏠 جای خالی بیرون از خانه نداری", "bad")
		return false
	return move_unit(o, s, f)
