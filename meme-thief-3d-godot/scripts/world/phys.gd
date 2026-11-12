## Collision world (autoload "Phys"): axis-aligned boxes + vertical cylinders in a spatial hash, like the original.
extends Node

const STEP_UP := 0.52
const GRAVITY := -30.0
const CS := 8.0

class Col:
	var kind := 0 # 0 box, 1 circle
	var minX := 0.0; var minY := 0.0; var minZ := 0.0; var maxX := 0.0; var maxY := 0.0; var maxZ := 0.0
	var x := 0.0; var z := 0.0; var r := 0.0
	var cam := true
	var tag := ""
	var stamp := 0

class Body:
	var pos: Vector3
	var vel := Vector3.ZERO
	var prev: Vector3
	var r := 0.42
	var h := 1.75
	var grounded := false
	var groundTag := ""
	var ownerId := -1
	var landed := 0.0
	var airTime := 0.0
	var agent = null
	var hitWall := 0.0
	func _init(x: float, y: float, z: float, r_: float = 0.42, h_: float = 1.75) -> void:
		pos = Vector3(x, y, z); prev = pos; r = r_; h = h_

var boxes: Array[Col] = []
var circles: Array[Col] = []
var cells: Dictionary = {}
var stamp := 1
var constraints: Array[Callable] = []
var _q: Array = []

# world bounds per world index
const WORLD1 := {"minX": -160.0, "maxX": 160.0, "minZ": -92.0, "maxZ": 92.0}
const X2 := 1000.0
const X3 := 3000.0
const X4 := 5000.0
const X5 := 7000.0
const WORLD2 := {"minX": X2 - 125, "maxX": X2 + 125, "minZ": -70.0, "maxZ": 70.0}
const WORLD3 := {"minX": X3 - 108, "maxX": X3 + 108, "minZ": -72.0, "maxZ": 72.0}
const WORLD4 := {"minX": X4 - 112, "maxX": X4 + 112, "minZ": -66.0, "maxZ": 66.0}
const WORLD5 := {"minX": X5 - 112, "maxX": X5 + 112, "minZ": -66.0, "maxZ": 66.0}
const WORLD_BOUNDS := [null, WORLD1, WORLD2, WORLD3, WORLD4, WORLD5]

static func world_of(x: float) -> int:
	return 1 if x < 500 else (2 if x < 2000 else (3 if x < 4000 else (4 if x < 6000 else 5)))
static func in_w2(x: float) -> bool: return x > 500 and x < 2000
static func in_w3(x: float) -> bool: return x >= 2000 and x < 4000
static func in_w4(x: float) -> bool: return x >= 4000 and x < 6000
static func in_w5(x: float) -> bool: return x >= 6000
static func bounds_of(x: float) -> Dictionary:
	return WORLD_BOUNDS[world_of(x)]

func reset() -> void:
	boxes.clear(); circles.clear(); cells.clear(); constraints.clear()

static func cell_key(ix: int, iz: int) -> int:
	return ix * 100000 + iz

func _insert(c: Col, minX: float, minZ: float, maxX: float, maxZ: float) -> void:
	for ix in range(int(floorf(minX / CS)), int(floorf(maxX / CS)) + 1):
		for iz in range(int(floorf(minZ / CS)), int(floorf(maxZ / CS)) + 1):
			var k := cell_key(ix, iz)
			if not cells.has(k):
				cells[k] = []
			cells[k].append(c)

func add_box(minX: float, minY: float, minZ: float, maxX: float, maxY: float, maxZ: float, o: Dictionary = {}) -> Col:
	var b := Col.new()
	b.kind = 0
	b.minX = minf(minX, maxX); b.maxX = maxf(minX, maxX); b.minZ = minf(minZ, maxZ); b.maxZ = maxf(minZ, maxZ); b.minY = minY; b.maxY = maxY
	b.cam = o.get("cam", true); b.tag = o.get("tag", "")
	boxes.append(b)
	_insert(b, b.minX, b.minZ, b.maxX, b.maxZ)
	return b

func add_box_c(cx: float, cy: float, cz: float, sx: float, sy: float, sz: float, o: Dictionary = {}) -> Col:
	return add_box(cx - sx / 2, cy - sy / 2, cz - sz / 2, cx + sx / 2, cy + sy / 2, cz + sz / 2, o)

func add_circle(x: float, z: float, r: float, minY: float, maxY: float, o: Dictionary = {}) -> Col:
	var c := Col.new()
	c.kind = 1; c.x = x; c.z = z; c.r = r; c.minY = minY; c.maxY = maxY
	c.cam = o.get("cam", false); c.tag = o.get("tag", "")
	circles.append(c)
	_insert(c, x - r, z - r, x + r, z + r)
	return c

func query(x: float, z: float, r: float) -> Array:
	_q = []
	stamp += 1
	for ix in range(int(floorf((x - r) / CS)), int(floorf((x + r) / CS)) + 1):
		for iz in range(int(floorf((z - r) / CS)), int(floorf((z + r) / CS)) + 1):
			var l = cells.get(cell_key(ix, iz))
			if l == null:
				continue
			for c in l:
				if c.stamp != stamp:
					c.stamp = stamp
					_q.append(c)
	return _q

## returns [y, tag]
func floor_at(x: float, z: float, r: float, feetY: float) -> Array:
	var best := -1000.0 if in_w3(x) else 0.0
	var tag := ""
	for c: Col in query(x, z, r + 0.1):
		if c.maxY > feetY + STEP_UP or c.maxY <= best:
			continue
		if c.kind == 0:
			var cx := clampf(x, c.minX, c.maxX); var cz := clampf(z, c.minZ, c.maxZ)
			if (x - cx) * (x - cx) + (z - cz) * (z - cz) > r * r:
				continue
		elif (x - c.x) * (x - c.x) + (z - c.z) * (z - c.z) > (c.r + r) * (c.r + r):
			continue
		best = c.maxY; tag = c.tag
	return [best, tag]

