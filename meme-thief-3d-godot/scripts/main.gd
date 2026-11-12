## Boot, scene setup (sky, lights, camera), input, player control, interaction and the main loop.
extends Node3D

const SUN_DIR := Vector3(-0.55, 0.78, 0.32)
var camera: Camera3D
var env: Environment
var sky_mat: ProceduralSkyMaterial
var sun: DirectionalLight3D
var fill: DirectionalLight3D
var lights: Array[OmniLight3D] = []
var menuT := 0.0
var lightT := 0.0
var cam_dx := 0.0
var cam_dy := 0.0
var INTERACT: Dictionary = {"kind": ""}
var STEAL_U: Unit = null
var padCd := 0.0
var sprint_toggle := false
var pad_known := false
var loaded := false
var last_save_t := 0.0
var test_mode := false
var test_t := 0.0

func _ready() -> void:
	Data.ensure()
	Game.main = self
	_setup_input()
	_setup_scene()
	UI.setup(self)
	_boot()

# ---------------------------------------------------------------- scene
func _setup_scene() -> void:
	camera = Camera3D.new(); camera.fov = 62; camera.near = 0.1; camera.far = 700; camera.position = Vector3(0, 30, 60); add_child(camera); camera.current = true
	sky_mat = ProceduralSkyMaterial.new()
	sky_mat.sky_top_color = Day.SKY_TOP; sky_mat.sky_horizon_color = Day.SKY_HOR; sky_mat.ground_bottom_color = Color(0.35, 0.45, 0.3); sky_mat.ground_horizon_color = Day.SKY_HOR
	sky_mat.sun_angle_max = 8.0; sky_mat.sun_curve = 0.08
	var sky := Sky.new(); sky.sky_material = sky_mat
	env = Environment.new()
	env.background_mode = Environment.BG_SKY; env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR; env.ambient_light_color = Color.html("#9fb6c8"); env.ambient_light_energy = 0.75
	env.tonemap_mode = Environment.TONE_MAPPER_ACES; env.tonemap_exposure = 1.05
	env.fog_enabled = true; env.fog_mode = Environment.FOG_MODE_DEPTH; env.fog_light_color = Day.SKY_HOR; env.fog_depth_begin = 90; env.fog_depth_end = 300; env.fog_depth_curve = 1.0
	env.glow_enabled = false
	var we := WorldEnvironment.new(); we.environment = env; add_child(we)
	sun = DirectionalLight3D.new(); sun.light_color = Color.html("#fff0d8"); sun.light_energy = 1.4
	sun.shadow_enabled = S.Q().shadows; sun.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_2_SPLITS; sun.directional_shadow_max_distance = 90; sun.directional_shadow_split_1 = 0.25
	sun.shadow_bias = 0.03; sun.shadow_normal_bias = 1.5
	sun.transform = Transform3D(Geo.look_basis(SUN_DIR * 80, Vector3.ZERO).rotated(Vector3.UP, 0), SUN_DIR * 80)
	sun.look_at_from_position(SUN_DIR * 80, Vector3.ZERO, Vector3.UP)
	add_child(sun)
	fill = DirectionalLight3D.new(); fill.light_color = Color.html("#b8c8ff"); fill.light_energy = 0.3
	fill.look_at_from_position(Vector3(40, 30, -50), Vector3.ZERO, Vector3.UP); add_child(fill)
	for i in 2:
		var l := OmniLight3D.new(); l.omni_range = 9; l.light_energy = 0; l.omni_attenuation = 1.5; add_child(l); lights.append(l)
	FX.set_quality(S.Q())

func set_sky(top: Color, hor: Color, fog_col: Color, fog_near: float, fog_far: float) -> void:
	sky_mat.sky_top_color = top; sky_mat.sky_horizon_color = hor; sky_mat.ground_horizon_color = hor
	env.fog_light_color = fog_col; env.fog_depth_begin = fog_near; env.fog_depth_end = fog_far

func set_lights(hemi: float, fill_i: float, sun_col: Color, sun_i: float, exposure: float, stars: float) -> void:
	env.ambient_light_energy = hemi; fill.light_energy = fill_i * 0.7; sun.light_color = sun_col; sun.light_energy = sun_i * 0.5; env.tonemap_exposure = exposure
	if World.stars_mat:
		World.stars_mat.albedo_color.a = stars
		World.stars.position = camera.position

func update_lights() -> void:
	var n: int = S.Q().lights
	var cands := []
	for u in Game.units:
		if u.c.rarity >= 5 and u.state != "dead" and u.root.visible:
			cands.append([U.dist2(u.pos, camera.position), u])
	cands.sort_custom(func(a, b): return a[0] < b[0])
	for i in lights.size():
		var l := lights[i]
		var c = cands[i] if (i < n and i < cands.size()) else null
		if c != null and c[0] < 1600:
			var u: Unit = c[1]
			l.light_color = Color.html(Data.RARITIES[u.c.rarity].color); l.light_energy = 3.0; l.position = Vector3(u.pos.x, u.pos.y + u.H * 0.6, u.pos.z)
		else:
			l.light_energy = 0

