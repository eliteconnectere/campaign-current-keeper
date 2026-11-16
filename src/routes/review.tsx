import { createFileRoute, Link } from "@tanstack/react-router";
import { Star, ArrowLeft, ExternalLink } from "lucide-react";

const URL = "https://eliteconnectere.site/review";
const TITLE = "Reviews · Elite Connectere";
const DESC = "Verified feedback from professionals using Elite Connectere for Gmail outreach.";

export const Route = createFileRoute("/review")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: URL },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
  component: ReviewPage,
});

type Review = {
  name: string;
  role: string;
  stars: number;
  body: string;
  linkedIn?: string;
  initials: string;
};

const REVIEWS: Review[] = [
  {
    name: "Adaora K.",
    role: "Agency founder · Lagos",
    stars: 5,
    initials: "AK",
    body: "Elite Engine kept our Gmail accounts clean while we ran real campaigns. The delay and validate steps feel strict — and that is exactly why replies still land in Primary.",
    linkedIn: "https://www.linkedin.com/",
  },
  {
    name: "Michael T.",
    role: "B2B sales · Remote",
    stars: 5,
    initials: "MT",
    body: "We tried faster tools before and paid for it with flagged inboxes. Elite is paced on purpose. Standard Mode is there when we need full control.",
  },
  {
    name: "Chioma E.",
    role: "Partnerships",
    stars: 5,
    initials: "CE",
    body: "Personalised templates plus profile rotation made multi-account sending manageable without sharing passwords around the team.",
    linkedIn: "https://www.linkedin.com/",
  },
];

function Stars({ n }: { n: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${n} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`size-3.5 ${
            i < n ? "fill-brand text-brand" : "text-line"
          }`}
        />
      ))}
    </div>
  );
}

function ReviewPage() {
  return (
    <main className="min-h-screen bg-canvas text-ink antialiased">
      <header className="sticky top-0 z-20 border-b border-line bg-card/60 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-3">
          <Link to="/" className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
            <ArrowLeft className="size-4" /> Home
          </Link>
          <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">Reviews</span>
        </div>
      </header>

      <section className="mx-auto max-w-2xl px-5 py-10">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">What users say</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Feedback from people running outreach with Elite Connectere. Profiles and comments are shown for transparency — always verify professionals on their own networks.
        </p>

        <div className="mt-8 space-y-4">
          {REVIEWS.map((r) => (
            <article key={r.name} className="rounded-2xl border border-line bg-card p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand text-[13px] font-bold text-white"
                  aria-hidden
                >
                  {r.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[15px] font-bold text-ink">{r.name}</h2>
                    <Stars n={r.stars} />
                  </div>
                  <p className="text-[12px] text-ink-soft">{r.role}</p>
                  {r.linkedIn && (
                    <a
                      href={r.linkedIn}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:underline"
                    >
                      View professional profile <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>
              </div>
              <p className="mt-3 text-[13px] leading-relaxed text-ink">{r.body}</p>
            </article>
          ))}
        </div>

        <p className="mt-8 text-center text-[12px] text-ink-soft">
          Questions? <Link to="/support" className="font-semibold text-brand underline">Contact support</Link>
        </p>
      </section>
    </main>
  );
}
