// Server-only subscription / trial / promotional state.
// Trial and promotion are anchored to persistent timestamps so they can never
// restart on refresh, logout or reinstall.

import { communityPromoEndsAt, isCommunityPromoMonth, COMMUNITY_PROMO } from "@/lib/communityPromo";

/** Elite Engine free trial, anchored to the server-side account creation time. */
export const TRIAL_DAYS = 5;
export const PROMO_DAYS = 5;
export const TRIAL_PROFILES_PER_DAY = 5;

export type BillingRow = {
  user_id: string;
  promo_started_at: string;
  registered_at: string;
  plan: string;
  subscribed_until: string | null;
  plan_started_at?: string | null;
};

export type PlanId = "starter" | "standard" | "premium" | "promaxx";

/** Map legacy plan ids from the database to the new ids. */
function normalizePlan(raw: string): PlanId | null {
  if (raw === "starter" || raw === "standard" || raw === "premium" || raw === "promaxx") return raw;
  if (raw === "plan1") return "starter";
  if (raw === "plan2") return "standard";
  if (raw === "plan3") return "premium";
  return null;
}

export const PLANS: Record<
  PlanId,
  { name: string; normal: number; promo: number; profiles: number; allowance: number | null; customization: boolean }
> = {
  starter: {
    name: "Starter",
    normal: 1200,
    promo: 1000,
    profiles: 10,
    allowance: 18_000,
    customization: false,
  },
  standard: {
    name: "Standard",
    normal: 2400,
    promo: 2000,
    profiles: 25,
    allowance: 45_000,
    customization: false,
  },
  premium: {
    name: "Premium",
    normal: 3600,
    promo: 3000,
    profiles: 60,
    allowance: 200_000,
    customization: false,
  },
  promaxx: {
    name: "Elite Studio ProMaxx",
    normal: 5000,
    promo: 4500,
    profiles: 75,
    allowance: 300_000,
    customization: true,
  },
};

export const PLAN_DAYS = 30;
export const COMPANY_MASTER_EMAIL = "eliteconnectere@gmail.com";

