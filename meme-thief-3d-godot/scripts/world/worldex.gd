## Worlds 4 & 5 — frozen pole (slippery ice, blizzards, giant snowballs) and neon moon (low gravity, sweeping lasers).
class_name EXW

static var D: Dictionary = {
	4: {"n": 4, "X": Phys.X4, "B": Phys.WORLD4, "built": false, "anim": [], "keeper": null, "shopPos": null, "pIn": null, "pBack": null, "appearT": 0.0, "belt_mat": null, "playerPlot": null, "aurora": null, "earth": null,
		"title": "❄️ قطب یخی", "welcome": "زمین یخ لیز است · کولاک می‌آید · گلوله‌برفی‌های غول‌پیکر می‌غلتند", "mut": "یخی", "mult": "۲۰ هزار",
		"arrival": Vector3(Phys.X4 + 88, 0, 0), "back": Vector3(Phys.X4 + 98, 0, 0), "entry": Vector3(Phys.X3 + 71, 0, 7),
		"portalColors": ["#9fe8ff", "#ffffff"], "portalLabel": "❄️ پرتال قطب یخی", "shop": "🏕️ اردوگاه قطبی", "shopSub": "وسایل مخصوص یخبندان", "keeperName": "کاشف قطبی",
		"names": ["ملکه‌ی یخ", "یتی خشمگین", "کاپیتان قطبی", "گرگ برفی"], "colors": ["#7fdbff", "#e0e0e0", "#3d7bff", "#9aa5b1"],
		"looks": [{"skin": "#e8f4ff", "shirt": "#7fdbff", "pants": "#e8f4ff", "shoes": "#ffffff", "hair": "long", "hairC": "#ffffff", "accent": "#29b6ff", "hat": "#bfefff"},
			{"skin": "#d8dde4", "shirt": "#f4f4f4", "pants": "#c8cdd4", "shoes": "#5a6a7a", "hair": "spiky", "hairC": "#ffffff", "accent": "#7fdbff"},
			{"skin": "#ffd6b0", "shirt": "#3d7bff", "pants": "#1b2a4a", "shoes": "#111111", "hair": "cap", "hairC": "#111111", "accent": "#ff3a3a", "hat": "#ff3a3a"},
			{"skin": "#c8ccd0", "shirt": "#5a6470", "pants": "#2a3038", "shoes": "#111111", "hair": "spiky", "hairC": "#9aa5b1", "accent": "#ffffff"}],
		"guardLook": {"skin": "#ffffff", "shirt": "#29b6ff", "pants": "#e8f4ff", "shoes": "#29b6ff", "hair": "cap", "hairC": "#111111", "accent": "#7fdbff", "hat": "#ffffff"},
		"keeperLook": {"skin": "#ffe0bd", "shirt": "#ff7a2a", "pants": "#3a2a20", "shoes": "#111111", "hair": "cap", "hairC": "#111111", "accent": "#ffd23f", "hat": "#ff3a3a"},
		"storm": {"on": 0.0, "next": 30.0, "k": 0.0}, "balls": [], "ballT": 4.0, "lasers": []},
	5: {"n": 5, "X": Phys.X5, "B": Phys.WORLD5, "built": false, "anim": [], "keeper": null, "shopPos": null, "pIn": null, "pBack": null, "appearT": 0.0, "belt_mat": null, "playerPlot": null, "aurora": null, "earth": null,
		"title": "🌙 ماه نئونی", "welcome": "جاذبه‌ی کم: بلند بپر · لیزرهای چرخان را رد کن · نگهبان‌ها تندترند", "mut": "نئونی", "mult": "۲۰۰ هزار",
		"arrival": Vector3(Phys.X5 + 88, 0, 0), "back": Vector3(Phys.X5 + 98, 0, 0), "entry": Vector3(Phys.X4 + 90, 0, -36),
		"portalColors": ["#ff3df2", "#3df2ff"], "portalLabel": "🌙 پرتال ماه نئونی", "shop": "🛰️ آزمایشگاه ماه", "shopSub": "ابزارهای فضایی", "keeperName": "دانشمند ماه",
		"names": ["فرمانده‌ی ماه", "ربات نئونی", "شکارچی ستاره", "ملکه‌ی کهکشان"], "colors": ["#ff3df2", "#3df2ff", "#ffe14a", "#a98bff"],
		"looks": [{"skin": "#ffd6b0", "shirt": "#2a2a3a", "pants": "#1a1a24", "shoes": "#ff3df2", "hair": "cap", "hairC": "#111111", "accent": "#ff3df2", "hat": "#ff3df2"},
			{"skin": "#b0bec5", "shirt": "#3df2ff", "pants": "#2a3038", "shoes": "#3df2ff", "hair": "phones", "hairC": "#222222", "accent": "#3df2ff"},
			{"skin": "#e0ac69", "shirt": "#ffe14a", "pants": "#2a2a3a", "shoes": "#111111", "hair": "spiky", "hairC": "#ffe14a", "accent": "#ff7a2a"},
			{"skin": "#f0d8ff", "shirt": "#a98bff", "pants": "#2a1a4a", "shoes": "#ffffff", "hair": "long", "hairC": "#ff9de2", "accent": "#ffe14a", "hat": "#ffe14a"}],
		"guardLook": {"skin": "#c0c8d0", "shirt": "#1a1a24", "pants": "#1a1a24", "shoes": "#ff3df2", "hair": "phones", "hairC": "#ff3df2", "accent": "#3df2ff"},
		"keeperLook": {"skin": "#ffe0bd", "shirt": "#ffffff", "pants": "#2a3038", "shoes": "#3df2ff", "hair": "spiky", "hairC": "#eeeeee", "accent": "#3df2ff"},
		"storm": {"on": 0.0, "next": 30.0, "k": 0.0}, "balls": [], "ballT": 4.0, "lasers": []},
}
static var checkT := 0.0

