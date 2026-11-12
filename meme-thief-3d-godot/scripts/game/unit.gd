## A meme unit living in the world (on the belt, walking to a slot, sitting on a pedestal or being carried).
class_name Unit

var c: Dictionary
var mut := 0
var lvl := 0
var price := 0.0
var income := 0.0
var vis: Dictionary
var spec: Dictionary
var sc := 1.0
var root: Node3D
var yaw := 0.0
var state := "none"
var owner: Owner = null
var slot = null
var carrier = null
var path: Array = []
var pi := 0
var ph := 0.0
var seed := 0.0
var transitT := 0.0
var moving := false
var fxT := 0.0
var tSpeed := 6.0
var belt = null
var blob: MeshInstance3D
var aura: MeshInstance3D = null
var glow: MeshInstance3D = null
var pillar: MeshInstance3D = null
var halo: MeshInstance3D = null
var plate: Sign
var plateMode := ""
var H := 1.0
var rot_y := 0.0

var pos: Vector3:
	get: return root.position
	set(v): root.position = v

func _init(c_: Dictionary, mut_: int) -> void:
	c = c_; mut = mut_
	recalc()
	vis = Chars.obtain_visual(c.id, mut)
	spec = vis.spec
	sc = spec.scale * Data.MUTATIONS[mut].scale
	root = Node3D.new()
	root.add_child(vis.root)
	vis.root.scale = Vector3(sc, sc, sc); vis.root.position = Vector3.ZERO; vis.root.rotation = Vector3.ZERO
	ph = randf() * 6; seed = randf() * 10
	var R: int = c.rarity
	H = spec.height * sc
	blob = Geo.mesh(Geo.G("plane"), Chars.blob_mat, 0, 0.03, 0, 1, 1, 1, root, false)
	var br := maxf(1.1, spec.rad * sc * 1.7)
	blob.basis = Geo.basis_xyz(-PI / 2, 0, 0) * Basis.from_scale(Vector3(br, br, 1))
	if R >= 3:
		aura = Geo.mesh(Geo.G("aura"), Geo.basic_mat(Data.RARITIES[R].color, 0.7, {"side": true}), 0, 0.06, 0, 1, 1, 1, root, false)
		var ar := maxf(1.0, spec.rad * sc * 1.25)
		aura.basis = Geo.basis_xyz(-PI / 2, 0, 0) * Basis.from_scale(Vector3(ar, ar, 1))
	if R >= 5:
		var gm := StandardMaterial3D.new()
		gm.albedo_texture = Chars.glow_tex; gm.albedo_color = Color.html(Data.RARITIES[R].color); gm.albedo_color.a = 0.22
		gm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; gm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; gm.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
		gm.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED; gm.disable_fog = true
		glow = Geo.mesh(Geo.G("plane"), gm, 0, H * 0.55, 0, H * 1.5, H * 1.5, 1, root, false)
	if R == 7:
		var pm := StandardMaterial3D.new()
		pm.albedo_texture = Tex.get_tex("pillar"); pm.albedo_color = Color(1, 0.85, 0.29, 0.32)
		pm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; pm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; pm.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
		pm.cull_mode = BaseMaterial3D.CULL_DISABLED; pm.disable_fog = true
		pillar = Geo.mesh(Geo.G("pillar"), pm, 0, 6, 0, 1, 1, 1, root, false)
		halo = Geo.mesh(Geo.G("torus"), Geo.mat("#ffe14a", {"e": "#ffd000", "ei": 2, "m": 1, "r": 0.2}), 0, H + 0.45, 0, 0.45, 0.45, 0.6, root)
	plate = Sign.new()
	plate.setup(2.6, 1.1, 512, 230, "rgba(0,0,0,.85)" if R >= 6 else "rgba(20,14,56,.78)", Data.RARITIES[R].color, true)
	plate.position = Vector3(0, H + (1.25 if R == 7 else 0.85), 0)
	plate.visible = false
	root.add_child(plate)
	Game.units_node.add_child(root)
	Game.units.append(self)

func recalc() -> void:
	var m: float = Data.MUTATIONS[mut].mult * (1 + 0.25 * lvl)
	price = c.price * m
	income = c.income * m

func set_plate(mode: String) -> void:
	var pr := Game.belt_price(self)
	var key := mode + str(pr) + str(lvl)
	if plateMode == key:
		return
	plateMode = key
	if mode == "":
		plate.visible = false
		return
	plate.set_lines(key, Chars.plate_lines(c, mut, mode, pr, income, lvl))
	var h := 1.17 if mode == "shop" else 0.96
	plate.scale = Vector3(1, h / 1.1, 1)

