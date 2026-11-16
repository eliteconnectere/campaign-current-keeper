
create table if not exists public.user_data_erasure_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null check (status in ('countdown','cancelled','completed')),
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null,
  confirmed_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.user_data_erasure_requests enable row level security;
revoke all on public.user_data_erasure_requests from anon, authenticated;
grant select on public.user_data_erasure_requests to authenticated;
drop policy if exists "Users read own erasure request" on public.user_data_erasure_requests;
create policy "Users read own erasure request" on public.user_data_erasure_requests
for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "Users delete their own chat images" on storage.objects;
create policy "Users delete their own chat images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'chat-images'
  and exists (
    select 1 from public.chat_messages m
    where m.sender_id = (select auth.uid())
      and m.image_path = storage.objects.name
  )
);

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.start_user_data_erasure()
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare actor uuid := auth.uid(); result public.user_data_erasure_requests;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  select * into result from public.user_data_erasure_requests where user_id=actor for update;
  if found and result.status='countdown' then
    return jsonb_build_object('status',result.status,'requested_at',result.requested_at,'expires_at',result.expires_at);
  end if;
  insert into public.user_data_erasure_requests(user_id,status,requested_at,expires_at,confirmed_at,updated_at)
  values(actor,'countdown',clock_timestamp(),clock_timestamp()+interval '30 minutes',null,clock_timestamp())
  on conflict(user_id) do update set status='countdown',requested_at=excluded.requested_at,
    expires_at=excluded.expires_at,confirmed_at=null,updated_at=clock_timestamp()
  where public.user_data_erasure_requests.status in ('cancelled','completed');
  select * into result from public.user_data_erasure_requests where user_id=actor;
  if result.status <> 'countdown' then raise exception 'An erasure decision is already required'; end if;
  return jsonb_build_object('status',result.status,'requested_at',result.requested_at,'expires_at',result.expires_at);
end $$;

create or replace function private.cancel_user_data_erasure()
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare actor uuid := auth.uid(); result public.user_data_erasure_requests;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  update public.user_data_erasure_requests set status='cancelled',updated_at=clock_timestamp()
  where user_id=actor and status='countdown' returning * into result;
  if not found then raise exception 'No active erasure countdown exists'; end if;
  return jsonb_build_object('status',result.status);
end $$;

create or replace function private.confirm_user_data_erasure()
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare actor uuid := auth.uid(); result public.user_data_erasure_requests;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  select * into result from public.user_data_erasure_requests where user_id=actor for update;
  if not found or result.status <> 'countdown' then raise exception 'No active erasure request exists'; end if;
  if result.expires_at > clock_timestamp() then raise exception 'The 30-minute waiting period has not ended'; end if;

  delete from public.rex_execution_jobs where user_id=actor;
  delete from public.rex_action_approvals where user_id=actor;
  delete from public.rex_conversation_messages where user_id=actor;
  delete from public.rex_conversations where user_id=actor;
  delete from public.rex_dynamic_feature_data where user_id=actor;
  delete from public.rex_dynamic_features where user_id=actor;
  delete from public.rex_events where user_id=actor;
  delete from public.rex_memory_entries where user_id=actor;
  delete from public.rex_memory_settings where user_id=actor;
  delete from public.rex_personal_destinations where user_id=actor;
  delete from public.rex_service_registrations where owner_user_id=actor;
  delete from public.rex_service_identities where owner_user_id=actor;
  delete from public.rex_settings where user_id=actor;

  delete from public.campaign_delivery_history where user_id=actor;
  delete from public.campaigns where user_id=actor;

  delete from public.chat_message_hidden where user_id=actor;
  delete from public.chat_messages where sender_id=actor;
  delete from public.chat_profiles where user_id=actor;
  delete from public.connection_requests where sender_id=actor or receiver_id=actor;

  delete from public.gmail_connect_attempts where user_id=actor;
  delete from public.gmail_profiles where user_id=actor;
  delete from public.app_user_connections where user_id=actor;
  delete from public.user_presence where user_id=actor;

  update public.user_data_erasure_requests
    set status='completed',confirmed_at=clock_timestamp(),updated_at=clock_timestamp()
    where user_id=actor;
  return jsonb_build_object('status','completed','confirmed_at',clock_timestamp(),
    'preserved',jsonb_build_array('auth account','payments','billing and subscription entitlements',
      'send_events and sending statistics','gmail identity usage limits','gmail account penalties','team seats'));
end $$;

revoke all on function private.start_user_data_erasure() from public, anon;
revoke all on function private.cancel_user_data_erasure() from public, anon;
revoke all on function private.confirm_user_data_erasure() from public, anon;
grant execute on function private.start_user_data_erasure() to authenticated;
grant execute on function private.cancel_user_data_erasure() to authenticated;
grant execute on function private.confirm_user_data_erasure() to authenticated;

create or replace function public.start_user_data_erasure()
returns jsonb language sql security invoker
set search_path = pg_catalog, public, private, auth
as $$ select private.start_user_data_erasure(); $$;
create or replace function public.cancel_user_data_erasure()
returns jsonb language sql security invoker
set search_path = pg_catalog, public, private, auth
as $$ select private.cancel_user_data_erasure(); $$;
create or replace function public.confirm_user_data_erasure()
returns jsonb language sql security invoker
set search_path = pg_catalog, public, private, auth
as $$ select private.confirm_user_data_erasure(); $$;

revoke all on function public.start_user_data_erasure() from public, anon;
revoke all on function public.cancel_user_data_erasure() from public, anon;
revoke all on function public.confirm_user_data_erasure() from public, anon;
grant execute on function public.start_user_data_erasure() to authenticated;
grant execute on function public.cancel_user_data_erasure() to authenticated;
grant execute on function public.confirm_user_data_erasure() to authenticated;
