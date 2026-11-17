-- lovable-cron-fallback-reviewed: replaces existing every-minute dispatcher; 24/7 continuous sending needs minute cadence, demand-based fan-out
select cron.unschedule('campaign-worker-dispatch');
select cron.schedule('campaign-worker-dispatch', '* * * * *', $cron$
do $dispatch$
declare
  v_url text; v_secret text; v_due integer; v_workers integer; i integer;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'campaign_worker_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'campaign_worker_secret';
  if coalesce(v_url,'') = '' or coalesce(v_secret,'') = '' then
    raise exception 'Campaign worker URL or secret is missing from Supabase Vault';
  end if;
  select count(*) into v_due from public.campaigns c
   where c.status in ('queued','running') and c.approved_at is not null
     and c.next_run_at <= now()
     and (c.worker_lease_until is null or c.worker_lease_until < now());
  if v_due = 0 then return; end if;
  v_workers := least(500, ceil(v_due / 10.0)::int);
  for i in 1..v_workers loop
    perform net.http_get(url := v_url,
      headers := jsonb_build_object('Authorization','Bearer ' || v_secret),
      timeout_milliseconds := 55000);
  end loop;
end;
$dispatch$;
$cron$);