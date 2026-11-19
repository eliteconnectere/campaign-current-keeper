import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CONNECTOR_ID = "google_mail";

/** Required for Google Workspace API / Email Sender Guidelines compliance. */
const UNSUBSCRIBE_FOOTER_HTML = `
<br><br>
<hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;">
<div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #eeeeee; text-align: center; font-size: 12px; color: #777777; font-family: sans-serif;">
  You received this email because your address is subscribed to communications via Elite Connectere.<br>
  If you no longer wish to receive these emails, you can <a href="https://eliteconnectere.site/unsubscribe" style="color: #0066cc; text-decoration: underline;">unsubscribe here</a>.
</div>
`.trim();

function withUnsubscribeFooter(body: string): string {
  const src = String(body ?? "");
  if (/eliteconnectere\.site\/unsubscribe/i.test(src) && /unsubscribe/i.test(src)) {
    return src;
  }
  return `${src}${src.endsWith("\n") || src.endsWith(">") ? "" : "\n"}${UNSUBSCRIBE_FOOTER_HTML}`;
}

export type GmailProfile = {
  id: string;
  email: string;
  slot: number;
  used: number;
  limit: number;
  exhausted: boolean;
  exhaustedUntil: string | null;
};

export const prepareGmailConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listProfileRows, connectedTodayCount } = await import("@/server/gmailProfiles.server");
    const { ensureBilling, entitlementsFor } = await import("@/server/billing.server");
    const ent = await entitlementsFor(
      await ensureBilling(context.userId),
      (context.claims as { email?: string } | undefined)?.email,
    );
    if (!ent.premium && !ent.trialActive && !ent.communityPromo) {
      return { locked: true as const, reason: "trial_expired" as const, limit: 0 };
    }
    // Company owner and Company Team Seat admins use the Company Gmail pool.
    // Do not route them through the retired Hotspot/team_seats system.
    let total = (await listProfileRows(context.userId, CONNECTOR_ID)).length;
    let limit = ent.profileLimit;
    if (ent.company || ent.companyAdmin) {
      if (total >= limit) {
        return { locked: true as const, reason: "profile_limit" as const, limit };
      }
    } else {
      // Legacy paid-plan sharing remains isolated from Company Team Seats.
      try {
        const team = await import("@/server/team.server");
        const email = (context.claims as { email?: string } | undefined)?.email;
        const personal = await team.assistantGmailCap(context.userId, email, CONNECTOR_ID);
        if (personal && personal.used >= personal.limit) {
          return { locked: true as const, reason: "profile_limit" as const, limit: personal.limit };
        }
        const gate = await team.teamSharedProfileGate(
          context.userId, email, ent.profileLimit, CONNECTOR_ID,
        );
        if (gate.shared) {
          total = gate.used;
          limit = gate.limit;
          if (limit <= 0 || (personal ? total > limit : total >= limit)) {
            return { locked: true as const, reason: "profile_limit" as const, limit };
          }
        } else if (total >= limit) {
          return { locked: true as const, reason: "profile_limit" as const, limit };
        }
      } catch (e) {
        console.error("team profile gate", e);
        return { locked: true as const, reason: "profile_limit" as const, limit: 0 };
      }
    }

    if (!ent.premium && (await connectedTodayCount(context.userId, CONNECTOR_ID)) >= ent.profilesPerDay) {
      return { locked: true as const, reason: "daily_connect" as const, limit: ent.profilesPerDay };
    }

    const request = getRequest();
    const url = new URL(request.url);
    const sandboxHost = url.hostname === "localhost" ? request.headers.get("x-forwarded-host") : null;
    const origin = sandboxHost ? `https://${sandboxHost}` : url.origin;
    const redirectUri = `${origin}/api/public/gmail/callback`;

    const { googleClientId } = await import("@/server/google.server");
    const { googleAuthorizeUrl } = await import("@/server/gmailConnect.server");
    const attempt = crypto.randomUUID();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("gmail_connect_attempts" as never)
      .insert({ id: attempt, user_id: context.userId, redirect_uri: redirectUri } as never);
    if (error) throw error;
    return {
      locked: false as const,
      attempt,
      authorizeUrl: googleAuthorizeUrl(googleClientId(), redirectUri, attempt),
    };
  });

