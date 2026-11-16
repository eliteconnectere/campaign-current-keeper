#!/usr/bin/env python3
"""Clarify notification center vs dashboard; teach Rex catalog search like Settings search."""
from pathlib import Path

SMART = '''
SMART CATALOG SEARCH (updates previous navigation rules; does not replace them):
- Treat the registered destination catalog the same way the Settings search bar treats app places: match by meaning, tolerate typos (e.g. "campaig" → campaign), synonyms, and partial words.
- When the user says "take me to / open / find [thing]" and the wording is fuzzy, pick the best registered place by purpose/name meaning. Prefer the highest-confidence match.
- If two strong matches exist (e.g. notification center vs notification settings dashboard), choose using the user's words:
  • center / inbox / bell / feed / unread alerts → notifications-bell
  • dashboard / management / sounds / tones / vibration / notification settings → settings-notifications (or notifications)
- Only say "not registered" when no catalog entry is a reasonable match. Do not invent places.
- This is still navigate-to-registered-places only; it is smarter matching, not new routes.
'''


def patch_registry() -> None:
    path = Path("src/features/assist/navigation.registry.ts")
    t = path.read_text()
    # Stronger purpose text for the two notification places
    t = t.replace(
        '{ place: "notifications", purpose: "Notification sounds, tones, vibration, sending sounds, alarm ringtone", parent: "settings", kind: "settings" },',
        '{ place: "notifications", purpose: "Notification SETTINGS DASHBOARD under Settings: Notification and Sound Management (tones, vibration, sending sounds, which events notify you). Use for notification dashboard, notification management, sound settings — NOT the bell inbox.", parent: "settings", kind: "settings" },',
        1,
    )
    t = t.replace(
        '{ place: "notifications-bell", purpose: "In-app notification inbox / bell feed", kind: "panel" },',
        '{ place: "notifications-bell", purpose: "Notification CENTER / bell inbox: unread alerts feed at the top of the app. Use for notification center, bell, inbox, alerts list — NOT Settings notification management.", kind: "panel" },',
        1,
    )
    t = t.replace(
        '{ place: "settings-notifications", purpose: "Open Settings → Notification and Sound Management", parent: "settings", kind: "settings" },',
        '{ place: "settings-notifications", purpose: "Same as notifications: Settings → Notification and Sound Management dashboard (not the bell).", parent: "settings", kind: "settings" },',
        1,
    )
    if "SMART CATALOG SEARCH" not in t:
        t = t.replace(
            '"Users may describe any registered feature in their own words, with misspellings, missing/extra letters, synonyms, abbreviations, phonetic spellings, or long descriptions. Match by meaning and context, not exact wording.",',
            '"Users may describe any registered feature in their own words, with misspellings, missing/extra letters, synonyms, abbreviations, phonetic spellings, or long descriptions. Match by meaning and context, not exact wording. Behave like the in-app Settings search: typo-tolerant ranking over the registered catalog.",',
            1,
        )
    path.write_text(t)
    print("registry notification purposes clarified")


def patch_assist() -> None:
    path = Path("src/lib/assist.functions.ts")
    t = path.read_text()
    if "SMART CATALOG SEARCH" not in t:
        anchor = "Navigation is free reasoning, not a keyword router."
        if anchor in t:
            t = t.replace(anchor, anchor + "\n\n" + SMART, 1)
            print("smart search brief added")
        elif "NAVIGATE vs ACT" in t:
            t = t.replace("NAVIGATE vs ACT (HIGH PRIORITY):", SMART + "\n\nNAVIGATE vs ACT (HIGH PRIORITY):", 1)
            print("smart search before nav vs act")
    # allowlist notifications-bell if missing
    if '"notifications-bell"' not in t and '"appeals"' in t:
        t = t.replace('"appeals"', '"appeals", "notifications-bell", "settings-notifications"', 1)
    path.write_text(t)
    print("assist", path.stat().st_size)


def patch_app() -> None:
    path = Path("src/routes/app.tsx")
    t = path.read_text()
    # Ensure notifications-bell opens bell; notifications opens settings notifications view
    if 'p === "notifications-bell"' not in t:
        # insert near notifications handling or settings-notifications
        needle = '} else if (p === "settings-notifications" || p === "notifications")'
        if needle in t:
            t = t.replace(
                needle,
                '} else if (p === "notifications-bell") {\n              setAssistOpen(false);\n              setPanel("none");\n              // Open the notification bell / inbox centre\n              try {\n                const bell = document.querySelector("[data-ec-notifications-bell], [aria-label*=\"Notification\" i], button[aria-label*=\"notification\" i]");\n                if (bell instanceof HTMLElement) bell.click();\n              } catch {}\n            } else if (p === "settings-notifications" || p === "notifications")',
                1,
            )
            print("notifications-bell branch added")
        else:
            # find settings-notifications or notifications in handleRexNavigation
            idx = t.find("function handleRexNavigation")
            if idx > 0 and 'p === "notifications"' not in t[idx:idx+12000]:
                insert_at = t.find('} else if (p === "settings")', idx)
                if insert_at > 0:
                    block = '''} else if (p === "notifications-bell") {
              setAssistOpen(false);
              setPanel("none");
              try {
                const bell = document.querySelector("[data-ec-notifications-bell], [aria-label*=\"Notification\" i], button[aria-label*=\"notification\" i]");
                if (bell instanceof HTMLElement) bell.click();
              } catch {}
            } else if (p === "settings-notifications" || p === "notifications") {
              setAssistOpen(false); setPanel("menu"); setMenuView("notifications");
            '''
                    t = t[:insert_at] + block + t[insert_at:]
                    print("inserted notification branches before settings")
            elif 'p === "notifications"' in t[idx:idx+15000]:
                # ensure settings-notifications maps to notifications menuView
                print("notifications string exists in handler")
    # Tag bell button if we can find a clear Bell icon header button - soft
    if "data-ec-notifications-bell" not in t:
        # common pattern: <Bell className near header notification
        if "aria-label=\"Notifications\"" in t:
            t = t.replace('aria-label="Notifications"', 'aria-label="Notifications" data-ec-notifications-bell=""', 1)
            print("tagged Notifications aria")
        elif "aria-label=\"Notification\"" in t:
            t = t.replace('aria-label="Notification"', 'aria-label="Notification" data-ec-notifications-bell=""', 1)
            print("tagged Notification aria")
    path.write_text(t)
    print("app", path.stat().st_size)


if __name__ == "__main__":
    patch_registry()
    patch_assist()
    patch_app()
    print("done")
