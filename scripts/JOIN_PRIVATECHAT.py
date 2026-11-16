#!/usr/bin/env python3
from pathlib import Path
parts = sorted(Path("scripts/pc_chunks").glob("part_*.txt"))
text = "".join(p.read_text() for p in parts)
Path("src/features/chat/PrivateChat.tsx").write_text(text)
print("restored", len(text), "from", len(parts), "parts")
assert "PLACEHOLDER" not in text
assert "export function PrivateChat" in text
