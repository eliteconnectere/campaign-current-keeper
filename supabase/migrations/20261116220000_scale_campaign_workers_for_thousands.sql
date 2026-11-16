-- Scale campaign delivery for thousands of simultaneous users.
-- Removes the single global advisory lock and the 64-campaign ceiling.
-- SKIP LOCKED + per-campaign leases keep each campaign on exactly one worker.
drop function if exists public.claim_due_campaigns(integer, uuid, timestamptz, integer, integer);

create or replace function public.claim_due_campaigns(
  p_limit integer default 10,
  p_campaign_id uuid default null,
  p_now timestamptz default now(),
  p_lease_seconds integer default 120,
  p_max_concurrent integer default 100000
)
returns setof public.campaigns
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_limit < 1 or p_limit > 200 then
    raise exception 'p_limit must be between 1 and 200';
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

revoke all on function public.claim_due_campaigns(integer, uuid, timestamptz, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_due_campaigns(integer, uuid, timestamptz, integer, integer) to service_role;

create index if not exists campaigns_due_claim_idx
  on public.campaigns (next_run_at, created_at)
  where status in ('queued', 'running') and approved_at is not null;

-- Fan out enough workers every minute to keep up to 5,000 campaigns moving at once
-- (500 workers x 10 campaigns each). Idle workers exit immediately.
do $schedule_worker$
begin
  if exists (select 1 from cron.job where jobname = 'campaign-worker-dispatch') then
    perform cron.unschedule('campaign-worker-dispatch');
  end if;

  perform cron.schedule(
    'campaign-worker-dispatch',
    '* * * * *',
    $command$
      do $dispatch$
      declare
        v_url text;
        v_secret text;
        v_due integer;
        v_workers integer;
        v_worker integer;
      begin
        select decrypted_secret into v_url from vault.decrypted_secrets where name = 'campaign_worker_url';
        select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'campaign_worker_secret';
        if coalesce(v_url, '') = '' or coalesce(v_secret, '') = '' then
          raise exception 'Campaign worker URL or secret is missing from Supabase Vault';
        end if;

        select count(*) into v_due from public.campaigns
        where status in ('queued', 'running') and approved_at is not null and next_run_at <= now() + interval '1 minute';

        v_workers := least(500, greatest(1, ceil(v_due / 10.0)::integer));
        for v_worker in 1..v_workers loop
          perform net.http_get(
            url := v_url,
            headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret),
            timeout_milliseconds := 58000
          );
        end loop;
      end;
      $dispatch$;
    $command$
  );
end;
$schedule_worker$;
