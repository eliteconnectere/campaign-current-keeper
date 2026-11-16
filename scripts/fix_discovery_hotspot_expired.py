#!/usr/bin/env python3
from pathlib import Path

BRIEF = (
    "APPROVAL LIFECYCLE:\n"
    "- A red approval control applies only to that message.\n"
    "- If the user asks something else without tapping Approve, the previous approval is treated as declined and shows as expired.\n"
    "- Ask again anytime for a fresh approval control.\n"
    "- To see the message currently being sent, ask what message am I sending right now, then use the real workspace-inspect approval.\n\n"
    "HOTSPOT SHARE VIA REX:\n"
    "- When the user gives an email to share hotspot access, ask max Gmail seats if missing, then emit only "
    "[[REX_HOTSPOT_INVITE_APPROVAL:{\"email\":\"...\",\"maxGmailProfiles\":N}]] for a real red Approve control.\n"
    "- Navigation to hotspot remains available for manual sharing.\n"
)

DYK_FILE = r'''import { useEffect, useState } from "react";

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
    id: "inspect-message",
    title: "Did you know?",
    body: "Not sure which message is sending? Ask Rex: What message am I sending right now? Then approve the inspect control so Rex can read your live draft safely.",
    place: undefined,
  },
  {
    id: "approval-expire",
    title: "Did you know?",
    body: "If Rex shows a red Approve control and you ask something else instead of tapping it, that approval expires. Ask again whenever you want a fresh control.",
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
  onGo,
}: {
  onGo?: (place: string) => void;
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
        {tip.place && onGo && (
          <button
            type="button"
            className="rounded-full bg-brand px-3 py-1.5 text-[12px] font-semibold text-white"
            onClick={() => {
              onGo(tip.place!);
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
'''


def write_dyk() -> None:
    path = Path("src/features/workspace/DidYouKnow.tsx")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(DYK_FILE)
    print("DidYouKnow.tsx written")


def patch_handtour_reset() -> None:
    path = Path("src/features/workspace/HandTour.tsx")
    t = path.read_text()
    if "resetDidYouKnow" not in t:
        if 'from "@/features/workspace/DidYouKnow"' not in t:
            t = 'import { resetDidYouKnow } from "@/features/workspace/DidYouKnow";\n' + t
        t = t.replace(
            "export function resetTour() {\n  if (typeof window === \"undefined\") return;\n  localStorage.removeItem(DISMISS_KEY);\n  localStorage.removeItem(OFF_KEY);\n  window.dispatchEvent(new Event(\"ec:tips-reset\"));\n}",
            "export function resetTour() {\n  if (typeof window === \"undefined\") return;\n  localStorage.removeItem(DISMISS_KEY);\n  localStorage.removeItem(OFF_KEY);\n  try { resetDidYouKnow(); } catch {}\n  window.dispatchEvent(new Event(\"ec:tips-reset\"));\n}",
            1,
        )
        path.write_text(t)
        print("resetTour clears DYK")


def patch_app_host() -> None:
    path = Path("src/routes/app.tsx")
    t = path.read_text()
    if "DidYouKnowHost" not in t:
        t = t.replace(
            'import { EliteTips, ELITE_TIPS, resetTour, setTourEnabled, tourDismissed, showPanelTip } from "@/features/workspace/HandTour";',
            'import { EliteTips, ELITE_TIPS, resetTour, setTourEnabled, tourDismissed, showPanelTip } from "@/features/workspace/HandTour";\nimport { DidYouKnowHost } from "@/features/workspace/DidYouKnow";',
            1,
        )
        # mount near EliteTips if present
        if "<EliteTips" in t and "<DidYouKnowHost" not in t:
            t = t.replace(
                "<EliteTips",
                '<DidYouKnowHost onGo={(place) => handleRexNavigation(place as any)} />\n      <EliteTips',
                1,
            )
            print("DidYouKnowHost mounted")
        path.write_text(t)


