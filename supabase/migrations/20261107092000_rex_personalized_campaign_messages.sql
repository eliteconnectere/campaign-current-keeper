alter table public.campaign_recipients
  add column if not exists message_subject text,
  add column if not exists message_body text;

create index if not exists campaign_recipients_campaign_status_created_idx
  on public.campaign_recipients (campaign_id, status, created_at);

