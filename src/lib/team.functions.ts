import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TeamSeatView = {
  id: string;
  member_email: string;
  status: "pending" | "active" | "revoked";
  invite_token: string;
  created_at: string;
  accepted_at: string | null;
  max_gmail_profiles: number;
  share_snippets?: boolean;
};

/** Only the person who paid (or company master) — never an assistant who inherited access. */
async function isPlanOwner(userId: string, email?: string) {
  const { ensureBilling, entitlementsFor, COMPANY_MASTER_EMAIL } = await import("@/server/billing.server");
  if ((email ?? "").toLowerCase() === COMPANY_MASTER_EMAIL) {
    return { owner: true, seatLimit: null as number | null, profileLimit: 75, sharingBlocked: false, sharingBlockReason: null as string | null };
  }
  const row = await ensureBilling(userId);
  const paid =
    Boolean(row.subscribed_until && new Date(row.subscribed_until).getTime() > Date.now()) &&
    ["premium", "promaxx", "plan3", "company"].includes(String(row.plan));
  if (!paid) return { owner: false, seatLimit: 0 as number | null, profileLimit: 0, sharingBlocked: true, sharingBlockReason: "An active paid subscription is required to share hotspot access." };
  const ent = await entitlementsFor(row, email);
  // Member count is unlimited; each Gmail slot is allocated from the owner's plan pool.
  return { owner: true, seatLimit: null as number | null, profileLimit: ent.profileLimit, sharingBlocked: ent.sharingBlocked, sharingBlockReason: ent.sharingBlockReason };
}

export const listMyTeamSeats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listSeatsForOwner, findActiveMembership, findPendingInvite, ownerGmailAllocation } = await import("@/server/team.server");
    const email = (context.claims as { email?: string } | undefined)?.email;
    const { owner, seatLimit, profileLimit, sharingBlocked, sharingBlockReason } = await isPlanOwner(context.userId, email);
    const membership = await findActiveMembership(context.userId, email);
    let ownerEmail: string | null = null;
    let ownerName: string | null = null;
    if (membership) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: ownerUser } = await supabaseAdmin.auth.admin.getUserById(membership.owner_user_id);
      ownerEmail = ownerUser?.user?.email ?? null;
      const metadata = (ownerUser?.user?.user_metadata ?? {}) as Record<string, unknown>;
      const displayName = [metadata.full_name, metadata.name, metadata.display_name, metadata.given_name]
        .find((value) => typeof value === "string" && value.trim());
      ownerName = typeof displayName === "string" ? displayName.trim() : null;
    }

    // Assistants never manage / never add more people
    const canManage = owner && (!membership || membership.owner_user_id === context.userId);

    const asOwner = canManage ? await listSeatsForOwner(context.userId) : [];
    const gmailPool = canManage ? await ownerGmailAllocation(context.userId, profileLimit) : null;
    const pendingInvite = !membership && email ? await findPendingInvite(email) : null;

    return {
      canManage,
      seatLimit,
      gmailPool,
      sharingBlocked,
      sharingBlockReason,
      pendingInvite: pendingInvite ? { member_email: pendingInvite.member_email, created_at: pendingInvite.created_at } : null,
      seats: asOwner.map((s) => ({
        id: s.id,
        member_email: s.member_email,
        status: s.status,
        invite_token: s.invite_token,
        created_at: s.created_at,
        accepted_at: s.accepted_at,
        max_gmail_profiles: s.max_gmail_profiles ?? 1,
        share_snippets: Boolean(s.share_snippets),
      })) as TeamSeatView[],
      membership: membership
        ? {
            owner_user_id: membership.owner_user_id,
            owner_email: ownerEmail,
            owner_name: ownerName,
            status: membership.status,
            member_email: membership.member_email,
            max_gmail_profiles: membership.max_gmail_profiles ?? 1,
          }
        : null,
    };
  });

export const inviteTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; maxGmailProfiles?: number }) => ({
    email: String(input?.email ?? "").trim().toLowerCase(),
    maxGmailProfiles: Math.min(
      75,
      Math.max(1, Math.floor(Number(input?.maxGmailProfiles ?? 1)) || 1),
    ),
  }))
  .handler(async ({ data, context }) => {
    const email = (context.claims as { email?: string } | undefined)?.email;
    const { owner, seatLimit, profileLimit, sharingBlocked, sharingBlockReason } = await isPlanOwner(context.userId, email);
    if (!owner) {
      return {
        ok: false as const,
        error: "Only the subscription owner can invite Hotspot members. A member cannot invite other people.",
      };
    }
    if (sharingBlocked) {
      return { ok: false as const, error: sharingBlockReason ?? "Hotspot sharing is paused by a subscription warning." };
    }
    // Block if this user is only a member of someone else's shared Hotspot plan
    const { findActiveMembership, inviteMember } = await import("@/server/team.server");
    const membership = await findActiveMembership(context.userId, email);
    if (membership && membership.owner_user_id !== context.userId) {
      return {
        ok: false as const,
        error: "You are a Hotspot member on someone else's subscription. Only that subscription owner can invite people.",
      };
    }
    if (email && data.email === email.toLowerCase()) {
      return { ok: false as const, error: "You cannot add your own login email." };
    }
    return inviteMember(context.userId, data.email, seatLimit, data.maxGmailProfiles, profileLimit);
  });

export const acceptTeamInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { token?: string }) => ({
    token: input?.token ? String(input.token) : undefined,
  }))
  .handler(async ({ data, context }) => {
    const email = (context.claims as { email?: string } | undefined)?.email;
    if (!email) return { ok: false as const, error: "Your account has no email." };
    const { acceptInvite } = await import("@/server/team.server");
    return acceptInvite(context.userId, email, data.token);
  });

export const updateAssistantSeat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { seatId: string; maxGmailProfiles: number; shareSnippets?: boolean }) => {
    if (typeof input?.seatId !== "string" || !input.seatId.trim()) {
      throw new Error("Seat ID required");
    }
    const max = Math.min(75, Math.max(1, Math.floor(Number(input?.maxGmailProfiles)) || 1));
    return { seatId: input.seatId.trim(), maxGmailProfiles: max, shareSnippets: Boolean(input?.shareSnippets) };
  })
  .handler(async ({ context, data }) => {
    const email = (context.claims as { email?: string } | undefined)?.email;
    const { owner, profileLimit } = await isPlanOwner(context.userId, email);
    if (!owner) return { ok: false as const, error: "Only the subscription owner can edit Gmail allocations." };
    const { updateSeatCap } = await import("@/server/team.server");
    return updateSeatCap(context.userId, data.seatId, data.maxGmailProfiles, data.shareSnippets, profileLimit);
  });

export const revokeTeamSeat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { seatId: string }) => ({
    seatId: String(input?.seatId ?? ""),
  }))
  .handler(async ({ data, context }) => {
    const email = (context.claims as { email?: string } | undefined)?.email;
    const { owner } = await isPlanOwner(context.userId, email);
    if (!owner) {
      return { ok: false as const, error: "Only the plan owner can remove people." };
    }
    const { revokeSeat } = await import("@/server/team.server");
    return revokeSeat(context.userId, data.seatId);
  });
