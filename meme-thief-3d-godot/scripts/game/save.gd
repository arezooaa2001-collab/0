## Save / load (user://memeThief3D.save.json) and the "progress code" export.
class_name SaveSys

const SAVE_PATH := "user://memeThief3D.save.json"

static func serialize() -> Dictionary:
	var owners := []
	for o in Game.owners:
		var slots := []
		var vault := []
		for s in o.slots:
			if s.vault:
				if s.unit != null:
					vault.append([s.base.index, s.li - Data.MAX_SLOTS, s.unit.c.id, s.unit.mut, floorf(s.pending), s.unit.lvl])
			else:
				slots.append([s.unit.c.id, s.unit.mut, floorf(s.pending), s.unit.lvl] if s.unit != null else null)
		var bases := []
		for b in o.bases:
			bases.append(b.index)
		owners.append({"money": floorf(o.money), "rebirths": o.rebirths, "up": o.up.duplicate(), "secCd": floorf(o.secCd), "bases": bases, "slots": slots, "vault": vault, "dr": o.drills})
	var doors := []
	for b in World.bases:
		if b.door != null:
			doors.append([b.index, 1 if b.door.state == "broken" else 0])
	return {"v": 1, "t": Time.get_unix_time_from_system() * 1000.0, "name": Game.name_, "portal": Game.portalUnlocked, "portal3": Game.portal3Unlocked, "portal4": Game.portal4Unlocked, "portal5": Game.portal5Unlocked,
		"ach": Game.ach.keys(), "sc": Game.secretUsed, "rf": Game.reflect, "playTime": floorf(Game.playTime), "stats": Game.stats.duplicate(), "discovered": Game.discovered.keys(), "look": Game.look, "wear": Game.wear.keys(), "tutorialDone": Game.tutorialDone, "daily": Game.daily,
		"nextEventIn": floorf(Game.nextEventIn), "dayT": roundf(Day.t * 1000) / 1000, "missions": Missions.list, "owners": owners, "doors": doors}

static func do_save() -> void:
	if Game.owners.is_empty():
		return
	if Shop.busy != null:
		Shop.finish()
	if Fusion.busy != null:
		Fusion.finish()
	Game.saveQueued = false; Game.lastSave = Game.time
	var f := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(serialize()))

static func load_save():
	if not FileAccess.file_exists(SAVE_PATH):
		return null
	var f := FileAccess.open(SAVE_PATH, FileAccess.READ)
	if f == null:
		return null
	var raw := f.get_as_text()
	var s = parse(raw)
	if s == null:
		push_warning("save corrupt, backing up")
		var b := FileAccess.open(SAVE_PATH + ".bak", FileAccess.WRITE)
		if b:
			b.store_string(raw)
		DirAccess.remove_absolute(SAVE_PATH)
	return s

static func parse(raw: String):
	var s = JSON.parse_string(raw)
	if s is Dictionary and s.get("v") == 1 and s.get("owners") is Array and [6, 8, 13, 17, 21, 25].has(s.owners.size()):
		return s
	return null

static func wipe() -> void:
	if FileAccess.file_exists(SAVE_PATH):
		DirAccess.remove_absolute(SAVE_PATH)

## returns the save timestamp (ms)
static func apply_save(s: Dictionary) -> float:
	if s.get("name") is String:
		Game.name_ = s.name.substr(0, 14)
	Day.t = U.num(s.get("dayT"), 0.3, 0, 1); Missions.load_list(s.get("missions"))
	Game.portalUnlocked = bool(s.get("portal", false)); Game.portal3Unlocked = bool(s.get("portal3", false)); Game.portal4Unlocked = bool(s.get("portal4", false)); Game.portal5Unlocked = bool(s.get("portal5", false))
	Game.secretUsed = bool(s.get("sc", false)); Game.reflect = bool(s.get("rf", false))
	Game.playTime = U.num(s.get("playTime"), 0); Game.tutorialDone = bool(s.get("tutorialDone", false)); Game.nextEventIn = U.num(s.get("nextEventIn"), 150, 20, 400)
	if s.get("stats") is Dictionary:
		for k in Game.stats.keys():
			Game.stats[k] = U.num(s.stats.get(k), 0)
	if s.get("ach") is Array:
		for id in s.ach:
			for a in Extras.ACHIEVEMENTS:
				if a.id == id:
					Game.ach[id] = true
	if s.get("discovered") is Array:
		for id in s.discovered:
			if Data.CHAR_BY_ID.has(id):
				Game.discovered[id] = true
	Game.wear.clear()
	if s.get("wear") is Array:
		for k in s.wear:
			if k is String and k.length() < 40:
				Game.wear[k] = true
	Game.look = Game.clean_look(s.get("look"))
	if Game.player != null:
		Game.set_player_look(Game.look)
	if s.get("daily") is Dictionary:
		Game.daily = {"last": str(s.daily.get("last", "")), "streak": int(U.num(s.daily.get("streak"), 0, 0, 7))}
	var so_list: Array = s.owners
	for i in so_list.size():
		var so = so_list[i]
		if i >= Game.owners.size() or not (so is Dictionary):
			continue
		var o: Owner = Game.owners[i]
		o.money = U.num(so.get("money"), Data.START_MONEY); o.rebirths = int(U.num(so.get("rebirths"), 0, 0, 50)); o.secCd = U.num(so.get("secCd"), 0, 0, 120)
		if so.get("up") is Dictionary:
			for k in Data.UP_KEYS:
				o.up[k] = int(U.num(so.up.get(k), 0, 0, Data.UPGRADES[k].max))
		if o.isPlayer and so.get("bases") is Array:
			for bi in so.bases.slice(1):
				var idx := int(U.num(bi, -1, -1, 1000))
				if idx >= 0 and idx < World.bases.size():
					var b: BaseVis = World.bases[idx]
					if b.owner == null and b.forSale:
						Game.claim_plot(o, b, true)
		var NS := []
		for x in o.slots:
			if not x.vault:
				NS.append(x)
		if so.get("slots") is Array:
			var sl: Array = so.slots
			for si in mini(sl.size(), NS.size()):
				var e = sl[si]
				if e is Array and e.size() >= 3 and NS[si].li < o.cap:
					_put(o, NS[si], e[0], e[1], e[2], e[3] if e.size() > 3 else 0)
		if so.get("vault") is Array:
			for e in so.vault:
				if e is Array and e.size() >= 5:
					var target = null
					for x in o.slots:
						if x.vault and x.base.index == int(e[0]) and x.li == Data.MAX_SLOTS + int(e[1]):
							target = x
					_put(o, target, e[2], e[3], e[4], e[5] if e.size() > 5 else 0)
		o.drills = int(U.num(so.get("dr"), 0, 0, 99))
	if s.get("doors") is Array:
		for e in s.doors:
			if not (e is Array) or e.size() < 2:
				continue
			var idx := int(U.num(e[0], -1, -1, 1000))
			if idx < 0 or idx >= World.bases.size():
				continue
			var b: BaseVis = World.bases[idx]
			House.install(b, true)
			if int(e[1]) == 1:
				House.smash(b); b.door.repairT = 30.0 if (b.owner != null and not b.owner.isPlayer) else 0.0
	if Game.player != null:
		Game.player.owner.name = Game.name_
	return U.num(s.get("t"), Time.get_unix_time_from_system() * 1000.0)