# ---------------------------------------------------------------- boot
static func rss() -> String:
	var f := FileAccess.open("/proc/self/statm", FileAccess.READ)
	if f == null:
		return "?"
	return str(int(f.get_line().split(" ")[1]) * 4 / 1024) + "MB"

func _boot() -> void:
	print("[boot] start rss=", rss())
	UI.set_load(10, "در حال ساختن میدان، پایگاه‌ها و نوار نقاله…")
	await get_tree().process_frame
	World.build_world(); Portal.build1()
	print("[boot] world rss=", rss())
	UI.set_load(40, "در حال ساختن ۴۲ میم بامزه…")
	await get_tree().process_frame
	var ids := []
	for c in Data.CHARS:
		if c.proc == null:
			ids.append(c.id)
	for i in ids.size():
		Chars.template_of(ids[i])
		if i % 6 == 5:
			UI.set_load(40 + 30.0 * i / ids.size(), "در حال ساختن ۴۲ میم بامزه…")
			await get_tree().process_frame
	print("[boot] templates rss=", rss())
	UI.set_load(72, "در حال آماده‌سازی حریف‌ها…")
	await get_tree().process_frame
	print("[boot] +frame rss=", rss())
	var save = SaveSys.load_save()
	Game.init_game(save)
	var savedAt := 0.0
	if save != null and (save.get("portal", false) or save.get("portal3", false) or save.get("portal4", false) or save.get("portal5", false)):
		W2.build()
	if save != null and (save.get("portal3", false) or save.get("portal4", false) or save.get("portal5", false)):
		W3.build()
	if save != null and (save.get("portal4", false) or save.get("portal5", false)):
		EXW.build(4)
	if save != null and save.get("portal5", false):
		EXW.build(5)
	if save != null:
		savedAt = SaveSys.apply_save(save)
	if Game.portalUnlocked:
		W2.build(); Portal.show(false)
	if Game.portal3Unlocked:
		W3.build(); Portal3.show(false)
	if Game.look.is_empty():
		Game.look = Game.clean_look(null)
	if Game.portal4Unlocked:
		EXW.build(4); EXW.show(4, false)
	if Game.portal5Unlocked:
		EXW.build(5); EXW.show(5, false)
	W2.ensure_player_guard()
	Game.seed_rivals(save.owners.size() if save != null else 0)
	for o in Game.owners:
		o.apply_cap()
	set_player_name(Game.name_)
	if savedAt > 0:
		var away := clampf((Time.get_unix_time_from_system() * 1000.0 - savedAt) / 1000.0, 0, 7200)
		Game.offline = floorf(Game.owners[0].income_per_sec() * away * 0.25)
		for o in Game.owners:
			if not o.isPlayer:
				o.money += o.income_per_sec() * away * 0.25
	UI.set_load(88, "در حال پر کردن نوار نقاله…")
	await get_tree().process_frame
	print("[boot] rivals rss=", rss())
	Game.prefill_belt(Game.BELTS[0], 760, 2.2, 3.1)
	Game.spawnCount = 0
	print("[boot] belt rss=", rss())
	Missions.ensure(); Day.update(0.0)
	UI.apply_settings(false); UI.menu_info()
	UI.set_load(100, "آماده!")
	await get_tree().create_timer(0.25).timeout
	UI.show_menu()
	loaded = true
	test_mode = OS.get_cmdline_user_args().has("--smoke")
	if test_mode:
		_run_test()
	if OS.get_cmdline_user_args().has("--shots"):
		_run_shots()

## render a few screenshots (used for automated visual checks)
func _run_shots() -> void:
	var dir := OS.get_environment("MT_SHOT_DIR")
	if dir == "":
		dir = "user://"
	await get_tree().create_timer(1.0).timeout
	await _shot(dir + "/shot_menu.png")
	start_play()
	Game.player.owner.money = 50000
	for i in 4:
		await get_tree().process_frame
	await _shot(dir + "/shot_base.png")
	var a := Game.player
	a.body.pos = Vector3(-20, 0.4, 5); Game.cam_pivot = Vector3(-20, 2, 5); Game.CAM.yaw = 0.6; Game.CAM.pitch = 0.3
	for i in 30:
		await get_tree().process_frame
	await _shot(dir + "/shot_belt.png")
	a.body.pos = Vector3(-75, 0.4, 28); Game.cam_pivot = Vector3(-75, 2, 28); Game.CAM.yaw = PI; Game.CAM.pitch = 0.35
	for i in 30:
		await get_tree().process_frame
	await _shot(dir + "/shot_rival.png")
	UI.open_shop()
	await get_tree().process_frame
	await _shot(dir + "/shot_shop.png")
	UI.close_panel(); UI.open_inventory()
	await get_tree().process_frame
	await _shot(dir + "/shot_inv.png")
	UI.close_panel(); UI.open_book()
	await get_tree().process_frame
	await _shot(dir + "/shot_book.png")
	UI.close_panel()
	Portal.unlock(); Portal.travel(2, W2.PORTAL1)
	for i in 40:
		await get_tree().process_frame
	print("[shots] flash alpha=", UI.flash_rect.color.a, " fps=", Engine.get_frames_per_second())
	await get_tree().create_timer(3.0).timeout
	print("[shots] flash alpha=", UI.flash_rect.color.a)
	await _shot(dir + "/shot_lava.png")
	Portal3.unlock(); Portal.travel(3, W3.PORTAL3)
	for i in 40:
		await get_tree().process_frame
	await _shot(dir + "/shot_sky.png")
	EXW.unlock(4); Portal.travel(4, EXW.D[4].entry)
	for i in 40:
		await get_tree().process_frame
	await _shot(dir + "/shot_ice.png")
	EXW.unlock(5); Portal.travel(5, EXW.D[5].entry)
	for i in 40:
		await get_tree().process_frame
	await _shot(dir + "/shot_moon.png")
	print("[shots] done")
	get_tree().quit()

