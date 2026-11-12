## Character template cache + visual pool (autoload "Chars"); mutation materials and nameplates.
extends Node

var templates: Dictionary = {}
var pool: Dictionary = {}
var mut_mats: Dictionary = {}
var blob_mat: StandardMaterial3D
var glow_tex: Texture2D

func _ready() -> void:
	blob_mat = StandardMaterial3D.new()
	blob_mat.albedo_texture = Tex.get_tex("blob")
	blob_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	blob_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	blob_mat.render_priority = -3
	blob_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	glow_tex = Tex.get_tex("glow")

func build_templates() -> void:
	for c in Data.CHARS:
		if c.proc == null:
			template_of(c.id)

func template_of(id: String) -> Dictionary:
	if templates.has(id):
		return templates[id]
	var c: Dictionary = Data.CHAR_BY_ID[id]
	var B := PB.new()
	var spec: Dictionary
	if c.proc != null:
		spec = ProcBuild.build(c, B)
	else:
		spec = Builders.build(c.id, B)
	var baked := B.bake()
	spec["height"] = baked.height
	spec["rad"] = baked.rad
	spec["scale"] = (0.9 + c.rarity * 0.07) * spec.get("scaleMul", 1.0)
	var t := {"root": baked.root, "spec": spec}
	templates[id] = t
	return t

func mut_material(id: int) -> StandardMaterial3D:
	if mut_mats.has(id):
		return mut_mats[id]
	var m := StandardMaterial3D.new()
	var o: Dictionary
	match id:
		1: o = {"c": "#ffc93c", "m": 1.0, "r": 0.22}
		4: o = {"c": "#2a1414", "m": 0.2, "r": 0.55, "e": "#ff4a00", "ei": 0.55, "flat": true}
		6: o = {"c": "#f4fbff", "m": 0.5, "r": 0.12, "e": "#9fe8ff", "ei": 0.35}
		7: o = {"c": "#16224a", "m": 0.7, "r": 0.2, "e": "#29d9ff", "ei": 0.7, "flat": true}
		5: o = {"c": "#2a1060", "m": 0.6, "r": 0.15, "e": "#7a3cff", "ei": 0.6}
		2: o = {"c": "#c8f6ff", "m": 0.35, "r": 0.04, "e": "#3fb0ff", "ei": 0.18, "flat": true}
		9: o = {"c": "#d8f6ff", "m": 0.2, "r": 0.05, "e": "#4fc8ff", "ei": 0.3, "flat": true}
		10: o = {"c": "#0e2a2a", "m": 0.5, "r": 0.2, "e": "#3dffa0", "ei": 0.75}
		11: o = {"c": "#1a0a2a", "m": 0.4, "r": 0.25, "e": "#ff3df2", "ei": 0.85}
		12: o = {"c": "#05030c", "m": 0.9, "r": 0.1, "e": "#6a3cff", "ei": 0.9}
		_: o = {"c": "#ff66cc", "m": 0.3, "r": 0.25, "e": "#ff00aa", "ei": 0.25}
	m.albedo_color = Color.html(o.c); m.metallic = o.m; m.roughness = o.r
	if o.has("e"):
		m.emission_enabled = true; m.emission = Color.html(o.e); m.emission_energy_multiplier = o.ei
	if o.get("flat", false):
		m.shading_mode = BaseMaterial3D.SHADING_MODE_PER_VERTEX
	mut_mats[id] = m
	return m

func _apply_mut(n: Node, mm: Material) -> void:
	if n is MeshInstance3D and not n.has_meta("solo"):
		var keeps: PackedByteArray = n.get_meta("keep", PackedByteArray())
		for i in n.mesh.get_surface_count():
			if i < keeps.size() and keeps[i] == 1:
				continue
			var sm: Material = n.mesh.surface_get_material(i)
			if sm is StandardMaterial3D and (sm.transparency != BaseMaterial3D.TRANSPARENCY_DISABLED or sm.blend_mode == BaseMaterial3D.BLEND_MODE_ADD):
				continue
			n.set_surface_override_material(i, mm)
	for c in n.get_children():
		_apply_mut(c, mm)

## returns {root, parts: {name: Node3D}, key, spec}
func obtain_visual(type_id: String, mut: int) -> Dictionary:
	var k := type_id + ":" + str(mut)
	if pool.has(k) and pool[k].size() > 0:
		return pool[k].pop_back()
	var T := template_of(type_id)
	var root: Node3D = T.root.duplicate()
	if mut > 0 and mut != 8:
		_apply_mut(root, mut_material(mut))
	var parts := {}
	_collect(root, parts)
	return {"root": root, "parts": parts, "key": k, "spec": T.spec}

func _collect(n: Node, parts: Dictionary) -> void:
	if n is Node3D and n.name != "" and n.name != "M" and not n.name.begins_with("@"):
		parts[n.name] = n
	for c in n.get_children():
		_collect(c, parts)

func release_visual(v: Dictionary) -> void:
	if v.is_empty():
		return
	var root: Node3D = v.root
	if root.get_parent():
		root.get_parent().remove_child(root)
	if not pool.has(v.key):
		pool[v.key] = []
	if pool[v.key].size() < 6:
		pool[v.key].append(v)
	else:
		root.queue_free()

