## Core game state and systems (autoload "Game"): belt, economy, stealing, security, slapping, events, plots, wardrobe.
extends Node

var BELTS: Array = []
var owners: Array[Owner] = []
var player: Agent = null
var agents: Array[Agent] = []
var units: Array[Unit] = []
var time := 0.0
var playing := false
var paused := false
var event = null
var nextEventIn := 150.0
var spawnCount := 0
var graceT := 90.0
var stats := {"bought": 0, "stolen": 0, "caught": 0, "collected": 0.0, "sold": 0, "slaps": 0, "fuses": 0, "chests": 0, "bossKills": 0, "levels": 0}
var ach: Dictionary = {}
var discovered: Dictionary = {}
var look: Dictionary = {}
var wear: Dictionary = {}
var name_ := "قهرمان"
var offline := 0.0
var resetting := false
var metrics := {"steals": 0, "delivered": 0, "caught": 0, "fromPlayer": 0}
var tutorialDone := false
var daily := {"last": "", "streak": 0}
var playTime := 0.0
var lastSave := 0.0
var alerts: Dictionary = {}
var boostT := 0.0
var reflect := false
var secretUsed := false
var portalUnlocked := false
var portal3Unlocked := false
var portal4Unlocked := false
var portal5Unlocked := false
var sunTint := 1.0
var units_node: Node3D
var agents_node: Node3D
var shopkeeper: Avatar = null
var cam_pos := Vector3.ZERO
var cam_pivot := Vector3.ZERO
var CAM := {"yaw": 0.0, "pitch": 0.38, "cur": 7.5, "fpPitch": 0.1, "shake": 0.0}
var saveQueued := false
var acc := 0.0
const FIXED := 1.0 / 120.0
var reflect_combos: Array = []
var inited := false
var main = null

func _ready() -> void:
	units_node = Node3D.new(); units_node.name = "Units"; add_child(units_node)
	agents_node = Node3D.new(); agents_node.name = "Agents"; add_child(agents_node)
	BELTS = [
		{"x0": -108.0, "x1": 107.5, "z": 0.0, "halfW": 1.9, "top": 0.4, "speed": 3.0, "w": 1, "tag": "belt", "list": [], "spawnT": 1.0, "active": true},
		{"x0": Phys.X2 - 85, "x1": Phys.X2 + 84.5, "z": 0.0, "halfW": 1.9, "top": 0.4, "speed": 3.6, "w": 2, "tag": "belt2", "list": [], "spawnT": 1.0, "active": false},
		{"x0": Phys.X3 - 62, "x1": Phys.X3 + 61.5, "z": 0.0, "halfW": 1.9, "top": 0.4, "speed": 3.2, "w": 3, "tag": "belt3", "list": [], "spawnT": 1.0, "active": false},
		{"x0": Phys.X4 - 72, "x1": Phys.X4 + 71.5, "z": 0.0, "halfW": 1.9, "top": 0.4, "speed": 3.4, "w": 4, "tag": "belt4", "list": [], "spawnT": 1.0, "active": false},
		{"x0": Phys.X5 - 72, "x1": Phys.X5 + 71.5, "z": 0.0, "halfW": 1.9, "top": 0.4, "speed": 3.9, "w": 5, "tag": "belt5", "list": [], "spawnT": 1.0, "active": false},
	]

# ---------------------------------------------------------------- belts
func belt_speed(B: Dictionary) -> float:
	return B.speed * (1.6 if (event != null and event.id == "turbo") else 1.0)
func belt_of_tag(tag: String) -> Dictionary:
	for B in BELTS:
		if B.tag == tag:
			return B
	return BELTS[0]
func belt_of_world(w: int) -> Dictionary:
	return BELTS[clampi(w, 1, 5) - 1]
func belt_price(u: Unit) -> float:
	return roundf(u.price * (0.7 if (event != null and event.id == "sale") else 1.0))

func roll_rarity(B: Dictionary) -> int:
	var lucky: bool = event != null and event.id == "lucky"
	if B.w == 1 and spawnCount < 4:
		return 1 if spawnCount == 3 else 0
	var w := Data.weights_of(B.w)
	var tot := 0.0
	var ws := []
	for i in w.size():
		var v: float = float(w[i]) * (4.0 if (lucky and i >= 2) else 1.0)
		ws.append(v); tot += v
	var x := randf() * tot
	for i in ws.size():
		x -= ws[i]
		if x <= 0:
			return i
	return 0

func roll_mut() -> int:
	var x := randf()
	for i in range(Data.MUTATIONS.size() - 1, 0, -1):
		var ch: float = Data.MUTATIONS[i].chance
		if x < ch:
			return i
		x -= ch
	return 0

