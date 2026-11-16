import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Master Login landing only. Campaign Gmail profiles return to the server
// route /api/public/gmail/callback and never pass through here.
export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Signing you in · Elite Connectere" },
      { name: "description", content: "Finishing your secure Google sign-in for Elite Connectere." },
      { property: "og:title", content: "Signing you in · Elite Connectere" },
      { property: "og:description", content: "Finishing your secure Google sign-in for Elite Connectere." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const [msg, setMsg] = useState("Finishing sign-in…");

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) void navigate({ to: "/app" });
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/app" });
      else window.setTimeout(() => setMsg("Sign-in did not complete. Please try again."), 4000);
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-6">
      <p className="text-[13px] text-ink-soft">{msg}</p>
    </div>
  );
}
