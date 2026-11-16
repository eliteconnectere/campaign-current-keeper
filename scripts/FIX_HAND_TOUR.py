#!/usr/bin/env python3
"""
Fix HandTour:
- Only tip targets that exist on real DOM (or we add the data-tour)
- Ordered workspace walkthrough
- Opening Settings must NOT force a floating tip (rubbish)
- Add missing data-tour markers on recipients, templates, progress, execute, settings row
"""
from pathlib import Path
import re

hand = Path("src/features/workspace/HandTour.tsx")

NEW_TOUR = r'''import { resetDidYouKnow } from "@/features/workspace/DidYouKnow";
import { useEffect, useState } from "react";
import { X } from "lucide-react";

/** Contextual Elite Engine guide: one short tip at a time, only where the user is. */
const DISMISS_KEY = "ec.tips.dismissed.v5";
const OFF_KEY = "ec.tips.off.v5";

type Tip = {
  id: string;
  target: string;
  when: "standard" | "elite" | "both";
  title: string;
  body: string;
  link?: { href: string; label: string };
};

/**
 * Ordered workspace walkthrough. Every `target` must match a real data-tour= on the page.
 * Sequence: mode → connect → profiles → recipients → smart fill → message → validate → pace → protection → execute → progress → menu → settings → radar → chat → studio.
 */
export const ELITE_TIPS: Tip[] = [
  {
    id: "open-engine",
    target: "engine",
    when: "both",
    title: "Open Elite Engine",
    body: "Tap Elite Engine to send from your connected Gmail accounts. Standard mode uses your device mail app instead.",
  },
  {
    id: "connect",
    target: "connect",
    when: "elite",
    title: "Connect a Gmail account",
    body: "Tap Connect with Google and choose a Gmail you own. Prefer a trusted account — Google may limit reconnection if the account is restricted.",
    link: { href: "/learn-more#gmail-profiles", label: "Multi-account & safety" },
  },
  {
    id: "identify",
    target: "profiles",
    when: "elite",
    title: "Your connected Gmail accounts",
    body: "Each row is one address. ACTIVE is sending, STANDBY is next, EXHAUSTED hit today's limit. Numbers show sent / daily limit.",
  },
  {
    id: "active-profile",
    target: "active-profile",
    when: "elite",
    title: "Active sending profile",
    body: "The ACTIVE profile is the one currently used for sends. Long-press a row for profile actions when available.",
  },
  {
    id: "prepare",
    target: "recipients",
    when: "both",
    title: "Add recipients first",
    body: "Paste emails into the recipients box (or use Smart Fill). Build the list here before Validate — an empty box cannot be cleaned usefully.",
  },
  {
    id: "smartfill",
    target: "smartfill",
    when: "both",
    title: "Smart Fill",
    body: "Smart Fill helps build a recipient list quickly. Use it when you need a structured list; you can still paste or import manually.",
  },
  {
    id: "templates",
    target: "templates",
    when: "both",
    title: "Write your message",
    body: "Set subject and body before you validate or change delay. Use {name} and {company} for personal lines. 2-Way Generation can alternate two versions.",
  },
  {
    id: "results",
    target: "validate",
    when: "both",
    title: "Validate after list + message",
    body: "Only after recipients and message are ready: tap Validate & Clean List. Invalid and risky addresses can move to the vault.",
  },
  {
    id: "settings-pace",
    target: "pace",
    when: "elite",
    title: "Choose sending pace",
    body: "Pick the delay between emails after the list is clean. About 3–5 seconds is recommended. Very fast Elite sending can get a Gmail restricted.",
    link: { href: "/learn-more#pacing-delay", label: "Why pacing matters" },
  },
  {
    id: "campaign-protection",
    target: "campaign-protection",
    when: "elite",
    title: "Campaign protection",
    body: "Permanent Send Protection and related rules help avoid duplicate sends. Review this block before a large run.",
  },
  {
    id: "start",
    target: "execute",
    when: "elite",
    title: "Start the campaign",
    body: "Tap Execute Campaign. Confirm consent if asked. Sending starts from the ACTIVE Gmail profile.",
  },
  {
    id: "status",
    target: "progress",
    when: "elite",
    title: "Follow progress",
    body: "Progress shows SENDING, PAUSED or IDLE. Rows become Sent only after Gmail confirms. Pause or Reset from the same area when allowed.",
  },
  {
    id: "menu-hub",
    target: "menu",
    when: "both",
    title: "Workspace menu",
    body: "The menu opens Settings, tools, billing shortcuts, and account actions. Use it when you need Settings without searching.",
  },
  {
    id: "settings-hub",
    target: "settings-entry",
    when: "both",
    title: "Settings",
    body: "Settings holds notifications, sounds, protection, customization, Gmail profiles, and account tools. Open it from the menu — not from a search tip.",
  },
  {
    id: "radar-hub",
    target: "radar",
    when: "elite",
    title: "Elite Radar Hub",
    body: "Radar is campaign health: progress, quarantine vault, and snippets. Open it from the floating wheel when you want status without leaving the workspace.",
  },
  {
    id: "private-chat",
    target: "chat",
    when: "elite",
    title: "Private Chat",
    body: "Private Chat is for people on your workspace (eligible plans). Unread counts can show on the wheel. Chat sounds live under Notification and Sound Management.",
  },
  {
    id: "custom-studio",
    target: "studio",
    when: "elite",
    title: "Customization & Night Mode",
    body: "Interface Studio and Night Mode change appearance only. They never change how Elite Engine sends.",
  },
  {
    id: "notifications-bell",
    target: "bell",
    when: "both",
    title: "Notification center",
    body: "The bell is your in-app alert inbox. Notification preferences (what can notify you) live under Settings → Notification and Sound Management.",
  },
];

function readDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function tourDismissed() {
  return typeof window !== "undefined" && localStorage.getItem(OFF_KEY) === "1";
}

export function setTourEnabled(on: boolean) {
  if (typeof window === "undefined") return;
  if (on) {
    localStorage.removeItem(OFF_KEY);
  } else {
    localStorage.setItem(OFF_KEY, "1");
  }
  window.dispatchEvent(new Event("ec:tips-reset"));
}

export function resetTour() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(DISMISS_KEY);
  localStorage.removeItem(OFF_KEY);
  try { resetDidYouKnow(); } catch {}
  window.dispatchEvent(new Event("ec:tips-reset"));
}

function visible(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.bottom > 60 && r.top < window.innerHeight - 60 ? r : null;
}

/** Jump to one exact step (explicit walkthrough only). */
export function showTip(id: string) {
  window.dispatchEvent(new CustomEvent("ec:show-tip", { detail: id }));
}

/** Panel map — only used when something explicitly asks for a panel tip. */
export const PANEL_TIPS: Record<string, string> = {
  radar: "radar-hub",
  // settings intentionally omitted: opening Settings must not spawn a tip
  chat: "private-chat",
  studio: "custom-studio",
};

export function showPanelTip(panel: string) {
  // Opening Settings / searching Settings must never force a tip.
  if (panel === "settings") return;
  const id = PANEL_TIPS[panel];
  if (id) showTip(id);
}

/**
 * Step-by-step guide. One tip at a time. Only shows when the target element exists and is on-screen
 * (or can be scrolled into view). Forced tips from walkthrough still work; Settings open does not force.
 */
export function EliteTips({ mode, active }: { mode: "standard" | "elite"; active: boolean }) {
  const [dismissed, setDismissed] = useState<string[]>(() =>
    typeof window !== "undefined" ? readDismissed() : [],
  );
  const [off, setOff] = useState(() => (typeof window !== "undefined" ? tourDismissed() : false));
  const [forced, setForced] = useState<string | null>(null);
  const [cur, setCur] = useState<{ tip: Tip; rect: DOMRect | null; n: number } | null>(null);

  useEffect(() => {
    setDismissed(readDismissed());
    setOff(tourDismissed());
    const on = (e: Event) => {
      setForced((e as CustomEvent<string>).detail);
      setOff(false);
    };
    window.addEventListener("ec:show-tip", on);
    const onReset = () => {
      setDismissed(readDismissed());
      setOff(tourDismissed());
      setForced(null);
    };
    window.addEventListener("ec:tips-reset", onReset);
    return () => {
      window.removeEventListener("ec:show-tip", on);
      window.removeEventListener("ec:tips-reset", onReset);
    };
  }, []);

  useEffect(() => {
    const onConnected = () => {
      if (tourDismissed()) return;
      const done = readDismissed();
      if (done.length < ELITE_TIPS.length) {
        resetTour();
        setDismissed([]);
        setOff(false);
      }
    };
    window.addEventListener("ec:gmail-connected", onConnected);
    return () => window.removeEventListener("ec:gmail-connected", onConnected);
  }, []);

  useEffect(() => {
    if (!active || (off && !forced)) {
      setCur(null);
      return;
    }
    let scrolled = "";
    const check = () => {
      const forcedTip = forced ? ELITE_TIPS.find((t) => t.id === forced) : undefined;
      const pending = forcedTip
        ? [forcedTip]
        : ELITE_TIPS.filter(
            (t) =>
              (t.when === "both" || t.when === mode) &&
              !dismissed.includes(t.id),
          );
      for (const tip of pending) {
        const el = document.querySelector<HTMLElement>(`[data-tour="${tip.target}"]`);
        if (!el) {
          // Skip missing targets in normal flow so the tour never points at empty air.
          // Forced walkthrough may still show a card explaining the area is not visible yet.
          if (forcedTip) return setCur({ tip, rect: null, n: ELITE_TIPS.indexOf(tip) + 1 });
          continue;
        }
        const rect = visible(el);
        if (!rect && scrolled !== tip.id) {
          scrolled = tip.id;
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        if (rect) return setCur({ tip, rect, n: ELITE_TIPS.indexOf(tip) + 1 });
        // Element exists but still off-screen after scroll attempt — wait for next tick
        return;
      }
      setCur(null);
    };
    check();
    const id = window.setInterval(check, 600);
    window.addEventListener("scroll", check, true);
    window.addEventListener("resize", check);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("scroll", check, true);
      window.removeEventListener("resize", check);
    };
  }, [active, off, mode, dismissed, forced]);

  if (!cur) return null;
  const { tip, rect, n } = cur;
  const vh = window.innerHeight;
  const below = rect ? rect.bottom < vh * 0.55 : true;
  const top = !rect ? vh * 0.35 : below ? Math.min(rect.bottom + 10, vh - 200) : Math.max(rect.top - 190, 10);

  const dismiss = () => {
    if (forced) return setForced(null);
    const next = [...dismissed, tip.id];
    localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
    setDismissed(next);
  };
  const hideAll = () => {
    localStorage.setItem(OFF_KEY, "1");
    setForced(null);
    setOff(true);
  };

  return (
    <>
      {rect && (
        <>
          <div
            aria-hidden
            className="pointer-events-none fixed z-[65] rounded-xl ring-2 ring-brand transition-all"
            style={{ left: rect.left - 4, top: rect.top - 4, width: rect.width + 8, height: rect.height + 8 }}
          />
          <div
            aria-hidden
            className="pointer-events-none fixed z-[66] animate-bounce text-3xl"
            style={{ left: rect.left + rect.width / 2 - 14, top: below ? rect.bottom - 6 : rect.top - 34 }}
          >
            {below ? "👆" : "👇"}
          </div>
        </>
      )}
      <div
        role="dialog"
        aria-label={tip.title}
        className="fixed left-1/2 z-[66] w-[min(330px,92vw)] -translate-x-1/2 animate-fade-in rounded-2xl border border-line bg-card p-3 shadow-lg"
        style={{ top: below && rect ? top + 26 : top }}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-[13.5px] font-bold text-ink">{tip.title}</p>
          <button type="button" onClick={dismiss} aria-label="Close tip" className="text-ink-soft">
            <X className="size-4" />
          </button>
        </div>
        <p className="mt-1 text-[12.5px] leading-snug text-ink-soft">{tip.body}</p>
        {!rect && (
          <p className="mt-1 text-[11.5px] font-semibold text-brand">
            This control is not on screen yet — finish the earlier steps or open the matching panel, then continue.
          </p>
        )}
        {tip.link && (
          <a
            href={tip.link.href}
            target="_blank"
            rel="noreferrer"
            className="mt-1.5 inline-block text-[12px] font-semibold text-brand underline"
          >
            {tip.link.label}
          </a>
        )}
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[10.5px] font-semibold text-ink-soft">
            Step {n}/{ELITE_TIPS.length}
          </span>
          <button type="button" onClick={hideAll} className="ml-auto text-[11.5px] font-semibold text-ink-soft underline">
            Turn tips off
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-full bg-brand px-3 py-1 text-[12px] font-semibold text-primary-foreground"
          >
            {forced ? "Done" : "Next"}
          </button>
        </div>
      </div>
    </>
  );
}
'''