func _shot(path: String) -> void:
	await RenderingServer.frame_post_draw
	var img := get_viewport().get_texture().get_image()
	img.save_png(path)
	if OS.get_environment("MT_SHOT_ONLY") != "" and path.ends_with(OS.get_environment("MT_SHOT_ONLY")):
		print("[shots] done"); get_tree().quit()
	print("[shots] saved ", path)

## headless smoke test: play for a while, exercise the systems, print a summary and quit
func _run_test() -> void:
	print("[test] boot ok: units=", Game.units.size(), " agents=", Game.agents.size(), " owners=", Game.owners.size(), " bases=", World.bases.size(), " mem=", OS.get_static_memory_usage() / 1048576)
	Game.playing = true; UI.hide_menu()
	print("[test] mem after menu=", OS.get_static_memory_usage() / 1048576)
	Sound.init()
	print("[test] mem after sound=", OS.get_static_memory_usage() / 1048576)
	start_play()
	print("[test] mem after start=", OS.get_static_memory_usage() / 1048576)
	var o: Owner = Game.player.owner
	o.money = 5000
	for i in 12:
		Game.simulate(0.5)
		print("[test] sim ", i, " rss=", rss(), " prof=", Game.prof); Game.prof = {}
		await get_tree().process_frame
		print("[test] frame rss=", rss())
	var bought := 0
	print("[test] belt units=", Game.BELTS[0].list.size(), " t=", Time.get_ticks_msec() / 1000.0)
	for u in Game.BELTS[0].list.duplicate():
		print("[test] try_buy ", u.c.name, " at ", u.pos)
		var pth := Nav.find_path(u.pos.x, u.pos.z, o.base.slotPos[0].x, o.base.slotPos[0].z)
		print("[test] path len=", pth.size(), " t=", Time.get_ticks_msec() / 1000.0)
		if Game.try_buy(o, u) == "ok":
			bought += 1
			if bought >= 3:
				break
	print("[test] bought=", bought, " money=", o.money, " t=", Time.get_ticks_msec() / 1000.0, " rss=", rss())
	Game.activate_security(o)
	Game.slap(Game.player)
	Tutorial.finish()
	var rival: Owner = Game.owners[1]
	for s in rival.slots:
		if s.unit != null:
			Game.player.body.pos = s.unit.pos + Vector3(0.5, 0, 0.5)
			Game.start_steal(Game.player, s.unit)
			break
	print("[test] carrying=", Game.player.carrying != null, " t=", Time.get_ticks_msec() / 1000.0)
	for i in 40:
		Game.simulate(0.25)
	Game.player.body.pos = o.base.insidePos
	for i in 20:
		Game.simulate(0.25)
	print("[test] player units=", o.unit_count(), " pending=", Game.pending_of(o, null), " income=", o.income_per_sec(), " stolen=", Game.stats.stolen)
	UI.open_inventory(); UI.close_panel(); UI.open_shop(); UI.close_panel(); UI.open_book(); UI.close_panel(); UI.open_settings(); UI.close_panel(); UI.open_missions(); UI.open_missions(false, "ach"); UI.close_panel(); UI.open_leader(); UI.close_panel(); UI.open_daily(); UI.claim_daily(); UI.close_panel(); UI.open_fusion(); UI.close_panel(); UI.open_help(); UI.close_panel(); UI.open_keys(); UI.close_panel(); UI.open_pause(); UI.close_panel()
	UI.kiosk_ref = o.base.kiosks[0]; UI.open_shop(false, "base"); UI.close_panel(); UI.open_wardrobe(); UI.close_panel()
	Shop.order("cap")
	for i in 10:
		Game.simulate(0.25)
	print("[test] cap after shop=", o.up.cap, " t=", Time.get_ticks_msec() / 1000.0, " rss=", rss())
	o.money = 1e12
	Portal.unlock()
	print("[test] world2 built=", W2.built, " owners=", Game.owners.size(), " bases=", World.bases.size(), " t=", Time.get_ticks_msec() / 1000.0, " rss=", rss())
	Portal.travel(2, W2.PORTAL1)
	for i in 40:
		Game.simulate(0.25); update_camera(0.25)
	print("[test] player world=", Phys.world_of(Game.player.body.pos.x), " w2 bases=", o.bases.size(), " t=", Time.get_ticks_msec() / 1000.0, " rss=", rss())
	Portal3.unlock()
	Portal.travel(3, W3.PORTAL3)
	for i in 40:
		Game.simulate(0.25); update_camera(0.25)
	EXW.unlock(4); Portal.travel(4, EXW.D[4].entry)
	for i in 40:
		Game.simulate(0.25); update_camera(0.25)
	EXW.unlock(5); Portal.travel(5, EXW.D[5].entry)
	for i in 40:
		Game.simulate(0.25); update_camera(0.25)
	print("[test] worlds: ", W2.built, W3.built, EXW.D[4].built, EXW.D[5].built, " units=", Game.units.size(), " agents=", Game.agents.size(), " t=", Time.get_ticks_msec() / 1000.0, " rss=", rss())
	Extras.boss = Extras.Boss.new(5)
	Extras.spawn_chest(5, null, false)
	for i in 20:
		Game.simulate(0.25)
	SaveSys.do_save()
	var code := SaveSys.make_code()
	var back = SaveSys.read_code(code)
	print("[test] save code ok=", back != null, " len=", code.length())
	var s2 = SaveSys.load_save()
	print("[test] reload save ok=", s2 != null)
	print("[test] DONE time=", Game.time, " t=", Time.get_ticks_msec() / 1000.0, " rss=", rss(), " pf_calls=", Nav.pf_calls, " pf_ms=", Nav.pf_time / 1000)
	get_tree().quit()

