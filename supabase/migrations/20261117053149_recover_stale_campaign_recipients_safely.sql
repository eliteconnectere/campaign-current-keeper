create or replace function public.claim_campaign_recipients(
  p_campaign_id uuid,
  p_limit integer default 6,
  p_now timestamp with time zone default now()
)
returns setof public.campaign_recipients
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if p_limit < 1 or p_limit > 100 then
    raise exception 'p_limit must be between 1 and 100';
  end if;

  -- Reconcile recipient rows left in "sending" after a worker was terminated.
  -- If the Gmail audit ledger proves delivery, finish the row as sent.
  update public.campaign_recipients r
  set status = 'sent',
      sent_at = h.sent_at,
      last_error = null,
      updated_at = p_now
  from public.campaign_delivery_history h
  where r.campaign_id = p_campaign_id
    and r.status = 'sending'
    and r.updated_at <= p_now - interval '10 minutes'
    and h.campaign_id = r.campaign_id
    and lower(h.recipient_email) = lower(r.email);

  -- If Gmail acceptance cannot be confirmed, do not retry automatically.
  -- This conservative outcome avoids duplicate delivery after a process crash.
  update public.campaign_recipients r
  set status = 'failed',
      last_error = 'The worker stopped during delivery and Gmail acceptance could not be confirmed. Automatic retry was blocked to prevent a duplicate. Check the sender mailbox before manually retrying.',
      updated_at = p_now
  where r.campaign_id = p_campaign_id
    and r.status = 'sending'
    and r.updated_at <= p_now - interval '10 minutes'
    and not exists (
      select 1
      from public.campaign_delivery_history h
      where h.campaign_id = r.campaign_id
        and lower(h.recipient_email) = lower(r.email)
    );

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
$function$;
