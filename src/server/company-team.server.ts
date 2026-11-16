import { randomBytes } from "node:crypto";
import { COMPANY_MASTER_EMAIL } from "@/server/billing.server";

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as { from: (table: string) => any; rpc: (name: string, args: any) => Promise<any> };
}

export type CompanySeat = {
  id: string;
  owner_user_id: string;
  member_email: string;
  member_user_id: string | null;
  status: "pending" | "active" | "revoked";
  created_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
};

export async function isCompanyOwner(email?: string | null) {
  return (email ?? "").trim().toLowerCase() === COMPANY_MASTER_EMAIL;
}

/** Claim an invitation only for the authenticated account whose verified email matches it. */
export async function claimPendingCompanySeat(userId: string, email?: string | null) {
  const normalized = (email ?? "").trim().toLowerCase();
  if (!normalized) return null;
  const client = await db();
  const { data: pending } = await client.from("company_team_seats").select("*")
    .eq("status", "pending").ilike("member_email", normalized)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!pending) return null;
  const { data: claimed, error } = await client.from("company_team_seats").update({
    status: "active", member_user_id: userId, accepted_at: new Date().toISOString(),
  }).eq("id", pending.id).eq("status", "pending").select("*").maybeSingle();
  if (error || !claimed) return null;
  await client.from("company_team_notifications").insert({
    user_id: userId,
    title: "You are now a Company Admin",
    body: "The Elite Connectere Company owner added you to Company Team Seats. You now have Company administration access.",
  });
  return claimed as CompanySeat;
}

export async function companyAdminRole(userId: string, email?: string | null) {
  if (await isCompanyOwner(email)) return "owner" as const;
  await claimPendingCompanySeat(userId, email);
  const client = await db();
  const { data } = await client.from("company_team_seats").select("id,owner_user_id")
    .eq("member_user_id", userId).eq("status", "active").limit(1).maybeSingle();
  return data ? "admin" as const : null;
}

export async function listCompanySeats(ownerUserId: string, email?: string | null) {
  if (!(await isCompanyOwner(email))) throw new Error("Only the Company owner can manage Team Seats.");
  const client = await db();
  const { data, error } = await client.from("company_team_seats").select("id,member_email,member_user_id,status,created_at,accepted_at,revoked_at")
    .eq("owner_user_id", ownerUserId).order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CompanySeat[];
}

export async function inviteCompanyAdmin(ownerUserId: string, email: string, ownerEmail?: string | null) {
  if (!(await isCompanyOwner(ownerEmail))) return { ok: false as const, error: "Only the Company owner can manage Team Seats." };
  const normalized = email.trim().toLowerCase();
  const client = await db();
  const { data, error } = await client.rpc("create_company_team_invite", {
    p_owner_user_id: ownerUserId,
    p_member_email: normalized,
    p_invite_token: randomBytes(24).toString("hex"),
  });
  if (error) return { ok: false as const, error: error.message };
  const result = data as { ok?: boolean; error?: string; seat?: CompanySeat };
  if (!result?.ok || !result.seat) return { ok: false as const, error: result?.error ?? "The Company invitation could not be created." };
  return { ok: true as const, seat: result.seat };
}

export async function revokeCompanyAdmin(ownerUserId: string, seatId: string, ownerEmail?: string | null) {
  if (!(await isCompanyOwner(ownerEmail))) return { ok: false as const, error: "Only the Company owner can revoke Team Seats." };
  const client = await db();
  const { data: seat, error: readError } = await client.from("company_team_seats").select("*")
    .eq("id", seatId).eq("owner_user_id", ownerUserId).in("status", ["pending", "active"]).maybeSingle();
  if (readError) return { ok: false as const, error: readError.message };
  if (!seat) return { ok: false as const, error: "That Company Team Seat is already revoked or does not exist." };
  const { data: updated, error } = await client.from("company_team_seats").update({
    status: "revoked", revoked_at: new Date().toISOString(),
  }).eq("id", seatId).eq("owner_user_id", ownerUserId).in("status", ["pending", "active"]).select("id").maybeSingle();
  if (error) return { ok: false as const, error: error.message };
  if (!updated) return { ok: false as const, error: "That seat has already changed. Refresh and try again." };
  if (seat.member_user_id) {
    await client.from("company_team_notifications").insert({
      user_id: seat.member_user_id,
      title: "Company Admin access revoked",
      body: "Your Company administration access has been revoked. Your personal Elite Connectere account and data remain unchanged.",
    });
  }
  return { ok: true as const };
}

export async function listMyCompanyNotifications(userId: string) {
  const client = await db();
  const { data, error } = await client.from("company_team_notifications").select("id,title,body,created_at,read_at")
    .eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
  if (error) throw error;
  return data ?? [];
}

export async function markCompanyNotificationsRead(userId: string) {
  const client = await db();
  const { error } = await client.from("company_team_notifications").update({ read_at: new Date().toISOString() })
    .eq("user_id", userId).is("read_at", null);
  if (error) throw error;
  return { ok: true as const };
}
