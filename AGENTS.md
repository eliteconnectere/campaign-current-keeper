<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Google review mode: a single flag in src/lib/reviewMode.ts temporarily unlocks every account and hides payment/upgrade UI; flip it off to restore, never delete the gated code. Why: OAuth verification reviewers must not hit paywalls.
- Review-mode routes render an isolated customer CRM instead of mounting the legacy workspace; reuse existing Gmail helpers and keep consent session-only and bound to the current contacts and draft. Why: inactive outreach controls and automation must not run in the review view.

- Campaign worker: cron fans out workers by due-campaign count; each worker claims a batch of campaigns via SKIP LOCKED leases and runs them in parallel (no global lock) so delivery scales with users.
- Google access tokens are cached per worker isolate for 55 min to avoid token-endpoint rate limits.
