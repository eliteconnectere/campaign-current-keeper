-- Keep entitlement flags and connection mutations server-controlled.
revoke all on public.chat_profiles,public.connection_requests,public.connections,public.chat_messages,public.chat_message_hidden from public,anon,authenticated;
grant select on public.chat_profiles to authenticated;
grant select on public.connection_requests to authenticated;
grant select on public.connections to authenticated;
grant select,insert on public.chat_messages to authenticated;
grant select on public.chat_message_hidden to authenticated;
grant all on public.chat_profiles,public.connection_requests,public.connections,public.chat_messages,public.chat_message_hidden to service_role;
drop policy if exists connection_requests_sender_insert on public.connection_requests;
create policy connection_requests_sender_insert on public.connection_requests for insert to authenticated
with check(sender_id=auth.uid() and status='pending' and exists(select 1 from public.chat_profiles p where p.user_id=receiver_id and p.eligible));
notify pgrst,'reload schema';