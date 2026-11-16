import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password · Elite Connectere" },
      { name: "description", content: "Set a new password for your Elite Connectere Master Login." },
      { property: "og:title", content: "Reset password · Elite Connectere" },
      { property: "og:description", content: "Set a new password for your Master Login." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setMessage(error.message);
    void navigate({ to: "/app" });
  }

  return (
    <main className="mx-auto min-h-screen max-w-xl bg-white px-4 py-6">
      <h1 className="text-[20px] font-bold text-ink">Set a new password</h1>
      <form onSubmit={submit} className="mt-4 space-y-2">
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password"
          className="w-full rounded-xl border border-line px-3 py-2.5 text-[13px] text-ink outline-none"
        />
        <button disabled={busy} className="w-full rounded-xl bg-brand px-3 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50">
          {busy ? "Please wait…" : "Save password"}
        </button>
      </form>
      {message && <p className="mt-2 text-[12px] text-brand">{message}</p>}
    </main>
  );
}