func spawn_belt(B: Dictionary) -> void:
	var r := roll_rarity(B)
	var c := Data.pick_char(B.w, r)
	var mut: int
	if B.w > 1:
		mut = Data.world_mut(B.w)
	elif spawnCount < 4:
		mut = 0
	else:
		mut = roll_mut()
	var u := Unit.new(c, mut)
	u.belt = B; u.state = "belt"; u.pos = Vector3(B.x0 + 0.5, B.top, U.rnd(-0.35, 0.35)); u.yaw = PI / 2; u.rot_y = u.yaw; u.root.rotation.y = u.yaw; u.set_plate("shop")
	B.list.append(u)
	if B.w == 1:
		spawnCount += 1
	var cols: Array
	match B.w:
		2: cols = ["#ff5a1f", "#ffd23f", Data.RARITIES[r].color]
		3: cols = ["#ffffff", "#9fe8ff", Data.RARITIES[r].color]
		4: cols = ["#bfefff", "#ffffff", Data.RARITIES[r].color]
		5: cols = ["#ff3df2", "#3df2ff", Data.RARITIES[r].color]
		_: cols = ["#c79bff", "#ffffff", Data.RARITIES[r].color]
	FX.burst(Vector3(u.pos.x, 1.5, u.pos.z), {"count": 16, "color": cols, "speed": 3.5, "life": 0.6})
	var here: bool = player != null and Phys.world_of(player.body.pos.x) == B.w
	if u.mut == 8 and playing and here:
		UI.banner("🗿 میم غول‌پیکر!", c.name + " · ۲۰ برابر ارزش"); Sound.play("rare")
	elif r >= (6 if B.w > 1 else 4) and playing and here:
		UI.toast("🌟 یک میم " + Data.RARITIES[r].name + " روی نوار آمد: " + c.name + "!", "rare"); Sound.play("rare")
		if r >= 6:
			UI.banner(Data.RARITIES[r].name + "!", c.name + " ظاهر شد")

func update_belt(dt: float) -> void:
	for B in BELTS:
		if not B.active:
			continue
		B.spawnT -= dt * (1.6 if (event != null and event.id == "turbo") else 1.0)
		var last = B.list[-1] if B.list.size() > 0 else null
		if B.spawnT <= 0 and (last == null or last.pos.x - B.x0 > 3.4):
			spawn_belt(B)
			B.spawnT = U.rnd(2.6, 3.6) if B.w == 2 else U.rnd(2.2, 3.1)

## fill a belt so a world is alive from the first frame
func prefill_belt(B: Dictionary, steps: int, lo: float, hi: float) -> void:
	for i in steps:
		B.spawnT -= 0.1
		if B.spawnT <= 0:
			var last = B.list[-1] if B.list.size() > 0 else null
			if last == null or last.pos.x - B.x0 > 3.4:
				spawn_belt(B); B.spawnT = U.rnd(lo, hi)
		for u in B.list:
			u.pos.x += B.speed * 0.1
	for u in B.list.duplicate():
		if u.pos.x > B.x1:
			B.list.erase(u); u.dispose(false)

func try_buy(o: Owner, u: Unit) -> String:
	if u == null or u.state != "belt":
		return "gone"
	if o.agent != null and o.agent.carrying != null:
		return "busy"
	var B: Dictionary = u.belt if u.belt != null else BELTS[0]
	var slot = o.free_slot(null, B.w)
	if slot == null:
		return "full"
	var price := belt_price(u)
	if o.money < price:
		return "money"
	o.money -= price
	B.list.erase(u)
	u.state = "transit"; u.owner = o; u.slot = slot; slot.unit = u; slot.pending = 0.0; u.transitT = 0
	var tp: Vector3 = slot.base.slotPos[slot.li]
	u.pos.y = B.top
	set_transit(u, tp)
	u.set_plate("base")
	FX.burst(Vector3(u.pos.x, 1.6, u.pos.z), {"count": 22, "color": ["#ffd23f", "#ffffff", o.color], "speed": 5, "life": 0.8})
	if o.isPlayer:
		Sound.play("buy"); UI.toast("🎉 خریدی: " + u.c.name + " (" + U.fmt(price) + ")", "good"); UI.float_text(u.pos, "-" + U.fmt(price), "#ffd23f")
		stats.bought += 1; discover(u.c.id); Tutorial.event("buy"); Missions.event("buy")
		if u.c.rarity >= 2:
			Missions.event("rare")
		schedule_save()
	return "ok"

func discover(id: String) -> void:
	if discovered.has(id):
		return
	discovered[id] = true
	if not playing or discovered.size() < 2:
		return
	var n := discovered.size()
	if n % 50 == 0:
		var o := player.owner
		var r := roundf(maxf(5000, o.income_per_sec() * 90))
		o.money += r; Sound.play("mission"); UI.banner("📖 " + U.fa(n) + " میم کشف کردی!", "جایزه‌ی دانشنامه: " + U.fmt(r) + " سکه")
	else:
		UI.toast("📖 میم جدید به دانشنامه اضافه شد! (" + U.fa(n) + " از " + U.fa(Data.CHARS.size()) + ")", "")

