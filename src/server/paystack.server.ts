// Server-only Paystack integration. Secret key never leaves the server.
import { PLANS, PLAN_DAYS, PROMO_DAYS, type PlanId } from "@/server/billing.server";

const API = "https://api.paystack.co";

function secret(): string {
  const key = process.env["PAYSTACK_SECRET_KEY"];
  if (!key) throw new Error("Payments are temporarily unavailable. Please try again later.");
  if (!/^sk_(live|test)_/.test(key.trim()))
    throw new Error("Paystack secret key is invalid — it must start with sk_live_ or sk_test_.");
  return key.trim();
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Price is decided on the server from the account's own promo timestamp. */
export function priceKobo(plan: PlanId, promoStartedAt: string): number {
  const promoActive = new Date(promoStartedAt).getTime() + PROMO_DAYS * 86_400_000 > Date.now();
  const p = PLANS[plan];
  return (promoActive ? p.promo : p.normal) * 100;
}

export async function initialize(opts: {
  userId: string;
  email: string;
  plan: PlanId;
  amountKobo: number;
  callbackUrl: string;
}) {
  const reference = `ec_${opts.userId.slice(0, 8)}_${crypto.randomUUID().replace(/-/g, "")}`;
  const db = await admin();
  const { error } = await db.from("payments").insert({
    reference,
    user_id: opts.userId,
    plan: opts.plan,
    amount_kobo: opts.amountKobo,
  });
  if (error) throw error;

  const res = await fetch(`${API}/transaction/initialize`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: opts.email,
      amount: opts.amountKobo,
      currency: "NGN",
      reference,
      callback_url: opts.callbackUrl,
      metadata: { user_id: opts.userId, plan: opts.plan },
    }),
  });
  const body = (await res.json().catch(() => null)) as {
    status?: boolean;
    message?: string;
    data?: { authorization_url?: string };
  } | null;
  if (!res.ok || !body?.status || !body.data?.authorization_url) {
    console.error(`Paystack initialize failed [${res.status}]`, body);
    throw new Error(`Paystack could not start checkout: ${body?.message ?? res.status}`);
  }
  return { authorizationUrl: body.data.authorization_url, reference };
}

/**
 * Verifies with Paystack and activates the plan exactly once per reference.
 * Safe to call repeatedly (callback page + webhook).
 */
export async function verifyAndActivate(reference: string, expectUserId?: string) {
  const db = await admin();
  const { data: pay } = await db.from("payments").select("*").eq("reference", reference).maybeSingle();
  if (!pay) return { ok: false as const, reason: "unknown_reference" };
  if (expectUserId && pay.user_id !== expectUserId) return { ok: false as const, reason: "forbidden" };
  if (pay.status === "success") return { ok: true as const, plan: pay.plan, already: true };

  const res = await fetch(`${API}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secret()}` },
  });
  const body = (await res.json().catch(() => null)) as {
    data?: { status?: string; amount?: number; currency?: string };
  } | null;
  const d = body?.data;
  if (!res.ok || d?.status !== "success") {
    return { ok: false as const, reason: d?.status ?? `verify_${res.status}` };
  }
  if (d.amount !== pay.amount_kobo || d.currency !== "NGN") {
    console.error("Paystack amount mismatch", reference, d.amount, pay.amount_kobo);
    return { ok: false as const, reason: "amount_mismatch" };
  }

  // Claim the reference atomically so duplicate webhooks cannot re-activate.
  const now = new Date();
  const { data: claimed } = await db
    .from("payments")
    .update({ status: "success", activated_at: now.toISOString() })
    .eq("reference", reference)
    .neq("status", "success")
    .select("reference");
  if (!claimed || claimed.length === 0) return { ok: true as const, plan: pay.plan, already: true };

  const until = new Date(now.getTime() + PLAN_DAYS * 86_400_000).toISOString();
  const { error } = await db
    .from("user_billing")
    .update({ plan: pay.plan, plan_started_at: now.toISOString(), subscribed_until: until })
    .eq("user_id", pay.user_id);
  if (error) throw error;
  return { ok: true as const, plan: pay.plan, already: false };
}

export async function verifySignature(raw: string, signature: string | null): Promise<boolean> {
  if (!signature) return false;
  const { createHmac, timingSafeEqual } = await import("crypto");
  const expected = createHmac("sha512", secret()).update(raw).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
