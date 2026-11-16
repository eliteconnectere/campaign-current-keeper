-- Owner can allow or block assistant from using shared snippet library
alter table public.team_seats
  add column if not exists share_snippets boolean not null default false;

comment on column public.team_seats.share_snippets is
  'If true, assistant may use owner-shared snippet categories; default false = private.';
