#!/usr/bin/env python3
"""Register every Settings row as its own destination; wire onGo; navigate vs act brief."""
from pathlib import Path

REGISTRY_ADDITIONS = '''
  // --- Settings panel rows (exact controls, not "nearby") ---
  { place: "settings-campaign-protection", purpose: "Open Settings → Campaign Protection (permanent duplicate protection and Gmail rotation)", parent: "settings", kind: "settings" },
  { place: "settings-smart-fill-history", purpose: "Open Settings → Smart Fill History (saved email sets)", parent: "settings", kind: "settings" },
  { place: "settings-notifications", purpose: "Open Settings → Notification and Sound Management", parent: "settings", kind: "settings" },
  { place: "settings-night-mode-light", purpose: "Open Night Mode Light customization (colours, speed, edge coverage) from Settings", parent: "settings", kind: "settings" },
  { place: "settings-interface", purpose: "Open Interface Customization (colours, type, shape, density) from Settings", parent: "settings", kind: "settings" },
  { place: "settings-tools", purpose: "Open Settings → Tools & Visibility", parent: "settings", kind: "settings" },
  { place: "settings-subscription", purpose: "Open Settings → Subscription plan details", parent: "settings", kind: "settings" },
  { place: "settings-export-data", purpose: "Open Settings and highlight Export Data / CSV Backup control", parent: "settings", kind: "action" },
  { place: "settings-clear-cache", purpose: "Open Settings and highlight Clear Local Cache control", parent: "settings", kind: "action" },
  { place: "settings-erase-data", purpose: "Open Settings and highlight Erase Data control (wipe stored workspace data). NOT reset-workspace.", parent: "settings", kind: "action" },
  { place: "settings-walkthrough", purpose: "Start or open the product walk-through from Settings", parent: "settings", kind: "action" },
'''

NAV_VS_ACT = '''
NAVIGATE vs ACT (HIGH PRIORITY):
- "Take me to / open / go to / show me [place]" → navigate_to the EXACT registered destination. Never substitute a nearby related screen.
- "I want to [do action]" (erase data, clear cache, change colour, export CSV, delete X) → this is ACT intent, not only navigation.
  1) If a required choice is missing (e.g. which colour, which list), ask ONE clear question first.
  2) If the action is fully specified and safe to prepare, prepare the app approval control / open the exact control so the user can confirm.
  3) Never silently run destructive actions; Erase Data always requires the existing confirmation.
- Do not answer an ACT request with only a vague suggestion to visit Settings. Prefer the exact destination id (e.g. settings-erase-data, settings-notifications).
- Aliases: erase data / wipe workspace data → settings-erase-data or erase-data; reset campaign only → reset-workspace; clear cache → settings-clear-cache or clear-cache; night mode light → settings-night-mode-light or night-mode; interface colours → settings-interface or studio.
'''


def patch_registry() -> None:
    path = Path("src/features/assist/navigation.registry.ts")
    t = path.read_text()
    if "settings-erase-data" not in t:
        # insert before tracker-run or end of array
        if '{ place: "tracker-run"' in t:
            t = t.replace('{ place: "tracker-run"', REGISTRY_ADDITIONS + '  { place: "tracker-run"', 1)
        else:
            t = t.replace("] as const;", REGISTRY_ADDITIONS + "] as const;", 1)
        print("registry settings rows added")
    # fix erase-data purpose parent
    t = t.replace(
        'parent: "workspace-menu", kind: "action" },\n  { place: "account"',
        'parent: "settings", kind: "action" },\n  { place: "account"',
        1,
    )
    # catalog note
    if "settings-erase-data" not in t.split("Examples:")[0] if "Examples:" in t else True:
        t = t.replace(
            "Examples: logout/sign out → logout;",
            "Examples: erase data → settings-erase-data; clear cache → settings-clear-cache; notifications → settings-notifications; logout → logout;",
            1,
        )
    path.write_text(t)


