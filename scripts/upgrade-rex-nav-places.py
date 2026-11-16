#!/usr/bin/env python3
"""One-shot: expand AssistPlace, PLACE_LABEL, resolveNavigationIntent, and app.tsx onGo."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

# --- EliteAssist.tsx ---
ea = (ROOT / "src/features/assist/EliteAssist.tsx").read_text()

# 1) Import shared resolver
if "resolvePlaceFromText" not in ea:
    ea = ea.replace(
        'import { NAVIGATION_DESTINATIONS, buildNavigationCatalogForAi } from "@/features/assist/navigation.registry";',
        'import { NAVIGATION_DESTINATIONS, buildNavigationCatalogForAi, resolvePlaceFromText } from "@/features/assist/navigation.registry";',
    )

# 2) Expand AssistPlace type
old_type = '''export type AssistPlace =
  | "radar"
  | "vault"
  | "snippets"
  | "monitor"
  | "settings"
  | "chat"
  | "upgrade"
  | "learn-more"
  | "privacy"
  | "terms"
  | "support"
  | "appeals"
  | "admin"
  | "activity"
  | "planner"
  | "tracker"
  | "tracker-skipped"
  | "tracker-failed"
  | "tracker-completed"
  | "tracker-paused"
  | "tracker-running"
  | "tracker-today"
  | `tracker-run-${string}`
  | "activity-campaign"
  | "activity-system"
  | "smartfill"
  | "sending"
  | "studio"
  | "rex-studio"
  | "rex-memory"
  | "hotspot"
  | "quarantine"
  | "protection"
  | "notifications"
  | "notifications-bell"
  | "subscription"
  | "scope"
  | "history"
  | "tools"
  | "tour";'''

new_type = '''export type AssistPlace =
  | "radar"
  | "vault"
  | "snippets"
  | "monitor"
  | "settings"
  | "chat"
  | "upgrade"
  | "learn-more"
  | "privacy"
  | "terms"
  | "support"
  | "appeals"
  | "admin"
  | "activity"
  | "planner"
  | "tracker"
  | "tracker-skipped"
  | "tracker-failed"
  | "tracker-completed"
  | "tracker-paused"
  | "tracker-running"
  | "tracker-today"
  | `tracker-run-${string}`
  | "activity-campaign"
  | "activity-system"
  | "smartfill"
  | "sending"
  | "studio"
  | "rex-studio"
  | "rex-memory"
  | "hotspot"
  | "quarantine"
  | "protection"
  | "notifications"
  | "notifications-bell"
  | "subscription"
  | "scope"
  | "history"
  | "tools"
  | "tour"
  | "night-mode"
  | "gmail-profiles"
  | "delay-settings"
  | "chat-settings"
  | "templates";'''

if old_type in ea:
    ea = ea.replace(old_type, new_type)
elif '| "tour";' in ea and 'night-mode' not in ea:
    ea = ea.replace('| "tour";', '| "tour"\n  | "night-mode"\n  | "gmail-profiles"\n  | "delay-settings"\n  | "chat-settings"\n  | "templates";')

# 3) Expand PLACE_LABEL
if '"night-mode"' not in ea:
    ea = ea.replace(
        '  terms: "Terms",\n};',
        '  terms: "Terms",\n  "night-mode": "Open Night Mode",\n  "gmail-profiles": "Open Gmail profiles",\n  "delay-settings": "Open delay settings",\n  "chat-settings": "Open Chat settings",\n  templates: "Open Templates",\n};',
    )

# 4) Prefer shared resolver (keep local as thin wrapper for type)
new_resolve = '''/** Resolve explicit destination requests independently of Gemini's optional tags. */
function resolveNavigationIntent(question: string): AssistPlace | null {
  const place = resolvePlaceFromText(question);
  return place as AssistPlace | null;
}
'''
# Replace from function resolveNavigationIntent through its closing brace before extractSuggests
ea = re.sub(
    r'/\*\* Resolve explicit destination requests independently of Gemini\'s optional tags\. \*/\nfunction resolveNavigationIntent\(question: string\): AssistPlace \| null \{[\s\S]*?\n\}\n\nfunction extractSuggests',
    new_resolve + '\nfunction extractSuggests',
    ea,
    count=1,
)

(ROOT / "src/features/assist/EliteAssist.tsx").write_text(ea)
print("EliteAssist updated")

# --- app.tsx onGo ---
app = (ROOT / "src/routes/app.tsx").read_text()

# Ensure new places are handled in onGo
ong_snippet = '''            } else if (p === "studio" || p === "night-mode") {
              setStudioOpen(true);
            } else if (p === "hotspot") {
              setTeamOpen(true);
            } else if (p === "quarantine") {
              setVaultOpen(true);
            } else if (p === "protection" || p === "notifications" || p === "subscription" || p === "scope" || p === "history" || p === "tools" || p === "gmail-profiles" || p === "delay-settings") {
              setMenuView(p === "protection" ? "campaignProtection" : p === "gmail-profiles" ? "settings" : p === "delay-settings" ? "settings" : p);
              setPanel("menu");
            } else if (p === "chat-settings") {
              if (chatEligible) { setChatOpen(true); setChatSettingsOpen(true); }
              else askUpgrade("Private Chat is a Premium and Elite Studio ProMaxx feature.", true);
            } else if (p === "templates") {
              // Focus the main workspace template editors
              setPanel("none");
              window.setTimeout(() => document.querySelector("[data-ec-templates]")?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
            } else if (p === "notifications-bell") {
'''

# Only inject if night-mode not already handled
if 'p === "night-mode"' not in app and 'p === "studio"' in app:
    app = app.replace(
        '''            } else if (p === "studio") {
              setStudioOpen(true);
            } else if (p === "hotspot") {
              setTeamOpen(true);
            } else if (p === "quarantine") {
              setVaultOpen(true);
            } else if (p === "protection" || p === "notifications" || p === "subscription" || p === "scope" || p === "history" || p === "tools") {
              setMenuView(p === "protection" ? "campaignProtection" : p);
              setPanel("menu");
            } else if (p === "notifications-bell") {
''',
        ong_snippet,
    )
    (ROOT / "src/routes/app.tsx").write_text(app)
    print("app.tsx onGo updated")
else:
    print("app.tsx already has night-mode or pattern differs; check manually")

print("done")