func set_player_name(n: String) -> void:
	n = n.strip_edges().substr(0, 14)
	if n == "":
		n = "قهرمان"
	Game.name_ = n
	var o: Owner = Game.owners[0]
	o.name = n
	for i in o.bases.size():
		o.bases[i].set_sign_name(n if i == 0 else n + " " + U.fa(i + 1))

func start_play() -> void:
	Sound.init(); set_player_name(UI.name_input.text)
	UI.hide_menu(); Game.playing = true; Missions.ensure()
	var a := Game.player
	Game.CAM.yaw = a.yaw + PI; Game.CAM.pitch = 0.36; Game.cam_pivot = Vector3(a.body.pos.x, a.body.pos.y + 1.65, a.body.pos.z); Game.CAM.cur = S.zoom
	UI.apply_settings(false); UI.map_dirty()
	UI.toast("👋 خوش آمدی " + Game.name_ + "! پایگاه تو همین‌جاست", "good")
	if Game.offline > 0:
		Game.player.owner.money += Game.offline; UI.toast("🌙 درآمد زمان غیبت: " + U.fmt(Game.offline) + " سکه", "good"); Game.offline = 0
	if Game.daily.last != U.today_key():
		get_tree().create_timer(2.5).timeout.connect(func(): UI.toast("🎁 جایزه‌ی روزانه‌ات آماده است! (دکمه‌ی 🎁 بالا)", "rare"))
	if not Game.tutorialDone:
		Tutorial.start()
	else:
		Tutorial.show()
	Game.schedule_save(true)

func back_to_menu() -> void:
	Game.playing = false; UI.show_menu(); Game.player.move = Vector2.ZERO
	if Tutorial.arrow != null:
		Tutorial.arrow.visible = false
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	UI.menu_info()

# ---------------------------------------------------------------- input
func _act(name: String, keys: Array, buttons: Array = []) -> void:
	if not InputMap.has_action(name):
		InputMap.add_action(name, 0.2)
	for k in keys:
		var ev := InputEventKey.new(); ev.physical_keycode = k; InputMap.action_add_event(name, ev)
	for b in buttons:
		var ev := InputEventJoypadButton.new(); ev.button_index = b; InputMap.action_add_event(name, ev)

func _setup_input() -> void:
	_act("move_forward", [KEY_W, KEY_UP]); _act("move_back", [KEY_S, KEY_DOWN]); _act("move_left", [KEY_A, KEY_LEFT]); _act("move_right", [KEY_D, KEY_RIGHT])
	_act("jump", [KEY_SPACE], [JOY_BUTTON_A]); _act("sprint", [KEY_SHIFT], [JOY_BUTTON_RIGHT_SHOULDER, JOY_BUTTON_LEFT_STICK])
	_act("interact", [KEY_E], [JOY_BUTTON_X]); _act("steal", [KEY_F], [JOY_BUTTON_Y]); _act("drop", [KEY_G]); _act("cam", [KEY_C]); _act("security", [KEY_Q]); _act("slap", [KEY_R], [JOY_BUTTON_B])
	_act("board", [KEY_H], [JOY_BUTTON_LEFT_SHOULDER]); _act("missions", [KEY_J], [JOY_BUTTON_DPAD_UP]); _act("shop", [KEY_B]); _act("inventory", [KEY_I], [JOY_BUTTON_DPAD_DOWN]); _act("book", [KEY_K]); _act("leader", [KEY_L])
	_act("minimap", [KEY_M]); _act("pause", [KEY_P], [JOY_BUTTON_START]); _act("fullscreen", [KEY_O]); _act("keys", [KEY_F1], [JOY_BUTTON_BACK]); _act("esc", [KEY_ESCAPE])