func pending_of(o: Owner, base: BaseVis) -> float:
	var s := 0.0
	for sl in o.slots:
		if base == null or sl.base == base:
			s += sl.pending
	return s

func collect_owner(o: Owner, auto: bool, base: BaseVis) -> float:
	var s := 0.0
	for sl in o.slots:
		if base == null or sl.base == base:
			s += sl.pending; sl.pending = 0.0
	s = floorf(s)
	if s < 1:
		return 0.0
	o.money += s
	var cp: Vector3 = (base if base else o.base).collectPos
	if o.isPlayer:
		Sound.play("coin"); UI.float_text(Vector3(cp.x, 1.8, cp.z), "+" + U.fmt(s), "#3df2b0")
		FX.burst(Vector3(cp.x, 1.2, cp.z), {"count": 8 if auto else 24, "color": ["#ffd23f", "#fff3a0"], "speed": 4.5, "up": true, "life": 0.9, "grav": -9})
		stats.collected += s; Tutorial.event("collect"); Missions.event("collect", s)
	return s

func sell_unit(o: Owner, slot: Dictionary) -> bool:
	var u: Unit = slot.unit
	if u == null or u.state == "carried":
		return false
	var val := floorf(u.price * 0.5)
	o.money += val; slot.unit = null; slot.pending = 0.0; u.dispose(true)
	if o.isPlayer:
		Sound.play("coin"); UI.toast("💵 فروختی: " + u.c.name + " (+" + U.fmt(val) + ")", "good"); stats.sold += 1; schedule_save()
	return true

func activate_security(o: Owner) -> bool:
	if o.secT > 0 or o.secCd > 0:
		return false
	o.secT = Data.sec_duration(o)
	for b in o.bases:
		b.set_barrier(true)
		FX.burst(Vector3(b.entrancePos.x, 1.5, b.entrancePos.z), {"count": 20, "color": ["#ff2a3a", "#ffffff"], "speed": 5, "life": 0.7})
	if o.isPlayer:
		Sound.play("laser"); UI.toast("🛡️ سپر لیزری فعال شد!", "good"); Tutorial.event("security"); Missions.event("shield")
	elif player != null and U.dist2(player.body.pos, o.base.entrancePos) < 900:
		Sound.play("laser")
	return true

func update_security(o: Owner, dt: float) -> void:
	if o.secT > 0:
		o.secT -= dt
		if o.secT <= 0:
			o.secT = 0; o.secCd = Data.sec_cooldown(o)
			for b in o.bases:
				b.set_barrier(false)
			if o.isPlayer:
				UI.toast("🛡️ سپر خاموش شد", "")
	elif o.secCd > 0:
		o.secCd = maxf(0.0, o.secCd - dt)
		if o.secCd == 0 and o.isPlayer:
			UI.toast("🛡️ سپر دوباره آماده است", "good")

## barrier constraint: non-owners can't cross an active entrance from outside
func barrier_constraint(b: Phys.Body) -> void:
	if b.agent == null:
		return
	for base in World.bases:
		if not base.barrierActive or base.owner == null or base.owner == b.agent.owner:
			continue
		var l: Vector2 = base.to_local_xz(b.pos.x, b.pos.z)
		if absf(l.x) > 3.4 or l.y < -11.5 or l.y > -8.5:
			continue
		var pl: Vector2 = base.to_local_xz(b.prev.x, b.prev.z)
		var LIM := -10.25 - b.r
		if pl.y <= -9.8 and l.y > LIM:
			var w: Vector2 = base.to_world(l.x, LIM); b.pos.x = w.x; b.pos.z = w.y
			var nz: float = -base.f; var vn: float = b.vel.z * nz
			if vn < 0:
				b.vel.z -= nz * vn
			b.vel.z += nz * 4; b.agent.zap()

# ---------------------------------------------------------------- stealing
func can_steal(a: Agent, u: Unit) -> bool:
	return u != null and u.state == "slotted" and u.owner != a.owner and a.carrying == null and not a.stunned

