## HUD, menus, modal panels, toasts, minimap and touch controls (autoload "UI"), Persian RTL.
extends CanvasLayer

var FONT: FontFile
var FONT_BOLD: FontFile
var FONT_BLACK: FontFile
var theme_: Theme
var root: Control
var main = null
# screens
var loading: Control; var load_bar: ProgressBar; var load_msg: Label
var menu: Control; var name_input: LineEdit; var save_info: Label; var play_btn: Button
var hud: Control
var money_val: Label; var income_val: Label; var chips: HBoxContainer; var chip_slot: Label; var chip_sec: Label; var chip_day: Label; var chip_ref: Label; var chip_boost: Label; var chip_reb: Label; var chip_event: Label
var carry_bar: Label; var alert_bar: Label; var tut_box: HBoxContainer; var tut_step: Label; var tut_text: Label
var toasts: VBoxContainer; var prompt: Label; var banner_t: Label; var banner_s: Label; var banner_box: VBoxContainer
var float_layer: Control; var floats: Array = []
var minimap: Control; var fps_label: Label
var menu_btns: Dictionary = {}
var btns: Dictionary = {}
var joy_base: Control; var joy_thumb: Control; var touch_area: Control
var panel: Control; var panel_title: Label; var panel_body: VBoxContainer; var panel_scroll: ScrollContainer; var panel_kind := ""
var confirm_box: Control; var confirm_title: Label; var confirm_text: Label; var confirm_cb = null
var flash_rect: ColorRect
# state
var shown_money := 0.0
var hud_t := 0.0
var map_t := 0.0
var labels_t := 0.0
var board_t := 0.0
var joy := Vector2.ZERO
var joy_active := false
var joy_id := -1
var joy_origin := Vector2.ZERO
var cam_ptrs: Dictionary = {}
var cam_dx := 0.0
var cam_dy := 0.0
var pinch := 0.0
var sprint_toggle := false
var shop_mode := "town"
var kiosk_ref = null
var wear_tab := "set"
var book := {"w": 1, "page": 0, "q": "", "only": false}
var mission_tab := "m"
var show_touch := false
var book_cache: Dictionary = {}
var map_bg_dirty := true
const JOY_R := 60.0

const INK := "#1b1446"
const COIN := "#ffd23f"
const CANDY := "#ff4f8b"
const MINT := "#3df2b0"
const MUTED := "#b9b2e6"
const DANGER := "#ff4a4a"

# ---------------------------------------------------------------- theme helpers
func sb(bg: String, radius: int = 14, border: String = "", bw: int = 0, pad: int = 10) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = Sign.css(bg)
	s.set_corner_radius_all(radius)
	if border != "":
		s.border_color = Sign.css(border); s.set_border_width_all(bw)
	s.set_content_margin_all(pad)
	return s

func lbl(text: String, size: int = 16, color: String = "#fff8ec", bold: bool = false, align: int = HORIZONTAL_ALIGNMENT_RIGHT) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", Sign.css(color))
	if bold:
		l.add_theme_font_override("font", FONT_BOLD)
	l.horizontal_alignment = align
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	return l

func btn(text: String, cb: Callable, kind: String = "soft", size: int = 16) -> Button:
	var b := Button.new()
	b.text = text
	b.add_theme_font_size_override("font_size", size)
	b.add_theme_font_override("font", FONT_BOLD)
	var bg := "#2a1f66"; var fg := "#fff8ec"
	match kind:
		"big": bg = CANDY; fg = "#ffffff"
		"buy": bg = "#1f7a52"; fg = "#eafff5"
		"red": bg = "#8a1f2a"; fg = "#ffe6e6"
		"act": bg = "#3a2f80"
	b.add_theme_stylebox_override("normal", sb(bg, 12, "rgba(255,255,255,.18)", 1, 8))
	var hv := sb(bg, 12, "#ffffff", 1, 8); hv.bg_color = hv.bg_color.lightened(0.12)
	b.add_theme_stylebox_override("hover", hv)
	b.add_theme_stylebox_override("pressed", sb(bg, 12, COIN, 2, 8))
	var ds := sb(bg, 12, "", 0, 8); ds.bg_color.a = 0.35
	b.add_theme_stylebox_override("disabled", ds)
	b.add_theme_color_override("font_color", Sign.css(fg))
	b.add_theme_color_override("font_hover_color", Color.WHITE)
	b.add_theme_color_override("font_disabled_color", Color(1, 1, 1, 0.45))
	b.pressed.connect(cb)
	b.focus_mode = Control.FOCUS_NONE
	return b

func hbox(sep: int = 8) -> HBoxContainer:
	var h := HBoxContainer.new(); h.add_theme_constant_override("separation", sep); return h
func vbox(sep: int = 8) -> VBoxContainer:
	var v := VBoxContainer.new(); v.add_theme_constant_override("separation", sep); return v

func panel_box(bg: String = "rgba(27,20,70,.86)", radius: int = 16, border: String = "rgba(255,255,255,.18)") -> PanelContainer:
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", sb(bg, radius, border, 1, 10))
	return p

func chip(text: String, color: String = "rgba(27,20,70,.75)") -> Label:
	var l := lbl(text, 13, "#fff8ec", true, HORIZONTAL_ALIGNMENT_CENTER)
	l.size_flags_horizontal = 0
	l.autowrap_mode = TextServer.AUTOWRAP_OFF
	var s := sb(color, 999, "rgba(255,255,255,.18)", 1, 4); s.content_margin_left = 10; s.content_margin_right = 10
	l.add_theme_stylebox_override("normal", s)
	return l

# ---------------------------------------------------------------- setup
func setup(main_: Node) -> void:
	main = main_
	layer = 10
	FONT = load("res://assets/fonts/Vazirmatn-Regular.ttf"); FONT_BOLD = load("res://assets/fonts/Vazirmatn-Bold.ttf"); FONT_BLACK = load("res://assets/fonts/Vazirmatn-Black.ttf")
	var emoji: FontFile = load("res://assets/fonts/NotoEmoji.ttf")
	for f in [FONT, FONT_BOLD, FONT_BLACK]:
		f.allow_system_fallback = true
		f.fallbacks = [emoji]
	theme_ = Theme.new(); theme_.default_font = FONT; theme_.default_font_size = 16
	root = Control.new(); root.name = "UIRoot"; root.set_anchors_preset(Control.PRESET_FULL_RECT); root.layout_direction = Control.LAYOUT_DIRECTION_RTL; root.theme = theme_; root.mouse_filter = Control.MOUSE_FILTER_PASS
	add_child(root)
	_build_touch(); _build_hud(); _build_loading(); _build_menu(); _build_panel(); _build_confirm()
	flash_rect = ColorRect.new(); flash_rect.color = Color(1, 1, 1, 0); flash_rect.set_anchors_preset(Control.PRESET_FULL_RECT); flash_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE; root.add_child(flash_rect)
	hud.visible = false; menu.visible = false; panel.visible = false; confirm_box.visible = false

func _build_loading() -> void:
	loading = ColorRect.new(); loading.color = Sign.css(INK); loading.set_anchors_preset(Control.PRESET_FULL_RECT); root.add_child(loading)
	var v := vbox(14); v.set_anchors_preset(Control.PRESET_CENTER); v.custom_minimum_size = Vector2(420, 0); v.grow_horizontal = Control.GROW_DIRECTION_BOTH; v.grow_vertical = Control.GROW_DIRECTION_BOTH; loading.add_child(v)
	var t := lbl("دزد میم‌ها", 44, COIN, true, HORIZONTAL_ALIGNMENT_CENTER); t.add_theme_font_override("font", FONT_BLACK); v.add_child(t)
	load_bar = ProgressBar.new(); load_bar.min_value = 0; load_bar.max_value = 100; load_bar.show_percentage = false; load_bar.custom_minimum_size = Vector2(420, 14)
	load_bar.add_theme_stylebox_override("background", sb("rgba(255,255,255,.12)", 7, "", 0, 0)); load_bar.add_theme_stylebox_override("fill", sb(CANDY, 7, "", 0, 0)); v.add_child(load_bar)
	load_msg = lbl("در حال آماده‌سازی…", 15, MUTED, false, HORIZONTAL_ALIGNMENT_CENTER); v.add_child(load_msg)

func set_load(p: float, msg: String) -> void:
	load_bar.value = p; load_msg.text = msg

func _build_menu() -> void:
	menu = ColorRect.new(); menu.color = Color(0.1, 0.08, 0.27, 0.55); menu.set_anchors_preset(Control.PRESET_FULL_RECT); root.add_child(menu)
	var card := panel_box("rgba(27,20,70,.92)", 22, "rgba(255,210,63,.45)"); card.set_anchors_preset(Control.PRESET_CENTER); card.grow_horizontal = Control.GROW_DIRECTION_BOTH; card.grow_vertical = Control.GROW_DIRECTION_BOTH; card.custom_minimum_size = Vector2(460, 0); menu.add_child(card)
	var v := vbox(10); card.add_child(v)
	var logo := lbl("دزد میم‌ها ۳بعدی", 40, COIN, true, HORIZONTAL_ALIGNMENT_CENTER); logo.add_theme_font_override("font", FONT_BLACK); v.add_child(logo)
	v.add_child(lbl("از روی نوار نقاله میم بخر، توی پایگاهت پول جمع کن و یواشکی از پایگاه حریف‌ها بدزد. فقط مواظب صاحب‌خونه باش!", 14, MUTED, false, HORIZONTAL_ALIGNMENT_CENTER))
	v.add_child(lbl("اسم تو", 13, MUTED, true))
	name_input = LineEdit.new(); name_input.max_length = 14; name_input.placeholder_text = "قهرمان"; name_input.add_theme_font_size_override("font_size", 18); name_input.alignment = HORIZONTAL_ALIGNMENT_CENTER
	name_input.add_theme_stylebox_override("normal", sb("rgba(255,255,255,.1)", 12, "rgba(255,255,255,.25)", 1, 8)); name_input.text_submitted.connect(func(_t): main.start_play()); v.add_child(name_input)
	play_btn = btn("▶ بازی کن", func(): main.start_play(), "big", 22); v.add_child(play_btn)
	save_info = lbl("", 13, MINT, false, HORIZONTAL_ALIGNMENT_CENTER); v.add_child(save_info)
	var row := hbox(8); row.alignment = BoxContainer.ALIGNMENT_CENTER; v.add_child(row)
	row.add_child(btn("⚙️ تنظیمات", func(): Sound.init(); open_settings()))
	row.add_child(btn("❔ راهنما", func(): open_help()))
	row.add_child(btn("🗑 شروع از اول", func(): confirm("شروع از اول", "همه‌ی پیشرفت ذخیره‌شده پاک می‌شود. مطمئنی؟", wipe_and_reload), "red"))
	v.add_child(lbl("نسخه ۱٫۰ · همه‌چیز روی دستگاه خودت ذخیره می‌شود", 11, MUTED, false, HORIZONTAL_ALIGNMENT_CENTER))

func show_menu() -> void:
	loading.visible = false; hud.visible = false; menu.visible = true; name_input.text = Game.name_; menu_info()
func hide_menu() -> void:
	menu.visible = false; hud.visible = true

func menu_info() -> void:
	if Game.owners.is_empty():
		return
	var o: Owner = Game.owners[0]
	var has := o.unit_count() > 0 or o.money != Data.START_MONEY or Game.playTime > 5
	save_info.text = ("💾 ادامه‌ی بازی: " + U.fmt(o.money) + " سکه · " + U.fa(o.unit_count()) + " میم · " + U.fmt_inc(o.income_per_sec())) if has else ("✨ بازی تازه — " + U.fa(int(Data.START_MONEY)) + " سکه برای شروع داری")
	play_btn.text = "▶ ادامه بده" if has else "▶ بازی کن"

func wipe_and_reload() -> void:
	Game.resetting = true; SaveSys.wipe(); get_tree().reload_current_scene()

# ---------------------------------------------------------------- HUD
func _mbtn(key: String, icon: String, tip: String, cb: Callable) -> Button:
	var b := btn(icon, cb, "soft", 20); b.tooltip_text = tip; b.custom_minimum_size = Vector2(44, 44)
	menu_btns[key] = b
	return b

func _tbtn(key: String, icon: String, text: String, down: Callable) -> Button:
	var b := btn(icon + "\n" + text, down, "soft", 12); b.custom_minimum_size = Vector2(64, 64)
	b.add_theme_stylebox_override("normal", sb("rgba(27,20,70,.78)", 32, "rgba(255,255,255,.3)", 2, 4))
	btns[key] = b
	return b

