-- Guardian: server-only moderation events and temporary master-account send restrictions.
create table if not exists public.guardian_message_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null references public.connections(id) on delete cascade,
  body_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists guardian_message_events_repeat_idx
  on public.guardian_message_events(user_id, body_hash, created_at desc);

create table if not exists public.master_account_restrictions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reason text not null,
  source text not null,
  active boolean not null default true,
  test_mode boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.guardian_message_events enable row level security;
alter table public.master_account_restrictions enable row level security;
revoke all on public.guardian_message_events from anon, authenticated;
revoke all on public.master_account_restrictions from anon, authenticated;
grant all on public.guardian_message_events to service_role;
grant all on public.master_account_restrictions to service_role;

-- Defence in depth: even a modified client cannot insert chat messages while a
-- server-created send restriction is active. Login and other app features remain usable.
create or replace function public.guardian_block_restricted_chat_send()
returns trigger language plpgsql security definer set search_path = public
as $$
declare restriction public.master_account_restrictions%rowtype;
begin
  select * into restriction from public.master_account_restrictions
  where user_id = new.sender_id and active = true limit 1;
  if found and restriction.expires_at > now() then
    raise exception 'GUARDIAN_RESTRICTED: %', restriction.reason using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists guardian_block_restricted_chat_send on public.chat_messages;
create trigger guardian_block_restricted_chat_send
before insert on public.chat_messages
for each row execute function public.guardian_block_restricted_chat_send();