static func bases_of(X: float) -> Array:
	return [[X - 56, 38.0], [X, 38.0], [X + 56, 38.0], [X - 30, -38.0], [X + 30, -38.0]]
static func prev(n: int) -> int: return 3 if n == 4 else 4
static func worth(n: int) -> float: return Data.PORTAL4_WORTH if n == 4 else Data.PORTAL5_WORTH
static func unlocked(n: int) -> bool: return Game.portal4Unlocked if n == 4 else Game.portal5Unlocked
static func prev_built(n: int) -> bool: return W3.built if n == 4 else D[4].built

static func build(n: int) -> void:
	var Dn: Dictionary = D[n]
	if Dn.built:
		return
	Dn.built = true
	var X: float = Dn.X; var B: Dictionary = Dn.B; var ice := n == 4
	var groundTex := Tex.get_tex("ice" if ice else "moon"); var plazaTex := Tex.get_tex("icePlaza" if ice else "moonPlaza")
	var ground := Geo.mesh(Geo.plane_g(B.maxX - B.minX + 160, B.maxZ - B.minZ + 160), Geo.mat("#ffffff", {"map": groundTex, "rep": Vector2(30, 20), "r": 0.75 if ice else 0.98}), X, 0, 0, 1, 1, 1, World, false); Geo.rot(ground, -PI / 2)
	var plazaM: StandardMaterial3D
	if ice:
		plazaM = Geo.mat("#ffffff", {"map": plazaTex, "rep": Vector2(20, 7), "r": 0.08, "m": 0.15})
	else:
		plazaM = Geo.mat("#ffffff", {"map": plazaTex, "rep": Vector2(40, 13), "emap": plazaTex, "e": "#ffffff", "ei": 0.55, "r": 0.5})
	World.ground_quad(X - 84, -26, X + 84, 26, plazaM, 0.012)
	var pathM := World.flat_mat(Tex.get_tex("tiles"), "#e8f4ff" if ice else "#5a5a70", Vector2(2, 4))
	for bc in bases_of(X):
		var s := signf(bc[1])
		World.ground_quad(bc[0] - 3.5, s * 26, bc[0] + 3.5, s * (absf(bc[1]) - 11), pathM, 0.03)
	var wb := Geo.Batcher.new()
	var wallM := Geo.mat("#d8f2ff", {"r": 0.1, "m": 0.2, "e": "#7fdbff", "ei": 0.15, "flat": true}) if ice else Geo.mat("#2a2a3a", {"r": 0.4, "m": 0.6})
	if ice:
		var x: float = B.minX
		while x <= B.maxX:
			for z in [B.minZ, B.maxZ]:
				wb.add(Geo.G("oct"), wallM, x, 2.5, z, 2.4, U.rnd(4, 7), 1.8, U.rnd(0, 1))
			x += 5
		var z: float = B.minZ
		while z <= B.maxZ:
			for xx in [B.minX, B.maxX]:
				wb.add(Geo.G("oct"), wallM, xx, 2.5, z, 1.8, U.rnd(4, 7), 2.4, U.rnd(0, 1))
			z += 5
	else:
		var neon := Geo.mat("#ff3df2", {"e": "#ff3df2", "ei": 2})
		for z in [B.minZ, B.maxZ]:
			wb.add(Geo.G("box"), wallM, X, 1.6, z, B.maxX - B.minX, 3.2, 0.6); wb.add(Geo.G("box"), neon, X, 2.6, z, B.maxX - B.minX, 0.12, 0.66)
		for x in [B.minX, B.maxX]:
			wb.add(Geo.G("box"), wallM, x, 1.6, 0, 0.6, 3.2, B.maxZ - B.minZ); wb.add(Geo.G("box"), neon, x, 2.6, 0, 0.66, 0.12, B.maxZ - B.minZ)
	wb.build(World)
	Phys.add_box(B.minX - 2, 0, B.minZ - 2, B.maxX + 2, 6, B.minZ + 0.8); Phys.add_box(B.minX - 2, 0, B.maxZ - 0.8, B.maxX + 2, 6, B.maxZ + 2)
	Phys.add_box(B.minX - 2, 0, B.minZ, B.minX + 0.8, 6, B.maxZ); Phys.add_box(B.maxX - 0.8, 0, B.minZ, B.maxX + 2, 6, B.maxZ)
	var BT = Game.BELTS[n - 1]
	Dn.belt_mat = World.build_belt_geometry(BT, "#e8f4ff" if ice else "#1a1430", "belt", "#bfe6ff" if ice else "#ffb0ff", Geo.mat("#ffffff" if ice else "#3df2ff", {"e": "#7fdbff" if ice else "#3df2ff", "ei": 1.4}), not ice, World)
	var rift := W2.make_portal(Vector3(BT.x0 - 2.4, 0, 0), ["#9fe8ff", "#ffffff"] if ice else ["#ff3df2", "#3df2ff"], "❄️ دروازه‌ی یخ" if ice else "🌌 دروازه‌ی ستاره", "swirl6" if ice else "swirl5"); rift.g.scale = Vector3(0.85, 0.85, 0.85)
	for s in [-1, 1]:
		Phys.add_box_c(BT.x0 - 2.4, 3.2, s * 3.3, 1, 6.4, 1)
	Dn.anim.append(func(dt: float, t: float) -> void: W2.anim_portal(rift, dt, t))
	if ice:
		Geo.mesh(Geo.G("hemi"), Geo.mat("#ffffff", {"r": 0.6, "e": "#e8f4ff", "ei": 0.2}), BT.x1 + 3.5, 0, 0, 3.2, 3, 3.6, World)
	else:
		Geo.mesh(Geo.G("hemi"), Geo.glass_mat("#d0c0ff"), BT.x1 + 3.5, 0, 0, 3.2, 3, 3.6, World, false); Geo.mesh(Geo.G("cyl"), Geo.mat("#3df2ff", {"e": "#3df2ff", "ei": 2}), BT.x1 + 3.5, 0.1, 0, 3.3, 0.2, 3.3, World)
	Phys.add_circle(BT.x1 + 3.5, 0, 3, 0, 3)
	var clear := func(x: float, z: float, m: float = 0.0) -> bool:
		if absf(z) < 28 + m and absf(x - X) < 88 + m:
			return true
		for bc in bases_of(X):
			var lz: float = (z - bc[1]) * signf(bc[1])
			if absf(x - bc[0]) < 15 + m and lz > -14 - m and lz < 24 + m:
				return true
		if absf(x - (X - 96)) < 10 + m and absf(z) < 10 + m:
			return true
		if absf(x - Dn.back.x) < 7 + m and absf(z) < 7 + m:
			return true
		if n == 4 and absf(x - D[5].entry.x) < 8 + m and absf(z - D[5].entry.z) < 8 + m:
			return true
		return false
	if ice:
		var tb := Geo.Batcher.new(); var trunkM := Geo.mat("#6b4a2a", {"r": 0.9}); var pineM := Geo.mat("#2f6b4a", {"r": 0.9, "flat": true}); var capM := Geo.mat("#ffffff", {"r": 0.8})
		var ti := 0; var k := 0
		while k < 900 and ti < 60:
			k += 1
			var x := U.rnd(B.minX + 4, B.maxX - 4); var z := U.rnd(B.minZ + 4, B.maxZ - 4)
			if clear.call(x, z, 3):
				continue
			var s := U.rnd(0.9, 1.5)
			tb.add(Geo.G("cyl"), trunkM, x, 0.6 * s, z, 0.25 * s, 1.2 * s, 0.25 * s)
			for l in 3:
				tb.add(Geo.G("cone"), pineM, x, (1.6 + l * 1.1) * s, z, (1.7 - l * 0.45) * s, 1.6 * s, (1.7 - l * 0.45) * s)
			tb.add(Geo.G("cone"), capM, x, 4.25 * s, z, 0.55 * s, 0.6 * s, 0.55 * s); Phys.add_circle(x, z, 0.5 * s, 0, 4 * s); ti += 1
		for ig in [[X - 100, 50], [X + 100, -50], [X - 78, -52], [X + 88, 56]]:
			tb.add(Geo.G("hemi"), Geo.mat("#f4faff", {"r": 0.7}), ig[0], 0, ig[1], 4.2, 3.2, 4.2); tb.add(Geo.G("cyl"), Geo.mat("#1a2a3a"), ig[0], 0.9, ig[1] + 4, 1.1, 1.8, 0.4); Phys.add_circle(ig[0], ig[1], 4, 0, 3.2)
		var cryM := Geo.mat("#d8f6ff", {"e": "#4fc8ff", "ei": 0.35, "r": 0.05, "m": 0.2, "flat": true, "t": 0.85})
		var ci := 0; k = 0
		while k < 2000 and ci < 90:
			k += 1
			var x := U.rnd(B.minX + 3, B.maxX - 3); var z := U.rnd(B.minZ + 3, B.maxZ - 3)
			if clear.call(x, z, 2):
				continue
			var s := U.rnd(0.5, 1.6)
			tb.add(Geo.G("oct"), cryM, x, s, z, s * 0.45, s * 1.6, s * 0.45, U.rnd(0, 3), U.rnd(-0.3, 0.3), U.rnd(-0.3, 0.3))
			if s > 1.1:
				Phys.add_circle(x, z, s * 0.4, 0, s * 2)
			ci += 1
		for sm in [[X - 84, 22], [X + 84, -22], [X - 10, -24], [X + 40, 24]]:
			var sx: float = sm[0]; var sz: float = sm[1]; var wh := Geo.mat("#ffffff", {"r": 0.7})
			tb.add(Geo.G("sphere"), wh, sx, 0.9, sz, 1, 0.95, 1); tb.add(Geo.G("sphere"), wh, sx, 2.2, sz, 0.7, 0.68, 0.7); tb.add(Geo.G("sphere"), wh, sx, 3.2, sz, 0.48, 0.48, 0.48)
			tb.add(Geo.G("cone"), Geo.mat("#ff7a1f"), sx, 3.2, sz + 0.55, 0.08, 0.4, 0.08, 0, PI / 2)
			for s in [-1, 1]:
				tb.add(Geo.G("sphere"), Geo.mat("#111111"), sx + s * 0.16, 3.35, sz + 0.42, 0.06, 0.06, 0.05)
			tb.add(Geo.G("cyl"), Geo.mat("#1b1b22"), sx, 3.75, sz, 0.36, 0.5, 0.36); tb.add(Geo.G("torus"), Geo.mat("#ff3a3a", {"r": 0.9}), sx, 2.75, sz, 0.55, 0.55, 2, 0, PI / 2); Phys.add_circle(sx, sz, 1, 0, 4)
		tb.build(World)
		var aur := Node3D.new(); World.add_child(aur); Dn.aurora = aur; aur.visible = false
		var aM := StandardMaterial3D.new(); aM.albedo_texture = Tex.get_tex("aurora"); aM.albedo_color = Color(1, 1, 1, 0.5); aM.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; aM.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; aM.blend_mode = BaseMaterial3D.BLEND_MODE_ADD; aM.cull_mode = BaseMaterial3D.CULL_DISABLED; aM.disable_fog = true
		var planes := []
		for i in 3:
			var pl := Geo.mesh(Geo.plane_g(420, 70), aM.duplicate(), X - 60 + i * 50, 110 + i * 12, -220 + i * 30, 1, 1, 1, World, false); Geo.rot(pl, 0.25); pl.extra_cull_margin = 16384; planes.append(pl); pl.reparent(aur)
		Dn.anim.append(func(_dt: float, t: float) -> void:
			for i in planes.size():
				planes[i].material_override.albedo_color.a = 0.35 + sin(t * 0.3 + i) * 0.15)
	else:
		var rb := Geo.Batcher.new(); var rockM := Geo.mat("#6a6c78", {"r": 0.95, "flat": true})
		var ri := 0; var k := 0
		while k < 2000 and ri < 80:
			k += 1
			var x := U.rnd(B.minX + 3, B.maxX - 3); var z := U.rnd(B.minZ + 3, B.maxZ - 3)
			if clear.call(x, z, 2):
				continue
			var s := U.rnd(0.5, 2.4)
			rb.add(Geo.G("dodec"), rockM, x, s * 0.4, z, s, s * 0.7, s * U.rnd(0.8, 1.2), U.rnd(0, 3), U.rnd(0, 1))
			if s > 1.2:
				Phys.add_circle(x, z, s * 0.8, 0, s)
			ri += 1
		rb.build(World)
		var made := 0; k = 0
		while k < 400 and made < 12:
			k += 1
			var x := U.rnd(B.minX + 10, B.maxX - 10); var z := U.rnd(B.minZ + 10, B.maxZ - 10)
			if clear.call(x, z, 6):
				continue
			var r := U.rnd(3, 6)
			var tr := Geo.mesh(Geo.G("torus"), Geo.mat("#7a7c88", {"r": 1.0}), x, 0.05, z, r, r, 3, World); Geo.rot(tr, PI / 2)
			World.ground_quad(x - r * 0.8, z - r * 0.8, x + r * 0.8, z + r * 0.8, Geo.mat("#4a4c56", {"r": 0.92}), 0.02); made += 1
		var pyl := Geo.Batcher.new(); var pm := Geo.mat("#2a2a3a", {"m": 0.7, "r": 0.3}); var pn := [Geo.mat("#ff3df2", {"e": "#ff3df2", "ei": 2.2}), Geo.mat("#3df2ff", {"e": "#3df2ff", "ei": 2.2})]
		var x := X - 80
		while x <= X + 80:
			for z in [-27.0, 27.0]:
				pyl.add(Geo.G("cyl"), pm, x, 2.5, z, 0.25, 5, 0.25); pyl.add(Geo.G("sphere"), pn[0 if (int(x / 20) + (1 if z > 0 else 0)) & 1 else 1], x, 5.2, z, 0.35, 0.35, 0.35); Phys.add_circle(x, z, 0.3, 0, 5)
			x += 20
		pyl.build(World)
		for dm in [[X - 98, 52, 7], [X + 96, -52, 8], [X + 92, 50, 5]]:
			var dx: float = dm[0]; var dz: float = dm[1]; var r: float = dm[2]
			Geo.mesh(Geo.G("hemi"), Geo.glass_mat("#c8b8ff"), dx, 0, dz, r, r * 0.8, r, World, false); Geo.mesh(Geo.G("cyl"), Geo.mat("#3df2ff", {"e": "#3df2ff", "ei": 1.6}), dx, 0.1, dz, r + 0.1, 0.2, r + 0.1, World); Phys.add_circle(dx, dz, r, 0, r * 0.8)
		var earth := Node3D.new(); World.add_child(earth); earth.visible = false; Dn.earth = earth
		var e1 := Geo.mesh(Geo.G("sphere"), Geo.basic_mat("#ffffff", 1.0, {"map": Tex.get_tex("earth"), "nofog": true}), 0, 0, 0, 55, 55, 55, earth, false); e1.extra_cull_margin = 16384
		var e2 := Geo.mesh(Geo.G("sphere"), Geo.add_mat("#7ab8ff", 0.25), 0, 0, 0, 60, 60, 60, earth, false); e2.extra_cull_margin = 16384
		Dn.anim.append(func(dt: float, _t: float) -> void: e1.rotation.y += dt * 0.02)
		var beamM := Geo.basic_mat("#ff4a7a", 1.0, {"nofog": true}); var glowM := Geo.add_mat("#ff3df2", 0.55); var zoneM := Geo.basic_mat("#ff2a6a", 0.35, {"side": true})
		for L in [[X - 52, 14.5, 10.0, 0.95], [X + 6, 14.5, 10.0, -1.05], [X + 58, 14.5, 10.0, 0.9], [X - 22, -14.5, 10.0, -1.0], [X + 34, -14.5, 10.0, 1.1]]:
			var lx: float = L[0]; var lz: float = L[1]; var len: float = L[2]; var spd: float = L[3]
			var g := Node3D.new(); g.position = Vector3(lx, 0, lz); World.add_child(g)
			Geo.mesh(Geo.G("cyl"), Geo.mat("#2a2a3a", {"m": 0.8, "r": 0.3}), 0, 0.75, 0, 0.55, 1.5, 0.55, g); Geo.mesh(Geo.G("sphere"), Geo.mat("#ff2a6a", {"e": "#ff2a6a", "ei": 2.5}), 0, 1.6, 0, 0.35, 0.35, 0.35, g); Phys.add_circle(lx, lz, 0.6, 0, 1.6)
			var arm := Node3D.new(); arm.position.y = 0.75; g.add_child(arm)
			Geo.mesh(Geo.G("box"), beamM, len / 2 + 0.5, 0, 0, len, 0.2, 0.2, arm, false); Geo.mesh(Geo.G("box"), glowM, len / 2 + 0.5, 0, 0, len, 0.7, 0.7, arm, false); Geo.mesh(Geo.G("sphere"), beamM, len + 0.5, 0, 0, 0.3, 0.3, 0.3, arm, false)
			var zone := Geo.mesh(Geo.ring_g(len + 0.35, len + 0.75, 64), zoneM, lx, 0.04, lz, 1, 1, 1, World, false); Geo.rot(zone, -PI / 2)
			Dn.lasers.append({"x": lx, "z": lz, "len": len, "spd": spd, "a": randf() * TAU, "arm": arm})
	var welcome := Sign.make([{"t": Dn.title, "size": 72, "color": "#0d3b66" if ice else "#ffffff", "weight": 900, "stroke": 0 if ice else 6}, {"t": Dn.welcome, "size": 30, "color": "#1b1446" if ice else "#ffe14a", "weight": 800}], {"w": 768, "h": 220, "bg": "rgba(255,255,255,.92)" if ice else "rgba(20,10,40,.92)", "border": "#29b6ff" if ice else "#ff3df2"}, 11, 3.15)
	welcome.position = Vector3(X, 9, 0); World.add_child(welcome)
	# the world's shop and its keeper
	var SX := X - 96
	var g := Node3D.new(); g.position = Vector3(SX, 0, 0); World.add_child(g)
	var wall := Geo.mat("#8a5a3a", {"r": 0.8}) if ice else Geo.mat("#e8ecf4", {"r": 0.4, "m": 0.3}); var trim := Geo.mat("#ffffff", {"r": 0.6}) if ice else Geo.mat("#3df2ff", {"e": "#3df2ff", "ei": 0.8}); var sb := Geo.Batcher.new()
	sb.add(Geo.G("box"), wall, -5.5, 2.4, 0, 0.4, 4.8, 12); sb.add(Geo.G("box"), wall, 0, 2.4, -6, 11, 4.8, 0.4); sb.add(Geo.G("box"), wall, 0, 2.4, 6, 11, 4.8, 0.4)
	sb.add(Geo.rbox(11.6, 0.4, 12.8, 0.15), trim, 0, 5, 0); sb.add(Geo.rbox(1.3, 1.1, 7, 0.1), Geo.mat("#ff7a2a" if ice else "#ff3df2", {"r": 0.5}), 3, 0.55, 0)
	if ice:
		sb.add(Geo.G("box"), Geo.mat("#ffffff", {"r": 0.7}), 0, 5.35, 0, 11.8, 0.5, 13)
	else:
		Geo.mesh(Geo.G("hemi"), Geo.glass_mat("#c8b8ff"), 0, 5.2, 0, 4, 2.4, 4, g, false)
	sb.build(g)
	Phys.add_box(SX - 5.7, 0, -6.2, SX - 5.3, 4.8, 6.2); Phys.add_box(SX - 5.5, 0, -6.2, SX + 5.5, 4.8, -5.8); Phys.add_box(SX - 5.5, 0, 5.8, SX + 5.5, 4.8, 6.2); Phys.add_box(SX + 2.35, 0, -3.5, SX + 3.65, 1.1, 3.5)
	var sign := Sign.make([{"t": Dn.shop, "size": 74, "color": "#0d3b66" if ice else "#ffffff", "weight": 900}, {"t": Dn.shopSub, "size": 34, "color": "#1b1446" if ice else "#3df2ff", "weight": 800}], {"w": 640, "h": 200, "bg": "rgba(255,255,255,.95)" if ice else "rgba(20,10,40,.95)", "border": "#ff7a2a" if ice else "#3df2ff"}, 8, 2.5); sign.position = Vector3(SX + 2, 7.4, 0); World.add_child(sign)
	Dn.keeper = Avatar.build(Dn.keeperLook); Dn.keeper.root.position = Vector3(SX + 1.2, 0.1, 0); Dn.keeper.root.rotation.y = PI / 2; Game.agents_node.add_child(Dn.keeper.root)
	Dn.shopPos = Vector3(SX + 6.5, 0, 0)
	var first := World.bases.size()
	for bc in bases_of(X):
		var bv := BaseVis.new(World.bases.size(), bc[0], bc[1]); World.bases.append(bv); World.add_child(bv.node)
	Dn.playerPlot = World.bases[first + 1]; Dn.playerPlot.build("#a0c4ff" if ice else "#5a4a8a", "پایگاه تو · منتظر توست", true)
	var k := 0
	for bi in [first, first + 2, first + 3, first + 4]:
		var o := Owner.new(Game.owners.size(), Dn.names[k], Dn.colors[k], false, World.bases[bi]); o.hard = true; o.elite = n; Game.owners.append(o); o.base.build(o.color, o.name, false)
		var a := Agent.new(o, Dn.looks[k], false); a.brain.aggr = U.rnd(2.3, 3); a.brain.stealCd = U.rnd(8, 18)
		Agent.new(o, Dn.guardLook, false, {"guard": o.base}); o.apply_cap()
		k += 1
	Dn.pBack = W2.make_portal(Dn.back, ["#29d9ff", "#3df2b0"], "🌍 برگشت به میدان میم‌ها", "swirl3")
	for s in [-1, 1]:
		Phys.add_box_c(Dn.back.x, 3.8, s * 3.9, 1.1, 7.6, 1.1)
	Nav.build(n)
	BT.active = true
	Game.prefill_belt(BT, 560, 2.6, 3.6)
	UI.map_dirty()
	build_in(n)