func _build_hud() -> void:
	hud = Control.new(); hud.set_anchors_preset(Control.PRESET_FULL_RECT); hud.mouse_filter = Control.MOUSE_FILTER_IGNORE; hud.layout_direction = Control.LAYOUT_DIRECTION_LTR; root.add_child(hud)
	# minimap (top-left)
	minimap = MiniMap.new(); minimap.ui = self; minimap.position = Vector2(10, 10); minimap.size = Vector2(200, 104); minimap.mouse_filter = Control.MOUSE_FILTER_IGNORE; hud.add_child(minimap)
	fps_label = lbl("FPS", 11, MUTED, false, HORIZONTAL_ALIGNMENT_LEFT); fps_label.position = Vector2(12, 116); fps_label.size = Vector2(200, 16); fps_label.visible = false; hud.add_child(fps_label)
	# top center column
	var top := vbox(6); top.set_anchors_preset(Control.PRESET_CENTER_TOP); top.grow_horizontal = Control.GROW_DIRECTION_BOTH; top.position.y = 8; top.custom_minimum_size = Vector2(520, 0); top.alignment = BoxContainer.ALIGNMENT_BEGIN; top.mouse_filter = Control.MOUSE_FILTER_IGNORE; hud.add_child(top)
	var pill := panel_box("rgba(35,26,90,.88)", 999, "rgba(255,210,63,.55)"); pill.size_flags_horizontal = Control.SIZE_SHRINK_CENTER; top.add_child(pill)
	var ph := hbox(10); ph.layout_direction = Control.LAYOUT_DIRECTION_RTL; pill.add_child(ph)
	var coin := lbl("$", 20, INK, true, HORIZONTAL_ALIGNMENT_CENTER); coin.size_flags_horizontal = 0; coin.custom_minimum_size = Vector2(30, 30); coin.add_theme_stylebox_override("normal", sb(COIN, 999, "", 0, 0)); ph.add_child(coin)
	money_val = lbl("۰", 22, "#fff8ec", true); money_val.add_theme_font_override("font", FONT_BLACK); money_val.size_flags_horizontal = 0; money_val.autowrap_mode = TextServer.AUTOWRAP_OFF; ph.add_child(money_val)
	income_val = lbl("+۰ در ثانیه", 13, MINT, false); income_val.size_flags_horizontal = 0; income_val.autowrap_mode = TextServer.AUTOWRAP_OFF; ph.add_child(income_val)
	chips = hbox(6); chips.alignment = BoxContainer.ALIGNMENT_CENTER; chips.layout_direction = Control.LAYOUT_DIRECTION_RTL; top.add_child(chips)
	chip_slot = chip("🏠 ۰/۴"); chip_sec = chip("🛡️ آماده"); chip_day = chip("☀️ روز"); chip_ref = chip("🛡️ ضدسیلی"); chip_boost = chip("", "rgba(255,79,139,.8)"); chip_reb = chip("♻️ ۰"); chip_event = chip("", "rgba(255,79,139,.8)")
	for c in [chip_slot, chip_sec, chip_day, chip_ref, chip_boost, chip_reb, chip_event]:
		chips.add_child(c)
	chip_ref.visible = false; chip_boost.visible = false; chip_reb.visible = false; chip_event.visible = false
	carry_bar = lbl("🏃 در حال دزدی! به پایگاهت برگرد ⬆", 14, "#fff", true, HORIZONTAL_ALIGNMENT_CENTER); carry_bar.add_theme_stylebox_override("normal", sb("rgba(200,30,60,.85)", 10, "#ffffff", 1, 6)); carry_bar.visible = false; top.add_child(carry_bar)
	alert_bar = lbl("", 13, "#fff", true, HORIZONTAL_ALIGNMENT_CENTER); alert_bar.add_theme_stylebox_override("normal", sb("rgba(200,30,60,.85)", 10, "#ffffff", 1, 6)); alert_bar.visible = false; top.add_child(alert_bar)
	tut_box = hbox(8); tut_box.visible = false; top.add_child(tut_box)
	var tp := panel_box("rgba(43,31,105,.92)", 12, COIN); tp.size_flags_horizontal = Control.SIZE_EXPAND_FILL; tut_box.add_child(tp)
	var th := hbox(8); th.layout_direction = Control.LAYOUT_DIRECTION_RTL; tp.add_child(th)
	tut_step = chip("۱/۷", COIN); tut_step.add_theme_color_override("font_color", Sign.css(INK)); th.add_child(tut_step)
	tut_text = lbl("", 14, "#fff8ec", true); th.add_child(tut_text)
	th.add_child(btn("رد کردن", func(): Tutorial.skip(), "soft", 12))
	toasts = vbox(4); toasts.mouse_filter = Control.MOUSE_FILTER_IGNORE; top.add_child(toasts)
	# menu buttons (top-right)
	var mb := hbox(6); mb.set_anchors_preset(Control.PRESET_TOP_RIGHT); mb.grow_horizontal = Control.GROW_DIRECTION_BEGIN; mb.position = Vector2(-10, 10); hud.add_child(mb)
	mb.add_child(_mbtn("missions", "📜", "ماموریت‌ها", func(): open_missions()))
	mb.add_child(_mbtn("daily", "🎁", "جایزه‌ی روزانه", func(): open_daily()))
	mb.add_child(_mbtn("leader", "🏆", "جدول برترها", func(): open_leader()))
	mb.add_child(_mbtn("book", "📖", "دانشنامه", func(): open_book()))
	mb.add_child(_mbtn("inv", "🎒", "کلکسیون من", func(): open_inventory()))
	mb.add_child(_mbtn("pause", "⏸", "توقف", func(): open_pause()))
	# prompt (bottom center)
	prompt = lbl("", 15, "#fff8ec", true, HORIZONTAL_ALIGNMENT_CENTER); prompt.set_anchors_preset(Control.PRESET_CENTER_BOTTOM); prompt.grow_horizontal = Control.GROW_DIRECTION_BOTH; prompt.grow_vertical = Control.GROW_DIRECTION_BEGIN; prompt.position.y = -92
	prompt.custom_minimum_size = Vector2(0, 0); prompt.size_flags_horizontal = 0; prompt.autowrap_mode = TextServer.AUTOWRAP_OFF
	prompt.add_theme_stylebox_override("normal", sb("rgba(27,20,70,.85)", 12, COIN, 1, 8)); prompt.visible = false; hud.add_child(prompt)
	# banner (center)
	banner_box = vbox(2); banner_box.set_anchors_preset(Control.PRESET_CENTER_TOP); banner_box.anchor_top = 0.3; banner_box.anchor_bottom = 0.3; banner_box.offset_left = -450; banner_box.offset_right = 450; banner_box.mouse_filter = Control.MOUSE_FILTER_IGNORE; hud.add_child(banner_box)
	banner_t = lbl("", 36, COIN, true, HORIZONTAL_ALIGNMENT_CENTER); banner_t.add_theme_font_override("font", FONT_BLACK); banner_t.add_theme_color_override("font_outline_color", Sign.css(INK)); banner_t.add_theme_constant_override("outline_size", 8); banner_box.add_child(banner_t)
	banner_s = lbl("", 18, "#fff8ec", true, HORIZONTAL_ALIGNMENT_CENTER); banner_s.add_theme_color_override("font_outline_color", Sign.css(INK)); banner_s.add_theme_constant_override("outline_size", 6); banner_box.add_child(banner_s)
	banner_box.modulate.a = 0
	float_layer = Control.new(); float_layer.set_anchors_preset(Control.PRESET_FULL_RECT); float_layer.mouse_filter = Control.MOUSE_FILTER_IGNORE; hud.add_child(float_layer)
	# joystick (bottom-left)
	joy_base = Control.new(); joy_base.custom_minimum_size = Vector2(JOY_R * 2, JOY_R * 2); joy_base.size = joy_base.custom_minimum_size; joy_base.mouse_filter = Control.MOUSE_FILTER_IGNORE; hud.add_child(joy_base)
	var jb := panel_box("rgba(255,255,255,.12)", 999, "rgba(255,255,255,.35)"); jb.set_anchors_preset(Control.PRESET_FULL_RECT); jb.mouse_filter = Control.MOUSE_FILTER_IGNORE; joy_base.add_child(jb)
	joy_thumb = panel_box("rgba(255,255,255,.55)", 999, "#ffffff"); joy_thumb.size = Vector2(44, 44); joy_thumb.position = Vector2(JOY_R - 22, JOY_R - 22); joy_thumb.mouse_filter = Control.MOUSE_FILTER_IGNORE; joy_base.add_child(joy_thumb)
	joy_rest()
	# action buttons (bottom-right)
	var grid := GridContainer.new(); grid.columns = 3; grid.add_theme_constant_override("h_separation", 8); grid.add_theme_constant_override("v_separation", 8)
	grid.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT); grid.grow_horizontal = Control.GROW_DIRECTION_BEGIN; grid.grow_vertical = Control.GROW_DIRECTION_BEGIN; grid.position = Vector2(-12, -12); hud.add_child(grid)
	grid.add_child(_tbtn("jump", "⤒", "پرش", func(): Game.player.jumpQ = 0.15))
	grid.add_child(_tbtn("sprint", "⚡", "دویدن", func(): sprint_toggle = not sprint_toggle))
	grid.add_child(_tbtn("interact", "✋", "تعامل", func(): main.do_interact()))
	grid.add_child(_tbtn("steal", "🦹", "دزدی", func(): main.do_steal()))
	grid.add_child(_tbtn("drop", "📦", "رها کن", func(): main.do_drop()))
	grid.add_child(_tbtn("cam", "🎥", "دوربین", func(): main.toggle_cam_mode()))
	grid.add_child(_tbtn("sec", "🛡️", "امنیت", func(): main.do_security()))
	grid.add_child(_tbtn("slap", "🥊", "سیلی", func(): main.do_slap()))
	grid.add_child(_tbtn("board", "🛹", "اسکیت", func(): Extras.toggle_board()))
	touch_btns_grid = grid

var touch_btns_grid: GridContainer

func _build_touch() -> void:
	touch_area = Control.new(); touch_area.set_anchors_preset(Control.PRESET_FULL_RECT); touch_area.mouse_filter = Control.MOUSE_FILTER_PASS; root.add_child(touch_area)
	touch_area.gui_input.connect(_touch_input)

func _touch_input(e: InputEvent) -> void:
	if main == null or main.ui_blocked() or not show_touch:
		return
	var W := root.size.x; var H := root.size.y
	if e is InputEventScreenTouch:
		if e.pressed:
			if e.position.x < W * 0.42 and joy_id < 0:
				joy_id = e.index; joy_origin = Vector2(clampf(e.position.x, JOY_R + 10, W * 0.42), clampf(e.position.y, JOY_R + 10, H - JOY_R - 10))
				joy_active = true; joy_base.position = joy_origin - Vector2(JOY_R, JOY_R); _joy_move(e.position)
			elif cam_ptrs.size() < 2:
				cam_ptrs[e.index] = e.position
				if cam_ptrs.size() == 2:
					pinch = _pinch_dist()
		else:
			if e.index == joy_id:
				joy_id = -1; joy_active = false; joy = Vector2.ZERO; joy_rest()
			if cam_ptrs.erase(e.index):
				pinch = _pinch_dist() if cam_ptrs.size() == 2 else 0.0
		touch_area.accept_event()
	elif e is InputEventScreenDrag:
		if e.index == joy_id:
			_joy_move(e.position)
		elif cam_ptrs.has(e.index):
			if cam_ptrs.size() == 2:
				cam_ptrs[e.index] = e.position
				var d := _pinch_dist()
				if pinch > 0:
					S.zoom = clampf(S.zoom - (d - pinch) * 0.03, 3, 14)
				pinch = d
			else:
				cam_dx += e.position.x - cam_ptrs[e.index].x; cam_dy += e.position.y - cam_ptrs[e.index].y; cam_ptrs[e.index] = e.position
		touch_area.accept_event()

func _pinch_dist() -> float:
	var v := cam_ptrs.values()
	return 0.0 if v.size() < 2 else v[0].distance_to(v[1])

func _joy_move(p: Vector2) -> void:
	var d := p - joy_origin
	var l := d.length()
	if l > JOY_R:
		d = d / l * JOY_R
	var m := minf(1.0, l / JOY_R); var dz: float = S.deadzone
	var mm := 0.0 if m < dz else (m - dz) / (1 - dz)
	var n := Vector2(d.x, -d.y).normalized() if l > 0 else Vector2.ZERO
	joy = n * mm
	joy_thumb.position = Vector2(JOY_R - 22, JOY_R - 22) + d

func joy_rest() -> void:
	joy_base.position = Vector2(36, root.size.y - 100 - JOY_R) if root else Vector2(36, 500)
	joy_thumb.position = Vector2(JOY_R - 22, JOY_R - 22)

