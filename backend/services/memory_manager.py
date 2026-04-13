from __future__ import annotations

from threading import RLock
from typing import Any

from config import Config
from utils.helpers import read_json, write_json


class MemoryManager:
    def __init__(self) -> None:
        self._lock = RLock()
        self._path = Config.MEMORY_PATH

    def get_memory(self) -> list[dict[str, Any]]:
        data = read_json(self._path, default={"messages": []})
        messages = data.get("messages", [])
        if not isinstance(messages, list):
            return []
        return messages[-Config.MAX_MEMORY_ITEMS :]

    def append(self, role: str, content: str) -> None:
        with self._lock:
            data = read_json(self._path, default={"messages": []})
            messages = data.get("messages", [])
            if not isinstance(messages, list):
                messages = []
            messages.append({"role": role, "content": content})
            data["messages"] = messages[-Config.MAX_MEMORY_ITEMS :]
            write_json(self._path, data)

    def clear(self) -> None:
        with self._lock:
            write_json(self._path, {"messages": []})


memory_manager = MemoryManager()
