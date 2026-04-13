from flask import Blueprint, jsonify, request

from services.llm_router import llm_router


model_bp = Blueprint("model", __name__)


@model_bp.post("/api/model")
def set_model():
    data = request.get_json(silent=True) or {}
    model_name = (data.get("model") or "").strip()
    if not model_name:
        return jsonify({"error": "Missing required field: model"}), 400
    result = llm_router.set_model(model_name)
    return jsonify(result)
