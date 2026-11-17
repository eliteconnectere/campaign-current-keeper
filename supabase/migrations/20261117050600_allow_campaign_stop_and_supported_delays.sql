alter table public.campaigns drop constraint if exists campaigns_status_check;
alter table public.campaigns add constraint campaigns_status_check check (status = any (array['pending_approval','queued','running','paused','completed','failed','cancelled']::text[]));
alter table public.campaigns drop constraint if exists campaigns_delay_seconds_check;
alter table public.campaigns add constraint campaigns_delay_seconds_check check (delay_seconds = any (array[3,4,5,6,7,8]::smallint[]));
