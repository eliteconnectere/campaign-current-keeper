-- Atomically claim campaign recipients so overlapping workers cannot send the same row.
create index if not exists campaign_recipients_ready_claim_idx
  on public.campaign_recipients (campaign_id, next_attempt_at, created_at)
  where status = 'pending';

create or replace function public.claim_campaign_recipients(
  p_campaign_id uuid,
  p_limit integer default 6,
  p_now timestamptz default now()
)
returns setof public.campaign_recipients
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_limit < 1 or p_limit > 100 then
    raise exception 'p_limit must be between 1 and 100';
  end if;

  return query
  with picked as (
    select r.id
    from public.campaign_recipients r
    where r.campaign_id = p_campaign_id
      and r.status = 'pending'
      and r.next_attempt_at <= p_now
    order by r.next_attempt_at asc, r.created_at asc
    for update skip locked
    limit p_limit
  )
  update public.campaign_recipients r
  set status = 'sending',
      attempts = r.attempts + 1,
      updated_at = p_now
  from picked
  where r.id = picked.id
  returning r.*;
end;
$$;

revoke all on function public.claim_campaign_recipients(uuid, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_campaign_recipients(uuid, integer, timestamptz) to service_role;
