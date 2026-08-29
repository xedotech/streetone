extends CanvasLayer

var label: Label

func _ready() -> void:
	label = Label.new()
	label.position = Vector2(24, 20)
	label.add_theme_font_size_override("font_size", 18)
	add_child(label)


func bind(data: Dictionary) -> void:
	if data["outcome"] != "play":
		label.text = "STREET ONE\n%s\nR to restart" % ("THE BLOCK IS YOURS" if data["outcome"] == "win" else "YOU DROPPED")
		return
	var mode := "DRIVING" if data["in_car"] else "ON FOOT"
	label.text = "STREET ONE  ·  %s\nHP %d   AMMO %d   LIVE %d/%d\nW throttle  S brake  A left  D right  F enter/exit  Space fire" % [
		mode, data["hp"], data["ammo"], data["live"], data["total"]
	]
