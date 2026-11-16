#!/usr/bin/env python3
from pathlib import Path

parts = []
for i in range(4):
    p = Path(f"scripts/app_parts/part_{i}.txt")
    if not p.exists():
        raise SystemExit(f"missing {p}")
    parts.append(p.read_text(encoding="utf-8"))
text = "".join(parts)
if "PLACEHOLDER" in text or "CampaignTimerChip" not in text or len(text) < 50000:
    raise SystemExit(f"bad assemble len={len(text)}")
Path("src/routes/app.tsx").write_text(text, encoding="utf-8")
print("assembled app.tsx", len(text))