static func _put(o: Owner, sl, id, m, pend, lvl) -> void:
	if sl == null or sl.unit != null or not (id is String) or not Data.CHAR_BY_ID.has(id):
		return
	var mut := int(U.num(m, 0, 0, Data.MUTATIONS.size() - 1))
	var u := Unit.new(Data.CHAR_BY_ID[id], mut)
	u.lvl = int(U.num(lvl, 0, 0, 5)); u.recalc(); u.owner = o; u.slot = sl; sl.unit = u; sl.pending = U.num(pend, 0); u.state = "slotted"; u.place_at_slot(); u.set_plate("base")

## progress code (base64 of the save json)
static func make_code() -> String:
	return "MEME1:" + Marshalls.utf8_to_base64(JSON.stringify(serialize()))

static func read_code(code: String):
	code = code.strip_edges().replace(" ", "").replace("\n", "")
	if not code.begins_with("MEME1:"):
		return null
	var raw := Marshalls.base64_to_utf8(code.substr(6))
	if raw == "":
		return null
	return parse(raw)

## replace the whole world state with a save (progress code import)
static func reset_world_to(s: Dictionary) -> void:
	for a in Game.agents:
		if a.carrying != null:
			var u := a.carrying
			a.carrying = null; u.carrier = null
		a.stunT = 0
		if a.brain != null:
			a.brain.set_state("idle")
	if Shop.busy != null:
		Shop.busy = null
		if Shop.item != null:
			Shop.item.visible = false
	for o in Game.owners:
		for sl in o.slots:
			if sl.unit != null:
				sl.unit.dispose(false); sl.unit = null
			sl.pending = 0.0
		o.money = Data.START_MONEY; o.rebirths = 0
		for k in Data.UP_KEYS:
			o.up[k] = 0
		o.secT = 0; o.secCd = 0
		for b in o.bases:
			b.set_barrier(false)
		for b in o.bases.slice(1):
			Game.release_plot(o, b)
	Game.alerts.clear(); Game.discovered.clear(); Game.ach.clear()
	for k in Game.stats.keys():
		Game.stats[k] = 0
	Game.tutorialDone = false; Game.daily = {"last": "", "streak": 0}
	House.reset_all()
	if s.get("portal", false) or s.get("portal3", false) or s.get("portal4", false) or s.get("portal5", false):
		W2.build()
	if s.get("portal3", false) or s.get("portal4", false) or s.get("portal5", false):
		W3.build()
	if s.get("portal4", false) or s.get("portal5", false):
		EXW.build(4)
	if s.get("portal5", false):
		EXW.build(5)
	apply_save(s); Missions.ensure()
	if Game.portalUnlocked:
		W2.build(); Portal.show(false)
	if Game.portal3Unlocked:
		W3.build(); Portal3.show(false)
	if Game.portal4Unlocked:
		EXW.build(4); EXW.show(4, false)
	if Game.portal5Unlocked:
		EXW.build(5); EXW.show(5, false)
	W2.ensure_player_guard()
	Game.seed_rivals(s.owners.size())
	for o in Game.owners:
		o.apply_cap()
	for a in Game.agents:
		a.respawn()
	Game.main.set_player_name(Game.name_)
	UI.menu_info()
	if Game.tutorialDone:
		Tutorial.step = -1; Tutorial.show()
	elif Game.playing and Tutorial.step < 0:
		Tutorial.start()
	UI.shown_money = Game.owners[0].money; do_save()
