import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function requireCampaignEntitlement(userId: string) {
  const [{ ensureBilling, entitlementsFor }, { supabaseAdmin }] = await Promise.all([
    import("@/server/billing.server"),
    import("@/integrations/supabase/client.server"),
  ]);
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error || !data?.user) throw new Error("Campaign access could not be verified.");
  const billing = await ensureBilling(userId, data.user.created_at);
  const entitlements = await entitlementsFor(billing, data.user.email);
  // Bloodline November promo may send campaigns.
  if (!entitlements.communityPromo && !entitlements.premium && !entitlements.trialActive) {
    throw new Error("Your campaign access has ended. Activate an eligible subscription to create or send campaigns.");
  }
  return entitlements;
}

export const enqueueCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name?: string; subject?: string; body: string; delaySeconds?: number; recipients: Array<{ email: string; name?: string; subject?: string; body?: string }> }) => {
    if (!input || !Array.isArray(input.recipients) || input.recipients.length === 0) throw new Error("At least one recipient is required.");
    const recipients = input.recipients.map((recipient) => ({
      email: String(recipient.email ?? "").trim().toLowerCase(),
      name: String(recipient.name ?? "").slice(0, 200) || null,
      subject: String(recipient.subject ?? input.subject ?? "").trim().slice(0, 500),
      body: String(recipient.body ?? input.body ?? "").slice(0, 20_000),
    }));
    if (recipients.some((recipient) => !EMAIL_RE.test(recipient.email))) throw new Error("Remove invalid email addresses before preparing this campaign.");
    const uniqueRecipientEmails = new Set(recipients.map((recipient) => recipient.email));
    if (uniqueRecipientEmails.size !== recipients.length) {
      throw new Error("Duplicate email addresses were found. Remove duplicates before preparing this campaign; no campaign was created.");
    }
    if (recipients.some((recipient) => !recipient.body.trim())) {
      throw new Error("Every campaign recipient must have a message body. Email subjects are optional.");
    }
    return {
      name: String(input.name ?? "Campaign").slice(0, 200),
      subject: String(input.subject ?? "").trim().slice(0, 500),
      body: String(input.body ?? "").slice(0, 20_000),
      delaySeconds: [3, 4, 5, 8].includes(Number(input.delaySeconds)) ? Number(input.delaySeconds) : 5,
      recipients,
    };
  })
  .handler(async ({ data, context }) => {
    await requireCampaignEntitlement(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: recentPending, error: pendingLookupError } = await supabaseAdmin
      .from("campaigns")
      .select("id,total_recipients,created_at")
      .eq("user_id", context.userId)
      .eq("status", "pending_approval")
      .eq("subject", data.subject)
      .eq("body", data.body)
      .gte("created_at", new Date(Date.now() - 10 * 60_000).toISOString())
      .order("created_at", { ascending: false })
      .limit(5);
    if (pendingLookupError) throw pendingLookupError;
    const incomingEmails = data.recipients.map((recipient) => recipient.email).sort();
    for (const existing of recentPending ?? []) {
      if (Number(existing.total_recipients) !== incomingEmails.length) continue;
      const { data: existingRecipients, error: existingRecipientsError } = await supabaseAdmin
        .from("campaign_recipients").select("email").eq("campaign_id", existing.id);
      if (existingRecipientsError) throw existingRecipientsError;
      const existingEmails = (existingRecipients ?? []).map((row: { email: string }) => String(row.email).trim().toLowerCase()).sort();
      if (existingEmails.length === incomingEmails.length && existingEmails.every((email: string, index: number) => email === incomingEmails[index])) {
        return { campaignId: existing.id, status: "pending_approval" as const, reused: true };
      }
    }
    const { data: campaign, error } = await supabaseAdmin
      .from("campaigns")
      .insert({
        user_id: context.userId, name: data.name, subject: data.subject, body: data.body,
        status: "pending_approval", total_recipients: data.recipients.length, delay_seconds: data.delaySeconds,
        last_error: "Waiting for your approval. Rex has not started sending.",
      })
      .select("id")
      .single();
    if (error || !campaign) throw error ?? new Error("Could not prepare campaign.");
    const recipientRows = data.recipients.map((recipient) => ({
      campaign_id: campaign.id, email: recipient.email, recipient_name: recipient.name,
      message_subject: recipient.subject, message_body: recipient.body,
    }));
    for (let offset = 0; offset < recipientRows.length; offset += 500) {
      const { error: recipientError } = await supabaseAdmin.from("campaign_recipients")
        .insert(recipientRows.slice(offset, offset + 500));
      if (recipientError) {
        await supabaseAdmin.from("campaigns").delete().eq("id", campaign.id).eq("user_id", context.userId);
        throw recipientError;
      }
    }
    return { campaignId: campaign.id, status: "pending_approval" as const };
  });

