## Player settings (autoload "S"), persisted to user://settings.json.
extends Node

const PATH := "user://memeThief3D.settings.json"

var quality := "high"
var sens := 1.0
var deadzone := 0.12
var music := true
var sfx := true
var volume := 0.7
var fps := false
var minimap := true
var invertY := false
var zoom := 7.5
var btnOpacity := 0.78
var touch := "auto"
var firstPerson := false
var mouseLock := true

var IS_TOUCH := false
const KEYS := ["quality", "sens", "deadzone", "music", "sfx", "volume", "fps", "minimap", "invertY", "zoom", "btnOpacity", "touch", "firstPerson", "mouseLock"]

func _ready() -> void:
	IS_TOUCH = DisplayServer.is_touchscreen_available() or OS.has_feature("mobile")
	if IS_TOUCH:
		quality = "medium"
	load_settings()

func load_settings() -> void:
	if not FileAccess.file_exists(PATH):
		return
	var f := FileAccess.open(PATH, FileAccess.READ)
	if f == null:
		return
	var raw = JSON.parse_string(f.get_as_text())
	if raw is Dictionary:
		for k in KEYS:
			if raw.has(k) and typeof(raw[k]) == typeof(get(k)) or (raw.has(k) and (raw[k] is float) and (get(k) is float)):
				set(k, raw[k])
	if not ["low", "medium", "high"].has(quality):
		quality = "medium"
	sens = clampf(sens, 0.2, 2.5); deadzone = clampf(deadzone, 0.0, 0.45); zoom = clampf(zoom, 3.0, 14.0); volume = clampf(volume, 0.0, 1.0); btnOpacity = clampf(btnOpacity, 0.3, 1.0)

func save_settings() -> void:
	var d := {}
	for k in KEYS:
		d[k] = get(k)
	var f := FileAccess.open(PATH, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(d))

## quality presets
func Q() -> Dictionary:
	match quality:
		"low":
			return {"shadows": false, "particles": 260, "plateDist": 20.0, "unitDist": 55.0, "decor": false, "lights": 0}
		"medium":
			return {"shadows": true, "particles": 520, "plateDist": 30.0, "unitDist": 85.0, "decor": true, "lights": 1}
		_:
			return {"shadows": true, "particles": 900, "plateDist": 42.0, "unitDist": 140.0, "decor": true, "lights": 2}
