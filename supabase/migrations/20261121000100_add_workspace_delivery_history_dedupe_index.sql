create unique index if not exists campaign_delivery_history_workspace_dedupe_idx
  on public.campaign_delivery_history (user_id, recipient_email, subject, body_hash)
  where campaign_id is null;
