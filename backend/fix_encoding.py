from __future__ import annotations

from pathlib import Path


def convert_to_utf8(path: Path) -> bool:
    raw = path.read_bytes()
    is_utf16_like = raw.startswith(b"\xff\xfe") or raw.startswith(b"\xfe\xff") or b"\x00" in raw
    if not is_utf16_like:
        return False

    try:
        text = raw.decode("utf-16")
    except UnicodeDecodeError:
        text = raw.decode("utf-16-le", errors="ignore")

    path.write_text(text, encoding="utf-8", newline="\n")
    return True


def main() -> None:
    base = Path(__file__).resolve().parent
    targets = list(base.rglob("*.py"))
    changed: list[Path] = []
    for file_path in targets:
        if convert_to_utf8(file_path):
            changed.append(file_path)

    print(f"Scanned {len(targets)} Python files.")
    print(f"Converted {len(changed)} file(s) to UTF-8.")
    for path in changed:
        print(f"- {path}")


if __name__ == "__main__":
    main()