static func seed_owner(o: Owner) -> void:
	var n := o.elite; var M: Array = Data.WORLD_MUTS[n]; var Wt := Data.weights_of(n)
	o.hard = true; o.money = U.rndi(1, 5) * (1e15 if n == 4 else 1e17); o.up.cap = U.rndi(2, 4); o.up.secDur = U.rndi(3, 4); o.up.trap = U.rndi(2, 3); o.up.speed = U.rndi(3, 4)
	var cnt := U.rndi(4, mini(o.cap, 7))
	for i in cnt:
		var x := randf() * 100; var r := 5
		for k in range(5, 8):
			x -= Wt[k]
			if x <= 0:
				r = k
				break
		var u := Unit.new(Data.pick_char(n, r), M[1] if randf() < 0.1 else M[0])
		u.owner = o; u.slot = o.slots[i]; o.slots[i].unit = u; u.state = "slotted"; u.place_at_slot(); u.set_plate("base")
	o.apply_cap()

static func arrive(n: int) -> void:
	var o := Game.player.owner; var Dn: Dictionary = D[n]
	if Dn.playerPlot != null and Dn.playerPlot.owner == null:
		Game.claim_plot(o, Dn.playerPlot, true); UI.banner("👋 به " + Dn.title + " خوش آمدی!", "یک پایگاه رایگان گرفتی · میم‌های اینجا " + Dn.mult + " برابر می‌ارزند"); Sound.play("success"); Game.schedule_save(true)
	else:
		UI.toast(Dn.title + " — میم‌های اینجا " + Dn.mult + " برابر می‌ارزند", "rare")

