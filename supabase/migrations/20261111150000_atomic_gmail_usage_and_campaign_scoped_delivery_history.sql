-- Keep delivery history scoped to its campaign. A previously sent message in a
-- different campaign must never suppress a legitimate later campaign.
drop index if exists public.campaign_delivery_history_dedupe_idx;
create unique index campaign_delivery_history_campaign_dedupe_idx
  on public.campaign_delivery_history (campaign_id, user_id, recipient_email, subject, body_hash)
  where campaign_id is not null;

-- Serialize Gmail usage updates so overlapping campaign workers cannot lose
-- increments through a read-then-write race.
create or replace function public.record_gmail_identity_send(p_email_key text)
returns table (used integer, daily_limit integer, exhausted boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.gmail_identity_usage%rowtype;
  v_now timestamptz := clock_timestamp();
  v_cooling boolean;
  v_reset boolean;
  v_used integer;
begin
  select * into v_row
  from public.gmail_identity_usage
  where email_key = p_email_key
  for update;

  if not found then
    raise exception 'Gmail identity usage row not found';
  end if;

  v_cooling := v_row.exhausted_until is not null and v_row.exhausted_until > v_now;
  v_reset := v_row.window_started_at <= v_now - interval '24 hours' and not v_cooling;
  v_used := (case when v_reset then 0 else v_row.sent_count end) + 1;

  update public.gmail_identity_usage
  set sent_count = v_used,
      sent_date = (v_now at time zone 'utc')::date,
      window_started_at = case when v_reset then v_now else v_row.window_started_at end,
      exhausted_until = case
        when v_used >= v_row.daily_limit then v_now + interval '24 hours'
        when v_cooling then v_row.exhausted_until
        else null
      end
  where email_key = p_email_key;

  return query
  select v_used, v_row.daily_limit, (v_used >= v_row.daily_limit);
end;
$$;

revoke all on function public.record_gmail_identity_send(text) from public, anon, authenticated;
grant execute on function public.record_gmail_identity_send(text) to service_role;