def patch_app() -> None:
    path = Path("src/routes/app.tsx")
    t = path.read_text()

    # Replace broken combined branch start for erase/clear/settings
    # Inject dedicated handlers before workspace-menu branch
    marker = '} else if (p === "workspace-menu" || p === "logout" || p === "export-data"'
    if marker not in t:
        marker = '} else if (p === "workspace-menu" || p === "logout"'

    dedicated = '''} else if (p === "erase-data" || p === "settings-erase-data" || p === "clear-cache" || p === "settings-clear-cache" || p === "settings-export-data" || p === "export-data") {
              setAssistOpen(false);
              setFeatureStudio(null);
              setRadarOpen(false);
              setVaultOpen(false);
              setStudioOpen(false);
              setChatOpen(false);
              setChatSettingsOpen(false);
              setTeamOpen(false);
              setPanel("menu");
              setMenuView("settings");
              window.setTimeout(() => {
                const map: Record<string, string> = {
                  "erase-data": "[data-ec-menu-erase]",
                  "settings-erase-data": "[data-ec-menu-erase]",
                  "clear-cache": "[data-ec-menu-clear-cache]",
                  "settings-clear-cache": "[data-ec-menu-clear-cache]",
                  "export-data": "[data-ec-menu-export]",
                  "settings-export-data": "[data-ec-menu-export]",
                };
                const el = document.querySelector(map[p] || "[data-ec-menu-erase]");
                if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                else document.querySelector("[data-ec-menu-scroll]")?.scrollTo({ top: 9999, behavior: "smooth" });
              }, 120);
            } else if (p === "settings-campaign-protection" || p === "protection") {
              setAssistOpen(false); setPanel("menu"); setMenuView("campaignProtection");
            } else if (p === "settings-smart-fill-history" || p === "history") {
              setAssistOpen(false); setPanel("menu"); setMenuView("history");
            } else if (p === "settings-notifications" || p === "notifications") {
              setAssistOpen(false); setPanel("menu"); setMenuView("notifications");
            } else if (p === "settings-tools" || p === "tools") {
              setAssistOpen(false); setPanel("menu"); setMenuView("tools");
            } else if (p === "settings-subscription" || p === "subscription") {
              setAssistOpen(false); setPanel("menu"); setMenuView("subscription");
            } else if (p === "settings-night-mode-light" || p === "night-mode") {
              setAssistOpen(false); setFeatureStudio("nightMode"); setPanel("none");
            } else if (p === "settings-interface" || p === "appearance") {
              setAssistOpen(false); setStudioOpen(true); setPanel("none");
            } else if (p === "settings-walkthrough" || p === "tour") {
              setAssistOpen(false); setPanel("none");
              try { /* walkthrough entry if available */ } catch {}
            } else if (p === "reset-workspace") {
              setAssistOpen(false); setPanel("menu"); setMenuView("root");
              window.setTimeout(() => document.querySelector("[data-ec-reset-workspace]")?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
            } else if (p === "workspace-menu" || p === "logout"'''

    if "settings-erase-data" not in t.split("handleRexNavigation")[1][:8000]:
        # strip erase-data from old combined condition then inject dedicated
        t = t.replace(
            'p === "workspace-menu" || p === "logout" || p === "export-data" || p === "clear-cache" || p === "erase-data" || p === "reset-workspace"',
            'p === "workspace-menu" || p === "logout"',
            1,
        )
        t = t.replace(
            'p === "workspace-menu" || p === "logout" || p === "export-data" || p === "clear-cache" || p === "erase-data"',
            'p === "workspace-menu" || p === "logout"',
            1,
        )
        if '} else if (p === "workspace-menu" || p === "logout")' in t:
            t = t.replace('} else if (p === "workspace-menu" || p === "logout")', dedicated, 1)
            print("dedicated settings destinations in onGo")
        else:
            print("WARN: workspace-menu branch missing")

    # settings root opens settings view
    t = t.replace(
        '''} else if (p === "settings") {
              setMenuView("root");
              setPanel("menu");''',
        '''} else if (p === "settings") {
              setMenuView("settings");
              setPanel("menu");''',
        1,
    )

    # data attrs on settings rows
    if 'dataAttr="data-ec-menu-erase"' not in t and 'label="Erase Data"' in t:
        t = t.replace(
            'label="Erase Data"',
            'label="Erase Data"\n                        dataAttr="data-ec-menu-erase"',
            1,
        )
    if 'data-ec-menu-clear-cache' not in t and 'label="Clear Local Cache"' in t:
        t = t.replace(
            'label="Clear Local Cache"',
            'label="Clear Local Cache"\n                        dataAttr="data-ec-menu-clear-cache"',
            1,
        )
    if 'data-ec-menu-export' not in t and 'label="Export Data / CSV Backup"' in t:
        t = t.replace(
            'label="Export Data / CSV Backup"',
            'label="Export Data / CSV Backup"\n                        dataAttr="data-ec-menu-export"',
            1,
        )

    path.write_text(t)
    print("app", path.stat().st_size)


def patch_assist_brief() -> None:
    path = Path("src/lib/assist.functions.ts")
    t = path.read_text()
    if "NAVIGATE vs ACT" not in t:
        anchor = "Navigation is free reasoning, not a keyword router."
        if anchor in t:
            t = t.replace(anchor, anchor + "\n\n" + NAV_VS_ACT, 1)
            print("nav vs act brief")
    # allowlist new places
    for place in [
        "settings-erase-data", "settings-clear-cache", "settings-export-data",
        "settings-notifications", "settings-campaign-protection", "settings-smart-fill-history",
        "settings-night-mode-light", "settings-interface", "settings-tools",
        "settings-subscription", "settings-walkthrough", "reset-workspace",
    ]:
        token = f'"{place}"'
        if token not in t and '"appeals"' in t:
            t = t.replace('"appeals"', f'"appeals", {token}', 1)
    path.write_text(t)
    print("assist", path.stat().st_size)


if __name__ == "__main__":
    patch_registry()
    patch_app()
    patch_assist_brief()
    print("done")
