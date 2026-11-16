alter table public.campaigns
  add column if not exists delay_seconds smallint not null default 5;

alter table public.campaigns
  drop constraint if exists campaigns_delay_seconds_check;

alter table public.campaigns
  add constraint campaigns_delay_seconds_check check (delay_seconds in (3,4,5,8));