hand.write_text(NEW_TOUR)
print("HandTour rewritten", len(ELITE_TIPS := 18), "tips")

# --- app.tsx: add missing data-tour markers + stop settings tip ---
app = Path("src/routes/app.tsx")
t = app.read_text()

# 1) Remove showPanelTip("settings") from settings open
t2 = t.replace('try { showPanelTip("settings"); } catch {}', "/* settings open: no forced tip */")
if t2 != t:
    print("removed settings showPanelTip")
    t = t2

# 2) data-tour on recipients heading (has data-ec-recipients already)
if 'data-tour="recipients"' not in t:
    t = t.replace(
        'h2 data-ec-recipients className=',
        'h2 data-ec-recipients data-tour="recipients" className=',
        1,
    )
    print("recipients marker")

# 3) templates marker — find subject/body card
if 'data-tour="templates"' not in t or t.count('data-tour="templates"') == 0:
    # try common patterns
    if 'tourId="templates"' in t:
        print("templates via tourId already")
    else:
        # Card with templates tourId
        if 'tourId="templates"' not in t and 'Subject' in t:
            # attach near first templates-related card
            pass

# Search for Message / Subject section without data-tour templates on element
if re.search(r'data-tour="templates"', t) is None or t.count('data-tour="templates"') < 1:
    # Inject on a known templates wrapper if present
    for pat in [
        ('data-tour="templates"', None),  # already?
    ]:
        pass
    if 'data-tour="templates"' not in t:
        # Look for 2-Way or Subject label area
        if 'tourId="templates"' in t:
            t = t.replace('tourId="templates"', 'tourId="templates" data-tour="templates"', 1)
            print("templates via tourId attr")
        elif re.search(r'(Subject|Message body|Templates)', t):
            # Add near validate's sibling - hard; use Card tourId pattern
            t = t.replace(
                'tourId="templates"',
                'tourId="templates"',
                1,
            )

