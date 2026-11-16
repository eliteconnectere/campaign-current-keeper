-- Elite Connectere team / share (run once)
create table if not exists public.team_seats (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  member_email text not null,
  member_user_id uuid null,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'revoked')),
  invite_token text not null unique,
  created_at timestamptz not null default now(),
  accepted_at timestamptz null,
  unique (owner_user_id, member_email)
);

alter table public.team_seats
  add column if not exists max_gmail_profiles integer not null default 5;

do $$
begin
  alter table public.team_seats
    add constraint team_seats_max_gmail_profiles_check
    check (max_gmail_profiles >= 1 and max_gmail_profiles <= 75);
exception
  when duplicate_object then null;
end $$;

create index if not exists team_seats_owner_idx on public.team_seats (owner_user_id);
create index if not exists team_seats_member_email_idx on public.team_seats (lower(member_email));
create index if not exists team_seats_member_user_idx on public.team_seats (member_user_id)
  where member_user_id is not null;
create index if not exists team_seats_token_idx on public.team_seats (invite_token);