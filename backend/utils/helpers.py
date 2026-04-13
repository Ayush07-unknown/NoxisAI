import json
import logging
import threading
from pathlib import Path
from typing import Any


_storage_lock = threading.RLock()


def get_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger
    logger.setLevel(logging.INFO)
    handler = logging.StreamHandler()
    formatter = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s - %(message)s"
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    return logger


def ensure_storage_path(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        path.write_text("{}", encoding="utf-8")


def read_json(path: Path, default: Any) -> Any:
    with _storage_lock:
        ensure_storage_path(path)
        try:
            raw = path.read_text(encoding="utf-8").strip()
            if not raw:
                return default
            return json.loads(raw)
        except json.JSONDecodeError:
            return default


def write_json(path: Path, payload: Any) -> None:
    with _storage_lock:
        ensure_storage_path(path)
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