export const listRexCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("campaigns")
      .select("id,name,subject,status,total_recipients,sent_count,failed_count,next_run_at,scheduled_at,approved_at,started_at,completed_at,last_error,created_at,rex_monitored")
      .eq("user_id", context.userId).order("created_at", { ascending: false }).limit(20);
    if (error) throw error;
    return { campaigns: data ?? [] };
  });

export const assessRexCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { campaignId: string }) => {
    if (!input?.campaignId) throw new Error("A campaign is required.");
    return { campaignId: String(input.campaignId) };
  })
  .handler(async ({ data, context }) => {
    await requireCampaignEntitlement(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: campaign, error } = await supabaseAdmin.from("campaigns")
      .select("id,name,subject,body,status,total_recipients,sent_count,failed_count")
      .eq("id", data.campaignId).eq("user_id", context.userId).maybeSingle();
    if (error) throw error;
    if (!campaign) throw new Error("Campaign not found in your account.");
    // Keep the approval path bounded: do not download every recipient row
    // (including full message bodies) just to count a campaign. Personalized
    // content is re-checked by the worker immediately before each send.
    const [
      { count: totalCount, error: totalError },
      { count: pendingCount, error: pendingError },
      { listProfileViews },
      { scanCampaignContent },
    ] = await Promise.all([
      supabaseAdmin.from("campaign_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", campaign.id),
      supabaseAdmin.from("campaign_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", campaign.id).eq("status", "pending"),
      import("@/server/gmailProfiles.server"),
      import("@/lib/contentSafety"),
    ]);
    if (totalError) throw totalError;
    if (pendingError) throw pendingError;
    const profiles = await listProfileViews(context.userId, "google_mail");
    const readyProfiles = profiles.filter((profile) => !profile.exhausted);
    const remainingCapacity = profiles.reduce((sum, profile) => sum + Math.max(0, profile.limit - profile.used), 0);
    const totalRecipients = totalCount ?? 0;
    const pendingRecipients = pendingCount ?? 0;
    const baseRisk = scanCampaignContent(campaign.subject, campaign.body);
    const risk = { blocked: baseRisk.blocked, reasons: baseRisk.reasons };
    const checks = [
      { key: "recipients", label: "Recipient list", ok: totalRecipients === Number(campaign.total_recipients) && pendingRecipients > 0, detail: `${pendingRecipients.toLocaleString()} pending of ${totalRecipients.toLocaleString()} total recipients` },
      { key: "gmail", label: "Connected Gmail capacity", ok: readyProfiles.length > 0 && remainingCapacity > 0, detail: `${remainingCapacity.toLocaleString()} protected sends are available now across ${readyProfiles.length} account(s). The approved worker continues as rolling account allowances renew; ${pending.length.toLocaleString()} recipient(s) are queued.` },
      { key: "content", label: "Campaign content safety", ok: !risk.blocked, detail: risk.blocked ? risk.reasons.join("; ") : "No high-confidence content risk detected" },
      { key: "state", label: "Campaign state", ok: campaign.status === "pending_approval" || campaign.status === "paused", detail: campaign.status === "pending_approval" || campaign.status === "paused" ? "Awaiting owner approval" : `Current state: ${campaign.status}` },
    ];
    return {
      campaign: { id: campaign.id, name: campaign.name, subject: campaign.subject, total: campaign.total_recipients, sent: campaign.sent_count, failed: campaign.failed_count },
      ready: checks.every((check) => check.ok),
      checks,
      capacity: { remaining: remainingCapacity, needed: pendingRecipients, availableProfiles: readyProfiles.length },
      caveat: "This verifies Elite Connectere's protected per-account daily allowance and current connection records. Google can still apply separate provider limits, temporary throttling, or account restrictions during delivery.",
    };
  });

