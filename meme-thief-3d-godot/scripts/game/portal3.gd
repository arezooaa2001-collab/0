## The gateway to the sky islands (on the lava planet).
class_name Portal3

## the gateway to the sky islands (on the lava planet)
static var p3 = null
static var p4 = null
static var appearT := 0.0
static func build3() -> void:
	if p3 != null or not W2.built:
		return
	p3 = W2.make_portal(W3.PORTAL3, ["#9fe8ff", "#ff9de2"], "🏝️ پرتال جزیره‌های آسمانی", "swirl4"); p3.g.visible = false
static func show(anim: bool) -> void:
	build3()
	if p3 == null:
		return
	if not p3.g.visible:
		for s in [-1, 1]:
			Phys.add_box_c(W3.PORTAL3.x, 3.8, W3.PORTAL3.z + s * 3.9, 1.1, 7.6, 1.1)
		Nav.build(2, func(x: float, z: float) -> bool: return W2.in_lava(x, z))
	p3.g.visible = true; appearT = 2.5 if anim else 0.0; UI.map_dirty()
static func unlock() -> void:
	if Game.portal3Unlocked:
		return
	Game.portal3Unlocked = true; W3.build(); Game.seed_rivals(Game.owners.size() - 4); show(true)
	Sound.play("rebirth"); UI.banner("🌀 پرتال جزیره‌های آسمانی باز شد!", "ثروتت به ۱ تریلیون رسید · پرتال در سیاره‌ی گدازه است")
	UI.toast("🏝️ در سیاره‌ی گدازه، کنار شکاف گدازه، پرتال جزیره‌های آسمانی باز شد!", "rare"); Game.schedule_save(true)
static func update(dt: float, t: float) -> void:
	if p3 != null and p3.g.visible:
		W2.anim_portal(p3, dt, t)
		if appearT > 0:
			appearT -= dt
			var k: float = maxf(0.01, 1 - maxf(0.0, appearT) / 2.5)
			p3.g.scale = Vector3(k, k, k)
	if p4 != null:
		W2.anim_portal(p4, dt, t)
	if not W3.built:
		return
	W3.update(dt, t)

