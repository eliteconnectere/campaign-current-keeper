#!/usr/bin/env python3
"""Phase 3 navigation patches: scroll-to-top, snippets-add, explicit GO, monitor helper."""
from pathlib import Path


def patch_app() -> None:
    path = Path("src/routes/app.tsx")
    t = path.read_text()
    if "function scrollRexDestination" not in t:
        helper = """
  function scrollRexDestination(selector?: string) {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      const main = document.querySelector("[data-ec-main-scroll]") as HTMLElement | null;
      main?.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      const menu = document.querySelector("[data-ec-menu-scroll]") as HTMLElement | null;
      menu?.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      if (selector) {
        window.setTimeout(() => {
          document.querySelector(selector)?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 80);
      }
    } catch {
      /* scroll optional */
    }
  }
"""
        marker = "onGo={(p: AssistPlace) => {"
        if marker not in t:
            raise SystemExit("onGo marker missing in app.tsx")
        t = t.replace(marker, helper + "\n          " + marker, 1)
        print("inserted scrollRexDestination helper")

    if "scrollRexDestination();" not in t:
        old = "onGo={(p: AssistPlace) => {\n            setRexReturnAvailable(true);"
        new = "onGo={(p: AssistPlace) => {\n            setRexReturnAvailable(true);\n            scrollRexDestination();"
        if old in t:
            t = t.replace(old, new, 1)
            print("injected scroll at onGo start")
        else:
            print("WARN: could not inject scroll at onGo start")

    if "snippets-add" not in t:
        needle = 'else if (p === "radar" || p === "vault" || p === "snippets" || p === "monitor")'
        insert = (
            'else if (p === "snippets-add") {\n'
            '              setRadarTab("snippets");\n'
            '              setRadarOpen(true);\n'
            '              showPanelTip("radar");\n'
            '              window.setTimeout(() => { try { window.dispatchEvent(new CustomEvent("ec-snippets-add-open")); } catch {} }, 120);\n'
            '            } else if (p === "rex-monitor") {\n'
            '              setRexStudioOpen(true);\n'
            '              window.setTimeout(() => document.querySelector("[data-rex-monitor]")?.scrollIntoView({ behavior: "smooth", block: "center" }), 120);\n'
            '            } else if (p === "radar" || p === "vault" || p === "snippets" || p === "monitor")'
        )
        if needle in t:
            t = t.replace(needle, insert, 1)
            print("added snippets-add and rex-monitor branches")
        else:
            print("WARN: radar branch not found")

    path.write_text(t)
    print("app.tsx bytes", path.stat().st_size)


def patch_assist() -> None:
    path = Path("src/lib/assist.functions.ts")
    t = path.read_text()
    if '"snippets-add"' not in t:
        t = t.replace('"appeals",', '"appeals", "snippets-add", "rex-monitor",', 1)
        print("allowedGo expanded")
    rule = (
        "CRITICAL: Emit navigate_to / [[GO:]] ONLY when the user explicitly asked to open, go to, "
        "take them to, show, or land on a place. Do NOT navigate when only listing capabilities or offering suggestions."
    )
    if rule not in t:
        anchor = "Navigation is free reasoning, not a keyword router."
        if anchor in t:
            t = t.replace(anchor, anchor + " " + rule, 1)
            print("explicit GO rule added")
        else:
            print("WARN: navigation anchor missing")
    path.write_text(t)
    print("assist bytes", path.stat().st_size)


def patch_radar() -> None:
    path = Path("src/features/radar/EliteRadarHub.tsx")
    t = path.read_text()
    if "ec-snippets-add-open" in t:
        print("radar already has snippets listener")
        return
    if 'import { useState } from "react";' in t:
        t = t.replace('import { useState } from "react";', 'import { useEffect, useState } from "react";', 1)
    marker = 'const [newCat, setNewCat] = useState<string>("friendly");'
    inject = """
  useEffect(() => {
    const openAdd = () => { setTab("snippets"); setAddOpen(true); };
    window.addEventListener("ec-snippets-add-open", openAdd as EventListener);
    return () => window.removeEventListener("ec-snippets-add-open", openAdd as EventListener);
  }, []);
"""
    if marker not in t:
        print("WARN: radar marker missing")
        return
    t = t.replace(marker, marker + inject, 1)
    path.write_text(t)
    print("radar snippets listener added")


def patch_campaign_monitor() -> None:
    path = Path("src/lib/campaign.functions.ts")
    t = path.read_text()
    if "setRexCampaignMonitor" in t:
        print("setRexCampaignMonitor already present")
        return
    append = '''

/** Toggle Rex Monitor on an approved/running campaign. Only Rex Studio should call this. */
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
    if (error) {
      throw new Error("Could not update Rex Monitor. Ensure campaigns.rex_monitored exists, or run the monitor migration.");
    }
    if (!updated) throw new Error("Could not update Rex Monitor on this campaign.");
    return { ok: true as const, campaign: updated };
  });
'''
    path.write_text(t + append)
    print("setRexCampaignMonitor appended")


if __name__ == "__main__":
    patch_app()
    patch_assist()
    patch_radar()
    patch_campaign_monitor()
    print("phase3_nav_patch done")
