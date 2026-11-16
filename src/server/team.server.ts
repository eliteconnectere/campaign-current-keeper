/**
 * Share assistants (not a group project).
 * Only the paid owner adds / removes people.
 * Each assistant has a max Gmail count set by the owner.
 */

import { randomBytes } from "node:crypto";

export const PROMAXX_TEAM_SEAT_LIMIT = null; // No member-count cap; the subscription pool is the limit.

export type TeamSeat = {
  id: string;
  owner_user_id: string;
  member_email: string;
  member_user_id: string | null;
  status: "pending" | "active" | "revoked";
  invite_token: string;
  created_at: string;
  accepted_at: string | null;
  max_gmail_profiles?: number;
  share_snippets?: boolean;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function token() {
  return randomBytes(24).toString("hex");
}

export async function listSeatsForOwner(ownerUserId: string): Promise<TeamSeat[]> {
  const db = await admin();
  const { data, error } = await db
    .from("team_seats")
    .select("*")
    .eq("owner_user_id", ownerUserId)
    .neq("status", "revoked")
    .order("created_at", { ascending: true });
  if (error) {
    console.error("listSeatsForOwner", error.message);
    return [];
  }
  return (data ?? []) as TeamSeat[];
}

export async function findActiveMembership(memberUserId: string, memberEmail?: string) {
  const db = await admin();
  const byUser = await db
    .from("team_seats")
    .select("*")
    .eq("member_user_id", memberUserId)
    .eq("status", "active")
    .maybeSingle();
  if (byUser.data) return byUser.data as TeamSeat;

  if (memberEmail) {
    const email = memberEmail.trim().toLowerCase();
    const byEmail = await db
      .from("team_seats")
      .select("*")
      .eq("status", "active")
      .ilike("member_email", email)
      .maybeSingle();
    if (byEmail.data) {
      await db
        .from("team_seats")
        .update({ member_user_id: memberUserId })
        .eq("id", (byEmail.data as TeamSeat).id);
      return { ...(byEmail.data as TeamSeat), member_user_id: memberUserId };
    }
  }
  return null;
}

export async function findPendingInvite(memberEmail: string) {
  const db = await admin();
  const email = memberEmail.trim().toLowerCase();
  const { data } = await db
    .from("team_seats")
    .select("*")
    .eq("status", "pending")
    .ilike("member_email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as TeamSeat | null) ?? null;
}

export async function teamUserIdsFor(
  userId: string,
  email?: string,
): Promise<{ ownerUserId: string; userIds: string[] } | null> {
  const asMember = await findActiveMembership(userId, email);
  if (asMember) {
    const seats = await listSeatsForOwner(asMember.owner_user_id);
    const ids = new Set<string>([asMember.owner_user_id]);
    for (const s of seats) {
      if (s.status === "active" && s.member_user_id) ids.add(s.member_user_id);
    }
    ids.add(userId);
    return { ownerUserId: asMember.owner_user_id, userIds: [...ids] };
  }

  const seats = await listSeatsForOwner(userId);
  if (seats.length === 0) return null;
  const ids = new Set<string>([userId]);
  for (const s of seats) {
    if (s.status === "active" && s.member_user_id) ids.add(s.member_user_id);
  }
  return { ownerUserId: userId, userIds: [...ids] };
}

export async function countTeamGmailProfiles(
  userIds: string[],
  connectorId = "google_mail",
): Promise<number> {
  if (userIds.length === 0) return 0;
  const db = await admin();
  const { count, error } = await db
    .from("gmail_profiles")
    .select("id", { count: "exact", head: true })
    .in("user_id", userIds)
    .eq("connector_id", connectorId);
  if (error) {
    console.error("countTeamGmailProfiles", error.message);
    return 0;
  }
  return count ?? 0;
}

export type OwnerGmailAllocation = {
  planLimit: number;
  ownerConnected: number;
  ownerReservations: number;
  memberAllocated: number;
  reserved: number;
  remaining: number;
};

/** Gmail slots allocated to members are reserved even before they connect an account. */
export async function ownerGmailAllocation(
  ownerUserId: string,
  planLimit: number,
  connectorId = "google_mail",
): Promise<OwnerGmailAllocation> {
  const db = await admin();
  const [{ count: ownerConnected }, seatsResult, { count: ownerReservations, error: reservationError }] =
    await Promise.all([
      db.from("gmail_profiles").select("id", { count: "exact", head: true })
        .eq("user_id", ownerUserId).eq("connector_id", connectorId),
      db.from("team_seats").select("id,max_gmail_profiles")
        .eq("owner_user_id", ownerUserId).in("status", ["pending", "active"]),
      db.from("team_gmail_profile_reservations" as never).select("reservation_id", { count: "exact", head: true })
        .eq("owner_user_id", ownerUserId).eq("user_id", ownerUserId)
        .gt("expires_at", new Date().toISOString()),
    ]);
  if (reservationError) throw reservationError;
  const memberAllocated = (seatsResult.data ?? []).reduce(
    (sum, seat) => sum + Math.max(1, Number(seat.max_gmail_profiles ?? 1)),
    0,
  );
  const ownerCount = ownerConnected ?? 0;
  const ownerPending = ownerReservations ?? 0;
  const reserved = ownerCount + ownerPending + memberAllocated;
  return {
    planLimit,
    ownerConnected: ownerCount,
    ownerReservations: ownerPending,
    memberAllocated,
    reserved,
    remaining: Math.max(0, planLimit - reserved),
  };
}

export async function teamSharedProfileGate(
  userId: string,
  email: string | undefined,
  planProfileLimit: number,
  connectorId = "google_mail",
): Promise<{ shared: boolean; used: number; limit: number; remaining: number }> {
  const team = await teamUserIdsFor(userId, email);
  if (!team) {
    return { shared: false, used: 0, limit: planProfileLimit, remaining: planProfileLimit };
  }
  let sharedLimit = planProfileLimit;
  if (team.ownerUserId !== userId) {
    const { ensureBilling, entitlementsFor } = await import("@/server/billing.server");
    const db = await admin();
    const { data: ownerUser } = await db.auth.admin.getUserById(team.ownerUserId);
    const ownerEnt = await entitlementsFor(
      await ensureBilling(team.ownerUserId),
      ownerUser.user?.email,
    );
    const ownerPlanEligible =
      ownerEnt.plan === "premium" || ownerEnt.plan === "promaxx" || ownerEnt.plan === "company";
    // Never let an active/trial member bypass an expired plan or a sharing
    // warning through the Gmail OAuth endpoint.
    if (!ownerPlanEligible || ownerEnt.sharingBlocked) {
      return { shared: true, used: 0, limit: 0, remaining: 0 };
    }
    sharedLimit = ownerEnt.profileLimit;
  }
  const allocation = await ownerGmailAllocation(team.ownerUserId, sharedLimit, connectorId);
  return {
    shared: true,
    used: allocation.reserved,
    limit: sharedLimit,
    remaining: allocation.remaining,
  };
}

/** Assistant's own connected Gmail count vs owner-set max on their seat. */
export async function assistantGmailCap(
  userId: string,
  email: string | undefined,
  connectorId = "google_mail",
): Promise<{ capped: boolean; used: number; limit: number } | null> {
  const seat = await findActiveMembership(userId, email);
  if (!seat) return null;
  const limit = Math.max(1, seat.max_gmail_profiles ?? 1);
  const db = await admin();
  const { count } = await db
    .from("gmail_profiles")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("connector_id", connectorId);
  const used = count ?? 0;
  return { capped: true, used, limit };
}

export async function inviteMember(
  ownerUserId: string,
  memberEmail: string,
  maxSeats: number | null = PROMAXX_TEAM_SEAT_LIMIT,
  maxGmailProfiles: number = 1,
  planProfileLimit: number = 75,
) {
  const email = memberEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false as const, error: "Enter a valid email address." };
  }

  const seats = await listSeatsForOwner(ownerUserId);
  const limit = maxSeats == null ? null : Math.max(1, maxSeats);
  if (limit != null && seats.length >= limit) {
    return {
      ok: false as const,
      error: `You can add up to ${limit} assistants. Remove one to add someone new.`,
    };
  }
  if (seats.some((s) => s.member_email.toLowerCase() === email)) {
    return { ok: false as const, error: "That email is already added." };
  }

  const cap = Math.min(75, Math.max(1, Math.floor(maxGmailProfiles) || 1));
  const db = await admin();
  const { data, error } = await (db as any).rpc("create_team_hotspot_invite", {
    p_owner_user_id: ownerUserId,
    p_member_email: email,
    p_invite_token: token(),
    p_max_gmail_profiles: cap,
    p_plan_limit: planProfileLimit,
  });
  if (error) {
    console.error("inviteMember", error.message);
    return { ok: false as const, error: error.message };
  }
  const result = data as { ok?: boolean; error?: string; seat?: TeamSeat };
  if (!result?.ok || !result.seat) {
    return { ok: false as const, error: result?.error ?? "Could not reserve Gmail slots for this invitation." };
  }
  return { ok: true as const, seat: result.seat };
}

