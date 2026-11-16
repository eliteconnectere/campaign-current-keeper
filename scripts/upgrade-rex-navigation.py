#!/usr/bin/env python3
"""Upgrade Rex navigation: handle all tracker filters in onGo; inject AI catalog into assist."""
from pathlib import Path
import re

changed = False

# —— app.tsx onGo: add tracker-* and quarantine aliases ——
app = Path("src/routes/app.tsx")
if app.exists():
    text = app.read_text(encoding="utf-8")
    original = text

    # Expand activity/planner/tracker branch to include filtered tracker places
    old_branch = '''} else if (p === "activity" || p === "planner" || p === "tracker" || p === "smartfill" || p === "sending") {
              setFeatureStudio(p === "smartfill" ? "smartFill" : p);'''

    new_branch = '''} else if (
              p === "activity" || p === "activity-campaign" || p === "activity-system" ||
              p === "planner" || p === "tracker" ||
              p === "tracker-skipped" || p === "tracker-failed" || p === "tracker-completed" ||
              p === "tracker-paused" || p === "tracker-running" || p === "tracker-today" ||
              p === "smartfill" || p === "sending"
            ) {
              // Feature studios + filtered tracker/activity views
              if (p.startsWith("tracker")) {
                setFeatureStudio("tracker");
                try { sessionStorage.setItem("ec.tracker.filter", p === "tracker" ? "all" : p.replace("tracker-", "")); } catch {}
              } else if (p.startsWith("activity")) {
                setFeatureStudio("activity");
                try { sessionStorage.setItem("ec.activity.filter", p === "activity" ? "all" : p.replace("activity-", "")); } catch {}
              } else {
                setFeatureStudio(p === "smartfill" ? "smartFill" : p);
              }'''

    if old_branch in text:
        text = text.replace(old_branch, new_branch)
        print("app.tsx: expanded tracker/activity onGo")
    else:
        print("app.tsx: tracker branch pattern not found (may already be expanded)")

    if text != original:
        app.write_text(text, encoding="utf-8")
        changed = True

# —— EliteAssist: broaden intent detection beyond pure "take me to" ——
ea = Path("src/features/assist/EliteAssist.tsx")
if ea.exists():
    text = ea.read_text(encoding="utf-8")
    original = text
    old_intent = r"const intent = /\\b(take me to|bring me to|go to|navigate to|open|show me|lead me to|direct me to)\\b/.test(q);"
    new_intent = r"const intent = /\\b(take me to|bring me to|go to|navigate to|open|show me|lead me to|direct me to|where (?:is|can i|do i)|i want to (?:see|open|change|check|review)|change the|show the|open the)\\b/.test(q);"
    if re.search(old_intent, text):
        text = re.sub(old_intent, new_intent, text)
        print("EliteAssist: broader navigation intent")
    # Import catalog helper if not present — optional
    if "buildNavigationCatalogForAi" not in text and "from \"@/features/assist/navigation.registry\"" in text:
        text = text.replace(
            'import { NAVIGATION_DESTINATIONS } from "@/features/assist/navigation.registry";',
            'import { NAVIGATION_DESTINATIONS, buildNavigationCatalogForAi } from "@/features/assist/navigation.registry";',
        )
        print("EliteAssist: import catalog helper")
    if text != original:
        ea.write_text(text, encoding="utf-8")
        changed = True

# —— assist.functions.ts: inject navigation catalog into system path ——
af = Path("src/lib/assist.functions.ts")
if af.exists():
    text = af.read_text(encoding="utf-8")
    original = text
    if "buildNavigationCatalogForAi" not in text:
        # Add import after other imports if possible
        if 'from "@/integrations/supabase/auth-middleware"' in text:
            text = text.replace(
                'import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";',
                'import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";\nimport { buildNavigationCatalogForAi } from "@/features/assist/navigation.registry";',
            )
        marker = "NAVIGATION tags [[SHOW:]] / [[GO:]]"
        # Inject catalog near navigation rules if present
        inject = "\n\n" + "${buildNavigationCatalogForAi()}"  # won't work in const string
        # Instead append catalog when building the live system string — look for SYSTEM_BRIEF usage
        if "const SYSTEM_BRIEF" in text and "buildNavigationCatalogForAi()" not in text:
            # Find a place where system is assembled with SYSTEM_BRIEF
            # Common pattern: system = SYSTEM_BRIEF + ...
            text2 = text
            # After SYSTEM_BRIEF const closes, we can't easily inject into template.
            # Patch runtime assembly: if we find `systemInstruction` or system variable:
            patterns = [
                ("SYSTEM_BRIEF +", "SYSTEM_BRIEF + \"\\n\\n\" + buildNavigationCatalogForAi() + \"\\n\\n\" + "),
                ("system = SYSTEM_BRIEF", "system = SYSTEM_BRIEF + \"\\n\\n\" + buildNavigationCatalogForAi()"),
                ("systemInstruction: {\n              parts: [{ text: system }]", None),  # leave
            ]
            for old, new in patterns:
                if new and old in text2:
                    text2 = text2.replace(old, new, 1)
                    print("assist: injected catalog at", old[:40])
                    break
            else:
                # Fallback: append note inside SYSTEM_BRIEF near NAVIGATION section
                nav_note = (
                    "\n\nNAVIGATION CATALOG:\n"
                    "Prefer specific destinations via [[GO:place]]. "
                    "notifications = sound settings; tracker-skipped = skipped recipients; "
                    "rex-memory = conversation history; vault = quarantine; "
                    "tracker-failed = failed sends; studio = colours/theme.\n"
                )
                if "[[GO:]]" in text2 and "tracker-skipped = skipped" not in text2:
                    text2 = text2.replace(
                        "[[GO:]] are optional.",
                        "[[GO:]] are optional." + nav_note.replace("\n", "\\n"),
                        1,
                    )
                    print("assist: injected compact navigation guidance into SYSTEM_BRIEF")
            text = text2

    if text != original:
        af.write_text(text, encoding="utf-8")
        changed = True

print("upgrade-rex-navigation done, changed=", changed)
