import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type SnapshotInput = object & { v: number };

export const getWorkspaceSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data, error } = await db
      .from("workspace_snapshots")
      .select("snapshot,revision,updated_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error("Could not load your cloud workspace: " + error.message);
    return data
      ? { snapshot: data.snapshot as SnapshotInput, revision: Number(data.revision), updatedAt: data.updated_at as string }
      : { snapshot: null, revision: 0, updatedAt: null };
  });

export const saveWorkspaceSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { snapshot: SnapshotInput; expectedRevision?: number }) => {
    if (!input?.snapshot || input.snapshot.v !== 1 || typeof input.snapshot !== "object" || Array.isArray(input.snapshot)) {
      throw new Error("Invalid workspace snapshot.");
    }
    const snapshot: Record<string, unknown> = { ...(input.snapshot as Record<string, unknown>) };
    // Campaign execution is server-authoritative. Never sync a local running
    // state or local sent ledger across devices and accidentally restart work.
    delete snapshot["campaignRuns"];
    delete snapshot["sentRecipientEmails"];
    const serialized = JSON.stringify(snapshot);
    if (serialized.length > 1_500_000) throw new Error("Workspace is too large to sync. Remove large imported lists and try again.");
    return { snapshot, expectedRevision: Math.max(0, Math.floor(Number(input.expectedRevision ?? 0))) };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: result, error } = await db.rpc("save_workspace_snapshot_atomic", {
      p_user_id: context.userId,
      p_snapshot: data.snapshot,
      p_expected_revision: data.expectedRevision,
    }).single();

    if (error) throw new Error("Could not save your cloud workspace: " + error.message);
    if (!result) throw new Error("Cloud workspace save returned no result.");

    return result.ok
      ? { ok: true as const, conflict: false as const, revision: Number(result.revision), updatedAt: result.updated_at }
      : {
          ok: false as const,
          conflict: true as const,
          revision: Number(result.revision ?? 0),
          updatedAt: result.updated_at ?? null,
          snapshot: result.snapshot ?? null,
        };
  });
