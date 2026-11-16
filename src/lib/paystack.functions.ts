import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type PlanId = "starter" | "standard" | "premium" | "promaxx";

export const startCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { plan: PlanId }) => {
    if (!["starter", "standard", "premium", "promaxx"].includes(input?.plan)) {
      throw new Error("Unknown plan.");
    }
    return { plan: input.plan };
  })
  .handler(async ({ data, context }) => {
    const { ensureBilling } = await import("@/server/billing.server");
    const { initialize, priceKobo } = await import("@/server/paystack.server");
    const email = (context.claims as { email?: string } | undefined)?.email;
    if (!email) throw new Error("Your account needs an email address to pay.");
    const billing = await ensureBilling(context.userId);

    const request = getRequest();
    const url = new URL(request!.url);
    const sandboxHost = url.hostname === "localhost" ? request!.headers.get("x-forwarded-host") : null;
    const callbackUrl = new URL("/billing/return", sandboxHost ? `https://${sandboxHost}` : url.origin).toString();

    return initialize({
      userId: context.userId,
      email,
      plan: data.plan,
      amountKobo: priceKobo(data.plan, billing.promo_started_at),
      callbackUrl,
    });
  });

export const verifyCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reference: string }) => {
    if (typeof input?.reference !== "string" || !/^[\w-]{6,100}$/.test(input.reference)) {
      throw new Error("Invalid payment reference.");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const { verifyAndActivate } = await import("@/server/paystack.server");
    return verifyAndActivate(data.reference, context.userId);
  });
