import { createFileRoute } from "@tanstack/react-router";

const CONNECTOR_ID = "google_mail";
// Each worker handles many campaigns in parallel; each campaign keeps sending
// until the worker's time budget ends. Cron fans out enough workers for thousands
// of simultaneous campaigns, and leases guarantee one worker per campaign.
const CAMPAIGNS_PER_WORKER = 10;
const MAX_PER_CAMPAIGN_RUN = 1000;
const WORKER_BUDGET_MS = 50_000;
const MAX_ATTEMPTS = 3;

let githubJwksCache: { expiresAt: number; keys: JsonWebKey[] } | null = null;

function decodeJwtPart(part: string): Record<string, unknown> {
  const base64 = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
  const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
}

async function authorizedByGitHubActions(token: string): Promise<boolean> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const header = decodeJwtPart(parts[0]!);
    const claims = decodeJwtPart(parts[1]!);
    if (header["alg"] !== "RS256" || typeof header["kid"] !== "string") return false;

    const audience = claims["aud"];
    const audienceMatches = audience === "eliteconnectere-campaign-worker"
      || (Array.isArray(audience) && audience.includes("eliteconnectere-campaign-worker"));
    const now = Math.floor(Date.now() / 1000);
    if (claims["iss"] !== "https://token.actions.githubusercontent.com"
      || !audienceMatches
      || Number(claims["exp"] ?? 0) <= now
      || Number(claims["nbf"] ?? 0) > now + 30
      || claims["repository"] !== "eliteconnectere/eliteconnectere"
      || claims["ref"] !== "refs/heads/main"
      || claims["workflow_ref"] !== "eliteconnectere/eliteconnectere/.github/workflows/campaign-execution-worker.yml@refs/heads/main") {
      return false;
    }

    if (!githubJwksCache || githubJwksCache.expiresAt <= Date.now()) {
      const response = await fetch("https://token.actions.githubusercontent.com/.well-known/jwks", {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return false;
      const payload = await response.json() as { keys?: JsonWebKey[] };
      if (!Array.isArray(payload.keys)) return false;
      githubJwksCache = { keys: payload.keys, expiresAt: Date.now() + 60 * 60_000 };
    }

    const jwk = githubJwksCache.keys.find((key) => (key as JsonWebKey & { kid?: string }).kid === header["kid"]);
    if (!jwk) return false;
    const key = await crypto.subtle.importKey(
      "jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"],
    );
    const signatureBase64 = parts[2]!.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(parts[2]!.length / 4) * 4, "=");
    const signature = Uint8Array.from(atob(signatureBase64), (character) => character.charCodeAt(0));
    return crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5", key, signature, new TextEncoder().encode(parts[0] + "." + parts[1]),
    );
  } catch {
    return false;
  }
}

async function authorized(request: Request): Promise<boolean> {
  const expected = process.env["CRON_SECRET"] || process.env["CAMPAIGN_WORKER_SECRET"];
  const authorization = request.headers.get("authorization");
  const actual = authorization?.replace(/^Bearer\s+/i, "") || request.headers.get("x-campaign-worker-secret");
  if (expected && actual === expected) return true;
  if (!authorization?.startsWith("Bearer ")) return false;
  return authorizedByGitHubActions(authorization.slice(7).trim());
}