export const getGmailConnectAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { attempt: string }) => ({ attempt: String(input?.attempt ?? "") }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ATTEMPT_TTL_MS } = await import("@/server/gmailConnect.server");
    const { data: row } = await supabaseAdmin
      .from("gmail_connect_attempts" as never)
      .select("status, email, message, created_at")
      .eq("id", data.attempt)
      .eq("user_id", context.userId)
      .maybeSingle();
    const r = row as
      | { status: string; email: string | null; message: string | null; created_at: string }
      | null;
    if (!r) return { status: "missing", email: null, message: null };
    if (r.status === "pending" && Date.now() - new Date(r.created_at).getTime() > ATTEMPT_TTL_MS) {
      await supabaseAdmin
        .from("gmail_connect_attempts" as never)
        .update({ status: "expired" } as never)
        .eq("id", data.attempt)
        .eq("status", "pending");
      return { status: "expired", email: null, message: null };
    }
    return { status: r.status, email: r.email, message: r.message };
  });

export const cancelGmailConnectAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { attempt: string }) => ({ attempt: String(input?.attempt ?? "") }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("gmail_connect_attempts" as never)
      .update({ status: "cancelled", completed_at: new Date().toISOString() } as never)
      .eq("id", data.attempt)
      .eq("user_id", context.userId)
      .eq("status", "pending");
    return { ok: true as const };
  });

export const testGmailProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { profileId: string }) => {
    if (!input?.profileId) throw new Error("A profile is required.");
    return { profileId: input.profileId };
  })
  .handler(async ({ data, context }) => {
    const { getProfileRow, decryptKey } = await import("@/server/gmailProfiles.server");
    const google = await import("@/server/google.server");
    const row = await getProfileRow(context.userId, CONNECTOR_ID, data.profileId);
    if (!row) return { ok: false as const, reason: "missing" as const };
    try {
      const { token } = await google.accessTokenFor(decryptKey(row));
      const res = await google.gmailSend(
        token,
        rawEmail(
          row.account_email,
          "Elite Connectere test email",
          "This Gmail profile is connected and can send from Elite Connectere.",
        ),
      );
      if (res.status === 401 || res.status === 403) return { ok: false as const, reason: "reconnect" as const };
      if (!res.ok) return { ok: false as const, reason: "error" as const };
      return { ok: true as const, reason: "sent" as const, email: row.account_email };
    } catch (e) {
      if (e instanceof google.GoogleReconnect) return { ok: false as const, reason: "reconnect" as const };
      console.error("Test send failed", e);
      return { ok: false as const, reason: "error" as const };
    }
  });

export const listGmailProfiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ profiles: GmailProfile[] }> => {
    const { listProfileViews } = await import("@/server/gmailProfiles.server");
    return { profiles: await listProfileViews(context.userId, CONNECTOR_ID) };
  });

export const disconnectGmailProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { profileId: string }) => {
    if (!input?.profileId) throw new Error("A profile is required.");
    return { profileId: input.profileId };
  })
  .handler(async ({ data, context }): Promise<{ profiles: GmailProfile[] }> => {
    const { getProfileRow, deleteProfile, decryptKey, listProfileViews } = await import(
      "@/server/gmailProfiles.server"
    );
    const row = await getProfileRow(context.userId, CONNECTOR_ID, data.profileId);
    if (row) {
      try {
        const { revoke } = await import("@/server/google.server");
        await revoke(decryptKey(row));
      } catch (error) {
        console.error(error);
      }
      await deleteProfile(context.userId, CONNECTOR_ID, data.profileId);
    }
    return { profiles: await listProfileViews(context.userId, CONNECTOR_ID) };
  });

