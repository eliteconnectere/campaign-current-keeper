import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ChatMe = {
  eligible: boolean;
  profile: { display_name: string; username: string } | null;
};

async function eligibility(userId: string, email: string | undefined) {
  const { ensureBilling, entitlementsFor } = await import("@/server/billing.server");
  const ent = await entitlementsFor(await ensureBilling(userId), email);
  // Hotspot members inherit the owner's normalized ProMaxx plan as "promaxx".
  // Include it here as well as legacy identifiers so every Private Chat server
  // action uses the same entitlement decision as the workspace UI.
  return ent.plan === "promaxx" || ent.plan === "premium" ||
    (ent.plan as string) === "plan3" ||
    (ent.plan as string) === "elite_promaxx" ||
    ent.company || ent.companyAdmin === true;
}

/** Re-checks Plan 3 access on the server and keeps the searchable flag in sync. */
export const getChatMe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ChatMe> => {
    const email = (context.claims as { email?: string } | undefined)?.email;
    const eligible = await eligibility(context.userId, email);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("chat_profiles" as never)
      .select("display_name, username, eligible")
      .eq("user_id", context.userId)
      .maybeSingle();
    const row = data as { display_name: string; username: string; eligible: boolean } | null;
    if (row && row.eligible !== eligible) {
      await supabaseAdmin
        .from("chat_profiles" as never)
        .update({ eligible, updated_at: new Date().toISOString() } as never)
        .eq("user_id", context.userId);
    }
    return { eligible, profile: row ? { display_name: row.display_name, username: row.username } : null };
  });

export const saveChatProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { displayName: string; username: string }) => {
    const displayName = String(input?.displayName ?? "").trim().slice(0, 60);
    const username = String(input?.username ?? "").trim().replace(/^@/, "").toLowerCase();
    if (displayName.length < 2) throw new Error("Enter your name (at least 2 characters).");
    if (!/^[a-z0-9_.]{3,24}$/.test(username))
      throw new Error("Username: 3–24 letters, numbers, dots or underscores.");
    return { displayName, username };
  })
  .handler(async ({ data, context }) => {
    const email = (context.claims as { email?: string } | undefined)?.email;
    const eligible = await eligibility(context.userId, email);
    if (!eligible) throw new Error("Private Chat is a Plan 3 feature.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("chat_profiles" as never).upsert(
      {
        user_id: context.userId,
        display_name: data.displayName,
        username: data.username,
        eligible,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "user_id" },
    );
    if (error) {
      if (error.code === "23505") throw new Error("That username is taken. Try another.");
      throw new Error("Your chat profile could not be saved.");
    }
    return { ok: true as const };
  });

export const sendConnectionRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { receiverId: string }) => {
    if (!/^[0-9a-f-]{36}$/i.test(String(input?.receiverId))) throw new Error("Unknown user.");
    return { receiverId: input.receiverId };
  })
  .handler(async ({ data, context }) => {
    const me = context.userId;
    if (data.receiverId === me) throw new Error("You can't connect with yourself.");
    const email = (context.claims as { email?: string } | undefined)?.email;
    if (!(await eligibility(me, email))) throw new Error("Private Chat is a Plan 3 feature.");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: target } = await db
      .from("chat_profiles" as never)
      .select("eligible")
      .eq("user_id", data.receiverId)
      .maybeSingle();
    if (!(target as { eligible: boolean } | null)?.eligible) throw new Error("That user isn't available.");
    const [a, b] = me < data.receiverId ? [me, data.receiverId] : [data.receiverId, me];
    const { data: existing } = await db
      .from("connections" as never)
      .select("id")
      .eq("user_a", a)
      .eq("user_b", b)
      .maybeSingle();
    if (existing) return { status: "connected" as const };
    const { data: pending } = await db
      .from("connection_requests" as never)
      .select("id, sender_id")
      .eq("status", "pending")
      .or(`and(sender_id.eq.${me},receiver_id.eq.${data.receiverId}),and(sender_id.eq.${data.receiverId},receiver_id.eq.${me})`)
      .maybeSingle();
    const p = pending as { id: string; sender_id: string } | null;
    if (p) return { status: p.sender_id === me ? ("sent" as const) : ("incoming" as const) };
    const { error } = await db
      .from("connection_requests" as never)
      .insert({ sender_id: me, receiver_id: data.receiverId } as never);
    if (error && error.code !== "23505") throw new Error("The request could not be sent.");
    return { status: "sent" as const };
  });

export const cancelConnectionRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { requestId: string }) => ({ requestId: String(input?.requestId ?? "") }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { error } = await db.from("connection_requests" as never).delete().eq("id", data.requestId).eq("sender_id", context.userId).eq("status", "pending");
    if (error) throw new Error("The request could not be cancelled.");
    return { ok: true as const };
  });

