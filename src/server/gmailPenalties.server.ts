// Server-only: penalty engine for Gmail accounts Google flags / suspends.
// A flagged account is disconnected automatically, cannot reconnect during its
// suspension, and returns with a reduced monthly capacity. Repeat flags in the
// same month escalate (30 days, then a permanent ban — Standard Mode only).
export const SUSPEND_DAYS_FIRST = 5;
export const SUSPEND_DAYS_SECOND = 30;
export const CAP_AFTER_FIRST_FLAG = 200;
export const CAP_AFTER_SECOND_FLAG = 150;

export type PenaltyRow = {
  email_key: string;
  flag_count_total: number;
  flags_this_month: number;
  month_start: string;
  last_flagged_at: string | null;
  suspension_until: string | null;
  suspension_days: number | null;
  monthly_cap: number | null;
  banned: boolean;
};

export type FlagOutcome = {
  flagsThisMonth: number;
  suspensionDays: number;
  suspensionUntil: string | null;
  banned: boolean;
  monthlyCap: number | null;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function sameMonth(monthStart: string): boolean {
  const now = new Date();
  const start = new Date(`${monthStart}T00:00:00Z`);
  return start.getUTCFullYear() === now.getUTCFullYear() && start.getUTCMonth() === now.getUTCMonth();
}

export async function getPenalty(emailKey: string): Promise<PenaltyRow | null> {
  const db = await admin();
  const { data } = await db
    .from("gmail_account_penalties" as never)
    .select("*")
    .eq("email_key", emailKey)
    .maybeSingle();
  return (data as PenaltyRow | null) ?? null;
}

/**
 * Reduces capacity for a previously flagged account. The protected identity
 * usage row keeps its own random cap, so a flag can never be reset by
 * clearing app data — this clamp is applied again on every read.
 */
export async function capFor(emailKey: string): Promise<number | null> {
  const row = await getPenalty(emailKey);
  return row?.monthly_cap ?? null;
}

/**
 * Connect gate. A suspended or banned Gmail address cannot be connected on
 * this app until the suspension ends. Standard Mode always stays available.
 */
export async function connectGate(
  emailKey: string,
): Promise<{ ok: boolean; banned: boolean; until: string | null; remainingMs: number; suspensionDays: number | null }> {
  const row = await getPenalty(emailKey);
  if (!row) return { ok: true, banned: false, until: null, remainingMs: 0, suspensionDays: null };
  if (row.banned) return { ok: false, banned: true, until: null, remainingMs: 0, suspensionDays: null };
  const until = row.suspension_until ? new Date(row.suspension_until).getTime() : 0;
  const remaining = until - Date.now();
  if (remaining > 0) {
    return { ok: false, banned: false, until: row.suspension_until, remainingMs: remaining, suspensionDays: row.suspension_days };
  }
  return { ok: true, banned: false, until: null, remainingMs: 0, suspensionDays: null };
}

/**
 * Records a flag raised by Google (Gmail refused a send for this account),
 * disconnects every connected profile of that address, and applies the
 * escalation ladder:
 *   1st flag in the month  → 5-day suspension, monthly capacity capped at 200
 *   2nd flag in the month  → 30-day suspension, capacity capped at 150
 *   3rd flag in the month  → permanent ban on this app (Standard Mode only)
 */
export async function flagAccount(emailKey: string): Promise<FlagOutcome> {
  const db = await admin();
  const emailKeyNorm = emailKey.trim().toLowerCase();
  const existing = await getPenalty(emailKeyNorm);

  const carried = existing && sameMonth(existing.month_start) ? existing : null;
  const flagsThisMonth = (carried?.flags_this_month ?? 0) + 1;

  let suspensionDays: number;
  let banned = false;
  let monthlyCap: number | null = null;
  if (flagsThisMonth >= 3) {
    suspensionDays = 0;
    banned = true;
  } else if (flagsThisMonth === 2) {
    suspensionDays = SUSPEND_DAYS_SECOND;
    monthlyCap = CAP_AFTER_SECOND_FLAG;
  } else {
    suspensionDays = SUSPEND_DAYS_FIRST;
    monthlyCap = CAP_AFTER_FIRST_FLAG;
  }

  const suspensionUntil = banned ? null : new Date(Date.now() + suspensionDays * 86_400_000).toISOString();

  const row = {
    email_key: emailKeyNorm,
    flag_count_total: (existing?.flag_count_total ?? 0) + 1,
    flags_this_month: flagsThisMonth,
    month_start: carried?.month_start ?? new Date().toISOString().slice(0, 10),
    last_flagged_at: new Date().toISOString(),
    suspension_until: suspensionUntil,
    suspension_days: suspensionDays || null,
    monthly_cap: monthlyCap,
    banned,
  };

  const { error } = await db.from("gmail_account_penalties" as never).upsert(row as never);
  if (error) {
    console.error("flagAccount", error.message);
    return {
      flagsThisMonth,
      suspensionDays,
      suspensionUntil,
      banned,
      monthlyCap,
    };
  }

  // Auto-disconnect: every profile of this flagged address is removed and its
  // Google authorization revoked, so it disappears from every rotation.
  const { data: profiles } = await db
    .from("gmail_profiles")
    .select("id, connection_key_ciphertext")
    .eq("email_key", emailKeyNorm);
  for (const p of (profiles ?? []) as { id: string; connection_key_ciphertext: string }[]) {
    try {
      const { decryptConnectionKey } = await import("./connectionKeyCrypto");
      const { revoke } = await import("./google.server");
      await revoke(decryptConnectionKey(p.connection_key_ciphertext));
    } catch (e) {
      console.error("flagAccount revoke", e);
    }
    await db.from("gmail_profiles").delete().eq("id", p.id);
  }

  return { flagsThisMonth, suspensionDays, suspensionUntil, banned, monthlyCap };
}

export function suspensionMessage(remainingMs: number, suspensionDays: number | null): string {
  const days = Math.max(1, Math.ceil(remainingMs / 86_400_000));
  const total = suspensionDays ?? days;
  return `Account suspension — this Gmail is flagged by Google and cannot connect on this app for ${total} day(s). ${days} day(s) remaining. You can still send with Standard Mode.`;
}
