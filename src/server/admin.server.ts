/**
 * Company admin queue (appeals / complaints / reports) + anonymous subscriber pulse.
 * Server-only. Tables have RLS with no policies: only the service role reaches them.
 */
import { COMPANY_MASTER_EMAIL } from "@/server/billing.server";

export const REVIEW_HOLD_MS = 24 * 60 * 60 * 1000;
export const ONLINE_WINDOW_MS = 2 * 60 * 1000;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // New tables may not be in generated types yet.
  return supabaseAdmin as unknown as {
    from: (t: string) => any;
    auth: typeof supabaseAdmin.auth;
  };
}

export async function isCompanyAdmin(userId: string, email: string | undefined | null) {
  const { companyAdminRole } = await import("@/server/company-team.server");
  return (await companyAdminRole(userId, email)) !== null;
}

export async function isCompanyOwner(email: string | undefined | null) {
  return (email ?? "").trim().toLowerCase() === COMPANY_MASTER_EMAIL;
}

export type Submission = {
  id: string;
  user_id: string;
  type: "appeal" | "complaint" | "report";
  body: string;
  status: "pending" | "under_review" | "approved" | "declined";
  final_decision: "approved" | "declined" | null;
  decision_reason: string | null;
  decided_at: string | null;
  release_at: string | null;
  user_notified_at: string | null;
  created_at: string;
};

