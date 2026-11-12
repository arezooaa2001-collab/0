## Procedural geometry in the same local orientation as the original three.js builders
## (Y up, torus/ring/plane facing +Z), plus a material cache and mesh mergers.
class_name Geo

static var _arrays: Dictionary = {}
static var _meshes: Dictionary = {}
static var _mats: Dictionary = {}
static var _wind_checked := false
static var _ccw_front := false

# ---------------------------------------------------------------- winding
static func _check_winding() -> void:
	if _wind_checked:
		return
	_wind_checked = true
	var bm := BoxMesh.new()
	var arr := bm.get_mesh_arrays()
	var v: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
	var n: PackedVector3Array = arr[Mesh.ARRAY_NORMAL]
	var idx: PackedInt32Array = arr[Mesh.ARRAY_INDEX]
	var a := v[idx[0]]; var b := v[idx[1]]; var c := v[idx[2]]
	var cr := (b - a).cross(c - a)
	_ccw_front = cr.dot(n[idx[0]]) > 0.0

## append a triangle given in counter-clockwise (outside) order
static func _t(ind: PackedInt32Array, a: int, b: int, c: int) -> void:
	if _ccw_front:
		ind.append(a); ind.append(b); ind.append(c)
	else:
		ind.append(a); ind.append(c); ind.append(b)

static func _pack(v: PackedVector3Array, n: PackedVector3Array, uv: PackedVector2Array, ind: PackedInt32Array) -> Array:
	var arr := []
	arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = v
	arr[Mesh.ARRAY_NORMAL] = n
	arr[Mesh.ARRAY_TEX_UV] = uv
	arr[Mesh.ARRAY_INDEX] = ind
	return arr

static func mesh_from(arrays: Array) -> ArrayMesh:
	var m := ArrayMesh.new()
	m.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	return m

## cached ArrayMesh for a cached arrays object
static func mesh_of(arrays: Array) -> ArrayMesh:
	var k: String = str(arrays[Mesh.ARRAY_VERTEX].size()) + "_" + str(arrays[Mesh.ARRAY_INDEX].size()) + "_" + str(arrays[Mesh.ARRAY_VERTEX][0]) + str(arrays[Mesh.ARRAY_VERTEX][-1])
	if _meshes.has(k):
		return _meshes[k]
	var m := mesh_from(arrays)
	_meshes[k] = m
	return m

# ---------------------------------------------------------------- generators (return arrays)
static func sphere_g(radius: float, ws: int, hs: int, phi0: float = 0.0, phiLen: float = TAU, th0: float = 0.0, thLen: float = PI) -> Array:
	_check_winding()
	var v := PackedVector3Array(); var n := PackedVector3Array(); var uv := PackedVector2Array(); var ind := PackedInt32Array()
	var thEnd := minf(th0 + thLen, PI)
	var grid := []
	for iy in range(hs + 1):
		var row := PackedInt32Array()
		var vy := float(iy) / hs
		for ix in range(ws + 1):
			var u := float(ix) / ws
			var p := Vector3(-radius * cos(phi0 + u * phiLen) * sin(th0 + vy * thLen), radius * cos(th0 + vy * thLen), radius * sin(phi0 + u * phiLen) * sin(th0 + vy * thLen))
			row.append(v.size())
			v.append(p); n.append(p.normalized()); uv.append(Vector2(u, 1.0 - vy))
		grid.append(row)
	for iy in range(hs):
		for ix in range(ws):
			var a: int = grid[iy][ix + 1]; var b: int = grid[iy][ix]; var c: int = grid[iy + 1][ix]; var d: int = grid[iy + 1][ix + 1]
			if iy != 0 or th0 > 0.0:
				_t(ind, a, b, d)
			if iy != hs - 1 or thEnd < PI:
				_t(ind, b, c, d)
	return _pack(v, n, uv, ind)