export const removeConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { connectionId: string }) => ({ connectionId: String(input?.connectionId ?? "") }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { error } = await db.from("connections" as never).delete().eq("id", data.connectionId).or(`user_a.eq.${context.userId},user_b.eq.${context.userId}`);
    if (error) throw new Error("The connection could not be removed.");
    return { ok: true as const };
  });

async function hideChatMessagesForUser(db: any, userId: string, messageIds: string[]) {
  for (let index = 0; index < messageIds.length; index += 500) {
    const rows = messageIds.slice(index, index + 500).map((messageId) => ({
      user_id: userId,
      message_id: messageId,
    }));
    const { error } = await db.from("chat_message_hidden").upsert(rows, {
      onConflict: "user_id,message_id",
      ignoreDuplicates: true,
    });
    if (error) throw new Error("Chat history could not be fully cleared. Please retry.");
  }
}

async function hideConnectionHistoryForUser(db: any, userId: string, connectionId: string) {
  let offset = 0;
  let hidden = 0;
  while (true) {
    const { data: messages, error } = await db.from("chat_messages")
      .select("id").eq("connection_id", connectionId).order("id").range(offset, offset + 999);
    if (error) throw new Error("Chat history could not be fully loaded. Please retry.");
    const ids = (messages ?? []).map((message: { id: string }) => message.id);
    if (!ids.length) break;
    await hideChatMessagesForUser(db, userId, ids);
    hidden += ids.length;
    if (ids.length < 1000) break;
    offset += 1000;
  }
  return hidden;
}

/** Hides a conversation from this user's account without deleting the other participant's copy. */
export const deleteChatHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { connectionId: string }) => {
    const connectionId = String(input?.connectionId ?? "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(connectionId)) throw new Error("Invalid chat identifier.");
    return { connectionId };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: connection, error: connectionError } = await db.from("connections")
      .select("id").eq("id", data.connectionId)
      .or(`user_a.eq.${context.userId},user_b.eq.${context.userId}`).maybeSingle();
    if (connectionError || !connection) throw new Error("You do not have access to this chat.");
    const hidden = await hideConnectionHistoryForUser(db, context.userId, data.connectionId);
    return { ok: true as const, hidden };
  });

/** Clears this account's Private Chat view while preserving each other participant's own copy. */
export const clearPrivateChatHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: connections, error: connectionError } = await db.from("connections")
      .select("id").or(`user_a.eq.${context.userId},user_b.eq.${context.userId}`);
    if (connectionError) throw new Error("Your chat connections could not be loaded. Nothing was changed.");
    let hidden = 0;
    for (const connection of connections ?? []) {
      hidden += await hideConnectionHistoryForUser(db, context.userId, connection.id);
    }
    return { ok: true as const, hidden };
  });

export const respondConnectionRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { requestId: string; accept: boolean }) => ({
    requestId: String(input?.requestId ?? ""),
    accept: Boolean(input?.accept),
  }))
  .handler(async ({ data, context }) => {
    const me = context.userId;
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: row } = await db
      .from("connection_requests" as never)
      .select("id, sender_id, receiver_id, status")
      .eq("id", data.requestId)
      .eq("receiver_id", me)
      .eq("status", "pending")
      .maybeSingle();
    const r = row as { id: string; sender_id: string } | null;
    if (!r) throw new Error("This request is no longer open.");
    if (data.accept) {
      const email = (context.claims as { email?: string } | undefined)?.email;
      if (!(await eligibility(me, email))) throw new Error("Private Chat is a Plan 3 feature.");
    }
    await db
      .from("connection_requests" as never)
      .update({ status: data.accept ? "accepted" : "declined", responded_at: new Date().toISOString() } as never)
      .eq("id", r.id)
      .eq("status", "pending");
    if (!data.accept) return { connectionId: null };
    const [a, b] = me < r.sender_id ? [me, r.sender_id] : [r.sender_id, me];
    const { data: conn } = await db
      .from("connections" as never)
      .upsert({ user_a: a, user_b: b } as never, { onConflict: "user_a,user_b" })
      .select("id")
      .single();
    return { connectionId: (conn as { id: string } | null)?.id ?? null };
  });


/** Canonical approval-plan verification shared by sensitive server-side Rex actions. */
function canonicalizeRexApproval(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeRexApproval);
  if (value && typeof value === "object") return Object.fromEntries(
    Object.keys(value as Record<string, unknown>).sort().map(key => [
      key, canonicalizeRexApproval((value as Record<string, unknown>)[key]),
    ]),
  );
  return value;
}

async function verifyRexPrivateChatSendApproval(
  db: any,
  userId: string,
  approvalId: string,
  recipient: string,
  body: string,
): Promise<void> {
  const { data: receipt, error } = await db.from("rex_action_approvals")
    .select("plan,plan_hash,status,expires_at")
    .eq("id", approvalId).eq("user_id", userId).maybeSingle();
  if (error || !receipt || receipt.status !== "executing" ||
      !receipt.expires_at || new Date(receipt.expires_at).getTime() <= Date.now()) {
    throw new Error("A valid, tapped Rex approval is required before sending a Private Chat message.");
  }
  const plan = Array.isArray(receipt.plan) ? receipt.plan : [];
  const bytes = new TextEncoder().encode(JSON.stringify(canonicalizeRexApproval(plan)));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  const actualHash = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
  const exactStep = plan.some((step: any) =>
    step?.action === "send_private_chat" &&
    step?.scope?.recipient === recipient &&
    step?.scope?.body === body
  );
  if (!plan.length || actualHash !== receipt.plan_hash || !exactStep) {
    throw new Error("The Private Chat send does not match the exact approved recipient and message.");
  }
}

