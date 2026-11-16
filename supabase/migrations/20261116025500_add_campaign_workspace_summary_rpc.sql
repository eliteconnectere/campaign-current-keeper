create or replace function public.get_campaign_workspace_summary(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with recent_campaigns as (
    select
      c.id, c.name, c.subject, c.status, c.total_recipients, c.sent_count, c.failed_count,
      c.last_error, c.created_at, c.updated_at, c.started_at, c.paused_at, c.completed_at, c.next_run_at,
      count(r.id) filter (where r.status = 'sent')::integer as actual_sent,
      count(r.id) filter (where r.status = 'failed')::integer as actual_failed,
      count(r.id) filter (where r.status in ('pending', 'sending'))::integer as actual_pending
    from public.campaigns c
    left join public.campaign_recipients r on r.campaign_id = c.id
    where c.user_id = p_user_id
    group by c.id
    order by c.updated_at desc
    limit 10
  )
  select jsonb_build_object(
    'sentLast24Hours', (select count(*)::integer from public.campaign_delivery_history h where h.user_id = p_user_id and h.sent_at >= now() - interval '24 hours'),
    'campaigns', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', rc.id, 'name', rc.name, 'subject', rc.subject, 'status', rc.status,
        'total_recipients', rc.total_recipients, 'sent_count', rc.sent_count, 'failed_count', rc.failed_count,
        'last_error', rc.last_error, 'created_at', rc.created_at, 'updated_at', rc.updated_at,
        'started_at', rc.started_at, 'paused_at', rc.paused_at, 'completed_at', rc.completed_at, 'next_run_at', rc.next_run_at,
        'actualSent', rc.actual_sent, 'actualFailed', rc.actual_failed, 'actualPending', rc.actual_pending,
        'storedSentCount', rc.sent_count, 'storedFailedCount', rc.failed_count,
        'counterMismatch', rc.actual_sent <> rc.sent_count or rc.actual_failed <> rc.failed_count
      ) order by rc.updated_at desc) from recent_campaigns rc
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.get_campaign_workspace_summary(uuid) from public, anon, authenticated;
grant execute on function public.get_campaign_workspace_summary(uuid) to service_role;
