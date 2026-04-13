from __future__ import annotations

import json
import time
from typing import Generator

from config import Config


def sse_message(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def stream_tokens(text: str) -> Generator[str, None, None]:
    last_heartbeat = time.monotonic()
    token_count = 0
    for token in text.split(" "):
        if time.monotonic() - last_heartbeat >= Config.SSE_HEARTBEAT_SECONDS:
            yield ": keep-alive\n\n"
            last_heartbeat = time.monotonic()
        token_count += 1
        yield sse_message({"token": token + " "})
    yield sse_message({"done": True, "token_count": token_count})