static func cylinder_g(rt: float, rb: float, h: float, rs: int, open: bool = false, th0: float = 0.0, thLen: float = TAU, hsegs: int = 1) -> Array:
	_check_winding()
	var v := PackedVector3Array(); var n := PackedVector3Array(); var uv := PackedVector2Array(); var ind := PackedInt32Array()
	var hh := h / 2.0
	var slope := (rb - rt) / h
	var grid := []
	for y in range(hsegs + 1):
		var row := PackedInt32Array()
		var vy := float(y) / hsegs
		var radius := vy * (rb - rt) + rt
		for x in range(rs + 1):
			var u := float(x) / rs
			var theta := u * thLen + th0
			var st := sin(theta); var ct := cos(theta)
			row.append(v.size())
			v.append(Vector3(radius * st, -vy * h + hh, radius * ct))
			n.append(Vector3(st, slope, ct).normalized())
			uv.append(Vector2(u, 1.0 - vy))
		grid.append(row)
	for x in range(rs):
		for y in range(hsegs):
			var a: int = grid[y][x]; var b: int = grid[y + 1][x]; var c: int = grid[y + 1][x + 1]; var d: int = grid[y][x + 1]
			if rt > 0.0 or y != 0:
				_t(ind, a, b, d)
			if rb > 0.0 or y != hsegs - 1:
				_t(ind, b, c, d)
	if not open:
		for top in [true, false]:
			var radius := rt if top else rb
			var sign := 1.0 if top else -1.0
			if radius <= 0.0:
				continue
			var center := v.size()
			v.append(Vector3(0, hh * sign, 0)); n.append(Vector3(0, sign, 0)); uv.append(Vector2(0.5, 0.5))
			var start := v.size()
			for x in range(rs + 1):
				var u := float(x) / rs
				var theta := u * thLen + th0
				v.append(Vector3(radius * sin(theta), hh * sign, radius * cos(theta))); n.append(Vector3(0, sign, 0)); uv.append(Vector2(cos(theta) * 0.5 + 0.5, sin(theta) * 0.5 * sign + 0.5))
			for x in range(rs):
				if top:
					_t(ind, start + x, start + x + 1, center)
				else:
					_t(ind, start + x + 1, start + x, center)
	return _pack(v, n, uv, ind)

## torus in the XY plane (axis along Z) like three.js
static func torus_g(R: float, r: float, rs: int, ts: int, arc: float = TAU) -> Array:
	_check_winding()
	var v := PackedVector3Array(); var n := PackedVector3Array(); var uv := PackedVector2Array(); var ind := PackedInt32Array()
	for j in range(rs + 1):
		for i in range(ts + 1):
			var u := float(i) / ts * arc
			var vv := float(j) / rs * TAU
			var p := Vector3((R + r * cos(vv)) * cos(u), (R + r * cos(vv)) * sin(u), r * sin(vv))
			var c := Vector3(R * cos(u), R * sin(u), 0)
			v.append(p); n.append((p - c).normalized()); uv.append(Vector2(float(i) / ts, float(j) / rs))
	for j in range(1, rs + 1):
		for i in range(1, ts + 1):
			var a := (ts + 1) * j + i - 1
			var b := (ts + 1) * (j - 1) + i - 1
			var c := (ts + 1) * (j - 1) + i
			var d := (ts + 1) * j + i
			_t(ind, a, b, d); _t(ind, b, c, d)
	return _pack(v, n, uv, ind)

static func box_g(w: float = 1.0, h: float = 1.0, d: float = 1.0) -> Array:
	_check_winding()
	var v := PackedVector3Array(); var n := PackedVector3Array(); var uv := PackedVector2Array(); var ind := PackedInt32Array()
	var faces := [
		[Vector3(1, 0, 0), Vector3(0, 0, -1), Vector3(0, 1, 0)], [Vector3(-1, 0, 0), Vector3(0, 0, 1), Vector3(0, 1, 0)],
		[Vector3(0, 1, 0), Vector3(1, 0, 0), Vector3(0, 0, -1)], [Vector3(0, -1, 0), Vector3(1, 0, 0), Vector3(0, 0, 1)],
		[Vector3(0, 0, 1), Vector3(1, 0, 0), Vector3(0, 1, 0)], [Vector3(0, 0, -1), Vector3(-1, 0, 0), Vector3(0, 1, 0)],
	]
	var half := Vector3(w, h, d) * 0.5
	for f in faces:
		var nn: Vector3 = f[0]; var ax: Vector3 = f[1]; var ay: Vector3 = f[2]
		var base := v.size()
		for iy in range(2):
			for ix in range(2):
				var p: Vector3 = (nn + ax * (ix * 2 - 1) + ay * (iy * 2 - 1)) * half
				v.append(p); n.append(nn); uv.append(Vector2(ix, 1 - iy))
		_t(ind, base, base + 2, base + 3); _t(ind, base, base + 3, base + 1)
	return _pack(v, n, uv, ind)