func place_at_slot() -> void:
	var p: Vector3 = slot.base.slotPos[slot.li]
	pos = p
	yaw = slot.base.frontYaw
	root.rotation.y = yaw
	rot_y = yaw
	vis.root.scale = Vector3(sc, sc, sc)

func dispose(poof: bool = true) -> void:
	if poof:
		FX.burst(Vector3(pos.x, pos.y + 1, pos.z), {"count": 18, "color": ["#ffffff", Data.RARITIES[c.rarity].color], "speed": 4, "life": 0.7})
	state = "dead"
	root.remove_child(vis.root)
	Chars.release_visual(vis)
	Game.units.erase(self)
	root.queue_free()

func update(dt: float, t: float, camPos: Vector3) -> void:
	moving = false
	if state == "belt":
		var B = belt if belt != null else Game.BELTS[0]
		pos.x += Game.belt_speed(B) * dt
		pos.y = B.top
		yaw = PI / 2
		moving = true
		set_plate("shop")
		if pos.x > B.x1:
			B.list.erase(self)
			if Game.player != null and U.dist2(pos, Game.player.body.pos) < 400:
				Sound.play("poof")
			dispose(true)
			return
	elif state == "transit":
		transitT += dt
		var sp = path[pi] if pi < path.size() else null
		if sp == null or transitT > 30:
			arrive()
		else:
			var dx: float = sp.x - pos.x; var dz: float = sp.y - pos.z; var d := Vector2(dx, dz).length(); var step := tSpeed * dt
			if d <= step:
				pos.x = sp.x; pos.z = sp.y
				pi += 1
				if pi >= path.size():
					arrive()
			else:
				pos.x += dx / d * step; pos.z += dz / d * step
				yaw = atan2(dx, dz); moving = true
			if state == "transit":
				var f := Phys.floor_at(pos.x, pos.z, 0.2, pos.y + 0.3)
				pos.y = U.damp(pos.y, f[0], 20, dt)
	elif state == "carried" and carrier != null:
		var b: Vector3 = carrier.body.pos
		pos = Vector3(b.x, b.y + 2.25 + sin(t * 6) * 0.05, b.z)
		yaw = carrier.yaw
		vis.root.scale = Vector3(sc * 0.62, sc * 0.62, sc * 0.62)
	if state == "belt" or state == "transit":
		rot_y = rot_y + U.ang_diff(rot_y, yaw) * (1.0 - exp(-10 * dt))
	else:
		rot_y = yaw
	root.rotation.y = rot_y
	var cd := camPos.distance_to(pos)
	var Q := S.Q()
	var vis_ok: bool = cd < Q.unitDist
	root.visible = vis_ok
	if not vis_ok:
		return
	plate.visible = cd < Q.plateDist and (state == "belt" or state == "slotted") and plateMode != ""
	blob.visible = state != "carried"
	Chars.animate_unit(self, dt, t, moving)
	if aura:
		var ar := maxf(1.0, spec.rad * sc * 1.25)
		aura.basis = Geo.basis_xyz(-PI / 2, 0, 0) * Basis(Vector3.BACK, t * 1.2) * Basis.from_scale(Vector3(ar, ar, 1))
		aura.visible = state != "carried"
	if glow:
		glow.material_override.albedo_color.a = 0.2 + sin(t * 3 + seed) * 0.07
	if halo:
		halo.position.y = H + 0.45 + sin(t * 2) * 0.08
		halo.basis = Geo.basis_xyz(PI / 2, 0, t) * Basis.from_scale(Vector3(0.45, 0.45, 0.6))
	if pillar:
		pillar.visible = state != "carried"
	var R: int = c.rarity
	if (R >= 4 or mut >= 2) and cd < 32:
		fxT -= dt
		if fxT <= 0:
			fxT = 0.08 if R >= 6 else 0.18
			var col
			if R == 6:
				col = U.pick(["#7af7ff", "#ff2af0", "#111111"])
			elif mut == 3:
				col = Color.from_hsv(fmod(t * 120.0, 360.0) / 360.0, 1.0, 1.0)
			else:
				col = Data.RARITIES[R if R >= 4 else 4].color
			FX.one(pos.x + U.rnd(-0.8, 0.8), pos.y + U.rnd(0.3, H), pos.z + U.rnd(-0.8, 0.8), {"vx": 0, "vy": U.rnd(0.5, 1.4), "vz": 0, "life": 1.1, "size": U.rnd(0.18, 0.32), "color": col, "grav": 0, "drag": 0.5})

func arrive() -> void:
	state = "slotted"; path = []
	place_at_slot(); set_plate("base")
	FX.burst(Vector3(pos.x, pos.y + 0.5, pos.z), {"count": 14, "color": [owner.color, "#ffffff"], "speed": 3, "up": true, "life": 0.7})
	if owner.isPlayer:
		Tutorial.event("slotted")