func ui_blocked() -> bool:
	return not Game.playing or Game.paused or UI.modal_open()

func _unhandled_input(e: InputEvent) -> void:
	if not loaded:
		return
	if e is InputEventMouseMotion:
		if Input.mouse_mode == Input.MOUSE_MODE_CAPTURED and not ui_blocked():
			cam_dx += e.relative.x; cam_dy += e.relative.y
		elif (e.button_mask & (MOUSE_BUTTON_MASK_LEFT | MOUSE_BUTTON_MASK_RIGHT)) != 0 and not ui_blocked() and not S.IS_TOUCH:
			cam_dx += e.relative.x; cam_dy += e.relative.y
	elif e is InputEventMouseButton:
		if ui_blocked():
			return
		if e.pressed and e.button_index == MOUSE_BUTTON_WHEEL_UP:
			S.zoom = clampf(S.zoom - 0.6, 3, 14)
		elif e.pressed and e.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			S.zoom = clampf(S.zoom + 0.6, 3, 14)
		elif e.pressed and e.button_index == MOUSE_BUTTON_LEFT and S.mouseLock and not S.IS_TOUCH:
			Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	elif e is InputEventKey and e.pressed and not e.echo:
		if e.is_action("keys"):
			if Game.playing:
				UI.open_keys()
			return
		if e.is_action("esc"):
			if Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
				Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
			if UI.confirm_open():
				UI.confirm_close(false)
			elif UI.modal_open():
				UI.close_panel()
			elif Game.playing:
				UI.open_pause()
			return
	if not Game.playing or UI.modal_open():
		return
	if e.is_pressed() and not e.is_echo():
		Sound.init()
		if e.is_action("jump"): Game.player.jumpQ = 0.15
		elif e.is_action("interact"): do_interact()
		elif e.is_action("steal"): do_steal()
		elif e.is_action("drop"): do_drop()
		elif e.is_action("cam"): toggle_cam_mode()
		elif e.is_action("security"): do_security()
		elif e.is_action("slap"): do_slap()
		elif e.is_action("board"): Extras.toggle_board()
		elif e.is_action("missions"): UI.open_missions()
		elif e.is_action("shop"):
			if INTERACT.kind == "kiosk": do_interact()
			elif INTERACT.kind == "shop": UI.open_shop()
			else: UI.toast("🛒 برای خرید باید خودت به فروشگاه (غرب میدان، کنار مغازه‌دار) بروی", "bad")
		elif e.is_action("inventory"): UI.open_inventory()
		elif e.is_action("book"): UI.open_book()
		elif e.is_action("leader"): UI.open_leader()
		elif e.is_action("minimap"):
			S.minimap = not S.minimap; S.save_settings(); UI.apply_settings(false)
		elif e.is_action("pause"): UI.open_pause()
		elif e.is_action("fullscreen"): toggle_fullscreen()

func toggle_fullscreen() -> void:
	var m := DisplayServer.window_get_mode()
	DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED if m == DisplayServer.WINDOW_MODE_FULLSCREEN else DisplayServer.WINDOW_MODE_FULLSCREEN)

func do_slap() -> void:
	var r := Game.slap(Game.player)
	if r == "cd":
		Sound.play("click"); UI.toast("🥊 دستت هنوز خسته است (" + U.fa("%.1f" % Game.player.slapCd) + " ثانیه)", "")

func toggle_cam_mode() -> void:
	S.firstPerson = not S.firstPerson; S.save_settings(); UI.toast("🎥 دوربین اول‌شخص" if S.firstPerson else "🎥 دوربین سوم‌شخص", "")

func do_security() -> void:
	var o := Game.player.owner
	if Game.activate_security(o):
		return
	Sound.play("error")
	UI.toast(("🛡️ سپر همین الان فعال است (" + U.fmt_time(o.secT) + ")") if o.secT > 0 else ("🛡️ سپر در حال آماده شدن: " + U.fmt_time(o.secCd)), "bad")

