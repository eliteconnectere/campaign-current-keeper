import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getOrProvisionRexServiceIdentity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { displayName?: string }) => ({
    displayName: z.string().trim().min(1).max(80).optional().parse(input.displayName),
  }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: existing, error: readError } = await db.from("rex_service_identities")
      .select("id,agent_key,display_name,status,public_metadata,created_at,updated_at")
      .eq("owner_user_id", context.userId).maybeSingle();
    if (readError) throw new Error("Rex's service identity could not be loaded.");
    if (existing) return existing;
    const { data: created, error } = await db.from("rex_service_identities")
      .insert({ owner_user_id: context.userId, display_name: data.displayName ?? "Rex AI Agent", status: "provisioned" })
      .select("id,agent_key,display_name,status,public_metadata,created_at,updated_at").single();
    if (error || !created) throw new Error("Rex's independent service identity could not be provisioned.");
    return created;
  });

export const listRexServiceRegistrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any).from("rex_service_registrations")
      .select("id,provider,status,external_registration_id,requested_scopes,required_owner_action,last_error,metadata,submitted_at,verified_at,created_at,updated_at")
      .eq("owner_user_id", context.userId).order("updated_at", { ascending: false }).limit(50);
    if (error) throw new Error("Rex's provider registration records could not be loaded.");
    return data ?? [];
  });

export const prepareRexProviderRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { provider: string; requestedScopes?: string[] }) => ({
    provider: z.string().trim().min(2).max(120).parse(input.provider),
    requestedScopes: z.array(z.string().trim().min(1).max(100)).max(30).default([]).parse(input.requestedScopes ?? []),
  }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: identity, error: identityError } = await db.from("rex_service_identities")
      .select("id").eq("owner_user_id", context.userId).maybeSingle();
    if (identityError || !identity) throw new Error("Provision Rex's service identity before preparing a provider registration.");
    const { data: row, error } = await db.from("rex_service_registrations").upsert({
      owner_user_id: context.userId,
      provider: data.provider,
      status: "prepared",
      requested_scopes: data.requestedScopes,
      required_owner_action: "Review the provider's official registration requirements and complete any identity verification or consent it requires.",
      metadata: { preparation: "Provider requirements recorded. No external submission or credential was created." },
      updated_at: new Date().toISOString(),
    }, { onConflict: "owner_user_id,provider" })
      .select("id,provider,status,requested_scopes,required_owner_action,metadata,updated_at").single();
    if (error || !row) throw new Error("Could not prepare this provider registration.");
    return row;
  });