# ---------------------------------------------------------------- notifications
func toast(msg: String, kind: String = "") -> void:
	if not Game.playing:
		return
	var l := lbl(msg, 14, "#fff8ec", true, HORIZONTAL_ALIGNMENT_CENTER)
	var bg := "rgba(27,20,70,.9)"
	match kind:
		"good": bg = "rgba(20,110,70,.92)"
		"bad": bg = "rgba(160,30,50,.92)"
		"rare": bg = "rgba(110,40,170,.95)"
	l.add_theme_stylebox_override("normal", sb(bg, 10, "rgba(255,255,255,.25)", 1, 7))
	toasts.add_child(l)
	while toasts.get_child_count() > 4:
		var old := toasts.get_child(0)
		toasts.remove_child(old); old.queue_free()
	var tw := create_tween(); tw.tween_interval(4.2 if kind == "rare" else 3.2); tw.tween_property(l, "modulate:a", 0.0, 0.32); tw.tween_callback(l.queue_free)

func banner(title: String, sub: String = "") -> void:
	if not Game.playing:
		return
	banner_t.text = title; banner_s.text = sub
	banner_box.modulate.a = 1; banner_box.scale = Vector2(0.8, 0.8); banner_box.pivot_offset = banner_box.size / 2
	var tw := create_tween(); tw.tween_property(banner_box, "scale", Vector2.ONE, 0.25).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT); tw.tween_interval(3.0); tw.tween_property(banner_box, "modulate:a", 0.0, 0.5)

func float_text(pos: Vector3, text: String, color: String) -> void:
	var f = null
	for x in floats:
		if x.life <= 0:
			f = x
			break
	if f == null:
		if floats.size() > 24:
			return
		var l := lbl(text, 22, color, true, HORIZONTAL_ALIGNMENT_CENTER); l.add_theme_font_override("font", FONT_BLACK); l.add_theme_color_override("font_outline_color", Sign.css(INK)); l.add_theme_constant_override("outline_size", 6); l.size_flags_horizontal = 0; l.autowrap_mode = TextServer.AUTOWRAP_OFF
		float_layer.add_child(l)
		f = {"el": l, "pos": Vector3.ZERO, "life": 0.0}; floats.append(f)
	f.pos = Vector3(pos.x, pos.y + 2.2, pos.z); f.life = 1.3; f.el.text = text; f.el.add_theme_color_override("font_color", Sign.css(color)); f.el.visible = true

func update_floats(dt: float) -> void:
	var cam: Camera3D = main.camera
	for f in floats:
		if f.life <= 0:
			continue
		f.life -= dt; f.pos.y += dt * 1.4
		if f.life <= 0:
			f.el.visible = false
			continue
		if cam.is_position_behind(f.pos):
			f.el.modulate.a = 0
			continue
		var sp := cam.unproject_position(f.pos)
		f.el.position = sp - f.el.size / 2; f.el.modulate.a = minf(1.0, f.life * 2)
		var sc := 1 + maxf(0.0, f.life - 1) * 1.2
		f.el.scale = Vector2(sc, sc)

func flash() -> void:
	flash_rect.color.a = 0.8
	var tw := create_tween(); tw.tween_property(flash_rect, "color:a", 0.0, 0.5)

func tutorial_box(on: bool, step: String, text: String) -> void:
	tut_box.visible = on; tut_step.text = step; tut_text.text = text

func map_dirty() -> void:
	map_bg_dirty = true

# ---------------------------------------------------------------- HUD frame
func frame(dt: float) -> void:
	var o: Owner = Game.player.owner
	var prev := shown_money
	shown_money = o.money if absf(o.money - shown_money) < 1 else U.damp(shown_money, o.money, 9, dt)
	hud_t -= dt
	update_floats(dt)
	if hud_t > 0:
		return
	hud_t = 0.1
	money_val.text = U.fmt(shown_money)
	income_val.text = U.fmt_inc(o.income_per_sec())
	chip_slot.text = ("🏘️ " if o.bases.size() > 1 else "🏠 ") + U.fa(o.unit_count()) + "/" + U.fa(o.totalCap)
	if o.secT > 0:
		chip_sec.text = "🛡️ فعال " + U.fmt_time(o.secT); chip_sec.add_theme_color_override("font_color", Sign.css(MINT))
	elif o.secCd > 0:
		chip_sec.text = "🛡️ " + U.fmt_time(o.secCd); chip_sec.add_theme_color_override("font_color", Sign.css(MUTED))
	else:
		chip_sec.text = "🛡️ آماده"; chip_sec.add_theme_color_override("font_color", Color.html("#fff8ec"))
	chip_reb.visible = o.rebirths > 0
	if o.rebirths > 0:
		chip_reb.text = "♻️ ×" + U.fa("%.1f" % (1 + 0.5 * o.rebirths))
	chip_event.visible = Game.event != null
	if Game.event != null:
		chip_event.text = Game.event.def.emoji + " " + Game.event.def.name + " " + U.fmt_time(Game.event.t)
	var a := Game.player
	carry_bar.visible = a.carrying != null
	if a.carrying != null:
		var h: Vector3 = o.base.insidePos
		for b in o.bases:
			if U.dist2(b.insidePos, a.body.pos) < U.dist2(h, a.body.pos) and o.free_slot(b) != null and o.free_slot(b).base == b:
				h = b.insidePos
		var ang := atan2(h.x - a.body.pos.x, h.z - a.body.pos.z); var fwd: float = Game.CAM.yaw + PI
		var d := U.ang_diff(fwd, ang)
		var arrows := ["⬆", "↗", "➡", "↘", "⬇", "↙", "⬅", "↖"]
		var idx := int(roundf(-d / (PI / 4))) % 8
		if idx < 0:
			idx += 8
		carry_bar.text = "🏃 در حال دزدی! به پایگاهت برگرد " + arrows[idx]
	var alert = null
	for ag in Game.alerts.keys():
		var u: Unit = Game.alerts[ag]
		if ag.carrying == u and u.state == "carried" and u.owner == o:
			alert = [ag, u]
		else:
			Game.alerts.erase(ag)
	alert_bar.visible = alert != null
	if alert != null:
		alert_bar.text = "🚨 " + alert[0].owner.name + " دارد «" + alert[1].c.name + "» تو را می‌برد! دنبالش کن و لمسش کن"
	_prompt_frame(a, o)
	menu_btns.daily.modulate = Color(1, 0.85, 0.3) if Game.daily.last != U.today_key() else Color.WHITE
	menu_btns.missions.modulate = Color(0.6, 1, 0.7) if Missions.ready() else Color.WHITE
	chip_day.text = Day.label(); chip_ref.visible = Game.reflect
	chip_boost.visible = Game.boostT > 0
	if Game.boostT > 0:
		chip_boost.text = "⚡ درآمد ×۲ " + U.fmt_time(Game.boostT)
	btns.board.disabled = o.up.board == 0; btns.board.modulate = Color(0.7, 1, 0.8) if Extras.riding else Color.WHITE
	btns.slap.disabled = a.slapCd > 0
	btns.sec.disabled = o.secCd > 0; btns.sec.modulate = Color(0.7, 1, 0.8) if o.secT > 0 else Color.WHITE
	btns.sprint.modulate = Color(1, 0.95, 0.5) if sprint_toggle else Color.WHITE
	if S.fps:
		fps_label.text = "FPS " + U.fa(int(Engine.get_frames_per_second()))

func _prompt_frame(a: Agent, o: Owner) -> void:
	var R: Dictionary = main.INTERACT
	var text := ""; var lbl_ := "تعامل"; var cant := false
	var k := func(c: String) -> String: return "" if show_touch else " [" + c + "]"
	match R.kind:
		"buy": text = "خرید «" + R.unit.c.name + "» — " + U.fmt(R.price) + k.call("E"); lbl_ = "خرید"; cant = not R.ok
		"catch": text = "دزد را بزن و میمت را پس بگیر!" + k.call("E"); lbl_ = "بگیرش"
		"security": text = "روشن کردن سپر لیزری" + k.call("E"); lbl_ = "امنیت"
		"collect": text = "جمع‌آوری " + U.fmt(Game.pending_of(o, R.base)) + " سکه" + k.call("E"); lbl_ = "جمع کن"
		"plot": text = "🏠 خرید این زمین به‌عنوان پایگاه جدید — " + U.fmt(R.price) + " سکه" + k.call("E"); lbl_ = "خرید زمین"; cant = not R.ok
		"info": text = R.slot.unit.c.name + " · " + U.fmt_inc(R.slot.unit.income * o.income_mult()) + k.call("E"); lbl_ = "اطلاعات"
		"door":
			var st: String = R.base.door.state
			text = "🔧 در شکسته — در فروشگاه ارتقای پایگاه تعمیرش کن" if st == "broken" else (("🔓 باز کردن در آهنی خانه" if st == "closed" else "🔒 قفل کردن در") + k.call("E"))
			lbl_ = "باز کن" if st == "closed" else "قفل کن"
		"drill": text = "🔩 سوراخ کردن در آهنی " + R.base.owner.name + " با دریل برقی" + k.call("E") + " (دریل: " + U.fa(o.drills) + ")"; lbl_ = "دریل"; cant = o.drills <= 0
		"stopDrill": text = "🛑 جلوی دریل را بگیر!" + k.call("E"); lbl_ = "بگیرش"
		"drilling": text = "🔩 داری در را سوراخ می‌کنی… تکان نخور!"; cant = true
		"kiosk": text = ("👕 فروشگاه لباس پایگاه" if R.k.type == "wear" else ("⚡ فروشگاه سرعت پایگاه" if R.k.type == "speed" else "🛒 فروشگاه ارتقای پایگاه")) + k.call("E"); lbl_ = "فروشگاه"
		"shop":
			var x := a.body.pos.x
			text = ("🏕️ ورود به اردوگاه قطبی" if Phys.in_w4(x) else ("🛰️ ورود به آزمایشگاه ماه" if Phys.in_w5(x) else ("🎈 ورود به ایستگاه هوایی" if Phys.in_w3(x) else ("🔥 ورود به کارگاه گدازه" if Phys.in_w2(x) else "ورود به فروشگاه ارتقا")))) + k.call("E"); lbl_ = "فروشگاه"
		"board": text = "دیدن جدول برترها" + k.call("E"); lbl_ = "جدول"
		"portal": text = "🌀 برو داخل حلقه‌ی پرتال تا سفر کنی"; lbl_ = "پرتال"
		"fuse": text = "⚗️ دستگاه ترکیب: ۳ میم یکسان را یکی کن" + k.call("E"); lbl_ = "ترکیب"
		"carry": text = "🏃 به پایگاهت برگرد!" + k.call("G") + " رها کردن"
	if main.STEAL_U != null and a.carrying == null:
		text = (text + " · " if text != "" else "") + "دزدیدن «" + main.STEAL_U.c.name + "»" + k.call("F")
	prompt.visible = text != ""
	if text != "":
		prompt.text = text; prompt.add_theme_color_override("font_color", Sign.css(DANGER if cant else "#fff8ec"))
	btns.interact.text = "✋\n" + lbl_
	btns.interact.modulate = Color(0.7, 1, 0.8) if (R.kind != "" and R.kind != "carry") else Color.WHITE
	btns.steal.disabled = main.STEAL_U == null or a.carrying != null
	btns.drop.disabled = a.carrying == null

