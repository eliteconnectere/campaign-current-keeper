import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type RexPlanStep = {
  action: string;
  label: string;
  scope: Record<string, string | number | boolean | null>;
};

// Approval-gated actions that must go through the one-use receipt system.
// Routine reversible actions (settings, navigation, reads, memory, templates,
// planner, smart fill) are also listed so the current frontend handlers that
// still create receipts do not fail with "not in Rex's approved tool registry".
// Only prepare_campaign + control_campaign (sends) and send_private_chat are
// true user-facing approval requirements.
const ACTIONS = new Set([
  "prepare_campaign",
  "control_campaign",
  "send_private_chat",
  "update_settings",
  "navigate",
  "delete_memory",
  "save_memory",
  "create_planner",
  "smart_fill",
  "read_workspace",
  "read_chat",
  "export_workspace",
]);

function cleanText(value: unknown, max: number): string {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value as Record<string, unknown>).sort().map(key => [
      key,
      canonicalize((value as Record<string, unknown>)[key]),
    ]));
  }
  return value;
}

async function digestPlan(plan: RexPlanStep[]): Promise<string> {
  // JSONB may reorder object keys when a receipt is read back. Canonical
  // serialization keeps the approval hash stable across the database roundtrip.
  const bytes = new TextEncoder().encode(JSON.stringify(canonicalize(plan)));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Creates a short-lived, owner-bound approval receipt. Creating the receipt
 * does not execute the plan. The caller must display the exact plan and wait
 * for the user to press the approval control before consuming it.
 */
export const createRexOperationApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { title: string; summary: string; plan: RexPlanStep[] }) => {
    if (!Array.isArray(input?.plan) || input.plan.length < 1 || input.plan.length > 12) {
      throw new Error("An approval plan must contain between 1 and 12 steps.");
    }
    const plan = input.plan.map((step) => {
      const action = cleanText(step?.action, 48);
      if (!ACTIONS.has(action)) throw new Error("This operation is not in Rex's approved tool registry.");
      const scope = step?.scope && typeof step.scope === "object" && !Array.isArray(step.scope)
        ? Object.fromEntries(Object.entries(step.scope).slice(0, 24).map(([key, value]) => [
            cleanText(key, 48),
            typeof value === "string"
              ? key === "body" || key === "content"
                ? value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007f]/g, "").trim().slice(0, key === "body" ? 20_000 : 1_800)
                : cleanText(value, 500)
              :
            typeof value === "number" || typeof value === "boolean" ? value :
            null,
          ])) as unknown as Record<string, string | number | boolean | null>
        : {};
      return { action, label: cleanText(step?.label, 120), scope };
    });
    return {
      title: cleanText(input.title, 120) || "Rex operation",
      summary: cleanText(input.summary, 1200),
      plan,
    };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const planHash = await digestPlan(data.plan);
    const requestId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { data: row, error } = await db.from("rex_action_approvals").insert({
      user_id: context.userId,
      request_id: requestId,
      title: data.title,
      summary: data.summary,
      plan: data.plan,
      plan_hash: planHash,
      status: "pending",
      expires_at: expiresAt,
    }).select("id,request_id,title,summary,plan,expires_at").single();
    if (error || !row) throw new Error("Rex could not create the approval receipt. No operation was executed.");
    return { approval: row };
  });

/**
 * Atomically consumes a pending receipt exactly once. It returns the bound
 * plan to the caller; execution remains in the specific allowlisted handler.
 */
export const consumeRexOperationApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { approvalId: string }) => {
    const approvalId = cleanText(input?.approvalId, 80);
    if (!/^[0-9a-f-]{36}$/i.test(approvalId)) throw new Error("Invalid approval receipt.");
    return { approvalId };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: row, error } = await db.from("rex_action_approvals")
      .select("id,user_id,plan,plan_hash,status,expires_at")
      .eq("id", data.approvalId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error || !row) throw new Error("This approval could not be found.");
    if (row.status !== "pending") throw new Error("This approval has already been used or is no longer pending.");
    if (!row.expires_at || new Date(row.expires_at).getTime() <= Date.now()) {
      await db.from("rex_action_approvals").update({ status: "expired" })
        .eq("id", data.approvalId).eq("user_id", context.userId).eq("status", "pending");
      throw new Error("This approval expired. Ask Rex to prepare the operation again.");
    }
    const plan = Array.isArray(row.plan) ? row.plan as RexPlanStep[] : [];
    if (!plan.length || await digestPlan(plan) !== row.plan_hash) {
      throw new Error("The approved plan has changed. Nothing was executed.");
    }
    const now = new Date().toISOString();
    const { data: consumed, error: consumeError } = await db.from("rex_action_approvals")
      .update({ status: "executing", approved_at: now })
      .eq("id", data.approvalId)
      .eq("user_id", context.userId)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (consumeError || !consumed) throw new Error("This approval was already consumed. No duplicate operation was started.");
    await db.from("rex_events").insert({
      user_id: context.userId,
      kind: "rex_approval",
      severity: "info",
      title: "Approved Rex operation",
      detail: "A scoped operation plan was approved.",
      event_key: "rex.approval.consumed",
      source: "rex",
      action_id: data.approvalId,
      metadata: { stepCount: plan.length },
      occurred_at: now,
    });
    return { approvalId: data.approvalId, plan };
  });

