-- Lease whole campaigns to one worker at a time. Expired leases are recoverable.
alter table public.campaigns
  add column if not exists worker_lease_token uuid,
  add column if not exists worker_lease_until timestamptz;

create index if not exists campaigns_due_unleased_idx
  on public.campaigns (next_run_at, created_at)
  where status in ('queued', 'running') and approved_at is not null;

create index if not exists campaigns_worker_lease_idx
  on public.campaigns (worker_lease_until)
  where worker_lease_until is not null;

create or replace function public.claim_due_campaigns(
  p_limit integer default 1,
  p_campaign_id uuid default null,
  p_now timestamptz default now(),
  p_lease_seconds integer default 120
)
returns setof public.campaigns
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_limit < 1 or p_limit > 20 then
    raise exception 'p_limit must be between 1 and 20';
  end if;
  if p_lease_seconds < 30 or p_lease_seconds > 600 then
    raise exception 'p_lease_seconds must be between 30 and 600';
  end if;

  return query
  with picked as (
    select c.id
    from public.campaigns c
    where c.status in ('queued', 'running')
      and c.approved_at is not null
      and c.next_run_at <= p_now
      and (c.worker_lease_until is null or c.worker_lease_until < p_now)
      and (p_campaign_id is null or c.id = p_campaign_id)
    order by c.next_run_at asc, c.created_at asc
    for update skip locked
    limit p_limit
  )
  update public.campaigns c
  set worker_lease_token = gen_random_uuid(),
      worker_lease_until = p_now + make_interval(secs => p_lease_seconds),
      updated_at = p_now
  from picked
  where c.id = picked.id
  returning c.*;
end;
$$;

revoke all on function public.claim_due_campaigns(integer, uuid, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.claim_due_campaigns(integer, uuid, timestamptz, integer) to service_role;
