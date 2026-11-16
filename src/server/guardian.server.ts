import { createHash } from "node:crypto";
import { COMPANY_MASTER_EMAIL, ensureBilling, entitlementsFor } from "@/server/billing.server";

type Restriction = { reason: string; expires_at: string; created_at: string; test_mode: boolean };

async function dbAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as { from: (table: string) => any };
}

export async function inspectOutgoingMessage(input: {
  userId: string;
  email?: string;
  connectionId: string;
  body: string;
}) {
  const text = input.body.trim();
  if (!text) return { allowed: false as const, code: "empty", message: "Write a message first." };

  const ent = await entitlementsFor(await ensureBilling(input.userId), input.email);
  const tier4 = ent.company || ent.plan === "promaxx";
  if (!tier4) return { allowed: true as const, guardianActive: false as const };

  const db = await dbAdmin();
  const now = new Date();
  const { data: current } = await db.from("master_account_restrictions")
    .select("reason, expires_at, created_at, test_mode")
    .eq("user_id", input.userId).eq("active", true).maybeSingle();
  const restriction = current as Restriction | null;
  if (restriction && new Date(restriction.expires_at).getTime() > now.getTime()) {
    return { allowed: false as const, code: "restricted", reason: restriction.reason, until: restriction.expires_at,
      message: `Sending is temporarily restricted until ${new Date(restriction.expires_at).toLocaleString()}. You can still use your account and submit an appeal in Support & Appeals.` };
  }

  // Explicit, reversible acceptance test. Only the company owner can trigger it.
  const isCompanyAdmin = (input.email ?? "").trim().toLowerCase() === COMPANY_MASTER_EMAIL;
  if (isCompanyAdmin && /^guardian test restriction$/i.test(text)) {
    const until = new Date(now.getTime() + 2 * 60_000).toISOString();
    await db.from("master_account_restrictions").upsert({
      user_id: input.userId, reason: "Guardian test restriction (2-minute test)",
      source: "guardian_test", active: true, test_mode: true, created_at: now.toISOString(), expires_at: until,
    }, { onConflict: "user_id" });
    return { allowed: false as const, code: "test_restriction", reason: "Guardian test restriction (2-minute test)", until,
      message: "Guardian test passed: sending is paused for 2 minutes. Login and account access remain available. Submit a test appeal through Support & Appeals." };
  }

  // Detect obvious credentials without retaining or logging the message body.
  const sensitive = /\b(?:otp|one[- ]time password|verification code|cvv|cvc|pin)\b/i.test(text)
    || /\b(?:account number|bank account|card number)\b.{0,35}\b\d[\d\s-]{7,}\b/i.test(text)
    || /\b\d{13,19}\b/.test(text);
  if (sensitive) {
    return { allowed: false as const, code: "sensitive_data",
      message: "This message appears to contain financial credentials or sensitive account details. Remove those details before sending. No account restriction has been applied." };
  }

  const digest = createHash("sha256").update(text.toLowerCase().replace(/\s+/g, " ")).digest("hex");
  await db.from("guardian_message_events").insert({
    user_id: input.userId, connection_id: input.connectionId, body_hash: digest, created_at: now.toISOString(),
  });
  const since = new Date(now.getTime() - 10 * 60_000).toISOString();
  const { data: repeats } = await db.from("guardian_message_events")
    .select("connection_id").eq("user_id", input.userId).eq("body_hash", digest).gte("created_at", since).limit(20);
  const rows = (repeats ?? []) as { connection_id: string }[];
  const distinctChats = new Set(rows.map((r) => r.connection_id));
  if (rows.length >= 5 && distinctChats.size >= 3) {
    const until = new Date(now.getTime() + 30 * 60_000).toISOString();
    const reason = "Repeated identical messages were detected across multiple conversations.";
    await db.from("master_account_restrictions").upsert({
      user_id: input.userId, reason, source: "guardian_spam", active: true,
      test_mode: false, created_at: now.toISOString(), expires_at: until,
    }, { onConflict: "user_id" });
    return { allowed: false as const, code: "spam_restriction", reason, until,
      message: "Sending is temporarily paused because repeated identical messages were detected. You can still log in and submit an appeal in Support & Appeals." };
  }
  return { allowed: true as const, guardianActive: true as const };
}

export async function clearExpiredRestriction(userId: string) {
  const db = await dbAdmin();
  await db.from("master_account_restrictions").update({ active: false })
    .eq("user_id", userId).eq("active", true).lte("expires_at", new Date().toISOString());
}