# ---------------------------------------------------------------- portals in / unlocking
static func build_in(n: int) -> void:
	var Dn: Dictionary = D[n]
	if Dn.pIn != null or not prev_built(n):
		return
	Dn.pIn = W2.make_portal(Dn.entry, Dn.portalColors, Dn.portalLabel, "swirl6" if n == 4 else "swirl5"); Dn.pIn.g.visible = false
	if unlocked(n):
		show(n, false)

static func show(n: int, anim: bool) -> void:
	var Dn: Dictionary = D[n]
	build_in(n)
	if Dn.pIn == null:
		return
	if not Dn.pIn.g.visible:
		for s in [-1, 1]:
			Phys.add_box_c(Dn.entry.x, 3.8, Dn.entry.z + s * 3.9, 1.1, 7.6, 1.1)
		if n == 4:
			Nav.build(3, func(x: float, z: float) -> bool: return not W3.walkable(x, z, 0.75))
		else:
			Nav.build(4)
	Dn.pIn.g.visible = true; Dn.appearT = 2.5 if anim else 0.0; UI.map_dirty()

static func unlock(n: int) -> void:
	if unlocked(n):
		return
	if n == 4:
		Game.portal4Unlocked = true
	else:
		Game.portal5Unlocked = true
	build(n); Game.seed_rivals(Game.owners.size() - 4); show(n, true)
	Sound.play("rebirth"); UI.banner("🌀 پرتال " + D[n].title + " باز شد!", "ثروتت به " + U.fmt(worth(n)) + " رسید · پرتال در " + Data.WORLD_NAMES[prev(n)] + " است")
	UI.toast("🌀 در " + Data.WORLD_NAMES[prev(n)] + " یک پرتال تازه به " + D[n].title + " باز شد! آنجا از همه‌جا سخت‌تر است", "rare"); Game.schedule_save(true)

