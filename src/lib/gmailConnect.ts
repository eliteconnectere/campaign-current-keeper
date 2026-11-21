// Client-safe helper for connecting campaign Gmail sending profiles.
// Google returns to the app's own server, which saves the profile. The app
// only asks the server how the request ended — it never relies on the Google
// window staying linked, which Google and iPhone routinely break.
import {
  cancelGmailConnectAttempt,
  getGmailConnectAttempt,
  listGmailProfiles,
  prepareGmailConnect,
} from "@/lib/gmail.functions";

type Outcome = { status: string; email: string | null; message: string | null };

const DEADLINE_MS = 10 * 60_000;
const FINAL = new Set([
  "connected",
  "no_send_scope",
  "no_identity",
  "limit_reached",
  "suspended",
  "banned",
  "declined",
  "no_offline",
  "error",
  "expired",
  "cancelled",
]);

let cancelCurrent: (() => void) | null = null;

/** Cancels the connection currently waiting on Google, if any. */
export function cancelGmailConnect() {
  cancelCurrent?.();
}

function waitForServer(attempt: string) {
  return new Promise<Outcome>((resolve, reject) => {
    const started = Date.now();
    let done = false;
    let checking = false;
    const finish = (fn: () => void) => {
      if (done) return;
      done = true;
      cancelCurrent = null;
      window.clearInterval(timer);
      window.removeEventListener("focus", check);
      window.removeEventListener("message", onMessage);
      document.removeEventListener("visibilitychange", onVisible);
      fn();
    };
    async function check() {
      if (done || checking) return;
      checking = true;
      try {
        const r = await getGmailConnectAttempt({ data: { attempt } });
        if (FINAL.has(r.status)) finish(() => resolve(r));
      } catch {
        /* network blip — keep waiting */
      } finally {
        checking = false;
      }
      if (!done && Date.now() - started > DEADLINE_MS) {
        void cancelGmailConnectAttempt({ data: { attempt } }).catch(() => undefined);
        finish(() => reject(new Error("Google took too long. Tap Connect to try again.")));
      }
    }
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    const onMessage = (e: MessageEvent) => {
      if ((e.data as { type?: string })?.type === "gmailConnectDone") void check();
    };
    const timer = window.setInterval(() => void check(), 2500);
    window.addEventListener("focus", check);
    window.addEventListener("message", onMessage);
    document.addEventListener("visibilitychange", onVisible);
    cancelCurrent = () => {
      void cancelGmailConnectAttempt({ data: { attempt } }).catch(() => undefined);
      finish(() => reject(new Error("Connection cancelled.")));
    };
  });
}

function failureMessage(o: Outcome) {
  // Penalty messages are authored server-side from the current suspension
  // record; show them verbatim rather than replacing them with a generic error.
  if ((o.status === "suspended" || o.status === "banned") && o.message) return o.message;
  switch (o.status) {
    case "declined":
      return "You cancelled on Google's screen.";
    case "no_offline":
      return "Google didn't grant lasting access. Connect again and approve every permission.";
    case "expired":
      return "That connection link expired. Tap Connect to try again.";
    case "cancelled":
      return "Connection cancelled.";
    default:
      return o.message ?? "Google refused the connection.";
  }
}

/** Authorises one new, independent campaign Gmail sending profile. */
export async function connectGmailAccount() {
  // Open during the tap so mobile browsers allow it.
  const popup = window.open("", "_blank");
  let outcome: Outcome;
  try {
    const prep = await prepareGmailConnect();
    if (prep.locked) {
      popup?.close();
      return { locked: true as const, reason: prep.reason, limit: prep.limit };
    }
    const waiting = waitForServer(prep.attempt);
    if (popup && !popup.closed) popup.location.href = prep.authorizeUrl;
    else window.location.assign(prep.authorizeUrl); // pop-ups blocked: go in this tab
    outcome = await waiting;
  } catch (error) {
    try {
      popup?.close();
    } catch {
      /* already gone */
    }
    throw error;
  }
  const { profiles } = await listGmailProfiles();
  if (!["connected", "no_send_scope", "no_identity", "limit_reached"].includes(outcome.status)) {
    throw new Error(failureMessage(outcome));
  }
  return {
    locked: false as const,
    ok: outcome.status === "connected",
    reason: outcome.status as "connected" | "no_send_scope" | "no_identity" | "limit_reached",
    email: outcome.email,
    profiles,
  };
}