func player_control(dt: float) -> void:
	var a := Game.player
	var mx := 0.0; var my := 0.0
	if Input.is_action_pressed("move_forward"): my += 1
	if Input.is_action_pressed("move_back"): my -= 1
	if Input.is_action_pressed("move_right"): mx += 1
	if Input.is_action_pressed("move_left"): mx -= 1
	var kl := Vector2(mx, my).length()
	if kl > 1:
		mx /= kl; my /= kl
	if UI.joy_active and UI.joy.length() > 0:
		mx = UI.joy.x; my = UI.joy.y
	# gamepad
	var gx := Input.get_joy_axis(0, JOY_AXIS_LEFT_X); var gy := -Input.get_joy_axis(0, JOY_AXIS_LEFT_Y)
	var dz := 0.18
	gx = 0.0 if absf(gx) < dz else (gx - signf(gx) * dz) / (1 - dz); gy = 0.0 if absf(gy) < dz else (gy - signf(gy) * dz) / (1 - dz)
	var gl := Vector2(gx, gy).length()
	if gl > 0.02:
		mx = gx / maxf(1.0, gl); my = gy / maxf(1.0, gl)
		if not pad_known:
			pad_known = true; UI.toast("🎮 دسته‌ی بازی وصل شد! (F1 = راهنمای کلیدها)", "good")
	var rx := Input.get_joy_axis(0, JOY_AXIS_RIGHT_X); var ry := Input.get_joy_axis(0, JOY_AXIS_RIGHT_Y)
	rx = 0.0 if absf(rx) < dz else rx; ry = 0.0 if absf(ry) < dz else ry
	if rx != 0 or ry != 0:
		cam_dx += rx * 900 * dt; cam_dy += ry * 600 * dt
	var y: float = Game.CAM.yaw
	var fx := -sin(y); var fz := -cos(y); var rxx := cos(y); var rzz := -sin(y)
	a.move = Vector2(rxx * mx + fx * my, rzz * mx + fz * my)
	a.sprint = Input.is_action_pressed("sprint") or UI.sprint_toggle or Input.get_joy_axis(0, JOY_AXIS_TRIGGER_RIGHT) > 0.5
	if Vector2(mx, my).length() > 0.2:
		Tutorial.moved(dt)

func compute_interact(dt: float) -> void:
	var a := Game.player; var p := a.body.pos; var o := a.owner
	var R := {"kind": ""}
	STEAL_U = null
	if a.carrying != null:
		INTERACT = {"kind": "carry"}
		return
	var bd := 3.4 * 3.4; var best: Unit = null
	for B in Game.BELTS:
		if B.active:
			for u in B.list:
				var d := U.dist2(p, u.pos)
				if d < bd:
					bd = d; best = u
	if best != null:
		var pr := Game.belt_price(best)
		R = {"kind": "buy", "unit": best, "ok": o.money >= pr and o.free_slot(null, best.belt.w if best.belt != null else 1) != null, "price": pr}
	for ag in Game.agents:
		if ag.carrying != null and ag.carrying.owner == o and U.dist2(p, ag.body.pos) < 2.8 * 2.8:
			R = {"kind": "catch", "target": ag}
	for ag in Game.agents:
		if ag.drilling != null and not ag.isPlayer and ag.drilling.base.owner == o and U.dist2(p, ag.body.pos) < 9:
			R = {"kind": "stopDrill", "target": ag}
	if a.drilling != null:
		R = {"kind": "drilling"}
	var sd := (4.2 * 4.2) if (o.up.hook > 0 and Phys.in_w2(p.x)) else (2.5 * 2.5)
	for b in World.bases:
		if b.owner == null or b.owner == o or not b.contains(p.x, p.z, 1.5):
			continue
		for s in b.owner.slots:
			if s.base == b and s.unit != null and s.unit.state == "slotted":
				var d := U.dist2(p, s.unit.pos)
				if d < sd and absf(p.y - s.unit.pos.y) < 2:
					sd = d; STEAL_U = s.unit
	var myBase := o.base_at(p.x, p.z, 0.5)
	if R.kind == "":
		var plot: BaseVis = null
		for b in World.bases:
			if b.forSale and b.owner == null and (b.contains(p.x, p.z, 0.5) or U.dist2(p, b.entrancePos) < 36):
				plot = b
		var nd: BaseVis = null
		for b in World.bases:
			if b.door != null and (U.dist2(p, b.doorPos) < 2.3 * 2.3 or U.dist2(p, b.doorOut) < 1.8 * 1.8):
				nd = b
		var kq = null
		if myBase != null:
			for k in myBase.kiosks:
				if U.dist2(p, k.pos) < 1.7 * 1.7:
					kq = k
		if plot != null:
			R = {"kind": "plot", "base": plot, "price": Game.plot_price(o), "ok": o.money >= Game.plot_price(o)}
		elif nd != null:
			if nd.owner == o:
				R = {"kind": "door", "base": nd}
			elif nd.owner != null and nd.door.state == "closed":
				R = {"kind": "drill", "base": nd}
		elif kq != null:
			R = {"kind": "kiosk", "k": kq}
		elif myBase != null and U.dist2(p, myBase.consolePos) < 2.4 * 2.4:
			R = {"kind": "security"}
		elif myBase != null and U.dist2(p, myBase.collectPos) < 4:
			R = {"kind": "collect", "base": myBase}
		else:
			var od := 1.9 * 1.9; var ou = null
			if myBase != null:
				for s in o.slots:
					if s.base == myBase and s.unit != null and s.unit.state == "slotted":
						var d := U.dist2(p, s.unit.pos)
						if d < od:
							od = d; ou = s
			if ou != null:
				R = {"kind": "info", "slot": ou}
			elif U.dist2(p, World.fusionPos) < 4.6 * 4.6:
				R = {"kind": "fuse"}
			elif Portal.near_any(p):
				R = {"kind": "portal"}
			elif U.dist2(p, World.shopPos) < 25 or (W2.shopPos != null and U.dist2(p, W2.shopPos) < 25) or (W3.shopPos != null and U.dist2(p, W3.shopPos) < 25) or (EXW.D[4].shopPos != null and U.dist2(p, EXW.D[4].shopPos) < 25) or (EXW.D[5].shopPos != null and U.dist2(p, EXW.D[5].shopPos) < 25):
				R = {"kind": "shop"}
			elif U.dist2(p, World.boardPos) < 49:
				R = {"kind": "board"}
	INTERACT = R
	padCd -= dt
	if padCd <= 0 and myBase != null and absf(p.x - myBase.collectPos.x) < 1.4 and absf(p.z - myBase.collectPos.z) < 1.4 and Game.pending_of(o, myBase) >= 1:
		padCd = 0.6; Game.collect_owner(o, false, myBase)