static func update(dt: float, t: float) -> void:
	for n in [4, 5]:
		var Dn: Dictionary = D[n]
		if Dn.pIn != null and Dn.pIn.g.visible:
			W2.anim_portal(Dn.pIn, dt, t)
			if Dn.appearT > 0:
				Dn.appearT -= dt
				var k: float = maxf(0.01, 1 - maxf(0.0, Dn.appearT) / 2.5)
				Dn.pIn.g.scale = Vector3(k, k, k)
		if not Dn.built:
			continue
		W2.anim_portal(Dn.pBack, dt, t)
		if Dn.belt_mat != null:
			Dn.belt_mat.uv1_offset.x -= Game.belt_speed(Game.BELTS[n - 1]) * dt / 2.0
		var here: bool = Game.player != null and Phys.world_of(Game.player.body.pos.x) == n
		if here or n == 4:
			for f in Dn.anim:
				f.call(dt, t)
		if n == 4:
			update_ice(Dn, dt, here)
		else:
			update_moon(Dn, dt, here)
	if not Game.playing or Game.player == null:
		return
	checkT -= dt
	if checkT <= 0:
		checkT = 1
		var nw := Game.player.owner.net_worth()
		if Game.portal3Unlocked and not Game.portal4Unlocked and nw >= Data.PORTAL4_WORTH:
			unlock(4)
		elif Game.portal4Unlocked and not Game.portal5Unlocked and nw >= Data.PORTAL5_WORTH:
			unlock(5)
	if Portal.cd > 0:
		return
	var p := Game.player.body.pos
	for n in [4, 5]:
		var Dn: Dictionary = D[n]
		if Dn.pIn != null and Dn.pIn.g.visible and Dn.appearT <= 0 and U.dist2(p, Dn.entry) < 2.2 * 2.2 and p.y < 3 and p.y > -1:
			Portal.travel(n, Dn.entry)
			return
		if Dn.pBack != null and U.dist2(p, Dn.back) < 2.2 * 2.2 and p.y < 3:
			Portal.travel(1, Dn.back)
			return