## nameplate lines for a unit
static func plate_lines(c: Dictionary, mut: int, mode: String, price: float, income: float, lvl: int = 0) -> Array:
	var r: Dictionary = Data.RARITIES[c.rarity]; var mu: Dictionary = Data.MUTATIONS[mut]
	var stars := ""
	for i in lvl:
		stars += "⭐"
	var lines := [
		{"t": (stars + " " if lvl else "") + (mu.name + " · " if mu.name != "" else "") + c.name, "size": 44, "color": mu.color if mut > 0 else "#ffffff", "weight": 900},
		{"t": r.name, "size": 34, "color": r.color, "weight": 900},
	]
	if mode == "shop":
		lines.append({"t": "💰 " + U.fmt(price), "size": 40, "color": "#ffd23f", "weight": 900})
		lines.append({"t": U.fmt_inc(income), "size": 28, "color": "#3df2b0", "weight": 700})
	else:
		lines.append({"t": U.fmt_inc(income), "size": 34, "color": "#3df2b0", "weight": 800})
	return lines

## animate a unit/pet visual (three.js animateUnit)
static func animate_unit(u, dt: float, t: float, moving: bool) -> void:
	var P: Dictionary = u.vis.parts
	var sp: Dictionary = u.spec
	var body: Node3D = P.get("BODY")
	if body == null:
		return
	u.ph += dt * (9.0 if moving else 1.5)
	var s := sin(u.ph); var amp := 0.6 if moving else 0.03
	var L := [P.get("L1"), P.get("L2"), P.get("L3"), P.get("L4")]; var sg := [1, -1, -1, 1]
	for i in 4:
		if L[i] != null:
			L[i].rotation.x = U.damp(L[i].rotation.x, s * amp * sg[i], 14, dt)
	var by := 0.0; var rz := 0.0; var rx := 0.0
	match sp.type:
		"hop": by = absf(s) * 0.35 if moving else absf(sin(t * 2.5 + u.seed)) * 0.06
		"fly": by = sp.get("hover", 0.4) + sin(t * 2 + u.seed) * 0.15; rx = 0.12 if moving else 0.0
		"wobble": rz = sin(t * 3 + u.seed) * 0.08; by = absf(s) * 0.12 if moving else 0.0
		_:
			by = absf(cos(u.ph)) * 0.08 if moving else 0.0
			if sp.get("waddle", false):
				rz = sin(u.ph * (1.0 if moving else 2.0)) * (0.14 if moving else 0.05)
	if sp.get("dance", false) and not moving:
		rz = sin(t * 4 + u.seed) * 0.2; by += absf(sin(t * 4 + u.seed)) * 0.1
	if sp.get("scream", false) and not moving and randf() < 0.02:
		by += 0.06
	var br := sin(t * 2.4 + u.seed) * 0.03
	body.position.y = by
	body.basis = Geo.basis_xyz(rx, 0, rz) * Basis.from_scale(Vector3(1 - br * 0.5, 1 + br, 1 - br * 0.5))
	var A1: Node3D = P.get("A1"); var A2: Node3D = P.get("A2")
	if A1 != null and A2 != null:
		var x1 := -s * amp * 0.9; var x2 := s * amp * 0.9
		if not moving:
			if sp.get("karate", false):
				var k := int(floorf(t * 2.5 + u.seed)) % 2
				x1 = -1.6 if k else -0.3; x2 = -0.3 if k else -1.6
			elif sp.get("dance", false):
				x1 = -2.4 + sin(t * 8) * 0.4; x2 = -2.4 - sin(t * 8) * 0.4
			elif sp.get("robot", false):
				x1 = -1.4 + sin(t * 3) * 0.1; x2 = -0.2
			else:
				x1 = sin(t * 1.8 + u.seed) * 0.12; x2 = -x1
		A1.rotation.x = U.damp(A1.rotation.x, x1, 12, dt); A2.rotation.x = U.damp(A2.rotation.x, x2, 12, dt)
	var W1: Node3D = P.get("W1"); var W2: Node3D = P.get("W2")
	if W1 != null and W2 != null:
		var f := (5.0 if sp.get("bigWings", false) else 11.0) if sp.type == "fly" else 4.0
		var a := 0.55 if sp.type == "fly" else 0.25
		var w := sin(t * f + u.seed) * a + (0.15 if sp.type == "fly" else 0.0)
		W1.rotation.z = w; W2.rotation.z = -w
	if P.has("SP"):
		P.SP.rotation.y += dt * (26.0 if sp.get("heli", false) else 1.6)
	if P.has("SP2"):
		P.SP2.rotation.y += dt * 2.4
	if P.has("SPX"):
		P.SPX.rotation.x += dt * 30
	if P.has("T"):
		P["T"].rotation.y = sin(t * 4 + u.seed) * 0.45
	if P.has("E1") and P.has("E2"):
		var e := sin(t * 5 + u.seed) * 0.2
		P.E1.rotation.z = -0.3 + e; P.E2.rotation.z = 0.3 - e
	if P.has("FL1") and P.has("FL2"):
		var s1 := 0.75 + randf() * 0.5; var s2 := 0.75 + randf() * 0.5
		P.FL1.scale = Vector3(s1, s1, s1); P.FL2.scale = Vector3(s2, s2, s2)
	if P.has("TE"):
		var i := 0
		for tg in P.TE.get_children():
			if tg is Node3D and not (tg is MeshInstance3D):
				tg.rotation.z = sin(t * 3 + i * 0.8) * 0.3
				i += 1
	if P.has("OR"):
		P.OR.rotation.y += dt * 0.9
	if P.has("GL1") and P.has("GL2"):
		var j := randf() < 0.12
		P.GL1.position.x = U.rnd(-0.15, 0.15) if j else 0.05
		P.GL2.position.x = U.rnd(-0.15, 0.15) if j else -0.05
		var vis := randf() > 0.05
		P.GL1.visible = vis; P.GL2.visible = vis
