extends CharacterBody3D
## Arcade sedan. A = left ( +yaw ), D = right ( -yaw ) from chase cam.
## Basis: forward = (-sin(yaw), 0, -cos(yaw))

var speed := 0.0
var yaw := 0.0

func _ready() -> void:
	var vis := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = Vector3(1.85, 0.7, 4.15)
	vis.mesh = box
	vis.position.y = 0.2
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.7, 0.23, 0.17)
	vis.material_override = mat
	add_child(vis)
	var cabin := MeshInstance3D.new()
	var cbox := BoxMesh.new()
	cbox.size = Vector3(1.6, 0.5, 2.0)
	cabin.mesh = cbox
	cabin.position = Vector3(0, 0.7, -0.15)
	add_child(cabin)
	var col := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = Vector3(1.85, 0.8, 4.15)
	col.shape = shape
	add_child(col)


func drive(delta: float) -> void:
	var throttle := 0.0
	if Input.is_physical_key_pressed(KEY_W) or Input.is_physical_key_pressed(KEY_UP):
		throttle += 1.0
	if Input.is_physical_key_pressed(KEY_S) or Input.is_physical_key_pressed(KEY_DOWN):
		throttle -= 1.0
	var steer := 0.0
	if Input.is_physical_key_pressed(KEY_A) or Input.is_physical_key_pressed(KEY_LEFT):
		steer += 1.0  # left → +yaw
	if Input.is_physical_key_pressed(KEY_D) or Input.is_physical_key_pressed(KEY_RIGHT):
		steer -= 1.0  # right → -yaw

	if throttle > 0.0:
		speed += 18.0 * throttle * delta
	elif throttle < 0.0:
		if speed > 0.4:
			speed += 26.0 * throttle * delta
		else:
			speed += 10.0 * throttle * delta
	else:
		speed *= pow(0.22, delta)
	speed = clampf(speed, -9.0, 24.0)

	var speed_factor := clampf(absf(speed) / 7.5, 0.0, 1.0)
	var reverse := 1.0 if speed >= 0.0 else -1.0
	yaw += steer * 2.35 * speed_factor * reverse * delta
	rotation.y = yaw
	var forward := Vector3(-sin(yaw), 0.0, -cos(yaw))
	velocity = forward * speed
	move_and_slide()
	# Keep on the street plane
	global_position.y = 0.4
	global_position.x = clampf(global_position.x, -8.6, 8.6)
	global_position.z = clampf(global_position.z, -106.0, 106.0)
