create table if not exists public.rex_service_identities (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade unique,
  agent_key text not null unique default ('rex_' || replace(gen_random_uuid()::text, '-', '')),
  display_name text not null default 'Rex AI Agent',
  status text not null default 'provisioned' check (status in ('provisioned','registration_required','pending_owner_action','active','suspended','failed')),
  public_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.rex_service_identities enable row level security;
drop policy if exists "Owners can view their Rex service identity" on public.rex_service_identities;
create policy "Owners can view their Rex service identity" on public.rex_service_identities for select to authenticated using (owner_user_id = auth.uid());
revoke all on public.rex_service_identities from anon, authenticated;
grant select on public.rex_service_identities to authenticated;

create table if not exists public.rex_service_registrations (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (char_length(provider) between 2 and 120),
  status text not null default 'not_started' check (status in ('not_started','prepared','pending_owner_action','submitted','active','rejected','failed')),
  external_registration_id text,
  requested_scopes text[] not null default '{}',
  required_owner_action text,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  submitted_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_user_id, provider)
);
alter table public.rex_service_registrations enable row level security;
drop policy if exists "Owners can view their Rex service registrations" on public.rex_service_registrations;
create policy "Owners can view their Rex service registrations" on public.rex_service_registrations for select to authenticated using (owner_user_id = auth.uid());
revoke all on public.rex_service_registrations from anon, authenticated;
grant select on public.rex_service_registrations to authenticated;
create index if not exists rex_service_registrations_owner_status_idx on public.rex_service_registrations(owner_user_id, status);