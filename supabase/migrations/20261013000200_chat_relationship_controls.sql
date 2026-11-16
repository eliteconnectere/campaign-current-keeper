alter table public.chat_profiles
  add column if not exists chat_energy_updated_at timestamptz not null default now();

create or replace function public.cancel_connection_request(_request_id uuid)
returns void
language plpgsql
security invoker
as $$
begin
  delete from public.connection_requests
  where id = _request_id
    and sender_id = auth.uid()
    and status = 'pending';
end;
$$;

create or replace function public.remove_connection(_connection_id uuid)
returns void
language plpgsql
security invoker
as $$
begin
  if not public.is_connection_member(_connection_id) then
    raise exception 'Not a connection member';
  end if;
  delete from public.connections where id = _connection_id;
end;
$$;

create or replace function public.delete_chat_history(_connection_id uuid)
returns void
language plpgsql
security invoker
as $$
begin
  if not public.is_connection_member(_connection_id) then
    raise exception 'Not a connection member';
  end if;
  delete from public.chat_messages where connection_id = _connection_id;
end;
$$;

grant execute on function public.cancel_connection_request(uuid) to authenticated;
grant execute on function public.remove_connection(uuid) to authenticated;
grant execute on function public.delete_chat_history(uuid) to authenticated;

revoke execute on function public.cancel_connection_request(uuid) from anon, public;
revoke execute on function public.remove_connection(uuid) from anon, public;
revoke execute on function public.delete_chat_history(uuid) from anon, public;
