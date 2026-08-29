extends Node3D
## Street One — one night street, arcade car, on-foot shoot vs simple AI.
## Canonical Godot 4 source. Matches the browser demo loop.

const CarScript := preload("res://scripts/car.gd")
const PlayerScript := preload("res://scripts/player.gd")
const EnemyScript := preload("res://scripts/enemy.gd")

const STREET_HALF := 7.0
const MAP_Z := 108.0

var player: CharacterBody3D
var car: CharacterBody3D
var enemies: Array[CharacterBody3D] = []
var outcome := "play"
var camera: Camera3D

func _ready() -> void:
	_build_world()
	_spawn_car()
	_spawn_player()
	_spawn_enemies()
	camera = Camera3D.new()
	camera.fov = 68
	add_child(camera)
	_update_camera(1.0)


func _physics_process(delta: float) -> void:
	if outcome != "play":
		if Input.is_physical_key_pressed(KEY_R):
			get_tree().reload_current_scene()
		return
	var in_car: bool = player.get("in_car")
	if in_car:
		car.call("drive", delta)
		player.global_position = car.global_position + Vector3(0, 0.2, 0)
		player.rotation.y = car.rotation.y
	else:
		player.call("walk", delta)
		if Input.is_physical_key_pressed(KEY_SPACE):
			player.call("shoot", enemies)
	if Input.is_physical_key_pressed(KEY_F) or Input.is_physical_key_pressed(KEY_E):
		player.call("try_enter", car)
	for e in enemies:
		if e.get("alive"):
			e.call("think", delta, player)
	_update_camera(delta)
	var live := 0
	for e in enemies:
		if e.get("alive"):
			live += 1
	if live == 0:
		outcome = "win"
	if int(player.get("hp")) <= 0:
		outcome = "lose"
	var hud := get_node_or_null("HUD")
	if hud:
		hud.call("bind", {
			"hp": player.get("hp"),
			"ammo": player.get("ammo"),
			"in_car": player.get("in_car"),
			"speed": absf(car.get("speed")),
			"live": live,
			"total": enemies.size(),
			"outcome": outcome,
		})


func _update_camera(delta: float) -> void:
	var yaw: float = player.rotation.y
	var dist := 7.4 if player.get("in_car") else 4.6
	var height := 2.7 if player.get("in_car") else 2.15
	var forward := Vector3(-sin(yaw), 0.0, -cos(yaw))
	var origin: Vector3 = player.global_position
	var desired := origin - forward * dist + Vector3(0, height, 0)
	camera.global_position = camera.global_position.lerp(desired, clampf(delta * 8.0, 0.0, 1.0))
	camera.look_at(origin + Vector3(0, 1.2, 0), Vector3.UP)


func _mesh_box(size: Vector3, pos: Vector3, color: Color, collide := true) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = size
	mi.mesh = box
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mi.material_override = mat
	mi.position = pos
	add_child(mi)
	if collide:
		var body := StaticBody3D.new()
		var shape := CollisionShape3D.new()
		var box_shape := BoxShape3D.new()
		box_shape.size = size
		shape.shape = box_shape
		body.add_child(shape)
		mi.add_child(body)
	return mi


func _build_world() -> void:
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-50, 30, 0)
	sun.light_energy = 0.45
	sun.shadow_enabled = true
	add_child(sun)
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color(0.04, 0.04, 0.06)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(0.35, 0.4, 0.5)
	e.ambient_light_energy = 0.4
	e.fog_enabled = true
	e.fog_light_color = Color(0.04, 0.04, 0.06)
	e.fog_density = 0.012
	env.environment = e
	add_child(env)

	_mesh_box(Vector3(56, 0.1, MAP_Z * 2 + 16), Vector3(0, -0.05, 0), Color(0.1, 0.1, 0.12))
	_mesh_box(Vector3(STREET_HALF * 2, 0.08, MAP_Z * 2), Vector3(0, 0.02, 0), Color(0.08, 0.08, 0.09), false)
	_mesh_box(Vector3(5.4, 0.18, MAP_Z * 2), Vector3(-(STREET_HALF + 3.4), 0.1, 0), Color(0.16, 0.16, 0.15))
	_mesh_box(Vector3(5.4, 0.18, MAP_Z * 2), Vector3(STREET_HALF + 3.4, 0.1, 0), Color(0.16, 0.16, 0.15))

	var zc := -MAP_Z + 6.0
	var i := 0
	while zc < MAP_Z - 6.0:
		var depth := 10.0 + float(i % 4) * 3.5
		var height := 9.0 + float((i * 5) % 16)
		var width := 10.0 + float(i % 3) * 1.4
		var pal := [Color(0.17, 0.15, 0.13), Color(0.14, 0.16, 0.17), Color(0.2, 0.16, 0.13)]
		_mesh_box(Vector3(width, height, depth), Vector3(-(STREET_HALF + 8.4), height * 0.5, zc + depth * 0.5), pal[i % 3])
		_mesh_box(Vector3(width + 0.6, height + 2.0, depth - 1.0), Vector3(STREET_HALF + 8.4, (height + 2.0) * 0.5, zc + depth * 0.5), pal[(i + 1) % 3])
		var gap := 4.5 if i % 5 == 0 else 1.1
		zc += depth + gap
		i += 1

	var z := -90.0
	while z <= 90.0:
		for side in [-1.0, 1.0]:
			var lamp := OmniLight3D.new()
			lamp.position = Vector3(side * (STREET_HALF + 2.1), 5.0, z)
			lamp.light_color = Color(1.0, 0.76, 0.48)
			lamp.light_energy = 1.6
			lamp.omni_range = 14.0
			add_child(lamp)
		z += 22.0


func _spawn_car() -> void:
	car = CarScript.new()
	car.position = Vector3(0, 0.4, 72)
	add_child(car)


func _spawn_player() -> void:
	player = PlayerScript.new()
	player.position = Vector3(0, 0.9, 72)
	player.set("in_car", true)
	add_child(player)


func _spawn_enemies() -> void:
	var spots := [
		Vector3(-5.2, 0, 50), Vector3(5.3, 0, 34), Vector3(-5.1, 0, 8),
		Vector3(5.4, 0, -18), Vector3(-5.2, 0, -62), Vector3(5.3, 0, -86),
	]
	for p in spots:
		var e: CharacterBody3D = EnemyScript.new()
		e.position = p
		add_child(e)
		enemies.append(e)