static func capsule_g(radius: float = 0.5, length: float = 1.0, segs: int = 14) -> Array:
	var cm := CapsuleMesh.new()
	cm.radius = radius; cm.height = length + radius * 2.0; cm.radial_segments = segs; cm.rings = 6
	return cm.get_mesh_arrays()

## flat-shaded polyhedron from (verts, faces) subdivided `detail` times and projected to a sphere
static func polyhedron_g(verts: Array, faces: Array, radius: float, detail: int) -> Array:
	_check_winding()
	var tris := []
	for f in faces:
		tris.append([verts[f[0]], verts[f[1]], verts[f[2]]])
	for _d in range(detail):
		var out := []
		for t in tris:
			var a: Vector3 = t[0]; var b: Vector3 = t[1]; var c: Vector3 = t[2]
			var ab := ((a + b) * 0.5).normalized(); var bc := ((b + c) * 0.5).normalized(); var ca := ((c + a) * 0.5).normalized()
			out.append([a, ab, ca]); out.append([ab, b, bc]); out.append([ca, bc, c]); out.append([ab, bc, ca])
		tris = out
	var v := PackedVector3Array(); var n := PackedVector3Array(); var uv := PackedVector2Array(); var ind := PackedInt32Array()
	for t in tris:
		var a: Vector3 = t[0].normalized() * radius; var b: Vector3 = t[1].normalized() * radius; var c: Vector3 = t[2].normalized() * radius
		var nn := (b - a).cross(c - a).normalized()
		var base := v.size()
		v.append(a); v.append(b); v.append(c)
		for _k in range(3):
			n.append(nn); uv.append(Vector2.ZERO)
		_t(ind, base, base + 1, base + 2)
	return _pack(v, n, uv, ind)

static func icosahedron_g(radius: float, detail: int) -> Array:
	var t := (1.0 + sqrt(5.0)) / 2.0
	var verts := [Vector3(-1, t, 0), Vector3(1, t, 0), Vector3(-1, -t, 0), Vector3(1, -t, 0), Vector3(0, -1, t), Vector3(0, 1, t), Vector3(0, -1, -t), Vector3(0, 1, -t), Vector3(t, 0, -1), Vector3(t, 0, 1), Vector3(-t, 0, -1), Vector3(-t, 0, 1)]
	var faces := [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]]
	return polyhedron_g(verts, faces, radius, detail)

static func octahedron_g(radius: float) -> Array:
	var verts := [Vector3(1, 0, 0), Vector3(-1, 0, 0), Vector3(0, 1, 0), Vector3(0, -1, 0), Vector3(0, 0, 1), Vector3(0, 0, -1)]
	var faces := [[0, 2, 4], [0, 4, 3], [0, 3, 5], [0, 5, 2], [1, 2, 5], [1, 5, 3], [1, 3, 4], [1, 4, 2]]
	return polyhedron_g(verts, faces, radius, 0)

