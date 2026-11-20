-- True rolling 24-hour Gmail identity send counters. Each send ages out 24h after its own timestamp.
create table if not exists public.gmail_identity_send_events (
  id uuid primary key default gen_random_uuid(),
  email_key text not null,
  sent_at timestamptz not null default clock_timestamp()
);
create index if not exists gmail_identity_send_events_email_sent_idx on public.gmail_identity_send_events(email_key,sent_at desc);
alter table public.gmail_identity_send_events enable row level security;
revoke all on public.gmail_identity_send_events from public,anon,authenticated;
grant all on public.gmail_identity_send_events to service_role;
insert into public.gmail_identity_send_events(email_key,sent_at)
select lower(btrim(gmail_profile_email)),sent_at from public.campaign_delivery_history
where gmail_profile_email is not null and sent_at>=clock_timestamp()-interval '24 hours';

create or replace function public.get_gmail_identity_usage(p_email_keys text[])
returns table(email_key text,daily_limit integer,sent_count integer,sent_date date,exhausted_until timestamptz,window_started_at timestamptz)
language sql security definer set search_path=public,pg_temp as $$
 select u.email_key,u.daily_limit,
   (select count(*)::integer from public.gmail_identity_send_events e where e.email_key=u.email_key and e.sent_at>=clock_timestamp()-interval '24 hours'),
   u.sent_date,
   case when u.exhausted_until>clock_timestamp() then u.exhausted_until else null end,
   u.window_started_at
 from public.gmail_identity_usage u where u.email_key=any(coalesce(p_email_keys,array[]::text[]));
$$;

create or replace function public.record_gmail_identity_send(p_email_key text)
returns table(used integer,daily_limit integer,exhausted boolean)
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_row public.gmail_identity_usage%rowtype; v_now timestamptz:=clock_timestamp(); v_used integer; v_cooling boolean;
begin
 select * into v_row from public.gmail_identity_usage where email_key=lower(btrim(p_email_key)) for update;
 if not found then raise exception 'Gmail identity usage row not found'; end if;
 insert into public.gmail_identity_send_events(email_key,sent_at) values(v_row.email_key,v_now);
 select count(*)::integer into v_used from public.gmail_identity_send_events where email_key=v_row.email_key and sent_at>=v_now-interval '24 hours';
 v_cooling:=v_row.exhausted_until is not null and v_row.exhausted_until>v_now;
 update public.gmail_identity_usage set sent_count=v_used,sent_date=(v_now at time zone 'utc')::date,
   window_started_at=coalesce((select min(sent_at) from public.gmail_identity_send_events where email_key=v_row.email_key and sent_at>=v_now-interval '24 hours'),v_now),
   exhausted_until=case when v_cooling then v_row.exhausted_until when v_used>=v_row.daily_limit then v_now+interval '24 hours' else null end
 where email_key=v_row.email_key;
 return query select v_used,v_row.daily_limit,(v_used>=v_row.daily_limit or v_cooling);
end; $$;
revoke all on function public.get_gmail_identity_usage(text[]) from public,anon,authenticated;
revoke all on function public.record_gmail_identity_send(text) from public,anon,authenticated;
grant execute on function public.get_gmail_identity_usage(text[]) to service_role;
grant execute on function public.record_gmail_identity_send(text) to service_role;
notify pgrst,'reload schema';
