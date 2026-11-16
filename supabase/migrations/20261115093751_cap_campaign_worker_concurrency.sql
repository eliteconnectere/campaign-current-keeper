-- Keep all manual and scheduled campaign starts under one shared worker ceiling.
drop function if exists public.claim_due_campaigns(integer, uuid, timestamptz, integer);

create or replace function public.claim_due_campaigns(
  p_limit integer default 1,
  p_campaign_id uuid default null,
  p_now timestamptz default now(),
  p_lease_seconds integer default 120,
  p_max_concurrent integer default 8
)
returns setof public.campaigns
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active integer;
  v_claim_limit integer;
begin
  if p_limit < 1 or p_limit > 20 then
    raise exception 'p_limit must be between 1 and 20';
  end if;
  if p_lease_seconds < 30 or p_lease_seconds > 600 then
    raise exception 'p_lease_seconds must be between 30 and 600';
  end if;
  if p_max_concurrent < 1 or p_max_concurrent > 64 then
    raise exception 'p_max_concurrent must be between 1 and 64';
  end if;

  perform pg_advisory_xact_lock(734205198::bigint);

  select count(*)::integer into v_active
  from public.campaigns c
  where c.worker_lease_token is not null
    and c.worker_lease_until > p_now;

  v_claim_limit := least(p_limit, greatest(0, p_max_concurrent - v_active));
  if v_claim_limit = 0 then
    return;
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
    limit v_claim_limit
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

revoke all on function public.claim_due_campaigns(integer, uuid, timestamptz, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_due_campaigns(integer, uuid, timestamptz, integer, integer) to service_role;
