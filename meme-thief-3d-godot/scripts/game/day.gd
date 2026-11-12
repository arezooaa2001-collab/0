## Day / night cycle (8 minutes) driving sky, fog, lights and per-world atmospheres.
class_name Day

static var t := 0.3
static var len := 480.0
static var k := 1.0
static var SKY_TOP := Color.html("#2f7cf0")
static var SKY_HOR := Color.html("#cdeeff")
static var NIGHT_TOP := Color.html("#0a0f2e")
static var NIGHT_HOR := Color.html("#2b2f6e")
static var MOON := Color.html("#9fb4ff")
static var SUNC := Color.html("#fff0d8")

static func label() -> String:
	var p := Game.player
	if p != null:
		var x := p.body.pos.x
		if Phys.in_w4(x):
			return "🌨️ کولاک!" if EXW.D[4].storm.on > 0 else "❄️ قطب یخی"
		if Phys.in_w5(x):
			return "🌙 ماه نئونی"
		if Phys.in_w2(x):
			return "🌋 سیاره‌ی گدازه"
		if Phys.in_w3(x):
			return "🌬️ باد شدید!" if W3.wind.on > 0 else "🏝️ جزیره‌های آسمانی"
	var c := cos(t * TAU)
	return "☀️ روز" if k > 0.75 else ("🌙 شب" if k < 0.25 else ("🌇 غروب" if c < 0 else "🌅 طلوع"))

static func update(dt: float) -> void:
	t = fmod(t + dt / len, 1.0)
	var s := sin(t * TAU); var x := clampf((s + 0.55) / 0.4, 0, 1); k = x * x * (3 - 2 * x)
	var M = Game.main
	if M == null:
		return
	var sky: ProceduralSkyMaterial = M.sky_mat; var env: Environment = M.env
	var top := NIGHT_TOP.lerp(SKY_TOP, k); var hor := NIGHT_HOR.lerp(SKY_HOR, k)
	env.fog_depth_begin = 90; env.fog_depth_end = 300
	var wx := Game.cam_pos.x
	var tint: float = Game.sunTint
	if EXW.D[4].aurora != null:
		EXW.D[4].aurora.visible = Phys.in_w4(wx)
	if EXW.D[5].earth != null:
		EXW.D[5].earth.visible = Phys.in_w5(wx)
		if Phys.in_w5(wx):
			EXW.D[5].earth.position = Vector3(wx + 140, Game.cam_pos.y + 120, Game.cam_pos.z - 300)
	if W2.planet != null:
		W2.planet.visible = Phys.in_w2(wx)
		if W2.planet.visible:
			W2.planet.position = Vector3(wx - 170, Game.cam_pos.y + 150, Game.cam_pos.z - 330)
	if Phys.in_w4(wx):
		var bk: float = EXW.D[4].storm.k * (0.55 if (Game.player != null and Game.player.owner.up.furCoat > 0) else 1.0)
		top = Color.html("#4a8cff").lerp(Color.html("#c8d4e0"), bk); hor = Color.html("#e4f2ff").lerp(Color.html("#f4f8fc"), bk)
		M.set_sky(top, hor, hor, lerpf(90, 6, bk), lerpf(300, 48, bk))
		M.set_lights(0.9, 0.5, Color.html("#f4faff"), 2.4 * tint * (1 - bk * 0.5), 1.02, 0.0)
		return
	if Phys.in_w5(wx):
		M.set_sky(Color.html("#03020a"), Color.html("#1c1040"), Color.html("#140c30"), 120, 380)
		M.set_lights(0.5, 0.35, Color.html("#d8d0ff"), 2.3 * tint, 1.05, 1.0)
		return
	if Phys.in_w3(wx):
		M.set_sky(Color.html("#5aa8ff"), Color.html("#ffd9ec"), Color.html("#ffe6f2"), 90, 300)
		M.set_lights(0.85, 0.5, Color.html("#fff2e0"), 2.6 * tint, 1.05, 0.0)
		return
	if Phys.in_w2(wx):
		M.set_sky(Color.html("#14040c"), Color.html("#6a1a20"), Color.html("#3a0e14"), 90, 300)
		M.set_lights(0.42, 0.25, Color.html("#ff9a6a"), 2.0 * tint, 0.98, 0.9)
		return
	M.set_sky(top, hor, hor, 90, 300)
	M.set_lights(0.75 * (0.2 + 0.8 * k), 0.45 * (0.3 + 0.7 * k), MOON.lerp(SUNC, k), 2.7 * tint * (0.1 + 0.9 * k), 1.05 * (0.52 + 0.48 * k), clampf((0.55 - k) * 1.8, 0, 1))
	if World.lamp_mat:
		World.lamp_mat.emission_energy_multiplier = 0.4 + 4.5 * (1 - k)
	if k < 0.4 and Game.player != null and randf() < dt * 14 * (1 - k):
		var p := Game.player.body.pos
		FX.one(p.x + U.rnd(-22, 22), U.rnd(0.5, 3), p.z + U.rnd(-22, 22), {"vx": U.rnd(-0.4, 0.4), "vy": U.rnd(-0.1, 0.3), "vz": U.rnd(-0.4, 0.4), "life": 2.5, "size": 0.22, "color": U.pick(["#d8ff6a", "#fff27a"]), "grav": 0, "drag": 0.2})
