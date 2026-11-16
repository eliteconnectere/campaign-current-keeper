import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const featureDataSchema = z.record(z.string().max(80), z.unknown()).refine(value => JSON.stringify(value).length <= 32_000, "Feature data is too large");

export const getRexDynamicFeature = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: z.string().uuid().parse(input.id) }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: feature, error } = await db.from("rex_dynamic_features")
      .select("id,name,slug,description,blueprint,version,status")
      .eq("id", data.id).eq("user_id", context.userId).eq("status", "published").maybeSingle();
    if (error) throw new Error("Could not load this Rex feature.");
    if (!feature) throw new Error("This feature does not exist in your workspace.");
    const { data: stored, error: dataError } = await db.from("rex_dynamic_feature_data")
      .select("data,updated_at").eq("feature_id", feature.id).eq("user_id", context.userId).maybeSingle();
    if (dataError) throw new Error("Could not load this feature's data.");
    return { feature, data: stored?.data ?? {}, dataUpdatedAt: stored?.updated_at ?? null };
  });

export const saveRexDynamicFeatureData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; data: Record<string, unknown> }) => ({
    id: z.string().uuid().parse(input.id),
    data: featureDataSchema.parse(input.data),
  }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: feature, error: featureError } = await db.from("rex_dynamic_features")
      .select("id").eq("id", data.id).eq("user_id", context.userId).eq("status", "published").maybeSingle();
    if (featureError || !feature) throw new Error("This feature is not available in your workspace.");
    const now = new Date().toISOString();
    const { error } = await db.from("rex_dynamic_feature_data").upsert({
      feature_id: feature.id, user_id: context.userId, data: data.data, updated_at: now,
    }, { onConflict: "feature_id" });
    if (error) throw new Error("Your feature data could not be saved.");
    return { ok: true as const, savedAt: now };
  });

export const listRexSearchDestinations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const [featuresResult, destinationsResult] = await Promise.all([
      db.from("rex_dynamic_features")
        .select("id,name,slug,description")
        .eq("user_id", context.userId)
        .eq("status", "published")
        .order("updated_at", { ascending: false })
        .limit(100),
      db.from("rex_personal_destinations")
        .select("id,name,description")
        .eq("user_id", context.userId)
        .order("updated_at", { ascending: false })
        .limit(100),
    ]);
    if (featuresResult.error) throw new Error("Could not load your published Rex features for search.");
    if (destinationsResult.error) throw new Error("Could not load your personal Rex destinations for search.");
    return {
      features: (featuresResult.data ?? []).map((item: any) => ({
        id: String(item.id), name: String(item.name ?? "Untitled feature"),
        slug: String(item.slug ?? ""), description: String(item.description ?? ""),
      })),
      destinations: (destinationsResult.data ?? []).map((item: any) => ({
        id: String(item.id), name: String(item.name ?? "Untitled destination"),
        description: String(item.description ?? ""),
      })),
    };
  });
