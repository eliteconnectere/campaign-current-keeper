create table if not exists public.team_gmail_profile_reservations (
  reservation_id uuid primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists team_gmail_profile_reservations_owner_expiry_idx
  on public.team_gmail_profile_reservations(owner_user_id, expires_at);

alter table public.team_gmail_profile_reservations enable row level security;
revoke all on public.team_gmail_profile_reservations from public, anon, authenticated;
grant all on public.team_gmail_profile_reservations to service_role;

create or replace function public.reserve_team_gmail_profile_slot(
  p_reservation_id uuid,
  p_owner_user_id uuid,
  p_user_id uuid,
  p_plan_limit integer,
  p_personal_limit integer
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_total_profiles integer;
  v_total_reservations integer;
  v_personal_profiles integer;
  v_personal_reservations integer;
  v_now timestamptz := clock_timestamp();
begin
  if p_reservation_id is null or p_owner_user_id is null or p_user_id is null
     or p_plan_limit < 1 or p_personal_limit < 1 then
    raise exception 'Invalid Gmail profile reservation request';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_owner_user_id::text, 0));

  delete from public.team_gmail_profile_reservations
   where owner_user_id = p_owner_user_id and expires_at <= v_now;

  if exists (
    select 1 from public.team_gmail_profile_reservations
     where reservation_id = p_reservation_id
       and owner_user_id = p_owner_user_id
       and user_id = p_user_id
  ) then
    return true;
  end if;

  select count(*)::integer into v_total_profiles
    from public.gmail_profiles gp
   where gp.connector_id = 'google_mail'
     and (
       gp.user_id = p_owner_user_id
       or gp.user_id in (
         select ts.member_user_id
           from public.team_seats ts
          where ts.owner_user_id = p_owner_user_id
            and ts.status = 'active'
            and ts.member_user_id is not null
       )
     );

  select count(*)::integer into v_total_reservations
    from public.team_gmail_profile_reservations r
   where r.owner_user_id = p_owner_user_id
     and r.expires_at > v_now;

  if v_total_profiles + v_total_reservations >= p_plan_limit then
    return false;
  end if;

  select count(*)::integer into v_personal_profiles
    from public.gmail_profiles gp
   where gp.user_id = p_user_id and gp.connector_id = 'google_mail';

  select count(*)::integer into v_personal_reservations
    from public.team_gmail_profile_reservations r
   where r.owner_user_id = p_owner_user_id
     and r.user_id = p_user_id
     and r.expires_at > v_now;

  if v_personal_profiles + v_personal_reservations >= p_personal_limit then
    return false;
  end if;

  insert into public.team_gmail_profile_reservations(
    reservation_id, owner_user_id, user_id, expires_at
  ) values (
    p_reservation_id, p_owner_user_id, p_user_id, v_now + interval '20 minutes'
  );

  return true;
end;
$$;

revoke all on function public.reserve_team_gmail_profile_slot(uuid, uuid, uuid, integer, integer)
  from public, anon, authenticated;
grant execute on function public.reserve_team_gmail_profile_slot(uuid, uuid, uuid, integer, integer)
  to service_role;