# ---------------------------------------------------------------- world labels (pads, consoles, owner tags, billboard)
func world_labels(dt: float) -> void:
	labels_t -= dt
	if labels_t > 0 or Game.owners.is_empty():
		return
	labels_t = 0.3
	for b in World.bases:
		var o: Owner = b.owner
		if b.ownerTag == null:
			continue
		if o == null:
			var pr := U.fmt(Game.plot_price(Game.owners[0]))
			b.ownerTag.set_bg("rgba(90,96,110,.9)", COIN)
			b.ownerTag.set_lines("sale" + pr, [{"t": "🏷️ زمین برای فروش", "size": 52, "color": "#fff", "weight": 900, "stroke": 5}, {"t": "💰 " + pr + " سکه", "size": 34, "color": COIN, "weight": 800}])
			continue
		var pk := U.fmt(Game.pending_of(o, b))
		b.padLabel.set_lines(pk, [{"t": "💰 " + pk, "size": 58, "color": COIN, "weight": 900, "stroke": 4}, {"t": "روی سکو برو" if o.isPlayer else "صندوق " + o.name, "size": 30, "color": "#ffffff", "weight": 700}])
		var st: Array = ["🛡️ فعال " + U.fmt_time(o.secT), MINT] if o.secT > 0 else (["⏳ " + U.fmt_time(o.secCd), MUTED] if o.secCd > 0 else ["🛡️ آماده", "#ffffff"])
		b.secLabel.set_lines(st[0], [{"t": st[0], "size": 50, "color": st[1], "weight": 900}, {"t": "سپر لیزری", "size": 28, "color": "#ffffffaa"}])
		var inc := U.fmt_inc(o.income_per_sec())
		b.ownerTag.set_bg(o.color + "dd", "#ffffff")
		b.ownerTag.set_lines(o.name + inc, [{"t": ("⭐ " if o.isPlayer else "") + o.name, "size": 56, "color": "#fff", "weight": 900, "stroke": 5}, {"t": inc, "size": 32, "color": MINT, "weight": 800}])
	board_t -= 0.3
	if board_t <= 0 and World.board != null:
		board_t = 3
		var rows := Game.owners.duplicate()
		rows.sort_custom(func(x, y): return x.net_worth() > y.net_worth())
		var lines := [{"t": "🏆 برترین‌های میدان میم", "size": 50, "color": COIN, "weight": 900}]
		var rsz := 21 if rows.size() > 13 else (26 if rows.size() > 9 else 38)
		var key := ""
		for i in mini(rows.size(), 12):
			var o: Owner = rows[i]
			lines.append({"t": U.fa(i + 1) + ". " + o.name + " — " + U.fmt(o.net_worth()) + " سکه", "size": rsz, "color": MINT if o.isPlayer else "#ffffff", "weight": 900 if o.isPlayer else 700})
			key += str(o.id) + ":" + str(int(o.net_worth())) + ","
		World.board.set_lines(key, lines)

func minimap_tick(dt: float) -> void:
	if not S.minimap:
		minimap.visible = false
		return
	minimap.visible = true
	map_t -= dt
	if map_t > 0:
		return
	map_t = 0.1
	minimap.queue_redraw()

# ---------------------------------------------------------------- settings
func apply_settings(quality_changed: bool) -> void:
	var Q := S.Q()
	if quality_changed and main != null:
		main.sun.shadow_enabled = Q.shadows
		World.detail.visible = Q.decor
	FX.set_quality(Q)
	Sound.apply()
	fps_label.visible = S.fps; minimap.visible = S.minimap
	show_touch = S.touch == "on" or (S.touch == "auto" and S.IS_TOUCH)
	joy_base.visible = show_touch; touch_btns_grid.visible = show_touch or S.touch == "on"
	touch_btns_grid.modulate.a = S.btnOpacity
	joy_base.modulate.a = S.btnOpacity
	S.save_settings()

# ---------------------------------------------------------------- panels
func modal_open() -> bool:
	return panel.visible or confirm_box.visible
func confirm_open() -> bool:
	return confirm_box.visible

func _build_panel() -> void:
	panel = ColorRect.new(); panel.color = Color(0, 0, 0, 0.55); panel.set_anchors_preset(Control.PRESET_FULL_RECT); root.add_child(panel)
	panel.gui_input.connect(func(e): if e is InputEventMouseButton and e.pressed: close_panel())
	var sheet := panel_box("rgba(27,20,70,.97)", 20, "rgba(255,255,255,.2)"); sheet.set_anchors_preset(Control.PRESET_CENTER); sheet.grow_horizontal = Control.GROW_DIRECTION_BOTH; sheet.grow_vertical = Control.GROW_DIRECTION_BOTH
	sheet.custom_minimum_size = Vector2(760, 600); panel.add_child(sheet)
	sheet.gui_input.connect(func(e): if e is InputEventMouseButton: sheet.accept_event())
	var v := vbox(8); sheet.add_child(v)
	var head := hbox(8); v.add_child(head)
	panel_title = lbl("پنل", 22, COIN, true); panel_title.add_theme_font_override("font", FONT_BLACK); head.add_child(panel_title)
	var x := btn("✕", func(): close_panel(), "soft", 18); x.custom_minimum_size = Vector2(40, 40); head.add_child(x)
	panel_scroll = ScrollContainer.new(); panel_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL; panel_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED; v.add_child(panel_scroll)
	panel_body = vbox(8); panel_body.size_flags_horizontal = Control.SIZE_EXPAND_FILL; panel_scroll.add_child(panel_body)

func open_panel(kind: String, title: String) -> void:
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	panel_kind = kind; panel_title.text = title
	for c in panel_body.get_children():
		panel_body.remove_child(c); c.queue_free()
	panel.visible = true; panel_scroll.scroll_vertical = 0
	joy_id = -1; joy_active = false; joy = Vector2.ZERO; joy_rest(); cam_ptrs.clear(); Sound.play("click")

## re-render keeping scroll
func refill(builder: Callable) -> void:
	var y := panel_scroll.scroll_vertical
	for c in panel_body.get_children():
		panel_body.remove_child(c); c.queue_free()
	builder.call()
	await get_tree().process_frame
	panel_scroll.scroll_vertical = y

func close_panel() -> void:
	panel.visible = false; panel_kind = ""; Game.schedule_save()

func refresh() -> void:
	match panel_kind:
		"shop": open_shop(true)
		"inv": open_inventory(true)
		"daily": open_daily(true)
		"settings": open_settings(true)
		"wear": open_wardrobe(true)

func _build_confirm() -> void:
	confirm_box = ColorRect.new(); confirm_box.color = Color(0, 0, 0, 0.6); confirm_box.set_anchors_preset(Control.PRESET_FULL_RECT); root.add_child(confirm_box)
	var sheet := panel_box("rgba(27,20,70,.98)", 20, DANGER); sheet.set_anchors_preset(Control.PRESET_CENTER); sheet.grow_horizontal = Control.GROW_DIRECTION_BOTH; sheet.grow_vertical = Control.GROW_DIRECTION_BOTH; sheet.custom_minimum_size = Vector2(460, 0); confirm_box.add_child(sheet)
	var v := vbox(10); sheet.add_child(v)
	confirm_title = lbl("مطمئنی؟", 20, COIN, true); v.add_child(confirm_title)
	confirm_text = lbl("", 15); v.add_child(confirm_text)
	var row := hbox(8); v.add_child(row)
	row.add_child(btn("بله", func(): confirm_close(true), "red"))
	row.add_child(btn("نه، بی‌خیال", func(): confirm_close(false)))

func confirm(title: String, text: String, cb: Callable) -> void:
	confirm_title.text = title; confirm_text.text = text; confirm_cb = cb; confirm_box.visible = true

func confirm_close(yes: bool) -> void:
	confirm_box.visible = false
	var cb = confirm_cb; confirm_cb = null
	if yes and cb != null:
		cb.call()

# ---------------------------------------------------------------- panel content helpers
func note(text: String) -> Label:
	var l := lbl(text, 14, MUTED); return l

## upgrade-style row: emoji | title + small + level bars | button
func up_row(emoji: String, title: String, small: String, lvl: int, mx: int, btn_text: String, disabled: bool, cb: Callable, kind: String = "buy", border: String = "") -> PanelContainer:
	var p := panel_box("rgba(255,255,255,.06)", 12, border if border != "" else "rgba(255,255,255,.12)")
	var h := hbox(10); p.add_child(h)
	var e := lbl(emoji, 28, "#fff", false, HORIZONTAL_ALIGNMENT_CENTER); e.size_flags_horizontal = 0; e.custom_minimum_size = Vector2(44, 0); e.autowrap_mode = TextServer.AUTOWRAP_OFF; h.add_child(e)
	var v := vbox(2); v.size_flags_horizontal = Control.SIZE_EXPAND_FILL; h.add_child(v)
	v.add_child(lbl(title, 15, "#fff8ec", true))
	if small != "":
		v.add_child(lbl(small, 12, MUTED))
	if mx > 0:
		var bars := hbox(3)
		for i in mx:
			var bar := ColorRect.new(); bar.custom_minimum_size = Vector2(18, 6); bar.color = Sign.css(MINT) if i < lvl else Color(1, 1, 1, 0.15); bars.add_child(bar)
		v.add_child(bars)
	if btn_text != "":
		var b := btn(btn_text, cb, kind, 14); b.disabled = disabled; b.size_flags_horizontal = 0; b.size_flags_vertical = Control.SIZE_SHRINK_CENTER; h.add_child(b)
	return p

func tabs(items: Array, cur: String, cb: Callable) -> HBoxContainer:
	var h := hbox(6)
	for it in items:
		var b := btn(it[1], cb.bind(it[0]), "act" if it[0] == cur else "soft", 14)
		if it[0] == cur:
			b.add_theme_stylebox_override("normal", sb(CANDY, 12, "#ffffff", 1, 8))
		h.add_child(b)
	return h

func card(top_emoji: String, title: String, rar: String, rar_color: String, small_lines: Array, buttons: Array, border: String = "rgba(255,255,255,.12)", dim: bool = false) -> PanelContainer:
	var p := panel_box("rgba(255,255,255,.06)", 12, border); p.custom_minimum_size = Vector2(230, 0)
	if dim:
		p.modulate.a = 0.6
	var v := vbox(4); p.add_child(v)
	var h := hbox(8); v.add_child(h)
	var e := lbl(top_emoji, 26, "#fff", false, HORIZONTAL_ALIGNMENT_CENTER); e.size_flags_horizontal = 0; e.autowrap_mode = TextServer.AUTOWRAP_OFF; h.add_child(e)
	var tv := vbox(2); tv.size_flags_horizontal = Control.SIZE_EXPAND_FILL; h.add_child(tv)
	tv.add_child(lbl(title, 14, "#fff8ec", true))
	if rar != "":
		var rc := chip(rar, rar_color); rc.add_theme_color_override("font_color", Sign.css(INK)); tv.add_child(rc)
	for s in small_lines:
		v.add_child(lbl(s, 12, MUTED))
	for bt in buttons:
		var b := btn(bt[0], bt[1], bt[2] if bt.size() > 2 else "act", 13); b.disabled = bt[3] if bt.size() > 3 else false; v.add_child(b)
	return p

func grid(cols: int = 3) -> GridContainer:
	var g := GridContainer.new(); g.columns = cols; g.add_theme_constant_override("h_separation", 8); g.add_theme_constant_override("v_separation", 8); return g

# ---------------------------------------------------------------- the panels
func kiosk_base() -> BaseVis:
	if kiosk_ref == null:
		return null
	for b in World.bases:
		if b.kiosks.has(kiosk_ref):
			return b
	return null

