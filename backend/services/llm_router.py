from __future__ import annotations

import importlib
import sys
from pathlib import Path
from threading import RLock
from typing import Any

from config import Config
from services.performance_monitor import LRUResponseCache, Metrics, timed_call
from utils.helpers import get_logger


logger = get_logger("llm_router")


class LLMRouter:
    def __init__(self) -> None:
        self._lock = RLock()
        self._brain = self._load_brain()
        self._model = Config.DEFAULT_MODEL
        self._cache = LRUResponseCache(Config.RESPONSE_CACHE_SIZE)
        self._metrics = Metrics()

    def _load_brain(self):
        try:
            project_root = Path(__file__).resolve().parents[2]
            if str(project_root) not in sys.path:
                sys.path.insert(0, str(project_root))
            return importlib.import_module("Noxis")
        except Exception as exc:
            logger.exception("Failed to import Noxis.py: %s", exc)
            return None

    def classify_request(self, user_message: str) -> str:
        text = (user_message or "").lower()
        coding_keywords = ["code", "bug", "python", "javascript", "api", "class", "function"]
        fast_keywords = ["quick", "short", "fast", "brief", "summarize"]
        reasoning_keywords = ["reason", "analyze", "compare", "tradeoff", "deep"]
        if any(k in text for k in coding_keywords):
            return "coding"
        if any(k in text for k in fast_keywords):
            return "fast/simple"
        if any(k in text for k in reasoning_keywords):
            return "reasoning"
        return "general chat"

    def _choose_model(self, request_type: str) -> str:
        if self._model != Config.DEFAULT_MODEL:
            return self._model
        if request_type == "coding":
            return Config.CODE_MODEL
        if request_type == "fast/simple":
            return Config.FAST_MODEL
        if request_type == "reasoning":
            return Config.REASONING_MODEL
        return Config.DEFAULT_MODEL

    def set_model(self, model_name: str) -> dict[str, str]:
        with self._lock:
            self._model = model_name or Config.DEFAULT_MODEL
            if self._brain and hasattr(self._brain, "set_model"):
                self._brain.set_model(self._model)
            return {"status": "ok", "model": self._model}

    def get_model(self) -> str:
        return self._model

    def _brain_infer(self, prompt: str, model_name: str) -> str:
        if not self._brain:
            raise RuntimeError("Brain module unavailable: Noxis.py import failed")
        if hasattr(self._brain, "set_model"):
            self._brain.set_model(model_name)
        if hasattr(self._brain, "process_text_query"):
            return self._brain.process_text_query(prompt)
        raise RuntimeError("Brain module missing process_text_query")

    def generate(self, user_message: str, context: list[dict[str, Any]] | None = None) -> dict[str, Any]:
        request_type = self.classify_request(user_message)
        selected_model = self._choose_model(request_type)
        cache_key = f"{selected_model}::{user_message.strip()}"
        cached = self._cache.get(cache_key)
        if cached:
            return {**cached, "cached": True}

        response_text, latency_ms = timed_call(self._brain_infer, user_message, selected_model)
        self._metrics.record_latency(latency_ms)
        payload = {
            "request_type": request_type,
            "model": selected_model,
            "response": response_text,
            "latency_ms": round(latency_ms, 2),
            "cached": False,
        }
        self._cache.set(cache_key, payload)
        return payload

    def metrics(self) -> dict[str, float]:
        return self._metrics.snapshot()


llm_router = LLMRouter()
