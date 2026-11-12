## Procedural textures (the original drew these on 2D canvases).
class_name Tex

static var _cache: Dictionary = {}
static var _rng := RandomNumberGenerator.new()

static func _img(w: int, h: int, fill: String) -> Image:
	var img := Image.create(w, h, false, Image.FORMAT_RGBA8)
	img.fill(Color.html(fill))
	return img

static func _rect(img: Image, x: float, y: float, w: float, h: float, c: Color) -> void:
	var r := Rect2i(int(x), int(y), maxi(1, int(ceilf(w))), maxi(1, int(ceilf(h))))
	r = r.intersection(Rect2i(0, 0, img.get_width(), img.get_height()))
	if r.size.x > 0 and r.size.y > 0:
		img.fill_rect(r, c)

static func _blend_rect(img: Image, x: float, y: float, w: float, h: float, c: Color) -> void:
	# alpha blend a rectangle
	var r := Rect2i(int(x), int(y), maxi(1, int(ceilf(w))), maxi(1, int(ceilf(h)))).intersection(Rect2i(0, 0, img.get_width(), img.get_height()))
	for yy in range(r.position.y, r.end.y):
		for xx in range(r.position.x, r.end.x):
			img.set_pixel(xx, yy, img.get_pixel(xx, yy).blend(c))

static func _speckle(img: Image, n: int, cols: Array, smin: float, smax: float) -> void:
	var w := img.get_width(); var h := img.get_height()
	for i in n:
		var s := _rng.randf_range(smin, smax)
		var c := Color.html(cols[i % cols.size()])
		if c.a < 1.0:
			_blend_rect(img, _rng.randf() * w, _rng.randf() * h, s, s, c)
		else:
			_rect(img, _rng.randf() * w, _rng.randf() * h, s, s, c)

static func _circle(img: Image, cx: float, cy: float, r: float, c: Color) -> void:
	var r2 := r * r
	for yy in range(maxi(0, int(cy - r)), mini(img.get_height(), int(cy + r + 1))):
		for xx in range(maxi(0, int(cx - r)), mini(img.get_width(), int(cx + r + 1))):
			if (xx - cx) * (xx - cx) + (yy - cy) * (yy - cy) <= r2:
				if c.a < 1.0:
					img.set_pixel(xx, yy, img.get_pixel(xx, yy).blend(c))
				else:
					img.set_pixel(xx, yy, c)

static func _line(img: Image, x0: float, y0: float, x1: float, y1: float, c: Color, wdt: float = 1.0) -> void:
	var n := int(maxf(absf(x1 - x0), absf(y1 - y0))) + 1
	for i in range(n + 1):
		var t := float(i) / n
		_rect(img, lerpf(x0, x1, t) - wdt / 2, lerpf(y0, y1, t) - wdt / 2, wdt, wdt, c)

static func _tex(img: Image) -> ImageTexture:
	img.generate_mipmaps()
	return ImageTexture.create_from_image(img)

static func get_tex(name: String) -> ImageTexture:
	if _cache.has(name):
		return _cache[name]
	_rng.seed = hash(name)
	var t := _make(name)
	_cache[name] = t
	return t