func open_shop(re: bool = false, mode: String = "town") -> void:
	if not re:
		shop_mode = mode
		if shop_mode == "town":
			kiosk_ref = null
	var M := shop_mode; var kiosk := M != "town"
	var o: Owner = Game.player.owner; var wn := 1 if kiosk else Phys.world_of(Game.player.body.pos.x); var w2 := wn > 1
	var title := "⚡ فروشگاه سرعت پایگاه" if M == "speed" else ("🛒 فروشگاه پایگاه" if M == "base" else ("🏕️ اردوگاه قطبی" if wn == 4 else ("🛰️ آزمایشگاه ماه" if wn == 5 else ("🎈 ایستگاه هوایی" if wn == 3 else ("🔥 کارگاه گدازه" if w2 else "🛒 فروشگاه ارتقا")))))
	var build := func() -> void:
		var runV: float = 6.4 * (1 + 0.07 * o.up.speed) * (1.1 if o.up.petBird > 0 else 1.0); var carryV: float = runV * 1.15 * (1 + 0.08 * o.up.carrySpeed)
		var intro: String
		if M == "speed":
			intro = "⚡ ربات فروشنده‌ی سرعت: «کتونی فشفشه» سرعت دویدن معمولی‌ات را بالا می‌برد و «کفش دزد فرز» سرعتت را موقع بردن میم دزدی. (سرعت الان: دویدن " + U.fa("%.1f" % runV) + " و با میم دزدی " + U.fa("%.1f" % carryV) + " متر بر ثانیه؛ با Shift یا دکمه‌ی دویدن ۵۰٪ تندتر)"
		elif M == "base":
			intro = "🤖 فروشگاه کوچک پایگاه خودت: ظرفیت، درآمد، سپر، پت‌ها و بقیه‌ی وسایل را همین‌جا بخر — حتی وقتی رئیس دزدها در شهر است و نمی‌خواهی از پایگاه بیرون بروی."
		elif wn == 4:
			intro = "🧭 کاشف قطبی وسایل مخصوص یخبندان را دستت می‌دهد: کفش میخ‌دار برای یخ لیز، پالتو برای کولاک و سپر برفی. با «تولد دوباره» از بین نمی‌روند."
		elif wn == 5:
			intro = "🔬 دانشمند ماه ابزارهای فضایی را دستت می‌دهد: جت‌پک، لباس ضدلیزر و چکمه‌ی ماه‌نورد. با «تولد دوباره» از بین نمی‌روند."
		elif wn == 3:
			intro = "🪂 خلبان ایستگاه هوایی وسایل مخصوص جزیره‌های آسمانی را دستت می‌دهد. این وسایل با «تولد دوباره» از بین نمی‌روند."
		elif w2:
			intro = "🔥 آهنگرِ گدازه ابزارهای مخصوص سیاره‌ی گدازه را می‌سازد و دستت می‌دهد. این ابزارها با «تولد دوباره» از بین نمی‌روند."
		else:
			intro = "🧑‍🍳 سفارشت را بده؛ مغازه‌دار ارتقا را از پشت پیشخوان دستت می‌دهد."
		panel_body.add_child(note(intro))
		panel_body.add_child(note("موجودی: " + U.fmt(o.money) + " سکه · درآمد: " + U.fmt_inc(o.income_per_sec())))
		if M == "base":
			house_rows(o)
		for k in Data.UP_KEYS:
			if Data.up_shop(k) != wn:
				continue
			if M == "speed" and not Data.SPEED_KEYS.has(k):
				continue
			if M == "base" and Data.SPEED_KEYS.has(k):
				continue
			var U_: Dictionary = Data.UPGRADES[k]; var l: int = o.up[k]; var mx: bool = l >= U_.max; var cost := 0.0 if mx else Data.up_cost(k, l)
			panel_body.add_child(up_row(U_.emoji, U_.name, "به حداکثر رسیده" if mx else U_.desc.call(l), l, U_.max, "کامل" if mx else "💰 " + U.fmt(cost), mx or o.money < cost, func(): Shop.order(k)))
		if not (w2 or M == "speed"):
			var rc := Data.rebirth_cost(o.rebirths)
			panel_body.add_child(up_row("♻️", "تولد دوباره (سطح " + U.fa(o.rebirths) + ")", "پول، میم‌ها و ارتقاها صفر می‌شوند؛ در عوض درآمدت برای همیشه ×" + U.fa("%.1f" % (1 + 0.5 * (o.rebirths + 1))) + " می‌شود و با پول بیشتری شروع می‌کنی.", 0, 0, "💰 " + U.fmt(rc), o.money < rc,
				func(): confirm("تولد دوباره؟", "همه‌ی پول، میم‌ها و ارتقاهای تو صفر می‌شوند ولی درآمدت برای همیشه بیشتر می‌شود.", func(): if Game.rebirth(): close_panel()), "red", CANDY))
	if re:
		refill(build)
	else:
		open_panel("shop", title); build.call()

func house_rows(o: Owner) -> void:
	var b := kiosk_base()
	if b == null:
		return
	var d = b.door
	var small: String
	if d != null:
		small = "⚠️ با دریل سوراخ شده! تعمیرش کن تا دوباره قفل شود." if d.state == "broken" else "✅ نصب شده — فقط خودت بازش می‌کنی؛ فقط با دریل برقی می‌شود سوراخش کرد."
	else:
		small = "هیچ‌کس جز تو نمی‌تواند بازش کند. حریف‌ها فقط با دریل برقیِ خیلی گران (که به‌ندرت پیش می‌آید) می‌توانند سوراخش کنند — و تو می‌توانی جلویشان را بگیری."
	var bt: String; var dis: bool; var cb: Callable
	if d != null and d.state == "broken":
		bt = "🔧 " + U.fmt(House.DOOR_REPAIR); dis = o.money < House.DOOR_REPAIR
		cb = func():
			if b.door != null and b.door.state == "broken" and o.money >= House.DOOR_REPAIR:
				o.money -= House.DOOR_REPAIR; House.repair(b); open_shop(true); toast("🔧 در آهنی تعمیر و قفل شد", "good"); Game.schedule_save(true)
	elif d != null:
		bt = "نصب شده"; dis = true; cb = func(): pass
	else:
		bt = "💰 " + U.fmt(House.DOOR_PRICE); dis = o.money < House.DOOR_PRICE
		cb = func():
			if b.door == null and o.money >= House.DOOR_PRICE:
				o.money -= House.DOOR_PRICE; House.install(b, false); close_panel(); banner("🚪 در آهنی نصب شد!", "حالا میم‌های خانه‌ی امن فقط با دریل برقی دزدیده می‌شوند"); Sound.play("success"); Missions.event("shop"); Game.schedule_save(true)
	panel_body.add_child(up_row("🚪", "در آهنی قفل‌دار برای خانه‌ی امن همین پایگاه", small, 0, 0, bt, dis, cb, "buy", "#c0c8d0"))
	panel_body.add_child(up_row("🔩", "دریل برقی (" + U.fa(o.drills) + " عدد داری)", "با آن می‌توانی در آهنی خانه‌ی حریف‌ها را سوراخ کنی و میم‌های خاصشان را بدزدی. " + U.fa(int(House.DRILL_DUR.player)) + " ثانیه طول می‌کشد و اگر صاحب‌خانه یا نگهبانش برسد، کار نیمه‌تمام می‌ماند. هر دریل یک بار مصرف است.", 0, 0, "💰 " + U.fmt(House.DRILL_PRICE), o.money < House.DRILL_PRICE,
		func():
			if o.money >= House.DRILL_PRICE:
				o.money -= House.DRILL_PRICE; o.drills += 1; Sound.play("buy"); toast("🔩 یک دریل برقی خریدی! برو کنار در آهنی خانه‌ی یک حریف", "rare"); open_shop(true); Game.schedule_save(true)))

func unit_card(s: Dictionary, o: Owner) -> PanelContainer:
	var u: Unit = s.unit; var r: Dictionary = Data.RARITIES[u.c.rarity]; var mu: Dictionary = Data.MUTATIONS[u.mut]
	var stars := ""
	for i in u.lvl:
		stars += "⭐"
	var st := "🚶 در راه پایگاه" if u.state == "transit" else ("🦹 در حال دزدیده شدن!" if u.state == "carried" else "✅ در پایگاه")
	var buttons := []
	if s.vault:
		buttons.append(["↩️ بیار بیرون از خانه", func(): House.from_vault(o, s); open_inventory(true), "act", u.state != "slotted"])
	else:
		var has_vault := false
		for x in o.slots:
			if x.vault and x.base == s.base and x.unit == null:
				has_vault = true
		buttons.append(["🏠 بفرست به خانه‌ی امن", func(): House.to_vault(o, s); open_inventory(true), "act", u.state != "slotted" or not has_vault])
	if u.lvl < 5:
		buttons.append(["⭐ ارتقا به سطح " + U.fa(u.lvl + 1) + " (" + U.fmt(Extras.level_cost(u)) + ")", func():
			if Extras.level_unit(o, s):
				if panel_kind == "unit":
					open_unit(s)
				else:
					open_inventory(true), "buy", u.state != "slotted" or o.money < Extras.level_cost(u)])
	buttons.append(["فروش (+" + U.fmt(floorf(u.price * 0.5)) + ")", func(): confirm("فروش میم", "مطمئنی می‌خواهی «" + u.c.name + "» را به قیمت " + U.fmt(floorf(u.price * 0.5)) + " بفروشی؟", func():
		Game.sell_unit(o, s)
		if panel_kind == "unit":
			close_panel()
		else:
			open_inventory(true)), "red", u.state != "slotted"])
	var lines := [U.fmt_inc(u.income * o.income_mult()) + " · ارزش " + U.fmt(u.price), st]
	if u.lvl >= 5:
		lines.append("⭐⭐⭐⭐⭐ حداکثر سطح")
	return card(u.c.emoji, (stars + " " if stars != "" else "") + ((mu.name + " · ") if mu.name != "" else "") + u.c.name, r.name, r.color, lines, buttons)

func empty_card(emoji: String, text: String) -> PanelContainer:
	return card(emoji, "", "", "", [text], [], "rgba(255,255,255,.12)", true)

func open_inventory(re: bool = false) -> void:
	var o: Owner = Game.player.owner
	var build := func() -> void:
		var next := (" · زمین بعدی: " + U.fmt(Game.plot_price(o)) + " سکه (کنار تابلوی «برای فروش» برو)") if o.bases.size() < World.bases.size() else ""
		panel_body.add_child(note(U.fa(o.unit_count()) + " از " + U.fa(o.totalCap) + " جا پر است · " + U.fa(o.bases.size()) + " پایگاه · ظرفیت هر پایگاه را از فروشگاه بیشتر کن" + next + ". فروش، نصف ارزش میم را برمی‌گرداند."))
		for bi in o.bases.size():
			var b: BaseVis = o.bases[bi]
			panel_body.add_child(lbl((Data.WORLD_EMOJI[b.world] + " پایگاه " + Data.WORLD_NAMES[b.world]) if b.world > 1 else ("🏠 پایگاه " + U.fa(bi + 1)), 16, COIN, true))
			var g := grid(3); panel_body.add_child(g)
			for s in o.slots:
				if s.base == b and s.li < o.cap:
					g.add_child(unit_card(s, o) if s.unit != null else empty_card("➕", "جای خالی — از نوار نقاله بخر یا بدزد"))
			var ds := "⚠️ در آهنی شکسته — تعمیرش کن!" if (b.door != null and b.door.state == "broken") else ("🔒 در آهنی قفل‌دار دارد" if b.door != null else "🚪 در ندارد؛ هر کسی می‌تواند وارد شود (در آهنی را از فروشگاه ارتقای پایگاه بخر)")
			panel_body.add_child(lbl("🏠 خانه‌ی امن این پایگاه · " + ds, 12, "#ffd9a0"))
			var g2 := grid(4); panel_body.add_child(g2)
			for s in o.slots:
				if s.base == b and s.vault:
					g2.add_child(unit_card(s, o) if s.unit != null else empty_card("🔐", "جای خالی خانه‌ی امن"))
	if re:
		refill(build)
	else:
		open_panel("inv", "🎒 کلکسیون من"); build.call()

func open_unit(slot: Dictionary) -> void:
	var o: Owner = Game.player.owner
	if slot.unit == null:
		return
	open_panel("unit", "میم تو")
	var g := grid(2); panel_body.add_child(g); g.add_child(unit_card(slot, o))
	panel_body.add_child(note("این میم هر ثانیه برایت پول می‌سازد. پول‌ها روی سکوی سبز جمع می‌شوند."))

func book_list(w: int) -> Array:
	if not book_cache.has(w):
		book_cache[w] = Data.chars_of_world(w)
	return book_cache[w]

func open_book(re: bool = false) -> void:
	var st := book; var PER := 48
	var build := func() -> void:
		var all := book_list(st.w); var q: String = st.q
		var list := []
		for c in all:
			var known := Game.discovered.has(c.id)
			if (not st.only or known) and (q == "" or (known and c.name.contains(q))):
				list.append(c)
		var pages := maxi(1, int(ceilf(list.size() / float(PER)))); st.page = clampi(st.page, 0, pages - 1)
		panel_body.add_child(note(U.fa(Data.CHARS.size()) + " میم در ۵ دنیا · کشف‌شده: " + U.fa(Game.discovered.size()) + " · هر ۵۰ کشف تازه یک جایزه دارد. نسخه‌های طلایی ×۲، الماسی ×۳، رنگین‌کمانی ×۶ و میم‌های دنیاهای دور هزاران برابر می‌ارزند."))
		var items := []
		for w in range(1, 6):
			var L := book_list(w); var k := 0
			for c in L:
				if Game.discovered.has(c.id):
					k += 1
			items.append([str(w), Data.WORLD_EMOJI[w] + " " + U.fa(k) + "/" + U.fa(L.size())])
		panel_body.add_child(tabs(items, str(st.w), func(w): st.w = int(w); st.page = 0; open_book(true); Sound.play("click")))
		var row := hbox(8); panel_body.add_child(row)
		var search := LineEdit.new(); search.placeholder_text = "🔎 جستجو بین میم‌های کشف‌شده…"; search.text = q; search.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		search.text_changed.connect(func(t): st.q = t.strip_edges(); st.page = 0; open_book(true)); row.add_child(search)
		row.add_child(btn("👁️ همه" if st.only else "✅ فقط کشف‌شده‌ها", func(): st.only = not st.only; st.page = 0; open_book(true), "act", 13))
		panel_body.add_child(lbl(Data.WORLD_EMOJI[st.w] + " " + Data.WORLD_NAMES[st.w] + " · " + U.fa(list.size()) + " میم", 16, COIN, true))
		var pager := func() -> HBoxContainer:
			var h := hbox(8); h.alignment = BoxContainer.ALIGNMENT_CENTER
			var prev := btn("→ قبلی", func(): st.page -= 1; open_book(true), "act", 13); prev.disabled = st.page <= 0; h.add_child(prev)
			h.add_child(lbl("صفحه‌ی " + U.fa(st.page + 1) + " از " + U.fa(pages), 14, "#fff8ec", true, HORIZONTAL_ALIGNMENT_CENTER))
			var nxt := btn("بعدی ←", func(): st.page += 1; open_book(true), "act", 13); nxt.disabled = st.page >= pages - 1; h.add_child(nxt)
			return h
		if pages > 1:
			panel_body.add_child(pager.call())
		var g := grid(3); panel_body.add_child(g)
		for c in list.slice(st.page * PER, st.page * PER + PER):
			var r: Dictionary = Data.RARITIES[c.rarity]; var known := Game.discovered.has(c.id)
			g.add_child(card(c.emoji if known else "❔", c.name if known else "؟؟؟", r.name, r.color, [("💰 " + U.fmt(c.price) + " · " + U.fmt_inc(c.income)) if known else "هنوز کشف نشده — بخر یا بدزد!"], [], r.color + "55"))
		if list.is_empty():
			panel_body.add_child(note("چیزی پیدا نشد."))
		if pages > 1:
			panel_body.add_child(pager.call())
	if re:
		refill(build)
	else:
		open_panel("book", "📖 دانشنامه‌ی میم‌ها"); build.call()

