## A world-space text sign: a coloured quad with up to four Label3D lines (replaces the canvas sprites).
class_name Sign
extends Node3D

static var HEADLESS := DisplayServer.get_name() == "headless"
static var FONT_BOLD: FontFile = null
static var FONT_BLACK: FontFile = null
static func fonts() -> void:
	if FONT_BOLD == null:
		FONT_BOLD = load("res://assets/fonts/Vazirmatn-Bold.ttf")
		FONT_BLACK = load("res://assets/fonts/Vazirmatn-Black.ttf")
		var emoji: FontFile = load("res://assets/fonts/NotoEmoji.ttf")
		for f in [FONT_BOLD, FONT_BLACK]:
			f.allow_system_fallback = true
			f.fallbacks = [emoji]

var labels: Array[Label3D] = []
var bg: MeshInstance3D = null
var border: MeshInstance3D = null
var w := 1.0
var h := 1.0
var cw := 512.0
var ch := 256.0
var billboard := true
var last_key := ""
var bg_mat: StandardMaterial3D
var border_mat: StandardMaterial3D

## lines: [{t, size, color, weight, stroke}], opt: {w, h, bg (false|html), border}
static func make(lines: Array, opt: Dictionary, world_w: float, world_h: float, billboard_: bool = true) -> Sign:
	var s := Sign.new()
	s.setup(world_w, world_h, opt.get("w", 512.0), opt.get("h", 256.0), opt.get("bg", "rgba(20,14,56,.78)"), opt.get("border", "rgba(255,255,255,.35)"), billboard_)
	s.set_lines("", lines)
	return s

static func css(c) -> Color:
	if c is Color:
		return c
	var s := str(c)
	if s.begins_with("rgba") or s.begins_with("rgb"):
		var inner := s.substr(s.find("(") + 1).trim_suffix(")")
		var parts := inner.split(",")
		var col := Color(parts[0].to_float() / 255.0, parts[1].to_float() / 255.0, parts[2].to_float() / 255.0, 1.0)
		if parts.size() > 3:
			col.a = parts[3].strip_edges().to_float()
		return col
	if s.length() == 9 and s.begins_with("#"):
		return Color.html(s)
	return Color.html(s)

func setup(world_w: float, world_h: float, canvas_w: float, canvas_h: float, bg_col, border_col, billboard_: bool) -> void:
	fonts()
	w = world_w; h = world_h; cw = canvas_w; ch = canvas_h; billboard = billboard_
	if bg_col is bool and bg_col == false:
		pass
	else:
		border_mat = StandardMaterial3D.new()
		border_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		border_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		border_mat.albedo_color = css(border_col)
		border_mat.render_priority = -2
		border_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
		border_mat.disable_fog = true
		if billboard:
			border_mat.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
		border = MeshInstance3D.new()
		var q := QuadMesh.new(); q.size = Vector2(w, h)
		border.mesh = q; border.material_override = border_mat
		border.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(border)
		bg_mat = border_mat.duplicate()
		bg_mat.albedo_color = css(bg_col)
		bg_mat.render_priority = -1
		bg = MeshInstance3D.new()
		var q2 := QuadMesh.new(); q2.size = Vector2(w * (1.0 - 12.0 / cw), h * (1.0 - 12.0 / ch))
		bg.mesh = q2; bg.material_override = bg_mat
		bg.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(bg)

func set_bg(bg_col, border_col) -> void:
	if bg_mat:
		bg_mat.albedo_color = css(bg_col)
	if border_mat:
		border_mat.albedo_color = css(border_col)

## key: skip re-layout when unchanged
func set_lines(key: String, lines: Array) -> void:
	if key != "" and key == last_key:
		return
	last_key = key
	if HEADLESS:
		return
	while labels.size() < lines.size():
		var l := Label3D.new()
		l.billboard = BaseMaterial3D.BILLBOARD_ENABLED if billboard else BaseMaterial3D.BILLBOARD_DISABLED
		l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		l.text_direction = TextServer.DIRECTION_AUTO
		l.render_priority = 2
		l.alpha_cut = Label3D.ALPHA_CUT_DISABLED
		l.no_depth_test = false
		add_child(l)
		labels.append(l)
	var pix := w / cw
	var total := 0.0
	for ln in lines:
		total += float(ln.get("size", 40)) * 1.22
	var y := ch / 2.0 - total / 2.0
	for i in labels.size():
		var l := labels[i]
		if i >= lines.size():
			l.visible = false
			continue
		var ln: Dictionary = lines[i]
		var size: float = ln.get("size", 40)
		y += size * 0.61
		l.visible = true
		l.font = FONT_BLACK if int(ln.get("weight", 800)) >= 900 else FONT_BOLD
		var text: String = str(ln.get("t", ""))
		# shrink long lines like the canvas version did
		var fs := size
		var maxw := cw - 36.0
		while fs > 14.0 and l.font.get_string_size(text, HORIZONTAL_ALIGNMENT_CENTER, -1, int(fs)).x > maxw:
			fs -= 2.0
		l.font_size = int(fs)
		l.pixel_size = pix
		l.text = text
		l.modulate = css(ln.get("color", "#ffffff"))
		var stroke: float = ln.get("stroke", 0)
		l.outline_size = int(stroke * 1.5)
		l.outline_modulate = Color(0, 0, 0, 0.55)
		l.position = Vector3(0, (ch / 2.0 - y) * pix, 0.01)
		y += size * 0.61
