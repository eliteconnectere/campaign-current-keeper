-- Poll the campaign queue every minute with a fixed, bounded worker fan-out.
-- Secrets stay in Supabase Vault; they are never embedded in the cron command.
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
        v_worker integer;
      begin
        select decrypted_secret into v_url
        from vault.decrypted_secrets
        where name = 'campaign_worker_url';

        select decrypted_secret into v_secret
        from vault.decrypted_secrets
        where name = 'campaign_worker_secret';

        if coalesce(v_url, '') = '' or coalesce(v_secret, '') = '' then
          raise exception 'Campaign worker URL or secret is missing from Supabase Vault';
        end if;

        for v_worker in 1..8 loop
          perform net.http_get(
            url := v_url,
            headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret),
            timeout_milliseconds := 55000
          );
        end loop;
      end;
      $dispatch$;
    $command$
  );
end;
$schedule_worker$;
