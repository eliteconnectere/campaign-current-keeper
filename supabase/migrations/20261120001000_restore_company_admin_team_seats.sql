-- Restore the separate Company Admin Team Seats feature.
-- The Hotspot assistant seats live in public.team_seats and are not modified here.
create table if not exists public.company_team_seats (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  member_email text not null,
  member_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','active','revoked')),
  invite_token text not null unique,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz,
  constraint company_team_seats_email_nonempty check (length(btrim(member_email)) > 3)
);
create index if not exists company_team_seats_owner_created_idx on public.company_team_seats(owner_user_id,created_at);
create index if not exists company_team_seats_member_status_idx on public.company_team_seats(member_user_id,status);
create unique index if not exists company_team_seats_owner_email_active_unique on public.company_team_seats(owner_user_id,lower(member_email)) where status in ('pending','active');

create table if not exists public.company_team_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists company_team_notifications_user_created_idx on public.company_team_notifications(user_id,created_at desc);

alter table public.company_team_seats enable row level security;
alter table public.company_team_notifications enable row level security;
revoke all on public.company_team_seats,public.company_team_notifications from anon,authenticated;
grant all on public.company_team_seats,public.company_team_notifications to service_role;

drop function if exists public.create_company_team_invite(text,text,uuid);
create or replace function public.create_company_team_invite(p_owner_user_id uuid,p_member_email text,p_invite_token text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_email text:=lower(btrim(p_member_email)); v_count integer; v_seat public.company_team_seats;
begin
 if p_owner_user_id is null or p_invite_token is null or length(p_invite_token)<16 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$' then
  return jsonb_build_object('ok',false,'error','Invalid Company Team Seat invitation details.');
 end if;
 perform pg_advisory_xact_lock(hashtextextended('company-team:'||p_owner_user_id::text,0));
 if exists(select 1 from public.company_team_seats where owner_user_id=p_owner_user_id and lower(member_email)=v_email and status in ('pending','active')) then
  return jsonb_build_object('ok',false,'error','That email is already a Company Admin.');
 end if;
 select count(*) into v_count from public.company_team_seats where owner_user_id=p_owner_user_id and status in ('pending','active');
 if v_count>=3 then return jsonb_build_object('ok',false,'error','You can add up to 3 additional Company Admins.'); end if;
 insert into public.company_team_seats(owner_user_id,member_email,invite_token,status) values(p_owner_user_id,v_email,p_invite_token,'pending') returning * into v_seat;
 return jsonb_build_object('ok',true,'seat',to_jsonb(v_seat));
end; $$;
revoke all on function public.create_company_team_invite(uuid,text,text) from public,anon,authenticated;
grant execute on function public.create_company_team_invite(uuid,text,text) to service_role;
notify pgrst,'reload schema';
