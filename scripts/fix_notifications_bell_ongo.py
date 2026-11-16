#!/usr/bin/env python3
from pathlib import Path

path = Path("src/routes/app.tsx")
t = path.read_text()

if 'p === "notifications-bell"' in t:
    print("already wired")
else:
    # Insert before settings branch inside handleRexNavigation
    markers = [
        '} else if (p === "settings") {',
        '} else if (p === "settings-notifications" || p === "notifications") {',
        '} else if (p === "chat") {',
    ]
    block = '''} else if (p === "notifications-bell") {
              setAssistOpen(false);
              setPanel("none");
              try {
                const bell = document.querySelector('[data-ec-notifications-bell]') as HTMLElement | null;
                if (bell) bell.click();
                else {
                  const fallback = Array.from(document.querySelectorAll('button')).find((b) => /notification/i.test(b.getAttribute('aria-label') || '') || b.querySelector('svg.lucide-bell'));
                  if (fallback instanceof HTMLElement) fallback.click();
                }
              } catch {}
            } else if (p === "settings-notifications" || p === "notifications") {
              setAssistOpen(false);
              setPanel("menu");
              setMenuView("notifications");
            '''
    inserted = False
    for m in markers:
        if m in t and 'handleRexNavigation' in t:
            # only first occurrence after handleRexNavigation
            idx = t.find("function handleRexNavigation")
            pos = t.find(m, idx)
            if pos > 0:
                t = t[:pos] + block + t[pos:]
                inserted = True
                print("inserted before", m[:40])
                break
    if not inserted:
        raise SystemExit("could not insert notifications-bell")

# Tag a bell button if possible
if 'data-ec-notifications-bell' not in t:
    for lab in ['aria-label="Notifications"', "aria-label='Notifications'", 'aria-label="Open notifications"']:
        if lab in t:
            t = t.replace(lab, lab[:-1] + '" data-ec-notifications-bell=""' if lab.endswith('"') else lab, 1)
            # fix botched replace
            break
    # simpler: lucide Bell in header area - skip if hard

path.write_text(t)
assert 'notifications-bell' in path.read_text()
print("ok", path.stat().st_size)
