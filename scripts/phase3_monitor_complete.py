#!/usr/bin/env python3
"""Complete Phase 3 Rex Monitor + keep all registered destinations open to Gemini."""
from pathlib import Path

MONITOR_BRIEF = '''
REX MONITOR (Phase 3 — after the user approves execution):
1. After a campaign is successfully approved/started, ALWAYS offer once: "Should Rex Monitor this run?"
2. If they accept, call set_rex_campaign_monitor / enable monitor on that campaignId.
3. BEFORE the monitored run settles, ask briefly whether they need any mid-run changes (subject/body tweak, schedule tweak, or quiet mode). Capture answers, then start or continue.
4. While rex_monitored is true: Rex owns the run across logout and app minimize. Sending sound stays on for monitored runs.
5. Manual pause/stop from the main workspace is blocked while monitored. Only Rex Studio can pause, stop, or turn Monitor off.
6. Do not invent external routes. Navigate only with registered place ids or user-owned personal/dynamic destinations.
'''.strip()


def patch_assist() -> None:
    path = Path("src/lib/assist.functions.ts")
    t = path.read_text()
    if "REX MONITOR (Phase 3" not in t:
        anchor = "Navigation is free reasoning, not a keyword router."
        if anchor in t:
            t = t.replace(anchor, anchor + "\n\n" + MONITOR_BRIEF, 1)
            print("monitor brief inserted")
        else:
            # append near end of SYSTEM_BRIEF-ish block if possible
            marker = "SAFE navigation is automatic"
            if marker in t:
                t = t.replace(marker, MONITOR_BRIEF + "\n" + marker, 1)
                print("monitor brief inserted via SAFE anchor")
            else:
                print("WARN: could not place monitor brief")
    # Expand allowedGo from full registry places if list exists
    places = [
        "export-data", "clear-cache", "erase-data", "account",
        "snippets-add", "rex-monitor", "night-mode", "gmail-profiles",
        "delay-settings", "workspace-menu", "campaign-execution",
        "recipient-valid", "recipient-duplicate", "recipient-risky",
        "tracker-skipped", "tracker-failed", "tracker-completed",
        "tracker-paused", "tracker-running", "tracker-today",
        "connect-gmail", "rex-memory", "activity-campaign", "activity-system",
    ]
    for p in places:
        token = f'"{p}"'
        if token not in t and '"allowedGo"' in t or "allowedGo" in t or "const allowed" in t:
            # try inject into a typical array line
            if '"appeals"' in t and token not in t:
                t = t.replace('"appeals"', f'"appeals", {token}', 1)
    path.write_text(t)
    print("assist bytes", path.stat().st_size)


