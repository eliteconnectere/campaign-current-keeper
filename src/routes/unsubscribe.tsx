import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Mail } from "lucide-react";

export const Route = createFileRoute("/unsubscribe")({
  head: () => ({
    links: [{ rel: "canonical", href: "https://eliteconnectere.site/unsubscribe" }],
    meta: [
      { title: "Unsubscribe Confirmation · Elite Connectere" },
      {
        name: "description",
        content:
          "You have been successfully unsubscribed from Elite Connectere communications.",
      },
      { property: "og:title", content: "Unsubscribe Confirmation · Elite Connectere" },
      {
        property: "og:description",
        content:
          "You have been successfully unsubscribed from Elite Connectere communications.",
      },
      { property: "og:url", content: "https://eliteconnectere.site/unsubscribe" },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: UnsubscribePage,
});

function closeOrBack() {
  // Prefer closing the tab/webview (Gmail in-app browser often allows this).
  try {
    window.close();
  } catch {}
  // If still open, go back in history (usually returns to Gmail).
  if (typeof window !== "undefined" && window.history.length > 1) {
    window.history.back();
  }
}

function UnsubscribePage() {
  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-white text-ink">
      <header className="border-b border-line px-4 py-3.5">
        <div className="mx-auto flex max-w-xl items-center gap-2">
          <Mail className="size-5 text-brand" />
          <span className="text-[15px] font-semibold text-ink">Elite Connectere</span>
        </div>
      </header>

      <main className="mx-auto flex max-w-xl flex-col items-center px-4 py-12 text-center sm:py-16">
        <span className="flex size-16 items-center justify-center rounded-full bg-brand-soft ring-1 ring-brand/20">
          <CheckCircle2 className="size-9 text-brand" aria-hidden />
        </span>

        <h1 className="mt-5 text-[22px] font-bold leading-tight text-ink sm:text-[26px]">
          Unsubscribe Confirmation
        </h1>

        <p className="mt-3 max-w-md text-[14px] leading-relaxed text-ink-soft sm:text-[15px]">
          You have been successfully unsubscribed. Your email address has been removed from this
          mailing list and you will not receive any further communications from this sender.
        </p>

        <p className="mt-4 max-w-md text-[13px] leading-relaxed text-ink-soft">
          If this was done by mistake or you have questions, contact us at{" "}
          <a
            href="mailto:eliteconnectere@gmail.com"
            className="font-semibold text-brand underline underline-offset-2"
          >
            eliteconnectere@gmail.com
          </a>
          .
        </p>

        <button
          type="button"
          onClick={closeOrBack}
          className="mt-8 inline-flex min-h-11 items-center justify-center rounded-full bg-brand px-6 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
        >
          Done — return to mail
        </button>

        <p className="mt-4 text-[11px] text-ink-soft">
          You can close this tab or return to Gmail. This page will not open the Elite Connectere app.
        </p>
      </main>
    </div>
  );
}