func start_steal(a: Agent, u: Unit) -> bool:
	if not can_steal(a, u):
		return false
	if u.owner.isPlayer and reflect and not a.isPlayer:
		reflect_hit(a, "دزدی")
		return false
	u.state = "carried"; u.carrier = a; a.carrying = u; u.set_plate(""); a.carryT = 0; metrics.steals += 1
	if u.owner.isPlayer:
		metrics.fromPlayer += 1
	FX.burst(Vector3(u.pos.x, u.pos.y + 1, u.pos.z), {"count": 20, "color": ["#ff4f8b", "#ffffff"], "speed": 4, "life": 0.6})
	var victim := u.owner
	if a.isPlayer and Extras.riding:
		Extras.riding = false
	if a.isPlayer:
		Sound.play("steal"); UI.toast("🦹 " + u.c.name + " را برداشتی! سریع به پایگاهت برگرد", "bad"); Tutorial.event("grab")
	if victim.isPlayer:
		Sound.play("alarm"); UI.toast("🚨 " + a.owner.name + " دارد " + u.c.name + " تو را می‌دزدد! بگیرش!", "bad"); alerts[a] = u
	if victim.agent != null and victim.agent.brain != null:
		victim.agent.brain.on_theft(a, u)
	return true

func return_unit(u: Unit) -> void:
	var c = u.carrier
	if c != null:
		c.carrying = null
	u.carrier = null
	for k in alerts.keys():
		if alerts[k] == u:
			alerts.erase(k)
	FX.burst(u.pos, {"count": 16, "color": ["#ffffff", "#7af7ff"], "speed": 4, "life": 0.6})
	u.state = "slotted"; u.place_at_slot(); u.set_plate("base")
	FX.burst(Vector3(u.pos.x, u.pos.y + 1, u.pos.z), {"count": 16, "color": ["#ffffff", u.owner.color], "speed": 3, "up": true, "life": 0.7})

func deliver(a: Agent, base: BaseVis, world: int) -> bool:
	var u := a.carrying
	if u == null:
		return false
	var slot = a.owner.free_slot(base, world)
	if slot == null:
		return false
	var from := u.owner
	u.slot.unit = null; u.slot.pending = 0.0; metrics.delivered += 1
	u.owner = a.owner; u.slot = slot; slot.unit = u; slot.pending = 0.0; u.carrier = null; a.carrying = null; u.state = "slotted"
	for k in alerts.keys():
		if alerts[k] == u:
			alerts.erase(k)
	u.place_at_slot(); u.set_plate("base")
	FX.burst(Vector3(u.pos.x, u.pos.y + 1, u.pos.z), {"count": 40, "color": ["#ffd23f", "#3df2b0", "#ffffff", a.owner.color], "speed": 6, "up": true, "life": 1.1})
	if a.isPlayer:
		Sound.play("success"); UI.banner("دزدی موفق! 🎉", u.c.name + " حالا مال توست"); stats.stolen += 1; discover(u.c.id); Tutorial.event("stolen"); Missions.event("steal"); schedule_save()
	if from.isPlayer:
		Sound.play("caught"); UI.toast("😭 " + a.owner.name + " میم " + u.c.name + " را از تو دزدید!", "bad"); schedule_save()
	return true

func update_steals(dt: float) -> void:
	for a in agents:
		var u: Unit = a.carrying
		if u == null:
			continue
		a.carryT += dt
		var caughtBy: Agent = null
		var defenders := [u.owner.agent] + u.owner.guards
		for d in defenders:
			if d == null or d == a or d.stunned or d.carrying != null:
				continue
			if U.dist2(a.body.pos, d.body.pos) < 1.5 * 1.5 and absf(a.body.pos.y - d.body.pos.y) < 1.6:
				caughtBy = d
				break
		if caughtBy != null and a.isPlayer and reflect:
			reflect_hit(caughtBy, "گرفتن"); caughtBy = null
		if caughtBy != null:
			var d := caughtBy
			return_unit(u); a.stun(1.6); metrics.caught += 1
			var dir := Vector3(a.body.pos.x - d.body.pos.x, 0, a.body.pos.z - d.body.pos.z).normalized()
			a.body.vel = Vector3(dir.x * 9, 6, dir.z * 9)
			if a.isPlayer:
				Sound.play("caught"); UI.toast("😵 " + ("نگهبانِ " if d.isGuard else "") + d.owner.name + " گرفتت! میم برگشت به صاحبش", "bad")
			if d.isPlayer:
				var bounty := maxf(10, floorf(u.price * 0.05))
				d.owner.money += bounty; Sound.play("success"); UI.toast("💪 دزد را گرفتی! جایزه: " + U.fmt(bounty), "good"); UI.float_text(d.body.pos, "+" + U.fmt(bounty), "#3df2b0"); stats.caught += 1; Missions.event("catch")
			continue
		var home: BaseVis = a.owner.base_at(a.body.pos.x, a.body.pos.z)
		if home != null:
			if not a.isPlayer and a.owner.free_slot() == null:
				var wk = a.owner.weakest()
				if wk != null and wk.income < u.income:
					sell_unit(a.owner, wk.slot)
			if not deliver(a, home, home.world):
				if a.isPlayer:
					if time - a.fullWarn > 3:
						a.fullWarn = time; UI.toast("📦 جای خالی نداری! ظرفیت را ارتقا بده، یک میم بفروش یا یک پایگاه جدید بخر", "bad"); Sound.play("error")
				else:
					return_unit(u)
		elif not a.isPlayer and a.carryT > 80:
			return_unit(u)

