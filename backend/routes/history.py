from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from flask import Blueprint, jsonify, request

from config import Config
from models.chat_model import ChatSession
from utils.helpers import read_json, write_json


history_bp = Blueprint("history", __name__)


def _load_history() -> dict:
    return read_json(Config.HISTORY_PATH, default={})


def _save_history(payload: dict) -> None:
    write_json(Config.HISTORY_PATH, payload)


@history_bp.get("/api/history")
def get_history():
    return jsonify(_load_history())


@history_bp.post("/api/history")
def save_history():
    data = request.get_json(silent=True) or {}
    chat_id = (data.get("id") or data.get("cid") or uuid4().hex[:12]).strip()
    existing = _load_history()
    current = existing.get(chat_id, {})
    session = ChatSession(
        id=chat_id,
        title=(data.get("title") or current.get("title") or "New Chat").strip(),
        pinned=bool(data.get("pinned", current.get("pinned", False))),
        created_at=current.get("created_at", datetime.now(timezone.utc).isoformat()),
        updated_at=datetime.now(timezone.utc).isoformat(),
        messages=data.get("messages", current.get("messages", [])),
    )
    existing[chat_id] = session.to_dict()
    _save_history(existing)
    return jsonify({"status": "saved", "id": chat_id, "chat": session.to_dict()})


@history_bp.delete("/api/history/<chat_id>")
def delete_history(chat_id: str):
    existing = _load_history()
    if chat_id in existing:
        del existing[chat_id]
        _save_history(existing)
    return jsonify({"status": "deleted", "id": chat_id})


@history_bp.post("/api/history/<chat_id>/rename")
def rename_history(chat_id: str):
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "Missing required field: title"}), 400
    existing = _load_history()
    chat = existing.get(chat_id)
    if not chat:
        return jsonify({"error": "Chat not found"}), 404
    chat["title"] = title
    chat["updated_at"] = datetime.now(timezone.utc).isoformat()
    _save_history(existing)
    return jsonify({"status": "renamed", "id": chat_id, "title": title})


@history_bp.post("/api/history/<chat_id>/pin")
def pin_history(chat_id: str):
    existing = _load_history()
    chat = existing.get(chat_id)
    if not chat:
        return jsonify({"error": "Chat not found"}), 404
    chat["pinned"] = not bool(chat.get("pinned", False))
    chat["updated_at"] = datetime.now(timezone.utc).isoformat()
    _save_history(existing)
    return jsonify({"status": "updated", "id": chat_id, "pinned": chat["pinned"]})
