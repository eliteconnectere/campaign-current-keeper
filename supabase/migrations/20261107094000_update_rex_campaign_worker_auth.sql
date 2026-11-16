select cron.unschedule(jobid) from cron.job where jobname='rex-campaign-worker';
select cron.schedule(
  'rex-campaign-worker',
  '* * * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'campaign_worker_url' limit 1),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'campaign_worker_secret' limit 1),
        'X-Campaign-Worker-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'campaign_worker_secret' limit 1)
      ),
      body := '{}'::jsonb
    );
  $$
);