func separate_agents() -> void:
	var A := agents
	for i in A.size():
		for j in range(i + 1, A.size()):
			var a: Phys.Body = A[i].body; var b: Phys.Body = A[j].body
			var dx := b.pos.x - a.pos.x; var dz := b.pos.z - a.pos.z; var d2 := dx * dx + dz * dz; var R := a.r + b.r
			if d2 < R * R and d2 > 1e-6 and absf(a.pos.y - b.pos.y) < 1.6:
				var d := sqrt(d2); var p := (R - d) / 2; var nx := dx / d; var nz := dz / d
				a.pos.x -= nx * p; a.pos.z -= nz * p; b.pos.x += nx * p; b.pos.z += nz * p

# ---------------------------------------------------------------- events & economy
func start_event() -> void:
	var e: Dictionary = U.pick(Data.EVENTS)
	event = {"id": e.id, "def": e, "t": 45.0, "max": 45.0}
	UI.banner(e.emoji + " " + e.name, e.desc); Sound.play("event"); UI.toast(e.emoji + " رویداد ویژه: " + e.name + " — " + e.desc, "rare")
	_replate()

func _replate() -> void:
	for B in BELTS:
		for u in B.list:
			u.set_plate("shop")

func update_events(dt: float) -> void:
	if event == null:
		nextEventIn -= dt
		if nextEventIn <= 0:
			start_event()
	else:
		event.t -= dt
		if event.id == "golden" and player != null and randf() < dt * 40:
			var p := player.body.pos
			FX.one(p.x + U.rnd(-18, 18), p.y + U.rnd(10, 16), p.z + U.rnd(-18, 18), {"vx": 0, "vy": -6, "vz": 0, "life": 2.4, "size": 0.35, "color": "#ffd23f", "grav": 0, "drag": 0})
		if event.t <= 0:
			UI.toast("رویداد «" + event.def.name + "» تمام شد", ""); event = null; nextEventIn = U.rnd(110, 200); _replate()

func update_economy(dt: float) -> void:
	for o in owners:
		var m: float = o.income_mult()
		for s in o.slots:
			if s.unit != null and s.unit.state == "slotted":
				s.pending += s.unit.income * m * dt
		update_security(o, dt)
		if o.isPlayer and o.up.magnet > 0:
			o.magnetT -= dt
			if o.magnetT <= 0:
				o.magnetT = 5; collect_owner(o, true, null)

func apply_upgrade(o: Owner, key: String) -> void:
	var U_: Dictionary = Data.UPGRADES[key]
	o.up[key] = mini(U_.max, o.up[key] + 1); o.apply_cap()
	if key == "guardBot":
		W2.ensure_player_guard()
	if o.isPlayer:
		Sound.play("upgrade"); schedule_save()

## walk a unit to a slot along the navigation path
func set_transit(u: Unit, tp: Vector3) -> void:
	u.path = Nav.find_path(u.pos.x, u.pos.z, tp.x, tp.z)
	if u.path.is_empty():
		var mid := Nav.find_path(u.pos.x, u.pos.z, u.slot.base.entrancePos.x, u.slot.base.entrancePos.z)
		u.path = mid + [Vector2(u.slot.base.insidePos.x, u.slot.base.insidePos.z), Vector2(tp.x, tp.z)]
	var len := 0.0; var px := u.pos.x; var pz := u.pos.z
	for q in u.path:
		len += Vector2(q.x - px, q.y - pz).length(); px = q.x; pz = q.y
	u.pi = 0; u.tSpeed = clampf(len / 14, 6, 16); u.transitT = 0

# ---------------------------------------------------------------- reflect shield (secret code) + slap
func reflect_hit(t: Agent, why: String) -> void:
	var p := player.body.pos
	t.stun(3.2)
	if t.carrying != null and t.carrying.owner != t.owner:
		return_unit(t.carrying)
	var dir := Vector3(t.body.pos.x - p.x, 0, t.body.pos.z - p.z)
	if dir.length_squared() < 1e-4:
		dir = Vector3(sin(player.yaw), 0, cos(player.yaw))
	dir = dir.normalized()
	t.body.vel = Vector3(dir.x * 14.5, 8, dir.z * 14.5); t.fling = 0.7; t.slapCd = maxf(t.slapCd, 4)
	player.slapT = 0.32; player.yaw = atan2(dir.x, dir.z); CAM.shake = 0.3
	reflect_combos.append({"t": t, "n": 50, "k": 0.0}); Sound.play("slap")
	UI.toast("🛡️ " + ("نگهبانِ " if t.isGuard else "") + t.owner.name + " خواست " + why + " کند؛ ۵۰ تا سیلی خورد و ۱۰ متر پرت شد!", "good")
	UI.float_text(t.body.pos, "۵۰× سیلی!", "#ffd23f")

