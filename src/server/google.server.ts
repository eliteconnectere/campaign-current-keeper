// Server-only direct Google OAuth helpers for campaign Gmail sending profiles.
// Uses the same Google OAuth client configured in Supabase Auth.

function creds() {
  const id = process.env["GOOGLE_CLIENT_ID"];
  const secret = process.env["GOOGLE_CLIENT_SECRET"];
  if (!id || !secret) {
    throw new Error("Gmail connection is temporarily unavailable. Please try again later.");
  }
  return { id, secret };
}

export class GoogleReconnect extends Error {}

/** Swap a stored refresh token for a short-lived access token. */
// Access tokens live ~60 min. Reuse them for up to 55 min so thousands of
// sends don't hammer Google's token endpoint (which rate-limits with 429s).
const tokenCache = new Map<string, { token: string; scope: string; expiresAt: number }>();

export async function accessTokenFor(refreshToken: string): Promise<{ token: string; scope: string }> {
  const cached = tokenCache.get(refreshToken);
  if (cached && cached.expiresAt > Date.now()) return { token: cached.token, scope: cached.scope };
  const fresh = await fetchAccessToken(refreshToken);
  if (tokenCache.size > 50_000) tokenCache.clear();
  tokenCache.set(refreshToken, { ...fresh, expiresAt: Date.now() + 55 * 60_000 });
  return fresh;
}

export function forgetAccessToken(refreshToken: string) {
  tokenCache.delete(refreshToken);
}

async function fetchAccessToken(refreshToken: string): Promise<{ token: string; scope: string }> {
  const { id, secret } = creds();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: id,
      client_secret: secret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    scope?: string;
    error?: string;
  };
  if (!res.ok || !body.access_token) {
    if (body.error === "invalid_grant") throw new GoogleReconnect("Google access expired.");
    throw new Error(`Google token refresh failed (${res.status}: ${body.error ?? "unknown"})`);
  }
  return { token: body.access_token, scope: body.scope ?? "" };
}

/** The Google address that owns an access token. */
export async function emailFor(accessToken: string): Promise<string | null> {
  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`,
  );
  if (!res.ok) return null;
  const info = (await res.json()) as { email?: string };
  return info.email ?? null;
}

export async function revoke(refreshToken: string) {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`, {
    method: "POST",
  }).catch(() => undefined);
}

export async function gmailSend(accessToken: string, raw: string) {
  return fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });
}

/** Trade the one-time authorization code from Google's redirect for tokens. */
export async function exchangeCode(code: string, redirectUri: string) {
  const { id, secret } = creds();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: id,
      client_secret: secret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    refresh_token?: string;
    scope?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok) {
    throw new Error(`Google refused the connection (${body.error_description ?? body.error ?? res.status}).`);
  }
  return { refreshToken: body.refresh_token ?? null, scope: body.scope ?? "" };
}

export function googleClientId() {
  return creds().id;
}
