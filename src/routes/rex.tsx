import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/rex")({
  head: () => ({
    meta: [
      { title: "Agent Rex — Elite Connectere Workspace Agent" },
      {
        name: "description",
        content:
          "Agent Rex is Elite Connectere's AI workspace agent: what it can do, what it cannot do, and how approvals work.",
      },
      { property: "og:title", content: "Agent Rex — Elite Connectere" },
      { property: "og:url", content: "https://eliteconnectere.site/rex" },
    ],
    links: [{ rel: "canonical", href: "https://eliteconnectere.site/rex" }],
  }),
  component: RexAgentPage,
});

function RexAgentPage() {
  return (
    <div className="min-h-screen bg-background text-ink">
      <header className="border-b border-line px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <Link to="/" className="text-sm font-semibold text-brand">
            Elite Connectere
          </Link>
          <nav className="flex flex-wrap gap-3 text-[12px] font-semibold text-ink-soft">
            <Link to="/learn-more" className="hover:text-brand">
              Learn more
            </Link>
            <Link to="/privacy" className="hover:text-brand">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-brand">
              Terms
            </Link>
            <Link to="/auth" className="text-brand">
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-8 px-4 py-10 pb-20">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-brand">Agent Rex</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Rex AI — the operating agent behind your bulk email campaigns and workspace</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
            Elite Connectere combines a bulk email campaign preparation and execution engine with Rex, its built-in AI
            Workspace Agent. The campaign tools process recipient lists, validate addresses, personalise messages, manage
            connected sender profiles and deliver campaigns. Rex works alongside those tools: you can describe a campaign
            in natural language and ask Rex to help plan it, prepare content, inspect relevant information, review
            readiness and operate registered workspace features. The engine sends the campaign; Rex helps you direct and
            manage the work.
          </p>
          <p className="mt-2 text-[12px] text-ink-soft">Last updated: 9 November 2026 · eliteconnectere.site/rex</p>
        </div>

        <section className="space-y-3 rounded-2xl border border-line bg-card p-4">
          <h2 className="text-[15px] font-bold">What Agent Rex can do</h2>
          <ul className="list-disc space-y-2 pl-5 text-[13px] leading-relaxed text-ink-soft">
            <li>Navigate to registered places in the app (Settings, Snippets, Vault, Tracker, Hotspot, Campaign Monitor, and more) from natural language, including typos.</li>
            <li>Work with the bulk campaign workflow: organise recipient lists, prepare templates, explain validation results, personalise content, and review capacity and timing.</li>
            <li>Help manage campaign execution through registered tools, including campaign monitoring and available pause, resume and stop controls.</li>
            <li>Read and understand your own workspace information, conversations and live campaign drafts as part of normal assistance.</li>
            <li>Offer campaign execution, pause, resume, and stop through registered approval controls — not free-text “approve” labels.</li>
            <li>Campaign Monitor (Rex Studio): real-time ownership of the <em>current</em> campaign only; when on, continues across leave/logout until turned off in Studio.</li>
            <li>Share Hotspot access when you provide an email (and seat limits if needed), after you approve the share control.</li>
            <li>Guide you through Studio, notifications, protection, and other workspace tools without inventing external websites.</li>
          </ul>
        </section>

        <section className="space-y-3 rounded-2xl border border-line bg-card p-4">
          <h2 className="text-[15px] font-bold">How Rex works</h2>
          <p className="text-[13px] leading-relaxed text-ink-soft">
            Rex interprets your instructions and works with the campaign engine and other connected workspace tools. You can use the campaign interface directly or ask Rex to help with the same workflow: prepare a bulk campaign, review recipients and validation results, draft and personalise messages, check sending readiness, and monitor or manage execution using available controls. Rex does not replace the mailing engine; it is the AI agent that helps you operate it and the wider workspace. Reading, analysis, drafting and routine workspace operations do not need sending approval. Before an email campaign or Private Chat message is sent, Rex shows the exact action for your explicit approval.
          </p>
        </section>

        <section className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/30">
          <h2 className="text-[15px] font-bold text-ink">Warnings</h2>
          <ul className="list-disc space-y-2 pl-5 text-[13px] leading-relaxed text-ink-soft">
            <li>You remain responsible for content you authorize Rex to send.</li>
            <li>Approvals apply to the message they appear on. Asking something else without tapping Approve expires that control.</li>
            <li>Do not share passwords, payment cards, or secrets in chat with any AI agent.</li>
            <li>Google may still limit or flag Gmail accounts based on sending behaviour; Elite’s pacing rules exist to reduce that risk, not eliminate it.</li>
          </ul>
        </section>

        <section className="space-y-3 rounded-2xl border border-brand/30 bg-brand/5 p-4">
          <h2 className="text-[15px] font-bold text-ink">Approvals</h2>
          <p className="text-[13px] leading-relaxed text-ink-soft">
            Red approval controls apply to the message they appear on. If you ask something else without tapping Approve,
            that control expires. Ask again anytime for a fresh control. Only real product buttons are valid — invented
            text like “[[APPROVE …]]” in prose is not a control.
          </p>
        </section>

        <section className="space-y-2 text-[13px] text-ink-soft">
          <p>
            Short summary also appears under{" "}
            <Link to="/learn-more" hash="rex-ai" className="font-semibold text-brand underline underline-offset-2">
              Learn more → Agent Rex
            </Link>
            . Legal:{" "}
            <Link to="/privacy" className="font-semibold text-brand underline underline-offset-2">
              Privacy
            </Link>{" "}
            ·{" "}
            <Link to="/terms" className="font-semibold text-brand underline underline-offset-2">
              Terms
            </Link>
            .
          </p>
        </section>

        <Link
          to="/auth"
          className="inline-flex rounded-full bg-brand px-5 py-2.5 text-[13px] font-semibold text-white"
        >
          Open workspace
        </Link>
      </main>
    </div>
  );
}
