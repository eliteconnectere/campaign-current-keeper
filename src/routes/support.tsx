import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, MessageSquare, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const URL = "https://eliteconnectere.site/support";
const TITLE = "Support · Elite Connectere";
const DESC = "Contact Elite Connectere support for help with Rex AI, campaign workspace features, billing, privacy, or shared access.";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: URL },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
  component: SupportPage,
});

function SupportPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error("Please fill in name, email, and message.");
      return;
    }
    const subject = encodeURIComponent(`Elite Connectere support — ${name.trim()}`);
    const body = encodeURIComponent(
      `From: ${name.trim()} <${email.trim()}>\n\n${message.trim()}`,
    );
    window.location.href = `mailto:eliteconnectere@gmail.com?subject=${subject}&body=${body}`;
    toast.success("Opening your email app…");
  };

  return (
    <main className="min-h-screen bg-canvas text-ink antialiased">
      <header className="sticky top-0 z-20 border-b border-line bg-card/60 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-3">
          <Link to="/" className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
            <ArrowLeft className="size-4" /> Home
          </Link>
          <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">Support</span>
        </div>
      </header>

      <section className="mx-auto max-w-2xl px-5 py-10">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Support</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Questions about Elite Engine, billing, or connection sharing? Reach us below.
        </p>

        <div className="mt-6 rounded-2xl border border-line bg-card p-4">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-ink">
            <Mail className="size-4 text-brand" /> Direct email
          </p>
          <a
            href="mailto:eliteconnectere@gmail.com"
            className="mt-1 block text-[14px] font-semibold text-brand underline"
          >
            eliteconnectere@gmail.com
          </a>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-3 rounded-2xl border border-line bg-card p-4">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-ink">
            <MessageSquare className="size-4 text-brand" /> Inquiry form
          </p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-full rounded-xl border border-line px-3 py-2.5 text-[13px] outline-none focus:border-ink/30"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Your email"
            className="w-full rounded-xl border border-line px-3 py-2.5 text-[13px] outline-none focus:border-ink/30"
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="How can we help?"
            rows={5}
            className="w-full resize-none rounded-xl border border-line px-3 py-2.5 text-[13px] outline-none focus:border-ink/30"
          />
          <button
            type="submit"
            className="w-full rounded-full bg-brand py-2.5 text-[13px] font-semibold text-white"
          >
            Send inquiry
          </button>
          <p className="text-center text-[11px] text-ink-soft">
            Opens your mail app addressed to eliteconnectere@gmail.com
          </p>
        </form>

        <nav className="mt-10 grid gap-6 text-[12px] sm:grid-cols-3">
          <div>
            <p className="font-bold uppercase tracking-wider text-ink-soft">Public & info</p>
            <ul className="mt-2 space-y-1.5 font-semibold text-ink">
              <li><Link to="/" className="hover:text-brand">Homepage</Link></li>
              <li><Link to="/rex" className="hover:text-brand">Rex AI & campaign guide</Link></li>
              <li><Link to="/learn-more" className="hover:text-brand">Learn more</Link></li>
              <li><Link to="/support" className="hover:text-brand">Support</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-bold uppercase tracking-wider text-ink-soft">App & auth</p>
            <ul className="mt-2 space-y-1.5 font-semibold text-ink">
              <li><Link to="/app" className="hover:text-brand">Workspace</Link></li>
              <li><Link to="/auth" className="hover:text-brand">Sign in</Link></li>
              <li><Link to="/reset-password" className="hover:text-brand">Password reset</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-bold uppercase tracking-wider text-ink-soft">Legal & compliance</p>
            <ul className="mt-2 space-y-1.5 font-semibold text-ink">
              <li><Link to="/privacy" className="hover:text-brand">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-brand">Terms of Service</Link></li>
              <li><Link to="/unsubscribe" className="hover:text-brand">Unsubscribe</Link></li>
            </ul>
          </div>
        </nav>
      </section>
    </main>
  );
}
