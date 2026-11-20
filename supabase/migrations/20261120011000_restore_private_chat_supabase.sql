-- Restore Private Chat tables, RLS, message actions, private image storage, and realtime.
create table if not exists public.chat_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check(length(btrim(display_name)) between 2 and 60),
 username text not null check(username ~ '^[a-z0-9_.]{3,24}$'),
 eligible boolean not null default false,
 updated_at timestamptz not null default now()
);
create unique index if not exists chat_profiles_username_lower_unique on public.chat_profiles(lower(username));
create index if not exists chat_profiles_eligible_username_idx on public.chat_profiles(eligible,username) where eligible;

create table if not exists public.connection_requests (
 id uuid primary key default gen_random_uuid(),
 sender_id uuid not null references auth.users(id) on delete cascade,
 receiver_id uuid not null references auth.users(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','accepted','declined')),
 created_at timestamptz not null default now(),
 responded_at timestamptz,
 check(sender_id<>receiver_id)
);
create unique index if not exists connection_requests_pending_pair_unique on public.connection_requests(sender_id,receiver_id) where status='pending';
create index if not exists connection_requests_receiver_status_idx on public.connection_requests(receiver_id,status,created_at desc);
create index if not exists connection_requests_sender_status_idx on public.connection_requests(sender_id,status,created_at desc);

create table if not exists public.connections (
 id uuid primary key default gen_random_uuid(),
 user_a uuid not null references auth.users(id) on delete cascade,
 user_b uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 check(user_a<user_b),
 unique(user_a,user_b)
);
create index if not exists connections_user_b_created_idx on public.connections(user_b,created_at desc);

create table if not exists public.chat_messages (
 id uuid primary key default gen_random_uuid(),
 connection_id uuid not null references public.connections(id) on delete cascade,
 sender_id uuid not null references auth.users(id) on delete cascade,
 kind text not null default 'text' check(kind in ('text','image')),
 body text,
 image_path text,
 created_at timestamptz not null default now(),
 delivered_at timestamptz,
 read_at timestamptz,
 reply_to uuid references public.chat_messages(id) on delete set null,
 edited_at timestamptz,
 deleted_at timestamptz,
 check((kind='text' and body is not null and length(body)<=20000) or (kind='image' and (image_path is not null or body is not null)))
);
create index if not exists chat_messages_connection_created_idx on public.chat_messages(connection_id,created_at desc);
create index if not exists chat_messages_unread_idx on public.chat_messages(connection_id,created_at) where read_at is null;

create table if not exists public.chat_message_hidden (
 user_id uuid not null references auth.users(id) on delete cascade,
 message_id uuid not null references public.chat_messages(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(user_id,message_id)
);
create index if not exists chat_message_hidden_message_idx on public.chat_message_hidden(message_id);

create or replace function public.chat_is_connection_member(p_connection_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.connections c where c.id=p_connection_id and auth.uid() in(c.user_a,c.user_b));
$$;
revoke all on function public.chat_is_connection_member(uuid) from public,anon;
grant execute on function public.chat_is_connection_member(uuid) to authenticated,service_role;

alter table public.chat_profiles enable row level security;
alter table public.connection_requests enable row level security;
alter table public.connections enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_message_hidden enable row level security;

drop policy if exists chat_profiles_search_eligible on public.chat_profiles;
create policy chat_profiles_search_eligible on public.chat_profiles for select to authenticated using(eligible or user_id=auth.uid());
drop policy if exists chat_profiles_insert_self on public.chat_profiles;
create policy chat_profiles_insert_self on public.chat_profiles for insert to authenticated with check(user_id=auth.uid());
drop policy if exists chat_profiles_update_self on public.chat_profiles;
create policy chat_profiles_update_self on public.chat_profiles for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

drop policy if exists connection_requests_participant_read on public.connection_requests;
create policy connection_requests_participant_read on public.connection_requests for select to authenticated using(auth.uid() in(sender_id,receiver_id));
drop policy if exists connection_requests_sender_insert on public.connection_requests;
create policy connection_requests_sender_insert on public.connection_requests for insert to authenticated with check(sender_id=auth.uid() and exists(select 1 from public.chat_profiles p where p.user_id=receiver_id and p.eligible));
drop policy if exists connection_requests_receiver_update on public.connection_requests;
create policy connection_requests_receiver_update on public.connection_requests for update to authenticated using(receiver_id=auth.uid() and status='pending') with check(receiver_id=auth.uid() and status in('accepted','declined'));
drop policy if exists connection_requests_sender_delete on public.connection_requests;
create policy connection_requests_sender_delete on public.connection_requests for delete to authenticated using(sender_id=auth.uid() and status='pending');

drop policy if exists connections_member_read on public.connections;
create policy connections_member_read on public.connections for select to authenticated using(auth.uid() in(user_a,user_b));
drop policy if exists chat_messages_member_read on public.chat_messages;
create policy chat_messages_member_read on public.chat_messages for select to authenticated using(public.chat_is_connection_member(connection_id));
drop policy if exists chat_messages_sender_insert on public.chat_messages;
create policy chat_messages_sender_insert on public.chat_messages for insert to authenticated with check(sender_id=auth.uid() and public.chat_is_connection_member(connection_id));
drop policy if exists chat_message_hidden_self_read on public.chat_message_hidden;
create policy chat_message_hidden_self_read on public.chat_message_hidden for select to authenticated using(user_id=auth.uid());
drop policy if exists chat_message_hidden_self_insert on public.chat_message_hidden;
create policy chat_message_hidden_self_insert on public.chat_message_hidden for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from public.chat_messages m where m.id=message_id and public.chat_is_connection_member(m.connection_id)));

