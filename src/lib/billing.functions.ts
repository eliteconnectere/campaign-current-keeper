import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Entitlements = {
  premium: boolean;
  trialActive: boolean;
  trialEndsAt: string;
  promoActive: boolean;
  promoEndsAt: string;
  profilesPerDay: number;
  lockedDelays: number[];
  plan: "starter" | "standard" | "premium" | "promaxx" | "free" | "company";
  planEndsAt: string | null;
  profileLimit: number;
  allowance: number | null;
  used: number;
  sent24h: number;
  customization: boolean;
  company: boolean;
  companyAdmin?: boolean;
  isAssistant?: boolean;
  assistantGmailCap?: number | null;
  communityPromo?: boolean;
};

/** The signed-in Elite Connectere account's trial / promotion / subscription state. */
export const getEntitlements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Entitlements> => {
    const { ensureBilling, entitlementsFor } = await import("@/server/billing.server");
    const claims = context.claims as { created_at?: string; iat?: number; email?: string } | undefined;
    const registeredAt =
      claims?.created_at ??
      (claims?.iat ? new Date(claims.iat * 1000).toISOString() : new Date().toISOString());
    return entitlementsFor(await ensureBilling(context.userId, registeredAt), claims?.email);
  });

/** Standard Mode send: records one completed send against the Master account. */
export const recordStandardSend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { ensureBilling, entitlementsFor, logSend } = await import("@/server/billing.server");
    const claims = context.claims as { email?: string } | undefined;
    const ent = await entitlementsFor(await ensureBilling(context.userId), claims?.email);
    if (ent.allowance != null && ent.used >= ent.allowance) return { ok: false as const };
    await logSend(context.userId, "standard");
    return { ok: true as const };
  });