def patch_assist_brief() -> None:
    path = Path("src/lib/assist.functions.ts")
    t = path.read_text()
    if "APPROVAL LIFECYCLE" not in t:
        for a in ["Never invent approval buttons", "Navigation is free reasoning, not a keyword router.", "SAFE navigation is automatic"]:
            if a in t:
                t = t.replace(a, a + "\n\n" + BRIEF, 1)
                print("brief lifecycle+hotspot")
                break
    path.write_text(t)


def patch_elite_assist_hotspot_and_expired() -> None:
    path = Path("src/features/assist/EliteAssist.tsx")
    t = path.read_text()

    # Clearer expired labels
    t = t.replace(
        ">This workspace re",
        ">Expired — you continued without approving. Ask again for a fresh control. This workspace re",
        1,
    )
    # Generic expired messages - soft
    for old, new in [
        (
            "This approval has expired",
            "Expired — you asked something else without approving. Ask again for a fresh control",
        ),
        (
            "Approval expired",
            "Expired — continued without approving. Ask again anytime",
        ),
    ]:
        if old in t:
            t = t.replace(old, new)

    # Hotspot marker support in sanitize + render
    if "REX_HOTSPOT_INVITE_APPROVAL" not in t:
        # extend sanitize to inject hotspot invite when email present
        if "function sanitizeAssistantApprovals" in t:
            inject = '''
    const hotspotMatch = userQuestion.match(/\\b(?:share|invite|hotspot)\\b[\\s\\S]{0,80}?([a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,})/i)
      || userQuestion.match(/([a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,})[\\s\\S]{0,40}\\bhotspot\\b/i);
    if (hotspotMatch && !/REX_HOTSPOT_INVITE_APPROVAL/i.test(out)) {
      const email = (hotspotMatch[1] || hotspotMatch[0] || "").toLowerCase();
      if (email.includes("@")) {
        const maxMatch = userQuestion.match(/\\b(\\d{1,2})\\s*(?:gmail|seat|profile)s?\\b/i);
        const maxGmailProfiles = maxMatch ? Math.min(75, Math.max(1, Number(maxMatch[1]))) : 5;
        out = out.trimEnd() + "\\n\\n[[REX_HOTSPOT_INVITE_APPROVAL:" + encodeURIComponent(JSON.stringify({ email, maxGmailProfiles })) + "]];
      }
    }
'''
            t = t.replace(
                "    return out;\n  }",
                inject + "    return out;\n  }",
                1,
            )
            print("sanitize hotspot inject")

        # import inviteTeamMember
        if "inviteTeamMember" not in t:
            t = t.replace(
                'import { createRexPersonalDestination } from "@/lib/rex-destinations.functions";',
                'import { createRexPersonalDestination } from "@/lib/rex-destinations.functions";\nimport { inviteTeamMember } from "@/lib/team.functions";',
                1,
            )

        # render button - find workspace read approval button block and add after
        if "activeWorkspaceReadApproval" in t and "hotspotInviteApproval" not in t:
            # add parse near other matches in message renderer - hard; append simple global replace for display
            # Insert handler function before sanitize if possible
            handler = '''
  async function approveHotspotInvite(payload: { email: string; maxGmailProfiles: number }) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await inviteTeamMember({ data: { email: payload.email, maxGmailProfiles: payload.maxGmailProfiles } });
      if (!(res as any).ok) throw new Error((res as any).error || "Could not share hotspot access");
      const reply = "Hotspot access shared with " + payload.email + " (max " + payload.maxGmailProfiles + " Gmail profiles).";
      setMsgs((current) => current.map((m) => m.content.includes("[[REX_HOTSPOT_INVITE_APPROVAL:")
        ? { ...m, content: m.content.replace(/\\[\\[REX_HOTSPOT_INVITE_APPROVAL:[^\\]]+\\]\\]/g, "[[REX_HOTSPOT_INVITE_DONE]]") }
        : m).concat([{ role: "assistant", content: reply }]));
      await persistMessage("assistant", reply);
      toast.success(reply);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Hotspot share failed";
      toast.error(msg);
      setMsgs((c) => [...c, { role: "assistant", content: msg }]);
    } finally {
      setBusy(false);
    }
  }
'''
            if "approveHotspotInvite" not in t:
                t = t.replace("function sanitizeAssistantApprovals", handler + "\n  function sanitizeAssistantApprovals", 1)

            # UI: in clean content strip + button - find REX_VALIDATE_APPROVAL UI block to clone pattern after
            if 'content.includes("[[REX_VALIDATE_APPROVAL]]")' in t:
                ui = '''
      {(() => {
        const hm = content.match(/\\[\\[REX_HOTSPOT_INVITE_APPROVAL:([^\\]]+)\\]\\]/i);
        if (!hm) return null;
        let payload: { email: string; maxGmailProfiles: number } | null = null;
        try { payload = JSON.parse(decodeURIComponent(hm[1]!)); } catch { try { payload = JSON.parse(hm[1]!); } catch {} }
        if (!payload?.email) return null;
        return (
          <div className="mt-2 rounded-xl border border-brand/40 bg-brand/5 p-3">
            <p className="text-[12px] font-bold text-ink">Share hotspot access — approval required</p>
            <p className="mt-1 text-[12px] text-ink-soft">Invite <span className="font-semibold text-ink">{payload.email}</span> with max {payload.maxGmailProfiles} Gmail profile(s).</p>
            <button type="button" onClick={() => void approveHotspotInvite(payload!)} className="mt-3 rounded-full bg-brand px-4 py-2 text-[12px] font-semibold text-primary-foreground">Approve & Share Hotspot</button>
          </div>
        );
      })()}
      {content.includes("[[REX_HOTSPOT_INVITE_DONE]]") && <span role="status" className="mt-2 inline-flex rounded-full bg-green-100 px-3 py-1.5 text-[12px] font-semibold text-green-800">Hotspot share completed</span>}
'''
                t = t.replace(
                    'content.includes("[[REX_VALIDATE_APPROVAL]]")',
                    'false /* hotspot above */ && content.includes("[[REX_VALIDATE_APPROVAL]]")',
                    1,
                )
                # better insert ui before validate block
                t = t.replace(
                    '{content.includes("[[REX_VALIDATE_APPROVAL]]") && (',
                    ui + '\n      {content.includes("[[REX_VALIDATE_APPROVAL]]") && (',
                    1,
                )
                # undo the false hack
                t = t.replace(
                    'false /* hotspot above */ && content.includes("[[REX_VALIDATE_APPROVAL]]")',
                    'content.includes("[[REX_VALIDATE_APPROVAL]]")',
                    1,
                )
                print("hotspot UI added")

            # strip marker from visible markdown
            if "REX_HOTSPOT_INVITE" not in t[t.find("replace(/\\[\\[(SHOW"):t.find("replace(/\\[\\[(SHOW")+400] if "replace(/\\[\\[(SHOW" in t else "":
                t = t.replace(
                    ".replace(/\\[\\[\\s*APPROVE[^\\]]*\\]\\]/gi, \"\")",
                    ".replace(/\\[\\[\\s*APPROVE[^\\]]*\\]\\]/gi, \"\")\n    .replace(/\\[\\[REX_HOTSPOT_INVITE_APPROVAL:[^\\]]*\\]\\]/gi, \"\")\n    .replace(/\\[\\[REX_HOTSPOT_INVITE_DONE\\]\\]/gi, \"\")",
                    1,
                )

    path.write_text(t)
    print("EliteAssist", path.stat().st_size)


if __name__ == "__main__":
    write_dyk()
    patch_handtour_reset()
    patch_app_host()
    patch_assist_brief()
    patch_elite_assist_hotspot_and_expired()
    print("done")
