#!/usr/bin/env python3
"""Only fix send delays to true wall-clock seconds. Do NOT add recipient_rejected handlers."""
import re
from pathlib import Path

app = Path("src/routes/app.tsx")
code = app.read_text(encoding="utf-8")
orig = code

print("--- Real wall-clock delays only ---")

# Remove recipient_rejected campaign handler if present (user rejected this feature)
if 'result.reason === "recipient_rejected"' in code:
    code2, n = re.subn(
        r"\n\s*if \(result\.reason === \"recipient_rejected\"\) \{[\s\S]*?return;\n\s*\}",
        "\n",
        code,
        count=2,
    )
    if n:
        code = code2
        print(f"Removed recipient_rejected handler ({n})")
    else:
        print("WARN: recipient_rejected present but pattern missed")

# Remove recipient_rejected from gmail.functions if we added it — leave reconnect/error as original where possible
gf = Path("src/lib/gmail.functions.ts")
if gf.exists():
    g = gf.read_text(encoding="utf-8")
    g0 = g
    # Strip dedicated 400 recipient_rejected block if present
    g2, n = re.subn(
        r"\n\s*if \(res\.status === 400\) \{[\s\S]*?return \{[\s\S]*?recipient_rejected[\s\S]*?\};\n\s*\}",
        "\n",
        g,
        count=1,
    )
    if n:
        g = g2
        print("Removed gmail 400 recipient_rejected block")
    # Remove from union type
    g = g.replace(' | "recipient_rejected"', "")
    g = g.replace('| "recipient_rejected"', "")
    if g != g0:
        gf.write_text(g, encoding="utf-8")
        print("gmail.functions.ts cleaned")

# --- Delay fixes ---
# 1) setTimeout(waitThen, delay) when delay is seconds
code2, n = re.subn(
    r"setTimeout\(\s*waitThen\s*,\s*delay\s*\)",
    "setTimeout(waitThen, Math.max(0, Math.round(Number(delay) * 1000)))",
    code,
)
if n:
    code = code2
    print(f"Fixed setTimeout(waitThen, delay) x{n}")

code2, n = re.subn(
    r"setTimeout\(\s*\(\)\s*=>\s*waitThen\(\)\s*,\s*delay\s*\)",
    "setTimeout(() => waitThen(), Math.max(0, Math.round(Number(delay) * 1000)))",
    code,
)
if n:
    code = code2
    print(f"Fixed setTimeout(() => waitThen(), delay) x{n}")

# 2) Ensure remaining uses full seconds * 1000 from startedAt
# Replace weak remaining formulas
def fix_remaining(m):
    return "const remaining = Math.max(0, Math.round(Number(delay) * 1000 - (performance.now() - startedAt)));"

code2, n = re.subn(
    r"const remaining = Math\.max\(0,\s*[^;]+\);",
    fix_remaining,
    code,
    count=8,
)
if n:
    code = code2
    print(f"Normalized remaining wall-clock calc x{n}")

# 3) If waitThen uses sleep without *1000
code2, n = re.subn(
    r"await sleep\(\s*delay\s*\)",
    "await sleep(Math.max(0, Math.round(Number(delay) * 1000)))",
    code,
)
if n:
    code = code2
    print(f"Fixed await sleep(delay) x{n}")

code2, n = re.subn(
    r"await sleepMs\(\s*delay\s*\)",
    "await sleepMs(Math.max(0, Math.round(Number(delay) * 1000)))",
    code,
)
if n:
    code = code2
    print(f"Fixed await sleepMs(delay) x{n}")

# 4) Add comment marker for clarity near delay selector if we can find [3, 4, 5
if "WALL_CLOCK_DELAY" not in code and re.search(r"\[3,\s*4,\s*5", code):
    code = code.replace(
        "[3, 4, 5",
        "/* WALL_CLOCK_DELAY: values are seconds; wait uses *1000 ms */ [3, 4, 5",
        1,
    )
    print("Marked delay array")

if code != orig:
    app.write_text(code, encoding="utf-8")
    print("app.tsx updated")
else:
    print("app.tsx no structural delay change (may already be correct)")

print("Done: NO recipient_rejected feature; delays only")
