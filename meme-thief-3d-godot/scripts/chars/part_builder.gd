## Collects primitive parts under pivot nodes and bakes them into merged meshes (three.js builders + mergeStatic).
class_name PB

class Part:
	var geo: Array
	var mat: Material
	var pos: Vector3
	var scl: Vector3
	var rot := Vector3.ZERO
	var look = null
	var extra := Basis()
	var keep := false
	var solo := false
	var parent: Node3D
	func r(x: float, y: float = 0.0, z: float = 0.0) -> Part:
		rot = Vector3(x, y, z)
		return self
	func rx(v: float) -> Part: rot.x = v; return self
	func ry(v: float) -> Part: rot.y = v; return self
	func rz(v: float) -> Part: rot.z = v; return self
	func look_at(target: Vector3) -> Part:
		look = target
		return self
	func rotx(v: float) -> Part:
		extra = extra * Basis(Vector3.RIGHT, v)
		return self
	func k() -> Part:
		keep = true
		return self
	func xform() -> Transform3D:
		var b: Basis
		if look != null:
			b = Geo.look_basis(pos, look) * extra
		else:
			b = Geo.basis_xyz(rot.x, rot.y, rot.z) * extra
		return Transform3D(b * Basis.from_scale(scl), pos)

var parts: Array[Part] = []
var root: Node3D
var body: Node3D
var nodes: Array[Node3D] = []

func _init() -> void:
	root = Node3D.new()
	body = Node3D.new()
	body.name = "BODY"
	root.add_child(body)
	nodes = [root, body]

static func white() -> StandardMaterial3D: return Geo.mat("#ffffff", {"r": 0.25})
static func pupil() -> StandardMaterial3D: return Geo.mat("#14121c", {"r": 0.2})

## three.js P(geo, color, x, y, z, sx, sy, sz, parent, o)
func P(geo: Array, color, x: float, y: float, z: float, sx: float = 1.0, sy: float = 1.0, sz: float = 1.0, parent: Node3D = null, o: Dictionary = {}) -> Part:
	var p := Part.new()
	p.geo = geo
	p.mat = color if color is Material else Geo.mat(color, o)
	p.pos = Vector3(x, y, z); p.scl = Vector3(sx, sy, sz)
	p.parent = parent if parent else body
	parts.append(p)
	return p

## keep-coloured accessory part
func K(geo: Array, color, x: float, y: float, z: float, sx: float = 1.0, sy: float = 1.0, sz: float = 1.0, parent: Node3D = null, o: Dictionary = {}) -> Part:
	return P(geo, color, x, y, z, sx, sy, sz, parent, o).k()

func pivot(parent: Node3D, name: String, x: float, y: float, z: float) -> Node3D:
	var g := Node3D.new()
	g.name = name
	g.position = Vector3(x, y, z)
	parent.add_child(g)
	nodes.append(g)
	return g

## plain sub-group (three.js Group without anim flag)
func group(parent: Node3D, x: float, y: float, z: float, name: String = "") -> Node3D:
	var g := Node3D.new()
	if name != "":
		g.name = name
	g.position = Vector3(x, y, z)
	parent.add_child(g)
	nodes.append(g)
	return g

func eye(parent: Node3D, x: float, y: float, z: float, r: float = 0.12, o: Dictionary = {}) -> void:
	var sy: float = o.get("sy", 1.0)
	K(Geo.G("sphere"), white(), x, y, z, r, r * sy, r * 0.8, parent)
	var pr: float = r * o.get("pupil", 0.55)
	var pm: Material
	if o.has("iris"):
		pm = Geo.mat(o.iris, {"r": 0.2, "e": o.iris, "ei": 1.2} if o.get("glow", false) else {"r": 0.2})
	else:
		pm = pupil()
	K(Geo.G("sphere"), pm, x + o.get("lx", 0.0) * r, y + o.get("ly", 0.0) * r, z + r * 0.62, pr, pr * sy, pr * 0.6, parent)
	if not o.get("glow", false):
		K(Geo.G("sphere"), white(), x + r * 0.22, y + r * 0.28, z + r * 0.82, pr * 0.3, pr * 0.3, pr * 0.2, parent)

func eyes(parent: Node3D, y: float, z: float, sep: float, r: float, o: Dictionary = {}) -> void:
	eye(parent, -sep, y, z, r, o); eye(parent, sep, y, z, r, o)

