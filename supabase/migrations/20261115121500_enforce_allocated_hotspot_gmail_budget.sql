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
  v_owner_profiles integer;
  v_member_allocated integer;
  v_owner_reservations integer;
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

  if p_user_id <> p_owner_user_id and not exists (
    select 1 from public.team_seats
     where owner_user_id = p_owner_user_id
       and member_user_id = p_user_id
       and status = 'active'
  ) then
    return false;
  end if;

  select count(*)::integer into v_owner_profiles
    from public.gmail_profiles
   where user_id = p_owner_user_id and connector_id = 'google_mail';

  select coalesce(sum(greatest(1, max_gmail_profiles)), 0)::integer
    into v_member_allocated
    from public.team_seats
   where owner_user_id = p_owner_user_id
     and status in ('pending', 'active');

  select count(*)::integer into v_owner_reservations
    from public.team_gmail_profile_reservations
   where owner_user_id = p_owner_user_id
     and user_id = p_owner_user_id
     and expires_at > v_now;

  if v_owner_profiles + v_member_allocated + v_owner_reservations > p_plan_limit then
    return false;
  end if;

  if p_user_id = p_owner_user_id then
    if v_owner_profiles + v_member_allocated + v_owner_reservations >= p_plan_limit then
      return false;
    end if;
  else
    select count(*)::integer into v_personal_profiles
      from public.gmail_profiles
     where user_id = p_user_id and connector_id = 'google_mail';

    select count(*)::integer into v_personal_reservations
      from public.team_gmail_profile_reservations
     where owner_user_id = p_owner_user_id
       and user_id = p_user_id
       and expires_at > v_now;

    if v_personal_profiles + v_personal_reservations >= p_personal_limit then
      return false;
    end if;
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
