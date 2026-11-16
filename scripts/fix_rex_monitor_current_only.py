#!/usr/bin/env python3
"""Rex Monitor is real-time ownership of the CURRENT campaign only — not a tracker."""
from pathlib import Path
import re

NEW_MONITOR_SECTION = r'''
 <details open className="rounded-2xl border border-line bg-card" data-rex-monitor>
  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-bold text-ink">
    <span className="flex items-center gap-2"><ShieldAlert className="size-4 text-brand"/> Campaign Monitor</span>
    <span className="text-xs font-medium text-ink-soft">Current campaign only</span>
  </summary>
  <div className="space-y-3 border-t border-line p-3">
    <p className="text-xs leading-relaxed text-ink-soft">
      <strong>Purpose:</strong> Real-time monitor for the <em>current</em> campaign Rex is running for you.
      When Monitor is on, Rex keeps that run going even if you leave or log out. Pause and stop only work here in Rex Studio — not from the main workspace.
      Turning Monitor off releases control; the next time you want monitoring, ask Rex again after you set up the campaign. This is not campaign history and not multi-campaign tracking.
    </p>
    {scheduled.length > 0 && (
      <div className="rounded-xl border border-brand/30 bg-brand/5 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-brand">Upcoming schedule</p>
        <p className="mt-1 text-xs text-ink">{scheduled[0]?.name || scheduled[0]?.subject || "Scheduled campaign"}</p>
        <p className="mt-0.5 text-[11px] text-ink-soft">{scheduled[0]?.scheduled_at ? new Date(scheduled[0].scheduled_at).toLocaleString() : ""} · Monitor can own it when it starts</p>
      </div>
    )}
    {(() => {
      const active = campaigns
        .filter((x: any) => ["running", "paused", "queued"].includes(String(x.status)))
        .sort((a: any, b: any) => {
          const rank = (s: string) => (s === "running" ? 0 : s === "paused" ? 1 : 2);
          return rank(String(a.status)) - rank(String(b.status));
        })[0];
      if (!active) {
        return <p className="rounded-xl bg-soft p-3 text-xs text-ink-soft">No current campaign to monitor. Start or schedule a campaign, then ask Rex to monitor it — or turn Monitor on here once a run is active.</p>;
      }
      return (
        <div className="rounded-xl border border-line p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{active.name || active.subject || "Current campaign"}</p>
              <p className="mt-1 text-xs text-ink-soft">{active.status} · {active.rex_monitored ? "Monitor ON — Rex owns this run" : "Monitor off"}</p>
              {active.scheduled_at && new Date(active.scheduled_at).getTime() > Date.now() && (
                <p className="mt-1 text-[11px] text-ink-soft">Starts {new Date(active.scheduled_at).toLocaleString()}</p>
              )}
            </div>
            <button
              type="button"
              disabled={Boolean(campaignMonitorBusy)}
              onClick={() => void toggleCampaignMonitor(active.id, !active.rex_monitored)}
              className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold ${active.rex_monitored ? "border border-red-200 text-red-600" : "bg-brand text-white"}`}
            >
              {campaignMonitorBusy ? "…" : active.rex_monitored ? "Turn Monitor off" : "Turn Monitor on"}
            </button>
          </div>
          {active.rex_monitored && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={Boolean(campaignControlBusy)} onClick={() => void controlCampaign(active.id, "pause")} className="rounded-lg border border-line px-3 py-2 text-xs font-semibold">Pause</button>
              <button type="button" disabled={Boolean(campaignControlBusy)} onClick={() => void controlCampaign(active.id, "resume")} className="rounded-lg border border-line px-3 py-2 text-xs font-semibold">Resume</button>
              <button type="button" disabled={Boolean(campaignControlBusy)} onClick={() => void controlCampaign(active.id, "stop")} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600">Stop</button>
            </div>
          )}
        </div>
      );
    })()}
  </div>
 </details>
'''


def patch_rex_studio() -> None:
    path = Path("src/features/assist/RexStudio.tsx")
    t = path.read_text()
    # Replace the existing data-rex-monitor details block
    pattern = r'<details open className="rounded-2xl border border-line bg-card" data-rex-monitor>.*?</details>'
    new_t, n = re.subn(pattern, NEW_MONITOR_SECTION.strip(), t, count=1, flags=re.DOTALL)
    if n == 0:
        # try without open
        pattern2 = r'<details[^>]*data-rex-monitor[^>]*>.*?</details>'
        new_t, n = re.subn(pattern2, NEW_MONITOR_SECTION.strip(), t, count=1, flags=re.DOTALL)
    if n == 0:
        raise SystemExit("monitor details block not found")
    path.write_text(new_t)
    print("RexStudio monitor rewritten", path.stat().st_size)


def patch_registry() -> None:
    path = Path("src/features/assist/navigation.registry.ts")
    t = path.read_text()
    t = t.replace(
        '{ place: "rex-monitor", purpose: "Rex Monitor controls in Rex Studio: when on, Rex owns the run across logout; only Studio can pause/stop", parent: "rex-studio", kind: "settings" },',
        '{ place: "rex-monitor", purpose: "Campaign Monitor in Rex Studio: real-time monitor for the CURRENT campaign only (not history, not multi-campaign tracking). When on, Rex owns the run across logout; turn off only here; next monitor request is asked again. Search/nav: campaign monitor, rex monitor.", parent: "rex-studio", kind: "settings" },',
        1,
    )
    if 'place: "campaign-monitor"' not in t:
        t = t.replace(
            '{ place: "rex-monitor",',
            '{ place: "campaign-monitor", purpose: "Alias destination for Campaign Monitor (same as rex-monitor): current campaign real-time monitor inside Rex Studio.", parent: "rex-studio", kind: "settings" },\n  { place: "rex-monitor",',
            1,
        )
    path.write_text(t)
    print("registry campaign-monitor")


def patch_app() -> None:
    path = Path("src/routes/app.tsx")
    t = path.read_text()
    if 'p === "campaign-monitor"' not in t:
        t = t.replace(
            'p === "rex-monitor"',
            'p === "rex-monitor" || p === "campaign-monitor"',
            1,
        )
        # ensure opens studio and scrolls monitor
        if 'data-rex-monitor' in t and 'campaign-monitor' in t:
            print("app alias wired")
        path.write_text(t)
    # allowlist in assist
    ap = Path("src/lib/assist.functions.ts")
    at = ap.read_text()
    if '"campaign-monitor"' not in at:
        at = at.replace('"rex-monitor"', '"rex-monitor", "campaign-monitor"', 1)
        if '"campaign-monitor"' not in at and '"appeals"' in at:
            at = at.replace('"appeals"', '"appeals", "campaign-monitor", "rex-monitor"', 1)
        ap.write_text(at)
        print("allowlist campaign-monitor")


if __name__ == "__main__":
    patch_rex_studio()
    patch_registry()
    patch_app()
    print("done")
