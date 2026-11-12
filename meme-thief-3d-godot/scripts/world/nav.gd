## Navigation grids (one per world) with A* via AStarGrid2D, plus line-of-walk tests and string pulling.
extends Node

class Grid:
	var minX := 0.0; var minZ := 0.0; var cs := 1.0; var w := 0; var h := 0
	var blocked: PackedByteArray = PackedByteArray()
	var B: Dictionary
	var astar: AStarGrid2D = null
	var built := false

var grids: Array = [null]
var NV: Grid = null

func _ready() -> void:
	for i in range(1, 6):
		var g := Grid.new()
		g.B = Phys.WORLD_BOUNDS[i]
		g.minX = g.B.minX; g.minZ = g.B.minZ
		grids.append(g)
	NV = grids[1]

func pick(x: float) -> Grid:
	var N: Grid = grids[Phys.world_of(x)]
	NV = N if N.built else grids[1]
	return NV

## rebuild a world's grid from the physics colliders (and an optional extra blocker)
func build(world: int = 1, extra: Callable = Callable()) -> void:
	var N: Grid = grids[world]
	var B := N.B
	N.w = int(ceilf((B.maxX - B.minX) / N.cs)); N.h = int(ceilf((B.maxZ - B.minZ) / N.cs))
	var C := N.w * N.h
	N.blocked = PackedByteArray()
	N.blocked.resize(C)
	N.astar = AStarGrid2D.new()
	N.astar.region = Rect2i(0, 0, N.w, N.h)
	N.astar.cell_size = Vector2(1, 1)
	N.astar.diagonal_mode = AStarGrid2D.DIAGONAL_MODE_ONLY_IF_NO_OBSTACLES
	N.astar.default_compute_heuristic = AStarGrid2D.HEURISTIC_OCTILE
	N.astar.default_estimate_heuristic = AStarGrid2D.HEURISTIC_OCTILE
	N.astar.update()
	var inf := 0.62
	for iz in N.h:
		for ix in N.w:
			var x := N.minX + (ix + 0.5) * N.cs; var z := N.minZ + (iz + 0.5) * N.cs
			var bl := 0
			if x < B.minX + 2 or x > B.maxX - 2 or z < B.minZ + 2 or z > B.maxZ - 2 or (extra.is_valid() and extra.call(x, z)):
				bl = 1
			else:
				for c: Phys.Col in Phys.query(x, z, inf + 0.5):
					if c.maxY <= 0.62 or c.minY > 1.7:
						continue
					if c.kind == 0:
						var cx := clampf(x, c.minX, c.maxX); var cz := clampf(z, c.minZ, c.maxZ)
						if (x - cx) * (x - cx) + (z - cz) * (z - cz) < inf * inf:
							bl = 1
							break
					elif (x - c.x) * (x - c.x) + (z - c.z) * (z - c.z) < (c.r + inf) * (c.r + inf):
						bl = 1
						break
			N.blocked[iz * N.w + ix] = bl
			if bl:
				N.astar.set_point_solid(Vector2i(ix, iz), true)
	N.built = true
	NV = N

func idx(x: float, z: float) -> int:
	var ix := int(floorf((x - NV.minX) / NV.cs)); var iz := int(floorf((z - NV.minZ) / NV.cs))
	if ix < 0 or iz < 0 or ix >= NV.w or iz >= NV.h:
		return -1
	return iz * NV.w + ix

func open(x: float, z: float) -> bool:
	var i := idx(x, z)
	return i >= 0 and NV.blocked[i] == 0

func nearest_open(i: int) -> int:
	if i >= 0 and NV.blocked[i] == 0:
		return i
	var ix0 := i % NV.w if i >= 0 else 0
	var iz0 := i / NV.w if i >= 0 else 0
	for rad in range(1, 8):
		for dz in range(-rad, rad + 1):
			for dx in range(-rad, rad + 1):
				if absi(dx) != rad and absi(dz) != rad:
					continue
				var ix := ix0 + dx; var iz := iz0 + dz
				if ix < 0 or iz < 0 or ix >= NV.w or iz >= NV.h:
					continue
				var j := iz * NV.w + ix
				if NV.blocked[j] == 0:
					return j
	return -1

func line_open(x0: float, z0: float, x1: float, z1: float) -> bool:
	pick(x0)
	if Phys.world_of(x0) != Phys.world_of(x1):
		return false
	var d := Vector2(x1 - x0, z1 - z0).length()
	var n := int(ceilf(d / 0.35))
	for i in range(1, n + 1):
		var t := float(i) / n
		if not open(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t):
			return false
	return true

## returns Array of Vector2(x, z) waypoints, or [] when unreachable
var pf_calls := 0
var pf_time := 0
func find_path(sx: float, sz: float, tx: float, tz: float) -> Array:
	pf_calls += 1
	var t0 := Time.get_ticks_usec()
	var r := _find_path(sx, sz, tx, tz)
	pf_time += Time.get_ticks_usec() - t0
	return r

func _find_path(sx: float, sz: float, tx: float, tz: float) -> Array:
	if Phys.world_of(sx) != Phys.world_of(tx):
		return []
	pick(sx)
	var s := nearest_open(idx(sx, sz)); var t := nearest_open(idx(tx, tz))
	if s < 0 or t < 0:
		return []
	if line_open(sx, sz, tx, tz):
		return [Vector2(tx, tz)]
	pick(sx)
	var N := NV
	var ids := N.astar.get_id_path(Vector2i(s % N.w, s / N.w), Vector2i(t % N.w, t / N.w))
	if ids.is_empty():
		return []
	var pts := []
	for id in ids:
		pts.append(Vector2(N.minX + (id.x + 0.5) * N.cs, N.minZ + (id.y + 0.5) * N.cs))
	if open(tx, tz):
		pts[pts.size() - 1] = Vector2(tx, tz)
	# string pulling
	var out := []
	var cx := sx; var cz := sz; var i := 0
	while i < pts.size():
		var j := pts.size() - 1
		while j > i and not line_open(cx, cz, pts[j].x, pts[j].y):
			j -= 1
		out.append(pts[j]); cx = pts[j].x; cz = pts[j].y; i = j + 1
	return out
