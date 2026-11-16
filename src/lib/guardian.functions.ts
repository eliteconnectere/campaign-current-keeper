import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const inspectOutgoingChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { connectionId: string; body: string }) => {
    const connectionId = String(input?.connectionId ?? "");
    const body = String(input?.body ?? "").trim().slice(0, 5000);
    if (!/^[0-9a-f-]{36}$/i.test(connectionId)) throw new Error("Invalid conversation.");
    if (!body) throw new Error("Write a message first.");
    return { connectionId, body };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: connection } = await supabaseAdmin.from("connections").select("id")
      .eq("id", data.connectionId).or(`user_a.eq.${context.userId},user_b.eq.${context.userId}`).maybeSingle();
    if (!connection) throw new Error("You do not have access to this conversation.");
    const { inspectOutgoingMessage, clearExpiredRestriction } = await import("@/server/guardian.server");
    await clearExpiredRestriction(context.userId);
    const userEmail = (context.claims as { email?: string } | undefined)?.email;
    return inspectOutgoingMessage({
      userId: context.userId,
      ...(userEmail ? { email: userEmail } : {}),
      connectionId: data.connectionId,
      body: data.body,
    });
  });

export const myGuardianRestriction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as { from: (table: string) => any };
    const { data } = await db.from("master_account_restrictions")
      .select("reason, source, created_at, expires_at, test_mode")
      .eq("user_id", context.userId).eq("active", true).maybeSingle();
    const row = data as { reason: string; source: string; created_at: string; expires_at: string; test_mode: boolean } | null;
    if (!row || new Date(row.expires_at).getTime() <= Date.now()) return null;
    return row;
  });