function b64(s: string) {
  return btoa(Array.from(new TextEncoder().encode(s), (b) => String.fromCharCode(b)).join(""));
}
function header(v: string) {
  return /^[\x00-\x7F]*$/.test(v) ? v : `=?UTF-8?B?${b64(v)}?=`;
}
function rawEmail(to: string, subject: string, body: string) {
  const fullBody = withUnsubscribeFooter(body);
  const looksHtml = /<[a-z][\s\S]*>/i.test(body);
  const amp = String.fromCharCode(38) + "amp;";
  const lt = String.fromCharCode(38) + "lt;";
  const gt = String.fromCharCode(38) + "gt;";
  const htmlBody = looksHtml
    ? fullBody
    : fullBody
        .split(UNSUBSCRIBE_FOOTER_HTML)[0]!
        .replace(/&/g, amp)
        .replace(/</g, lt)
        .replace(/>/g, gt)
        .replace(/\n/g, "<br>\n") + UNSUBSCRIBE_FOOTER_HTML;

  const email = [
    `To: ${to}`,
    `Subject: ${header(subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "",
    htmlBody,
  ].join("\r\n");
  return b64(email).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export type SendResult =
  | {
      ok: true;
      profileId: string;
      email: string;
      rotated: boolean;
      profiles: GmailProfile[];
    }
  | {
      ok: false;
      reason: "no_profiles" | "all_exhausted" | "reconnect" | "error" | "allowance_exhausted" | "trial_expired" | "already_sent";
      profileId?: string | undefined;
      message?: string | undefined;
      profiles: GmailProfile[];
    };

export const sendGmailMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { to: string; subject?: string; body: string; profileId?: string | null; permanentSendProtection?: boolean }) => {
      if (!input || typeof input.to !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.to)) {
        throw new Error("A valid recipient address is required.");
      }
      return {
        to: input.to,
        subject: String(input.subject ?? "").slice(0, 500),
        body: String(input.body ?? "").slice(0, 20000),
        profileId: input.profileId ?? null,
        permanentSendProtection: input.permanentSendProtection === true,
      };
    },
  )
  .handler(async ({ data, context }): Promise<SendResult> => {
    const { createHash } = await import("node:crypto");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Load trusted, account-owned Rex preferences on the server; never trust client toggles.
    const { data: rexRow } = await (supabaseAdmin as any).from("rex_settings").select("config").eq("user_id", context.userId).maybeSingle();
    const rexConfig = (rexRow?.config ?? {}) as any;
    if (rexConfig.preSendReview !== false && rexConfig.warnOnRisk !== false) {
      const { scanCampaignContent } = await import("@/lib/contentSafety");
      const risk = scanCampaignContent(data.subject, data.body);
      if (risk.blocked) {
        const detail = risk.reasons.join("; ");
        await (supabaseAdmin as any).from("rex_events").insert({
          user_id: context.userId, kind: "pre_send_risk", severity: "high",
          title: "Rex flagged a campaign message before sending",
          detail: `The message was stopped before delivery. ${detail}`,
        });
        return {
          ok: false, reason: "error",
          message: `Rex stopped this message before sending: ${detail}. Edit the content and try again.`,
          profiles: [],
        };
      }
    }
    // Permanent Send Protection is available to all plans — no plan gate.
    const recipientEmail = data.to.trim().toLowerCase();
    const bodyHash = createHash("sha256").update(data.body).digest("hex").slice(0, 64);
    const dedupeKey = `${context.userId}:${recipientEmail}:${data.subject}:${bodyHash}`;
    const { data: claim, error: claimError } = data.permanentSendProtection
      ? await supabaseAdmin
          .from("campaign_delivery_history")
          .insert({ user_id: context.userId, recipient_email: recipientEmail, subject: data.subject, body_hash: bodyHash })
          .select("id")
          .single()
      : { data: null, error: null };
    if (claimError?.code === "23505") {
      return {
        ok: false,
        reason: "already_sent",
        message: "This exact message was already sent to this recipient. Skipped safely.",
        profiles: [],
      };
    }
    if (data.permanentSendProtection && (claimError || !claim)) throw claimError ?? new Error(`Could not create send claim ${dedupeKey}.`);

    const {
      listProfileRows,
      listProfileViews,
      batchEnsureIdentityUsage,
      normaliseEmail,
      usageOf,
      decryptKey,
      recordSend,
    } = await import("@/server/gmailProfiles.server");

    const releaseClaim = async () => {
      if (claim?.id) await supabaseAdmin.from("campaign_delivery_history").delete().eq("id", claim.id);
    };
    const billing = await import("@/server/billing.server");
    const masterEmail = (context.claims as { email?: string } | undefined)?.email;
    const ent = await billing.entitlementsFor(await billing.ensureBilling(context.userId), masterEmail);
    if (!ent.premium && !ent.trialActive && !ent.communityPromo) {
      await releaseClaim();
      return { ok: false, reason: "trial_expired", profiles: await listProfileViews(context.userId, CONNECTOR_ID) };
    }
    if (ent.allowance != null && ent.used >= ent.allowance) {
      await releaseClaim();
      return {
        ok: false,
        reason: "allowance_exhausted",
        profiles: await listProfileViews(context.userId, CONNECTOR_ID),
      };
    }

    const rows = await listProfileRows(context.userId, CONNECTOR_ID);
    if (rows.length === 0) {
      await releaseClaim();
      return { ok: false, reason: "no_profiles", profiles: [] };
    }

    const usageMap = await batchEnsureIdentityUsage(rows.map((row) => row.email_key));
    const eligible = rows.filter((row) => {
      const usage = usageMap.get(normaliseEmail(row.email_key));
      if (!usage) throw new Error("Gmail identity usage is missing for a connected profile.");
      return !usageOf(usage).exhausted;
    });
    if (eligible.length === 0) {
      await releaseClaim();
      return {
        ok: false,
        reason: "all_exhausted",
        profiles: await listProfileViews(context.userId, CONNECTOR_ID),
      };
    }

    const preferred = eligible.find((r) => r.id === data.profileId) ?? eligible[0]!;
    const rotated = data.profileId != null && preferred.id !== data.profileId;
    const google = await import("@/server/google.server");

    let res: Response;
    try {
      const { token } = await google.accessTokenFor(decryptKey(preferred));
      res = await google.gmailSend(token, rawEmail(data.to, data.subject, data.body));
    } catch (error) {
      const reconnect = error instanceof google.GoogleReconnect || /decrypt|auth/i.test(String(error));
      console.error("Gmail send failed", error);
      return {
        ok: false,
        reason: reconnect ? "reconnect" : "error",
        profileId: preferred.id,
        message: error instanceof Error ? error.message : undefined,
        profiles: await listProfileViews(context.userId, CONNECTOR_ID),
      };
    }

    if (res.status === 401 || res.status === 403) {
      await releaseClaim();
      const bodyText = await res.text();
      console.error(`Gmail send refused [${res.status}]: ${bodyText}`);
      const isQuota = /quota|rateLimitExceeded|userRateLimit/i.test(bodyText);
      if (!isQuota) {
        try {
          const { flagAccount } = await import("@/server/gmailPenalties.server");
          await flagAccount(preferred.email_key);
        } catch (e) {
          console.error("flagAccount trigger error", e);
        }
      }
      return {
        ok: false,
        reason: isQuota ? ("all_exhausted" as const) : ("reconnect" as const),
        profileId: preferred.id,
        message: isQuota
          ? "Gmail daily sending quota or rate limit exceeded for this profile."
          : `Gmail account ${preferred.account_email} was flagged by Google and disconnected. It is suspended from Elite Engine for 5 days.`,
        profiles: await listProfileViews(context.userId, CONNECTOR_ID),
      };
    }

    if (!res.ok) {
      await releaseClaim();
      const body = await res.text();
      console.error(`Gmail send failed [${res.status}]: ${body}`);
      return {
        ok: false,
        reason: "error" as const,
        profileId: preferred.id,
        message: `Gmail refused the send (${res.status}).`,
        profiles: await listProfileViews(context.userId, CONNECTOR_ID),
      };
    }

    if (data.permanentSendProtection && claim?.id) {
      await supabaseAdmin
        .from("campaign_delivery_history")
        .update({ gmail_profile_email: preferred.account_email })
        .eq("id", claim.id);
    }
    await recordSend(preferred.email_key);
    await billing.logSend(context.userId, "elite");
    return {
      ok: true,
      profileId: preferred.id,
      email: preferred.account_email,
      rotated,
      profiles: await listProfileViews(context.userId, CONNECTOR_ID),
    };
  });

export const setGmailTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { profileId: string; target: number }) => {
    const target = Math.floor(Number(input?.target));
    if (typeof input?.profileId !== "string" || !Number.isFinite(target) || target < 1 || target > 420)
      throw new Error("Target must be a whole number between 1 and 420.");
    return { profileId: input.profileId, target };
  })
  .handler(async ({ context, data }) => {
    const { ensureBilling, entitlementsFor } = await import("@/server/billing.server");
    const { getProfileRow } = await import("@/server/gmailProfiles.server");
    const claims = context.claims as { email?: string } | undefined;
    const ent = await entitlementsFor(await ensureBilling(context.userId), claims?.email);
    if (!ent.customization) throw new Error("Target editing is an Elite Studio ProMaxx feature.");
    const row = await getProfileRow(context.userId, CONNECTOR_ID, data.profileId);
    if (!row) throw new Error("That sending profile no longer exists.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("gmail_identity_usage")
      .update({ daily_limit: data.target })
      .eq("email_key", row.email_key);
    if (error) throw error;
    return { ok: true as const, target: data.target };
  });
