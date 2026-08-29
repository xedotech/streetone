extends CharacterBody3D

var hp := 70
var alive := true
var cooldown := 0.6
var patrol_dir := 1.0

func _ready() -> void:
	patrol_dir = 1.0 if global_position.x > 0.0 else -1.0
	var cap := MeshInstance3D.new()
	var mesh := CapsuleMesh.new()
	mesh.radius = 0.3
	mesh.height = 1.5
	cap.mesh = mesh
	cap.position.y = 0.2
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.16, 0.19, 0.22)
	cap.material_override = mat
	add_child(cap)
	var col := CollisionShape3D.new()
	var shape := CapsuleShape3D.new()
	shape.radius = 0.3
	shape.height = 1.5
	col.shape = shape
	add_child(col)


func think(delta: float, player: Node3D) -> void:
	if not alive:
		return
	cooldown = maxf(0.0, cooldown - delta)
	var to: Vector3 = player.global_position - global_position
	to.y = 0
	var dist := to.length()
	if dist < 34.0:
		look_at(player.global_position, Vector3.UP)
		if dist > 11.0:
			velocity = to.normalized() * 3.4
			move_and_slide()
		elif cooldown <= 0.0:
			cooldown = 0.85
			player.set("hp", int(player.get("hp")) - 9)
	else:
		velocity = Vector3(0, 0, patrol_dir * 1.6)
		move_and_slide()
		if global_position.z > 90.0 or global_position.z < -90.0:
			patrol_dir *= -1.0
	global_position.y = 0.9


func hurt(amount: int) -> void:
	if not alive:
		return
	hp -= amount
	if hp <= 0:
		alive = false
		visible = false
		collision_layer = 0
		collision_mask = 0