export async function acceptInvite(memberUserId: string, memberEmail: string, inviteToken?: string) {
  const db = await admin();
  const email = memberEmail.trim().toLowerCase();

  let seat: TeamSeat | null = null;
  if (inviteToken) {
    const { data } = await db
      .from("team_seats")
      .select("*")
      .eq("invite_token", inviteToken)
      .eq("status", "pending")
      .maybeSingle();
    seat = (data as TeamSeat | null) ?? null;
  } else {
    seat = await findPendingInvite(email);
  }
  if (!seat) return { ok: false as const, error: "No pending hotspot invitation was found for this account. Refresh Hotspot settings and try again." };
  if (seat.member_email.toLowerCase() !== email) {
    return { ok: false as const, error: "Sign in with the email that was added." };
  }

  const { ensureBilling, entitlementsFor } = await import("@/server/billing.server");
  const { data: ownerUser } = await db.auth.admin.getUserById(seat.owner_user_id);
  const ownerEnt = await entitlementsFor(
    await ensureBilling(seat.owner_user_id),
    ownerUser.user?.email,
  );
  const ownerHasEligiblePlan =
    ownerEnt.plan === "premium" || ownerEnt.plan === "promaxx" || ownerEnt.plan === "company";
  if (!ownerHasEligiblePlan) {
    return { ok: false as const, error: "The subscription owner does not currently have an active eligible plan. Hotspot access remains pending." };
  }
  if (ownerEnt.sharingBlocked) {
    return {
      ok: false as const,
      error: ownerEnt.sharingBlockReason ?? "Hotspot sharing is paused by a subscription warning.",
    };
  }

  // Conditional transition prevents an invitation revoked or accepted in
  // another request from being reactivated by a stale browser.
  const { data, error } = await db
    .from("team_seats")
    .update({
      status: "active",
      member_user_id: memberUserId,
      accepted_at: new Date().toISOString(),
    })
    .eq("id", seat.id)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();
  if (error) return { ok: false as const, error: error.message };
  if (!data) return { ok: false as const, error: "This invitation is no longer pending. Refresh Hotspot settings." };
  return { ok: true as const, seat: data as TeamSeat };
}

