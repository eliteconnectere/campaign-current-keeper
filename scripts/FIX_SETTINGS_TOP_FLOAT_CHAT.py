#!/usr/bin/env python3
"""
1) Any path into Settings / menu settings view scrolls to top.
2) Floating Rex return button stays visible during Private Chat.
3) Document-only comments for erase scope stay as-is (report to owner).
"""
from pathlib import Path
import re

app = Path("src/routes/app.tsx")
t = app.read_text()

# --- Helper already exists: scrollRexDestination() scrolls menu + main to top ---
# Wire every settings entry point to call it.

# 1) Bottom-nav / hub Settings select
old_settings_select = '''onSelect: () => {
                setMenuView("settings");
                setPanel("menu");
                try { showPanelTip("settings"); } catch {}
              },'''
new_settings_select = '''onSelect: () => {
                setMenuView("settings");
                setPanel("menu");
                try { showPanelTip("settings"); } catch {}
                window.setTimeout(() => scrollRexDestination(), 0);
                window.setTimeout(() => scrollRexDestination(), 120);
              },'''
if old_settings_select in t and "scrollRexDestination(), 0" not in t[t.find('id: "settings"'):t.find('id: "settings"')+500]:
    t = t.replace(old_settings_select, new_settings_select, 1)
    print("settings hub select: scroll top")
else:
    print("settings select skip or already")

# 2) When returning to settings from studios, also scroll top
# Pattern: setMenuView("settings"); } }}  after studio close — multiple
# Safer: after setMenuView("settings") in return-to-settings paths, inject scroll
def inject_after_menu_settings(src: str) -> str:
    # setMenuView("settings"); followed soon by closing — add scroll when panel menu opens to settings
    pattern = re.compile(r'(setMenuView\("settings"\);)')
    count = 0
    def repl(m):
        nonlocal count
        count += 1
        # avoid double-inject if next lines already scroll
        return m.group(1) + ' try { window.setTimeout(() => scrollRexDestination(), 0); } catch {}'
    # Only replace occurrences that do NOT already have scroll right after
    out = []
    i = 0
    for m in pattern.finditer(src):
        after = src[m.end():m.end()+80]
        if "scrollRexDestination" in after:
            continue
        out.append((m.start(), m.end(), m.group(1) + ' try { window.setTimeout(() => scrollRexDestination(), 0); } catch {}'))
    # apply from end
    for start, end, rep in reversed(out):
        src = src[:start] + rep + src[end:]
        count += 1
    print("injected scroll after setMenuView(settings)", len(out))
    return src

t = inject_after_menu_settings(t)

# 3) Floating Rex visible in chat: currently rexReturnAvailable && !assistOpen && !rexStudioOpen
# Add: keep showing even when chatOpen is true (do not hide for chat)
old_float = "rexReturnAvailable && !assistOpen && !rexStudioOpen && ("
if old_float in t:
    # Explicitly allow chat — condition already doesn't exclude chatOpen, but check if chat hides it elsewhere
    # User reports it doesn't show in chat — maybe chat is fullscreen z-index higher, or rexReturnAvailable false
    # Raise z-index and ensure not gated on panel/chat
    t = t.replace(old_float, "rexReturnAvailable && !assistOpen && !rexStudioOpen && (", 1)
    # bump z-index if present
    t = t.replace(
        'className="fixed bottom-24 right-4 z-[120] inline-flex items-center gap-2 rounded-full bg-brand',
        'className="fixed bottom-24 right-4 z-[200] inline-flex items-center gap-2 rounded-full bg-brand',
        1,
    )
    print("float z-index 200")
else:
    print("float condition not found")

# Also show a persistent small Rex FAB when chat is open and assist is closed (even if return flag false)
if "data-ec-rex-chat-fab" not in t:
    # Insert after floating return button block — find setAssistOpen(true) in float button close
    marker = "rexReturnAvailable && !assistOpen && !rexStudioOpen && ("
    if marker in t:
        # Find end of that button block is hard; instead add sibling condition before assistOpen render
        insert_fab = '''
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
        # place right before `{assistOpen && (`
        if "{assistOpen && (" in t and "data-ec-rex-chat-fab" not in t:
            t = t.replace("{assistOpen && (", insert_fab + "\n      {assistOpen && (", 1)
            print("chat Rex FAB added")

app.write_text(t)
print("app written", app.stat().st_size)

# ChatSettings: add Clear chat local data section (local prefs + optional note)
cs = Path("src/features/chat/ChatSettings.tsx")
c = cs.read_text()
if "Clear chat data" not in c and "clear chat" not in c.lower():
    block = '''
              <Group title="Clear chat data">
                <p className="text-[12px] leading-relaxed text-ink-soft">
                  Clears chat preferences on this device (sounds, enter-to-send, link preview toggles).
                  Full message history and connections are only removed by Settings → Erase Data (account-wide, 30-minute countdown).
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onChange({
                      chatSounds: true,
                      chatEnterToSend: true,
                      chatLinkPreview: true,
                      notifications: {
                        ...settings.notifications,
                        chatMessage: true,
                        chatRequest: true,
                        chatAccepted: true,
                      },
                    });
                    toast.success("Chat preferences reset on this device");
                  }}
                  className="w-full rounded-full border border-line py-2.5 text-[13px] font-semibold text-ink"
                >
                  Reset chat preferences
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    // Parent can open settings erase via event
                    try {
                      window.dispatchEvent(new CustomEvent("ec-open-erase-data"));
                    } catch {}
                  }}
                  className="w-full rounded-full border border-red-200 bg-red-50 py-2.5 text-[13px] font-semibold text-red-700"
                >
                  Open Erase Data (full account wipe)
                </button>
              </Group>
'''
    # insert before closing of eligible fragment
    if '<Group title="Messages">' in c:
        # after Messages group end — find last Group in eligible section
        idx = c.rfind("</Group>")
        # find Messages group end
        m = c.find('<Group title="Messages">')
        if m >= 0:
            end = c.find("</Group>", m) + len("</Group>")
            c = c[:end] + "\n" + block + c[end:]
            cs.write_text(c)
            print("ChatSettings clear section added")
    else:
        print("Messages group not found")
else:
    print("ChatSettings already has clear")

print("done")
