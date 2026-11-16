import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function emailOf(claims: unknown) {
  return (claims as { email?: string } | undefined)?.email;
}

async function assertAdmin(userId: string, claims: unknown) {
  const { isCompanyAdmin } = await import("@/server/admin.server");
  if (!(await isCompanyAdmin(userId, emailOf(claims)))) throw new Error("Forbidden");
}

export const adminListSubmissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId, context.claims);
    const { listAllSubmissions, releaseDueDecisions } = await import("@/server/admin.server");
    await releaseDueDecisions();
    const rows = await listAllSubmissions();
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      status: r.status,
      final_decision: r.final_decision,
      decision_reason: r.decision_reason,
      release_at: r.release_at,
      created_at: r.created_at,
      body: r.body,
    }));
  });

export const adminDecide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; decision: "approved" | "declined"; reason?: string }) => {
    if (typeof d?.id !== "string" || !["approved", "declined"].includes(d.decision)) {
      throw new Error("Invalid input");
    }
    return { id: d.id, decision: d.decision, reason: String(d.reason ?? "").slice(0, 2000) };
  })
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId, context.claims);
    const { decideSubmission } = await import("@/server/admin.server");
    return decideSubmission(data.id, data.decision, data.reason);
  });

export const adminPulse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId, context.claims);
    const { subscriberPulse } = await import("@/server/admin.server");
    return subscriberPulse();
  });

export const submitToAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { type: string; body: string }) => ({
    type: String(d?.type ?? "appeal"),
    body: String(d?.body ?? "").slice(0, 4000),
  }))
  .handler(async ({ context, data }) => {
    const { createSubmission } = await import("@/server/admin.server");
    return createSubmission(context.userId, data.type, data.body);
  });

export const mySubmissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listMySubmissions } = await import("@/server/admin.server");
    return listMySubmissions(context.userId);
  });

export const presencePing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { heartbeat, isCompanyAdmin, isCompanyOwner } = await import("@/server/admin.server");
    await heartbeat(context.userId);
    return {
      admin: await isCompanyAdmin(context.userId, emailOf(context.claims)),
      owner: await isCompanyOwner(emailOf(context.claims)),
    };
  });
