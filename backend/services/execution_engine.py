from __future__ import annotations

import importlib
import io
import multiprocessing as mp
import traceback
from contextlib import redirect_stdout

from config import Config

# Stdlib + explicitly allowed third-party roots (no os/sys/subprocess/socket/pathlib, etc.).
_ALLOWED_IMPORT_ROOTS = frozenset(
    {
        "math",
        "json",
        "random",
        "datetime",
        "re",
        "itertools",
        "functools",
        "collections",
        "decimal",
        "fractions",
        "statistics",
        "copy",
        "string",
        "uuid",
        "hashlib",
        "base64",
        "textwrap",
        "operator",
        "enum",
        "heapq",
        "bisect",
        "array",
        "calendar",
        "pprint",
        "typing",
        # Pygame / many tutorials use sys (e.g. exit loop). Still no os/subprocess/socket.
        "sys",
        # Third-party (user snippets / games); may need a display or SDL_VIDEODRIVER=dummy on servers.
        "pygame",
    }
)


def _restricted_import(
    name: str,
    globals=None,
    locals=None,
    fromlist=(),
    level: int = 0,
):
    if level != 0:
        raise ImportError("relative imports are not allowed in the sandbox")
    root = name.partition(".")[0]
    if root not in _ALLOWED_IMPORT_ROOTS:
        allowed = ", ".join(sorted(_ALLOWED_IMPORT_ROOTS))
        raise ImportError(
            f"module '{root}' is not allowed in the sandbox. Allowed: {allowed}"
        )
    return importlib.import_module(name)


SAFE_BUILTINS = {
    "__import__": _restricted_import,
    "abs": abs,
    "all": all,
    "any": any,
    "bool": bool,
    "dict": dict,
    "enumerate": enumerate,
    "float": float,
    "int": int,
    "len": len,
    "list": list,
    "max": max,
    "min": min,
    "pow": pow,
    "print": print,
    "range": range,
    "round": round,
    "str": str,
    "sum": sum,
    "tuple": tuple,
    "zip": zip,
    "isinstance": isinstance,
    "issubclass": issubclass,
    "sorted": sorted,
    "reversed": reversed,
    "set": set,
    "frozenset": frozenset,
}


def _execute_worker(code: str, out_q: mp.Queue) -> None:
    stdout = io.StringIO()
    # One namespace for globals and locals: if they differ, exec() behaves like a class body and
    # list/dict/set comprehensions won't see assignments from earlier lines (NameError on BOARD_COLS, etc.).
    safe_ns: dict = {"__builtins__": SAFE_BUILTINS}
    try:
        with redirect_stdout(stdout):
            exec(code, safe_ns, safe_ns)
        out_q.put({"ok": True, "output": stdout.getvalue(), "error": ""})
    except Exception:
        out_q.put({"ok": False, "output": stdout.getvalue(), "error": traceback.format_exc()})


class ExecutionEngine:
    def run_python(self, code: str) -> dict:
        queue: mp.Queue = mp.Queue()
        process = mp.Process(target=_execute_worker, args=(code, queue), daemon=True)
        process.start()
        process.join(timeout=Config.EXECUTION_TIMEOUT_SECONDS)

        if process.is_alive():
            process.terminate()
            process.join(1)
            return {
                "ok": False,
                "output": "",
                "error": f"Execution timed out after {Config.EXECUTION_TIMEOUT_SECONDS}s",
            }

        if queue.empty():
            return {"ok": False, "output": "", "error": "Execution failed with no output"}
        return queue.get()


execution_engine = ExecutionEngine()