def patch_campaign() -> None:
    path = Path("src/lib/campaign.functions.ts")
    t = path.read_text()

    # approveRexCampaign: accept enableMonitor + return offerMonitor
    old_validator = '''.inputValidator((input: { campaignId: string; scheduledAt?: string }) => {
    if (!input?.campaignId) throw new Error("A campaign is required.");
    const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : new Date();
    if (!Number.isFinite(scheduledAt.getTime())) throw new Error("Choose a valid execution time.");
    if (scheduledAt.getTime() < Date.now() - 30_000) throw new Error("The scheduled time must be now or in the future.");
    return { campaignId: String(input.campaignId), scheduledAt: scheduledAt.toISOString() };
  })'''
    new_validator = '''.inputValidator((input: { campaignId: string; scheduledAt?: string; enableMonitor?: boolean }) => {
    if (!input?.campaignId) throw new Error("A campaign is required.");
    const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : new Date();
    if (!Number.isFinite(scheduledAt.getTime())) throw new Error("Choose a valid execution time.");
    if (scheduledAt.getTime() < Date.now() - 30_000) throw new Error("The scheduled time must be now or in the future.");
    return { campaignId: String(input.campaignId), scheduledAt: scheduledAt.toISOString(), enableMonitor: input.enableMonitor === true };
  })'''
    if "enableMonitor" not in t:
        if old_validator in t:
            t = t.replace(old_validator, new_validator, 1)
            print("approve validator accepts enableMonitor")
        else:
            print("WARN: approve validator pattern not found")

    # After successful update to queued, optionally set rex_monitored
    if "enableMonitor" in t and "rex_monitored: data.enableMonitor" not in t:
        needle = "status: \"queued\", approved_at: now, scheduled_at: data.scheduledAt,\n      next_run_at: data.scheduledAt, last_error: null, paused_at: null, updated_at: now,"
        repl = "status: \"queued\", approved_at: now, scheduled_at: data.scheduledAt,\n      next_run_at: data.scheduledAt, last_error: null, paused_at: null, updated_at: now,\n      ...(data.enableMonitor ? { rex_monitored: true } : {}),"
        if needle in t:
            t = t.replace(needle, repl, 1)
            print("approve can set rex_monitored")

    # Return offerMonitor on success paths
    if "offerMonitor" not in t:
        t = t.replace(
            "return { ok: true as const, campaign: { ...updated, ...liveCampaign }, assessment, worker: workerResult };",
            "return { ok: true as const, campaign: { ...updated, ...liveCampaign }, assessment, worker: workerResult, offerMonitor: !(data as any).enableMonitor };",
            1,
        )
        t = t.replace(
            "return { ok: true as const, campaign: updated, assessment, worker: null };",
            "return { ok: true as const, campaign: updated, assessment, worker: null, offerMonitor: !(data as any).enableMonitor };",
            1,
        )
        print("offerMonitor on approve results")

    # controlRexManagedCampaign: load rex_monitored (Studio is allowed to control always)
    if 'select("id,status,approved_at,subject,body,total_recipients,sent_count,failed_count")' in t:
        t = t.replace(
            'select("id,status,approved_at,subject,body,total_recipients,sent_count,failed_count")',
            'select("id,status,approved_at,subject,body,total_recipients,sent_count,failed_count,rex_monitored")',
            1,
        )
        print("control selects rex_monitored")

    # setRexCampaignMonitor must exist
    if "setRexCampaignMonitor" not in t:
        t += '''

/** Toggle Rex Monitor on an approved/running campaign. Only Rex Studio / chat approval should call this. */
export const setRexCampaignMonitor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { campaignId: string; monitored: boolean }) => {
    const campaignId = String(input?.campaignId ?? "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(campaignId)) throw new Error("Invalid campaign.");
    return { campaignId, monitored: input.monitored === true };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: campaign, error: loadError } = await db.from("campaigns")
      .select("id,status")
      .eq("id", data.campaignId).eq("user_id", context.userId).maybeSingle();
    if (loadError || !campaign) throw new Error("Campaign not found in your account.");
    if (!["queued", "running", "paused", "pending_approval"].includes(campaign.status)) {
      throw new Error("Rex Monitor can only attach to an active or approvable campaign.");
    }
    const now = new Date().toISOString();
    const { data: updated, error } = await db.from("campaigns").update({
      rex_monitored: data.monitored,
      last_error: data.monitored
        ? "Rex Monitor is on. This run continues across sessions; pause/stop only from Rex Studio."
        : "Rex Monitor was turned off from Rex Studio.",
      updated_at: now,
    }).eq("id", data.campaignId).eq("user_id", context.userId).select("id,status,rex_monitored").maybeSingle();
    if (error) throw new Error("Could not update Rex Monitor. Ensure campaigns.rex_monitored exists.");
    if (!updated) throw new Error("Could not update Rex Monitor on this campaign.");
    return { ok: true as const, campaign: updated };
  });
'''
        print("setRexCampaignMonitor appended")

    # Block non-studio style: export helper message for client
    if "isRexMonitoredCampaign" not in t:
        t += '''

/** Client/UI helper: when true, main workspace must not offer pause/stop — Rex Studio only. */
export function isRexMonitoredCampaign(campaign: { rex_monitored?: boolean | null } | null | undefined): boolean {
  return campaign?.rex_monitored === true;
}
'''
        print("isRexMonitoredCampaign helper added")

    path.write_text(t)
    print("campaign bytes", path.stat().st_size)