static func dodecahedron_g(radius: float) -> Array:
	var t := (1.0 + sqrt(5.0)) / 2.0
	var r := 1.0 / t
	var verts := [Vector3(-1, -1, -1), Vector3(-1, -1, 1), Vector3(-1, 1, -1), Vector3(-1, 1, 1), Vector3(1, -1, -1), Vector3(1, -1, 1), Vector3(1, 1, -1), Vector3(1, 1, 1),
		Vector3(0, -r, -t), Vector3(0, -r, t), Vector3(0, r, -t), Vector3(0, r, t), Vector3(-r, -t, 0), Vector3(-r, t, 0), Vector3(r, -t, 0), Vector3(r, t, 0), Vector3(-t, 0, -r), Vector3(t, 0, -r), Vector3(-t, 0, r), Vector3(t, 0, r)]
	var faces := [[3, 11, 7], [3, 7, 15], [3, 15, 13], [7, 19, 17], [7, 17, 6], [7, 6, 15], [17, 4, 8], [17, 8, 10], [17, 10, 6], [8, 0, 16], [8, 16, 2], [8, 2, 10], [0, 12, 1], [0, 1, 18], [0, 18, 16], [6, 10, 2], [6, 2, 13], [6, 13, 15], [2, 16, 18], [2, 18, 3], [2, 3, 13], [18, 1, 9], [18, 9, 11], [18, 11, 3], [4, 14, 12], [4, 12, 0], [4, 0, 8], [11, 9, 5], [11, 5, 19], [11, 19, 7], [19, 5, 14], [19, 14, 4], [19, 4, 17], [1, 12, 14], [1, 14, 5], [1, 5, 9]]
	return polyhedron_g(verts, faces, radius, 0)

## quad in XY facing +Z (three.js PlaneGeometry)
static func plane_g(w: float = 1.0, h: float = 1.0) -> Array:
	_check_winding()
	var v := PackedVector3Array([Vector3(-w / 2, h / 2, 0), Vector3(w / 2, h / 2, 0), Vector3(-w / 2, -h / 2, 0), Vector3(w / 2, -h / 2, 0)])
	var n := PackedVector3Array([Vector3(0, 0, 1), Vector3(0, 0, 1), Vector3(0, 0, 1), Vector3(0, 0, 1)])
	var uv := PackedVector2Array([Vector2(0, 0), Vector2(1, 0), Vector2(0, 1), Vector2(1, 1)])
	var ind := PackedInt32Array()
	_t(ind, 0, 2, 1); _t(ind, 2, 3, 1)
	return _pack(v, n, uv, ind)

static func ring_g(ri: float, ro: float, segs: int) -> Array:
	_check_winding()
	var v := PackedVector3Array(); var n := PackedVector3Array(); var uv := PackedVector2Array(); var ind := PackedInt32Array()
	for i in range(segs + 1):
		var a := float(i) / segs * TAU
		for rr in [ri, ro]:
			v.append(Vector3(cos(a) * rr, sin(a) * rr, 0)); n.append(Vector3(0, 0, 1)); uv.append(Vector2(cos(a) * 0.5 + 0.5, sin(a) * 0.5 + 0.5))
	for i in range(segs):
		var a := i * 2; var b := i * 2 + 1; var c := i * 2 + 2; var d := i * 2 + 3
		_t(ind, a, c, b); _t(ind, b, c, d)
	return _pack(v, n, uv, ind)

static func circle_g(r: float, segs: int) -> Array:
	_check_winding()
	var v := PackedVector3Array(); var n := PackedVector3Array(); var uv := PackedVector2Array(); var ind := PackedInt32Array()
	v.append(Vector3.ZERO); n.append(Vector3(0, 0, 1)); uv.append(Vector2(0.5, 0.5))
	for i in range(segs + 1):
		var a := float(i) / segs * TAU
		v.append(Vector3(cos(a) * r, sin(a) * r, 0)); n.append(Vector3(0, 0, 1)); uv.append(Vector2(cos(a) * 0.5 + 0.5, sin(a) * 0.5 + 0.5))
	for i in range(1, segs + 1):
		_t(ind, i, i + 1, 0)
	return _pack(v, n, uv, ind)

## rounded box: a sphere pushed out to the box corners (odd segment counts keep every vertex in one octant)
static func rbox_g(w: float, h: float, d: float, r: float = 0.08) -> Array:
	_check_winding()
	var ws := 13; var hs := 9
	var sp := sphere_g(1.0, ws, hs)
	var v: PackedVector3Array = sp[Mesh.ARRAY_VERTEX]
	var n: PackedVector3Array = sp[Mesh.ARRAY_NORMAL]
	r = minf(r, minf(w, minf(h, d)) * 0.49)
	var inner := Vector3(w / 2 - r, h / 2 - r, d / 2 - r)
	var out := PackedVector3Array()
	for p in v:
		out.append(p * r + Vector3(signf(p.x) * inner.x, signf(p.y) * inner.y, signf(p.z) * inner.z))
	return _pack(out, n, sp[Mesh.ARRAY_TEX_UV], sp[Mesh.ARRAY_INDEX])

