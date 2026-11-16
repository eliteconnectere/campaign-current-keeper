#!/usr/bin/env python3
"""Apply free agent navigation patches."""
from pathlib import Path

ea = Path("src/features/assist/EliteAssist.tsx")
t = ea.read_text()
old = "onGo={(p) => void approveNavigationFromCard(p)}"
new = "onGo={(p) => { onClose(); window.setTimeout(() => onGo?.(p as AssistPlace), 120); }}"
if old in t:
    t = t.replace(old, new, 1)
    print("patched onGo")
else:
    print("onGo already patched or missing")

if "lastNavKey" not in t:
    marker = "const openChips = msgs.length === 0 ? starters : suggests;"
    if marker not in t:
        raise SystemExit("openChips marker missing")
    auto = """
  // Free agent: open real destinations from [[GO:place]] without approval.
  const lastNavKey = useRef<string>("");
  useEffect(() => {
    if (busy || !historyReady) return;
    const last = [...msgs].reverse().find((m) => m.role === "assistant");
    if (!last?.content) return;
    const start = last.content.indexOf("[[GO:");
    if (start < 0) return;
    const end = last.content.indexOf("]]", start);
    if (end < 0) return;
    const place = last.content.slice(start + 5, end).trim().toLowerCase();
    if (!place) return;
    const key = place + ":" + String(last.content.length);
    if (lastNavKey.current === key) return;
    lastNavKey.current = key;
    const known =
      NAVIGATION_DESTINATIONS.some((d) => d.place === place) ||
      place.startsWith("tracker-run-") ||
      place.startsWith("rex-destination-");
    if (!known) return;
    window.setTimeout(() => {
      onClose();
      window.setTimeout(() => onGo?.(place as AssistPlace), 120);
    }, 400);
  }, [msgs, busy, historyReady, onClose, onGo]);

"""
    t = t.replace(marker, auto + "  " + marker, 1)
    print("patched auto-nav")
ea.write_text(t)
print("EliteAssist", len(t))

a = Path("src/lib/assist.functions.ts")
t = a.read_text()
reps = [
    (
        "When a user explicitly asks to open, show, or navigate to a supported screen, use the navigate_to function tool to choose the closest exact supported destination. Do not guess destinations outside its enum. If the user names a specific recent campaign run, set record_id to that exact ID from recentCampaignRuns so the UI opens that run expanded.",
        "When the user wants to open, see, go to, or land on any part of the workspace, use navigate_to and pick the best matching registered destination from your own reasoning — not keywords, not FAQ scripts. Prefer the most specific real place. You may navigate proactively when that is clearly the helpful next step. If they name a specific recent campaign run, set record_id to that exact ID from recentCampaignRuns. Never invent a place that is not in the registered destination list.",
    ),
    (
        "- Navigation is handled through the registered navigate_to tool. Use it when the user explicitly asks to open a destination. Never invent a destination.",
        "- Navigation is free reasoning, not a keyword router. Use navigate_to for any real registered destination the user needs. Prefer opening the place over only describing it when they want to go there. Never invent a destination outside the registered list. Do not refuse navigation because of FAQ, canned phrases, or rigid topic rules.",
    ),
    (
        "During the reversible autonomy experiment, reason independently from the user objective and registered capabilities. For navigation, use navigate_to to select the closest exact registered destination. Reason from the user's complete request and the real capabilities available to you. Only claim actions the application confirms.",
        "Reason independently from the user's full objective. Assistant and agent are one: answer when they need understanding, navigate when they need a place, and prepare real tools when they need action. For navigation, use navigate_to to choose the closest registered destination purely from your reasoning. Do not follow keyword, FAQ, or canned-route scripts. Only claim actions the application confirms.",
    ),
]
for old, new in reps:
    if old not in t:
        print("WARN missing:", old[:55])
    else:
        t = t.replace(old, new, 1)
        print("patched brief")
a.write_text(t)
print("assist.functions", len(t))
