## Rival AI: finite-state machine with A* navigation (ported from the original).
class_name Brain

var a: Agent
var o: Owner
var state := "idle"
var t := 0.0
var think := 1.0
var path: Array = []
var pi := 0
var goal = null
var stuckT := 0.0
var stuckN := 0
var lx := 0.0
var lz := 0.0
var run := false
var stealCd := 40.0
var aggr := 1.0
var repath := 0.0
var react := 0.0
var upCd := 20.0
var unit: Unit = null
var victim: Owner = null
var thief: Agent = null
var target: Agent = null
var grab := 0.0
var drillBase: BaseVis = null
var base: BaseVis = null

func _init(a_: Agent) -> void:
	a = a_; o = a.owner
	think = U.rnd(0.5, 2); stealCd = U.rnd(25, 60); aggr = U.rnd(0.7, 1.3); upCd = U.rnd(10, 30)

func set_state(s: String, data: Dictionary = {}) -> void:
	state = s; t = 0; path = []; goal = null; stuckN = 0; stuckT = 0; run = false
	for k in data.keys():
		set(k, data[k])

func go_to(x: float, z: float) -> bool:
	var p := a.body.pos
	path = Nav.find_path(p.x, p.z, x, z); pi = 0; goal = Vector2(x, z); stuckT = 0; lx = p.x; lz = p.z
	return not path.is_empty()

func follow(dt: float) -> String:
	var p := a.body.pos
	if path.is_empty():
		a.move = Vector2.ZERO
		return "fail"
	if pi >= path.size():
		a.move = Vector2.ZERO
		return "arrived"
	for bs in World.bases:
		if bs.barrierActive and bs.owner != o and goal != null and bs.contains(goal.x, goal.y) and not bs.contains(p.x, p.z):
			a.move = Vector2.ZERO
			return "fail"
	var wp: Vector2 = path[pi]
	var dx := wp.x - p.x; var dz := wp.y - p.z; var d := Vector2(dx, dz).length(); var last := pi == path.size() - 1
	if d < (0.45 if last else 0.8):
		pi += 1
		if pi >= path.size():
			a.move = Vector2.ZERO
			return "arrived"
		return "moving"
	var slow := maxf(0.35, d / 1.5) if (last and d < 1.5) else 1.0
	a.move = Vector2(dx / d * slow, dz / d * slow)
	stuckT += dt
	if stuckT > 1:
		var moved := Vector2(p.x - lx, p.z - lz).length()
		lx = p.x; lz = p.z; stuckT = 0
		if moved < 0.35 and not a.stunned:
			stuckN += 1
			if stuckN == 1:
				a.jumpQ = 0.2
			elif stuckN <= 3 and goal != null:
				go_to(goal.x, goal.y)
			else:
				return "fail"
		else:
			stuckN = 0
	return "moving"

func on_theft(th: Agent, u: Unit) -> void:
	if a.carrying != null:
		return
	set_state("defend", {"thief": th, "unit": u})
	react = 0.35 + sqrt(U.dist2(a.body.pos, th.body.pos)) / 45 + (1 - Day.k) * 0.7
	if o.hard:
		react *= 0.45
	if th.isPlayer:
		react += 0.5 * th.owner.up.cloak
	run = true

func intruder() -> Agent:
	for ag in Game.agents:
		if ag != a and ag.owner != o and not ag.stunned and o.base.contains(ag.body.pos.x, ag.body.pos.z):
			if ag.isPlayer:
				if Game.playing and not (o.hard and ag.owner.up.cloak > 0):
					return ag
			else:
				return ag
	return null

