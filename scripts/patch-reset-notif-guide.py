#!/usr/bin/env python3
"""
1) Execute-area Reset must call resetWorkspace (same as menu Reset workspace)
2) Clear notifications with confirmation
3) Wire Gmail connect/disconnect logs to NotificationKind + sounds
4) Expand HandTour tips for radar / settings / chat / customization
5) Trigger contextual tips when those panels open
"""
from pathlib import Path
import re

app = Path("src/routes/app.tsx")
text = app.read_text(encoding="utf-8")
original = text

# Import showPanelTip
if "showPanelTip" not in text:
    text = text.replace(
        'import { EliteTips, ELITE_TIPS, resetTour, setTourEnabled, tourDismissed } from "@/features/workspace/HandTour";',
        'import { EliteTips, ELITE_TIPS, resetTour, setTourEnabled, tourDismissed, showPanelTip } from "@/features/workspace/HandTour";',
    )
    # older import shapes
    if "showPanelTip" not in text:
        text = text.replace(
            'import { EliteTips, ELITE_TIPS, resetTour } from "@/features/workspace/HandTour";',
            'import { EliteTips, ELITE_TIPS, resetTour, setTourEnabled, tourDismissed, showPanelTip } from "@/features/workspace/HandTour";',
        )
    print("✓ import showPanelTip")

# ---------------------------------------------------------------------------
# 1. Fix mislabeled Reset near Execute (was pause-only)
# ---------------------------------------------------------------------------
old_reset = '''                  <button
                    onClick={() => {
                      setEngine("idle");
                      setScout(false);
                      log("Campaign paused. Tap Reset before a full new run, or Execute to continue remaining unsent rows.");
                    }}
                    className="flex items-center gap-1.5 rounded-full border border-line px-3.5 py-2 text-[12.5px] font-semibold text-ink"
                  >
                    <RotateCcw className="size-3.5" /> Reset
                  </button>'''

new_reset = '''                  <button
                    onClick={() => {
                      if (engine === "sending") {
                        setEngine("idle");
                        setScout(false);
                        log("Campaign paused — remaining unsent rows stay ready. Tap Execute to continue, or Reset again to clear the workspace run.", "campaignPaused");
                        return;
                      }
                      if (!window.confirm("Reset this campaign run? Clears the list, progress, and client send locks (same as Reset workspace). Server still blocks the exact same message to the same address.")) return;
                      resetWorkspace();
                      log("Workspace run reset — list and progress cleared. Permanent Send Protection still blocks exact duplicate message+recipient on the server.", "campaignPaused");
                      toast.success("Campaign reset");
                    }}
                    className="flex items-center gap-1.5 rounded-full border border-line px-3.5 py-2 text-[12.5px] font-semibold text-ink"
                  >
                    <RotateCcw className="size-3.5" /> Reset
                  </button>'''

if old_reset in text:
    text = text.replace(old_reset, new_reset, 1)
    print("✓ Execute Reset now pauses while sending, else full resetWorkspace")
else:
    text2 = re.sub(
        r'<button\s+onClick=\{\(\) => \{\s*setEngine\("idle"\);\s*setScout\(false\);\s*log\("Campaign paused\.[^"]*"\);\s*\}\}\s*className="[^"]*"\s*>\s*<RotateCcw className="size-3\.5" /> Reset\s*</button>',
        new_reset.strip(),
        text,
        count=1,
        flags=re.S,
    )
    if text2 != text:
        text = text2
        print("✓ Execute Reset fixed via regex")
    else:
        print("· Execute Reset pattern not found")

# ---------------------------------------------------------------------------
# 2. Wire Gmail log kinds so toggles + sounds fire
# ---------------------------------------------------------------------------
for a, b in [
    ('log(`Gmail profile connected — ${result.email}`)', 'log(`Gmail profile connected — ${result.email}`, "gmailAuth")'),
    ('log(`Gmail connection failed — ${msg}`)', 'log(`Gmail connection failed — ${msg}`, "gmailAuth")'),
    ('log(`Gmail profile disconnected — ${email}`)', 'log(`Gmail profile disconnected — ${email}`, "gmailDisconnected")'),
]:
    if a in text and b not in text:
        text = text.replace(a, b, 1)
        print(f"✓ wired log kind")

# ---------------------------------------------------------------------------
# 3. Clear notifications with confirmation
# ---------------------------------------------------------------------------
if "Clear all" not in text and "{notes.map" in text:
    old_hdr = '''              <div className="flex items-center justify-between">
                <span className="label-caps">Notifications</span>
                <button onClick={() => setPanel("none")} aria-label="Close">
                  <X className="size-3.5 text-ink-soft" />
                </button>
              </div>'''
    new_hdr = '''              <div className="flex items-center justify-between gap-2">
                <span className="label-caps">Notifications</span>
                <div className="flex items-center gap-2">
                  {notes.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!window.confirm("Clear all notifications in this list?")) return;
                        setNotes([]);
                        toast.success("Notifications cleared");
                      }}
                      className="text-[11px] font-semibold text-brand underline"
                    >
                      Clear all
                    </button>
                  )}
                  <button type="button" onClick={() => setPanel("none")} aria-label="Close">
                    <X className="size-3.5 text-ink-soft" />
                  </button>
                </div>
              </div>'''
    if old_hdr in text:
        text = text.replace(old_hdr, new_hdr, 1)
        print("✓ Clear all on bell panel")

