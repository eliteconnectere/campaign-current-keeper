#!/usr/bin/env python3
"""Apply chat FAB + settings scroll-to-top directly into app.tsx and commit."""
from pathlib import Path
import re

app = Path("src/routes/app.tsx")
t = app.read_text()
orig = t

# 1) Stop forced tip on settings (if still present)
t = t.replace('try { showPanelTip("settings"); } catch {}', "/* settings open: no forced tip */")
t = t.replace("try { showPanelTip('settings'); } catch {}", "/* settings open: no forced tip */")

# 2) Settings open always scroll top
if "setMenuView(\"settings\")" in t and "scrollRexDestination" in t:
    # After each setMenuView("settings"); inject scroll if missing nearby
    parts = []
    last = 0
    for m in re.finditer(r'setMenuView\("settings"\);', t):
        after = t[m.end():m.end()+90]
        if "scrollRexDestination" in after:
            continue
        insert = 'setMenuView("settings"); try { window.setTimeout(() => scrollRexDestination(), 0); } catch {}'
        parts.append((m.start(), m.end(), insert))
    for start, end, ins in reversed(parts):
        t = t[:start] + ins + t[end:]
    print("settings scroll injections", len(parts))

# 3) Raise z-index on existing rex return float
t = t.replace(
    'className="fixed bottom-24 right-4 z-[120] inline-flex items-center gap-2 rounded-full bg-brand',
    'className="fixed bottom-24 right-4 z-[200] inline-flex items-center gap-2 rounded-full bg-brand',
)

# 4) Chat Rex FAB — always when chat open and assist closed
if 'data-ec-rex-chat-fab' not in t:
    fab = '''
      {chatOpen && !assistOpen && !rexStudioOpen && (
        <button
          type="button"
          data-ec-rex-chat-fab=""
          aria-label="Open Rex"
          onClick={() => {
            setRexPersonalDestinationId(null);
            setFeatureStudio(null);
            setRadarOpen(false);
            setVaultOpen(false);
            setPanel("none");
            setStudioOpen(false);
            setAssistOpen(true);
          }}
          className="fixed bottom-24 right-4 z-[200] grid size-14 place-items-center rounded-full bg-brand text-white shadow-2xl ring-2 ring-white/40"
        >
          <Bot className="size-6" />
        </button>
      )}
'''
    if "{assistOpen && (" in t:
        t = t.replace("{assistOpen && (", fab + "\n      {assistOpen && (", 1)
        print("chat FAB inserted")
    else:
        print("WARN assistOpen marker missing")
else:
    print("chat FAB already present")

# 5) Listen for ec-open-erase-data from Chat Settings
if "ec-open-erase-data" not in t:
    # Add a small useEffect near other window listeners if possible
    marker = "window.addEventListener(\"ec:gmail-connected\""
    # Find a useEffect in Workspace that we can append near erase handlers
    # Simpler: after eraseWarningOpen state usage, add effect once
    inject_effect = '''
  useEffect(() => {
    const openErase = () => {
      try {
        setPanel("menu");
        setMenuView("settings");
        setEraseWarningOpen(true);
        window.setTimeout(() => scrollRexDestination(), 0);
        window.setTimeout(() => {
          document.querySelector("[data-ec-erase], [data-ec-erase-data]")?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 200);
      } catch {}
    };
    window.addEventListener("ec-open-erase-data", openErase);
    return () => window.removeEventListener("ec-open-erase-data", openErase);
  }, []);
'''
    # Insert after first useEffect in file that is inside Workspace - hard
    # Find confirmEraseData function and put effect before it
    if "async function confirmEraseData" in t:
        t = t.replace("async function confirmEraseData", inject_effect + "\n  async function confirmEraseData", 1)
        print("erase event listener")

# 6) data-tour recipients
if 'data-tour="recipients"' not in t:
    t = t.replace(
        "h2 data-ec-recipients className=",
        'h2 data-ec-recipients data-tour="recipients" className=',
        1,
    )
    print("recipients tour marker")

# 7) execute button marker
if not re.search(r"<button[^>]*data-tour=\"execute\"", t):
    old = '{engine === "paused" ? "Resume Campaign" : "Execute Campaign"}'
    idx = t.find(old)
    if idx > 0:
        b = t.rfind("<button", 0, idx)
        if b > 0 and 'data-tour="execute"' not in t[b:idx]:
            t = t[:b] + t[b:].replace("<button", '<button data-tour="execute"', 1)
            print("execute marker")

# 8) progress marker on Execute Campaign heading
if not re.search(r"<h2[^>]*data-tour=\"progress\"", t):
    if "Execute Campaign In-App" in t:
        h = t.find("Execute Campaign In-App")
        h2 = t.rfind("<h2", max(0, h - 400), h)
        if h2 >= 0 and 'data-tour="progress"' not in t[h2:h]:
            t = t[:h2] + t[h2:].replace("<h2", '<h2 data-tour="progress"', 1)
            print("progress marker")

if t == orig:
    print("NO CHANGES")
else:
    app.write_text(t)
    print("app.tsx updated", len(t))
