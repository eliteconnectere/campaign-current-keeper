#!/usr/bin/env python3
"""Remove EC_AUTO_RESUME useEffect placed AFTER early return — causes React minified error #310."""
from pathlib import Path
import re

app = Path("src/routes/app.tsx")
t = app.read_text()

# Exact block that violates Rules of Hooks (after "Checking your account" return)
pattern = re.compile(
    r"\n  /\*\* When campaign\.rex_monitored, workspace pause/stop must be disabled — Studio only\. \*/\n  const REX_MONITOR_LOCK = true;\n\n  // EC_AUTO_RESUME_ENGINE:.*?\}, \[engine, signedIn\]\);\n",
    re.DOTALL,
)

if pattern.search(t):
    t2 = pattern.sub(
        "\n  /** When campaign.rex_monitored, workspace pause/stop must be disabled — Studio only. */\n  const REX_MONITOR_LOCK = true;\n",
        t,
        count=1,
    )
    app.write_text(t2)
    print("removed EC_AUTO_RESUME useEffect after early return")
elif "EC_AUTO_RESUME_ENGINE" in t:
    # Fallback: strip from comment through dependency array
    start = t.find("  // EC_AUTO_RESUME_ENGINE:")
    end = t.find("}, [engine, signedIn]);", start)
    if start >= 0 and end > start:
        end = end + len("}, [engine, signedIn]);")
        # also eat following newline
        if end < len(t) and t[end] == "\n":
            end += 1
        t2 = t[:start] + t[end:]
        app.write_text(t2)
        print("removed via fallback")
    else:
        print("found marker but could not slice", start, end)
else:
    print("no EC_AUTO_RESUME — already clean?")

# Verify no useEffect appears after 'Checking your account' without matching earlier hooks risk
text = app.read_text()
if "EC_AUTO_RESUME_ENGINE" in text:
    print("WARNING still present")
else:
    print("OK clean")
print("size", app.stat().st_size)