export const finishRexOperationApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { approvalId: string; ok: boolean; result?: string }) => ({
    approvalId: cleanText(input?.approvalId, 80),
    ok: input?.ok === true,
    result: cleanText(input?.result, 1000),
  }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const status = data.ok ? "executed" : "failed";
    const { data: row, error } = await db.from("rex_action_approvals")
      .update({ status, result: data.result ? { message: data.result } : null, executed_at: new Date().toISOString() })
      .eq("id", data.approvalId).eq("user_id", context.userId).eq("status", "executing")
      .select("id,status").maybeSingle();
    if (error || !row) throw new Error("Rex could not record the operation result.");
    return { ok: true as const, status: row.status };
  });

export const saveRexMemoryEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { category: string; content: string; source?: string }) => {
    const category = cleanText(input?.category, 40);
    const content = String(input?.content ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007f]/g, "").trim().slice(0, 1800);
    if (!category || !content) throw new Error("A memory category and content are required.");
    return { category, content, source: cleanText(input?.source ?? "rex", 40) };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: row, error } = await db.from("rex_memory_entries").insert({
      user_id: context.userId,
      category: data.category,
      content: data.content,
      source: data.source,
      metadata: { savedBy: "rex" },
      updated_at: new Date().toISOString(),
    }).select("id,category,content,created_at").single();
    if (error || !row) throw new Error("Rex could not save this memory.");
    return { memory: row };
  });

export const listRexMemoryEntries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: memories, error } = await db.from("rex_memory_entries")
      .select("id,category,content,source,created_at,updated_at")
      .eq("user_id", context.userId).order("updated_at", { ascending: false }).limit(100);
    if (error) throw new Error("Rex memory could not be loaded.");
    return { memories: memories ?? [] };
  });

export const deleteRexMemoryEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { memoryId: string }) => {
    const memoryId = cleanText(input?.memoryId, 80);
    if (!/^[0-9a-f-]{36}$/i.test(memoryId)) throw new Error("Invalid memory entry.");
    return { memoryId };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: deleted, error } = await db.from("rex_memory_entries").delete()
      .eq("id", data.memoryId).eq("user_id", context.userId)
      .select("id").maybeSingle();
    if (error || !deleted) throw new Error("The saved Rex memory entry was not found or could not be deleted.");
    return { ok: true as const };
  });

export const listRexDiagnostics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: events, error } = await db.from("rex_events")
      .select("id,kind,severity,title,detail,event_key,source,correlation_id,action_id,metadata,occurred_at,created_at,resolved_at")
      .eq("user_id", context.userId).order("occurred_at", { ascending: false }).limit(100);
    if (error) throw new Error("Rex diagnostics could not be loaded.");
    return { events: events ?? [] };
  });

export const recordRexDiagnostic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventKey: string; severity: "info" | "notice" | "warning" | "error"; title: string; code?: string; durationMs?: number; correlationId?: string }) => {
    const eventKey = cleanText(input?.eventKey, 100);
    const title = cleanText(input?.title, 140);
    const severity = ["info", "notice", "warning", "error"].includes(input?.severity) ? input.severity : "notice";
    const code = cleanText(input?.code, 80);
    const durationMs = Number.isFinite(input?.durationMs) ? Math.max(0, Math.min(600000, Number(input.durationMs))) : null;
    const correlationId = typeof input?.correlationId === "string" && /^[0-9a-f-]{36}$/i.test(input.correlationId) ? input.correlationId : null;
    if (!eventKey || !title) throw new Error("A diagnostic event key and title are required.");
    return { eventKey, title, severity, code, durationMs, correlationId };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const now = new Date().toISOString();
    const { error } = await db.from("rex_events").insert({
      user_id: context.userId,
      kind: "diagnostic",
      severity: data.severity,
      title: data.title,
      detail: data.code ? "Diagnostic code: " + data.code : "Application diagnostic event.",
      event_key: data.eventKey,
      source: "rex",
      correlation_id: data.correlationId,
      metadata: { code: data.code || null, durationMs: data.durationMs },
      occurred_at: now,
    });
    if (error) throw new Error("The diagnostic event could not be recorded.");
    return { ok: true as const };
  });


