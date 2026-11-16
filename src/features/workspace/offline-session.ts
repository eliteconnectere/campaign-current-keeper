import type { Session } from "@supabase/supabase-js";

/**
 * Resolve the active account for workspace display.
 * When the device is offline, use only the previously persisted Supabase session
 * so the locally saved workspace snapshot can open. Server-backed actions must
 * still remain unavailable until the connection is restored and the session is
 * revalidated by Supabase.
 */
export async function getWorkspaceDisplaySession(): Promise<Session | null> {
  if (typeof window !== "undefined" && typeof navigator !== "undefined" && !navigator.onLine) {
    return readStoredSession();
  }

  try {
    const { data, error } = await import("@/integrations/supabase/client").then(({ supabase }) =>
      supabase.auth.getSession(),
    );
    if (!error && data.session) return data.session;
  } catch {
    // If the connection dropped while checking, use the local display-only session below.
  }

  if (typeof navigator !== "undefined" && !navigator.onLine) return readStoredSession();
  return null;
}

function readStoredSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("sb-irzbexiuhiufyjwjzlux-auth-token");
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
