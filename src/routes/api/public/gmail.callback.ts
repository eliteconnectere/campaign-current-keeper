import { createFileRoute } from "@tanstack/react-router";

// Google returns here after consent. The `state` is a single-use connection
// request created by a signed-in Master account; nothing in the browser is
// trusted or needed. Never returns tokens or personal data.

function page(title: string, detail: string, ok: boolean) {
  const color = ok ? "#1f2a6b" : "#c8312f";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><meta name="robots" content="noindex"></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,sans-serif;background:#fff;padding:24px;box-sizing:border-box">
<div style="max-width:360px;text-align:center"><h1 style="font-size:18px;color:${color};margin:0 0 8px">${title}</h1>
<p style="font-size:14px;color:#55607a;line-height:1.45;margin:0">${detail}</p></div>
<script>try{window.opener&&window.opener.postMessage({type:"gmailConnectDone"},"*")}catch(e){}setTimeout(function(){try{window.close()}catch(e){}},1500)</script>
</body></html>`;
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/api/public/gmail/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const state = url.searchParams.get("state") ?? "";
        const code = url.searchParams.get("code");
        const googleError = url.searchParams.get("error");
        if (!UUID.test(state)) {
          return page("Connection link not recognised", "Return to Elite Connectere and tap Connect again.", false);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { ATTEMPT_TTL_MS, storeConnection } = await import("@/server/gmailConnect.server");
        const finish = (status: string, email: string | null, message: string | null) =>
          supabaseAdmin
            .from("gmail_connect_attempts" as never)
            .update({ status, email, message, completed_at: new Date().toISOString() } as never)
            .eq("id", state);

        // Claim the request atomically so it can only be used once.
        const since = new Date(Date.now() - ATTEMPT_TTL_MS).toISOString();
        const { data: claimed } = await supabaseAdmin
          .from("gmail_connect_attempts" as never)
          .update({ status: "working" } as never)
          .eq("id", state)
          .eq("status", "pending")
          .gte("created_at", since)
          .select("user_id, redirect_uri")
          .maybeSingle();
        const row = claimed as { user_id: string; redirect_uri: string | null } | null;
        if (!row) {
          return page(
            "This connection link has expired",
            "Return to Elite Connectere and tap Connect a Gmail account again.",
            false,
          );
        }

        if (googleError || !code) {
          const declined = googleError === "access_denied";
          await finish(declined ? "declined" : "error", null, googleError ?? "No code returned");
          return page(
            declined ? "Connection cancelled" : "Google did not finish",
            declined
              ? "You cancelled on Google's screen. Return to the app to try again."
              : "Return to Elite Connectere and try again.",
            false,
          );
        }

        try {
          const google = await import("@/server/google.server");
          const redirectUri = row.redirect_uri ?? `${url.origin}/api/public/gmail/callback`;
          const { refreshToken, scope } = await google.exchangeCode(code, redirectUri);
          if (!refreshToken) {
            await finish("no_offline", null, "Google did not grant lasting access");
            return page(
              "Google didn't grant lasting access",
              "Return to the app and connect again, approving every permission.",
              false,
            );
          }
          const { data: u } = await supabaseAdmin.auth.admin.getUserById(row.user_id);
          const out = await storeConnection(row.user_id, u.user?.email ?? undefined, refreshToken, scope, state);
          await finish(out.reason, out.email, null);
          if (out.ok) {
            return page(
              "Gmail profile connected",
              `${out.email ?? "Your Gmail"} is ready. Return to Elite Connectere.`,
              true,
            );
          }
          const detail =
            out.reason === "no_send_scope"
              ? "Sending permission wasn't ticked. Return to the app and connect again, allowing “Send email on your behalf”."
              : out.reason === "limit_reached"
                ? "Your plan's Gmail profile limit is reached. Return to the app to upgrade."
                : "Google did not confirm the address. Return to the app and try again.";
          return page("Gmail not connected", detail, false);
        } catch (e) {
          const message = e instanceof Error ? e.message : "Connection failed";
          console.error("Gmail callback failed", e);
          await finish("error", null, message.slice(0, 300));
          return page("Gmail not connected", "Google refused the connection. Return to the app and try again.", false);
        }
      },
    },
  },
});