func decide() -> void:
	var p := a.body.pos; var bs := o.base
	for ag in Game.agents:
		if ag.carrying != null and ag.carrying.owner == o and ag != a:
			set_state("defend", {"thief": ag, "unit": ag.carrying}); run = true
			return
	var intr := intruder()
	if intr != null and U.dist2(p, bs.insidePos) < 45 * 45:
		set_state("guard", {"target": intr})
		return
	if o.secT <= 0 and o.secCd <= 0 and o.unit_count() > 0:
		for ag in Game.agents:
			if ag == a or ag.owner == o or (ag.isPlayer and not Game.playing):
				continue
			var near := U.dist2(ag.body.pos, bs.entrancePos) < 15 * 15 and not bs.contains(ag.body.pos.x, ag.body.pos.z)
			var hostile: bool = ag.isPlayer or (ag.brain != null and ag.brain.state == "steal" and ag.brain.victim == o)
			if near and hostile and randf() < (0.5 if o.hard else (0.22 if ag.isPlayer else 0.3)):
				Game.activate_security(o)
				break
	var inc := o.income_per_sec()
	if o.pending() > maxf(40.0, inc * 30) and randf() < 0.8:
		set_state("collect")
		return
	if stealCd <= 0:
		stealCd = U.rnd(40, 90) / aggr
		var tg := pick_victim(); var wk = o.weakest()
		if tg != null and (o.free_slot() != null or (wk != null and tg.income > wk.income * 1.5)):
			set_state("steal", {"unit": tg, "victim": tg.owner})
			return
	var bt := pick_belt()
	if bt != null:
		set_state("buy", {"unit": bt}); run = true
		return
	if randf() < 0.55:
		var w := bs.to_world(U.rnd(-9, 9), U.rnd(-5, 8))
		set_state("wander"); go_to(w.x, w.y)
	elif bs.world >= 4:
		var XW: float = EXW.D[bs.world].X
		var q = U.pick([[XW + U.rnd(-75, 75), U.rnd(-22, 22)], [clampf(bs.cx, XW - 68, XW + 68), signf(bs.cz) * 3.2], [bs.cx + U.rnd(-20, 20), signf(bs.cz) * U.rnd(5, 24)]])
		set_state("wander"); go_to(q[0], q[1])
	else:
		var w2 := bs.world == 2; var w3 := bs.world == 3
		var cxw := Phys.X2 if w2 else (Phys.X3 if w3 else 0.0); var pz := 9.0 if (w2 or w3) else 15.0
		var pts: Array
		if w3:
			pts = [[Phys.X3 + U.rnd(-60, 60), U.rnd(-pz, pz)], [clampf(bs.cx, Phys.X3 - 60, Phys.X3 + 60), signf(bs.cz) * 3.2]]
		else:
			pts = [[bs.cx + U.rnd(-40, 40), U.rnd(4, pz) * signf(bs.cz)], [cxw + U.rnd(-70 if w2 else -120, 70 if w2 else 120), U.rnd(-pz, pz)], [bs.cx + U.rnd(-30, 30), signf(bs.cz) * 3.2]]
		var q = U.pick(pts)
		set_state("wander"); go_to(q[0], q[1])

func try_upgrade() -> void:
	var opts := []
	for k in ["cap", "income", "secDur", "trap", "speed", "secCd"]:
		var U_: Dictionary = Data.UPGRADES[k]
		if o.up[k] < U_.max and Data.up_cost(k, o.up[k]) < o.money * (0.8 if (k == "cap" and o.free_slot() == null) else 0.35):
			opts.append(k)
	if opts.size() > 0:
		var k: String = "cap" if (opts.has("cap") and o.free_slot() == null) else U.pick(opts)
		o.money -= Data.up_cost(k, o.up[k]); o.up[k] += 1; o.apply_cap()
		FX.burst(Vector3(o.base.insidePos.x, 3, o.base.insidePos.z), {"count": 20, "color": [o.color, "#ffffff"], "speed": 4, "up": true})

func pick_belt() -> Unit:
	var slot = o.free_slot()
	var best: Unit = null; var bestScore := 0.0
	var weakest: Unit = null
	for s in o.slots:
		if s.unit != null and s.unit.state == "slotted" and (weakest == null or s.unit.income < weakest.income):
			weakest = s.unit
	var B = Game.belt_of_world(o.base.world)
	for u in B.list:
		if u.pos.x > minf(B.x1 - 14, o.base.cx + 20):
			continue
		var pr := Game.belt_price(u)
		if pr > o.money * (1.0 if slot != null else 0.9):
			continue
		if slot == null and (weakest == null or u.income < weakest.income * 2):
			continue
		var score: float = u.income * (1 + randf() * 0.3) - absf(u.pos.x - a.body.pos.x) * 0.02 * u.income
		if score > bestScore:
			bestScore = score; best = u
	if best == null or randf() > 0.85:
		return null
	if slot == null and weakest != null:
		Game.sell_unit(o, weakest.slot)
	return best

func pick_victim() -> Unit:
	var cands := []; var tot := 0.0
	for v in Game.owners:
		if v == o:
			continue
		if v.isPlayer and (not Game.playing or Game.graceT > 0 or not Game.tutorialDone):
			continue
		var units := []
		for s in v.slots:
			if s.unit != null and s.unit.state == "slotted" and not s.base.barrierActive and s.base.world == o.base.world and not (s.vault and House.locked(s.base)):
				units.append(s.unit)
		if units.is_empty():
			continue
		units.sort_custom(func(x, y): return x.income > y.income)
		var away: float = sqrt(U.dist2(v.agent.body.pos, units[0].slot.base.insidePos)) if v.agent != null else 99.0
		var w := (3.0 if away > 30 else (1.4 if away > 15 else 0.5)) * (1.6 if v.isPlayer else 1.0)
		cands.append([units[0] if randf() < 0.7 else U.pick(units.slice(0, 3)), w]); tot += w
	var x := randf() * tot
	for c in cands:
		x -= c[1]
		if x <= 0:
			return c[0]
	return null

