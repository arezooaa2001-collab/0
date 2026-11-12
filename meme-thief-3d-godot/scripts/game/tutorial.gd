## Interactive tutorial: seven guided steps with a floating arrow.
class_name Tutorial

static var step := -1
static var moveAcc := 0.0
static var arrow: Node3D = null
static var rotAccum := 0.0
static var steps: Array = [
	{"ev": "move", "t": "با جوی‌استیک سمت چپ (یا کلیدهای W A S D) کمی راه برو"},
	{"ev": "camera", "t": "سمت راست صفحه را بکش (یا با موس بکش) تا دوربین بچرخد"},
	{"ev": "buy", "t": "برو کنار نوار نقاله‌ی وسط و با دکمه‌ی «خرید» (کلید E) یک میم ارزان بخر", "target": "belt"},
	{"ev": "slotted", "t": "میمت دارد خودش به پایگاهت می‌رود… صبر کن تا روی سکو بنشیند", "target": "inside"},
	{"ev": "collect", "t": "میم‌ها پول می‌سازند! روی سکوی سبز «جمع‌آوری» در پایگاهت برو", "target": "collect"},
	{"ev": "security", "t": "دکمه‌ی «امنیت» (کلید Q) را بزن تا سپر لیزری جلوی در پایگاهت روشن شود"},
	{"ev": "grab", "t": "حالا وارد پایگاه یک حریف شو، کنار میمش برو و «دزدی» (کلید F) را بزن", "target": "rival"},
	{"ev": "stolen", "t": "فرار کن! میم را به پایگاه خودت برسان. اگر صاحبش لمست کند، میم برمی‌گردد", "target": "inside"},
]

static func target_pos(kind: String):
	var o := Game.player.owner
	match kind:
		"belt":
			var b = null; var d := 1e9
			for u in Game.BELTS[0].list:
				var dd := U.dist2(u.pos, Game.player.body.pos)
				if Game.belt_price(u) <= o.money and dd < d:
					d = dd; b = u.pos
			return b
		"inside": return o.base.insidePos
		"collect": return o.base.collectPos
		"rival":
			var p := Game.player.body.pos; var b = null; var d := 1e9
			for ow in Game.owners:
				if not ow.isPlayer and not ow.base.barrierActive:
					var dd := U.dist2(ow.base.entrancePos, p)
					if dd < d:
						d = dd; b = ow.base.insidePos
			return b
	return null

static func start(force: bool = false) -> void:
	if Game.tutorialDone and not force:
		return
	step = 0; moveAcc = 0; rotAccum = 0; show()
	if arrow == null:
		arrow = Node3D.new()
		var m := Geo.mat("#ffd23f", {"e": "#ffb000", "ei": 1.2})
		var c := Geo.mesh(Geo.G("cone"), m, 0, 0, 0, 0.7, 1.2, 0.7, arrow); Geo.rot(c, PI)
		Geo.mesh(Geo.G("cyl"), m, 0, 1.0, 0, 0.25, 1.2, 0.25, arrow)
		World.add_child(arrow)

static func show() -> void:
	if step < 0 or step >= steps.size():
		UI.tutorial_box(false, "", "")
		if arrow != null:
			arrow.visible = false
		return
	UI.tutorial_box(true, U.fa(step + 1) + "/" + U.fa(steps.size()), steps[step].t)

static func event(name: String) -> void:
	if step < 0:
		return
	var s: Dictionary = steps[step]
	if s.ev != name:
		return
	step += 1; Sound.play("upgrade")
	if step >= steps.size():
		finish()
	else:
		show()

static func moved(dt: float) -> void:
	if step == 0:
		moveAcc += dt
		if moveAcc > 1.2:
			event("move")

static func finish() -> void:
	step = -1; show()
	var first := not Game.tutorialDone
	Game.tutorialDone = true
	if first:
		Game.player.owner.money += 300; UI.banner("آموزش تمام شد! 🎓", "جایزه: ۳۰۰ سکه — حالا حریف‌ها هم دزدی می‌کنند، مواظب باش!")
	else:
		UI.toast("🎓 آموزش تمام شد", "good")
	Game.graceT = maxf(Game.graceT, 45); Game.schedule_save(true)

static func skip() -> void:
	UI.confirm("رد کردن آموزش", "مطمئنی؟ می‌توانی بعداً از منوی توقف دوباره ببینی‌اش.", func():
		step = -1; show(); Game.tutorialDone = true; Game.graceT = maxf(Game.graceT, 60); Game.schedule_save(true))

static func update(dt: float, t: float) -> void:
	if step < 0 or arrow == null:
		return
	var s: Dictionary = steps[step]
	if s.ev == "stolen" and Game.player.carrying == null:
		step -= 1; show()
	if s.ev == "security" and Game.player.owner.secT > 0:
		event("security")
		return
	var tg = target_pos(s.target) if s.has("target") else null
	arrow.visible = tg != null
	if tg != null:
		arrow.position = Vector3(tg.x, tg.y + 4.2 + sin(t * 4) * 0.35, tg.z); arrow.rotation.y = t * 2
