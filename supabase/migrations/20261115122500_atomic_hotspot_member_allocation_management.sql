create or replace function public.create_team_hotspot_invite(
  p_owner_user_id uuid,
  p_member_email text,
  p_invite_token text,
  p_max_gmail_profiles integer,
  p_plan_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.team_seats%rowtype;
  v_seat public.team_seats%rowtype;
  v_owner_profiles integer;
  v_owner_reservations integer;
  v_member_allocated integer;
  v_remaining integer;
begin
  if p_owner_user_id is null or p_member_email is null or p_invite_token is null
     or p_max_gmail_profiles < 1 or p_plan_limit < 1 then
    raise exception 'Invalid hotspot invitation request';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_owner_user_id::text, 0));

  select * into v_existing
    from public.team_seats
   where owner_user_id = p_owner_user_id
     and lower(member_email) = lower(trim(p_member_email))
   for update;

  if found and v_existing.status <> 'revoked' then
    return jsonb_build_object('ok', false, 'error', 'That email is already added.');
  end if;

  select count(*)::integer into v_owner_profiles
    from public.gmail_profiles
   where user_id = p_owner_user_id and connector_id = 'google_mail';

  select count(*)::integer into v_owner_reservations
    from public.team_gmail_profile_reservations
   where owner_user_id = p_owner_user_id
     and user_id = p_owner_user_id
     and expires_at > clock_timestamp();

  select coalesce(sum(greatest(1, max_gmail_profiles)), 0)::integer
    into v_member_allocated
    from public.team_seats
   where owner_user_id = p_owner_user_id
     and status in ('pending', 'active');

  v_remaining := greatest(0, p_plan_limit - v_owner_profiles - v_owner_reservations - v_member_allocated);
  if p_max_gmail_profiles > v_remaining then
    return jsonb_build_object(
      'ok', false,
      'error', format('Only %s Gmail slot(s) remain in your shared subscription. Reduce another member allocation or free slots first.', v_remaining)
    );
  end if;

  if v_existing.id is not null then
    update public.team_seats
       set member_email = lower(trim(p_member_email)),
           member_user_id = null,
           status = 'pending',
           invite_token = p_invite_token,
           accepted_at = null,
           max_gmail_profiles = p_max_gmail_profiles,
           share_snippets = false
     where id = v_existing.id
     returning * into v_seat;
  else
    insert into public.team_seats(
      owner_user_id, member_email, member_user_id, status,
      invite_token, max_gmail_profiles, share_snippets
    ) values (
      p_owner_user_id, lower(trim(p_member_email)), null, 'pending',
      p_invite_token, p_max_gmail_profiles, false
    )
    returning * into v_seat;
  end if;

  return jsonb_build_object('ok', true, 'seat', to_jsonb(v_seat));
end;
$$;

create or replace function public.update_team_hotspot_gmail_allocation(
  p_owner_user_id uuid,
  p_seat_id uuid,
  p_max_gmail_profiles integer,
  p_plan_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_seat public.team_seats%rowtype;
  v_owner_profiles integer;
  v_owner_reservations integer;
  v_other_allocated integer;
  v_member_profiles integer;
  v_member_reservations integer;
begin
  if p_owner_user_id is null or p_seat_id is null
     or p_max_gmail_profiles < 1 or p_plan_limit < 1 then
    raise exception 'Invalid hotspot allocation update';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_owner_user_id::text, 0));

  select * into v_seat
    from public.team_seats
   where id = p_seat_id
     and owner_user_id = p_owner_user_id
     and status in ('pending', 'active')
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'That hotspot member no longer exists.');
  end if;

  select count(*)::integer into v_owner_profiles
    from public.gmail_profiles
   where user_id = p_owner_user_id and connector_id = 'google_mail';

  select count(*)::integer into v_owner_reservations
    from public.team_gmail_profile_reservations
   where owner_user_id = p_owner_user_id
     and user_id = p_owner_user_id
     and expires_at > clock_timestamp();

  select coalesce(sum(greatest(1, max_gmail_profiles)), 0)::integer
    into v_other_allocated
    from public.team_seats
   where owner_user_id = p_owner_user_id
     and status in ('pending', 'active')
     and id <> p_seat_id;

  if v_owner_profiles + v_owner_reservations + v_other_allocated + p_max_gmail_profiles > p_plan_limit then
    return jsonb_build_object(
      'ok', false,
      'error', format('This change would exceed your shared plan. Maximum allocation for this member is %s Gmail(s).', greatest(1, p_plan_limit - v_owner_profiles - v_owner_reservations - v_other_allocated))
    );
  end if;

  if v_seat.member_user_id is not null then
    select count(*)::integer into v_member_profiles
      from public.gmail_profiles
     where user_id = v_seat.member_user_id and connector_id = 'google_mail';

    select count(*)::integer into v_member_reservations
      from public.team_gmail_profile_reservations
     where owner_user_id = p_owner_user_id
       and user_id = v_seat.member_user_id
       and expires_at > clock_timestamp();

    if v_member_profiles + v_member_reservations > p_max_gmail_profiles then
      return jsonb_build_object('ok', false, 'error', 'That member already has more connected or pending Gmails than this new limit.');
    end if;
  end if;

  update public.team_seats
     set max_gmail_profiles = p_max_gmail_profiles
   where id = p_seat_id
   returning * into v_seat;

  return jsonb_build_object('ok', true, 'seat', to_jsonb(v_seat));
end;
$$;

create or replace function public.revoke_team_hotspot_seat(
  p_owner_user_id uuid,
  p_seat_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member_user_id uuid;
begin
  if p_owner_user_id is null or p_seat_id is null then
    raise exception 'Invalid hotspot revocation request';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_owner_user_id::text, 0));

  update public.team_seats
     set status = 'revoked'
   where id = p_seat_id
     and owner_user_id = p_owner_user_id
   returning member_user_id into v_member_user_id;

  if not found then
    return false;
  end if;

  if v_member_user_id is not null then
    delete from public.team_gmail_profile_reservations
     where owner_user_id = p_owner_user_id
       and user_id = v_member_user_id;
  end if;

  return true;
end;
$$;

revoke all on function public.create_team_hotspot_invite(uuid, text, text, integer, integer)
  from public, anon, authenticated;
revoke all on function public.update_team_hotspot_gmail_allocation(uuid, uuid, integer, integer)
  from public, anon, authenticated;
revoke all on function public.revoke_team_hotspot_seat(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.create_team_hotspot_invite(uuid, text, text, integer, integer)
  to service_role;
grant execute on function public.update_team_hotspot_gmail_allocation(uuid, uuid, integer, integer)
  to service_role;
grant execute on function public.revoke_team_hotspot_seat(uuid, uuid)
  to service_role;
