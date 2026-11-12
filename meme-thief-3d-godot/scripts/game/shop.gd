## Shop: you order at a counter, the keeper hands the item over.
class_name Shop

static var busy = null
static var item: Node3D = null
static var label: Sign = null
static var keeper: Avatar = null

static func ensure_item() -> void:
	if item != null:
		return
	var g := Node3D.new()
	Geo.mesh(Geo.rbox(0.55, 0.45, 0.55, 0.06), Geo.mat("#ff4f8b", {"r": 0.4}), 0, 0, 0, 1, 1, 1, g)
	var gold := Geo.mat("#ffd23f", {"m": 0.5, "r": 0.3})
	Geo.mesh(Geo.G("box"), gold, 0, 0, 0, 0.58, 0.47, 0.1, g); Geo.mesh(Geo.G("box"), gold, 0, 0, 0, 0.1, 0.47, 0.58, g)
	for s in [-1, 1]:
		var bw := Geo.mesh(Geo.G("torus"), gold, s * 0.12, 0.3, 0, 0.14, 0.14, 0.3, g); Geo.rot(bw, 0, PI / 2, 0)
	label = Sign.make([{"t": "🎁", "size": 96}], {"w": 128, "h": 128, "bg": false}, 0.7, 0.7); label.position.y = 0.75; g.add_child(label)
	g.visible = false; Game.agents_node.add_child(g); item = g

static func keeper_of(wn: int, K) -> Avatar:
	if K != null:
		return null
	match wn:
		2: return W2.keeper
		3: return W3.keeper
		4, 5: return EXW.D[wn].keeper
	return Game.shopkeeper

static func order(key: String) -> void:
	var o := Game.player.owner; var U_: Dictionary = Data.UPGRADES[key]; var l: int = o.up[key]
	var wn := Phys.world_of(Game.player.body.pos.x)
	var K = UI.kiosk_ref if UI.shop_mode != "town" else null
	if l >= U_.max or ((Data.up_shop(key) != 1) if K != null else (Data.up_shop(key) != wn)):
		return
	var kiosk_keeper: Dictionary = K.keeper if K != null else {}
	if busy != null:
		Sound.play("error"); UI.toast("⏳ هنوز سفارش قبلی‌ات در راه است…", "bad")
		return
	var cost := Data.up_cost(key, l)
	if o.money < cost:
		Sound.play("error"); UI.toast("💸 پولت برای «" + U_.name + "» کافی نیست (" + U.fmt(cost) + ")", "bad")
		return
	o.money -= cost; ensure_item()
	keeper = keeper_of(wn, K)
	busy = {"key": key, "t": 0.0, "kiosk": K != null, "kroot": kiosk_keeper.get("root", null)}
	label.set_lines(key, [{"t": U_.emoji, "size": 96}])
	UI.close_panel(); Sound.play("click"); UI.toast(("🤖 ربات فروشنده‌ی پایگاه" if K != null else Data.shop_keeper_name(wn)) + " دارد «" + U_.name + "» را برایت می‌آورد…", "")

static func hand_pos() -> Vector3:
	var sk: Node3D = busy.kroot if busy.kroot != null else keeper.root
	var y := sk.rotation.y
	return Vector3(sk.position.x + sin(y) * 0.75, 1.35, sk.position.z + cos(y) * 0.75)

static func update(dt: float) -> void:
	var t := Game.time
	for K in [W2.keeper, W3.keeper, EXW.D[4].keeper, EXW.D[5].keeper]:
		if K != null:
			K.animate(dt, {"speed": 0, "grounded": true, "t": t, "turn": 0})
	var rests := [[Game.shopkeeper, PI / 2], [W2.keeper, -PI / 2], [W3.keeper, PI / 2], [EXW.D[4].keeper, PI / 2], [EXW.D[5].keeper, PI / 2]]
	for kr in rests:
		var K: Avatar = kr[0]
		if K == null or (busy != null and keeper == K):
			continue
		K.root.rotation.y = U.damp(K.root.rotation.y, kr[1], 4, dt)
		if K == Game.shopkeeper:
			K.armR.rotation.x = -2.5 + sin(t * 5) * 0.4; K.armR.rotation.z = -0.4
		elif K == EXW.D[4].keeper or K == EXW.D[5].keeper:
			K.armR.rotation.x = -0.6 + sin(t * 2.2) * 0.5; K.armL.rotation.x = -0.3
		elif K == W3.keeper:
			K.armR.rotation.x = -2.6 + sin(t * 3) * 0.3; K.armL.rotation.x = -2.6 - sin(t * 3) * 0.3
		else:
			K.armR.rotation.x = -1.2 + absf(sin(t * 4)) * -1.2; K.armR.rotation.z = -0.2
			if randf() < dt * 3:
				FX.burst(Vector3(K.root.position.x - 1.1, 1.3, K.root.position.z + 1.4), {"count": 5, "color": ["#ffb000", "#ff5a1f"], "speed": 3, "life": 0.4})
	if busy == null:
		return
	var b = busy; var pp := Game.player.body.pos
	b.t += dt
	if keeper != null:
		var sk := keeper
		var face := atan2(pp.x - sk.root.position.x, pp.z - sk.root.position.z)
		sk.root.rotation.y += U.ang_diff(sk.root.rotation.y, face) * minf(1.0, dt * 8)
		sk.armL.rotation.x = -1.45; sk.armR.rotation.x = -1.45; sk.armL.rotation.z = 0.2; sk.armR.rotation.z = -0.2
	var it := item; it.visible = true; it.rotation.y += dt * 3
	var hand := hand_pos()
	if b.t < 0.8:
		var k: float = b.t / 0.8
		it.position = hand + Vector3(0, sin(k * PI) * 0.15, 0)
		var sc := 0.3 + 0.7 * minf(1.0, k * 2); it.scale = Vector3(sc, sc, sc)
		if b.t < dt * 1.5:
			FX.burst(hand, {"count": 10, "color": ["#ffd23f", "#ffffff"], "speed": 2, "life": 0.5})
	elif b.t < 1.7:
		var k: float = (b.t - 0.8) / 0.9
		var target := Vector3(pp.x, pp.y + 1.25, pp.z)
		it.position = hand.lerp(target, k) + Vector3(0, sin(k * PI) * 1.4, 0); it.scale = Vector3.ONE
		Game.player.receiveT = 0.4
		if randf() < 0.5:
			FX.one(it.position.x, it.position.y, it.position.z, {"vx": 0, "vy": 0.5, "vz": 0, "life": 0.5, "size": 0.25, "color": "#ffd23f"})
	else:
		finish()

static func finish() -> void:
	var b = busy
	if b == null:
		return
	busy = null
	if item != null:
		item.visible = false
	var o := Game.player.owner
	Game.apply_upgrade(o, b.key); Missions.event("shop")
	FX.burst(Vector3(Game.player.body.pos.x, Game.player.body.pos.y + 1.3, Game.player.body.pos.z), {"count": 26, "color": ["#ffd23f", "#3df2b0", "#ffffff"], "speed": 4, "up": true, "life": 0.8})
	var who: String = "ربات فروشنده‌ی پایگاه" if b.kiosk else Data.shop_keeper_name(Data.up_shop(b.key)).split(" ", true, 1)[1]
	UI.toast("🎁 " + who + " «" + Data.UPGRADES[b.key].name + "» را تحویلت داد! (سطح " + U.fa(o.up[b.key]) + ")", "good")