func collide_body(b: Body) -> void:
	var cols := query(b.pos.x, b.pos.z, b.r + 0.6)
	var r := b.r
	for c: Col in cols:
		var p := b.pos
		if p.y + b.h <= c.minY or p.y >= c.maxY - 1e-4:
			continue
		if c.maxY <= p.y + STEP_UP and c.minY <= p.y + 0.05:
			continue
		var nx := 0.0; var nz := 0.0; var pen := 0.0
		if c.kind == 0:
			var cx := clampf(p.x, c.minX, c.maxX); var cz := clampf(p.z, c.minZ, c.maxZ)
			var dx := p.x - cx; var dz := p.z - cz; var d2 := dx * dx + dz * dz
			if d2 >= r * r:
				continue
			if c.minY > p.y + b.h * 0.55 and b.vel.y > 0:
				b.pos.y = c.minY - b.h; b.vel.y = 0
				continue
			if d2 > 1e-10:
				var d := sqrt(d2); nx = dx / d; nz = dz / d; pen = r - d
			else:
				var l := p.x - c.minX; var rr := c.maxX - p.x; var bk := p.z - c.minZ; var fr := c.maxZ - p.z
				var m := minf(minf(l, rr), minf(bk, fr))
				if m == l: nx = -1; nz = 0; pen = l + r
				elif m == rr: nx = 1; nz = 0; pen = rr + r
				elif m == bk: nx = 0; nz = -1; pen = bk + r
				else: nx = 0; nz = 1; pen = fr + r
		else:
			var dx := p.x - c.x; var dz := p.z - c.z; var d2 := dx * dx + dz * dz; var R := c.r + r
			if d2 >= R * R:
				continue
			var d := sqrt(d2)
			if d < 1e-4:
				d = 1e-4
			nx = dx / d; nz = dz / d; pen = R - d
		b.pos.x += nx * pen; b.pos.z += nz * pen
		var vn := b.vel.x * nx + b.vel.z * nz
		if vn < 0:
			b.vel.x -= nx * vn; b.vel.z -= nz * vn
		b.hitWall = 0.2
	for fn in constraints:
		fn.call(b)
	var WB := bounds_of(b.pos.x)
	b.pos.x = clampf(b.pos.x, WB.minX + 1, WB.maxX - 1)
	b.pos.z = clampf(b.pos.z, WB.minZ + 1, WB.maxZ - 1)

func step_body(b: Body, dt: float) -> void:
	var was := b.grounded
	b.prev = b.pos
	var gmul := 0.6 if in_w2(b.pos.x) else (0.42 if in_w5(b.pos.x) else 1.0)
	b.vel.y = maxf(-45.0, b.vel.y + GRAVITY * gmul * dt)
	var dx := b.vel.x * dt; var dy := b.vel.y * dt; var dz := b.vel.z * dt
	var n := maxi(1, int(ceilf(maxf(Vector2(dx, dz).length(), absf(dy)) / 0.18)))
	for i in n:
		b.pos.x += dx / n; b.pos.z += dz / n; b.pos.y += dy / n
		collide_body(b)
	b.hitWall = maxf(0.0, b.hitWall - dt)
	var f := floor_at(b.pos.x, b.pos.z, b.r * 0.7, b.pos.y)
	var fy: float = f[0]
	if b.pos.y <= fy + 1e-3:
		if not was and b.airTime > 0.25:
			b.landed = minf(1.0, b.airTime)
		b.pos.y = fy
		if b.vel.y < 0:
			b.vel.y = 0
		b.grounded = true; b.groundTag = f[1]
	elif was and b.vel.y <= 0 and b.pos.y - fy < STEP_UP * 0.95:
		b.pos.y = fy; b.vel.y = 0; b.grounded = true; b.groundTag = f[1]
	else:
		b.grounded = false; b.groundTag = ""
	b.airTime = 0.0 if b.grounded else b.airTime + dt
	if b.pos.y < -20 or not (is_finite(b.pos.x) and is_finite(b.pos.y) and is_finite(b.pos.z)):
		if b.agent != null:
			b.agent.on_fall()
		elif not (is_finite(b.pos.x) and is_finite(b.pos.y) and is_finite(b.pos.z)):
			b.pos = Vector3(0, 3, 0); b.vel = Vector3.ZERO

## ray vs camera-blocking boxes; returns hit distance or maxT
func ray_cast(o: Vector3, d: Vector3, maxT: float) -> float:
	var best := maxT
	for b in boxes:
		if not b.cam:
			continue
		if absf(b.minX - o.x) > best + (b.maxX - b.minX) and absf(b.maxX - o.x) > best + (b.maxX - b.minX):
			continue
		var t0 := 0.0; var t1 := best
		var miss := false
		for a in 3:
			var oa := o[a]; var da := d[a]
			var mn: float = [b.minX, b.minY, b.minZ][a]; var mx: float = [b.maxX, b.maxY, b.maxZ][a]
			if absf(da) < 1e-8:
				if oa < mn or oa > mx:
					miss = true
					break
				continue
			var ta := (mn - oa) / da; var tb := (mx - oa) / da
			if ta > tb:
				var tmp := ta; ta = tb; tb = tmp
			if ta > t0: t0 = ta
			if tb < t1: t1 = tb
			if t0 > t1:
				miss = true
				break
		if not miss and t0 <= t1 and t0 > 0 and t0 < best:
			best = t0
	return best
