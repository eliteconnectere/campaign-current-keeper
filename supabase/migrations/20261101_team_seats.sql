-- Elite Studio ProMaxx team seats: owner invites members by email.
-- Each member logs in with their own account and only sees their own Gmail profiles.

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

create index if not exists team_seats_owner_idx on public.team_seats (owner_user_id);
create index if not exists team_seats_member_email_idx on public.team_seats (lower(member_email));
create index if not exists team_seats_member_user_idx on public.team_seats (member_user_id)
  where member_user_id is not null;
create index if not exists team_seats_token_idx on public.team_seats (invite_token);

comment on table public.team_seats is
  'ProMaxx team invites. Members use their own login; Gmail profiles stay per-user_id.';
