import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, LogOut, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "Account · Elite Connectere" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        void navigate({ to: "/auth" });
        return;
      }
      setEmail(data.session.user.email ?? null);
    });
  }, [navigate]);

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    void navigate({ to: "/" });
  };

  return (
    <main className="min-h-screen bg-canvas text-ink antialiased">
      <header className="sticky top-0 z-20 border-b border-line bg-card/60 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-between px-5 py-3">
          <Link to="/app" className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
            <ArrowLeft className="size-4" /> Workspace
          </Link>
          <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">Account</span>
        </div>
      </header>

      <section className="mx-auto max-w-lg px-5 py-10">
        <h1 className="text-2xl font-extrabold">Account controls</h1>
        <div className="mt-6 rounded-2xl border border-line bg-card p-4">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-ink">
            <User className="size-4 text-brand" /> Signed in as
          </p>
          <p className="mt-1 text-[14px] text-ink-soft">{email ?? "Loading…"}</p>
        </div>

        <div className="mt-4 space-y-2 text-[13px]">
          <Link to="/app" className="block rounded-xl border border-line bg-card px-4 py-3 font-semibold hover:border-brand">
            Open workspace
          </Link>
          <Link to="/support" className="block rounded-xl border border-line bg-card px-4 py-3 font-semibold hover:border-brand">
            Support
          </Link>
          <Link to="/privacy" className="block rounded-xl border border-line bg-card px-4 py-3 font-semibold hover:border-brand">
            Privacy Policy
          </Link>
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex w-full items-center gap-2 rounded-xl border border-line bg-card px-4 py-3 font-semibold text-brand"
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      </section>
    </main>
  );
}
