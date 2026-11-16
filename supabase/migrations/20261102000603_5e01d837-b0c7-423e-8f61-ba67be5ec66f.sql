create table if not exists public.gmail_account_penalties (
  email_key text primary key,
  flag_count_total integer not null default 0,
  flags_this_month integer not null default 0,
  month_start date not null default current_date,
  last_flagged_at timestamptz,
  suspension_until timestamptz,
  suspension_days integer,
  monthly_cap integer,
  banned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant all on public.gmail_account_penalties to service_role;

alter table public.gmail_account_penalties enable row level security;

-- Server-only table: no anon/authenticated policies by design.

create or replace function public.touch_gmail_account_penalties_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists gmail_account_penalties_updated_at on public.gmail_account_penalties;
create trigger gmail_account_penalties_updated_at
before update on public.gmail_account_penalties
for each row execute function public.touch_gmail_account_penalties_updated_at();