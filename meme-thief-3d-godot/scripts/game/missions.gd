## Three active missions at a time; reward scales with the player's income.
class_name Missions

static var list: Array = []

static func inc() -> float:
	return Game.player.owner.income_per_sec() if Game.player != null else 0.0

static func make() -> Dictionary:
	var o: Owner = Game.player.owner if Game.player != null else null
	var active := []
	for m in list:
		active.append(m.id)
	var defs := []
	for d in Data.MISSION_DEFS:
		if not active.has(d.id) and (not d.has("needs") or (o != null and o.up[d.needs] > 0)):
			defs.append(d)
	var d: Dictionary = U.pick(defs if defs.size() > 0 else Data.MISSION_DEFS)
	var income := inc(); var reb: float = (1 + o.rebirths) if o != null else 1.0
	var n: float; var diff: float
	if d.n is String:
		n = maxf(300, roundf(income * 90 / 50) * 50); diff = 1.5
	else:
		var i := U.rndi(0, d.n.size() - 1)
		n = d.n[i]; diff = 1 + i * 0.8
	var reward := roundf((maxf(250, income * 40 * diff) + 120 * diff) * reb)
	return {"id": d.id, "n": n, "prog": 0.0, "reward": reward, "done": false}

static func ensure() -> void:
	while list.size() < 3:
		list.append(make())

static func event(id: String, amt: float = 1.0) -> void:
	if not Game.playing:
		return
	for m in list:
		if m.id == id and not m.done:
			m.prog = minf(m.n, m.prog + amt)
			if m.prog >= m.n:
				m.done = true; Sound.play("mission"); UI.toast("📜 ماموریت انجام شد: " + text(m) + " — جایزه‌ات را از دکمه‌ی 📜 بگیر", "rare")

static func def(m: Dictionary) -> Dictionary:
	for d in Data.MISSION_DEFS:
		if d.id == m.id:
			return d
	return Data.MISSION_DEFS[0]

static func text(m: Dictionary) -> String:
	return def(m).t.call(m.n)

static func claim(i: int) -> void:
	if i < 0 or i >= list.size():
		return
	var m: Dictionary = list[i]
	if not m.done:
		return
	Game.player.owner.money += m.reward; Sound.play("success"); UI.float_text(Game.player.body.pos, "+" + U.fmt(m.reward), "#ffd23f")
	UI.toast("🎉 جایزه‌ی ماموریت: " + U.fmt(m.reward) + " سکه", "good")
	list[i] = make(); Game.schedule_save(true)

static func load_list(arr) -> void:
	list = []
	if arr is Array:
		for m in arr.slice(0, 3):
			if not (m is Dictionary) or not m.has("id"):
				continue
			var ok := false
			for d in Data.MISSION_DEFS:
				if d.id == m.id:
					ok = true
			if not ok:
				continue
			var n := maxf(1.0, floorf(U.num(m.get("n"), 1, 1, 1e15)))
			list.append({"id": m.id, "n": n, "prog": floorf(U.num(m.get("prog"), 0, 0, n)), "reward": floorf(U.num(m.get("reward"), 250, 0, 1e18)), "done": bool(m.get("done", false))})

static func ready() -> bool:
	for m in list:
		if m.done:
			return true
	return false