func brows(parent: Node3D, y: float, z: float, sep: float, ang: float, color = "#2a1a10", w: float = 0.18) -> void:
	for s in [-1.0, 1.0]:
		K(Geo.G("box"), color, s * sep, y, z, w, 0.05, 0.05, parent).rz(-s * ang)

func smile(parent: Node3D, y: float, z: float, w: float = 0.18, color = "#3a1020", open: bool = false, ang: float = 0.0) -> Part:
	var m := K(Geo.G("halfTorus"), color, 0, y, z, w, w * (1.1 if open else 0.7), w * 0.5, parent).r(0.15, 0, PI + ang)
	if open:
		K(Geo.G("sphere"), "#7a1c2c", 0, y - w * 0.35, z - 0.02, w * 0.75, w * 0.45, w * 0.3, parent)
	return m

func leg(r_: Node3D, name: String, x: float, z: float, hip: float, color, shoe, thick: float = 0.11) -> Node3D:
	var g := pivot(r_, name, x, hip, z)
	P(Geo.G("capsule"), color, 0, -hip / 2, 0, thick * 2, hip / 2, thick * 2, g)
	if shoe != null:
		P(Geo.rbox(0.26, 0.14, 0.38, 0.05), shoe, 0, -hip + 0.07, 0.06, 1, 1, 1, g)
	return g

func arm(b: Node3D, name: String, x: float, y: float, len: float, color, hand, thick: float = 0.08, out: float = 0.25) -> Node3D:
	var g := pivot(b, name, x, y, 0)
	g.rotation.z = signf(x) * out
	P(Geo.G("capsule"), color, 0, -len / 2, 0, thick * 2, len / 2, thick * 2, g)
	if hand != null:
		P(Geo.G("sphere"), hand, 0, -len - thick * 0.5, 0, thick * 1.35, thick * 1.35, thick * 1.35, g)
	return g

func wing(b: Node3D, name: String, x: float, y: float, z: float, w: float, h: float, color, color2 = null) -> Node3D:
	var g := pivot(b, name, x, y, z)
	var s := signf(x)
	for i in 3:
		P(Geo.G("sphere"), color2 if (i == 1 and color2 != null) else color, s * (w * 0.45 + i * w * 0.12), -i * h * 0.18, -i * 0.05, w * (0.55 - i * 0.1), h * (0.5 - i * 0.08), 0.06, g).rz(s * (0.3 + i * 0.25))
	return g

## merge every part into one MeshInstance3D per pivot node; returns {root, height, rad}
func bake() -> Dictionary:
	var by_node: Dictionary = {}
	for p in parts:
		if p.solo:
			var mi := MeshInstance3D.new()
			mi.mesh = Geo.mesh_of(p.geo)
			mi.material_override = p.mat
			mi.transform = p.xform()
			mi.set_meta("solo", true)
			p.parent.add_child(mi)
			continue
		var key := p.parent.get_instance_id()
		if not by_node.has(key):
			by_node[key] = {"node": p.parent, "m": Geo.Merger.new()}
		by_node[key].m.add(p.geo, p.xform(), p.mat, p.keep)
	for key in by_node.keys():
		var e: Dictionary = by_node[key]
		var r: Dictionary = e.m.build()
		var mi := MeshInstance3D.new()
		mi.name = "M"
		mi.mesh = r.mesh
		var keeps := PackedByteArray()
		for kk in r.keep:
			keeps.append(1 if kk else 0)
		mi.set_meta("keep", keeps)
		e.node.add_child(mi)
	# bounds
	var top := 0.0; var rad := 0.1
	for mi in _all_meshes(root):
		var xf := _rel_xform(mi)
		var aabb: AABB = mi.mesh.get_aabb()
		for i in 8:
			var c := xf * aabb.get_endpoint(i)
			top = maxf(top, c.y)
			rad = maxf(rad, maxf(absf(c.x), absf(c.z)))
	return {"root": root, "height": top, "rad": rad}

func _all_meshes(n: Node) -> Array:
	var out := []
	if n is MeshInstance3D:
		out.append(n)
	for c in n.get_children():
		out.append_array(_all_meshes(c))
	return out

func _rel_xform(n: Node3D) -> Transform3D:
	var xf := Transform3D()
	var cur: Node = n
	while cur != null and cur != root:
		xf = (cur as Node3D).transform * xf
		cur = cur.get_parent()
	return xf