func update_reflect(dt: float) -> void:
	for i in range(reflect_combos.size() - 1, -1, -1):
		var c: Dictionary = reflect_combos[i]
		c.k += dt
		while c.k > 0.022 and c.n > 0:
			c.k -= 0.022; c.n -= 1
			var b: Vector3 = c.t.body.pos
			FX.burst(Vector3(b.x + U.rnd(-0.4, 0.4), b.y + U.rnd(1.2, 2.1), b.z + U.rnd(-0.4, 0.4)), {"count": 4, "color": ["#ffd23f", "#ffffff", "#ff4f8b"], "speed": 4, "life": 0.35})
			if c.n % 6 == 0 and player != null and U.dist2(player.body.pos, b) < 900:
				Sound.play("slap")
		if c.n <= 0:
			reflect_combos.remove_at(i)

func slap(a: Agent, stunTime: float = 2.2) -> String:
	if a.slapCd > 0 or a.stunned:
		return "cd"
	a.slapCd = Data.slap_cooldown(a.owner) if a.isPlayer else 8.0
	a.slapT = 0.32
	var p := a.body.pos; var fx := sin(a.yaw); var fz := cos(a.yaw)
	var best: Agent = null; var bd := 1e9
	for t in agents:
		if t == a:
			continue
		var dx: float = t.body.pos.x - p.x; var dz: float = t.body.pos.z - p.z; var d2: float = dx * dx + dz * dz
		if d2 > 2.9 * 2.9 or absf(t.body.pos.y - p.y) > 1.8:
			continue
		var d := maxf(sqrt(d2), 1.0)
		if d > 1.6 and (dx * fx + dz * fz) / d < 0.3:
			continue
		if d2 < bd:
			bd = d2; best = t
	var boss = Extras.boss
	if a.isPlayer and boss != null and U.dist2(boss.body.pos, p) < (bd if best != null else 3.8 * 3.8) and absf(boss.body.pos.y - p.y) < 3:
		a.yaw = atan2(boss.body.pos.x - p.x, boss.body.pos.z - p.z); Sound.play("slap"); stats.slaps += 1; Missions.event("slap"); boss.hit(1)
		return "hit"
	if best == null:
		if a.isPlayer:
			Sound.play("whoosh")
		return "miss"
	if a.isPlayer:
		stats.slaps += 1
		if a.owner.up.petDrag > 0:
			stunTime += 1
	if best.isPlayer and reflect:
		reflect_hit(a, "سیلی")
		return "reflected"
	a.yaw = atan2(best.body.pos.x - p.x, best.body.pos.z - p.z)
	best.stun(stunTime)
	var dir := Vector3(best.body.pos.x - p.x, 0, best.body.pos.z - p.z).normalized()
	best.body.vel = Vector3(dir.x * 8, 5, dir.z * 8)
	FX.burst(Vector3(best.body.pos.x, best.body.pos.y + 1.6, best.body.pos.z), {"count": 22, "color": ["#ffd23f", "#ffffff", "#ff4f8b"], "speed": 5, "life": 0.6})
	if player != null and U.dist2(player.body.pos, p) < 900:
		Sound.play("slap")
	if best.isPlayer:
		CAM.shake = 0.25; UI.toast("🥊 " + a.owner.name + " بهت سیلی زد! چند لحظه گیج شدی", "bad")
	if a.isPlayer:
		CAM.shake = 0.12; Missions.event("slap")
		var msg := "💥 " + best.owner.name + " گیج شد!"
		if best.carrying != null:
			var u := best.carrying
			return_unit(u)
			if u.owner == a.owner:
				var bounty := maxf(10, floorf(u.price * 0.05))
				a.owner.money += bounty; msg = "👋 دزد را زدی! «" + u.c.name + "» برگشت · جایزه " + U.fmt(bounty); stats.caught += 1; Missions.event("catch"); Sound.play("success")
			else:
				msg += " میمی که دزدیده بود برگشت سر جایش"
		UI.toast(msg, "good")
	elif best.carrying != null and best.carrying.owner != a.owner:
		return_unit(best.carrying)
	return "hit"

# ---------------------------------------------------------------- plots
func plot_price(o: Owner) -> float:
	var n := 0
	for b in o.bases:
		if b.world == 1:
			n += 1
	return roundf(5000 * pow(10, n - 1))