# Force templates: if Card uses tourId prop
if 'tourId="templates"' in t and 'data-tour="templates"' not in t:
    # Card component sets data-tour={tourId} — so tourId="templates" already creates data-tour="templates"
    print("Card tourId templates OK")

# 4) execute + progress markers on buttons/sections
if re.search(r'<[^>]*data-tour="execute"', t) is None:
    # Find Execute Campaign button text
    old = '{engine === "paused" ? "Resume Campaign" : "Execute Campaign"}'
    if old in t and 'data-tour="execute"' not in t[t.find(old)-200:t.find(old)]:
        # find button opening before this
        idx = t.find(old)
        # walk back to <button
        b = t.rfind("<button", 0, idx)
        if b > 0 and 'data-tour="execute"' not in t[b:idx]:
            t = t[:b] + t[b:].replace("<button", '<button data-tour="execute"', 1)
            print("execute on button")

if re.search(r'<[^>]*data-tour="progress"', t) is None:
    # progress area - often near engine status
    for needle in ['data-ec-campaign-progress', 'Campaign progress', 'engine === "sending"']:
        if needle in t:
            pass
    # attach to a status badge container if any
    if 'data-tour="progress"' not in t:
        # Try tourId progress on Card
        if 'tourId="progress"' in t:
            print("progress tourId exists")
        else:
            # Insert near Execute Campaign heading
            if "Execute Campaign In-App" in t:
                t = t.replace(
                    "Execute Campaign In-App",
                    'Execute Campaign In-App',
                    1,
                )
                # add data-tour on parent h2 if found
                h = t.find("Execute Campaign In-App")
                # look back for <h2
                h2 = t.rfind("<h2", max(0, h - 300), h)
                if h2 >= 0 and 'data-tour="progress"' not in t[h2:h]:
                    t = t[:h2] + t[h2:].replace("<h2", '<h2 data-tour="progress"', 1)
                    print("progress on h2")