export const approveRexCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { campaignId: string; scheduledAt?: string; enableMonitor?: boolean }) => {
    if (!input?.campaignId) throw new Error("A campaign is required.");
    const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : new Date();
    if (!Number.isFinite(scheduledAt.getTime())) throw new Error("Choose a valid execution time.");
    if (scheduledAt.getTime() < Date.now() - 30_000) throw new Error("The scheduled time must be now or in the future.");
    return { campaignId: String(input.campaignId), scheduledAt: scheduledAt.toISOString(), enableMonitor: input.enableMonitor === true };
  })
  .handler(async ({ data, context }) => {
    await requireCampaignEntitlement(context.userId);
    const assessment = await assessRexCampaign({ data: { campaignId: data.campaignId } });
    if (!assessment.ready) return { ok: false as const, assessment };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const { data: updated, error } = await (supabaseAdmin as any).from("campaigns").update({
      status: "queued", approved_at: now, scheduled_at: data.scheduledAt,
      next_run_at: data.scheduledAt, last_error: null, paused_at: null, updated_at: now,
      ...(data.enableMonitor ? { rex_monitored: true } : {}),
    }).eq("id", data.campaignId).eq("user_id", context.userId)
      .in("status", ["pending_approval", "paused"]).select("id,status,scheduled_at").maybeSingle();
    if (error) throw error;
    if (!updated) throw new Error("This campaign is no longer awaiting approval. Refresh the campaign list.");
    // Approval only enqueues work. Do not fan out one HTTP worker request per
    // user click: a simultaneous launch would create thousands of serverless
    // invocations. The persistent Railway poller drains this shared queue with
    // a database-enforced global concurrency cap.
    return {
      ok: true as const,
      campaign: updated,
      assessment,
      worker: null,
      queued: true as const,
      offerMonitor: !(data as any).enableMonitor,
    };
  });

export const cancelRexScheduledCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { campaignId: string }) => {
    if (!input?.campaignId) throw new Error("A scheduled action is required.");
    return { campaignId: String(input.campaignId) };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cancelled, error } = await supabaseAdmin.from("campaigns").update({
      status: "pending_approval",
      approved_at: null,
      scheduled_at: null,
      next_run_at: new Date().toISOString(),
      last_error: "Scheduled execution cancelled by the workspace owner.",
      updated_at: new Date().toISOString(),
    }).eq("id", data.campaignId).eq("user_id", context.userId)
      .eq("status", "queued").gt("scheduled_at", new Date().toISOString())
      .select("id,status").maybeSingle();
    if (error) throw error;
    if (!cancelled) throw new Error("This action has already started, is no longer scheduled, or does not belong to your account.");
    return { ok: true as const, campaign: cancelled };
  });

