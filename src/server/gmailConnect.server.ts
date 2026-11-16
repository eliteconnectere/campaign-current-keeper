// Server-only: stores a Google-authorised Gmail account as a sending profile
// for a Master account. Used by the server-side Google callback.
export const CONNECTOR_ID = "google_mail";
export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
// Narrowest scopes needed: identify the sender + send. gmail.readonly was never used
// (restricted scope → CASA) and is removed for Google verification.
export const GMAIL_SCOPES = ["openid", "email", "https://www.googleapis.com/auth/gmail.send"];
export const ATTEMPT_TTL_MS = 20 * 60_000;

export type ConnectOutcome = {
  ok: boolean;
  reason: "connected" | "no_send_scope" | "no_identity" | "limit_reached" | "suspended" | "banned";
  email: string | null;
  message?: string;
};

/**
 * Persist a Google-authorised sending profile for this workspace user.
 * The refresh token is stored encrypted server-side (see gmailProfiles.server),
 * so Elite Engine can send without an open browser session.
 */
export async function storeConnection(
  userId: string,
  masterEmail: string | undefined,
  refreshToken: string,
  grantedScope?: string,
  reservationId?: string,
): Promise<ConnectOutcome> {
  const { addProfile, listProfileRows, nextFreeSlot } = await import("@/server/gmailProfiles.server");
  const { ensureBilling, entitlementsFor } = await import("@/server/billing.server");
  const google = await import("@/server/google.server");

  const { token, scope } = await google.accessTokenFor(refreshToken);
  const scopes = `${scope} ${grantedScope ?? ""}`.split(" ");
  if (!scopes.includes(GMAIL_SEND_SCOPE)) return { ok: false, reason: "no_send_scope", email: null };
  const email = await google.emailFor(token);
  if (!email) return { ok: false, reason: "no_identity", email: null };

  const ent = await entitlementsFor(await ensureBilling(userId), masterEmail);
  const rows = await listProfileRows(userId, CONNECTOR_ID);
  const isNew = !rows.some((r) => r.email_key === email.trim().toLowerCase());

  let reservationOwnerId = userId;
  let planProfileLimit = ent.profileLimit;
  let personalProfileLimit = ent.profileLimit;
  if (isNew) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { teamUserIdsFor, teamOwnerBillingForMember } = await import("@/server/team.server");
    const team = await teamUserIdsFor(userId, masterEmail);
    reservationOwnerId = team?.ownerUserId ?? userId;
    if (reservationOwnerId !== userId) {
      const inherited = await teamOwnerBillingForMember(userId, masterEmail);
      if (inherited) {
        planProfileLimit = inherited.ownerEnt.profileLimit;
        personalProfileLimit = inherited.inherited.profileLimit;
      } else {
        // A revoked or expired hotspot no longer consumes the former owner's pool.
        reservationOwnerId = userId;
      }
    }
    if (!reservationId) {
      throw new Error("A Gmail connection reservation is required before saving a new profile.");
    }
    const { data: reserved, error: reserveError } = await (supabaseAdmin as any).rpc(
      "reserve_team_gmail_profile_slot",
      {
        p_reservation_id: reservationId,
        p_owner_user_id: reservationOwnerId,
        p_user_id: userId,
        p_plan_limit: planProfileLimit,
        p_personal_limit: personalProfileLimit,
      },
    );
    if (reserveError) {
      console.error("Gmail shared-pool reservation failed", reserveError.message);
      throw new Error("The shared Gmail allowance could not be verified. Please try connecting again.");
    }
    if (!reserved) return { ok: false, reason: "limit_reached", email };

    try {
      const slot = (await nextFreeSlot(userId, CONNECTOR_ID)) ?? 0;
      const result = await addProfile(userId, CONNECTOR_ID, email, refreshToken, slot, null);
      return {
        ok: !result.limitReached,
        reason: result.limitReached ? "limit_reached" : "connected",
        email,
      };
    } finally {
      await supabaseAdmin
        .from("team_gmail_profile_reservations" as never)
        .delete()
        .eq("reservation_id", reservationId);
    }
  }

  const slot = (await nextFreeSlot(userId, CONNECTOR_ID)) ?? 0;
  // Existing profile: refresh its own access without consuming another shared slot.
  const result = await addProfile(userId, CONNECTOR_ID, email, refreshToken, slot, null);
  return {
    ok: !result.limitReached,
    reason: result.limitReached ? "limit_reached" : "connected",
    email,
  };
}

export function googleAuthorizeUrl(clientId: string, redirectUri: string, state: string) {
  // access_type=offline + prompt includes select_account so the user can pick
  // which Google identity to connect, and consent so Google returns a refresh
  // token we store server-side for campaign sending without a live browser session.
  const p = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GMAIL_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent select_account",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}
