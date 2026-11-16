-- Launch-readiness indexes for high-traffic ownership and approval lookups.
-- These tables are currently small; IF NOT EXISTS keeps the migration safe to re-run.
create index if not exists chat_energy_sessions_user_id_idx
  on public.chat_energy_sessions (user_id);

create index if not exists rex_dynamic_feature_data_user_id_idx
  on public.rex_dynamic_feature_data (user_id);

create index if not exists rex_execution_jobs_approval_id_idx
  on public.rex_execution_jobs (approval_id);

-- Evaluate auth.uid() once per statement rather than once per row.
alter policy "Users manage own Rex destinations"
  on public.rex_personal_destinations
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy "Owners can view their Rex service identity"
  on public.rex_service_identities
  using (owner_user_id = (select auth.uid()));

alter policy "Owners can view their Rex service registrations"
  on public.rex_service_registrations
  using (owner_user_id = (select auth.uid()));