export const controlRexManagedCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { campaignId: string; action: "pause" | "resume" | "stop" }) => {
    const campaignId = String(input?.campaignId ?? "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(campaignId)) throw new Error("Invalid campaign.");
    if (!["pause", "resume", "stop"].includes(input?.action)) throw new Error("Unsupported campaign control.");
    return { campaignId, action: input.action as "pause" | "resume" | "stop" };
  })
  .handler(async ({ data, context }) => {
    if (data.action === "resume") await requireCampaignEntitlement(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: campaign, error: loadError } = await db.from("campaigns")
      .select("id,status,approved_at,subject,body,total_recipients,sent_count,failed_count,rex_monitored")
      .eq("id", data.campaignId).eq("user_id", context.userId).maybeSingle();
    if (loadError || !campaign) throw new Error("This campaign was not found in your account.");
    const now = new Date().toISOString();
    if (data.action === "pause") {
      if (!["queued", "running"].includes(campaign.status)) throw new Error("Only an active Rex-managed campaign can be paused.");
      const { data: updated, error } = await db.from("campaigns").update({
        status: "paused", paused_at: now, last_error: "Paused by you in Rex Studio.", updated_at: now,
      }).eq("id", data.campaignId).eq("user_id", context.userId)
        .in("status", ["queued", "running"]).select("id,status").maybeSingle();
      if (error || !updated) throw new Error("Rex could not pause this campaign. Refresh its status and try again.");
      return { ok: true as const, campaign: updated };
    }
    if (data.action === "stop") {
      if (["completed", "failed", "cancelled"].includes(campaign.status)) throw new Error("This campaign is already finished.");
      const { data: updated, error } = await db.from("campaigns").update({
        status: "cancelled", completed_at: now, last_error: "Stopped by you in Rex Studio.", updated_at: now,
      }).eq("id", data.campaignId).eq("user_id", context.userId).select("id,status").maybeSingle();
      if (error || !updated) throw new Error("Rex could not stop this campaign.");
      return { ok: true as const, campaign: updated };
    }
    // resume
    if (campaign.status !== "paused") throw new Error("Only a paused campaign can be resumed.");
    const { data: updated, error } = await db.from("campaigns").update({
      status: "queued", paused_at: null, next_run_at: now, last_error: null, updated_at: now,
    }).eq("id", data.campaignId).eq("user_id", context.userId).eq("status", "paused").select("id,status").maybeSingle();
    if (error || !updated) throw new Error("Rex could not resume this campaign.");
    return { ok: true as const, campaign: updated };
  });

export function isRexMonitoredCampaign(campaign: { rex_monitored?: boolean | null } | null | undefined): boolean {
  return campaign?.rex_monitored === true;
}


/** Toggle Rex Monitor for a campaign owned by the authenticated workspace user. */
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
    }).eq("id", data.campaignId).eq("user_id", context.userId)
      .select("id,status,rex_monitored").maybeSingle();
    if (error) throw new Error("Could not update Rex Monitor. Ensure campaigns.rex_monitored exists.");
    if (!updated) throw new Error("Could not update Rex Monitor on this campaign.");
    return { ok: true as const, campaign: updated };
  });


/** Authoritative campaign ledger for Rex. All records are scoped to the signed-in owner. */
export const getRexCampaignWorkspaceData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const [{ data: summary, error: summaryError }] = await Promise.all([
      db.rpc("get_campaign_workspace_summary", { p_user_id: context.userId }),
    ]);
    if (summaryError) throw new Error("Could not read authoritative campaign totals: " + summaryError.message);
    const campaigns = Array.isArray(summary?.campaigns) ? summary.campaigns : [];
    const ids = campaigns.map((campaign: any) => campaign.id);
    let recipients: any[] = [];
    if (ids.length) {
      const { data, error } = await db.from("campaign_recipients")
        .select("campaign_id,email,recipient_name,status,message_subject,message_body,sent_at,last_error,attempts,created_at")
        .in("campaign_id", ids)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw new Error("Could not read campaign recipient records: " + error.message);
      recipients = data ?? [];
    }
    return {
      source: "server_campaigns" as const,
      sentLast24Hours: Number(summary?.sentLast24Hours ?? 0),
      campaigns: campaigns.map((campaign: any) => {
        const ownRecipients = recipients.filter((recipient) => recipient.campaign_id === campaign.id);
        return {
          ...campaign,
          recipientRowsReturned: ownRecipients.length,
          countsTruncated: ownRecipients.length < Number(campaign.total_recipients ?? 0),
        };
      }),
      recipients: recipients.slice(0, 100).map((recipient) => ({
        campaignId: recipient.campaign_id,
        email: recipient.email,
        name: recipient.recipient_name,
        status: recipient.status,
        subject: recipient.message_subject,
        body: recipient.message_body,
        sentAt: recipient.sent_at,
        lastError: recipient.last_error,
        attempts: recipient.attempts,
      })),
      truncated: recipients.length > 100,
    };
  });
