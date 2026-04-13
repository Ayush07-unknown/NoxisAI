from flask import Blueprint, jsonify

from services.memory_manager import memory_manager


memory_bp = Blueprint("memory", __name__)


@memory_bp.get("/api/memory")
def get_memory():
    messages = memory_manager.get_memory()
    return jsonify({"messages": messages, "count": len(messages)})


@memory_bp.delete("/api/memory")
def clear_memory():
    memory_manager.clear()
    return jsonify({"status": "cleared"})