## hazards: fling an agent, stun it and make it drop what it carries
static func knock(a: Agent, dx: float, dz: float, power: float, stun: float, msg: String) -> void:
	var b := a.body; var l := maxf(Vector2(dx, dz).length(), 1e-3)
	b.vel = Vector3(dx / l * power, 6.5, dz / l * power); b.grounded = false; a.fling = 0.45; a.stun(stun if a.isPlayer else stun * 0.6)
	if a.carrying != null:
		var u := a.carrying
		Game.return_unit(u)
		if a.isPlayer:
			UI.toast(msg + " «" + u.c.name + "» برگشت سر جایش!", "bad")
		elif u.owner != null and u.owner.isPlayer:
			UI.toast("😅 دزدِ میمت زمین خورد و «" + u.c.name + "» برگشت!", "good")
	elif a.isPlayer:
		UI.toast(msg, "bad")
	if a.isPlayer:
		Game.CAM.shake = maxf(Game.CAM.shake, 0.5); Sound.play("boom")

static func update_ice(Dn: Dictionary, dt: float, here: bool) -> void:
	var S4: Dictionary = Dn.storm; var pl := Game.player
	if S4.on > 0:
		S4.on -= dt
		if here and randf() < dt * 140:
			var p := pl.body.pos
			FX.one(p.x + U.rnd(-16, 16), p.y + U.rnd(1, 7), p.z + U.rnd(-16, 16), {"vx": U.rnd(4, 9), "vy": -2, "vz": U.rnd(-1, 1), "life": 1.2, "size": 0.18, "color": "#ffffff", "grav": 0, "drag": 0})
	elif here and Game.playing:
		S4.next -= dt
		if S4.next <= 0:
			S4.on = 12; S4.next = U.rnd(26, 42); Sound.play("whoosh"); UI.toast("🌨️ کولاک! (پالتوی خزدار گرمت نگه داشته)" if pl.owner.up.furCoat > 0 else "🌨️ کولاک! دید کم شد و کندتر می‌دوی", "bad")
	S4.k = U.damp(S4.k, 1.0 if S4.on > 0 else 0.0, 1.5, dt)
	if here and S4.on <= 0 and randf() < dt * 25:
		var p := pl.body.pos
		FX.one(p.x + U.rnd(-20, 20), p.y + U.rnd(4, 9), p.z + U.rnd(-20, 20), {"vx": U.rnd(-0.3, 0.3), "vy": -1.2, "vz": U.rnd(-0.3, 0.3), "life": 4, "size": 0.16, "color": "#ffffff", "grav": 0, "drag": 0})
	if here and Game.playing:
		Dn.ballT -= dt
		if Dn.ballT <= 0:
			Dn.ballT = U.rnd(2.6, 4.6)
			var dir := 1.0 if randf() < 0.5 else -1.0; var z: float = U.pick([-21, -13, -7, 7, 13, 21]); var r := U.rnd(1.3, 1.9)
			var m := Geo.mesh(Geo.G("ico2"), Geo.mat("#ffffff", {"r": 0.75, "flat": true}), Dn.X - dir * 86, r, z, r, r, r, World)
			Dn.balls.append({"m": m, "dir": dir, "r": r, "sp": U.rnd(8, 11)})
	for i in range(Dn.balls.size() - 1, -1, -1):
		var bl: Dictionary = Dn.balls[i]; var m: MeshInstance3D = bl.m
		m.position.x += bl.dir * bl.sp * dt; m.rotation.z -= bl.dir * bl.sp * dt / bl.r
		if randf() < dt * 20:
			FX.one(m.position.x - bl.dir * bl.r, 0.2, m.position.z + U.rnd(-bl.r, bl.r), {"vx": -bl.dir * 2, "vy": 2, "vz": U.rnd(-1, 1), "life": 0.6, "size": 0.3, "color": "#ffffff", "grav": -6})
		if absf(m.position.x - Dn.X) > 88 or not here:
			m.queue_free(); Dn.balls.remove_at(i)
			continue
		for a in Game.agents:
			if a.isGuard or a.stunned or not Phys.in_w4(a.body.pos.x):
				continue
			var p := a.body.pos
			if absf(p.x - m.position.x) < bl.r + 0.45 and absf(p.z - m.position.z) < bl.r + 0.45 and p.y < bl.r * 1.6:
				if a.isPlayer and a.owner.up.snowShield > 0:
					a.body.pos.z += signf(p.z - m.position.z if p.z != m.position.z else 1.0) * 0.3
					continue
				knock(a, bl.dir, (p.z - m.position.z) * 0.5, 13, 1.3, "☃️ گلوله‌برفی زیرت گرفت!")

