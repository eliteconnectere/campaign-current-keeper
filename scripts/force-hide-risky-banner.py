#!/usr/bin/env python3
import re
from pathlib import Path

p = Path("src/routes/app.tsx")
t = p.read_text(encoding="utf-8")
o = t

# Any JSX block that contains both Open Vault and Send Standard
for pat in [
    re.compile(r"\{[^{}]*Open Vault[\s\S]{0,2500}?Send Standard[\s\S]{0,800}?\}\)", re.M),
    re.compile(r"\{[^{}]*Send Standard[\s\S]{0,2500}?Open Vault[\s\S]{0,800}?\}\)", re.M),
    re.compile(r"\{counts\.risky > 0 && \([\s\S]*?\)\}\)", re.M),
    re.compile(r"\{\(counts\.risky > 0 \|\| quarantineVault\.length > 0\) && \([\s\S]*?\)\}\)", re.M),
]:
    t2, n = pat.subn("", t)
    if n:
        print(f"removed {n} block(s) with pattern")
        t = t2

# Line-level scrub if strings remain
if "Open Vault" in t or "Send Standard" in t:
    lines = t.splitlines(keepends=True)
    out = []
    skip = 0
    for i, line in enumerate(lines):
        if skip > 0:
            skip -= 1
            continue
        if "Open Vault" in line or ("Send Standard" in line and "sendRiskyViaStandard" not in line):
            # drop surrounding ~15 lines of a banner container
            print("scrub line", i + 1, line.strip()[:80])
            # backtrack open of conditional
            continue
        out.append(line)
    t2 = "".join(out)
    # More surgical: delete from "saved safely in Vault" marker through next closing )}
    t2 = re.sub(
        r"[\s\S]{0,200}saved safely in Vault[\s\S]{0,1200}?\)\}",
        "",
        t2,
        count=3,
    )
    t = t2
    print("scrubbed remaining Open Vault / saved safely strings")

# Remove function sendRiskyViaStandard if only used by banner (keep if still referenced)
if "Open Vault" not in t and "Send Standard" not in t:
    print("banner UI strings gone")
else:
    print("WARN still contains:", "Open Vault" in t, "Send Standard" in t)

if t != o:
    p.write_text(t, encoding="utf-8")
    print("wrote app.tsx")
else:
    print("no change")
