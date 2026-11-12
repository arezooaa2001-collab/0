## A base owner (the player or a rival): money, upgrades, slots across all owned plots.
class_name Owner

var id := 0
var name := ""
var color := "#ffffff"
var isPlayer := false
var money := 100.0
var rebirths := 0
var up: Dictionary = {}
var slots: Array = []
var bases: Array = []
var base: BaseVis = null
var agent = null
var guards: Array = []
var hard := false
var secT := 0.0
var secCd := 0.0
var magnetT := 0.0
var elite := 0
var elite3 := false
var drills := 0

func _init(id_: int, name_: String, color_: String, is_player: bool, base_: BaseVis) -> void:
	id = id_; name = name_; color = color_; isPlayer = is_player; money = Data.START_MONEY
	for k in Data.UP_KEYS:
		up[k] = 0
	add_base(base_)

func add_base(b: BaseVis) -> void:
	b.owner = self
	bases.append(b)
	if base == null:
		base = b
	for li in Data.MAX_SLOTS:
		slots.append({"i": slots.size(), "base": b, "li": li, "vault": false, "unit": null, "pending": 0.0})
	for k in BaseVis.VAULT_LOCAL.size():
		slots.append({"i": slots.size(), "base": b, "li": Data.MAX_SLOTS + k, "vault": true, "unit": null, "pending": 0.0})

var cap: int:
	get: return mini(Data.MAX_SLOTS, 4 + int(up.cap))
var totalCap: int:
	get: return cap * bases.size()

func apply_cap() -> void:
	for b in bases:
		b.set_capacity(cap)
		if b.trap:
			b.trap.visible = up.trap > 0

func base_at(x: float, z: float, m: float = 0.0) -> BaseVis:
	for b in bases:
		if b.contains(x, z, m):
			return b
	return null

func income_mult() -> float:
	var ev := 2.0 if (Game.event != null and Game.event.id == "golden") else 1.0
	var pl := ((1.15 if up.petCat > 0 else 1.0) * (2.0 if Game.boostT > 0 else 1.0)) if isPlayer else 0.65
	return (1 + 0.1 * up.income) * (1 + 0.5 * rebirths) * ev * pl

func weakest():
	var w = null
	for s in slots:
		if s.unit != null and s.unit.state == "slotted" and (w == null or s.unit.income < w.income):
			w = s.unit
	return w

func income_per_sec() -> float:
	var s := 0.0
	for sl in slots:
		if sl.unit != null and sl.unit.state == "slotted":
			s += sl.unit.income
	return s * income_mult()

func free_slot(pref: BaseVis = null, world: int = 0):
	var c := cap
	if pref != null:
		for s in slots:
			if s.base == pref and s.li < c and s.unit == null:
				return s
	for s in slots:
		if s.li < c and s.unit == null and (world == 0 or s.base.world == world):
			return s
	return null

func unit_count() -> int:
	var n := 0
	for s in slots:
		if s.unit != null:
			n += 1
	return n

func pending() -> float:
	var n := 0.0
	for s in slots:
		n += s.pending
	return n

func net_worth() -> float:
	var n := money
	for s in slots:
		if s.unit != null:
			n += s.unit.price
	return n