static func update_moon(Dn: Dictionary, dt: float, here: bool) -> void:
	for L in Dn.lasers:
		L.a += L.spd * dt; L.arm.rotation.y = -L.a
		var cx := cos(L.a); var cz := sin(L.a)
		for a in Game.agents:
			if a.isGuard or a.stunned or not Phys.in_w5(a.body.pos.x):
				continue
			var p := a.body.pos; var dx: float = p.x - L.x; var dz: float = p.z - L.z
			if dx * dx + dz * dz > (L.len + 1.2) * (L.len + 1.2) or p.y > 1.15:
				continue
			var along: float = dx * cx + dz * cz; var perp := absf(-dx * cz + dz * cx)
			if along > 0.4 and along < L.len + 0.8 and perp < 0.5:
				if a.isPlayer and a.owner.up.laserSuit > 0:
					if randf() < dt * 8:
						FX.one(p.x, p.y + 0.8, p.z, {"vx": 0, "vy": 1, "vz": 0, "life": 0.3, "size": 0.3, "color": "#ff3df2"})
					continue
				knock(a, -dz * signf(L.spd), dx * signf(L.spd), 11, 1.4, "🔴 لیزر بهت خورد!"); Sound.play("zap")
	if here and randf() < dt * 6:
		var p := Game.player.body.pos
		FX.one(p.x + U.rnd(-25, 25), U.rnd(0.2, 2), p.z + U.rnd(-25, 25), {"vx": 0, "vy": U.rnd(0.2, 0.6), "vz": 0, "life": 3, "size": 0.2, "color": U.pick(["#ff3df2", "#3df2ff", "#ffe14a"]), "grav": 0, "drag": 0.1})

## is the player standing on slippery ice? (inside bases and on the belt you have grip)
static func on_ice(a: Agent) -> bool:
	var p := a.body.pos
	if not Phys.in_w4(p.x) or not a.body.grounded or a.body.groundTag == "belt4":
		return false
	for b in World.bases:
		if b.world == 4 and b.contains(p.x, p.z, 0.5):
			return false
	return absf(p.x - (Phys.X4 - 96)) > 8