/** Owner edits one assistant: Gmail cap and optional snippet sharing. */
export async function updateSeatCap(
  ownerUserId: string,
  seatId: string,
  maxGmailProfiles: number,
  shareSnippets?: boolean,
  planProfileLimit: number = 75,
) {
  const cap = Math.min(75, Math.max(1, Math.floor(maxGmailProfiles) || 1));
  const db = await admin();
  const { data, error } = await (db as any).rpc("update_team_hotspot_gmail_allocation", {
    p_owner_user_id: ownerUserId,
    p_seat_id: seatId,
    p_max_gmail_profiles: cap,
    p_plan_limit: planProfileLimit,
  });
  if (error) return { ok: false as const, error: error.message };
  const result = data as { ok?: boolean; error?: string; seat?: TeamSeat };
  if (!result?.ok || !result.seat) {
    return { ok: false as const, error: result?.error ?? "Could not update this member's Gmail allocation." };
  }

  let seat = result.seat;
  if (typeof shareSnippets === "boolean") {
    const { data: updated, error: shareError } = await db
      .from("team_seats")
      .update({ share_snippets: shareSnippets } as never)
      .eq("id", seatId)
      .eq("owner_user_id", ownerUserId)
      .select("*")
      .single();
    if (!shareError && updated) seat = updated as TeamSeat;
    else if (shareError && !/share_snippets/i.test(shareError.message)) {
      console.error("update hotspot snippet sharing", shareError.message);
    }
  }

  let ownerEmail = "Workspace Owner";
  try {
    const { data: ownerUser } = await db.auth.admin.getUserById(ownerUserId);
    if (ownerUser?.user?.email) ownerEmail = ownerUser.user.email;
  } catch {
    /* ignore */
  }
  return { ok: true as const, seat, ownerEmail };
}

export async function revokeSeat(ownerUserId: string, seatId: string) {
  const db = await admin();
  const { data, error } = await (db as any).rpc("revoke_team_hotspot_seat", {
    p_owner_user_id: ownerUserId,
    p_seat_id: seatId,
  });
  if (error) return { ok: false as const, error: error.message };
  if (!data) return { ok: false as const, error: "That hotspot member no longer exists." };
  return { ok: true as const };
}

export async function teamOwnerBillingForMember(memberUserId: string, memberEmail?: string) {
  const seat = await findActiveMembership(memberUserId, memberEmail);
  if (!seat) return null;

  const { ensureBilling, entitlementsFor, PLANS } = await import("@/server/billing.server");
  const db = await admin();
  const [{ data: ownerUser }, ownerRow] = await Promise.all([
    db.auth.admin.getUserById(seat.owner_user_id),
    ensureBilling(seat.owner_user_id),
  ]);
  const ownerEnt = await entitlementsFor(ownerRow, ownerUser.user?.email);
  if (
    ownerEnt.plan !== "promaxx" &&
    ownerEnt.plan !== "premium" &&
    ownerEnt.plan !== "company"
  ) {
    return null;
  }
  // Any existing subscription warning immediately suspends inherited hotspot
  // entitlements; the member keeps their own account and private data.
  if (ownerEnt.sharingBlocked) return null;
  const planKey = ownerEnt.plan === "premium" ? "premium" : "promaxx";
  const p = PLANS[planKey];
  // Personal Gmail cap for this assistant (owner-set), not full plan profiles
  const personalCap = seat.max_gmail_profiles ?? 1;
  return {
    seat,
    ownerEnt,
    inherited: {
      plan: planKey as "premium" | "promaxx",
      profileLimit: Math.min(p.profiles, personalCap),
      allowance: p.allowance,
      customization: p.customization,
      planEndsAt: ownerEnt.planEndsAt,
      premium: true,
    },
  };
}