## triangular gable: triangle in the XY plane (base on y=0, apex at (0,hy)) extruded along X by `depth` (after three's rotateY)
static func gable_g(half_w: float, hy: float, depth: float) -> Array:
	_check_winding()
	var v := PackedVector3Array(); var n := PackedVector3Array(); var uv := PackedVector2Array(); var ind := PackedInt32Array()
	# three.js: shape in XY, extrude along Z, then rotateY(PI/2): x -> -z? (rotateY maps (x,y,z) -> (x cos + z sin, y, -x sin + z cos)); with PI/2: (z, y, -x)
	var tri := [Vector2(-half_w, 0), Vector2(half_w, 0), Vector2(0, hy)]
	var zs := [-depth / 2, depth / 2]
	# faces: two triangles (front/back) + 3 side quads, in pre-rotation coords then rotate
	var rot := func(p: Vector3) -> Vector3: return Vector3(p.z, p.y, -p.x)
	for side in range(2):
		var z: float = zs[side]
		var base := v.size()
		var nn := Vector3(0, 0, 1 if side == 1 else -1)
		for t in tri:
			v.append(rot.call(Vector3(t.x, t.y, z))); n.append(rot.call(nn)); uv.append(Vector2(t.x, t.y))
		if side == 1:
			_t(ind, base, base + 1, base + 2)
		else:
			_t(ind, base, base + 2, base + 1)
	for i in range(3):
		var a: Vector2 = tri[i]; var b: Vector2 = tri[(i + 1) % 3]
		var e := b - a
		var nn := Vector3(e.y, -e.x, 0).normalized()
		var base := v.size()
		v.append(rot.call(Vector3(a.x, a.y, zs[0]))); v.append(rot.call(Vector3(b.x, b.y, zs[0]))); v.append(rot.call(Vector3(a.x, a.y, zs[1]))); v.append(rot.call(Vector3(b.x, b.y, zs[1])))
		for _k in range(4):
			n.append(rot.call(nn)); uv.append(Vector2.ZERO)
		_t(ind, base, base + 2, base + 1); _t(ind, base + 1, base + 2, base + 3)
	return _pack(v, n, uv, ind)

## plane with a flag-wave friendly subdivision (w x h, xs x ys segments), translated so x runs 0..w
static func grid_plane_g(w: float, h: float, xs: int, ys: int, x_off: float = 0.0) -> Array:
	_check_winding()
	var v := PackedVector3Array(); var n := PackedVector3Array(); var uv := PackedVector2Array(); var ind := PackedInt32Array()
	for iy in range(ys + 1):
		for ix in range(xs + 1):
			var x := -w / 2 + w * ix / xs + x_off
			var y := h / 2 - h * iy / ys
			v.append(Vector3(x, y, 0)); n.append(Vector3(0, 0, 1)); uv.append(Vector2(float(ix) / xs, float(iy) / ys))
	for iy in range(ys):
		for ix in range(xs):
			var a := ix + (xs + 1) * iy; var b := ix + (xs + 1) * (iy + 1); var c := (ix + 1) + (xs + 1) * (iy + 1); var d := (ix + 1) + (xs + 1) * iy
			_t(ind, a, b, d); _t(ind, b, c, d)
	return _pack(v, n, uv, ind)