func open_leader() -> void:
	open_panel("leader", "🏆 جدول برترها")
	var rows := Game.owners.duplicate(); rows.sort_custom(func(x, y): return x.net_worth() > y.net_worth())
	for i in rows.size():
		var o: Owner = rows[i]
		var p := panel_box("rgba(61,242,176,.12)" if o.isPlayer else "rgba(255,255,255,.06)", 10, MINT if o.isPlayer else "rgba(255,255,255,.1)")
		var h := hbox(10); p.add_child(h)
		var rk := lbl(U.fa(i + 1), 18, COIN, true, HORIZONTAL_ALIGNMENT_CENTER); rk.size_flags_horizontal = 0; rk.custom_minimum_size = Vector2(32, 0); h.add_child(rk)
		var sw := ColorRect.new(); sw.color = Color.html(o.color); sw.custom_minimum_size = Vector2(14, 14); sw.size_flags_vertical = Control.SIZE_SHRINK_CENTER; h.add_child(sw)
		h.add_child(lbl(o.name, 15, "#fff8ec", true))
		var vl := lbl("ارزش " + U.fmt(o.net_worth()) + "\n" + U.fmt_inc(o.income_per_sec()), 12, MUTED, false, HORIZONTAL_ALIGNMENT_LEFT); vl.size_flags_horizontal = 0; vl.custom_minimum_size = Vector2(200, 0); h.add_child(vl)
		panel_body.add_child(p)
	panel_body.add_child(note("ارزش کل = پول + قیمت همه‌ی میم‌های پایگاه. آمار تو: " + U.fa(Game.stats.bought) + " خرید · " + U.fa(Game.stats.stolen) + " دزدی موفق · " + U.fa(Game.stats.caught) + " دزد گرفته‌شده"))

func daily_reward(day: int) -> float:
	var o: Owner = Game.player.owner
	return roundf(maxf(Data.DAILY[day - 1], o.income_per_sec() * 20 * day) * (1 + o.rebirths))

func next_streak() -> int:
	return (Game.daily.streak % 7) + 1 if Game.daily.last == U.yesterday_key() else 1

func open_daily(re: bool = false) -> void:
	var build := func() -> void:
		var can: bool = Game.daily.last != U.today_key(); var nxt: int = next_streak() if can else int(Game.daily.streak)
		var g := grid(7); panel_body.add_child(g)
		for i in 7:
			var d: int = i + 1; var done: bool = (d < nxt) if can else (d <= nxt); var today: bool = can and d == nxt
			var p := panel_box("rgba(61,242,176,.18)" if done else ("rgba(255,210,63,.2)" if today else "rgba(255,255,255,.06)"), 12, COIN if today else "rgba(255,255,255,.12)")
			var v := vbox(2); p.add_child(v)
			v.add_child(lbl("💎" if d == 7 else ("✅" if done else "🎁"), 26, "#fff", false, HORIZONTAL_ALIGNMENT_CENTER))
			v.add_child(lbl("روز " + U.fa(d), 13, "#fff8ec", true, HORIZONTAL_ALIGNMENT_CENTER))
			v.add_child(lbl(U.fmt(daily_reward(d)), 12, MUTED, false, HORIZONTAL_ALIGNMENT_CENTER))
			g.add_child(p)
		var b := btn("🎁 دریافت جایزه‌ی امروز" if can else "فردا دوباره سر بزن!", func(): claim_daily(), "big", 18); b.disabled = not can; panel_body.add_child(b)
		panel_body.add_child(note("هر روز پشت سر هم بیایی، جایزه بزرگ‌تر می‌شود. اگر یک روز جا بیندازی، از روز اول شروع می‌شود."))
	if re:
		refill(build)
	else:
		open_panel("daily", "🎁 جایزه‌ی روزانه"); build.call()

func claim_daily() -> void:
	if Game.daily.last == U.today_key():
		return
	var st := next_streak(); var r := daily_reward(st)
	Game.daily = {"last": U.today_key(), "streak": st}; Game.player.owner.money += r
	Sound.play("success"); toast("🎁 جایزه‌ی روز " + U.fa(st) + ": " + U.fmt(r) + " سکه!", "good"); Game.schedule_save(true); open_daily(true)

func set_row(label: String, ctrl: Control) -> HBoxContainer:
	var h := hbox(10)
	var l := lbl(label, 14, "#fff8ec"); h.add_child(l)
	ctrl.size_flags_horizontal = 0
	h.add_child(ctrl)
	return h

func seg(opts: Array, val: String, cb: Callable) -> HBoxContainer:
	var h := hbox(4)
	for o in opts:
		var b := btn(o[1], cb.bind(o[0]), "act" if o[0] == val else "soft", 13)
		if o[0] == val:
			b.add_theme_stylebox_override("normal", sb(CANDY, 10, "#ffffff", 1, 6))
		h.add_child(b)
	return h

func tgl(key: String) -> CheckButton:
	var c := CheckButton.new(); c.button_pressed = S.get(key)
	c.toggled.connect(func(on): S.set(key, on); apply_settings(false); Sound.play("click")); c.focus_mode = Control.FOCUS_NONE
	return c

func rng(key: String, mn: float, mx: float, step: float) -> HSlider:
	var s := HSlider.new(); s.min_value = mn; s.max_value = mx; s.step = step; s.value = S.get(key); s.custom_minimum_size = Vector2(220, 20)
	s.value_changed.connect(func(v): S.set(key, v); apply_settings(false)); s.focus_mode = Control.FOCUS_NONE
	return s

func open_settings(re: bool = false) -> void:
	var build := func() -> void:
		panel_body.add_child(set_row("کیفیت گرافیک", seg([["low", "کم"], ["medium", "متوسط"], ["high", "بالا"]], S.quality, func(v): S.quality = v; apply_settings(true); open_settings(true); Sound.play("click"))))
		panel_body.add_child(set_row("حساسیت دوربین", rng("sens", 0.2, 2.5, 0.05)))
		panel_body.add_child(set_row("ناحیه‌ی مرده‌ی جوی‌استیک", rng("deadzone", 0, 0.45, 0.01)))
		panel_body.add_child(set_row("فاصله‌ی دوربین (زوم)", rng("zoom", 3, 14, 0.1)))
		panel_body.add_child(set_row("شفافیت دکمه‌ها", rng("btnOpacity", 0.3, 1, 0.02)))
		panel_body.add_child(set_row("بلندی صدا", rng("volume", 0, 1, 0.05)))
		panel_body.add_child(set_row("موسیقی پس‌زمینه", tgl("music")))
		panel_body.add_child(set_row("جلوه‌های صوتی", tgl("sfx")))
		panel_body.add_child(set_row("دوربین اول‌شخص", tgl("firstPerson")))
		panel_body.add_child(set_row("معکوس کردن محور عمودی", tgl("invertY")))
		panel_body.add_child(set_row("نقشه‌ی کوچک", tgl("minimap")))
		panel_body.add_child(set_row("نمایش FPS", tgl("fps")))
		if not S.IS_TOUCH:
			panel_body.add_child(set_row("🖱️ قفل موس: با کلیک روی بازی، موس دوربین را می‌چرخاند · Esc آزادش می‌کند", tgl("mouseLock")))
		panel_body.add_child(set_row("🖥️ تمام‌صفحه (کلید O)", btn("تمام‌صفحه", func(): main.toggle_fullscreen(), "act", 13)))
		panel_body.add_child(set_row("کنترل لمسی", seg([["auto", "خودکار"], ["on", "روشن"], ["off", "خاموش"]], S.touch, func(v): S.touch = v; apply_settings(false); open_settings(true); Sound.play("click"))))
		panel_body.add_child(lbl("📦 کد پیشرفت (انتقال بین دستگاه‌ها)", 15, COIN, true))
		var code_box := TextEdit.new(); code_box.custom_minimum_size = Vector2(0, 70); code_box.placeholder_text = "کد پیشرفت را اینجا بچسبان (با MEME1: شروع می‌شود)"; code_box.wrap_mode = TextEdit.LINE_WRAPPING_BOUNDARY; panel_body.add_child(code_box)
		var row := hbox(8); panel_body.add_child(row)
		row.add_child(btn("کپی کد", func():
			var code := SaveSys.make_code(); code_box.text = code; DisplayServer.clipboard_set(code); toast("📋 کد پیشرفت کپی شد؛ در دستگاه دیگر در «تنظیمات ← وارد کردن کد» بچسبان", "good"), "act", 13))
		row.add_child(btn("وارد کردن کد", func():
			var s = SaveSys.read_code(code_box.text)
			if s == null:
				Sound.play("error"); toast("❌ این کد معتبر نیست؛ کل کد را (که با MEME1: شروع می‌شود) بچسبان", "bad")
				return
			confirm("وارد کردن کد پیشرفت", "پیشرفت فعلی با پیشرفت داخل کد (" + U.fmt(U.num(s.owners[0].get("money"), 0)) + " سکه) جایگزین شود؟", func(): SaveSys.reset_world_to(s); close_panel(); toast("✅ پیشرفت از کد بارگذاری شد", "good")), "buy", 13))
		panel_body.add_child(btn("🗑 پاک کردن کل پیشرفت", func(): confirm("پاک کردن پیشرفت", "همه‌ی پیشرفت بازی برای همیشه پاک می‌شود. ادامه می‌دهی؟", wipe_and_reload), "red", 13))
		var ghost := btn(" ", func(): open_secret(), "soft", 10); ghost.modulate.a = 0.05; ghost.custom_minimum_size = Vector2(40, 24); panel_body.add_child(ghost)
	if re:
		refill(build)
	else:
		open_panel("settings", "⚙️ تنظیمات"); build.call()

func open_secret() -> void:
	open_panel("secret", "🔐")
	panel_body.add_child(lbl("کد مخفی", 14, MUTED, true))
	var inp := LineEdit.new(); inp.max_length = 12; inp.alignment = HORIZONTAL_ALIGNMENT_CENTER; panel_body.add_child(inp); inp.grab_focus()
	panel_body.add_child(btn("تأیید", func(): secret_code(inp.text), "big", 16))

func secret_code(raw: String) -> void:
	var code := ""
	for ch in raw:
		var i := "۰۱۲۳۴۵۶۷۸۹".find(ch)
		if i >= 0:
			code += str(i)
		elif ch != " ":
			code += ch
	if code == "1818" and Game.secretUsed:
		Sound.play("error"); toast("🔐 این کد قبلاً استفاده شده است", "bad")
	elif code == "1515":
		if Game.reflect:
			Sound.play("error"); toast("🛡️ سپر برگشت سیلی از قبل فعال است", "")
		else:
			Game.reflect = true; Sound.play("rebirth"); close_panel(); banner("🛡️ سپر برگشت سیلی!", "هر کس بخواهد بزندت، بگیردت یا از تو بدزدد، ۵۰ تا سیلی می‌خورد و ۱۰ متر پرت می‌شود"); Game.schedule_save(true)
	elif code == "1818":
		Game.secretUsed = true; Game.player.owner.money += 5e14; Sound.play("rebirth"); close_panel(); banner("🔐 کد مخفی!", "۵۰۰ هزار میلیارد سکه گرفتی")
		FX.burst(Vector3(Game.player.body.pos.x, Game.player.body.pos.y + 1.5, Game.player.body.pos.z), {"count": 60, "color": ["#ffd23f", "#fff3a0", "#ffffff"], "speed": 8, "up": true, "life": 1.4}); Game.schedule_save(true)
	else:
		Sound.play("error"); toast("🔐 کد اشتباه است", "bad")

