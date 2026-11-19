// Server-only storage for connected Gmail sending profiles and the protected
// per-Gmail-identity sending history. Identity usage is keyed by the Gmail
// address itself so clearing or erasing app data can never reset a limit.
import { decryptConnectionKey, encryptConnectionKey } from "./connectionKeyCrypto";

export const MAX_PROFILES = 75;

export type IdentityUsage = {
  email_key: string;
  daily_limit: number;
  sent_count: number;
  sent_date: string;
  exhausted_until: string | null;
  window_started_at: string;
};

export type ProfileRow = {
  id: string;
  account_email: string;
  email_key: string;
  connection_key_ciphertext: string;
  position: number;
  slot: number;
  gateway_identity?: string | null;
};

const PROFILE_COLUMNS =
  "id, account_email, email_key, connection_key_ciphertext, position, slot, gateway_identity";

export type ProfileView = {
  id: string;
  email: string;
  slot: number;
  used: number;
  limit: number;
  exhausted: boolean;
  exhaustedUntil: string | null;
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Randomised daily cap between 360 and 420, per Gmail identity. */
function randomDailyLimit(): number {
  return 360 + Math.floor(Math.random() * 61);
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Reads (creating if absent) the protected sending record for a Gmail address. */
export async function ensureIdentityUsage(emailKey: string): Promise<IdentityUsage> {
  const usage = await batchEnsureIdentityUsage([emailKey]);
  const row = usage.get(normaliseEmail(emailKey));
  if (!row) throw new Error("Gmail identity usage could not be initialized.");
  return row;
}

/**
 * Fetches usage rows in one batch and safely creates only missing identities.
 * ignoreDuplicates prevents a concurrent first-time connection from resetting
 * an existing identity's quota counters.
 */
export async function batchEnsureIdentityUsage(emailKeys: string[]): Promise<Map<string, IdentityUsage>> {
  const normalisedKeys = [...new Set(emailKeys.map(normaliseEmail).filter(Boolean))];
  const map = new Map<string, IdentityUsage>();
  if (normalisedKeys.length === 0) return map;

  const db = await admin();
  const columns = "email_key, daily_limit, sent_count, sent_date, exhausted_until, window_started_at";
  const { data: existing, error } = await db
    .from("gmail_identity_usage")
    .select(columns)
    .in("email_key", normalisedKeys);
  if (error) throw error;

  for (const row of existing ?? []) map.set(row.email_key, row as IdentityUsage);

  const missingKeys = normalisedKeys.filter((key) => !map.has(key));
  if (missingKeys.length > 0) {
    const now = new Date().toISOString();
    const toInsert = missingKeys.map((email_key) => ({
      email_key,
      daily_limit: randomDailyLimit(),
      sent_count: 0,
      sent_date: today(),
      exhausted_until: null,
      window_started_at: now,
    }));

    const { error: insertError } = await db
      .from("gmail_identity_usage")
      .upsert(toInsert, { onConflict: "email_key", ignoreDuplicates: true });
    if (insertError) throw insertError;

    // Re-read only keys that were missing. This returns the winner's row if
    // another request created the same identity concurrently.
    const { data: insertedOrExisting, error: refreshError } = await db
      .from("gmail_identity_usage")
      .select(columns)
      .in("email_key", missingKeys);
    if (refreshError) throw refreshError;
    for (const row of insertedOrExisting ?? []) map.set(row.email_key, row as IdentityUsage);
  }

  if (map.size !== normalisedKeys.length) {
    throw new Error("One or more Gmail identity usage rows could not be initialized.");
  }
  return map;
}

export function usageOf(row: IdentityUsage) {
  const now = Date.now();
  const cooling = Boolean(row.exhausted_until && new Date(row.exhausted_until).getTime() > now);
  const windowStartedAt = new Date(row.window_started_at).getTime();
  const windowExpired = !Number.isFinite(windowStartedAt) || now - windowStartedAt >= 86_400_000;
  // Never reset a displayed counter while its post-limit cooldown is active.
  const used = windowExpired && !cooling ? 0 : row.sent_count;
  return {
    used,
    limit: row.daily_limit,
    exhausted: cooling || used >= row.daily_limit,
    exhaustedUntil: cooling ? row.exhausted_until : null,
  };
}

export async function listProfileRows(userId: string, connectorId: string): Promise<ProfileRow[]> {
  const db = await admin();
  const { data, error } = await db
    .from("gmail_profiles")
    .select(PROFILE_COLUMNS)
    .eq("user_id", userId)
    .eq("connector_id", connectorId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ProfileRow[];
}

export async function listProfileViews(
  userId: string,
  connectorId: string,
): Promise<ProfileView[]> {
  const rows = await listProfileRows(userId, connectorId);
  if (rows.length === 0) return [];

  const usageMap = await batchEnsureIdentityUsage(rows.map((row) => row.email_key));
  return rows.map((row) => {
    const record = usageMap.get(normaliseEmail(row.email_key));
    if (!record) throw new Error("Gmail identity usage is missing for a connected profile.");
    const usage = usageOf(record);
    return {
      id: row.id,
      email: row.account_email,
      slot: row.slot,
      used: usage.used,
      limit: usage.limit,
      exhausted: usage.exhausted,
      exhaustedUntil: usage.exhaustedUntil,
    };
  });
}

export async function getProfileRow(
  userId: string,
  connectorId: string,
  profileId: string,
): Promise<ProfileRow | null> {
  const db = await admin();
  const { data, error } = await db
    .from("gmail_profiles")
    .select(PROFILE_COLUMNS)
    .eq("user_id", userId)
    .eq("connector_id", connectorId)
    .eq("id", profileId)
    .maybeSingle();
  if (error) throw error;
  return (data as ProfileRow | null) ?? null;
}

export function decryptKey(row: ProfileRow): string {
  return decryptConnectionKey(row.connection_key_ciphertext);
}

/**
 * The lowest sending slot this account is not already using. Each slot gets its
 * own independent Google authorization, so linking a second campaign Gmail can
 * never reconnect, replace or inherit the first one.
 */
export async function nextFreeSlot(userId: string, connectorId: string): Promise<number | null> {
  const used = new Set((await listProfileRows(userId, connectorId)).map((p) => p.slot));
  for (let i = 0; i < MAX_PROFILES; i += 1) if (!used.has(i)) return i;
  return null;
}

/**
 * Distinct Gmail addresses this account connected in the last rolling 24 hours.
 * Read from the permanent connection log, so disconnecting a profile never
 * gives back a free connection.
 */
export async function connectedTodayCount(userId: string, _connectorId: string): Promise<number> {
  const db = await admin();
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { data, error } = await db
    .from("gmail_connect_attempts")
    .select("email")
    .eq("user_id", userId)
    .eq("status", "connected")
    .gte("completed_at", since);
  if (error) throw error;
  return new Set((data ?? []).map((r) => String(r.email ?? "").toLowerCase()).filter(Boolean)).size;
}

/**
 * Adds a connected Gmail address, or refreshes the stored access for an address
 * that is already connected. Never removes or replaces another profile.
 */
export async function addProfile(
  userId: string,
  connectorId: string,
  accountEmail: string,
  connectionAPIKey: string,
  slot: number,
  gatewayIdentity: string | null = null,
): Promise<{ added: boolean; limitReached: boolean; id: string | null }> {
  const db = await admin();
  const emailKey = normaliseEmail(accountEmail);
  const existing = await listProfileRows(userId, connectorId);
  const match = existing.find((p) => p.email_key === emailKey);

  await ensureIdentityUsage(emailKey);

  if (match) {
    // Same Gmail address reconnected: refresh its own access only.
    const { error } = await db
      .from("gmail_profiles")
      .update({ connection_key_ciphertext: encryptConnectionKey(connectionAPIKey) })
      .eq("id", match.id);
    if (error) throw error;
    return { added: false, limitReached: false, id: match.id };
  }

  if (existing.length >= MAX_PROFILES) return { added: false, limitReached: true, id: null };

  const position = existing.reduce((max, p) => Math.max(max, p.position), -1) + 1;
  const { data, error } = await db
    .from("gmail_profiles")
    .insert({
      user_id: userId,
      connector_id: connectorId,
      account_email: accountEmail,
      email_key: emailKey,
      connection_key_ciphertext: encryptConnectionKey(connectionAPIKey),
      position,
      slot,
      gateway_identity: gatewayIdentity,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { added: true, limitReached: false, id: (data as { id: string }).id };
}

export async function deleteProfile(userId: string, connectorId: string, profileId: string) {
  const db = await admin();
  // The protected gmail_identity_usage row is intentionally left untouched.
  const { error } = await db
    .from("gmail_profiles")
    .delete()
    .eq("user_id", userId)
    .eq("connector_id", connectorId)
    .eq("id", profileId);
  if (error) throw error;
}

/** Records one confirmed send against the Gmail identity (not the campaign). */
export async function recordSend(emailKey: string) {
  const db = await admin() as any;
  await ensureIdentityUsage(emailKey);
  // The database function locks and increments this identity row atomically.
  // Concurrent campaign workers can no longer overwrite one another's counts.
  const { data, error } = await db.rpc("record_gmail_identity_send", { p_email_key: emailKey });
  if (error) throw error;
  const result = Array.isArray(data) ? data[0] : data;
  if (!result) throw new Error("Gmail usage could not be recorded.");
  return {
    used: Number(result.used),
    limit: Number(result.daily_limit),
    exhausted: Boolean(result.exhausted),
  };
}
