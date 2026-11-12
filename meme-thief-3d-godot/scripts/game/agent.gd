## A walking character: the player, a rival or a guard robot (avatar + physics body + optional brain).
class_name Agent

var owner: Owner
var isPlayer := false
var isGuard := false
var av: Avatar
var body: Phys.Body
var yaw := 0.0
var move := Vector2.ZERO
var sprint := false
var jumpQ := 0.0
var coyote := 0.0
var carrying: Unit = null
var stunT := 0.0
var carryT := 0.0
var renderY := 0.0
var turn := 0.0
var zapT := 0.0
var brain = null
var label: Sign = null
var fling := 0.0
var slapCd := 0.0
var slapT := 0.0
var receiveT := 0.0
var dj := 0
var jumpHeld := false
var lastSafe = null
var gliding := false
var drilling = null
var burnCd := 0.0
var fullWarn := -100.0

var stunned: bool:
	get: return stunT > 0

func _init(owner_: Owner, look: Dictionary, is_player: bool, opts: Dictionary = {}) -> void:
	owner = owner_
	var guard_base: BaseVis = opts.get("guard", null)
	if guard_base == null:
		owner.agent = self
	isPlayer = is_player; isGuard = guard_base != null
	av = Avatar.build(look)
	Game.agents_node.add_child(av.root)
	var sp: Vector3 = (guard_base if guard_base else owner.base).spawnPos
	body = Phys.Body.new(sp.x + (3.0 if isGuard else 0.0), sp.y, sp.z)
	body.agent = self; body.ownerId = owner.id
	yaw = owner.base.frontYaw
	renderY = sp.y
	if is_player:
		brain = null
	elif isGuard:
		brain = GuardBrain.new(self, guard_base)
	else:
		brain = Brain.new(self)
	if isGuard:
		owner.guards.append(self)
	if not is_player:
		label = Sign.make([{"t": ("🤖 نگهبان " + owner.name) if isGuard else owner.name, "size": 46 if isGuard else 64, "color": "#fff", "weight": 900, "stroke": 6}], {"w": 384, "h": 110, "bg": owner.color}, 1.9, 0.55)
		label.position.y = 2.75
		av.root.add_child(label)
	Game.agents.append(self)

func stun(t: float) -> void:
	stunT = t
	FX.burst(Vector3(body.pos.x, body.pos.y + 2.2, body.pos.z), {"count": 12, "color": ["#ffd23f", "#ffffff"], "speed": 2, "life": 0.8})

func zap() -> void:
	if zapT > 0:
		return
	zapT = 0.6
	FX.burst(Vector3(body.pos.x, body.pos.y + 1, body.pos.z), {"count": 14, "color": ["#ff2a3a", "#ffffff"], "speed": 5, "life": 0.4})
	if isPlayer:
		Sound.play("zap"); UI.toast("⚡ سپر لیزری فعال است! نمی‌شود وارد شد", "bad")

func on_fall() -> void:
	var w := Phys.world_of(body.pos.x)
	if carrying != null:
		var u := carrying
		Game.return_unit(u)
		if isPlayer:
			UI.toast("☁️ از جزیره افتادی و «" + u.c.name + "» برگشت سر جایش!", "bad")
	elif isPlayer and w == 3:
		UI.toast("☁️ از جزیره افتادی! مواظب لبه‌ها و باد باش", "bad")
	if w != 3:
		respawn()
		return
	var own: BaseVis = null
	if isGuard:
		own = brain.base
	else:
		for b in owner.bases:
			if b.world == 3:
				own = b
	var sp: Vector3 = own.spawnPos if own else W3.arrival
	body.pos = Vector3(sp.x, sp.y + 0.6, sp.z); body.vel = Vector3.ZERO; stunT = 0.6; fling = 0.0
	FX.burst(Vector3(body.pos.x, body.pos.y + 1, body.pos.z), {"count": 24, "color": ["#ffffff", "#9fe8ff"], "speed": 4, "life": 0.7})
	if isPlayer:
		Game.cam_pivot = Vector3(sp.x, sp.y + 1.65, sp.z); Sound.play("poof")
	elif brain != null:
		brain.set_state("patrol" if isGuard else "idle")

func respawn() -> void:
	var sp: Vector3 = (brain.base if isGuard else owner.base).spawnPos
	body.pos = Vector3(sp.x, sp.y + 0.5, sp.z); body.vel = Vector3.ZERO
	if carrying != null:
		Game.return_unit(carrying)

func max_speed() -> float:
	var v: float
	if isPlayer:
		v = 9.6 if sprint else 6.4
	elif isGuard:
		v = 7.6 if brain.run else 4.2
	elif owner.hard:
		v = 6.9 if brain.run else 5.6
	else:
		v = 5.75 if brain.run else 5.0
	v *= 1 + 0.07 * owner.up.speed
	if isPlayer:
		if owner.up.petBird > 0:
			v *= 1.1
		if Extras.riding and carrying == null:
			v *= 1.75
		if Phys.in_w4(body.pos.x) and EXW.D[4].storm.on > 0 and owner.up.furCoat == 0:
			v *= 0.7
	if isGuard and (owner.elite > 0 or owner.elite3):
		v *= 1.22 if owner.elite == 5 else (1.15 if owner.elite == 4 else 1.1)
	if carrying != null:
		if isPlayer:
			var m := 1.0
			if Phys.in_w2(body.pos.x):
				m = 1 + 0.12 * owner.up.turbo
			elif Phys.in_w5(body.pos.x):
				m = 1 + 0.15 * owner.up.moonBoots
			v *= 1.15 * m
			v *= 1 + 0.08 * owner.up.carrySpeed
		else:
			v *= 0.75
		if carrying.owner.base_at(body.pos.x, body.pos.z, 0.5) != null:
			v *= 1 - (0.05 if isPlayer else 0.1) * carrying.owner.up.trap
	if isGuard and brain.target != null and brain.target.isPlayer:
		v *= 1 - 0.1 * brain.target.owner.up.cloak
	return 0.0 if stunned else v

