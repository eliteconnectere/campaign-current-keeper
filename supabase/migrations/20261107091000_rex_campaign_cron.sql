-- Rex campaign worker scheduling.
-- The worker authentication value and endpoint are stored separately in Supabase Vault.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'rex-campaign-worker',
  '* * * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'campaign_worker_url' limit 1),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'campaign_worker_secret' limit 1)
      ),
      body := '{}'::jsonb
    );
  $$
);