if "Clear activity notifications" not in text and "{NOTIFICATION_KINDS.map(([key, label]) => (" in text:
    inject = '''
                      <div className="border-b border-line px-3.5 py-3">
                        <button
                          type="button"
                          onClick={() => {
                            if (!window.confirm("Clear all activity notifications shown under the bell?")) return;
                            setNotes([]);
                            toast.success("Notifications cleared");
                          }}
                          className="w-full rounded-xl border border-line bg-soft py-2.5 text-[12.5px] font-semibold text-ink"
                        >
                          Clear activity notifications
                        </button>
                        <p className="mt-1.5 text-[11px] leading-snug text-ink-soft">
                          Removes the in-app notification list. Does not change sound or alert toggles.
                        </p>
                      </div>
                      '''
    text = text.replace(
        "{NOTIFICATION_KINDS.map(([key, label]) => (",
        inject + "{NOTIFICATION_KINDS.map(([key, label]) => (",
        1,
    )
    print("✓ Clear activity notifications in settings")

# ---------------------------------------------------------------------------
# 5. showPanelTip when opening radar / chat / settings
# ---------------------------------------------------------------------------
if "showPanelTip(\"radar\")" not in text and "setRadarOpen(true)" in text:
    text = text.replace("setRadarOpen(true)", "setRadarOpen(true); showPanelTip(\"radar\")")
    # avoid double on every occurrence - only intentional UI opens; ok if a few
    print("✓ showPanelTip radar")
if "showPanelTip(\"chat\")" not in text and "setChatOpen(true)" in text:
    # only first / main chat openers - replace carefully once for MagicCircle style
    text = re.sub(
        r"onSelect:\s*\(\)\s*=>\s*setChatOpen\(true\)",
        'onSelect: () => { setChatOpen(true); showPanelTip("chat"); }',
        text,
        count=3,
    )
    print("✓ showPanelTip chat")
if "showPanelTip(\"settings\")" not in text:
    text = text.replace(
        'setMenuView("settings");\n                setPanel("menu");',
        'setMenuView("settings");\n                setPanel("menu");\n                showPanelTip("settings");',
    )
    text = text.replace(
        "setMenuView(\"settings\");\n                setPanel(\"menu\");",
        "setMenuView(\"settings\");\n                setPanel(\"menu\");\n                showPanelTip(\"settings\");",
    )
    print("✓ showPanelTip settings")

if text != original:
    app.write_text(text, encoding="utf-8")
    print(f"Saved app.tsx ({len(text)} bytes)")
else:
    print("app.tsx unchanged")

# ---------------------------------------------------------------------------
# HandTour expand
# ---------------------------------------------------------------------------
hand = Path("src/features/workspace/HandTour.tsx")
if hand.exists():
    ht = hand.read_text(encoding="utf-8")
    ht0 = ht
    if 'id: "radar-hub"' not in ht:
        extra = '''
  {
    id: "radar-hub",
    target: "radar",
    when: "elite",
    title: "Elite Radar Hub",
    body: "Radar is your campaign health board: progress, quarantine vault, and short message ideas. Open it from the floating wheel when you want status without leaving the workspace.",
  },
  {
    id: "settings-hub",
    target: "settings-entry",
    when: "elite",
    title: "Settings & workspace tools",
    body: "Settings holds notification sounds, protection, customization, and account tools. Open the hamburger → Settings. Turn Workspace tips off here if you already know the flow.",
  },
  {
    id: "private-chat",
    target: "chat",
    when: "elite",
    title: "Private Chat",
    body: "Chat is for people on your workspace (Premium / ProMaxx). Unread counts show on the floating wheel. Sounds follow Chat sound toggles under Notification and Sound Management.",
  },
  {
    id: "custom-studio",
    target: "studio",
    when: "elite",
    title: "Customization & Night Mode",
    body: "You can try Studio styling for a limited free window. After that, editing colours and Night Mode needs an eligible plan. Appearance never changes how Elite Engine sends.",
  },'''
        ht = ht.replace(
            "  },\n];\n\nfunction readDismissed",
            "  }," + extra + "\n];\n\nfunction readDismissed",
            1,
        )
        print("✓ expanded ELITE_TIPS")
    if "export function showPanelTip" not in ht:
        ht = ht.replace(
            'export function showTip(id: string) {\n  window.dispatchEvent(new CustomEvent("ec:show-tip", { detail: id }));\n}',
            '''export function showTip(id: string) {
  window.dispatchEvent(new CustomEvent("ec:show-tip", { detail: id }));
}

export const PANEL_TIPS: Record<string, string> = {
  radar: "radar-hub",
  settings: "settings-hub",
  chat: "private-chat",
  studio: "custom-studio",
};

export function showPanelTip(panel: string) {
  const id = PANEL_TIPS[panel];
  if (id) showTip(id);
}
''',
        )
        print("✓ showPanelTip helper")
    if ht != ht0:
        hand.write_text(ht, encoding="utf-8")
        print("Saved HandTour.tsx")

print("Done.")