static func _make(name: String) -> ImageTexture:
	match name:
		"grass":
			var img := _img(256, 256, "#5fae44")
			var cols := ["#4f9a38", "#73c454", "#69b84c", "#3f8a2e", "#86d062"]
			for i in 2600:
				var x := _rng.randf() * 256; var y := _rng.randf() * 256; var l := _rng.randf_range(3, 8)
				_rect(img, x, y - l, _rng.randf_range(1, 2), l, Color.html(cols[i % 5]))
			_speckle(img, 40, ["#f5f0a0", "#ffffff", "#ffd0e0"], 1.5, 2.5)
			return _tex(img)
		"asphalt":
			var img := _img(256, 256, "#4a4d57")
			_speckle(img, 4000, ["#3d4049", "#585c66", "#53565f", "#61656f"], 1, 2)
			return _tex(img)
		"road", "roadV":
			var img := _img(256, 256, "#4a4d57")
			_speckle(img, 4000, ["#3d4049", "#585c66", "#53565f"], 1, 2)
			var white := Color.html("#f4f4f4"); var yel := Color.html("#ffd23f")
			if name == "road":
				_rect(img, 0, 6, 256, 6, white); _rect(img, 0, 256 - 12, 256, 6, white)
				for x in range(0, 256, 64):
					_rect(img, x + 8, 128 - 4, 36, 8, yel)
			else:
				_rect(img, 6, 0, 6, 256, white); _rect(img, 256 - 12, 0, 6, 256, white)
				for y in range(0, 256, 64):
					_rect(img, 128 - 4, y + 8, 8, 36, yel)
			return _tex(img)
		"tiles":
			var img := _img(256, 256, "#b9a98f")
			var cols := ["#e6d7bd", "#dccaa9", "#efe2c9", "#d5c19f", "#e9dbc2"]
			for y in 8:
				for x in 8:
					var o := (y % 2) * 16
					_rect(img, ((x * 32 + o) % 256) + 2, y * 32 + 2, 28, 28, Color.html(cols[(x * 7 + y * 3) % 5]))
			_speckle(img, 600, ["#0000000f", "#ffffff1f"], 1, 3)
			return _tex(img)
		"belt":
			var img := _img(128, 128, "#26262e")
			var pink := Color.html("#ff4f8b")
			for i in 2:
				var x := i * 64
				# chevron: two slanted bars
				for k in range(0, 44):
					_rect(img, x + 12 + k * 28.0 / 44.0, 20 + k, 14, 2, pink)
					_rect(img, x + 12 + k * 28.0 / 44.0, 108 - k, 14, 2, pink)
			for x in range(0, 128, 8):
				_rect(img, x, 0, 2, 128, Color.html("#3a3a46"))
			return _tex(img)
		"belt2":
			var img := _img(128, 128, "#120c18")
			var c := Color.html("#ff5a1f")
			for i in 2:
				var x := i * 64
				for k in range(0, 44):
					_rect(img, x + 12 + k * 28.0 / 44.0, 20 + k, 14, 2, c)
					_rect(img, x + 12 + k * 28.0 / 44.0, 108 - k, 14, 2, c)
			return _tex(img)
		"brick":
			var img := _img(256, 128, "#ddd2c4")
			var cols := ["#f3ece2", "#e8ddcf", "#efe6da"]
			for y in 8:
				for x in range(-1, 9):
					_rect(img, x * 32 + (y % 2) * 16 + 1, y * 16 + 1, 30, 14, Color.html(cols[posmod(x + y, 3)]))
			return _tex(img)
		"wood":
			var img := _img(128, 128, "#a8703f")
			for i in 40:
				var c := Color(0.31, 0.16, 0.04, 0.25) if i % 2 == 1 else Color(1.0, 0.86, 0.63, 0.15)
				var y := _rng.randf() * 128; var wdt := _rng.randf_range(1, 3)
				var o1 := _rng.randf_range(-6, 6); var o2 := _rng.randf_range(-6, 6)
				for x in 128:
					var t := x / 128.0
					var yy := y + o1 * sin(t * PI) + o2 * sin(t * PI * 2)
					_blend_rect(img, x, yy, 1, wdt, c)
			return _tex(img)
		"roof":
			var img := _img(128, 128, "#b6463a")
			var cols := ["#c8503f", "#a83f34", "#bd4a3c"]
			for y in 8:
				for x in 8:
					var cx := x * 16 + (y % 2) * 8 + 8; var cy := y * 16 + 16
					var c := Color.html(cols[(x + y * 2) % 3])
					for yy in range(cy - 9, cy + 1):
						for xx in range(cx - 9, cx + 10):
							if (xx - cx) * (xx - cx) + (yy - cy) * (yy - cy) <= 81 and xx >= 0 and xx < 128 and yy >= 0 and yy < 128:
								img.set_pixel(xx, yy, c)
			return _tex(img)
		"hedge":
			var img := _img(128, 128, "#2f7a2c")
			var cols := ["#3b9036", "#2a6b27", "#48a541", "#25602a"]
			for i in 500:
				_circle(img, _rng.randf() * 128, _rng.randf() * 128, _rng.randf_range(2, 5), Color.html(cols[i % 4]))
			return _tex(img)
		"blob":
			var img := Image.create(64, 64, false, Image.FORMAT_RGBA8)
			for y in 64:
				for x in 64:
					var d := Vector2(x - 32, y - 32).length() / 31.0
					var a := 0.0
					if d < 0.06:
						a = 0.55
					elif d < 0.6:
						a = lerpf(0.55, 0.25, (d - 0.06) / 0.54)
					elif d < 1.0:
						a = lerpf(0.25, 0.0, (d - 0.6) / 0.4)
					img.set_pixel(x, y, Color(0, 0, 0, a))
			return _tex(img)
		"glow":
			var img := Image.create(64, 64, false, Image.FORMAT_RGBA8)
			for y in 64:
				for x in 64:
					var d := Vector2(x - 31.5, y - 31.5).length() / 32.0
					var a := 1.0 if d < 0.0 else (lerpf(1.0, 0.6, d / 0.25) if d < 0.25 else lerpf(0.6, 0.0, (d - 0.25) / 0.75))
					img.set_pixel(x, y, Color(1, 1, 1, clampf(a, 0, 1)))
			return _tex(img)
		"pillar":
			var img := Image.create(16, 128, false, Image.FORMAT_RGBA8)
			for y in 128:
				var a := 0.9 * (y / 127.0)
				for x in 16:
					img.set_pixel(x, y, Color(1, 1, 1, a))
			return _tex(img)
		"sheet":
			var img := Image.create(64, 64, false, Image.FORMAT_RGBA8)
			img.fill(Color(0, 0, 0, 0))
			for y in range(0, 64, 8):
				_rect(img, 0, y, 64, 4, Color(1, 0.157, 0.235, 0.15 if y % 16 else 0.45))
			return _tex(img)
		"stripe":
			var img := Image.create(64, 64, false, Image.FORMAT_RGBA8)
			for i in 4:
				_rect(img, i * 16, 0, 16, 64, Color.html("#ffffff" if i % 2 else "#ff4f8b"))
			return _tex(img)
		"swirl", "swirl2", "swirl3", "swirl4", "swirl5", "swirl6":
			var img := Image.create(128, 128, false, Image.FORMAT_RGBA8)
			img.fill(Color(0, 0, 0, 0))
			var cols: Array = {"swirl": ["#c79bff", "#ff9fe8"], "swirl2": ["#ff3d00", "#ffd23f"], "swirl3": ["#29d9ff", "#3df2b0"], "swirl4": ["#9fe8ff", "#ff9de2"], "swirl5": ["#ff3df2", "#3df2ff"], "swirl6": ["#9fe8ff", "#ffffff"]}[name]
			for i in 7:
				var c := Color.html(cols[i % 2]); c.a = 0.75
				var a := 0.0
				while a < 9.0:
					var r := a * 6.5
					_rect(img, 64 + cos(a + i) * r - 3, 64 + sin(a + i) * r - 3, 6, 6, c)
					a += 0.05
			return _tex(img)
		"lava":
			var img := Image.create(256, 256, false, Image.FORMAT_RGBA8)
			for y in 256:
				for x in 256:
					var t := (x + y) / 512.0
					var c := Color.html("#ff3d00").lerp(Color.html("#ffb000"), 1.0 - absf(t * 2.0 - 1.0))
					img.set_pixel(x, y, c)
			for i in 40:
				_circle(img, _rng.randf() * 256, _rng.randf() * 256, _rng.randf_range(6, 20), Color(0.24, 0.04, 0, _rng.randf_range(0.3, 0.7)))
			return _tex(img)
		"rock":
			var img := _img(256, 256, "#231a1e")
			_speckle(img, 3500, ["#2e2228", "#1a1316", "#3a2a30", "#140e10"], 1, 3)
			for i in 9:
				var x := _rng.randf() * 256; var y := _rng.randf() * 256
				for k in 6:
					var nx := x + _rng.randf_range(-30, 30); var ny := y + _rng.randf_range(-30, 30)
					_line(img, x, y, nx, ny, Color.html("#ff5a1f"), 2)
					x = nx; y = ny
			return _tex(img)
		"rockGlow":
			var img := _img(256, 256, "#000000")
			for i in 9:
				var x := _rng.randf() * 256; var y := _rng.randf() * 256
				for k in 6:
					var nx := x + _rng.randf_range(-30, 30); var ny := y + _rng.randf_range(-30, 30)
					_line(img, x, y, nx, ny, Color.html("#ff6a1f"), 3)
					x = nx; y = ny
			return _tex(img)
		"obsidian":
			var img := _img(256, 256, "#16121c")
			var cols := ["#221c2c", "#1c1724", "#2a2236"]
			for y in 8:
				for x in 8:
					_rect(img, x * 32 + 2, y * 32 + 2, 28, 28, Color.html(cols[(x + y * 2) % 3]))
			for i in 9:
				_blend_rect(img, i * 32, 0, 2, 256, Color(1, 0.35, 0.12, 0.5))
			return _tex(img)
		"planet":
			var img := Image.create(256, 128, false, Image.FORMAT_RGBA8)
			for y in 128:
				var c := Color.from_hsv(fmod((280 + sin(y * 0.15) * 25) / 360.0, 1.0), 0.6, (30 + sin(y * 0.4) * 10) / 100.0 + 0.2)
				_rect(img, 0, y, 256, 1, c)
			return _tex(img)
		"earth":
			var img := _img(256, 128, "#1f5fbf")
			for i in 26:
				_circle(img, _rng.randf() * 256, _rng.randf() * 128, _rng.randf_range(6, 20), Color.html("#3fae5f"))
			for i in 30:
				_blend_rect(img, _rng.randf() * 256, _rng.randf() * 128, _rng.randf_range(10, 40), _rng.randf_range(2, 6), Color(1, 1, 1, 0.55))
			return _tex(img)
		"aurora":
			var img := Image.create(256, 64, false, Image.FORMAT_RGBA8)
			for y in 64:
				var t := y / 63.0
				var c: Color
				if t < 0.5:
					c = Color(0.24, 1, 0.63, t * 2 * 0.9)
				else:
					c = Color(0.24, 1, 0.63, 0.9).lerp(Color(0.47, 0.31, 1, 0), (t - 0.5) * 2)
				_rect(img, 0, y, 256, 1, c)
			return _tex(img)
		"ice":
			var img := _img(256, 256, "#f2f8ff")
			for i in 900:
				_blend_rect(img, _rng.randf() * 256, _rng.randf() * 256, 2 + _rng.randf() * 6, 2 + _rng.randf() * 6, Color((170 + _rng.randf() * 60) / 255.0, (200 + _rng.randf() * 40) / 255.0, 1, _rng.randf() * 0.18))
			return _tex(img)
		"icePlaza":
			var img := Image.create(256, 256, false, Image.FORMAT_RGBA8)
			for y in 256:
				for x in 256:
					img.set_pixel(x, y, Color.html("#cfeeff").lerp(Color.html("#a8dcff"), (x + y) / 512.0))
			for i in 14:
				var x := _rng.randf() * 256; var y := _rng.randf() * 256
				for k in 4:
					var nx := x + (_rng.randf() - 0.5) * 70; var ny := y + (_rng.randf() - 0.5) * 70
					_line(img, x, y, nx, ny, Color(1, 1, 1, 0.75), 1.5)
					x = nx; y = ny
			for i in 40:
				_blend_rect(img, _rng.randf() * 256, _rng.randf() * 256, 3, 1, Color(1, 1, 1, 0.35))
			return _tex(img)
		"moon":
			var img := _img(256, 256, "#8a8c96")
			for i in 1600:
				var v := (110 + _rng.randf() * 60) / 255.0
				_blend_rect(img, _rng.randf() * 256, _rng.randf() * 256, 2, 2, Color(v, v, v + 0.04, 0.5))
			for i in 9:
				var x := _rng.randf() * 256; var y := _rng.randf() * 256; var r := 6 + _rng.randf() * 18
				_circle(img, x, y, r, Color(0.16, 0.16, 0.2, 0.45))
				_circle(img, x, y, r - 3, Color(0.24, 0.24, 0.27, 0.35))
			return _tex(img)
		"moonPlaza":
			var img := _img(256, 256, "#14102a")
			var pink := Color.html("#ff3df2"); var cyan := Color.html("#3df2ff")
			_rect(img, 2, 2, 252, 3, pink); _rect(img, 2, 251, 252, 3, pink); _rect(img, 2, 2, 3, 252, pink); _rect(img, 251, 2, 3, 252, pink)
			_rect(img, 127, 0, 2, 256, cyan); _rect(img, 0, 127, 256, 2, cyan)
			return _tex(img)
	push_error("unknown texture " + name)
	return _tex(_img(4, 4, "#ff00ff"))

## apartment facade with lit windows
static func windows(base: String, lit: float) -> ImageTexture:
	var key := "win" + base + str(lit)
	if _cache.has(key):
		return _cache[key]
	_rng.seed = hash(key)
	var img := _img(128, 256, base)
	for y in 6:
		for x in 3:
			var gx := 12 + x * 40; var gy := 16 + y * 40
			_blend_rect(img, gx - 2, gy - 2, 30, 30, Color(0, 0, 0, 0.25))
			var c2 := Color.html("#ffe9a8") if _rng.randf() < lit else Color.html("#6aa4d8")
			for yy in 26:
				for xx in 26:
					img.set_pixel(gx + xx, gy + yy, Color.html("#bfe6ff").lerp(c2, (xx + yy) / 52.0))
			_blend_rect(img, gx + 12, gy, 2, 26, Color(1, 1, 1, 0.5)); _blend_rect(img, gx, gy + 12, 26, 2, Color(1, 1, 1, 0.5))
	var t := _tex(img)
	_cache[key] = t
	return t
