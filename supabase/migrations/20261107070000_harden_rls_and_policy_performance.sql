-- Harden internal event-trigger execution and improve policy/index performance.
-- Server-only tables intentionally remain RLS-enabled with no client policies:
-- their callers use the server-side service role only.
revoke all on function public.rls_auto_enable() from public, anon, authenticated, service_role;
grant execute on function public.rls_auto_enable() to postgres;

-- Cache auth.uid() once per statement instead of evaluating it for every row.
do $$
declare
  p record;
  stmt text;
  using_expr text;
  check_expr text;
begin
  for p in
    select *
    from pg_policies
    where schemaname = 'public'
      and (
        coalesce(qual, '') like '%auth.uid()%'
        or coalesce(with_check, '') like '%auth.uid()%'
      )
  loop
    using_expr := case when p.qual is null then null
      else replace(p.qual, 'auth.uid()', '(select auth.uid())') end;
    check_expr := case when p.with_check is null then null
      else replace(p.with_check, 'auth.uid()', '(select auth.uid())') end;

    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    stmt := format(
      'create policy %I on %I.%I as %s for %s to %s',
      p.policyname, p.schemaname, p.tablename, p.permissive, p.cmd,
      array_to_string(p.roles, ', ')
    );
    if using_expr is not null then
      stmt := stmt || format(' using (%s)', using_expr);
    end if;
    if check_expr is not null then
      stmt := stmt || format(' with check (%s)', check_expr);
    end if;
    execute stmt;
  end loop;
end
$$;

create index if not exists chat_message_hidden_message_id_idx
  on public.chat_message_hidden (message_id);
create index if not exists chat_messages_reply_to_idx
  on public.chat_messages (reply_to);
