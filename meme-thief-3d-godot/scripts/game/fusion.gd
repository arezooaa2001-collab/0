## Fusion machine: three identical memes in, one upgraded mutation out.
class_name Fusion

static var busy = null

static func groups(o: Owner) -> Dictionary:
	var g := {}
	for s in o.slots:
		var u: Unit = s.unit
		if u == null or u.state != "slotted" or u.mut >= 3:
			continue
		var k: String = u.c.id + ":" + str(u.mut)
		if not g.has(k):
			g[k] = []
		g[k].append(u)
	return g

static func fuse(key: String) -> void:
	var o := Game.player.owner
	var list = groups(o).get(key)
	if busy != null:
		Sound.play("error"); UI.toast("⚗️ دستگاه هنوز مشغول ترکیب قبلی است", "bad")
		return
	if list == null or list.size() < 3:
		Sound.play("error"); UI.toast("⚗️ برای ترکیب ۳ میم کاملاً یکسان لازم است", "bad")
		return
	var c: Dictionary = list[0].c; var mut: int = list[0].mut
	for u in list.slice(0, 3):
		o.money += floorf(u.slot.pending); u.slot.pending = 0.0; u.slot.unit = null; u.dispose(true)
	busy = {"c": c, "mut": mut + 1, "t": 0.0}; World.fusion.boost = 1.0; Sound.play("fuse")
	UI.close_panel(); UI.toast("⚗️ دستگاه دارد سه «" + c.name + "» را ترکیب می‌کند…", "")

static func update(dt: float) -> void:
	if busy == null:
		return
	busy.t += dt; World.fusion.boost = 1.0
	var P0 := World.fusionPos
	if randf() < dt * 30:
		var a := randf() * TAU
		FX.one(P0.x + cos(a) * 2.1, 2.6, P0.z + sin(a) * 2.1, {"vx": -cos(a) * 2.4, "vy": -0.2, "vz": -sin(a) * 2.4, "life": 0.8, "size": 0.35, "color": U.pick(["#ff6fcf", "#7af7ff", "#ffd23f"]), "grav": 0, "drag": 0})
	if busy.t > 2.4:
		finish()

static func finish() -> void:
	var b = busy
	if b == null:
		return
	busy = null
	var o := Game.player.owner; var slot = o.free_slot(); var P0 := World.fusionPos
	var u := Unit.new(b.c, b.mut)
	if slot == null:
		o.money += u.price; u.dispose(false); UI.toast("⚗️ جای خالی نبود؛ ارزش میم به پولت اضافه شد", "")
		return
	u.owner = o; u.slot = slot; slot.unit = u; slot.pending = 0.0; u.state = "transit"; u.pos = Vector3(P0.x, 0.05, P0.z + 3); u.set_plate("base")
	Game.set_transit(u, slot.base.slotPos[slot.li])
	FX.burst(Vector3(P0.x, 2.2, P0.z), {"count": 60, "color": [Data.MUTATIONS[b.mut].color, "#ffffff", "#ffd23f"], "speed": 8, "up": true, "life": 1.3})
	Sound.play("success"); UI.banner("⚗️ ترکیب موفق!", Data.MUTATIONS[b.mut].name + " · " + b.c.name + " — درآمد ×" + U.fa(int(Data.MUTATIONS[b.mut].mult)))
	Game.discover(b.c.id); Missions.event("fuse"); Game.stats.fuses += 1; Game.schedule_save(true)
