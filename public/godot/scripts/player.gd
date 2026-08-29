extends CharacterBody3D
## On-foot body. F/E enter-exit. Space fire. Starts in the car.

var hp := 100
var ammo := 36
var in_car := true
var shoot_cd := 0.0
var enter_cd := 0.0
var yaw := 0.0

func _ready() -> void:
	var cap := MeshInstance3D.new()
	var mesh := CapsuleMesh.new()
	mesh.radius = 0.32
	mesh.height = 1.6
	cap.mesh = mesh
	cap.position.y = 0.2
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.81, 0.78, 0.72)
	cap.material_override = mat
	add_child(cap)
	var col := CollisionShape3D.new()
	var shape := CapsuleShape3D.new()
	shape.radius = 0.32
	shape.height = 1.6
	col.shape = shape
	add_child(col)


func walk(delta: float) -> void:
	visible = true
	shoot_cd = maxf(0.0, shoot_cd - delta)
	enter_cd = maxf(0.0, enter_cd - delta)
	var ax := 0.0
	var az := 0.0
	if Input.is_physical_key_pressed(KEY_D):
		ax += 1.0
	if Input.is_physical_key_pressed(KEY_A):
		ax -= 1.0
	if Input.is_physical_key_pressed(KEY_W):
		az += 1.0
	if Input.is_physical_key_pressed(KEY_S):
		az -= 1.0
	if Input.is_physical_key_pressed(KEY_LEFT):
		yaw += 1.8 * delta
	if Input.is_physical_key_pressed(KEY_RIGHT):
		yaw -= 1.8 * delta
	rotation.y = yaw
	var forward := Vector3(-sin(yaw), 0.0, -cos(yaw))
	var right := Vector3(cos(yaw), 0.0, -sin(yaw))
	var dir := forward * az + right * ax
	if dir.length() > 0.1:
		dir = dir.normalized()
		velocity = dir * 4.8
	else:
		velocity = Vector3.ZERO
	move_and_slide()
	global_position.y = 0.9
	global_position.x = clampf(global_position.x, -8.6, 8.6)


func shoot(enemies: Array) -> void:
	if in_car or shoot_cd > 0.0 or ammo <= 0:
		return
	shoot_cd = 0.16
	ammo -= 1
	var origin := global_position + Vector3(0, 0.7, 0)
	var forward := Vector3(-sin(yaw), 0.0, -cos(yaw))
	var best: Node3D = null
	var best_d := 42.0
	for e in enemies:
		if not e.get("alive"):
			continue
		var to: Vector3 = e.global_position - origin
		to.y = 0
		var d := to.length()
		if d > best_d:
			continue
		if forward.dot(to.normalized()) < 0.97:
			continue
		best_d = d
		best = e
	if best:
		best.call("hurt", 38)


func try_enter(car: Node3D) -> void:
	if enter_cd > 0.0:
		return
	enter_cd = 0.35
	if in_car:
		in_car = false
		visible = true
		var right := Vector3(cos(car.rotation.y), 0, -sin(car.rotation.y))
		global_position = car.global_position + right * 1.8
		yaw = car.rotation.y
		rotation.y = yaw
	else:
		if global_position.distance_to(car.global_position) < 4.2:
			in_car = true
			visible = false
			yaw = car.rotation.y