func physics(dt: float) -> void:
	var b := body
	var vmax := max_speed(); var mx := move.x; var mz := move.y
	fling = maxf(0.0, fling - dt)
	var slip: bool = isPlayer and owner.up.spikes == 0 and EXW.on_ice(self)
	var tx := mx * vmax; var tz := mz * vmax
	var mv := Vector2(mx, mz).length()
	var acc: float
	if fling > 0:
		acc = 0.0
	elif slip:
		acc = 9.0 if mv > 0.05 else 3.2
	elif b.grounded:
		acc = 46.0 if mv > 0.05 else 34.0
	else:
		acc = 14.0
	var dx := tx - b.vel.x; var dz := tz - b.vel.z; var dl := Vector2(dx, dz).length(); var stepA := acc * dt
	if dl <= stepA:
		b.vel.x = tx; b.vel.z = tz
	else:
		b.vel.x += dx / dl * stepA; b.vel.z += dz / dl * stepA
	if b.grounded:
		coyote = 0.12
	else:
		coyote -= dt
	if b.grounded:
		dj = 0
	var w3p := isPlayer and Phys.in_w3(b.pos.x)
	if w3p:
		if b.grounded and b.groundTag != "" and b.pos.y > -0.5 and W3.walkable(b.pos.x, b.pos.z, 0.8):
			lastSafe = b.pos
		gliding = owner.up.glider > 0 and not b.grounded and b.vel.y < -2.6
		if gliding:
			b.vel.y = -2.6
		if owner.up.glider > 0 and b.pos.y < -6 and lastSafe != null:
			b.pos = Vector3(lastSafe.x, lastSafe.y + 0.6, lastSafe.z); b.vel = Vector3.ZERO; gliding = false
			UI.toast("🪂 پاراگلایدر نجاتت داد!", "good")
	else:
		gliding = false
	var airJumps := 0
	if isPlayer:
		if w3p and owner.up.cloudJump > 0:
			airJumps = 2
		elif Phys.in_w5(b.pos.x) and owner.up.jetpack > 0:
			airJumps = 3
		elif owner.up.jump > 0:
			airJumps = 1
	slapCd = maxf(0.0, slapCd - dt)
	if jumpQ > 0:
		jumpQ -= dt
		if coyote > 0 and not stunned:
			b.vel.y = 10.2; coyote = 0; jumpQ = 0; b.grounded = false; jumpHeld = true
			if isPlayer:
				Sound.play("jump")
		elif isPlayer and dj < airJumps and not b.grounded and not jumpHeld and not stunned:
			b.vel.y = 9.6; dj += 1; jumpQ = 0
			Sound.play("djump"); Missions.event("djump")
			FX.burst(Vector3(b.pos.x, b.pos.y + 0.2, b.pos.z), {"count": 16, "color": ["#7af7ff", "#ffffff"], "speed": 3, "life": 0.5, "grav": 0})
	else:
		jumpHeld = false
	Phys.step_body(b, dt)
	if b.groundTag.begins_with("belt"):
		var B = Game.belt_of_tag(b.groundTag)
		b.pos.x += Game.belt_speed(B) * dt
		if b.pos.x > B.x1 - 0.5:
			b.pos.x = B.x1 - 0.5

func visual(dt: float, t: float) -> void:
	var b := body
	renderY = U.damp(renderY, b.pos.y, 22, dt) if (b.pos.y > renderY and b.grounded) else b.pos.y
	av.root.position = Vector3(b.pos.x, renderY + ((0.3 + sin(t * 3) * 0.04) if (isPlayer and Extras.riding) else 0.0), b.pos.z)
	var sp := Vector2(b.vel.x, b.vel.z).length()
	if sp > 0.4 and not stunned:
		var ty := atan2(b.vel.x, b.vel.z)
		var d := U.ang_diff(yaw, ty)
		var ny := yaw + d * (1 - exp(-14 * dt))
		turn = U.damp(turn, (ny - yaw) / maxf(dt, 1e-3), 10, dt)
		yaw = ny
	else:
		turn = U.damp(turn, 0.0, 10, dt)
	av.root.rotation.y = yaw
	if b.landed > 0:
		av.squash = minf(1.0, b.landed * 1.4); b.landed = 0
		if isPlayer:
			Sound.play("land")
	if stunT > 0:
		stunT -= dt
		if randf() < 0.3:
			FX.one(b.pos.x + cos(t * 8) * 0.5, b.pos.y + 2.3, b.pos.z + sin(t * 8) * 0.5, {"vx": 0, "vy": 0, "vz": 0, "life": 0.4, "size": 0.25, "color": "#ffd23f"})
	zapT = maxf(0.0, zapT - dt)
	receiveT = maxf(0.0, receiveT - dt)
	slapT = maxf(0.0, slapT - dt)
	av.animate(dt, {"speed": sp, "grounded": b.grounded, "carrying": carrying != null, "turn": turn, "t": t, "stunned": stunned, "receive": receiveT > 0, "slap": slapT, "ride": isPlayer and Extras.riding})
	if drilling != null:
		av.armR.rotation = Vector3(-1.5, 0, 0); av.armL.rotation = Vector3(-1.25, 0, 0.32); av.body.position.x = sin(t * 95) * 0.012; av.head.rotation.y = 0
	if label:
		label.visible = U.dist2(b.pos, Game.cam_pos) < 1800