func update(dt: float) -> void:
	var p := a.body.pos
	t += dt; a.sprint = run
	stealCd -= dt * (3.0 if (Game.event != null and Game.event.id == "raid") else 1.0)
	upCd -= dt
	if upCd <= 0:
		upCd = U.rnd(6, 14); try_upgrade()
	if a.stunned:
		a.move = Vector2.ZERO
		return
	if react > 0:
		react -= dt; a.move = Vector2.ZERO
		return
	if state == "drill":
		House.brain(self, dt)
		return
	match state:
		"idle":
			a.move = Vector2.ZERO; think -= dt
			if think <= 0:
				think = U.rnd(0.8, 2.2); decide()
		"wander":
			var r := follow(dt)
			if r != "moving" or t > 25:
				set_state("idle", {"think": U.rnd(0.5, 2)})
			if t > 0.5 and floorf(t * 2) != floorf((t - dt) * 2):
				var intr := intruder()
				var carried := false
				for ag in Game.agents:
					if ag.carrying != null and ag.carrying.owner == o:
						carried = true
				if intr != null or carried:
					set_state("idle", {"think": 0.0})
		"collect":
			if path.is_empty():
				go_to(o.base.collectPos.x, o.base.collectPos.z)
			var r := follow(dt)
			if U.dist2(p, o.base.collectPos) < 1.4:
				Game.collect_owner(o, false, null); set_state("idle", {"think": U.rnd(0.3, 1)})
			elif r == "fail" or t > 30:
				set_state("idle")
		"buy":
			var u := unit
			var UB = u.belt if (u != null and u.belt != null) else Game.BELTS[0]
			if u == null or u.state != "belt" or t > 28 or u.pos.x > UB.x1 - 3:
				set_state("idle", {"think": 0.3})
				return
			if U.dist2(p, u.pos) < 3.2 * 3.2:
				var r := Game.try_buy(o, u)
				set_state("return" if r == "ok" else "idle", {"think": 0.4})
				return
			repath -= dt
			if repath <= 0 or path.is_empty():
				repath = 1.1
				var d := sqrt(U.dist2(p, u.pos)); var tt := d / 6.3
				var ax := minf(UB.x1 - 2, u.pos.x + Game.belt_speed(UB) * tt * 0.9); var az := signf(o.base.cz) * 2.8
				if not go_to(ax, az):
					set_state("idle")
					return
			if follow(dt) == "fail":
				set_state("idle")
		"return":
			if path.is_empty():
				go_to(o.base.insidePos.x + U.rnd(-3, 3), o.base.insidePos.z)
			var r := follow(dt)
			if r != "moving" or t > 30:
				set_state("idle", {"think": U.rnd(0.5, 1.5)})
		"steal":
			var u := unit; var v := victim
			if u == null or u.state != "slotted" or u.owner != v or t > 40 or a.carrying != null:
				set_state("return")
				return
			var sb: BaseVis = u.slot.base
			if sb.barrierActive and not sb.contains(p.x, p.z):
				set_state("return")
				return
			if path.is_empty():
				var sp: Vector3 = sb.slotPos[u.slot.li]
				if not go_to(sp.x, sp.z):
					set_state("return")
					return
			if U.dist2(p, u.pos) < 1.7 * 1.7:
				a.move = Vector2.ZERO; grab += dt
				if grab > 0.45:
					grab = 0
					if Game.start_steal(a, u):
						set_state("escape"); run = true
					else:
						set_state("return")
				return
			if follow(dt) == "fail":
				set_state("return")
		"escape":
			if a.carrying == null:
				set_state("return")
				return
			if a.slapCd <= 0:
				var ch = a.carrying.owner.agent
				if ch != null and not ch.stunned and U.dist2(ch.body.pos, p) < 2.1 * 2.1:
					if randf() < 0.4:
						Game.slap(a, 1.0)
					else:
						a.slapCd = 1.5
			run = true; repath -= dt
			if path.is_empty() or repath <= 0:
				repath = 3
				var ip := o.base.insidePos
				go_to(ip.x + U.rnd(-2, 2), ip.z)
			if follow(dt) == "fail":
				path = []
		"defend":
			var th := thief
			if th == null or th.carrying == null or th.carrying.owner != o or t > 35:
				set_state("return")
				return
			run = true
			var tp := th.body.pos; var d2 := U.dist2(p, tp)
			if d2 < 100 and Nav.line_open(p.x, p.z, tp.x, tp.z):
				var d := maxf(sqrt(d2), 1e-3)
				a.move = Vector2((tp.x - p.x) / d, (tp.z - p.z) / d); path = []
				if tp.y - p.y > 0.8 and d < 3:
					a.jumpQ = 0.15
			else:
				repath -= dt
				if path.is_empty() or repath <= 0:
					repath = 0.6; go_to(tp.x, tp.z)
				follow(dt)
		"guard":
			var tg := target
			if tg == null or not o.base.contains(tg.body.pos.x, tg.body.pos.z, 2) or t > 18:
				set_state("return")
				return
			if tg.carrying != null and tg.carrying.owner == o:
				set_state("defend", {"thief": tg, "unit": tg.carrying}); run = true
				return
			var tp := tg.body.pos; var d2 := U.dist2(p, tp)
			if d2 > 2.2 * 2.2:
				if Nav.line_open(p.x, p.z, tp.x, tp.z):
					var d := sqrt(d2)
					a.move = Vector2((tp.x - p.x) / d, (tp.z - p.z) / d); path = []
				else:
					repath -= dt
					if path.is_empty() or repath <= 0:
						repath = 0.8; go_to(tp.x, tp.z)
					follow(dt)
			else:
				a.move = Vector2.ZERO; a.yaw = atan2(tp.x - p.x, tp.z - p.z)
		_:
			set_state("idle")
