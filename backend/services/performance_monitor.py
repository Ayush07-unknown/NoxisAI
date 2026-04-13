from collections import OrderedDict
from threading import RLock
from time import perf_counter
from typing import Any


class Metrics:
    def __init__(self) -> None:
        self._lock = RLock()
        self._latencies_ms: list[float] = []

    def record_latency(self, latency_ms: float) -> None:
        with self._lock:
            self._latencies_ms.append(latency_ms)
            if len(self._latencies_ms) > 1000:
                self._latencies_ms = self._latencies_ms[-500:]

    def snapshot(self) -> dict[str, float]:
        with self._lock:
            if not self._latencies_ms:
                return {"avg_ms": 0.0, "p95_ms": 0.0}
            data = sorted(self._latencies_ms)
            avg = sum(data) / len(data)
            p95_idx = int(0.95 * (len(data) - 1))
            return {"avg_ms": round(avg, 2), "p95_ms": round(data[p95_idx], 2)}


class LRUResponseCache:
    def __init__(self, max_size: int = 128) -> None:
        self.max_size = max_size
        self._store: OrderedDict[str, Any] = OrderedDict()
        self._lock = RLock()

    def get(self, key: str) -> Any:
        with self._lock:
            if key not in self._store:
                return None
            value = self._store.pop(key)
            self._store[key] = value
            return value

    def set(self, key: str, value: Any) -> None:
        with self._lock:
            if key in self._store:
                self._store.pop(key)
            elif len(self._store) >= self.max_size:
                self._store.popitem(last=False)
            self._store[key] = value


def timed_call(func, *args, **kwargs):
    start = perf_counter()
    result = func(*args, **kwargs)
    elapsed_ms = (perf_counter() - start) * 1000.0
    return result, elapsed_ms