func open_help() -> void:
	open_panel("help", "❔ راهنمای بازی")
	for p in HELP:
		panel_body.add_child(lbl(p, 14))

const HELP := [
	"🎯 هدف: ثروتمندترین صاحب پایگاه شو! میم‌ها را از نوار نقاله‌ی وسط بخر؛ هر میم توی پایگاهت هر ثانیه پول می‌سازد.",
	"💰 پول‌ها روی سکوی سبز پایگاهت جمع می‌شوند؛ رویش برو تا برداری.",
	"🏠 پایگاه بیشتر: وقتی پایگاهت پر شد، کنار یکی از زمین‌های «برای فروش» برو و «خرید زمین» را بزن. هر پایگاه ۱۲ جای میم دارد.",
	"🥊 سیلی: با دکمه‌ی «سیلی» (کلید R) حریف جلویت را چند ثانیه گیج کن. اگر دزد باشد، میمی که برده برمی‌گردد. حواست باشد دزدها هم گاهی سیلی می‌زنند!",
	"⚗️ دستگاه ترکیب: وسط میدان، ۳ میم یکسان را به یک نسخه‌ی طلایی، الماسی یا رنگین‌کمانی تبدیل کن.",
	"📜 ماموریت‌ها: سه ماموریت همیشه فعال است؛ انجامشان بده و جایزه بگیر.",
	"🎁 صندوق گنج: هر چند وقت یک صندوق در نقشه پیدا می‌شود (مربع طلایی روی نقشه‌ی کوچک). رویش برو تا باز شود: سکه، میم یا بوست درآمد ×۲.",
	"🦘 پد پرش: روی سکوهای فنری بپر؛ در سیاره‌ی گدازه سکوهای نارنجی تو را از روی گدازه رد می‌کنند.",
	"🛹 اسکیت‌برد پرنده و 🐾 پت‌ها: از فروشگاه دنیای اول بخر. پت‌ها دنبالت می‌آیند و قدرت می‌دهند.",
	"⭐ ارتقای میم: در کلکسیون، هر میم را تا ۵ ستاره ارتقا بده؛ هر ستاره ۲۵٪ درآمد و ارزش بیشتر.",
	"👹 رئیس دزدها: گاهی یک غول تاج‌دار می‌آید و سکه‌های پایگاه‌ها را می‌دزدد. ۱۴ سیلی بزنش تا صندوق طلایی بیندازد. مواظب لرزاندن زمینش باش!",
	"🏝️ جزیره‌های آسمانی: با ثروت ۱ تریلیون، در سیاره‌ی گدازه پرتال سوم باز می‌شود. پایگاه‌ها روی جزیره‌های شناور هستند و فقط با پل‌های باریک بی‌نرده یا سکوهای ابری به هم وصل‌اند. اگر بیفتی، میم دزدی برمی‌گردد. باد شدید هم هلت می‌دهد!",
	"🛸 یوفو و 🗿 میم غول‌پیکر: در دنیای اول گاهی یوفو میم‌های کمیاب روی نوار می‌اندازد و گاهی یک میم غول‌پیکر با ۲۰ برابر ارزش ظاهر می‌شود. شب‌ها هم آتش‌بازی است!",
	"🌋 سیاره‌ی گدازه: وقتی ثروتت (پول + ارزش میم‌ها) به ۵۵۰ میلیون برسد، کنار جدول برترها یک پرتال باز می‌شود. آنجا میم‌ها ۲۰۰ برابر می‌ارزند ولی گدازه می‌سوزاند، شهاب‌سنگ می‌بارد، هر پایگاه یک ربات نگهبان دارد و حریف‌ها خیلی سریع‌ترند. جاذبه هم کمتر است!",
	"⚡ جزیره‌ها سخت‌تر شده‌اند: صاعقه می‌زند (دایره‌ی زرد روی زمین یعنی فرار کن!)، باد تندتر و بیشتر می‌وزد و حریف‌ها و نگهبان‌ها خشن‌ترند. «برق‌گیر» را از ایستگاه هوایی بخر.",
	"🏠 خانه‌ی امن: ته هر پایگاه یک خانه‌ی چوبی بزرگ هست با ۴ جای مخصوص. از کلکسیون (کلید I) دکمه‌ی «بفرست به خانه‌ی امن» را بزن تا میم خودش برود داخل. با ۱ میلیارد سکه از فروشگاه ارتقای پایگاه یک در آهنی قفل‌دار بخر: فقط خودت بازش می‌کنی و حریف‌ها فقط با دریل برقی سوراخش می‌کنند. خودت هم می‌توانی دریل بخری و در خانه‌ی حریف‌ها را سوراخ کنی.",
	"🏪 فروشگاه‌های داخل پایگاه: ته هر پایگاهت سه فروشگاه کوچک هست: 🛒 ارتقا، ⚡ سرعت و 👕 لباس.",
	"❄️ قطب یخی (دنیای ۴): با ثروت ۱۰۰ تریلیون، روی جزیره‌ی وسط آسمان پرتال یخی باز می‌شود. یخ لیز است، کولاک دید را کم می‌کند و گلوله‌برفی‌های غول‌پیکر میم را از دستت می‌اندازند.",
	"🌙 ماه نئونی (دنیای ۵): با ثروت ۵ کوادریلیون، در قطب یخی پرتال ماه باز می‌شود. جاذبه کم است و خیلی بلند می‌پری؛ از روی لیزرهای چرخان بپر!",
	"📖 بیش از ۱۶ هزار میم: همه را در دانشنامه (کلید K) ببین.",
	"🎮 دسته‌ی بازی: استیک چپ حرکت، استیک راست دوربین، A پرش، X تعامل، B سیلی، Y دزدی، RB دویدن، LB اسکیت‌برد، Start توقف.",
	"🌙 شب: هر چند دقیقه شب می‌شود؛ شب‌ها صاحب‌خانه‌ها دیرتر می‌فهمند که دزد آمده.",
	"🦹 دزدی: وارد پایگاه حریف شو، کنار یک میم «دزدی» را بزن و میم را تا پایگاه خودت ببر. موقع حمل میم ۱۵٪ سریع‌تر می‌دوی. اگر صاحبش لمست کند، میم برمی‌گردد.",
	"🛡️ سپر لیزری: برای مدتی ورود حریف‌ها را می‌بندد (خودت آزادانه رد می‌شوی). بعد از خاموشی باید صبر کنی تا دوباره آماده شود.",
	"📱 لمسی: جوی‌استیک سمت چپ = حرکت · کشیدن سمت راست = چرخش دوربین · دو انگشت = زوم.",
	"⌨️ کیبورد: W A S D حرکت · Shift دویدن · Space پرش · E تعامل/خرید · F دزدی · G رها کردن · Q سپر · R سیلی · H اسکیت‌برد · J ماموریت‌ها · C دوربین · B فروشگاه · I کلکسیون · K دانشنامه · L جدول · M نقشه · Esc توقف. موس: کلیک = قفل موس و چرخاندن دوربین، چرخ = زوم.",
	"✨ رویدادهای ویژه مثل «باران طلایی» و «ساعت شانس» گاهی پیش می‌آیند. با «تولد دوباره» درآمد دائمی بیشتری بگیر.",
]

func open_wardrobe(re: bool = false) -> void:
	var build := func() -> void:
		var tab := wear_tab; var C: Dictionary = Data.WEAR[tab]; var o: Owner = Game.player.owner
		panel_body.add_child(note("🤖 ربات لباس‌فروش هر چیزی بخری همین‌جا تنت می‌کند؛ هر چیزی یک بار بخری برای همیشه مال توست. موجودی: " + U.fmt(o.money) + " سکه"))
		var items := []
		for k in Data.WEAR.keys():
			items.append([k, Data.WEAR[k].t])
		panel_body.add_child(tabs(items, tab, func(k): wear_tab = k; open_wardrobe(true); Sound.play("click")))
		for it in Data.wear_items(tab):
			var id: String = it[0]; var nm: String = it[1]; var price: float = it[2]
			var owned := Game.wear_owned(tab, id, price)
			var on: bool = Game.wearing_set(it[3]) if tab == "set" else Game.look.get(C.get("key", ""), "") == id
			var swatch := C.has("colors") or tab == "skin"
			var emoji := "●" if swatch else nm.split(" ")[0]
			var title := nm if swatch else nm.split(" ", true, 1)[1] if nm.contains(" ") else nm
			var row := up_row(emoji, title, "✅ همین را پوشیده‌ای" if on else ("مال توست — بزن تا بپوشی" if owned else "قیمت: " + U.fmt(price) + " سکه"), 0, 0, "پوشیده" if on else ("👕 بپوش" if owned else "💰 " + U.fmt(price)), on or (not owned and o.money < price), func(): Game.wear_buy(tab + ":" + id), "buy", MINT if on else "")
			if swatch:
				var e: Label = row.get_child(0).get_child(0); e.add_theme_color_override("font_color", Color.html(id)); e.add_theme_font_size_override("font_size", 40)
			panel_body.add_child(row)
	if re:
		refill(build)
	else:
		open_panel("wear", "👕 فروشگاه لباس پایگاه"); build.call()

func open_keys() -> void:
	open_panel("keys", "⌨️ کلیدهای ویندوز و کامپیوتر")
	for r in [["W A S D / ← ↑ → ↓", "حرکت"], ["Shift", "دویدن"], ["Space", "پرش (دوبار = پرش دوبل)"], ["E", "تعامل / خرید / پرتال"], ["F", "دزدیدن میم"], ["G", "رها کردن میم"], ["R", "سیلی"], ["Q", "سپر لیزری"], ["H", "اسکیت‌برد"], ["B", "فروشگاه (کنار مغازه)"], ["I", "کلکسیون من"], ["K", "دانشنامه‌ی میم‌ها"], ["J", "ماموریت‌ها"], ["L", "جدول برترها"], ["M", "نقشه‌ی کوچک"], ["C", "دوربین اول/سوم‌شخص"], ["O", "تمام‌صفحه"], ["F1", "همین راهنمای کلیدها"], ["P / Esc", "توقف"], ["موس", "کلیک = قفل موس و چرخاندن دوربین · چرخ = زوم"]]:
		var p := panel_box("rgba(255,255,255,.06)", 10); var h := hbox(10); p.add_child(h)
		var k := lbl(r[0], 14, COIN, true, HORIZONTAL_ALIGNMENT_LEFT); k.size_flags_horizontal = 0; k.custom_minimum_size = Vector2(180, 0); h.add_child(k); h.add_child(lbl(r[1], 14)); panel_body.add_child(p)
	panel_body.add_child(note("🎮 دسته‌ی ایکس‌باکس هم کار می‌کند: استیک‌ها حرکت و دوربین، A پرش، X تعامل، B سیلی، Y دزدی، RB دویدن، LB اسکیت‌برد، Start توقف."))

func mission_tabs(cur: String) -> HBoxContainer:
	return tabs([["m", "📜 ماموریت‌ها"], ["ach", "🏅 دستاوردها (" + U.fa(Game.ach.size()) + "/" + U.fa(Extras.ACHIEVEMENTS.size()) + ")"]], cur, func(t): open_missions(false, t))

func open_missions(re: bool = false, tab: String = "") -> void:
	if tab != "":
		mission_tab = tab
	if mission_tab == "ach":
		open_ach(re)
		return
	Missions.ensure()
	var build := func() -> void:
		panel_body.add_child(mission_tabs("m"))
		panel_body.add_child(note("هر ماموریت که تمام شود، جایزه‌اش را بگیر تا یک ماموریت تازه بیاید."))
		for i in Missions.list.size():
			var m: Dictionary = Missions.list[i]; var d := Missions.def(m)
			var prog := (U.fmt(m.prog) + " / " + U.fmt(m.n)) if m.id == "collect" else (U.fa(int(m.prog)) + " / " + U.fa(int(m.n)))
			var row := up_row(d.emoji, Missions.text(m), prog + " · جایزه: " + U.fmt(m.reward) + " سکه", int(10 * m.prog / m.n), 10, "🎉 دریافت" if m.done else "⏳", not m.done, func(): Missions.claim(i); open_missions(true), "buy", MINT if m.done else "")
			panel_body.add_child(row)
	if re:
		refill(build)
	else:
		open_panel("missions", "📜 ماموریت‌ها"); build.call()

