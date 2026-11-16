create table if not exists public.chat_energy_pools (
  owner_user_id uuid primary key references auth.users(id) on delete cascade,
  energy numeric(5,2) not null default 100 check (energy >= 0 and energy <= 100),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_energy_sessions (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  active_since timestamptz not null default now(),
  active_until timestamptz not null default now(),
  primary key (owner_user_id, user_id)
);

create index if not exists chat_energy_sessions_owner_active_idx
  on public.chat_energy_sessions(owner_user_id, active_until);

alter table public.chat_energy_pools enable row level security;
alter table public.chat_energy_sessions enable row level security;

revoke all on public.chat_energy_pools from public, anon, authenticated;
revoke all on public.chat_energy_sessions from public, anon, authenticated;
grant all on public.chat_energy_pools to service_role;
grant all on public.chat_energy_sessions to service_role;

create or replace function public.sync_shared_chat_energy(
  p_owner_user_id uuid,
  p_user_id uuid,
  p_active boolean
)
returns numeric
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_updated_at timestamptz;
  v_energy numeric(5,2);
  v_elapsed_seconds numeric;
  v_active_seconds numeric;
  v_idle_seconds numeric;
begin
  if p_owner_user_id is null or p_user_id is null or p_active is null then
    raise exception 'Invalid chat energy sync request';
  end if;

  insert into public.chat_energy_pools(owner_user_id)
  values (p_owner_user_id)
  on conflict (owner_user_id) do nothing;

  select energy, updated_at
    into v_energy, v_updated_at
    from public.chat_energy_pools
   where owner_user_id = p_owner_user_id
   for update;

  insert into public.chat_energy_sessions(owner_user_id, user_id, active_since, active_until)
  values (
    p_owner_user_id,
    p_user_id,
    v_now,
    case when p_active then v_now + interval '30 seconds' else v_now end
  )
  on conflict (owner_user_id, user_id) do update
    set active_since = case
          when p_active and public.chat_energy_sessions.active_until <= v_now then v_now
          else public.chat_energy_sessions.active_since
        end,
        active_until = case when p_active then v_now + interval '30 seconds' else v_now end;

  v_elapsed_seconds := greatest(0, extract(epoch from (v_now - v_updated_at)));

  select coalesce(sum(extract(epoch from (upper(rng) - lower(rng)))), 0)
    into v_active_seconds
    from (
      select range_agg(
        tstzrange(
          greatest(active_since, v_updated_at),
          least(active_until, v_now),
          '[)'
        )
      ) as active_ranges
      from public.chat_energy_sessions
      where owner_user_id = p_owner_user_id
        and active_until > v_updated_at
        and active_since < v_now
        and least(active_until, v_now) > greatest(active_since, v_updated_at)
    ) merged
    cross join lateral unnest(merged.active_ranges) as ranges(rng);

  v_active_seconds := least(v_elapsed_seconds, greatest(0, v_active_seconds));
  v_idle_seconds := greatest(0, v_elapsed_seconds - v_active_seconds);

  v_energy := greatest(
    0,
    least(
      100,
      v_energy
        - (v_active_seconds * 100 / 7200)
        + (v_idle_seconds * 100 / 18000)
    )
  );

  update public.chat_energy_pools
     set energy = round(v_energy, 2),
         updated_at = v_now
   where owner_user_id = p_owner_user_id;

  return round(v_energy, 2);
end;
$$;

revoke all on function public.sync_shared_chat_energy(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.sync_shared_chat_energy(uuid, uuid, boolean) to service_role;
