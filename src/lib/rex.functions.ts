import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type RexConfig = {
  displayName: string;
  personality: "balanced" | "professional" | "friendly" | "direct";
  autonomousMode: boolean;
  campaignMonitoring: boolean;
  allowCampaignExecution: boolean;
  allowCampaignScheduling: boolean;
  preSendReview: boolean;
  warnOnRisk: boolean;
  requireApproval: boolean;
  monitorDelivery: boolean;
  notifyHighRisk: boolean;
  notifyCampaignIssues: boolean;
  notifyRecommendations: boolean;
};
export const DEFAULT_REX_CONFIG: RexConfig = {
  displayName: "Rex", personality: "friendly", autonomousMode: true,
  campaignMonitoring: true,
  allowCampaignExecution: true, allowCampaignScheduling: true,
  preSendReview: true, warnOnRisk: true, requireApproval: false,
  monitorDelivery: true, notifyHighRisk: true, notifyCampaignIssues: true,
  notifyRecommendations: false,
};
function validate(input: Partial<RexConfig>): RexConfig {
  const name = String(input.displayName ?? "Rex").trim().replace(/[<>]/g, "").slice(0, 24) || "Rex";
  const personalities = ["balanced", "professional", "friendly", "direct"];
  return {
    displayName: name,
    personality: personalities.includes(String(input.personality)) ? input.personality as RexConfig["personality"] : "balanced",
    autonomousMode: input.autonomousMode !== false,
    campaignMonitoring: input.campaignMonitoring !== false,
    allowCampaignExecution: input.allowCampaignExecution !== false,
    allowCampaignScheduling: input.allowCampaignScheduling !== false,
    preSendReview: input.preSendReview !== false,
    warnOnRisk: input.warnOnRisk !== false,
    requireApproval: false,
    monitorDelivery: input.monitorDelivery !== false,
    notifyHighRisk: input.notifyHighRisk !== false,
    notifyCampaignIssues: input.notifyCampaignIssues !== false,
    notifyRecommendations: input.notifyRecommendations === true,
  };
}
export const getRexConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const db = supabaseAdmin as any;
      const { data, error } = await db.from("rex_settings").select("config,updated_at").eq("user_id", context.userId).maybeSingle();
      if (error) throw new Error("Unable to load Rex settings: " + error.message);
      if (!data) return { config: DEFAULT_REX_CONFIG, updatedAt: null };
      return { config: validate((data.config ?? {}) as Partial<RexConfig>), updatedAt: data.updated_at ?? null };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Unable to load Rex settings.");
    }
  });
export const saveRexConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Partial<RexConfig>) => validate(input ?? {}))
  .handler(async ({ data, context }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const db = supabaseAdmin as any;
      const { error } = await db.from("rex_settings").upsert({ user_id: context.userId, config: data, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (error) throw new Error("Unable to save Rex settings: " + error.message);
      return { ok: true as const, config: data, savedAt: new Date().toISOString() };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Unable to save Rex settings.");
    }
  });
export const listRexEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const db = supabaseAdmin as any;
      const { data, error } = await db.from("rex_events").select("id,kind,severity,title,detail,created_at,resolved_at").eq("user_id", context.userId).order("created_at", { ascending: false }).limit(30);
      if (error || !data) return { events: [] };
      return { events: data };
    } catch {
      return { events: [] };
    }
  });
