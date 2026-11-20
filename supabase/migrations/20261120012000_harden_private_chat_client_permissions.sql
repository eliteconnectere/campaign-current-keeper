-- Restrict client-writable chat profile/request columns; entitlement flags remain server-controlled.
revoke insert,update on public.chat_profiles from authenticated;
grant select on public.chat_profiles to authenticated;
grant insert(user_id,display_name,username) on public.chat_profiles to authenticated;
grant update(display_name,username,updated_at) on public.chat_profiles to authenticated;
drop policy if exists connection_requests_sender_insert on public.connection_requests;
create policy connection_requests_sender_insert on public.connection_requests for insert to authenticated
with check(sender_id=auth.uid() and status='pending' and exists(select 1 from public.chat_profiles p where p.user_id=receiver_id and p.eligible));
revoke update on public.connection_requests from authenticated;
grant update(status,responded_at) on public.connection_requests to authenticated;
notify pgrst,'reload schema';