func do_interact() -> void:
	var a := Game.player; var o := a.owner; var R := INTERACT
	match R.kind:
		"door":
			var b: BaseVis = R.base
			if b.door.state == "broken":
				Sound.play("error"); UI.toast("🔧 در آهنی شکسته است — از فروشگاه ارتقای همین پایگاه تعمیرش کن (" + U.fmt(House.DOOR_REPAIR) + ")", "bad")
			elif b.door.state == "closed":
				House.open(b, 8); UI.toast("🔓 با کلید خودت در را باز کردی (۸ ثانیه بعد خودش قفل می‌شود)", "good")
			else:
				House.close(b)
		"drill":
			if o.drills < 1:
				Sound.play("error"); UI.toast("🔩 دریل برقی نداری! از فروشگاه ارتقای پایگاهت بخر (" + U.fmt(House.DRILL_PRICE) + ")", "bad")
			else:
				House.start_drill(a, R.base)
		"stopDrill":
			var th: Agent = R.target
			th.stun(3.2); th.body.vel = Vector3((th.body.pos.x - a.body.pos.x) * 3, 5, (th.body.pos.z - a.body.pos.z) * 3); th.fling = 0.4; Sound.play("slap")
		"kiosk":
			UI.kiosk_ref = R.k; Sound.play("click")
			if R.k.type == "wear":
				UI.open_wardrobe()
			else:
				UI.open_shop(false, "speed" if R.k.type == "speed" else "base")
		"buy":
			var r := Game.try_buy(o, R.unit)
			if r == "money":
				Sound.play("error"); UI.toast("💸 پولت کافی نیست! قیمت: " + U.fmt(R.price) + " — موجودی: " + U.fmt(o.money), "bad")
			elif r == "full":
				var w := Phys.world_of(a.body.pos.x)
				Sound.play("error"); UI.toast(((Data.WORLD_EMOJI[w] + " پایگاهت در " + Data.WORLD_NAMES[w] + " پر است! ") if w > 1 else "") + "🏠 پایگاه‌هایت پر است! ظرفیت را ارتقا بده، یک میم بفروش یا یک زمین «برای فروش» بخر", "bad")
			elif r == "gone":
				Sound.play("error")
		"catch":
			var th: Agent = R.target
			if th.carrying != null:
				var u := th.carrying
				Game.return_unit(u); th.stun(2.2)
				var bounty := maxf(10, floorf(u.price * 0.05))
				o.money += bounty; Sound.play("success"); UI.toast("👋 دزد را زدی! " + u.c.name + " برگشت. جایزه: " + U.fmt(bounty), "good"); Game.stats.caught += 1
		"security": do_security()
		"collect":
			if Game.collect_owner(o, false, R.base) == 0:
				UI.toast("هنوز پولی جمع نشده", "")
		"plot":
			UI.confirm("خرید پایگاه جدید", "این زمین را به قیمت " + U.fmt(R.price) + " سکه می‌خری؟ ۱۲ جای تازه برای میم‌هایت (با ظرفیت فعلی " + U.fa(o.cap) + " جای باز) می‌گیری.", func(): Game.buy_plot(o, R.base))
		"info": UI.open_unit(R.slot)
		"shop": UI.open_shop()
		"fuse": UI.open_fusion()
		"portal": UI.toast("🌀 برای سفر، مستقیم برو داخل حلقه‌ی پرتال", "")
		"board": UI.open_leader()
		"carry": UI.toast("🏃 میم را به پایگاه خودت برسان! (یا رها کن)", "")
		_:
			if a.carrying == null:
				Sound.play("click"); UI.toast("اینجا چیزی برای تعامل نیست — کنار نوار نقاله برو تا میم بخری", "")

