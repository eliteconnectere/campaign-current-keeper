import { useEffect, useState } from "react";

const DYK_DISMISS_KEY = "ec.dyk.dismissed.v1";
const DYK_LAST_KEY = "ec.dyk.lastShown.v1";
const DYK_INTERVAL_MS = 60 * 60 * 1000;

export type DidYouKnowTip = {
  id: string;
  title: string;
  body: string;
  place?: string;
};

export const DID_YOU_KNOW_TIPS: DidYouKnowTip[] = [
  {
    id: "rex-agent-nav",
    title: "Did you know Agent Rex can do this for you?",
    body: "Ask Rex to take you to Settings, Erase Data, Snippets, Vault, Tracker, or Campaign Monitor. It opens the real screen — not a generic chat answer.",
    place: "settings",
  },
  {
    id: "rex-agent-inspect",
    title: "Did you know Agent Rex can do this for you?",
    body: "Ask Rex what message you are sending right now. Rex can inspect your live subject, body and recipient status as part of helping you.",
  },
  {
    id: "rex-agent-hotspot",
    title: "Did you know Agent Rex can do this for you?",
    body: "Share Hotspot access from chat: give the email (and Gmail seat limit if you want). Approve once and Rex invites them — or open Hotspot manually.",
    place: "hotspot",
  },
  {
    id: "rex-agent-monitor",
    title: "Did you know Agent Rex can do this for you?",
    body: "Turn on Campaign Monitor in Rex Studio for the current run only. Rex can keep it going across leave or logout until you turn Monitor off in Studio.",
    place: "rex-monitor",
  },
  {
    id: "rex-agent-guide",
    title: "Did you know Agent Rex can do this for you?",
    body: "Rex is an agent inside Elite Connectere, not a plain assistant. Full can / cannot list: eliteconnectere.site/rex",
  },

  {
    id: "inspect-message",
    title: "Did you know?",
    body: "Not sure which message is sending? Ask Rex to inspect your live draft and explain what is currently prepared.",
  },
  {
    id: "campaign-monitor",
    title: "Did you know?",
    body: "Campaign Monitor in Rex Studio watches only your current campaign in real time. When Monitor is on, Rex keeps the run across leave or logout.",
    place: "rex-monitor",
  },
  {
    id: "hotspot",
    title: "Did you know?",
    body: "You can share Hotspot access by asking Rex with the person email, or open Hotspot under Settings and share manually.",
    place: "hotspot",
  },
  {
    id: "snippets",
    title: "Did you know?",
    body: "Save message bodies as Snippets in Radar so Rex can reuse them when preparing campaigns.",
    place: "snippets",
  },
  {
    id: "vault",
    title: "Did you know?",
    body: "Risky or invalid leads land in the Quarantine Vault so they stay out of your live send list.",
    place: "vault",
  },
];

function readDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DYK_DISMISS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function resetDidYouKnow() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(DYK_DISMISS_KEY);
  localStorage.removeItem(DYK_LAST_KEY);
}

export function DidYouKnowHost({
  onAskRex,
}: {
  onAskRex?: (tip: DidYouKnowTip) => void;
}) {
  const [tip, setTip] = useState<DidYouKnowTip | null>(null);

  useEffect(() => {
    const tick = () => {
      try {
        const last = Number(localStorage.getItem(DYK_LAST_KEY) || "0");
        if (Date.now() - last < DYK_INTERVAL_MS) return;
        const dismissed = readDismissed();
        const next = DID_YOU_KNOW_TIPS.find((t) => !dismissed.includes(t.id));
        if (!next) return;
        setTip(next);
        localStorage.setItem(DYK_LAST_KEY, String(Date.now()));
      } catch {}
    };
    const id = window.setInterval(tick, 60_000);
    window.setTimeout(tick, 12_000);
    return () => window.clearInterval(id);
  }, []);

  if (!tip) return null;

  const dismissForever = () => {
    const next = [...readDismissed(), tip.id];
    localStorage.setItem(DYK_DISMISS_KEY, JSON.stringify(next));
    setTip(null);
  };

  return (
    <div className="fixed bottom-24 left-1/2 z-[70] w-[min(340px,92vw)] -translate-x-1/2 animate-fade-in rounded-2xl border border-brand/40 bg-card p-3 shadow-lg">
      <p className="text-[12px] font-bold text-brand">{tip.title}</p>
      <p className="mt-1 text-[12.5px] leading-snug text-ink">{tip.body}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {onAskRex && (
          <button
            type="button"
            className="rounded-full bg-brand px-3 py-1.5 text-[12px] font-semibold text-white"
            onClick={() => {
              onAskRex(tip);
              setTip(null);
            }}
          >
            Take me there
          </button>
        )}
        <button type="button" className="rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold text-ink" onClick={() => setTip(null)}>
          Later
        </button>
        <button type="button" className="text-[11px] font-semibold text-ink-soft underline" onClick={dismissForever}>
          Do not show this again
        </button>
      </div>
    </div>
  );
}