func claim_plot(o: Owner, b: BaseVis, silent: bool) -> bool:
	if b.owner != null or not b.forSale:
		return false
	o.add_base(b); b.build(o.color, o.name + " " + U.fa(o.bases.size()), false); o.apply_cap()
	if o.secT > 0:
		b.set_barrier(true)
	UI.map_dirty()
	if not silent:
		Sound.play("success"); UI.banner("🏠 پایگاه جدید خریدی!", "حالا " + U.fa(o.totalCap) + " جا برای میم داری")
		FX.burst(Vector3(b.insidePos.x, 3, b.insidePos.z), {"count": 50, "color": [o.color, "#ffd23f", "#ffffff"], "speed": 7, "up": true, "life": 1.2})
	return true

func buy_plot(o: Owner, b: BaseVis) -> bool:
	var price := plot_price(o)
	if o.money < price:
		Sound.play("error"); UI.toast("💸 برای این زمین " + U.fmt(price) + " سکه لازم داری", "bad")
		return false
	if not b.forSale or b.owner != null:
		return false
	o.money -= price; claim_plot(o, b, false); schedule_save(true)
	return true

func release_plot(o: Owner, b: BaseVis) -> void:
	var i := o.bases.find(b)
	if i <= 0:
		return
	o.bases.remove_at(i)
	var ns := []
	for s in o.slots:
		if s.base != b:
			ns.append(s)
	o.slots = ns
	for k in o.slots.size():
		o.slots[k].i = k
	b.owner = null; b.set_barrier(false); b.build("#9aa3ae", "زمین برای فروش", true); UI.map_dirty()

# ---------------------------------------------------------------- wardrobe
const LOOK_KEYS := ["skin", "shirt", "pants", "shoes", "hair", "hairC", "accent", "hat", "acc"]
func clean_look(l) -> Dictionary:
	var out := {"acc": "none"}
	out.merge(Data.LOOKS[0], true)
	if not (l is Dictionary):
		return out
	var hair_ids := []
	for it in Data.WEAR.hair.items:
		hair_ids.append(it[0])
	hair_ids.append("long")
	var acc_ids := []
	for it in Data.WEAR.acc.items:
		acc_ids.append(it[0])
	for k in LOOK_KEYS:
		if not l.has(k) or not (l[k] is String):
			continue
		var v: String = l[k]
		var ok := false
		if k == "hair":
			ok = hair_ids.has(v)
		elif k == "acc":
			ok = acc_ids.has(v)
		else:
			ok = v.length() == 7 and v.begins_with("#") and v.substr(1).is_valid_hex_number()
		if ok:
			out[k] = v
	return out

func set_player_look(lk: Dictionary) -> void:
	var a := player
	if a == null:
		return
	var old := a.av
	var av := Avatar.build(lk)
	av.root.position = old.root.position; av.root.rotation = old.root.rotation; av.root.visible = old.root.visible
	if Extras.board != null and Extras.board.get_parent() == old.root:
		old.root.remove_child(Extras.board); av.root.add_child(Extras.board)
	agents_node.remove_child(old.root); old.root.queue_free()
	agents_node.add_child(av.root); a.av = av

func wear_owned(cat: String, id: String, price: float) -> bool:
	if price == 0 or wear.has(cat + ":" + id):
		return true
	var C: Dictionary = Data.WEAR[cat]
	return C.has("key") and look.get(C.key, "") == id and cat != "set"

func wearing_set(lk: Dictionary) -> bool:
	for k in lk.keys():
		if look.get(k, "") != lk[k]:
			return false
	return true

func wear_buy(key: String) -> void:
	var parts := key.split(":")
	var cat := parts[0]; var id := parts[1]
	var it = null
	for x in Data.wear_items(cat):
		if x[0] == id:
			it = x
	var o := player.owner
	if it == null:
		return
	var price: float = it[2]; var owned := wear_owned(cat, id, price)
	if not owned:
		if o.money < price:
			Sound.play("error"); UI.toast("💸 پولت برای «" + it[1] + "» کافی نیست (" + U.fmt(price) + ")", "bad")
			return
		o.money -= price; wear[key] = true
		if cat == "set":
			for k in it[3].keys():
				var c := Data.wear_cat(k)
				if c != "":
					wear[c + ":" + it[3][k]] = true
	if cat == "set":
		look.merge(it[3], true)
	else:
		look[Data.WEAR[cat].key] = id
	set_player_look(look); Sound.play("click" if owned else "success")
	FX.burst(Vector3(player.body.pos.x, player.body.pos.y + 1.2, player.body.pos.z), {"count": 30, "color": ["#b061ff", "#ff4f8b", "#ffffff", "#ffd23f"], "speed": 4, "up": true, "life": 0.9})
	UI.toast(("👕 پوشیدی: " + it[1]) if owned else ("🤖 ربات لباس‌فروش «" + it[1] + "» را تنت کرد!"), "good"); UI.open_wardrobe(true); schedule_save()

