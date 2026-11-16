-- Rex-controlled campaign approval and scheduling.
alter table public.campaigns
  add column if not exists approved_at timestamptz,
  add column if not exists scheduled_at timestamptz,
  add column if not exists paused_at timestamptz;

alter table public.campaigns drop constraint if exists campaigns_status_check;
alter table public.campaigns add constraint campaigns_status_check check (status = any (array['pending_approval','queued','running','paused','completed','failed']::text[]));

create index if not exists campaigns_worker_ready_idx
  on public.campaigns (next_run_at, created_at)
  where status in ('queued', 'running') and approved_at is not null;

create index if not exists campaigns_owner_created_idx
  on public.campaigns (user_id, created_at desc);

-- Existing queued campaigns are deliberately not auto-approved. They must be
-- reviewed and approved by their owner before the worker can deliver them.
update public.campaigns
set status = 'pending_approval',
    last_error = coalesce(last_error, 'Rex approval is required before this campaign can execute.')
where status = 'queued' and approved_at is null;
