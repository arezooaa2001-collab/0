## Guard robots patrol their owner's base and chase intruders and thieves.
class_name GuardBrain
extends Brain

var scan := 0.0
var pushCd := 0.0
var wp = null

func _init(a_: Agent, base_: BaseVis) -> void:
	super(a_)
	base = base_; state = "patrol"

func decide() -> void:
	pass

func update(dt: float) -> void:
	var p := a.body.pos; var b := base
	t += dt
	if a.stunned:
		a.move = Vector2.ZERO
		return
	scan -= dt; pushCd -= dt
	if scan <= 0:
		scan = 0.25
		var best: Agent = null; var bd := 1e9
		for ag in Game.agents:
			if ag.owner == o or ag.isGuard or (ag.isPlayer and not Game.playing) or ag.stunned or Phys.world_of(ag.body.pos.x) != Phys.world_of(p.x):
				continue
			var th := ag.carrying != null and ag.carrying.owner == o; var inside := b.contains(ag.body.pos.x, ag.body.pos.z, 0.5)
			if not th and not inside:
				continue
			if not th and ag.isPlayer and ag.owner.up.cloak > 0:
				continue
			var d := U.dist2(ag.body.pos, p)
			if th:
				d *= 0.3
			if d < bd:
				bd = d; best = ag
		target = best
	var tg := target
	if tg != null and U.dist2(p, b.insidePos) < 34 * 34:
		run = true
		var tp := tg.body.pos; var d2 := U.dist2(p, tp)
		if d2 < 196 and Nav.line_open(p.x, p.z, tp.x, tp.z):
			var d := maxf(sqrt(d2), 1e-3)
			a.move = Vector2((tp.x - p.x) / d, (tp.z - p.z) / d); path = []
		else:
			repath -= dt
			if path.is_empty() or repath <= 0:
				repath = 0.5; go_to(tp.x, tp.z)
			follow(dt)
		if tg.isPlayer and Game.reflect and d2 < 1.5 * 1.5 and pushCd <= 0:
			pushCd = 2.5; Game.reflect_hit(a, "هل‌دادن")
			return
		if tg.carrying == null and d2 < 1.5 * 1.5 and pushCd <= 0 and b.contains(tp.x, tp.z, 0.5):
			pushCd = 2.2; tg.stun(0.6)
			var dir := Vector3(b.entrancePos.x - tp.x, 0, b.entrancePos.z - tp.z).normalized()
			tg.body.vel = Vector3(dir.x * 10, 6, dir.z * 10)
			if tg.isPlayer:
				Sound.play("zap"); UI.toast("🤖 نگهبانِ " + o.name + " تو را هل داد! با سیلی گیجش کن", "bad")
		return
	run = false
	if wp == null or t > 7 or U.dist2(p, Vector3(wp.x, 0, wp.y)) < 1.2:
		t = 0
		var w := b.to_world(U.rnd(-9, 9), U.rnd(-6, 8))
		wp = w; go_to(w.x, w.y)
	if follow(dt) != "moving":
		a.move = Vector2.ZERO