# ---------------------------------------------------------------- named cache (three.js GEO table)
static func G(name: String) -> Array:
	if _arrays.has(name):
		return _arrays[name]
	var a: Array
	match name:
		"sphere": a = sphere_g(1.0, 16, 12)
		"hemi": a = sphere_g(1.0, 22, 10, 0.0, TAU, 0.0, PI / 2)
		"box": a = box_g()
		"cyl": a = cylinder_g(1, 1, 1, 20)
		"cylLow": a = cylinder_g(1, 1, 1, 8)
		"cone": a = cylinder_g(0, 1, 1, 18)
		"cone4": a = cylinder_g(0, 1, 1, 4)
		"pyrSq": a = rotated(cylinder_g(0, sqrt(0.5), 1, 4), Basis(Vector3.UP, PI / 4))
		"capsule": a = capsule_g(0.5, 1.0, 14)
		"torus": a = torus_g(1, 0.12, 8, 28)
		"torusThin": a = torus_g(1, 0.04, 6, 40)
		"halfTorus": a = torus_g(1, 0.18, 8, 16, PI)
		"ico": a = icosahedron_g(1, 1)
		"ico2": a = icosahedron_g(1, 2)
		"ico0": a = icosahedron_g(1, 0)
		"oct": a = octahedron_g(1)
		"plane": a = plane_g(1, 1)
		"ring": a = ring_g(0.75, 1, 40)
		"dodec": a = dodecahedron_g(1)
		"donut": a = torus_g(0.62, 0.34, 10, 26)
		"cape": a = cylinder_g(0.34, 0.52, 0.95, 14, true, PI * 0.62, PI * 0.76)
		"pillar": a = cylinder_g(0.55, 0.75, 12, 16, true)
		"aura": a = ring_g(0.86, 1, 48)
		"ring08": a = ring_g(0.8, 1, 36)
		"circle": a = circle_g(1, 32)
		_:
			push_error("unknown geo " + name)
			a = box_g()
	_arrays[name] = a
	return a

static func rbox(w: float, h: float, d: float, r: float = 0.08) -> Array:
	var k := "rbox|%.3f|%.3f|%.3f|%.3f" % [w, h, d, r]
	if _arrays.has(k):
		return _arrays[k]
	var a := rbox_g(w, h, d, r)
	_arrays[k] = a
	return a

static func cyl(rt: float, rb: float, h: float, rs: int, open: bool = false, th0: float = 0.0, thLen: float = TAU) -> Array:
	var k := "cyl|%s|%s|%s|%d|%s|%s|%s" % [rt, rb, h, rs, open, th0, thLen]
	if _arrays.has(k):
		return _arrays[k]
	var a := cylinder_g(rt, rb, h, rs, open, th0, thLen)
	_arrays[k] = a
	return a

static func torus(R: float, r: float, rs: int, ts: int, arc: float = TAU) -> Array:
	var k := "torus|%s|%s|%d|%d|%s" % [R, r, rs, ts, arc]
	if _arrays.has(k):
		return _arrays[k]
	var a := torus_g(R, r, rs, ts, arc)
	_arrays[k] = a
	return a

static func rotated(arrays: Array, b: Basis) -> Array:
	var xf := Transform3D(b, Vector3.ZERO)
	return _pack(xf * arrays[Mesh.ARRAY_VERTEX], xf * arrays[Mesh.ARRAY_NORMAL], arrays[Mesh.ARRAY_TEX_UV], arrays[Mesh.ARRAY_INDEX])

static func translated(arrays: Array, off: Vector3) -> Array:
	var xf := Transform3D(Basis(), off)
	return _pack(xf * arrays[Mesh.ARRAY_VERTEX], arrays[Mesh.ARRAY_NORMAL], arrays[Mesh.ARRAY_TEX_UV], arrays[Mesh.ARRAY_INDEX])

# ---------------------------------------------------------------- transforms (three.js XYZ euler order)
static func basis_xyz(rx: float, ry: float, rz: float) -> Basis:
	var b := Basis()
	if rx != 0.0:
		b = b * Basis(Vector3.RIGHT, rx)
	if ry != 0.0:
		b = b * Basis(Vector3.UP, ry)
	if rz != 0.0:
		b = b * Basis(Vector3.BACK, rz)
	return b

static func xf(pos: Vector3, scl: Vector3, rot: Vector3 = Vector3.ZERO) -> Transform3D:
	return Transform3D(basis_xyz(rot.x, rot.y, rot.z) * Basis.from_scale(scl), pos)

## three.js Object3D.lookAt for non-camera objects: local +Z points at the target
static func look_basis(from: Vector3, target: Vector3) -> Basis:
	var dir := (target - from)
	if dir.length_squared() < 1e-9:
		return Basis()
	dir = dir.normalized()
	var up := Vector3.UP
	if absf(dir.dot(up)) > 0.999:
		up = Vector3.RIGHT
	var x := up.cross(dir).normalized()
	var y := dir.cross(x)
	return Basis(x, y, dir)

