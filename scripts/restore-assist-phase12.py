#!/usr/bin/env python3
from pathlib import Path
import base64
root = Path(__file__).resolve().parents[1]
parts_dir = root / "scripts" / "assist_b64_parts"
out = root / "src" / "lib" / "assist.functions.ts"
chunks = sorted(parts_dir.glob("part*.b64"))
if not chunks:
    raise SystemExit("No base64 parts found")
b64 = "".join(p.read_text().strip() for p in chunks)
data = base64.b64decode(b64)
out.write_bytes(data)
print(f"Restored {out} ({len(data)} bytes)")