# 5) settings-entry on Settings menu item - MenuRow for Settings in menu view
# The hub settings select is different from menu list; add data-tour on menu Settings row
if 'data-tour="settings-entry"' not in t:
    # MenuView settings section header
    if 'label-caps">Settings<' in t or ">Settings</" in t:
        # Settings back header in menu
        pass
    # When menuView is settings, the panel itself
    if 'menuView === "settings"' in t or "menuView==='settings'" in t:
        pass
    # Add on Settings hub option - the button might be generated; add dataAttr support
    # Simpler: mark the settings menu header
    t = t.replace(
        'id: "settings",
              label: "Settings",',
        'id: "settings",
              label: "Settings",
              dataTour: "settings-entry",',
        1,
    )
    # If hub renders with dataTour
    if "dataTour" in t and 'data-tour={item.dataTour' not in t and "item.dataTour" not in t:
        # try common map render for hub items
        if "item.label" in t and "item.onSelect" in t:
            # find button in hub map
            m = re.search(r'\{hubItems\.map\(|items\.map\(\(', t)
            print("hub map search", bool(m))

# Safer settings-entry: put on menu button itself is wrong; put when settings view opens
# Add data-tour on the settings scroll panel header if present
if 'data-tour="settings-entry"' not in t:
    for needle in [
        ('Workspace tips', None),
        ('Notification and Sound', None),
    ]:
        pass
    # Inject attribute on Settings section title inside menu
    if 'menuView === "settings"' in t:
        # After setMenuView settings panel - look for "Settings" title in menu
        if 'data-ec-menu-scroll' in t:
            # add to first settings header text container
            t = t.replace(
                'menuView === "settings"',
                'menuView === "settings" /* tour target below */',
                1,
            )
            # Find a Settings heading in JSX near menuView settings
            # Use MenuRow Settings in menu list - search "Settings" MenuRow
            if re.search(r'MenuRow[^>]*label="Settings"', t) is None:
                # menu settings is full page of toggles; tag the scroll container when view is settings
                t = t.replace(
                    'data-ec-menu-scroll="true"',
                    'data-ec-menu-scroll="true" data-tour={menuView === "settings" ? "settings-entry" : menuView === "main" ? "menu" : undefined}',
                    1,
                )
                print("settings-entry on menu scroll when settings")

