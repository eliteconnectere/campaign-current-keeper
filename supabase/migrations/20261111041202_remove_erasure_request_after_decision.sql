
create or replace function private.cancel_user_data_erasure()
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare actor uuid := auth.uid(); result public.user_data_erasure_requests;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  delete from public.user_data_erasure_requests
  where user_id=actor and status='countdown'
  returning * into result;
  if not found then raise exception 'No active erasure countdown exists'; end if;
  return jsonb_build_object('status','cancelled');
end $$;

create or replace function private.confirm_user_data_erasure()
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare actor uuid := auth.uid(); result public.user_data_erasure_requests; confirmed_at_value timestamptz;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  select * into result from public.user_data_erasure_requests where user_id=actor for update;
  if not found or result.status <> 'countdown' then raise exception 'No active erasure request exists'; end if;
  if result.expires_at > clock_timestamp() then raise exception 'The 30-minute waiting period has not ended'; end if;
  confirmed_at_value := clock_timestamp();

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

  insert into public.chat_message_hidden(user_id,message_id)
  select actor,m.id
  from public.chat_messages m
  join public.connections c on c.id=m.connection_id
  where c.user_a=actor or c.user_b=actor
  on conflict(user_id,message_id) do nothing;
  delete from public.chat_messages where sender_id=actor;
  delete from public.chat_profiles where user_id=actor;
  delete from public.connection_requests where sender_id=actor or receiver_id=actor;

  delete from public.gmail_connect_attempts where user_id=actor;
  delete from public.gmail_profiles where user_id=actor;
  delete from public.app_user_connections where user_id=actor;
  delete from public.user_presence where user_id=actor;

  delete from public.user_data_erasure_requests where user_id=actor;
  return jsonb_build_object('status','completed','confirmed_at',confirmed_at_value,
    'preserved',jsonb_build_array('auth account','payments','billing and subscription entitlements',
      'send_events and sending statistics','gmail identity usage limits','gmail account penalties','team seats',
      'other participants shared-message records'));
end $$;