export async function createSubmission(userId: string, type: string, body: string) {
  const t = ["appeal", "complaint", "report"].includes(type) ? type : "appeal";
  const text = body.trim().slice(0, 4000);
  if (!text) return { ok: false as const, error: "Please write your message." };
  const db = await admin();
  const { count } = await db
    .from("admin_submissions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "pending");
  if ((count ?? 0) >= 5) {
    return { ok: false as const, error: "You already have 5 open messages. Please wait for a reply." };
  }
  const { error } = await db.from("admin_submissions").insert({ user_id: userId, type: t, body: text });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function listAllSubmissions(): Promise<Submission[]> {
  const db = await admin();
  const { data } = await db
    .from("admin_submissions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  return (data ?? []) as Submission[];
}

/** Admin decision is stored but held as "under_review" for 24 hours. */
export async function decideSubmission(id: string, decision: "approved" | "declined", reason: string) {
  if (decision === "declined" && !reason.trim()) {
    return { ok: false as const, error: "A reason is required to decline." };
  }
  const db = await admin();
  const now = Date.now();
  const { data, error } = await db
    .from("admin_submissions")
    .update({
      status: "under_review",
      final_decision: decision,
      decision_reason: reason.trim().slice(0, 2000) || null,
      decided_at: new Date(now).toISOString(),
      release_at: new Date(now + REVIEW_HOLD_MS).toISOString(),
    })
    .eq("id", id)
    .in("status", ["pending", "under_review"])
    .is("user_notified_at", null)
    .select("id");
  if (error) return { ok: false as const, error: error.message };
  if (!data?.length) return { ok: false as const, error: "This item was already released." };
  return { ok: true as const };
}

/** User view: hides the final decision until release_at has passed. */
export async function listMySubmissions(userId: string) {
  await releaseDueDecisions();
  const db = await admin();
  const { data } = await db
    .from("admin_submissions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  return ((data ?? []) as Submission[]).map((s) => {
    const released = s.status === "approved" || s.status === "declined";
    return {
      id: s.id,
      type: s.type,
      body: s.body,
      status: released ? s.status : s.status === "under_review" ? "under_review" : "pending",
      reason: released ? s.decision_reason : null,
      created_at: s.created_at,
      released_at: released ? s.user_notified_at : null,
    };
  });
}

/**
 * Releases held decisions whose 24h window passed. The conditional update makes
 * each row flip exactly once, so the email is never sent twice.
 */
export async function releaseDueDecisions() {
  const db = await admin();
  const { data: due } = await db
    .from("admin_submissions")
    .select("id, final_decision")
    .eq("status", "under_review")
    .is("user_notified_at", null)
    .lte("release_at", new Date().toISOString())
    .limit(25);
  for (const row of (due ?? []) as { id: string; final_decision: string | null }[]) {
    if (row.final_decision !== "approved" && row.final_decision !== "declined") continue;
    const { data: claimed } = await db
      .from("admin_submissions")
      .update({ status: row.final_decision, user_notified_at: new Date().toISOString() })
      .eq("id", row.id)
      .eq("status", "under_review")
      .is("user_notified_at", null)
      .select("*");
    const s = (claimed?.[0] ?? null) as Submission | null;
    if (s) await emailDecision(s).catch((e) => console.error("emailDecision", e));
  }
}

function b64url(s: string) {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Sends one decision email from the company's own connected Gmail profile. */
async function emailDecision(s: Submission) {
  const db = await admin();
  const { data: u } = await db.auth.admin.getUserById(s.user_id);
  const to = u?.user?.email;
  if (!to) return;
  const { data: prof } = await db
    .from("gmail_profiles")
    .select("id, account_email, email_key, connection_key_ciphertext, position, slot")
    .eq("email_key", COMPANY_MASTER_EMAIL)
    .limit(1)
    .maybeSingle();
  if (!prof) {
    console.warn("emailDecision: company Gmail is not connected; in-app notice only.");
    return;
  }
  const { decryptKey } = await import("@/server/gmailProfiles.server");
  const { accessTokenFor, gmailSend } = await import("@/server/google.server");
  const { token } = await accessTokenFor(decryptKey(prof));
  const label = s.type === "appeal" ? "appeal" : s.type;
  const subject =
    s.final_decision === "approved"
      ? `Your Elite Connectere ${label} was approved`
      : `Update on your Elite Connectere ${label}`;
  const text =
    s.final_decision === "approved"
      ? `Hello,\n\nGood news: after review, your ${label} has been approved.\n\n— Elite Connectere Team`
      : `Hello,\n\nAfter review, your ${label} was not approved.\n\nReason:\n${s.decision_reason ?? "Policy review."}\n\nIf you believe this is a mistake, reply to this email for further review.\n\n— Elite Connectere Team`;
  const raw = [
    `From: Elite Connectere <${COMPANY_MASTER_EMAIL}>`,
    `To: ${to}`,
    `Reply-To: ${COMPANY_MASTER_EMAIL}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    text,
  ].join("\r\n");
  const res = await gmailSend(token, b64url(raw));
  if (!res.ok) console.error("emailDecision send failed", res.status, await res.text());
}

export async function heartbeat(userId: string) {
  const db = await admin();
  await db.from("user_presence").upsert({ user_id: userId, last_seen: new Date().toISOString() });
}

/**
 * Anonymous pulse for master admin:
 * - totalRegistered: everyone with a billing row (proxy for accounts using the app)
 * - total: paid / active subscribers
 * - online: presence within last 2 minutes
 * - dots: anonymous online/offline flags only (no names, emails, ids)
 */
export async function subscriberPulse() {
  const db = await admin();

  // All accounts that have ever touched billing (registered users of the app)
  const { count: registeredCount } = await db
    .from("user_billing")
    .select("user_id", { count: "exact", head: true });

  // Active paid subscribers
  const { data: subs } = await db
    .from("user_billing")
    .select("user_id")
    .neq("plan", "free")
    .gt("subscribed_until", new Date().toISOString())
    .limit(5000);
  const subIds = ((subs ?? []) as { user_id: string }[]).map((r) => r.user_id);

  // Anyone online recently (registered base)
  const { data: allPres } = await db
    .from("user_presence")
    .select("user_id")
    .gte("last_seen", new Date(Date.now() - ONLINE_WINDOW_MS).toISOString())
    .limit(5000);
  const onlineSet = new Set(((allPres ?? []) as { user_id: string }[]).map((r) => r.user_id));

  const onlineSubs = subIds.filter((id) => onlineSet.has(id)).length;
  const offlineSubs = Math.max(0, subIds.length - onlineSubs);
  const onlineAll = onlineSet.size;
  const registered = registeredCount ?? 0;

  // Anonymous dots for paid subscribers (online first, then offline) — cap UI at 80
  const maxDots = 80;
  const dots: boolean[] = [
    ...Array(Math.min(onlineSubs, maxDots)).fill(true),
    ...Array(Math.min(offlineSubs, Math.max(0, maxDots - Math.min(onlineSubs, maxDots)))).fill(false),
  ];

  return {
    totalRegistered: registered,
    total: subIds.length,
    online: onlineSubs,
    offline: offlineSubs,
    onlineAll,
    dots,
  };
}
