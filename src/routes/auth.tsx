import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in · Elite Connectere" },
      {
        name: "description",
        content:
          "Sign in to Elite Connectere to use your campaign workspace and Rex AI Workspace Agent.",
      },
      { property: "og:title", content: "Sign in · Elite Connectere" },
      {
        property: "og:description",
        content: "Sign in to your Elite Connectere workspace and use Rex AI Workspace Agent.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/app" });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      if (mode === "up") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/app` },
        });
        if (error) throw error;
        if (data.session) {
          // Email confirmation is disabled: Supabase has already signed the new user in.
          void navigate({ to: "/app" });
          return;
        }
        // Email confirmation is enabled: wait for the verified callback, then sign in.
        setMessage("Account created. Check your email and click the verification link. You can then sign in.");
        setMode("in");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        void navigate({ to: "/app" });
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function forgot() {
    if (!email) {
      setMessage("Enter your email above first, then tap Forgot password.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setMessage(error ? error.message : "Password reset link sent. Check your email.");
  }

  async function google() {
    setMessage("");
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/app` },
      });
      if (error) {
        toast.error(`Google sign-in failed: ${error.message}`);
        setMessage(`Google sign-in failed: ${error.message}`);
        setBusy(false);
        return;
      }
      // On success the browser navigates away to Google; nothing more to do.
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Google sign-in error: ${msg}`);
      setMessage(`Google sign-in error: ${msg}`);
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-white">
      <header className="border-b border-line px-4 py-3.5">
        <div className="mx-auto flex max-w-xl items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-full bg-ink">
            <div className="flex size-5 items-center justify-center rounded-[6px] bg-brand">
              <Mail className="size-3 text-white" />
            </div>
          </div>
          <span className="text-[15px] font-semibold text-ink">
            Elite <span className="text-brand">Connectere</span>
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-6">
        <h1 className="text-[20px] font-bold leading-tight text-ink">
          {mode === "in" ? "Sign in" : "Create your account"}
        </h1>
        <p className="mt-1 text-[12.5px] leading-snug text-ink-soft">
          This is your Master Login. Campaign Gmail profiles are connected separately inside your workspace. Rex is designed to operate across your own Elite Connectere workspace. Rex works directly on routine tasks and asks for approval only before sending an email campaign or Private Chat message.
        </p>

        <button
          onClick={google}
          className="mt-4 w-full rounded-xl border border-line px-3 py-2.5 text-[13px] font-semibold text-ink"
        >
          Continue with Google
        </button>

        <div className="my-3 flex items-center gap-2">
          <span className="h-px flex-1 bg-line" />
          <span className="text-[11px] text-ink-soft">or</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        <form onSubmit={submit} className="space-y-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border border-line px-3 py-2.5 text-[13px] text-ink outline-none focus:border-ink/30"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-xl border border-line px-3 py-2.5 text-[13px] text-ink outline-none focus:border-ink/30"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-brand px-3 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}
          </button>
        </form>

        {mode === "in" && (
          <button type="button" onClick={forgot} className="mt-2 text-[12px] font-semibold text-ink-soft">
            Forgot password?
          </button>
        )}

        {message && <p className="mt-2 text-[12px] text-brand">{message}</p>}

        <button
          onClick={() => setMode(mode === "in" ? "up" : "in")}
          className="mt-3 text-[12.5px] font-semibold text-brand"
        >
          {mode === "in" ? "Need an account? Create one" : "Already have an account? Sign in"}
        </button>
      </main>
    </div>
  );
}
