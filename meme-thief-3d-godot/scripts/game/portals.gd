## Portals between worlds, lava hazards (burning, meteors).
class_name Portal

static var p1 = null
static var p2 = null
static var cd := 0.0
static var appearT := 0.0
static var checkT := 0.0

static func build1() -> void:
	p1 = W2.make_portal(W2.PORTAL1, ["#ff5a1f", "#b061ff"], "🌋 پرتال سیاره‌ی گدازه", "swirl"); p1.g.visible = false

static func build2() -> void:
	p2 = W2.make_portal(W2.PORTAL2, ["#29d9ff", "#3df2b0"], "🌍 برگشت به میدان میم‌ها", "swirl3")
	for s in [-1, 1]:
		Phys.add_box_c(W2.PORTAL2.x, 3.8, s * 3.9, 1.1, 7.6, 1.1)

static func show(anim: bool) -> void:
	if p1 == null:
		return
	if not p1.g.visible:
		for s in [-1, 1]:
			Phys.add_box_c(W2.PORTAL1.x, 3.8, W2.PORTAL1.z + s * 3.9, 1.1, 7.6, 1.1)
	p1.g.visible = true; appearT = 2.5 if anim else 0.0; UI.map_dirty()

static func unlock() -> void:
	if Game.portalUnlocked:
		return
	Game.portalUnlocked = true; W2.build(); Game.seed_rivals(Game.owners.size() - 5); show(true)
	Sound.play("rebirth"); UI.banner("🌀 پرتال باز شد!", "ثروتت به ۵۵۰ میلیون رسید. برو کنار جدول برترها و وارد سیاره‌ی گدازه شو")
	UI.toast("🌋 یک پرتال کنار جدول برترها ظاهر شد. آنجا خیلی سخت‌تر است!", "rare"); Game.schedule_save(true)

static func travel(to: int, from: Vector3) -> void:
	var a := Game.player
	if a.carrying != null:
		Sound.play("error"); UI.toast("🌀 نمی‌توانی میم دزدی را از پرتال رد کنی", "bad")
		var dir := Vector3(a.body.pos.x - from.x, 0, a.body.pos.z - from.z)
		if dir.length_squared() < 1e-4:
			dir = Vector3(1, 0, 0)
		dir = dir.normalized(); a.body.vel = Vector3(dir.x * 8, 4, dir.z * 8); a.fling = 0.4; cd = 1
		return
	var dest: Vector3
	match to:
		2: dest = Vector3(W2.PORTAL2.x + 6, 0.2, W2.PORTAL2.z)
		3: dest = Vector3(W3.arrival.x, 0.2, W3.arrival.z)
		4, 5: dest = Vector3(EXW.D[to].arrival.x, 0.2, EXW.D[to].arrival.z)
		_: dest = Vector3(W2.PORTAL1.x - 6, 0.2, W2.PORTAL1.z)
	a.body.pos = dest; a.body.vel = Vector3.ZERO; a.renderY = dest.y; a.yaw = PI / 2 if to == 2 else -PI / 2; a.lastSafe = null
	Game.CAM.yaw = a.yaw + PI; Game.cam_pivot = Vector3(dest.x, dest.y + 1.65, dest.z); Game.CAM.cur = S.zoom; cd = 2.5
	UI.flash(); Sound.play("portal")
	var cols: Array
	match to:
		2: cols = ["#ff5a1f", "#ffd23f"]
		3: cols = ["#ffffff", "#9fe8ff"]
		4, 5: cols = EXW.D[to].portalColors
		_: cols = ["#29d9ff", "#3df2b0"]
	FX.burst(Vector3(dest.x, 1.5, dest.z), {"count": 40, "color": cols, "speed": 6, "life": 0.9})
	if to == 3:
		W3.arrive()
	elif to >= 4:
		EXW.arrive(to)
	elif to == 2:
		var o := a.owner
		if W2.playerPlot != null and W2.playerPlot.owner == null:
			Game.claim_plot(o, W2.playerPlot, true); W2.ensure_player_guard(); UI.banner("🌋 به سیاره‌ی گدازه خوش آمدی!", "یک پایگاه رایگان اینجا گرفتی · گدازه، نگهبان‌ها و شهاب‌سنگ‌ها مراقبت باش"); Sound.play("success"); Game.schedule_save(true)
		else:
			UI.toast("🌋 سیاره‌ی گدازه — میم‌های اینجا ۲۰۰ برابر می‌ارزند", "rare")
	else:
		UI.toast("🌍 برگشتی به میدان میم‌ها", "good")
	UI.map_dirty()

static func update(dt: float, t: float) -> void:
	if p1 != null and p1.g.visible:
		W2.anim_portal(p1, dt, t)
		if appearT > 0:
			appearT -= dt
			var k: float = maxf(0.01, 1 - maxf(0.0, appearT) / 2.5)
			p1.g.scale = Vector3(k, k, k)
			if randf() < 0.5:
				FX.burst(Vector3(W2.PORTAL1.x, 3.8, W2.PORTAL1.z), {"count": 4, "color": ["#ff5a1f", "#b061ff"], "speed": 6, "life": 0.6})
	if p2 != null:
		W2.anim_portal(p2, dt, t)
	W2.update(dt, t)
	if not Game.playing or Game.player == null:
		return
	checkT -= dt
	if checkT <= 0:
		checkT = 1
		var nw := Game.player.owner.net_worth()
		if not Game.portalUnlocked and nw >= Data.PORTAL_WORTH:
			unlock()
		elif Game.portalUnlocked and not Game.portal3Unlocked and nw >= Data.PORTAL3_WORTH:
			Portal3.unlock()
	cd -= dt
	if cd > 0:
		return
	var p := Game.player.body.pos
	if Game.portalUnlocked and p1 != null and p1.g.visible and appearT <= 0 and U.dist2(p, W2.PORTAL1) < 2.2 * 2.2 and p.y < 3:
		travel(2, W2.PORTAL1)
	elif p2 != null and U.dist2(p, W2.PORTAL2) < 2.2 * 2.2 and p.y < 3:
		travel(1, W2.PORTAL2)
	elif Portal3.p3 != null and Portal3.p3.g.visible and Portal3.appearT <= 0 and U.dist2(p, W3.PORTAL3) < 2.2 * 2.2 and p.y < 3:
		travel(3, W3.PORTAL3)
	elif Portal3.p4 != null and U.dist2(p, W3.PORTAL4) < 2.2 * 2.2 and p.y < 3:
		travel(1, W3.PORTAL4)

## is the player (or anyone) near any portal?
static func near_any(p: Vector3) -> bool:
	if Game.portalUnlocked and U.dist2(p, W2.PORTAL1) < 49:
		return true
	if W2.built and U.dist2(p, W2.PORTAL2) < 49:
		return true
	if Portal3.p3 != null and Portal3.p3.g.visible and U.dist2(p, W3.PORTAL3) < 49:
		return true
	if W3.built and U.dist2(p, W3.PORTAL4) < 49:
		return true
	for n in [4, 5]:
		var D: Dictionary = EXW.D[n]
		if (D.pIn != null and D.pIn.g.visible and U.dist2(p, D.entry) < 49) or (D.built and U.dist2(p, D.back) < 49):
			return true
	return false

