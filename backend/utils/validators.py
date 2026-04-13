from flask import jsonify


def require_json_field(data: dict, field_name: str) -> tuple[bool, object]:
    value = data.get(field_name)
    if isinstance(value, str):
        value = value.strip()
    if value in (None, ""):
        return False, jsonify({"error": f"Missing required field: {field_name}"}), 400
    return True, value