# ---------------------------------------------------------------- materials
static func _color(c) -> Color:
	if c is Color:
		return c
	return Color.html(str(c))

## three.js `mat(color, {r, m, e, ei, t, dw, side, flat, map, emap, rep, unshaded})`
static func mat(color, o: Dictionary = {}) -> StandardMaterial3D:
	var key := str(color)
	for k in o.keys():
		var val = o[k]
		if val is Texture2D:
			key += "|" + k + "=" + str(val.get_instance_id())
		else:
			key += "|" + k + "=" + str(val)
	if _mats.has(key):
		return _mats[key]
	var m := StandardMaterial3D.new()
	m.albedo_color = _color(color)
	m.roughness = o.get("r", 0.6)
	m.metallic = o.get("m", 0.0)
	m.metallic_specular = 0.5
	if o.has("e"):
		m.emission_enabled = true
		m.emission = _color(o.e)
		m.emission_energy_multiplier = o.get("ei", 1.0)
	if o.has("map"):
		m.albedo_texture = o.map
		m.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
	if o.has("emap"):
		m.emission_enabled = true
		m.emission_texture = o.emap
		m.emission = _color(o.get("e", "#ffffff"))
		m.emission_energy_multiplier = o.get("ei", 1.0)
	if o.has("rep"):
		var rp: Vector2 = o.rep
		m.uv1_scale = Vector3(rp.x, rp.y, 1.0)
	if o.has("t"):
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		m.albedo_color.a = o.t
		if o.get("dw", false):
			m.depth_draw_mode = BaseMaterial3D.DEPTH_DRAW_ALWAYS
	if o.get("side", false):
		m.cull_mode = BaseMaterial3D.CULL_DISABLED
	if o.get("flat", false):
		m.shading_mode = BaseMaterial3D.SHADING_MODE_PER_VERTEX
	if o.get("unshaded", false):
		m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	if o.has("prio"):
		m.render_priority = o.prio
	_mats[key] = m
	return m

static func glass_mat(tint: String = "#bfe6ff") -> StandardMaterial3D:
	var key := "glass" + tint
	if _mats.has(key):
		return _mats[key]
	var m := StandardMaterial3D.new()
	m.albedo_color = _color(tint)
	m.albedo_color.a = 0.35
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.metallic = 0.6; m.roughness = 0.06; m.metallic_specular = 0.9
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	_mats[key] = m
	return m

## additive, unshaded, no depth write (three.js MeshBasicMaterial + AdditiveBlending)
static func add_mat(color, op: float = 1.0) -> StandardMaterial3D:
	var key := "add" + str(color) + str(op)
	if _mats.has(key):
		return _mats[key]
	var m := StandardMaterial3D.new()
	m.albedo_color = _color(color); m.albedo_color.a = op
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	m.disable_fog = true
	_mats[key] = m
	return m

## unshaded flat colour (three.js MeshBasicMaterial)
static func basic_mat(color, op: float = 1.0, o: Dictionary = {}) -> StandardMaterial3D:
	var key := "basic" + str(color) + str(op) + str(o)
	if _mats.has(key):
		return _mats[key]
	var m := StandardMaterial3D.new()
	m.albedo_color = _color(color); m.albedo_color.a = op
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	if op < 1.0 or o.get("t", false):
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	if o.get("side", false):
		m.cull_mode = BaseMaterial3D.CULL_DISABLED
	if o.has("map"):
		m.albedo_texture = o.map
	if o.get("nofog", false):
		m.disable_fog = true
	_mats[key] = m
	return m

static func colored(base: StandardMaterial3D, color) -> StandardMaterial3D:
	var key := "col" + str(base.get_instance_id()) + str(color)
	if _mats.has(key):
		return _mats[key]
	var m: StandardMaterial3D = base.duplicate()
	m.albedo_color = _color(color)
	_mats[key] = m
	return m

