-- Per-assistant Gmail connect cap set by the owner when adding them
alter table public.team_seats
  add column if not exists max_gmail_profiles integer not null default 5
  check (max_gmail_profiles >= 1 and max_gmail_profiles <= 75);

comment on column public.team_seats.max_gmail_profiles is
  'Owner-set max Gmail profiles this assistant may connect (not a group invite system).';
