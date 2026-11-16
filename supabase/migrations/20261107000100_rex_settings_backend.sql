-- Persistent, per-account Rex Studio configuration and actionable review events.
create table if not exists public.rex_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.rex_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  severity text not null default 'info',
  title text not null,
  detail text not null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists rex_events_user_created_idx on public.rex_events(user_id, created_at desc);
alter table public.rex_settings enable row level security;
alter table public.rex_events enable row level security;
revoke all on public.rex_settings from anon, authenticated;
revoke all on public.rex_events from anon, authenticated;
grant all on public.rex_settings to service_role;
grant all on public.rex_events to service_role;
