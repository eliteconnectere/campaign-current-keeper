create table if not exists public.campaign_delivery_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  recipient_email text not null,
  subject text not null,
  body_hash text not null,
  gmail_profile_email text,
  sent_at timestamptz not null default now(),
  campaign_id uuid references public.campaigns(id) on delete set null
);

create unique index if not exists campaign_delivery_history_dedupe_idx
  on public.campaign_delivery_history (user_id, recipient_email, subject, body_hash);

create index if not exists campaign_delivery_history_campaign_idx
  on public.campaign_delivery_history (campaign_id);

alter table public.campaign_delivery_history enable row level security;

create policy "Users can view their delivery history"
  on public.campaign_delivery_history for select
  to authenticated
  using (auth.uid() = user_id);

grant all on public.campaign_delivery_history to service_role;
