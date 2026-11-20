create or replace function public.mark_gmail_identity_exhausted(p_email_key text,p_cooldown_seconds integer default 86400)
returns timestamptz language plpgsql security definer set search_path=public,pg_temp as $$
declare v_until timestamptz;
begin
 update public.gmail_identity_usage
 set exhausted_until=greatest(coalesce(exhausted_until,clock_timestamp()),
   clock_timestamp()+make_interval(secs=>least(86400,greatest(60,coalesce(p_cooldown_seconds,86400)))))
 where email_key=lower(btrim(p_email_key))
 returning exhausted_until into v_until;
 if v_until is null then raise exception 'Gmail identity usage row not found'; end if;
 return v_until;
end; $$;
revoke all on function public.mark_gmail_identity_exhausted(text,integer) from public,anon,authenticated;
grant execute on function public.mark_gmail_identity_exhausted(text,integer) to service_role;
notify pgrst,'reload schema';