func open_ach(re: bool = false) -> void:
	var build := func() -> void:
		panel_body.add_child(mission_tabs("ach"))
		panel_body.add_child(note("دستاوردها خودکار باز می‌شوند و جایزه‌شان فوراً به پولت اضافه می‌شود."))
		for a in Extras.ACHIEVEMENTS:
			var done := Game.ach.has(a.id); var vn: Array = a.p.call(); var v := float(vn[0]); var n := float(vn[1])
			var prog := "✅ انجام شد" if done else ((U.fmt(v) + " / " + U.fmt(n)) if a.get("money", false) else (U.fa(int(minf(v, n))) + " / " + U.fa(int(n))))
			panel_body.add_child(up_row(a.e if done else "🔒", a.t, prog + " · جایزه: " + U.fmt(a.r) + " سکه", 10 if done else int(10 * minf(1.0, v / n)), 10, "", false, func(): pass, "act", MINT if done else ""))
	if re:
		refill(build)
	else:
		open_panel("missions", "🏅 دستاوردها"); build.call()

func open_fusion() -> void:
	var o: Owner = Game.player.owner; var g := Fusion.groups(o)
	open_panel("fusion", "⚗️ دستگاه ترکیب")
	panel_body.add_child(note("سه میم کاملاً یکسان (هم‌نوع و هم‌جنس) را بده تا یک نسخه‌ی بهتر بگیری: معمولی ← طلایی (×۲) ← الماسی (×۳) ← رنگین‌کمانی (×۶). میم جدید خودش تا پایگاهت راه می‌رود."))
	var keys := g.keys(); keys.sort_custom(func(x, y): return g[x].size() > g[y].size() or (g[x].size() == g[y].size() and g[x][0].price > g[y][0].price))
	if keys.is_empty():
		panel_body.add_child(note("هنوز میمی در پایگاهت نداری."))
		return
	var gr := grid(3); panel_body.add_child(gr)
	for key in keys:
		var list: Array = g[key]; var u: Unit = list[0]; var mu: Dictionary = Data.MUTATIONS[u.mut]; var nx: Dictionary = Data.MUTATIONS[u.mut + 1]; var ok := list.size() >= 3; var r: Dictionary = Data.RARITIES[u.c.rarity]
		gr.add_child(card(u.c.emoji, ((mu.name + " · ") if mu.name != "" else "") + u.c.name, r.name, r.color, ["داری: " + U.fa(list.size()) + " از ۳ · نتیجه: " + nx.name + " (درآمد ×" + U.fa(int(nx.mult)) + ")"], [["⚗️ ترکیب کن" if ok else "هنوز " + U.fa(3 - list.size()) + " تا کم داری", func(): Fusion.fuse(key), "buy", not ok]], nx.color if ok else "rgba(255,255,255,.12)", not ok))

func open_pause() -> void:
	if not Game.playing:
		return
	open_panel("pause", "⏸ بازی متوقف شد")
	panel_body.add_child(btn("▶ ادامه", func(): close_panel(), "big", 20))
	var r1 := hbox(8); panel_body.add_child(r1)
	r1.add_child(btn("⚙️ تنظیمات", func(): open_settings())); r1.add_child(btn("❔ راهنما", func(): open_help())); r1.add_child(btn("💾 ذخیره", func(): SaveSys.do_save(); close_panel(); toast("💾 روی همین دستگاه ذخیره شد", "good")))
	var r2 := hbox(8); panel_body.add_child(r2)
	r2.add_child(btn("🎓 آموزش دوباره", func(): close_panel(); Tutorial.start(true))); r2.add_child(btn("🏠 منوی اصلی", func(): SaveSys.do_save(); close_panel(); main.back_to_menu())); r2.add_child(btn("🔄 شروع دوباره", func(): confirm("شروع دوباره", "بازی از اول شروع می‌شود و پیشرفت فعلی پاک می‌شود.", wipe_and_reload), "red"))
	panel_body.add_child(note("زمان بازی: " + U.fmt_time(Game.playTime) + " · پیشرفتت خودکار ذخیره می‌شود."))

# ---------------------------------------------------------------- minimap
class MiniMap extends Control:
	var ui = null
	var B: Dictionary
	var s := 1.0
	var ox := 0.0
	var oy := 0.0
	func X(x: float) -> float: return (x - B.minX) * s + ox
	func Z(z: float) -> float: return (z - B.minZ) * s + oy
	func _draw() -> void:
		if Game.player == null:
			return
		var wn := Phys.world_of(Game.player.body.pos.x)
		B = Phys.WORLD_BOUNDS[wn]
		var NW := size.x; var NH := size.y
		s = minf(NW / (B.maxX - B.minX), NH / (B.maxZ - B.minZ)); ox = (NW - (B.maxX - B.minX) * s) / 2; oy = (NH - (B.maxZ - B.minZ) * s) / 2
		var font: Font = ui.FONT
		draw_rect(Rect2(0, 0, NW, NH), Color.html("#1b1446"))
		match wn:
			1:
				draw_rect(Rect2(X(B.minX), Z(B.minZ), (B.maxX - B.minX) * s, (B.maxZ - B.minZ) * s), Color.html("#4c9a3c"))
				var PX: float = World.LAYOUT.plazaX; var RZ: float = World.LAYOUT.ringZ
				draw_rect(Rect2(X(-PX), Z(-18), 2 * PX * s, 36 * s), Color.html("#d9c9a8"))
				for zc in [-RZ, RZ]:
					draw_rect(Rect2(X(-PX - 3), Z(zc - 3), (2 * PX + 6) * s, 6 * s), Color.html("#555a66"))
				for xc in World.LAYOUT.roadXs:
					draw_rect(Rect2(X(xc - 3), Z(-RZ + 3), 6 * s, (RZ - 21) * s), Color.html("#555a66")); draw_rect(Rect2(X(xc - 3), Z(18), 6 * s, (RZ - 21) * s), Color.html("#555a66"))
				for b in World.buildings:
					draw_rect(Rect2(X(b.x - b.w / 2), Z(b.z - b.d / 2), b.w * s, b.d * s), Color.html("#8b8fa8"))
				for f in World.fountains:
					draw_circle(Vector2(X(f.x), Z(f.z)), 3 * s, Color.html("#3fb7ff"))
				draw_rect(Rect2(X(World.shopPos.x - 13.5), Z(-7), 12 * s, 14 * s), Color.html("#ff4f8b"))
				draw_rect(Rect2(X(World.boardPos.x + 5), Z(-8), 2 * s, 16 * s), Color.html("#ffd23f"))
				if Game.portalUnlocked:
					draw_string(font, Vector2(X(W2.PORTAL1.x) - 6, Z(W2.PORTAL1.z) + 4), "🌀", HORIZONTAL_ALIGNMENT_CENTER, -1, 11)
			2:
				draw_rect(Rect2(X(B.minX), Z(B.minZ), (B.maxX - B.minX) * s, (B.maxZ - B.minZ) * s), Color.html("#2a1c22"))
				draw_rect(Rect2(X(Phys.X2 - W2.plazaX), Z(-W2.moat[0]), 2 * W2.plazaX * s, 2 * W2.moat[0] * s), Color.html("#3a3048"))
				for r in W2.lava:
					draw_rect(Rect2(X(r[0]), Z(r[1]), (r[2] - r[0]) * s, (r[3] - r[1]) * s), Color.html("#ff5a1f"))
				draw_string(font, Vector2(X(W2.PORTAL2.x) - 6, Z(W2.PORTAL2.z) + 4), "🌀", HORIZONTAL_ALIGNMENT_CENTER, -1, 11)
				if Portal3.p3 != null and Portal3.p3.g.visible:
					draw_string(font, Vector2(X(W3.PORTAL3.x) - 6, Z(W3.PORTAL3.z) + 4), "🏝️", HORIZONTAL_ALIGNMENT_CENTER, -1, 11)
			3:
				draw_rect(Rect2(0, 0, NW, NH), Color.html("#bfe6ff"))
				for i in W3.walk.size():
					var r: Array = W3.walk[i]
					draw_rect(Rect2(X(r[0]), Z(r[1]), (r[2] - r[0]) * s, (r[3] - r[1]) * s), Color.html("#8fd88f" if i < 8 else "#b07a4e"))
				draw_string(font, Vector2(X(W3.PORTAL4.x) - 6, Z(W3.PORTAL4.z) + 4), "🌀", HORIZONTAL_ALIGNMENT_CENTER, -1, 11)
				if EXW.D[4].pIn != null and EXW.D[4].pIn.g.visible:
					draw_string(font, Vector2(X(EXW.D[4].entry.x) - 6, Z(EXW.D[4].entry.z) + 4), "❄️", HORIZONTAL_ALIGNMENT_CENTER, -1, 11)
			_:
				var Dn: Dictionary = EXW.D[wn]; var ice := wn == 4
				draw_rect(Rect2(0, 0, NW, NH), Color.html("#e8f4ff" if ice else "#4a4c58"))
				draw_rect(Rect2(X(Dn.X - 84), Z(-26), 168 * s, 52 * s), Color.html("#a8dcff" if ice else "#2a1a4a"))
				if not ice:
					for L in Dn.lasers:
						draw_arc(Vector2(X(L.x), Z(L.z)), (L.len + 0.5) * s, 0, TAU, 24, Color(1, 0.16, 0.42, 0.7), 1)
				draw_string(font, Vector2(X(Dn.back.x) - 6, Z(Dn.back.z) + 4), "🌀", HORIZONTAL_ALIGNMENT_CENTER, -1, 11)
				if wn == 4 and EXW.D[5].pIn != null and EXW.D[5].pIn.g.visible:
					draw_string(font, Vector2(X(EXW.D[5].entry.x) - 6, Z(EXW.D[5].entry.z) + 4), "🌙", HORIZONTAL_ALIGNMENT_CENTER, -1, 11)
		var BT = Game.belt_of_world(wn)
		draw_rect(Rect2(X(BT.x0), Z(-2.4), (BT.x1 - BT.x0) * s, 4.8 * s), Color.html("#26262e"))
		for b in World.bases:
			if b.world != wn:
				continue
			var c := Color.html(b.owner.color if b.owner != null else "#888888"); c.a = 0.67
			draw_rect(Rect2(X(b.cx - 12), Z(b.cz - 10), 24 * s, 20 * s), c)
			draw_rect(Rect2(X(b.cx - 12), Z(b.cz - 10), 24 * s, 20 * s), Color.WHITE, false, 1)
			if b.barrierActive:
				var w1 := b.to_world(-3, -10); var w2 := b.to_world(3, -10)
				draw_line(Vector2(X(w1.x), Z(w1.y)), Vector2(X(w2.x), Z(w2.y)), Color.html("#ff2a3a"), 3)
		for c in Extras.chests:
			if c.w == wn and c.opening < 0:
				var sz := 5.0 if c.golden else 3.5
				draw_rect(Rect2(X(c.pos.x) - sz / 2, Z(c.pos.z) - sz / 2, sz, sz), Color.html("#ffd23f")); draw_rect(Rect2(X(c.pos.x) - sz / 2, Z(c.pos.z) - sz / 2, sz, sz), Color.html("#7a4a00"), false, 1)
		var flash := int(Game.time * 4) % 2 == 0
		if Extras.boss != null and Extras.boss.w == wn:
			var bp: Vector3 = Extras.boss.body.pos
			draw_circle(Vector2(X(bp.x), Z(bp.z)), 5.0 if flash else 4.0, Color.html("#ff2a3a"))
		for u in BT.list:
			draw_circle(Vector2(X(u.pos.x), Z(u.pos.z)), 2.4 if u.c.rarity >= 4 else 1.2, Color.html(Data.RARITIES[u.c.rarity].color))
		for ag in Game.agents:
			if ag.isPlayer or Phys.world_of(ag.body.pos.x) != wn:
				continue
			var p := ag.body.pos
			draw_circle(Vector2(X(p.x), Z(p.z)), 2.4, Color.html("#ff2a3a" if ag.isGuard else ag.owner.color))
			draw_arc(Vector2(X(p.x), Z(p.z)), 2.4, 0, TAU, 12, Color.WHITE, 1)
			if ag.carrying != null and ag.carrying.owner == Game.player.owner and flash:
				draw_arc(Vector2(X(p.x), Z(p.z)), 7, 0, TAU, 16, Color.html("#ff2a3a"), 2)
		var p := Game.player.body.pos; var y := Game.player.yaw; var dx := sin(y); var dz := cos(y); var px := X(p.x); var pz := Z(p.z); var L := 6.0
		var pts := PackedVector2Array([Vector2(px + dx * L, pz + dz * L), Vector2(px - dx * L * 0.6 + dz * L * 0.6, pz - dz * L * 0.6 - dx * L * 0.6), Vector2(px - dx * L * 0.6 - dz * L * 0.6, pz - dz * L * 0.6 + dx * L * 0.6)])
		draw_colored_polygon(pts, Color.WHITE)
		draw_polyline(pts + PackedVector2Array([pts[0]]), Color.html("#1b1446"), 1.5)
