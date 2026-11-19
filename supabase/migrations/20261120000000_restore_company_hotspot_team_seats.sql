-- Restore the missing Hotspot / Company Team Seats persistence and RPC layer.
-- Existing campaign, billing, Gmail, and user data are not modified.
create table if not exists public.team_seats (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  member_email text not null,
  member_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','active','revoked')),
  invite_token text not null unique,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  max_gmail_profiles integer not null default 1 check (max_gmail_profiles between 1 and 75),
  share_snippets boolean not null default false,
  constraint team_seats_member_email_nonempty check (length(btrim(member_email)) > 3)
);
create index if not exists team_seats_owner_status_created_idx on public.team_seats(owner_user_id,status,created_at);
create index if not exists team_seats_member_user_status_idx on public.team_seats(member_user_id,status);
create unique index if not exists team_seats_owner_email_active_unique on public.team_seats(owner_user_id,lower(member_email)) where status in ('pending','active');
alter table public.team_seats enable row level security;

create or replace function public.create_team_hotspot_invite(p_owner_user_id uuid,p_member_email text,p_invite_token text,p_max_gmail_profiles integer,p_plan_limit integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_email text:=lower(btrim(p_member_email)); v_cap integer:=greatest(1,least(75,coalesce(p_max_gmail_profiles,1))); v_plan integer:=greatest(1,coalesce(p_plan_limit,1)); v_profiles integer; v_reservations integer; v_allocated integer; v_seat public.team_seats;
begin
 if p_owner_user_id is null or p_invite_token is null or length(p_invite_token)<16 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then return jsonb_build_object('ok',false,'error','Invalid team invitation details.'); end if;
 if v_cap>v_plan then return jsonb_build_object('ok',false,'error','The Gmail allocation exceeds the owner plan limit.'); end if;
 perform pg_advisory_xact_lock(hashtextextended(p_owner_user_id::text,0));
 if exists(select 1 from public.team_seats where owner_user_id=p_owner_user_id and lower(member_email)=v_email and status in ('pending','active')) then return jsonb_build_object('ok',false,'error','That email is already added.'); end if;
 delete from public.team_gmail_profile_reservations where owner_user_id=p_owner_user_id and expires_at<=clock_timestamp();
 select count(*) into v_profiles from public.gmail_profiles where user_id=p_owner_user_id and connector_id='google_mail';
 select count(*) into v_reservations from public.team_gmail_profile_reservations where owner_user_id=p_owner_user_id and expires_at>clock_timestamp();
 select coalesce(sum(max_gmail_profiles),0) into v_allocated from public.team_seats where owner_user_id=p_owner_user_id and status in ('pending','active');
 if v_profiles+v_reservations+v_allocated+v_cap>v_plan then return jsonb_build_object('ok',false,'error','Not enough unallocated Gmail slots remain on the owner plan.'); end if;
 insert into public.team_seats(owner_user_id,member_email,invite_token,max_gmail_profiles,status) values(p_owner_user_id,v_email,p_invite_token,v_cap,'pending') returning * into v_seat;
 return jsonb_build_object('ok',true,'seat',to_jsonb(v_seat));
end; $$;

create or replace function public.update_team_hotspot_gmail_allocation(p_owner_user_id uuid,p_seat_id uuid,p_max_gmail_profiles integer,p_plan_limit integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_cap integer:=greatest(1,least(75,coalesce(p_max_gmail_profiles,1))); v_plan integer:=greatest(1,coalesce(p_plan_limit,1)); v_profiles integer; v_reservations integer; v_other_allocated integer; v_seat public.team_seats;
begin
 if p_owner_user_id is null or p_seat_id is null or v_cap>v_plan then return jsonb_build_object('ok',false,'error','Invalid Gmail allocation.'); end if;
 perform pg_advisory_xact_lock(hashtextextended(p_owner_user_id::text,0));
 if not exists(select 1 from public.team_seats where id=p_seat_id and owner_user_id=p_owner_user_id and status in ('pending','active')) then return jsonb_build_object('ok',false,'error','That team seat no longer exists.'); end if;
 delete from public.team_gmail_profile_reservations where owner_user_id=p_owner_user_id and expires_at<=clock_timestamp();
 select count(*) into v_profiles from public.gmail_profiles where user_id=p_owner_user_id and connector_id='google_mail';
 select count(*) into v_reservations from public.team_gmail_profile_reservations where owner_user_id=p_owner_user_id and expires_at>clock_timestamp();
 select coalesce(sum(max_gmail_profiles),0) into v_other_allocated from public.team_seats where owner_user_id=p_owner_user_id and status in ('pending','active') and id<>p_seat_id;
 if v_profiles+v_reservations+v_other_allocated+v_cap>v_plan then return jsonb_build_object('ok',false,'error','Not enough unallocated Gmail slots remain for this allocation.'); end if;
 update public.team_seats set max_gmail_profiles=v_cap where id=p_seat_id and owner_user_id=p_owner_user_id returning * into v_seat;
 return jsonb_build_object('ok',true,'seat',to_jsonb(v_seat));
end; $$;

create or replace function public.revoke_team_hotspot_seat(p_owner_user_id uuid,p_seat_id uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare v_count integer;
begin
 if p_owner_user_id is null or p_seat_id is null then return false; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_owner_user_id::text,0));
 update public.team_seats set status='revoked' where id=p_seat_id and owner_user_id=p_owner_user_id and status in ('pending','active');
 get diagnostics v_count=row_count; return v_count>0;
end; $$;

-- Compatibility alias for the legacy Company Team Seats RPC call shown by the old client.
create or replace function public.create_company_team_invite(p_invite_token text,p_member_email text,p_owner_user_id uuid)
returns jsonb language sql security definer set search_path=public,pg_temp as $$
 select public.create_team_hotspot_invite(p_owner_user_id,p_member_email,p_invite_token,1,75);
$$;

revoke all on public.team_seats from anon,authenticated;
grant all on public.team_seats to service_role;
revoke all on function public.create_team_hotspot_invite(uuid,text,text,integer,integer) from public,anon,authenticated;
revoke all on function public.update_team_hotspot_gmail_allocation(uuid,uuid,integer,integer) from public,anon,authenticated;
revoke all on function public.revoke_team_hotspot_seat(uuid,uuid) from public,anon,authenticated;
revoke all on function public.create_company_team_invite(text,text,uuid) from public,anon,authenticated;
grant execute on function public.create_team_hotspot_invite(uuid,text,text,integer,integer) to service_role;
grant execute on function public.update_team_hotspot_gmail_allocation(uuid,uuid,integer,integer) to service_role;
grant execute on function public.revoke_team_hotspot_seat(uuid,uuid) to service_role;
grant execute on function public.create_company_team_invite(text,text,uuid) to service_role;
notify pgrst,'reload schema';