function base64Url(value: string) {
  return btoa(Array.from(new TextEncoder().encode(value), (b) => String.fromCharCode(b)).join(""))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function rawEmail(to: string, subject: string, body: string) {
  return base64Url([
    `To: ${to}`,
    `Subject: ${subject.replace(/[\r\n]/g, " ").slice(0, 500)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    body.slice(0, 20_000),
  ].join("\r\n"));
}

async function bodyHash(body: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function campaignOwnerAccess(userId: string, supabaseAdmin: any): Promise<{
  allowed: boolean;
  retryable: boolean;
  reason: string;
}> {
  // A transient Auth/API/network failure must never be treated as a revoked
  // subscription. Only a confirmed missing user or confirmed ineligible plan
  // is a permanent access denial.
  let data: any;
  try {
    const result = await supabaseAdmin.auth.admin.getUserById(userId);
    if (result.error) {
      return {
        allowed: false,
        retryable: true,
        reason: "Campaign owner verification is temporarily unavailable. The worker will retry automatically.",
      };
    }
    data = result.data;
  } catch {
    return {
      allowed: false,
      retryable: true,
      reason: "Campaign owner verification is temporarily unavailable. The worker will retry automatically.",
    };
  }
  if (!data?.user) {
    return {
      allowed: false,
      retryable: false,
      reason: "The campaign owner account no longer exists. Delivery was paused safely.",
    };
  }

  try {
    const { ensureBilling, entitlementsFor } = await import("@/server/billing.server");
    const billing = await ensureBilling(userId, data.user.created_at);
    const entitlements = await entitlementsFor(billing, data.user.email);
    if (!entitlements.premium && !entitlements.trialActive && !entitlements.communityPromo) {
      return {
        allowed: false,
        retryable: false,
        reason: "Campaign access has ended. Activate an eligible subscription to resume sending.",
      };
    }
    if (entitlements.allowance != null && entitlements.used >= entitlements.allowance) {
      return {
        allowed: false,
        retryable: false,
        reason: "The shared subscription sending allowance is exhausted. Delivery was paused until the plan renews or is upgraded.",
      };
    }
    return { allowed: true, retryable: false, reason: "" };
  } catch {
    return {
      allowed: false,
      retryable: true,
      reason: "Campaign billing verification is temporarily unavailable. The worker will retry automatically.",
    };
  }
}

async function releaseCampaignLease(supabaseAdmin: any, campaign: any) {
  if (!campaign?.worker_lease_token) return;
  const { error } = await supabaseAdmin.from("campaigns").update({
    worker_lease_token: null,
    worker_lease_until: null,
  }).eq("id", campaign.id).eq("worker_lease_token", campaign.worker_lease_token);
  if (error) console.error("[campaign-worker] lease release failed", {
    campaignId: campaign.id, error: error.message,
  });
}

async function processCampaigns(onlyCampaignId?: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date().toISOString();
  const workerStartedAt = Date.now();
  console.info("[campaign-worker] tick", { at: now });
  // Claim one whole campaign atomically. Parallel worker instances receive
  // different campaigns; the lease expires automatically if an instance dies.
  const { data: campaigns, error } = await (supabaseAdmin as any).rpc("claim_due_campaigns", {
    p_limit: onlyCampaignId ? 1 : CAMPAIGNS_PER_WORKER,
    p_campaign_id: onlyCampaignId ?? null,
    p_now: now,
    p_lease_seconds: 120,
    p_max_concurrent: 100000,
  });
  if (error) return Response.json({ ok: false, error: "Unable to load approved campaigns." }, { status: 500 });

  let processed = 0;
  let completed = 0;
  let paused = 0;
  await Promise.all((campaigns ?? []).map(async (campaign: any) => {
    if (Date.now() - workerStartedAt >= WORKER_BUDGET_MS) { await releaseCampaignLease(supabaseAdmin, campaign); return; }
    let campaignProcessed = 0;
    try {
    const access = await campaignOwnerAccess(campaign.user_id, supabaseAdmin);
    if (!access.allowed) {
      const detail = access.reason;
      if (access.retryable) {
        // Keep the campaign recoverable during provider outages. Do not turn a
        // transient verification failure into a user-visible manual pause.
        await (supabaseAdmin as any).from("campaigns").update({
          status: "queued",
          next_run_at: new Date(Date.now() + 60_000).toISOString(),
          last_error: detail,
          updated_at: new Date().toISOString(),
        }).eq("id", campaign.id).eq("user_id", campaign.user_id).in("status", ["queued", "running"]);
        await (supabaseAdmin as any).from("rex_events").insert({
          user_id: campaign.user_id, kind: "campaign_verification_retry", severity: "medium",
          title: "Campaign verification temporarily unavailable; automatic retry scheduled", detail,
        });
      } else {
        await (supabaseAdmin as any).from("campaigns").update({
          status: "paused", paused_at: now, last_error: detail, updated_at: now,
        }).eq("id", campaign.id).eq("user_id", campaign.user_id).in("status", ["queued", "running"]);
        await (supabaseAdmin as any).from("rex_events").insert({
          user_id: campaign.user_id, kind: "campaign_entitlement", severity: "high",
          title: "Campaign paused because account access does not include sending", detail,
        });
        paused += 1;
      }
      await releaseCampaignLease(supabaseAdmin, campaign);
      return;
    }
    const [{ listProfileRows, listProfileViews, decryptKey, recordSend }, google, safety] = await Promise.all([
      import("@/server/gmailProfiles.server"),
      import("@/server/google.server"),
      import("@/lib/contentSafety"),
    ]);
    const risk = safety.scanCampaignContent(campaign.subject, campaign.body);
    if (risk.blocked) {
      const detail = risk.reasons.join("; ");
      await (supabaseAdmin as any).from("campaigns").update({
        status: "paused", paused_at: now, last_error: `Rex stopped delivery: ${detail}`,
        updated_at: now,
      }).eq("id", campaign.id).eq("status", campaign.status);
      await (supabaseAdmin as any).from("rex_events").insert({
        user_id: campaign.user_id, kind: "campaign_blocked", severity: "high",
        title: "Rex paused a campaign before delivery",
        detail: `Campaign ${campaign.id} was paused before another recipient was sent. ${detail}`,
      });
      paused += 1;
      await releaseCampaignLease(supabaseAdmin, campaign);
      return;
    }

    const profileRows = await listProfileRows(campaign.user_id, CONNECTOR_ID);
    const profileViews = await listProfileViews(campaign.user_id, CONNECTOR_ID);
    const viewById = new Map(profileViews.map((view) => [view.id, view]));
    // Use at most 15 connected Gmail identities for one campaign execution.
    // Re-sort by least-used first on every worker tick so the round-robin position
    // survives across invocations instead of resetting to profile #1 each minute.
    const profiles = profileRows.map((row) => ({ row, usage: viewById.get(row.id) }))
      .filter((item) => item.usage && !item.usage.exhausted && item.usage.used < item.usage.limit)
      .sort((a, b) => (a.usage!.used - b.usage!.used) || (a.row.slot - b.row.slot))
;
    if (profiles.length === 0) {
      if (profileRows.length === 0) {
        const detail = "Connect a Gmail sending account to continue this approved campaign.";
        await (supabaseAdmin as any).from("campaigns").update({
          status: "paused", paused_at: now, last_error: detail, updated_at: now,
        }).eq("id", campaign.id).in("status", ["queued", "running"]);
        await (supabaseAdmin as any).from("rex_events").insert({
          user_id: campaign.user_id, kind: "campaign_capacity", severity: "high",
          title: "Campaign waiting for a connected Gmail account", detail,
        });
        paused += 1;
      } else {
        const nextCapacityAt = profileViews
          .map((profile) => profile.exhaustedUntil ? new Date(profile.exhaustedUntil).getTime() : NaN)
          .filter((time) => Number.isFinite(time) && time > Date.now())
          .sort((a, b) => a - b)[0];
        const resumeAt = new Date(nextCapacityAt ?? Date.now() + 60 * 60_000).toISOString();
        const detail = "All connected Gmail accounts have reached their protected rolling allowance. This approved campaign remains queued and will continue when an account's allowance renews.";
        await (supabaseAdmin as any).from("campaigns").update({
          status: "running", next_run_at: resumeAt, last_error: detail, updated_at: now,
        }).eq("id", campaign.id).in("status", ["queued", "running"]);
      }
      await releaseCampaignLease(supabaseAdmin, campaign);
      return;
    }

    await (supabaseAdmin as any).from("campaigns").update({
      status: "running", started_at: campaign.started_at ?? now, updated_at: now,
    }).eq("id", campaign.id).in("status", ["queued", "running"]);

    // A timed-out send can be ambiguous: Gmail may have accepted it just before
    // the worker died. Do not blindly resend and create a duplicate. Surface the
    // recipient for review instead of falsely marking it sent or retrying it.
    const staleSendingBefore = new Date(Date.now() - 10 * 60_000).toISOString();
    await supabaseAdmin.from("campaign_recipients").update({
      status: "failed",
      last_error: "A previous worker stopped during delivery. Gmail acceptance is unconfirmed; verify the recipient mailbox before manually retrying to avoid a duplicate.",
      updated_at: now,
    }).eq("campaign_id", campaign.id).eq("status", "sending").lt("updated_at", staleSendingBefore);

    let profileCursor = 0;
    let campaignPausedForRisk = false;
    let campaignControlRequested = false;
    const paceMs = Math.max(3, Math.min(8, Number(campaign.delay_seconds ?? 5))) * 1000;
    // Claim one recipient at a time with SKIP LOCKED. This lets multiple worker
    // instances safely share a campaign without double-claiming, and avoids
    // leaving a batch marked "sending" if this invocation reaches its time budget.
    while (campaignProcessed < MAX_PER_CAMPAIGN_RUN && Date.now() - workerStartedAt < WORKER_BUDGET_MS - paceMs) {
      // Respect a Studio pause/stop immediately between recipient sends. A worker
      // already in flight must not overwrite the owner's control state afterward.
      const { data: controlState } = await (supabaseAdmin as any).from("campaigns")
        .select("status").eq("id", campaign.id).eq("user_id", campaign.user_id).maybeSingle();
      if (!controlState || !["queued", "running"].includes(controlState.status)) {
        campaignControlRequested = true;
        break;
      }
      let selected = profiles.find((item) => item.usage && item.usage.used < item.usage.limit);
      if (!selected) break;
      const { data: claimedRecipients, error: claimError } = await (supabaseAdmin as any)
        .rpc("claim_campaign_recipients", {
          p_campaign_id: campaign.id,
          p_limit: 1,
          p_now: new Date().toISOString(),
        });
      if (claimError) {
        console.error("[campaign-worker] atomic recipient claim failed", {
          campaignId: campaign.id, error: claimError.message,
        });
        await (supabaseAdmin as any).from("campaigns").update({
          last_error: "Could not safely claim the next recipient. The worker will retry.",
          next_run_at: new Date(Date.now() + 60_000).toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", campaign.id).eq("user_id", campaign.user_id);
        break;
      }
      const recipient = claimedRecipients?.[0];
      if (!recipient) break;
      processed += 1;
      campaignProcessed += 1;
      let deliveryOutcomeMayHaveSucceeded = false;
      try {
        const recipientSubject = String(recipient.message_subject ?? campaign.subject);
        const recipientBody = String(recipient.message_body ?? campaign.body);
        const personalizedRisk = safety.scanCampaignContent(recipientSubject, recipientBody);
        if (personalizedRisk.blocked) {
          const detail = personalizedRisk.reasons.join("; ");
          await supabaseAdmin.from("campaign_recipients").update({
            status: "pending", attempts: Math.max(0, Number(recipient.attempts ?? 1) - 1), last_error: `Rex review required: ${detail}`, updated_at: new Date().toISOString(),
          }).eq("id", recipient.id);
          await (supabaseAdmin as any).from("campaigns").update({
            status: "paused", paused_at: new Date().toISOString(), last_error: `Rex paused delivery for a personalized message: ${detail}`, updated_at: new Date().toISOString(),
          }).eq("id", campaign.id);
          await (supabaseAdmin as any).from("rex_events").insert({
            user_id: campaign.user_id, kind: "campaign_message_risk", severity: "high",
            title: "Rex paused a personalized campaign message", detail: `Campaign ${campaign.id}, recipient ${recipient.email}: ${detail}`,
          });
          paused += 1;
          campaignPausedForRisk = true;
          break;
        }
        const hash = await bodyHash(recipientBody);

        let sent = false;
        let lastError: Error | null = null;
        for (let attempt = 0; attempt < profiles.length; attempt += 1) {
          const index = (profileCursor + attempt) % profiles.length;
          const candidate = profiles[index]!;
          if (!candidate.usage || candidate.usage.used >= candidate.usage.limit) continue;
          selected = candidate;
          try {
            const { token } = await google.accessTokenFor(decryptKey(candidate.row));
            let response: Response;
            try {
              response = await google.gmailSend(token, rawEmail(recipient.email, recipientSubject, recipientBody));
            } catch (sendError) {
              deliveryOutcomeMayHaveSucceeded = true;
              throw sendError;
            }
            if (response.ok) {
              deliveryOutcomeMayHaveSucceeded = true;
              await recordSend(candidate.row.email_key);
              candidate.usage.used += 1;
              if (candidate.usage.used >= candidate.usage.limit) candidate.usage.exhausted = true;
              profileCursor = (index + 1) % profiles.length;
              const { error: historyError } = await supabaseAdmin.from("campaign_delivery_history").insert({
                user_id: campaign.user_id, recipient_email: recipient.email.trim().toLowerCase(),
                subject: recipientSubject, body_hash: hash, campaign_id: campaign.id,
                gmail_profile_email: candidate.row.email_key,
              });
              if (historyError) console.error("[campaign-worker] delivery audit insert failed after Gmail accepted message", {
                campaignId: campaign.id, recipientId: recipient.id, error: historyError.message,
              });
              sent = true;
              break;
            }
            lastError = new Error(`Gmail rejected the message (${response.status}).`);
            if (response.status === 401) google.forgetAccessToken(decryptKey(candidate.row));
            if (response.status === 401 || response.status === 403) continue;
          } catch (error) {
            lastError = error instanceof Error ? error : new Error("Gmail send failed.");
          }
        }
        if (!sent) throw lastError ?? new Error("All connected Gmail accounts are exhausted or unavailable.");
        await supabaseAdmin.from("campaign_recipients").update({
          status: "sent", sent_at: new Date().toISOString(), updated_at: new Date().toISOString(), last_error: null,
        }).eq("id", recipient.id);
        deliveryOutcomeMayHaveSucceeded = false;
      } catch (error) {
        const attempts = Number(recipient.attempts ?? 1);
        const message = error instanceof Error ? error.message.slice(0, 300) : "Send failed.";
        await supabaseAdmin.from("campaign_recipients").update({
          status: deliveryOutcomeMayHaveSucceeded || attempts >= MAX_ATTEMPTS ? "failed" : "pending",
          next_attempt_at: new Date(Date.now() + attempts * attempts * 60_000).toISOString(),
          last_error: deliveryOutcomeMayHaveSucceeded
            ? "Gmail may have accepted this message, but confirmation was interrupted. Automatic retry was stopped to prevent a duplicate; verify the recipient mailbox."
            : message,
          updated_at: new Date().toISOString(),
        }).eq("id", recipient.id);
      }
      if (!campaignPausedForRisk) await new Promise((resolve) => setTimeout(resolve, paceMs));
    }

    const [{ count: remaining }, { count: failed }, { count: sent }] = await Promise.all([
      supabaseAdmin.from("campaign_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", campaign.id).in("status", ["pending", "sending"]),
      supabaseAdmin.from("campaign_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", campaign.id).eq("status", "failed"),
      supabaseAdmin.from("campaign_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", campaign.id).eq("status", "sent"),
    ]);
    const sentCount = sent ?? 0;
    const { data: finalControlState } = await (supabaseAdmin as any).from("campaigns")
      .select("status").eq("id", campaign.id).eq("user_id", campaign.user_id).maybeSingle();
    if (campaignControlRequested || ["paused", "cancelled"].includes(String(finalControlState?.status))) {
      await (supabaseAdmin as any).from("campaigns").update({
        sent_count: sentCount, failed_count: failed ?? 0, updated_at: new Date().toISOString(),
      }).eq("id", campaign.id).eq("user_id", campaign.user_id)
        .in("status", ["paused", "cancelled"]);
      paused += 1;
    } else if (campaignPausedForRisk) {
      await (supabaseAdmin as any).from("campaigns").update({
        status: "paused", paused_at: new Date().toISOString(), sent_count: sentCount,
        failed_count: failed ?? 0, updated_at: new Date().toISOString(),
      }).eq("id", campaign.id);
    } else if (!remaining) {
      await (supabaseAdmin as any).from("campaigns").update({
        status: failed ? "failed" : "completed", sent_count: sentCount, failed_count: failed ?? 0,
        completed_at: new Date().toISOString(), next_run_at: new Date().toISOString(),
        last_error: failed ? `${failed} recipient(s) could not be delivered after retries.` : null,
        updated_at: new Date().toISOString(),
      }).eq("id", campaign.id);
      if (failed) await (supabaseAdmin as any).from("rex_events").insert({
        user_id: campaign.user_id, kind: "campaign_delivery_failures", severity: "medium",
        title: "Campaign finished with delivery failures",
        detail: `${failed} of ${campaign.total_recipients} recipients failed after retries.`,
      });
      completed += 1;
    } else {
      const noCapacityLeft = profiles.every((item) => !item.usage || item.usage.used >= item.usage.limit);
      if (noCapacityLeft) {
        const refreshedProfiles = await listProfileViews(campaign.user_id, CONNECTOR_ID);
        const nextCapacityAt = refreshedProfiles
          .map((profile) => profile.exhaustedUntil ? new Date(profile.exhaustedUntil).getTime() : NaN)
          .filter((time) => Number.isFinite(time) && time > Date.now())
          .sort((a, b) => a - b)[0];
        const resumeAt = new Date(nextCapacityAt ?? Date.now() + 60 * 60_000).toISOString();
        const detail = "Connected Gmail accounts have reached their protected rolling allowance. This approved campaign remains active and will continue when capacity renews.";
        await (supabaseAdmin as any).from("campaigns").update({
          status: "running", next_run_at: resumeAt, sent_count: sentCount,
          failed_count: failed ?? 0, last_error: detail, updated_at: new Date().toISOString(),
        }).eq("id", campaign.id).in("status", ["queued", "running"]);
      } else {
        await (supabaseAdmin as any).from("campaigns").update({
          status: "running", sent_count: sentCount, failed_count: failed ?? 0,
          // Per-recipient pacing is enforced inside this batch; make the
          // campaign eligible for the next minute's bounded worker tick.
          next_run_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }).eq("id", campaign.id);
      }
    }
    } catch (error) {
      // Never let one campaign's failure stop the other campaigns in this worker.
      console.error("[campaign-worker] campaign run failed; it will resume on the next tick", {
        campaignId: campaign.id, error: error instanceof Error ? error.message : String(error),
      });
      await (supabaseAdmin as any).from("campaigns").update({
        next_run_at: new Date(Date.now() + 30_000).toISOString(), updated_at: new Date().toISOString(),
      }).eq("id", campaign.id).in("status", ["queued", "running"]);
    }
    await releaseCampaignLease(supabaseAdmin, campaign);
  }));
  console.info("[campaign-worker] completed", { campaigns: campaigns?.length ?? 0, processed, completed, paused });
  return Response.json({ ok: true, campaigns: campaigns?.length ?? 0, processed, completed, paused });
}

export const Route = createFileRoute("/api/public/process-campaigns")({
  server: {
    handlers: {
      GET: async ({ request }) => await authorized(request) ? processCampaigns() : new Response("Unauthorized", { status: 401 }),
      POST: async ({ request }) => {
        if (!(await authorized(request))) return new Response("Unauthorized", { status: 401 });
        let campaignId: string | undefined;
        try {
          const payload = await request.json() as { campaignId?: unknown };
          if (typeof payload.campaignId === "string" && payload.campaignId.length <= 100) {
            campaignId = payload.campaignId;
          }
        } catch {
          return Response.json({ ok: false, error: "Invalid worker request." }, { status: 400 });
        }
        if (!campaignId) return Response.json({ ok: false, error: "A campaign ID is required for manual dispatch." }, { status: 400 });
        return processCampaigns(campaignId);
      },
    },
  },
});