/** Sends a Private Chat message from Rex only after the user approves the exact recipient and text. */
export const sendPrivateChatMessageForRex = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { approvalId: string; recipient: string; body: string }) => {
    const approvalId = String(input?.approvalId ?? "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(approvalId)) throw new Error("A valid Rex approval is required.");
    const recipient = String(input?.recipient ?? "").trim().replace(/^@/, "").slice(0, 80);
    const body = String(input?.body ?? "").trim().slice(0, 4000);
    if (recipient.length < 2) throw new Error("Choose a Private Chat contact.");
    if (!body) throw new Error("The message is empty.");
    return { approvalId, recipient, body };
  })
  .handler(async ({ data, context }) => {
    const email = (context.claims as { email?: string } | undefined)?.email;
    if (!(await eligibility(context.userId, email))) throw new Error("Private Chat is not available on this account.");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const me = context.userId;
    await verifyRexPrivateChatSendApproval(db, me, data.approvalId, data.recipient, data.body);
    const { data: connections, error: connectionError } = await db
      .from("connections" as never)
      .select("id, user_a, user_b")
      .or("user_a.eq." + me + ",user_b.eq." + me);
    if (connectionError) throw new Error("I couldn't check your connected Private Chat contacts.");
    const rows = (connections ?? []) as { id: string; user_a: string; user_b: string }[];
    if (!rows.length) throw new Error("You don't have any connected Private Chat contacts yet. Open Private Chat and connect with the person first.");
    const partnerIds = rows.map(row => row.user_a === me ? row.user_b : row.user_a);
    const { data: profiles, error: profileError } = await db
      .from("chat_profiles" as never)
      .select("user_id, display_name, username")
      .in("user_id", partnerIds);
    if (profileError) throw new Error("I couldn't identify that Private Chat contact.");
    const needle = data.recipient.toLowerCase();
    const matches = ((profiles ?? []) as { user_id: string; display_name: string; username: string }[])
      .filter(profile => profile.display_name.toLowerCase() === needle || profile.username.toLowerCase() === needle);
    if (matches.length !== 1) {
      if (!matches.length) throw new Error("I couldn't find one connected contact matching that exact name or username. Check the contact name in Private Chat.");
      throw new Error("More than one contact matches that name. Use the person's exact @username.");
    }
    const partner = matches[0]!;
    const connection = rows.find(row => row.user_a === partner.user_id || row.user_b === partner.user_id);
    if (!connection) throw new Error("That person is not in your connected Private Chat contacts.");
    const { inspectOutgoingMessage, clearExpiredRestriction } = await import("@/server/guardian.server");
    await clearExpiredRestriction(me);
    const safety = await inspectOutgoingMessage({
      userId: me,
      ...(email ? { email } : {}),
      connectionId: connection.id,
      body: data.body,
    });
    if (!safety.allowed) throw new Error(safety.message || "The message did not pass the safety check.");
    const { data: sent, error } = await db
      .from("chat_messages" as never)
      .insert({ connection_id: connection.id, sender_id: me, kind: "text", body: data.body, reply_to: null } as never)
      .select("id, created_at")
      .single();
    if (error || !sent) throw new Error("The Private Chat message was not sent. Nothing was delivered.");
    return { ok: true as const, recipient: partner.display_name, username: partner.username, sentAt: (sent as { created_at: string }).created_at };
  });


/**
 * One Chat Energy battery per subscription owner.
 * Team members keep separate logins, but every active Private Chat session
 * updates the same server-side pool. The browser never supplies the owner ID.
 */
export const syncSharedChatEnergy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { active: boolean }) => ({
    active: Boolean(input?.active),
  }))
  .handler(async ({ data, context }) => {
    const email = (context.claims as { email?: string } | undefined)?.email;
    const { findActiveMembership } = await import("@/server/team.server");
    const membership = await findActiveMembership(context.userId, email);
    const ownerUserId = membership?.owner_user_id ?? context.userId;

    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: energy, error } = await (db as any).rpc("sync_shared_chat_energy", {
      p_owner_user_id: ownerUserId,
      p_user_id: context.userId,
      p_active: data.active,
    });
    if (error) {
      console.error("syncSharedChatEnergy", error.message);
      throw new Error("Shared Chat Energy could not be synchronized.");
    }
    return {
      energy: Math.max(0, Math.min(100, Number(energy ?? 100))),
      shared: Boolean(membership),
    };
  });
