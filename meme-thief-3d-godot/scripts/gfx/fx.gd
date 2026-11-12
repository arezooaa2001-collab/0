## Pooled additive particles rendered with one MultiMesh (autoload "FX").
extends Node3D

const MAX := 1200
var mm: MultiMesh
var mmi: MultiMeshInstance3D
var pool: Array = []
var cursor := 0
var alive := 0
var limit := 900

func _ready() -> void:
	mm = MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	var q := QuadMesh.new()
	q.size = Vector2(1, 1)
	mm.mesh = q
	mm.instance_count = MAX
	mm.visible_instance_count = 0
	mmi = MultiMeshInstance3D.new()
	mmi.multimesh = mm
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	m.vertex_color_use_as_albedo = true
	m.albedo_texture = Tex.get_tex("glow")
	m.disable_fog = true
	m.no_depth_test = false
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	mmi.material_override = m
	mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mmi.extra_cull_margin = 16384.0
	add_child(mmi)
	for i in MAX:
		pool.append({"alive": false, "p": Vector3.ZERO, "v": Vector3.ZERO, "life": 0.0, "max": 1.0, "size": 0.3, "c": Color.WHITE, "grav": 0.0, "drag": 0.0, "grow": 0.0})

func set_quality(q: Dictionary) -> void:
	limit = q.particles

func _col(c) -> Color:
	if c is Color:
		return c
	var s := str(c)
	if s.begins_with("hsl"):
		var inner := s.substr(4).trim_suffix(")").split(",")
		return Color.from_hsv(fmod(inner[0].to_float(), 360.0) / 360.0, inner[1].trim_suffix("%").to_float() / 100.0, 1.0)
	return Color.html(s)

## o: {vx, vy, vz, life, size, color, grav, drag, grow}
func one(x: float, y: float, z: float, o: Dictionary) -> void:
	if alive >= limit:
		return
	for k in MAX:
		cursor = (cursor + 1) % MAX
		var p: Dictionary = pool[cursor]
		if p.alive:
			continue
		p.alive = true; alive += 1
		p.p = Vector3(x, y, z); p.v = Vector3(o.get("vx", 0.0), o.get("vy", 0.0), o.get("vz", 0.0))
		p.life = o.get("life", 1.0); p.max = p.life; p.size = o.get("size", 0.3)
		p.grav = o.get("grav", 0.0); p.drag = o.get("drag", 0.0); p.grow = o.get("grow", 0.0)
		p.c = _col(o.get("color", "#ffffff"))
		return

## o: {count, speed, color (one or array), up, spread, lift, life, size, grav, drag, grow}
func burst(pos: Vector3, o: Dictionary = {}) -> void:
	var n := int(roundf(float(o.get("count", 20)) * (0.5 if S.quality == "low" else 1.0)))
	var sp: float = o.get("speed", 4.0)
	var up: bool = o.get("up", false)
	var spread: float = o.get("spread", 1.0)
	for i in n:
		var th := randf() * TAU
		var ph := acos(U.rnd(-1, 1)) * (0.5 if up else 1.0)
		var s := sp * U.rnd(0.4, 1.0)
		var col = o.get("color", "#ffffff")
		if col is Array:
			col = U.pick(col)
		one(pos.x + U.rnd(-0.2, 0.2) * spread, pos.y + U.rnd(-0.2, 0.2), pos.z + U.rnd(-0.2, 0.2) * spread, {
			"vx": sin(ph) * cos(th) * s, "vy": (absf(cos(ph)) if up else cos(ph)) * s + o.get("lift", 0.0), "vz": sin(ph) * sin(th) * s,
			"life": float(o.get("life", 0.9)) * U.rnd(0.6, 1.2), "size": float(o.get("size", 0.35)) * U.rnd(0.6, 1.3), "color": col,
			"grav": o.get("grav", -6.0), "drag": o.get("drag", 1.2), "grow": o.get("grow", 0.0)})

func update(dt: float) -> void:
	var n := 0
	for i in MAX:
		var p: Dictionary = pool[i]
		if not p.alive:
			continue
		p.life -= dt
		if p.life <= 0.0:
			p.alive = false; alive -= 1
			continue
		var dr := exp(-p.drag * dt)
		p.v = Vector3(p.v.x * dr, p.v.y * dr + p.grav * dt, p.v.z * dr)
		p.p += p.v * dt
		p.size += p.grow * dt
		var t: float = p.life / p.max
		var sz: float = maxf(0.01, p.size)
		mm.set_instance_transform(n, Transform3D(Basis.from_scale(Vector3(sz, sz, sz)), p.p))
		var c: Color = p.c
		c.a = minf(1.0, t * 2.5)
		mm.set_instance_color(n, c)
		n += 1
	mm.visible_instance_count = n
