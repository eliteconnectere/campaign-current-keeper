#!/usr/bin/env python3
"""Fix broken permanentSendProtection + MagicCircle refresh syntax from prior patches."""
from pathlib import Path
import re

p = Path("src/routes/app.tsx")
t = p.read_text(encoding="utf-8")

broken = """const permanentSendProtection = true /* always on */ => {
  if (typeof window === "undefined") return true;
  try {
    const saved = window.localStorage.getItem("ec.permanent-send-protection");
    return saved === null ? true : JSON.parse(saved) === true;
  } catch { return true; }
  });"""

fixed = "const permanentSendProtection = true; // always on — no toggle"

if broken in t:
    t = t.replace(broken, fixed, 1)
    print("fixed PSP declaration")
elif "true /* always on */ =>" in t:
    t = re.sub(
        r"const permanentSendProtection = true /\* always on \*/ => \{[\s\S]*?\}\);",
        fixed,
        t,
        count=1,
    )
    print("fixed PSP via regex")
else:
    print("PSP already ok or different")

# Remove setPermanentSendProtection usages (function no longer exists)
t = re.sub(
    r"else if \(typeof s\.permanentSendProtection === \"boolean\"\) setPermanentSendProtection\(s\.permanentSendProtection\);\s*",
    "",
    t,
)
t = re.sub(
    r"if \(typeof s\.permanentSendProtection === \"boolean\"\) setPermanentSendProtection\(s\.permanentSendProtection\);\s*",
    "",
    t,
)
print("cleared setPermanentSendProtection calls")

# Fix MagicCircle settings + refresh broken commas
broken_mc = """              onSelect: () => {
                setMenuView("settings");
                setPanel("menu");
              },, {
              id: "refresh",
              label: "Refresh",
              icon: <RotateCcw className="size-5" />,
              onSelect: () => {
                try { sessionStorage.setItem("ec.soft-refresh", "1"); } catch {}
                window.location.reload();
              },
            }
            },
          ]}"""

fixed_mc = """              onSelect: () => {
                setMenuView("settings");
                setPanel("menu");
              },
            },
            {
              id: "refresh",
              label: "Refresh",
              icon: <RotateCcw className="size-5" />,
              onSelect: () => {
                try { sessionStorage.setItem("ec.soft-refresh", "1"); } catch {}
                window.location.reload();
              },
            },
          ]}"""

if broken_mc in t:
    t = t.replace(broken_mc, fixed_mc, 1)
    print("fixed MagicCircle refresh syntax")
elif "},, {" in t and 'id: "refresh"' in t:
    t = t.replace("},, {", "},\n            {", 1)
    # remove extra bare `},` before closing shortcuts if double
    t = re.sub(
        r"(id: \"refresh\"[\s\S]{0,280}?},)\s*},\s*\]",
        r"\1\n          ]",
        t,
        count=1,
    )
    print("fixed double comma soft")
else:
    print("MC syntax check done")

# Ensure floating icon shows for any signed-in user
t = t.replace(
    "{signedIn && mode === \"elite\" && (chatEligible || entitlements?.isAssistant) && !chatOpen && !radarOpen && (",
    "{signedIn && !chatOpen && !radarOpen && (",
)
t = t.replace(
    "{signedIn && mode === \"engine\" && chatEligible && !chatOpen && !radarOpen && (",
    "{signedIn && !chatOpen && !radarOpen && (",
)

p.write_text(t, encoding="utf-8")
print("written", len(t))
# quick sanity
if "},," in t:
    print("WARN still has },,")
if "always on */ =>" in t:
    print("WARN still broken PSP")
print("OK")
