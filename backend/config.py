import os
from pathlib import Path

_BASE_DIR = Path(__file__).resolve().parent
try:
    from dotenv import load_dotenv

    load_dotenv(_BASE_DIR / ".env")
    load_dotenv(_BASE_DIR.parent / ".env")
except ImportError:
    pass


def _int_env(name: str, default: int, minimum: int, maximum: int) -> int:
    raw = os.getenv(name)
    if raw is None or str(raw).strip() == "":
        v = default
    else:
        try:
            v = int(str(raw).strip())
        except ValueError:
            v = default
    return max(minimum, min(maximum, v))


class Config:
    BASE_DIR = _BASE_DIR
    STORAGE_DIR = BASE_DIR / "storage"
    HISTORY_PATH = STORAGE_DIR / "history.json"
    MEMORY_PATH = STORAGE_DIR / "memory.json"

    FLASK_DEBUG = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    PORT = int(os.getenv("PORT", "5000"))

    SSE_HEARTBEAT_SECONDS = 10
    # Pygame / long snippets. Set in .env: EXECUTION_TIMEOUT_SECONDS=90  (clamped 5–120)
    EXECUTION_TIMEOUT_SECONDS = _int_env("EXECUTION_TIMEOUT_SECONDS", 60, 5, 120)
    MAX_HISTORY_ITEMS = 200
    MAX_MEMORY_ITEMS = 64
    RESPONSE_CACHE_SIZE = 128

    DEFAULT_MODEL = "Auto (Fallback Chain)"
    FAST_MODEL = "Groq / LLaMA 3.1 8B"
    CODE_MODEL = "Groq / LLaMA 3.3 70B"
    REASONING_MODEL = "OpenRouter / GPT-4o"
