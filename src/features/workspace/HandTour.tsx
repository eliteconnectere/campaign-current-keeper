import { resetDidYouKnow } from "@/features/workspace/DidYouKnow";
import { useEffect, useState } from "react";
import { X } from "lucide-react";

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

/** Ordered walkthrough. Every target must match a real data-tour on the page. */
export const ELITE_TIPS: Tip[] = [
  { id: "open-engine", target: "engine", when: "both", title: "Open Elite Engine", body: "Tap Elite Engine to send from your connected Gmail accounts. Standard mode uses your device mail app instead." },
  { id: "connect", target: "connect", when: "elite", title: "Connect a Gmail account", body: "Tap Connect with Google and choose a Gmail you own. Prefer a trusted account.", link: { href: "/learn-more#gmail-profiles", label: "Multi-account & safety" } },
  { id: "identify", target: "profiles", when: "elite", title: "Your connected Gmail accounts", body: "Each row is one address. ACTIVE is sending, STANDBY is next, EXHAUSTED hit today's limit." },
  { id: "active-profile", target: "active-profile", when: "elite", title: "Active sending profile", body: "The ACTIVE profile is used for sends. Long-press a row for profile actions when available." },
  { id: "prepare", target: "recipients", when: "both", title: "Add recipients first", body: "Paste emails into the recipients box (or use Smart Fill) before Validate." },
  { id: "smartfill", target: "smartfill", when: "both", title: "Smart Fill", body: "Smart Fill helps build a recipient list quickly. You can still paste or import manually." },
  { id: "templates", target: "templates", when: "both", title: "Write your message", body: "Set subject and body before you validate or change delay. Use {name} and {company} for personal lines." },
  { id: "results", target: "validate", when: "both", title: "Validate after list + message", body: "Tap Validate & Clean List after recipients and message are ready. Risky addresses can move to the vault." },
  { id: "settings-pace", target: "pace", when: "elite", title: "Choose sending pace", body: "Pick the delay between emails. About 3–5 seconds is recommended.", link: { href: "/learn-more#pacing-delay", label: "Why pacing matters" } },
  { id: "campaign-protection", target: "campaign-protection", when: "elite", title: "Campaign protection", body: "Permanent Send Protection and related rules help avoid duplicate sends." },
  { id: "start", target: "execute", when: "elite", title: "Start the campaign", body: "Tap Execute Campaign. Confirm consent if asked. Sending starts from the ACTIVE Gmail." },
  { id: "status", target: "progress", when: "elite", title: "Follow progress", body: "Progress shows SENDING, PAUSED or IDLE. Pause or Reset from the same area when allowed." },
  { id: "menu-hub", target: "menu", when: "both", title: "Workspace menu", body: "The menu opens Settings, tools, billing shortcuts, and account actions." },
  { id: "settings-hub", target: "settings-entry", when: "both", title: "Settings", body: "Settings holds notifications, sounds, protection, customization, and account tools. Opening Settings does not start this tip by itself." },
  { id: "radar-hub", target: "radar", when: "elite", title: "Elite Radar Hub", body: "Radar is campaign health: progress, quarantine vault, and snippets." },
  { id: "private-chat", target: "chat", when: "elite", title: "Private Chat", body: "Private Chat is for people on your workspace (eligible plans)." },
  { id: "custom-studio", target: "studio", when: "elite", title: "Customization & Night Mode", body: "Interface Studio and Night Mode change appearance only — not how Elite Engine sends." },
  { id: "notifications-bell", target: "bell", when: "both", title: "Notification center", body: "The bell is your in-app alert inbox. Preferences live under Settings → Notification and Sound Management." },
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
  if (on) localStorage.removeItem(OFF_KEY);
  else localStorage.setItem(OFF_KEY, "1");
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

export function showTip(id: string) {
  window.dispatchEvent(new CustomEvent("ec:show-tip", { detail: id }));
}

export const PANEL_TIPS: Record<string, string> = {
  radar: "radar-hub",
  chat: "private-chat",
  studio: "custom-studio",
};

/** Opening Settings must never force a tip. */
export function showPanelTip(panel: string) {
  if (panel === "settings") return;
  const id = PANEL_TIPS[panel];
  if (id) showTip(id);
}

export function EliteTips({ mode, active }: { mode: "standard" | "elite" | "both"; active: boolean }) {
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
        : ELITE_TIPS.filter((t) => (mode === "both" || t.when === "both" || t.when === mode) && !dismissed.includes(t.id));
      for (const tip of pending) {
        const el = document.querySelector<HTMLElement>(`[data-tour="${tip.target}"]`);
        if (!el) {
          if (forcedTip) return setCur({ tip, rect: null, n: ELITE_TIPS.indexOf(tip) + 1 });
          continue;
        }
        const rect = visible(el);
        if (!rect && scrolled !== tip.id) {
          scrolled = tip.id;
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        if (rect) return setCur({ tip, rect, n: ELITE_TIPS.indexOf(tip) + 1 });
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
          <div aria-hidden className="pointer-events-none fixed z-[65] rounded-xl ring-2 ring-brand transition-all" style={{ left: rect.left - 4, top: rect.top - 4, width: rect.width + 8, height: rect.height + 8 }} />
          <div aria-hidden className="pointer-events-none fixed z-[66] animate-bounce text-3xl" style={{ left: rect.left + rect.width / 2 - 14, top: below ? rect.bottom - 6 : rect.top - 34 }}>
            {below ? "👆" : "👇"}
          </div>
        </>
      )}
      <div role="dialog" aria-label={tip.title} className="fixed left-1/2 z-[66] w-[min(330px,92vw)] -translate-x-1/2 animate-fade-in rounded-2xl border border-line bg-card p-3 shadow-lg" style={{ top: below && rect ? top + 26 : top }}>
        <div className="flex items-start justify-between gap-2">
          <p className="text-[13.5px] font-bold text-ink">{tip.title}</p>
          <button type="button" onClick={dismiss} aria-label="Close tip" className="text-ink-soft"><X className="size-4" /></button>
        </div>
        <p className="mt-1 text-[12.5px] leading-snug text-ink-soft">{tip.body}</p>
        {!rect && (
          <p className="mt-1 text-[11.5px] font-semibold text-brand">This control is not on screen yet — finish earlier steps or open the matching panel, then continue.</p>
        )}
        {tip.link && (
          <a href={tip.link.href} target="_blank" rel="noreferrer" className="mt-1.5 inline-block text-[12px] font-semibold text-brand underline">{tip.link.label}</a>
        )}
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[10.5px] font-semibold text-ink-soft">Step {n}/{ELITE_TIPS.length}</span>
          <button type="button" onClick={hideAll} className="ml-auto text-[11.5px] font-semibold text-ink-soft underline">Turn tips off</button>
          <button type="button" onClick={dismiss} className="rounded-full bg-brand px-3 py-1 text-[12px] font-semibold text-primary-foreground">{forced ? "Done" : "Next"}</button>
        </div>
      </div>
    </>
  );
}