# ---------------------------------------------------------------- merger (replaces three.js mergeStatic / InstancedMesh batching)
class Merger:
	var groups: Dictionary = {}
	var order: Array = []
	func add(arrays: Array, xform: Transform3D, m: Material, keep: bool = false) -> void:
		var key := str(m.get_instance_id()) + ("k" if keep else "")
		var g: Dictionary
		if groups.has(key):
			g = groups[key]
		else:
			g = {"mat": m, "keep": keep, "v": PackedVector3Array(), "n": PackedVector3Array(), "uv": PackedVector2Array(), "idx": PackedInt32Array()}
			groups[key] = g
			order.append(key)
		var base: int = g.v.size()
		g.v.append_array(xform * arrays[Mesh.ARRAY_VERTEX])
		var nb := Transform3D(xform.basis.inverse().transposed(), Vector3.ZERO)
		g.n.append_array(nb * arrays[Mesh.ARRAY_NORMAL])
		g.uv.append_array(arrays[Mesh.ARRAY_TEX_UV])
		var src: PackedInt32Array = arrays[Mesh.ARRAY_INDEX]
		var dst: PackedInt32Array = g.idx
		var start := dst.size()
		dst.resize(start + src.size())
		for i in src.size():
			dst[start + i] = src[i] + base
		g.idx = dst
	func is_empty() -> bool:
		return order.is_empty()
	## returns {mesh, keep: Array[bool]}
	func build() -> Dictionary:
		var mesh := ArrayMesh.new()
		var keeps := []
		for key in order:
			var g: Dictionary = groups[key]
			var arr := []
			arr.resize(Mesh.ARRAY_MAX)
			arr[Mesh.ARRAY_VERTEX] = g.v; arr[Mesh.ARRAY_NORMAL] = g.n; arr[Mesh.ARRAY_TEX_UV] = g.uv; arr[Mesh.ARRAY_INDEX] = g.idx
			mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
			mesh.surface_set_material(mesh.get_surface_count() - 1, g.mat)
			keeps.append(g.keep)
		return {"mesh": mesh, "keep": keeps}
	func instance(cast_shadow: bool = true) -> MeshInstance3D:
		var mi := MeshInstance3D.new()
		mi.mesh = build().mesh
		if not cast_shadow:
			mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		return mi

## three.js Batcher: static instances merged per material
class Batcher:
	var m := Merger.new()
	func add(geo: Array, material: StandardMaterial3D, x: float, y: float, z: float, sx: float = 1.0, sy: float = 1.0, sz: float = 1.0, ry: float = 0.0, rx: float = 0.0, rz: float = 0.0, color = null) -> void:
		var mt := material
		if color != null:
			mt = Geo.colored(material, color)
		m.add(geo, Geo.xf(Vector3(x, y, z), Vector3(sx, sy, sz), Vector3(rx, ry, rz)), mt)
	func build(parent: Node3D, cast_shadow: bool = true) -> MeshInstance3D:
		if m.is_empty():
			return null
		var mi := m.instance(cast_shadow)
		parent.add_child(mi)
		m = Merger.new()
		return mi

# ---------------------------------------------------------------- simple mesh helper (three.js `mesh(geo, mat, x, y, z, sx, sy, sz, parent, shadow)`)
static func mesh(geo: Array, material: Material, x: float = 0.0, y: float = 0.0, z: float = 0.0, sx: float = 1.0, sy: float = 1.0, sz: float = 1.0, parent: Node3D = null, shadow: bool = true) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh_of(geo)
	mi.material_override = material
	mi.position = Vector3(x, y, z)
	mi.scale = Vector3(sx, sy, sz)
	if not shadow:
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	if parent:
		parent.add_child(mi)
	return mi

## set three.js style XYZ rotation on a node
static func rot(n: Node3D, rx: float, ry: float = 0.0, rz: float = 0.0) -> void:
	n.basis = basis_xyz(rx, ry, rz) * Basis.from_scale(n.scale)

static func points_mesh(points: PackedVector3Array, color: Color, size: float) -> MeshInstance3D:
	var arr := []
	arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = points
	var m := ArrayMesh.new()
	m.add_surface_from_arrays(Mesh.PRIMITIVE_POINTS, arr)
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.use_point_size = true
	mat.point_size = size
	mat.albedo_color = color
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.disable_fog = true
	var mi := MeshInstance3D.new()
	mi.mesh = m
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return mi
