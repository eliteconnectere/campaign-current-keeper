import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type RexMemorySettings = { saveHistory: boolean; rememberContext: boolean };
export type RexConversation = { id: string; title: string; updated_at: string; last_message_at: string; created_at: string };
export type RexStoredMessage = { id: string; role: "user" | "assistant"; content: string; created_at: string };
const DEFAULTS: RexMemorySettings = { saveHistory: true, rememberContext: true };

export const getRexMemorySettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const db = supabaseAdmin as any;
      const { data, error } = await db.from("rex_memory_settings").select("save_history,remember_context").eq("user_id", context.userId).maybeSingle();
      if (error || !data) return { settings: DEFAULTS };
      return { settings: { saveHistory: data.save_history ?? true, rememberContext: data.remember_context ?? true } };
    } catch {
      return { settings: DEFAULTS };
    }
  });

export const saveRexMemorySettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Partial<RexMemorySettings>) => ({
    saveHistory: input?.saveHistory !== false,
    rememberContext: input?.rememberContext !== false,
  }))
  .handler(async ({ data, context }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const db = supabaseAdmin as any;
      await db.from("rex_memory_settings").upsert({
        user_id: context.userId, save_history: data.saveHistory, remember_context: data.rememberContext, updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      return { settings: data };
    } catch {
      return { settings: data };
    }
  });

export const listRexConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const db = supabaseAdmin as any;
      const { data, error } = await db.from("rex_conversations").select("id,title,created_at,updated_at,last_message_at").eq("user_id", context.userId).order("last_message_at", { ascending: false }).limit(100);
      if (error || !data) return { conversations: [] };
      return { conversations: data as RexConversation[] };
    } catch {
      return { conversations: [] };
    }
  });

export const getRexConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversationId: string }) => ({ conversationId: String(input?.conversationId ?? "") }))
  .handler(async ({ data, context }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const db = supabaseAdmin as any;
      const { data: conversation } = await db.from("rex_conversations").select("id,title").eq("id", data.conversationId).eq("user_id", context.userId).maybeSingle();
      if (!conversation) return { conversation: null, messages: [] };
      const { data: messages } = await db.from("rex_conversation_messages").select("id,role,content,created_at").eq("conversation_id", data.conversationId).eq("user_id", context.userId).order("created_at", { ascending: true }).limit(500);
      return { conversation, messages: (messages ?? []) as RexStoredMessage[] };
    } catch {
      return { conversation: null, messages: [] };
    }
  });

export const appendRexConversationMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversationId?: string | null; title?: string; messages: { role: "user" | "assistant"; content: string }[] }) => ({
    conversationId: input?.conversationId ? String(input.conversationId) : null,
    title: input?.title ? String(input.title).slice(0, 120) : undefined,
    messages: Array.isArray(input?.messages) ? input.messages.map((m) => ({ role: m.role === "assistant" ? "assistant" as const : "user" as const, content: String(m.content ?? "").slice(0, 8000) })).filter((m) => m.content.trim().length > 0) : [],
  }))
  .handler(async ({ data, context }) => {
    if (!data.messages.length) return { conversationId: data.conversationId, stored: 0 };
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const db = supabaseAdmin as any;
      const { data: prefs } = await db.from("rex_memory_settings").select("save_history").eq("user_id", context.userId).maybeSingle();
      if (prefs && prefs.save_history === false) return { conversationId: null, stored: 0 };
      let conversationId = data.conversationId;
      if (conversationId) {
        const { data: existing } = await db.from("rex_conversations").select("id").eq("id", conversationId).eq("user_id", context.userId).maybeSingle();
        if (!existing) conversationId = null;
      }
      const now = new Date().toISOString();
      if (!conversationId) {
        const firstUserMsg = data.messages.find((m) => m.role === "user");
        const title = (data.title || firstUserMsg?.content.slice(0, 60) || "Conversation with Rex").trim();
        const { data: created } = await db.from("rex_conversations").insert({ user_id: context.userId, title, created_at: now, updated_at: now, last_message_at: now }).select("id").single();
        if (created?.id) conversationId = created.id;
      }
      if (conversationId) {
        const rows = data.messages.map((m) => ({ conversation_id: conversationId, user_id: context.userId, role: m.role, content: m.content }));
        await db.from("rex_conversation_messages").insert(rows);
        await db.from("rex_conversations").update({ updated_at: now, last_message_at: now }).eq("id", conversationId).eq("user_id", context.userId);
        return { conversationId, stored: rows.length };
      }
      return { conversationId: null, stored: 0 };
    } catch {
      return { conversationId: data.conversationId ?? null, stored: 0 };
    }
  });

export const deleteRexConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversationId: string }) => {
    const conversationId = String(input?.conversationId ?? "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(conversationId)) throw new Error("Invalid conversation identifier.");
    return { conversationId };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    // Delete child rows first so history removal does not depend on an FK cascade.
    const { error: messagesError } = await db.from("rex_conversation_messages")
      .delete().eq("conversation_id", data.conversationId).eq("user_id", context.userId);
    if (messagesError) throw new Error("Could not delete this conversation's messages. Please try again.");
    const { error: conversationError } = await db.from("rex_conversations")
      .delete().eq("id", data.conversationId).eq("user_id", context.userId);
    if (conversationError) throw new Error("Could not delete this conversation. Please try again.");
    return { ok: true as const };
  });

export const clearRexConversationHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: conversations, error: listError } = await db.from("rex_conversations")
      .select("id").eq("user_id", context.userId);
    if (listError) throw new Error("Could not load your saved conversations. Nothing was deleted.");
    const ids = (conversations ?? []).map((item: { id: string }) => item.id);
    if (ids.length) {
      const { error: messagesError } = await db.from("rex_conversation_messages")
        .delete().in("conversation_id", ids).eq("user_id", context.userId);
      if (messagesError) throw new Error("Could not delete saved conversation messages. Please try again.");
    }
    const { error: conversationsError } = await db.from("rex_conversations")
      .delete().eq("user_id", context.userId);
    if (conversationsError) throw new Error("Could not clear saved conversations. Please try again.");
    return { ok: true as const, deleted: ids.length };
  });
