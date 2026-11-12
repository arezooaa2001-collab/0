## Lava hazards: burning and meteor showers.
class_name Hazards

## lava hazards: burning and meteor showers
static var meteorT := 30.0
static var meteors: Array = []
static func burn(a: Agent) -> void:
	if a.burnCd > 0:
		return
	a.burnCd = 1.2
	if a.isPlayer and a.owner.up.lavaBoots > 0:
		a.burnCd = 0.3
		if randf() < 0.5:
			FX.one(a.body.pos.x, 0.3, a.body.pos.z, {"vx": U.rnd(-0.5, 0.5), "vy": 1.5, "vz": U.rnd(-0.5, 0.5), "life": 0.5, "size": 0.3, "color": "#7af7ff"})
		return
	var z := a.body.pos.z; var s := signf(z) if z != 0 else 1.0
	var m0: float = W2.moat[0]; var m1: float = W2.moat[1]
	var out := -s if absf(absf(z) - m0) < absf(absf(z) - m1) else s
	a.body.vel = Vector3(a.body.vel.x * 0.3, 8, out * 11); a.stun(0.7)
	FX.burst(Vector3(a.body.pos.x, 0.6, a.body.pos.z), {"count": 30, "color": ["#ff5a1f", "#ffb000", "#ffe14a"], "speed": 5, "up": true, "life": 0.8})
	if a.carrying != null:
		var u := a.carrying
		Game.return_unit(u)
		if a.isPlayer:
			UI.toast("🔥 سوختی و «" + u.c.name + "» از دستت افتاد و برگشت!", "bad")
	elif a.isPlayer:
		UI.toast("🔥 داخل گدازه افتادی! از روی پل‌ها برو", "bad")
	if a.isPlayer:
		Sound.play("zap"); Game.CAM.shake = 0.2
static func update(dt: float) -> void:
	if not W2.built:
		return
	for a in Game.agents:
		a.burnCd = maxf(0.0, a.burnCd - dt)
		var p := a.body.pos
		if Phys.in_w2(p.x) and p.y < 0.25 and W2.in_lava(p.x, p.z):
			burn(a)
	var pl := Game.player
	if Game.playing and pl != null and Phys.in_w2(pl.body.pos.x):
		meteorT -= dt
		if meteorT <= 0:
			meteorT = U.rnd(22, 40); UI.toast("☄️ باران شهاب‌سنگ! از دایره‌های قرمز دور شو", "bad"); Sound.play("alarm")
			for i in 6:
				spawn(pl.body.pos.x + U.rnd(-18, 18), pl.body.pos.z + U.rnd(-18, 18), 1.6 + i * 0.35)
	for i in range(meteors.size() - 1, -1, -1):
		var m: Dictionary = meteors[i]
		m.t -= dt
		var k: float = 1 - maxf(0.0, m.t) / m.max
		m.ring.material_override.albedo_color.a = 0.4 + sin(m.t * 20) * 0.3
		var rs: float = 3.2 * (0.6 + 0.4 * k)
		m.ring.basis = Geo.basis_xyz(-PI / 2, 0, 0) * Basis.from_scale(Vector3(rs, rs, rs))
		m.rock.position = Vector3(m.x + (1 - k) * 25, 0.6 + (1 - k) * 60, m.z - (1 - k) * 10); m.rock.rotation.x += dt * 5
		if randf() < 0.6:
			FX.one(m.rock.position.x, m.rock.position.y, m.rock.position.z, {"vx": U.rnd(-1, 1), "vy": U.rnd(-1, 1), "vz": U.rnd(-1, 1), "life": 0.6, "size": 0.8, "color": U.pick(["#ff5a1f", "#ffb000"]), "grav": 0, "drag": 1})
		if m.t <= 0:
			FX.burst(Vector3(m.x, 0.8, m.z), {"count": 50, "color": ["#ff5a1f", "#ffb000", "#ffe14a", "#3a2028"], "speed": 9, "up": true, "life": 1, "grav": -12})
			var mp := Vector3(m.x, 0, m.z)
			if pl != null and U.dist2(pl.body.pos, mp) < 900:
				Sound.play("boom"); Game.CAM.shake = 0.35
			for a in Game.agents:
				if U.dist2(a.body.pos, mp) < 3.4 * 3.4:
					if a.isPlayer and a.owner.up.meteorShield > 0:
						FX.burst(Vector3(a.body.pos.x, a.body.pos.y + 1.2, a.body.pos.z), {"count": 30, "color": ["#7af7ff", "#ffffff"], "speed": 5, "life": 0.6}); UI.toast("⛑️ کلاه ضدشهاب از تو محافظت کرد!", "good")
						continue
					a.stun(1.4)
					var dir := Vector3(a.body.pos.x - m.x, 0, a.body.pos.z - m.z).normalized()
					a.body.vel = Vector3(dir.x * 10, 9, dir.z * 10)
					if a.carrying != null:
						var u := a.carrying
						Game.return_unit(u)
						if a.isPlayer:
							UI.toast("☄️ شهاب‌سنگ خوردی و «" + u.c.name + "» برگشت!", "bad")
					elif a.isPlayer:
						UI.toast("☄️ شهاب‌سنگ خوردی!", "bad")
			m.ring.queue_free(); m.rock.queue_free(); meteors.remove_at(i)
static func spawn(x: float, z: float, delay: float) -> void:
	var B := Phys.WORLD2
	x = clampf(x, B.minX + 3, B.maxX - 3); z = clampf(z, B.minZ + 3, B.maxZ - 3)
	var ring := Geo.mesh(Geo.G("ring08"), Geo.basic_mat("#ff2a3a", 0.6, {"side": true}).duplicate(), x, Phys.floor_at(x, z, 0.5, 5)[0] + 0.06, z, 1, 1, 1, World, false); Geo.rot(ring, -PI / 2)
	var rock := Geo.mesh(Geo.G("dodec"), Geo.mat("#3a2028", {"e": "#ff4a00", "ei": 1.4, "flat": true}), x, 60, z, 0.9, 0.9, 0.9, World, false)
	meteors.append({"x": x, "z": z, "t": delay, "max": delay, "ring": ring, "rock": rock})