export type Entitlements = {
  premium: boolean;
  trialActive: boolean;
  trialEndsAt: string;
  promoActive: boolean;
  promoEndsAt: string;
  profilesPerDay: number;
  lockedDelays: number[];
  plan: PlanId | "free" | "company";
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
  /** November community free month */
  communityPromo?: boolean;
  sharingBlocked: boolean;
  sharingBlockReason: string | null;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function ensureBilling(userId: string, registeredAt?: string): Promise<BillingRow> {
  const db = await admin();
  const { data } = await db
    .from("user_billing")
    .select("user_id, promo_started_at, registered_at, plan, subscribed_until, plan_started_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (data) return data as BillingRow;

  const now = new Date().toISOString();
  const fresh = {
    user_id: userId,
    promo_started_at: now,
    registered_at: registeredAt ?? now,
    plan: "free",
    subscribed_until: null,
  };
  const { error } = await db.from("user_billing").insert(fresh);
  if (error) {
    const { data: again } = await db
      .from("user_billing")
      .select("user_id, promo_started_at, registered_at, plan, subscribed_until, plan_started_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (again) return again as BillingRow;
    throw error;
  }
  return fresh as BillingRow;
}

function plus(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * 86_400_000).toISOString();
}

/** Successful sends in the rolling window, counted from real timestamps. */
export async function countSends(userId: string, sinceIso: string): Promise<number> {
  const db = await admin();
  const { count } = await db
    .from("send_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("sent_at", sinceIso);
  return count ?? 0;
}

export async function logSend(userId: string, mode: "standard" | "elite") {
  const db = await admin();
  await db.from("send_events").insert({ user_id: userId, mode });
}

/** The single source of truth for what the Master account may do right now. */
export async function entitlementsFor(
  row: BillingRow,
  masterEmail: string | undefined,
): Promise<Entitlements> {
  const now = Date.now();
  const { companyAdminRole } = await import("@/server/company-team.server");
  const companyRole = await companyAdminRole(row.user_id, masterEmail);
  const company = (masterEmail ?? "").trim().toLowerCase() === COMPANY_MASTER_EMAIL;
  const companyAdmin = companyRole !== null;
  const trialEndsAt = plus(row.registered_at, TRIAL_DAYS);
  const promoEndsAt = plus(row.promo_started_at, PROMO_DAYS);
  const normalized = normalizePlan(row.plan);
  const paid =
    Boolean(row.subscribed_until && new Date(row.subscribed_until).getTime() > now) &&
    normalized !== null;
  const trialActive = new Date(trialEndsAt).getTime() > now;
  const since24 = new Date(now - 86_400_000).toISOString();
  const sent24h = await countSends(row.user_id, since24);

  let plan: Entitlements["plan"] = "free";
  let profileLimit = TRIAL_PROFILES_PER_DAY;
  let allowance: number | null = null;
  let used = 0;
  let customization = false;
  let isAssistant = false;
  let assistantGmailCap: number | null = null;
  let communityPromo = false;
  let inheritedPlanEndsAt: string | null = null;

  if (company || companyAdmin) {
    // Company Team Seat admins inherit the full Company workspace tier.
    // The separate companyAdmin role remains the authority boundary for
    // Team Seats management; only the master owner can invite or revoke.
    plan = "company";
    profileLimit = PLANS.promaxx.profiles;
    allowance = null;
    customization = true;
  } else if (paid && normalized) {
    const p = PLANS[normalized];
    plan = normalized;
    profileLimit = p.profiles;
    allowance = p.allowance;
    customization = p.customization;
    const start = row.plan_started_at ?? plus(row.subscribed_until!, -PLAN_DAYS);
    // A hotspot is one shared subscription: count the owner's and every active
    // member's standard sends and campaign deliveries against the same allowance.
    const { teamUserIdsFor } = await import("@/server/team.server");
    const team = await teamUserIdsFor(row.user_id, masterEmail);
    const userIds = team?.ownerUserId === row.user_id ? team.userIds : [row.user_id];
    const db = await admin();
    const [standard, campaign] = await Promise.all([
      db.from("send_events").select("id", { count: "exact", head: true })
        .in("user_id", userIds).gte("sent_at", start),
      db.from("campaign_delivery_history").select("id", { count: "exact", head: true })
        .in("user_id", userIds).gte("sent_at", start),
    ]);
    if (standard.error || campaign.error) throw standard.error ?? campaign.error;
    used = (standard.count ?? 0) + (campaign.count ?? 0);
  }

  if (!company && !companyAdmin) {
    try {
      const { teamOwnerBillingForMember } = await import("@/server/team.server");
      const team = await teamOwnerBillingForMember(row.user_id, masterEmail);
      if (team?.inherited) {
        const rank: Record<string, number> = {
          free: 0, starter: 1, standard: 2, premium: 3, promaxx: 4, company: 5,
        };
        const inheritedPlan = team.inherited.plan;
        if ((rank[inheritedPlan] ?? 0) >= (rank[plan] ?? 0)) {
          isAssistant = true;
          assistantGmailCap = team.inherited.profileLimit ?? null;
          plan = inheritedPlan;
          profileLimit = team.inherited.profileLimit;
          allowance = team.inherited.allowance;
          customization = team.inherited.customization;
          inheritedPlanEndsAt = team.inherited.planEndsAt ?? null;
          used = team.ownerEnt.used;
        }
      }
    } catch (e) {
      console.error("team entitlement lookup", e);
    }
  }

  const { GOOGLE_REVIEW_MODE } = await import("@/lib/reviewMode");
  if (GOOGLE_REVIEW_MODE && !company && plan === "free") {
    plan = "premium";
    profileLimit = PLANS.premium.profiles;
    allowance = null;
    customization = true;
  }

  // November 2026 community promo (The Bloodline) — free tier only
  if (!company && !companyAdmin && !isAssistant && plan === "free" && isCommunityPromoMonth(new Date(now))) {
    communityPromo = true;
    profileLimit = COMMUNITY_PROMO.maxGmailProfiles;
    // Community access grants Gmail profile cap, Rex, campaign sending, and unlocked delays.
    // Night Mode / Studio customization still require an eligible plan.
    customization = false;
  }

  const companyTier = company || companyAdmin;
  const premium = companyTier || plan !== "free" || GOOGLE_REVIEW_MODE;
  const planDaysLeft = inheritedPlanEndsAt
    ? new Date(inheritedPlanEndsAt).getTime() - now
    : paid && row.subscribed_until
      ? new Date(row.subscribed_until).getTime() - now
      : Number.POSITIVE_INFINITY;
  const usageWarning = allowance != null && used >= allowance * 0.7;
  const expiryWarning = planDaysLeft <= 5 * 86_400_000;
  const sharingBlocked = !companyTier && plan !== "free" && (usageWarning || expiryWarning);
  const sharingBlockReason = usageWarning
    ? "Hotspot sharing is paused because the shared sending allowance has reached 70%."
    : expiryWarning
      ? "Hotspot sharing is paused because the subscription expires within 5 days or has expired."
      : null;

  // 3s/4s locked only for plain free accounts. Bloodline promo unlocks them.
  const lockedDelays: number[] = (premium || communityPromo) ? [] : [3, 4];

  return {
    premium,
    trialActive: (trialActive && !communityPromo) || GOOGLE_REVIEW_MODE,
    trialEndsAt: communityPromo ? communityPromoEndsAt() : trialEndsAt,
    promoActive: new Date(promoEndsAt).getTime() > now || communityPromo,
    promoEndsAt: communityPromo ? communityPromoEndsAt() : promoEndsAt,
    profilesPerDay: premium || communityPromo ? profileLimit : TRIAL_PROFILES_PER_DAY,
    lockedDelays,
    plan,
    planEndsAt: inheritedPlanEndsAt ?? (paid ? row.subscribed_until : null),
    profileLimit,
    allowance,
    used,
    sent24h,
    customization,
    company,
    companyAdmin,
    isAssistant,
    assistantGmailCap,
    communityPromo,
    sharingBlocked,
    sharingBlockReason,
  };
}