grant select,insert,update on public.chat_profiles to authenticated;
grant select,insert,update,delete on public.connection_requests to authenticated;
grant select on public.connections to authenticated;
grant select,insert on public.chat_messages to authenticated;
grant select,insert on public.chat_message_hidden to authenticated;
grant all on public.chat_profiles,public.connection_requests,public.connections,public.chat_messages,public.chat_message_hidden to service_role;

create or replace function public.mark_chat_delivered()
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 update public.chat_messages m set delivered_at=coalesce(m.delivered_at,clock_timestamp())
 where m.sender_id<>auth.uid() and m.read_at is null and public.chat_is_connection_member(m.connection_id);
end; $$;
create or replace function public.mark_chat_read(_cid uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or not public.chat_is_connection_member(_cid) then raise exception 'Not allowed'; end if;
 update public.chat_messages set delivered_at=coalesce(delivered_at,clock_timestamp()),read_at=coalesce(read_at,clock_timestamp())
 where connection_id=_cid and sender_id<>auth.uid() and read_at is null;
end; $$;
create or replace function public.edit_chat_message(_id uuid,_body text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or length(btrim(_body))=0 or length(_body)>20000 then raise exception 'Invalid message'; end if;
 update public.chat_messages set body=_body,edited_at=clock_timestamp()
 where id=_id and sender_id=auth.uid() and deleted_at is null and kind='text' and created_at>=clock_timestamp()-interval '15 minutes';
 if not found then raise exception 'Message can no longer be edited'; end if;
end; $$;
create or replace function public.hide_chat_message(_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or not exists(select 1 from public.chat_messages m where m.id=_id and public.chat_is_connection_member(m.connection_id)) then raise exception 'Not allowed'; end if;
 insert into public.chat_message_hidden(user_id,message_id) values(auth.uid(),_id) on conflict do nothing;
end; $$;
create or replace function public.delete_chat_message_everyone(_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 update public.chat_messages set body=null,image_path=null,deleted_at=clock_timestamp() where id=_id and sender_id=auth.uid() and deleted_at is null;
 if not found then raise exception 'Message cannot be deleted'; end if;
end; $$;
revoke all on function public.mark_chat_delivered() from public,anon;
revoke all on function public.mark_chat_read(uuid) from public,anon;
revoke all on function public.edit_chat_message(uuid,text) from public,anon;
revoke all on function public.hide_chat_message(uuid) from public,anon;
revoke all on function public.delete_chat_message_everyone(uuid) from public,anon;
grant execute on function public.mark_chat_delivered() to authenticated;
grant execute on function public.mark_chat_read(uuid) to authenticated;
grant execute on function public.edit_chat_message(uuid,text) to authenticated;
grant execute on function public.hide_chat_message(uuid) to authenticated;
grant execute on function public.delete_chat_message_everyone(uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('chat-images','chat-images',false,5242880,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists chat_images_member_read on storage.objects;
create policy chat_images_member_read on storage.objects for select to authenticated using(bucket_id='chat-images' and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$' and public.chat_is_connection_member(((storage.foldername(name))[1])::uuid));
drop policy if exists chat_images_member_insert on storage.objects;
create policy chat_images_member_insert on storage.objects for insert to authenticated with check(bucket_id='chat-images' and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$' and public.chat_is_connection_member(((storage.foldername(name))[1])::uuid));

do $$
begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='chat_messages') then alter publication supabase_realtime add table public.chat_messages; end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='connection_requests') then alter publication supabase_realtime add table public.connection_requests; end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='connections') then alter publication supabase_realtime add table public.connections; end if;
end $$;
notify pgrst,'reload schema';
