import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type RexPersonalDestination = {
  id: string;
  name: string;
  description: string;
  layout: { sections: Array<{ title: string; content: string; items?: string[] }> };
  created_at: string;
  updated_at: string;
};

function cleanDestination(input: any) {
  const name = String(input?.name ?? "").trim().replace(/[<>]/g, "").slice(0, 80);
  const description = String(input?.description ?? "").trim().slice(0, 500);
  const rawSections = Array.isArray(input?.sections) ? input.sections : [];
  if (!name) throw new Error("A destination name is required.");
  if (rawSections.length > 12) throw new Error("A destination can contain up to 12 sections.");
  const sections = rawSections.map((section: any) => ({
    title: String(section?.title ?? "").trim().replace(/[<>]/g, "").slice(0, 100),
    content: String(section?.content ?? "").trim().slice(0, 1200),
    items: Array.isArray(section?.items)
      ? section.items.slice(0, 12).map((item: unknown) => String(item).trim().slice(0, 180)).filter(Boolean)
      : [],
  })).filter((section: any) => section.title || section.content || section.items.length);
  return { name, description, layout: { sections } };
}

export const createRexPersonalDestination = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string; description: string; sections: Array<{ title: string; content: string; items?: string[] }> }) => {
    const cleaned = cleanDestination(input);
    if (!cleaned.description) throw new Error("A destination description is required.");
    return { ...cleaned, sections: cleaned.layout.sections };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await (supabaseAdmin as any).from("rex_personal_destinations")
      .insert({ user_id: context.userId, name: data.name, description: data.description, layout: { sections: data.sections } })
      .select("id,name,description,layout,created_at,updated_at").single();
    if (error || !row) throw new Error("Could not create your personal Rex destination.");
    return { destination: row as RexPersonalDestination };
  });

export const listRexPersonalDestinations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("rex_personal_destinations")
      .select("id,name,description,layout,created_at,updated_at")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) throw new Error("Could not load your personal Rex destinations.");
    return { destinations: (data ?? []) as RexPersonalDestination[] };
  });

export const getRexPersonalDestination = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!/^[0-9a-f-]{36}$/i.test(input?.id ?? "")) throw new Error("Invalid destination.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await (supabaseAdmin as any)
      .from("rex_personal_destinations")
      .select("id,name,description,layout,created_at,updated_at")
      .eq("user_id", context.userId).eq("id", data.id).maybeSingle();
    if (error || !row) throw new Error("That personal destination was not found in your account.");
    return { destination: row as RexPersonalDestination };
  });

export const deleteRexPersonalDestination = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!/^[0-9a-f-]{36}$/i.test(input?.id ?? "")) throw new Error("Invalid destination.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error, count } = await (supabaseAdmin as any)
      .from("rex_personal_destinations").delete({ count: "exact" })
      .eq("user_id", context.userId).eq("id", data.id);
    if (error || count === 0) throw new Error("Could not delete that personal destination.");
    return { ok: true as const };
  });