# 6) radar / chat / studio markers on their open buttons if missing
if 'data-tour="radar"' not in t:
    # setRadarOpen(true) button
    idx = t.find("setRadarOpen(true)")
    if idx > 0:
        b = t.rfind("<button", max(0, idx - 400), idx)
        if b > 0 and 'data-tour="radar"' not in t[b:idx]:
            t = t[:b] + t[b:].replace("<button", '<button data-tour="radar"', 1)
            print("radar marker")

if 'data-tour="chat"' not in t:
    idx = t.find("setChatOpen(true)")
    if idx > 0:
        b = t.rfind("<button", max(0, idx - 500), idx)
        if b > 0 and 'data-tour="chat"' not in t[b:idx]:
            t = t[:b] + t[b:].replace("<button", '<button data-tour="chat"', 1)
            print("chat marker")

if 'data-tour="studio"' not in t:
    for needle in ["setStudioOpen(true)", "setFeatureStudio("]:
        idx = t.find(needle)
        if idx > 0:
            b = t.rfind("<button", max(0, idx - 400), idx)
            if b > 0 and 'data-tour="studio"' not in t[b:idx]:
                t = t[:b] + t[b:].replace("<button", '<button data-tour="studio"', 1)
                print("studio marker")
                break

# templates: Card with tourId
if 'tourId="templates"' not in t and 'data-tour="templates"' not in t:
    # Message subject card - search
    if 'data-tour="templates"' not in t:
        # near "Subject" input label
        m = re.search(r'(Subject\s*</|htmlFor="subject"|placeholder="Subject")', t)
        if m:
            # find nearest opening tag before
            b = t.rfind("<div", max(0, m.start() - 200), m.start())
            if b > 0:
                t = t[:b] + t[b:].replace("<div", '<div data-tour="templates"', 1)
                print("templates on div near subject")
elif 'tourId="templates"' in t:
    print("templates tourId present (Card maps to data-tour)")

# progress / execute via tourId on cards
for tid in ["progress", "execute"]:
    if f'tourId="{tid}"' in t:
        print(f"{tid} tourId present")

app.write_text(t)
print("app size", app.stat().st_size)
print("done")