func rebirth() -> bool:
	var o := player.owner; var cost := Data.rebirth_cost(o.rebirths)
	if o.money < cost or player.carrying != null:
		return false
	for s in o.slots:
		if s.unit != null:
			if s.unit.state == "carried":
				var c = s.unit.carrier
				if c != null:
					c.carrying = null
				s.unit.carrier = null
			s.unit.dispose(true); s.unit = null
		s.pending = 0.0
	o.rebirths += 1; o.money = Data.START_MONEY * (1 + o.rebirths * 2)
	for k in Data.UP_KEYS:
		if Data.up_shop(k) == 1:
			o.up[k] = 0
	o.apply_cap()
	Sound.play("rebirth"); UI.banner("♻️ تولد دوباره!", "درآمد دائمی ×" + U.fa("%.1f" % (1 + 0.5 * o.rebirths))); schedule_save(true)
	return true

# ---------------------------------------------------------------- save hooks
func schedule_save(now: bool = false) -> void:
	if now:
		SaveSys.do_save()
		return
	saveQueued = true

# ---------------------------------------------------------------- world setup
func seed_rivals(from: int = 0) -> void:
	for o in owners:
		if o.isPlayer or o.id < from:
			continue
		if o.base.world == 2:
			W2.seed_owner(o)
			continue
		if o.base.world == 3:
			W3.seed_owner(o)
			continue
		if o.elite > 0:
			EXW.seed_owner(o)
			continue
		o.money = U.rndi(200, 1500); o.up.cap = U.rndi(0, 2)
		var n := U.rndi(3, mini(o.cap, 5))
		for i in n:
			var r := 3 if randf() < 0.08 else (2 if randf() < 0.25 else (1 if randf() < 0.5 else 0))
			var u := Unit.new(Data.pick_char(1, r), 1 if randf() < 0.1 else 0)
			u.owner = o; u.slot = o.slots[i]; o.slots[i].unit = u; u.state = "slotted"; u.place_at_slot(); u.set_plate("base")
	for o in owners:
		if not o.isPlayer and o.id >= from:
			House.seed_rival(o)

func init_game(save) -> void:
	owners = []
	var plots := [Data.PLAYER_PLOT] + Data.NPC_PLOTS
	for i in plots.size():
		var o := Owner.new(i, "قهرمان" if i == 0 else Data.NPC_NAMES[i - 1], Data.OWNER_COLORS[i], i == 0, World.bases[plots[i]])
		owners.append(o)
	for o in owners:
		o.base.build(o.color, o.name, false)
	for pi_ in Data.SALE_PLOTS:
		World.bases[pi_].build("#9aa3ae", "زمین برای فروش", true)
	Phys.constraints.append(barrier_constraint)
	Nav.build(1)
	player = Agent.new(owners[0], Data.LOOKS[0], true)
	for i in range(1, owners.size()):
		Agent.new(owners[i], Data.LOOKS[i], false)
	shopkeeper = Avatar.build(Data.SHOPKEEPER_LOOK)
	shopkeeper.root.position = Vector3(World.shopPos.x - 6.1, 0.1, 0); shopkeeper.root.rotation.y = PI / 2; agents_node.add_child(shopkeeper.root)
	inited = true

# ---------------------------------------------------------------- simulation step
func simulate(dt: float) -> void:
	time += dt
	if playing:
		playTime += dt; graceT -= dt
	for a in agents:
		if a.brain != null:
			a.brain.update(dt)
	acc += dt
	var n := 0
	while acc >= FIXED and n < 12:
		for a in agents:
			a.physics(FIXED)
		separate_agents()
		acc -= FIXED; n += 1
	if n >= 12:
		acc = 0
	update_belt(dt); update_economy(dt); update_steals(dt); update_events(dt)
	for a in agents:
		a.visual(dt, time)
	for u in units.duplicate():
		u.update(dt, time, cam_pos)
	World.update(dt, time)
	if Chars.mut_mats.has(3):
		var mm: StandardMaterial3D = Chars.mut_mats[3]
		mm.albedo_color = Color.from_hsv(fmod(time * 0.15, 1.0), 0.9, 0.6 + 0.3)
		mm.emission = Color.from_hsv(fmod(time * 0.15 + 0.5, 1.0), 1.0, 0.6)
	if shopkeeper != null:
		shopkeeper.animate(dt, {"speed": 0, "grounded": true, "t": time, "turn": 0})
		Shop.update(dt)
	Fusion.update(dt); Day.update(dt); Hazards.update(dt); Portal.update(dt, time); update_reflect(dt); Extras.update(dt); Portal3.update(dt, time); EXW.update(dt, time); W3.update_lightning(dt); House.update(dt); Extras.update_ufo(dt); Extras.update_fireworks(dt)
	FX.update(dt)
