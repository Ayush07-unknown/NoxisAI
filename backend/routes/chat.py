from __future__ import annotations

from flask import Blueprint, Response, jsonify, request, stream_with_context

from services.llm_router import llm_router
from services.memory_manager import memory_manager
from services.streaming import sse_message, stream_tokens


chat_bp = Blueprint("chat", __name__)


@chat_bp.post("/api/chat/stream")
def stream_chat():
    payload = request.get_json(silent=True) or {}
    message = (payload.get("message") or "").strip()
    if not message:
        return jsonify({"error": "Missing required field: message"}), 400

    def event_stream():
        try:
            memory_manager.append("user", message)
            result = llm_router.generate(message, context=memory_manager.get_memory())
            reply = result["response"]
            for chunk in stream_tokens(reply):
                yield chunk
            memory_manager.append("assistant", reply)
            yield sse_message(
                {
                    "done": True,
                    "model": result["model"],
                    "request_type": result["request_type"],
                    "latency_ms": result["latency_ms"],
                    "cached": result["cached"],
                    "reply": reply,
                }
            )
        except GeneratorExit:
            return
        except Exception as exc:
            yield sse_message({"error": str(exc), "done": True})

    return Response(
        stream_with_context(event_stream()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