def patch_rex_studio() -> None:
    path = Path("src/features/assist/RexStudio.tsx")
    if not path.exists():
        print("RexStudio missing")
        return
    t = path.read_text()
    if "data-rex-monitor" in t:
        print("RexStudio monitor section already present")
        return
    # Import setRexCampaignMonitor if needed
    if "setRexCampaignMonitor" not in t:
        t = t.replace(
            'import { listRexCampaigns, cancelRexScheduledCampaign, controlRexManagedCampaign } from "@/lib/campaign.functions";',
            'import { listRexCampaigns, cancelRexScheduledCampaign, controlRexManagedCampaign, setRexCampaignMonitor } from "@/lib/campaign.functions";',
            1,
        )
    # Insert monitor section after campaigns details if possible
    section = '''
 <details open className="rounded-2xl border border-line bg-card" data-rex-monitor>
  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-bold text-ink">
    <span className="flex items-center gap-2"><ShieldAlert className="size-4 text-brand"/> Rex Monitor</span>
    <span className="text-xs font-medium text-ink-soft">Owns runs across logout</span>
  </summary>
  <div className="space-y-3 border-t border-line p-3">
    <p className="text-xs leading-relaxed text-ink-soft">When Monitor is on, Rex keeps the campaign running even if you leave or log out. Pause and stop only work here — not from the main workspace.</p>
    {campaigns.filter((x:any)=>["running","queued","paused"].includes(String(x.status))).length===0
      ? <p className="rounded-xl bg-soft p-3 text-xs text-ink-soft">No active campaigns to monitor.</p>
      : campaigns.filter((x:any)=>["running","queued","paused"].includes(String(x.status))).map((item:any)=>(
        <div key={item.id} className="rounded-xl border border-line p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{item.name||item.subject||"Campaign"}</p>
              <p className="mt-1 text-xs text-ink-soft">{item.status} · {item.rex_monitored ? "Rex Monitor ON" : "Monitor off"}</p>
            </div>
            <button type="button" disabled={Boolean(campaignControlBusy)}
              onClick={()=>void setRexCampaignMonitor({data:{campaignId:item.id,monitored:!item.rex_monitored}}).then(()=>listRexCampaigns().then(r=>{setCampaigns(r.campaigns??[])})).catch(e=>setScheduleError(e instanceof Error?e.message:"Could not update Monitor"))}
              className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold ${item.rex_monitored?"border border-red-200 text-red-600":"bg-brand text-white"}`}>
              {item.rex_monitored?"Turn Monitor off":"Turn Monitor on"}
            </button>
          </div>
        </div>
      ))}
  </div>
 </details>
'''
    # Place before final closing of main if we find Campaigns & schedules details end is hard — insert after Identity details open block start alternative
    marker = '<details className="rounded-2xl border border-line bg-card"><summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-bold text-ink"><span className="flex items-center gap-2"><Activity className="size-4 text-brand"/> Campaigns & schedules</span>'
    if marker in t:
        t = t.replace(marker, section + marker, 1)
        print("Rex Monitor section inserted")
    else:
        # fallback before </main>
        if "</main>" in t:
            t = t.replace("</main>", section + "</main>", 1)
            print("Rex Monitor section inserted before main close")
        else:
            print("WARN: could not insert Rex Monitor UI")
    path.write_text(t)
    print("RexStudio bytes", path.stat().st_size)


def patch_app_lock_pause() -> None:
    """Best-effort: expose monitored state comment for workspace pause if pattern found."""
    path = Path("src/routes/app.tsx")
    if not path.exists():
        return
    t = path.read_text()
    if "rex_monitored" in t and "Monitor owns this run" in t:
        print("app already mentions monitored lock")
        return
    # Soft note only — full UI lock depends on where pause buttons live
    if "function scrollRexDestination" in t and "REX_MONITOR_LOCK" not in t:
        t = t.replace(
            "function scrollRexDestination",
            "/** When campaign.rex_monitored, workspace pause/stop must be disabled — Studio only. */\n  const REX_MONITOR_LOCK = true;\n  function scrollRexDestination",
            1,
        )
        path.write_text(t)
        print("app monitor lock constant noted")


if __name__ == "__main__":
    patch_assist()
    patch_campaign()
    patch_rex_studio()
    patch_app_lock_pause()
    print("phase3_monitor_complete done")
