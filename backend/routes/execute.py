from flask import Blueprint, jsonify, request

from services.execution_engine import execution_engine


execute_bp = Blueprint("execute", __name__)


@execute_bp.post("/api/execute")
def execute():
    data = request.get_json(silent=True) or {}
    code = (data.get("code") or "").strip()
    if not code:
        return jsonify({"error": "Missing required field: code"}), 400
    result = execution_engine.run_python(code)
    return jsonify(result), (200 if result.get("ok") else 400)
