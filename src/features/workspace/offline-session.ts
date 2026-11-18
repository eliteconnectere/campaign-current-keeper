import type { Session } from "@supabase/supabase-js";

/**
 * Resolve the active account for workspace display.
 * Prefer the persisted local session so the app can reopen from its installed
 * offline shell. When offline, this session is display-only: server-backed
 * actions remain unavailable until connectivity returns and Supabase revalidates it.
 */
export async function getWorkspaceDisplaySession(): Promise<Session | null> {
  const storedSession = readStoredSession();

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return storedSession;
  }

  try {
    const { data, error } = await import("@/integrations/supabase/client").then(({ supabase }) =>
      supabase.auth.getSession(),
    );
    if (!error && data.session) return data.session;
    // A network transition or a temporarily unavailable auth lookup must not
    // hide a valid locally persisted workspace from the installed app.
    return storedSession;
  } catch {
    // Supabase auth may be unreachable while the browser still reports online.
    return storedSession;
  }
}

function readStoredSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("sb-rxpvttdhayzrpzcgpxyw-auth-token");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const candidate = (parsed["currentSession"] && typeof parsed["currentSession"] === "object"
      ? parsed["currentSession"]
      : parsed) as Partial<Session>;
    if (
      typeof candidate.access_token !== "string" ||
      !candidate.access_token ||
      !candidate.user ||
      typeof candidate.user.id !== "string" ||
      !candidate.user.id
    ) return null;
    return candidate as Session;
  } catch {
    return null;
  }
}