/** Reads only the signed-in owner’s own connected Private Chat conversations. Read-only access does not require an approval. */
export const readPrivateChatForRex = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { contactName?: string; limit?: number }) => ({
    contactName: cleanText(input?.contactName, 80).replace(/^@/, ""),
    limit: Math.max(1, Math.min(30, Math.floor(Number(input?.limit ?? 15) || 15))),
  }))
  .handler(async ({ data, context }) => {
    const email = (context.claims as { email?: string } | undefined)?.email;
    const { ensureBilling, entitlementsFor } = await import("@/server/billing.server");
    const entitlements = await entitlementsFor(await ensureBilling(context.userId), email);
    const allowed = ["plan3", "premium", "elite_promaxx", "promaxx"].includes(String(entitlements.plan)) || entitlements.company;
    if (!allowed) throw new Error("Private Chat is not enabled for this account.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: connections, error } = await db.from("connections")
      .select("id,user_a,user_b").or("user_a.eq." + context.userId + ",user_b.eq." + context.userId);
    if (error) throw new Error("Your Private Chat connections could not be loaded.");
    const rows = (connections ?? []) as { id: string; user_a: string; user_b: string }[];
    if (!rows.length) return { records: [], message: "You do not have connected Private Chat conversations yet." };
    const partnerIds = rows.map(row => row.user_a === context.userId ? row.user_b : row.user_a);
    const { data: profiles, error: profileError } = await db.from("chat_profiles")
      .select("user_id,display_name,username").in("user_id", partnerIds);
    if (profileError) throw new Error("Your Private Chat contacts could not be identified.");
    const contacts = (profiles ?? []) as { user_id: string; display_name: string; username: string }[];
    let selectedConnections = rows;
    let selectedContacts = contacts;
    if (data.contactName) {
      const term = data.contactName.toLowerCase();
      const matches = contacts.filter(person => person.display_name.toLowerCase() === term || person.username.toLowerCase() === term);
      if (matches.length !== 1) throw new Error(matches.length ? "More than one contact matches. Specify the exact @username." : "No connected contact matches that exact name or username.");
      selectedContacts = matches;
      selectedConnections = rows.filter(row => row.user_a === matches[0]!.user_id || row.user_b === matches[0]!.user_id);
    }
    const ids = selectedConnections.map(row => row.id);
    const [{ data: messages, error: messageError }, { data: hiddenRows, error: hiddenError }] = await Promise.all([
      db.from("chat_messages").select("id,connection_id,sender_id,kind,body,created_at,deleted_at")
        .in("connection_id", ids).order("created_at", { ascending: false })
        .limit(data.contactName ? data.limit : Math.min(100, data.limit * ids.length)),
      db.from("chat_message_hidden").select("message_id").eq("user_id", context.userId),
    ]);
    if (messageError || hiddenError) throw new Error("Private Chat messages could not be retrieved.");
    const hidden = new Set((hiddenRows ?? []).map((item: any) => item.message_id));
    const byId = new Map(selectedContacts.map(person => [person.user_id, person]));
    const ownerOf = new Map(selectedConnections.map(row => [row.id, row.user_a === context.userId ? row.user_b : row.user_a]));
    const records = (messages ?? []).filter((item: any) => !hidden.has(item.id))
      .slice(0, data.contactName ? data.limit : 30).reverse().map((item: any) => ({
        contact: byId.get(ownerOf.get(item.connection_id) ?? "")?.display_name ?? "Connected contact",
        direction: item.sender_id === context.userId ? "You sent" : "They sent",
        message: item.deleted_at ? "[deleted]" : item.kind === "image" ? "[image message]" : String(item.body ?? "").slice(0, 4000),
        at: item.created_at,
      }));
    return { records, message: records.length ? "" : "No messages were found in the selected conversations." };
  });


const WORKSPACE_READ_DOMAINS = new Set([
  "campaigns", "campaign_recipients", "delivery_history", "send_events",
  "gmail_profiles", "gmail_usage", "rex_events", "rex_memory",
]);

/** Allowlisted, tenant-scoped workspace data access. Owner-scoped reads are routine workspace operations and need no approval. */
export const readRexWorkspaceData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { domain: string; recordId?: string; limit?: number }) => {
    const domain = cleanText(input?.domain, 48);
    const recordId = cleanText(input?.recordId, 80);
    const limit = Math.max(1, Math.min(100, Math.floor(Number(input?.limit ?? 30) || 30)));
    if (!WORKSPACE_READ_DOMAINS.has(domain)) {
      throw new Error("This workspace read is not in Rex's allowlisted data registry.");
    }
    if (recordId && !/^[0-9a-f-]{36}$/i.test(recordId)) throw new Error("Invalid record identifier.");
    return { domain, recordId, limit };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    // Read-only access is owner-scoped by the authenticated server context; no approval receipt is required.
    type WorkspaceScalar = string | number | boolean | null;
    type WorkspaceRecord = Record<string, WorkspaceScalar>;
    let rows: WorkspaceRecord[] = [];
    let error: any = null;
    if (data.domain === "campaigns") {
      let query = db.from("campaigns").select("id,name,subject,status,total_recipients,sent_count,failed_count,started_at,completed_at,scheduled_at,created_at")
        .eq("user_id", context.userId).order("created_at", { ascending: false }).limit(data.limit);
      if (data.recordId) query = query.eq("id", data.recordId);
      const result = await query; rows = result.data ?? []; error = result.error;
    } else if (data.domain === "campaign_recipients") {
      let campaignQuery = db.from("campaigns").select("id").eq("user_id", context.userId);
      if (data.recordId) campaignQuery = campaignQuery.eq("id", data.recordId);
      const owned = await campaignQuery.limit(200);
      const campaignIds = (owned.data ?? []).map((c: any) => c.id);
      if (!campaignIds.length) return { domain: data.domain, count: 0, records: [] };
      let query = db.from("campaign_recipients").select("id,campaign_id,email,status,created_at").in("campaign_id", campaignIds).order("created_at", { ascending: false }).limit(data.limit);
      if (data.recordId) query = query.eq("id", data.recordId);
      const result = await query; rows = result.data ?? []; error = result.error;
    } else if (data.domain === "delivery_history" || data.domain === "send_events") {
      let query = db.from("send_events").select("id,campaign_id,recipient_email,status,error,created_at").eq("user_id", context.userId).order("created_at", { ascending: false }).limit(data.limit);
      if (data.recordId) query = query.eq("id", data.recordId);
      const result = await query; rows = result.data ?? []; error = result.error;
    } else if (data.domain === "gmail_profiles") {
      let query = db.from("gmail_profiles").select("id,email,display_name,status,daily_limit,sent_today,created_at").eq("user_id", context.userId).order("created_at", { ascending: false }).limit(data.limit);
      if (data.recordId) query = query.eq("id", data.recordId);
      const result = await query; rows = result.data ?? []; error = result.error;
    } else if (data.domain === "gmail_usage") {
      let query = db.from("gmail_usage").select("id,profile_id,date,sent_count,created_at").eq("user_id", context.userId).order("date", { ascending: false }).limit(data.limit);
      if (data.recordId) query = query.eq("id", data.recordId);
      const result = await query; rows = result.data ?? []; error = result.error;
    } else if (data.domain === "rex_events") {
      let query = db.from("rex_events").select("id,kind,severity,title,detail,event_key,source,occurred_at,created_at").eq("user_id", context.userId).order("occurred_at", { ascending: false }).limit(data.limit);
      if (data.recordId) query = query.eq("id", data.recordId);
      const result = await query; rows = result.data ?? []; error = result.error;
    } else if (data.domain === "rex_memory") {
      let query = db.from("rex_memory_entries").select("id,category,content,source,created_at,updated_at").eq("user_id", context.userId).order("updated_at", { ascending: false }).limit(data.limit);
      if (data.recordId) query = query.eq("id", data.recordId);
      const result = await query; rows = result.data ?? []; error = result.error;
    }
    if (error) throw new Error("Could not read workspace data for " + data.domain + ".");
    return { domain: data.domain, count: rows.length, records: rows };
  });