func do_steal() -> void:
	var a := Game.player
	if a.carrying != null:
		UI.toast("🎒 دستت پر است! اول به پایگاهت برگرد", "bad")
		return
	if STEAL_U != null:
		if a.owner.free_slot() == null:
			UI.toast("⚠️ پایگاهت جای خالی ندارد؛ قبل از رسیدن یک جا خالی کن", "bad")
		Game.start_steal(a, STEAL_U)
		return
	Sound.play("error"); UI.toast("🦹 برای دزدی وارد پایگاه یک حریف شو و کنار میمش برو", "bad")

func do_drop() -> void:
	var a := Game.player
	if a.carrying == null:
		Sound.play("click")
		return
	var u := a.carrying
	Game.return_unit(u); UI.toast("📦 " + u.c.name + " را رها کردی و به صاحبش برگشت", ""); Sound.play("poof")

# ---------------------------------------------------------------- camera
func update_camera(dt: float) -> void:
	var CAM := Game.CAM
	if not Game.playing:
		var t := menuT * 0.06
		camera.position = Vector3(sin(t) * 120, 48 + sin(t * 0.7) * 8, cos(t) * 95); camera.look_at(Vector3(0, 2, 0))
		Game.cam_pos = camera.position
		return
	var sens: float = S.sens
	cam_dx += UI.cam_dx; cam_dy += UI.cam_dy; UI.cam_dx = 0; UI.cam_dy = 0
	CAM.yaw -= cam_dx * 0.0055 * sens; CAM.pitch += cam_dy * 0.0045 * sens * (-1.0 if S.invertY else 1.0)
	Tutorial.rotAccum += absf(cam_dx) * 0.0055 * sens
	if Tutorial.rotAccum > 1.2:
		Tutorial.event("camera")
	cam_dx = 0; cam_dy = 0
	var p := Game.player.body.pos
	var piv := Game.cam_pivot
	piv.x = U.damp(piv.x, p.x, 20, dt); piv.z = U.damp(piv.z, p.z, 20, dt); piv.y = U.damp(piv.y, Game.player.renderY + 1.65, 12, dt)
	if absf(piv.x - p.x) > 6 or absf(piv.z - p.z) > 6:
		piv = Vector3(p.x, p.y + 1.65, p.z)
	Game.cam_pivot = piv
	var fp: bool = S.firstPerson
	Game.player.av.root.visible = not fp
	if fp:
		CAM.pitch = clampf(CAM.pitch, -0.5, 1.35)
		var lp: float = CAM.pitch - 0.38
		camera.position = Vector3(p.x, Game.player.renderY + 1.7, p.z)
		var dir := Vector3(-sin(CAM.yaw) * cos(lp), -sin(lp), -cos(CAM.yaw) * cos(lp))
		camera.look_at(camera.position + dir)
		Game.cam_pos = camera.position
		return
	CAM.pitch = clampf(CAM.pitch, -0.22, 1.25)
	var want: float = S.zoom + (1.5 if Game.player.carrying != null else 0.0)
	var cdir := Vector3(sin(CAM.yaw) * cos(CAM.pitch), sin(CAM.pitch), cos(CAM.yaw) * cos(CAM.pitch))
	var hit := Phys.ray_cast(piv, cdir, want + 0.4)
	var allowed := maxf(0.8, minf(want, hit - 0.35))
	CAM.cur = U.damp(CAM.cur, allowed, 30, dt) if allowed < CAM.cur else U.damp(CAM.cur, allowed, 4, dt)
	if CAM.cur > allowed + 0.05:
		CAM.cur = allowed + 0.05
	var cp: Vector3 = piv + cdir * float(CAM.cur)
	var fy: float = Phys.floor_at(cp.x, cp.z, 0.1, cp.y)[0]
	if cp.y < fy + 0.35:
		cp.y = fy + 0.35
	if CAM.shake > 0:
		CAM.shake -= dt; cp.x += U.rnd(-0.08, 0.08); cp.y += U.rnd(-0.08, 0.08)
	camera.position = cp
	camera.look_at(Vector3(piv.x, piv.y + 0.15, piv.z))
	Game.cam_pos = camera.position

# ---------------------------------------------------------------- main loop
func _process(dt: float) -> void:
	if not loaded:
		return
	dt = minf(dt, 0.1)
	var paused := Game.playing and UI.modal_open()
	if not paused:
		if Game.playing:
			player_control(dt)
		Game.simulate(dt)
		if Game.playing:
			compute_interact(dt); Tutorial.update(dt, Game.time)
	menuT += dt
	update_camera(dt)
	World.stars.position = camera.position
	if Game.playing:
		UI.frame(dt); UI.minimap_tick(dt)
	UI.world_labels(dt)
	lightT -= dt
	if lightT <= 0:
		lightT = 0.4; update_lights()
	if Game.playing and ((Game.saveQueued and Game.time - Game.lastSave > 2) or Game.time - Game.lastSave > 15):
		SaveSys.do_save()

func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST or what == NOTIFICATION_APPLICATION_PAUSED:
		if loaded and not Game.owners.is_empty() and not Game.resetting:
			SaveSys.do_save()
