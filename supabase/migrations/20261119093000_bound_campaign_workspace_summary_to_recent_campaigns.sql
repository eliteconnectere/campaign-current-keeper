-- Bound campaign workspace summary work to the user's 10 most recently updated campaigns.
-- Previously, recipient rows for every campaign owned by the user were aggregated
-- before the final LIMIT 10, so historical campaigns could make every refresh more expensive.
CREATE OR REPLACE FUNCTION public.get_campaign_workspace_summary(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH recent_campaigns AS MATERIALIZED (
    SELECT
      c.id, c.name, c.subject, c.status, c.total_recipients,
      c.sent_count, c.failed_count, c.last_error, c.created_at,
      c.updated_at, c.started_at, c.paused_at, c.completed_at,
      c.next_run_at
    FROM public.campaigns c
    WHERE c.user_id = p_user_id
    ORDER BY c.updated_at DESC
    LIMIT 10
  ),
  campaign_counts AS (
    SELECT
      rc.id,
      count(r.id) FILTER (WHERE r.status = 'sent')::integer AS actual_sent,
      count(r.id) FILTER (WHERE r.status = 'failed')::integer AS actual_failed,
      count(r.id) FILTER (WHERE r.status IN ('pending', 'sending'))::integer AS actual_pending
    FROM recent_campaigns rc
    LEFT JOIN public.campaign_recipients r ON r.campaign_id = rc.id
    GROUP BY rc.id
  )
  SELECT jsonb_build_object(
    'sentLast24Hours', (
      SELECT count(*)::integer
      FROM public.campaign_delivery_history h
      WHERE h.user_id = p_user_id
        AND h.sent_at >= now() - interval '24 hours'
    ),
    'campaigns', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', rc.id,
        'name', rc.name,
        'subject', rc.subject,
        'status', rc.status,
        'total_recipients', rc.total_recipients,
        'sent_count', rc.sent_count,
        'failed_count', rc.failed_count,
        'last_error', rc.last_error,
        'created_at', rc.created_at,
        'updated_at', rc.updated_at,
        'started_at', rc.started_at,
        'paused_at', rc.paused_at,
        'completed_at', rc.completed_at,
        'next_run_at', rc.next_run_at,
        'actualSent', cc.actual_sent,
        'actualFailed', cc.actual_failed,
        'actualPending', cc.actual_pending,
        'storedSentCount', rc.sent_count,
        'storedFailedCount', rc.failed_count,
        'counterMismatch', cc.actual_sent <> rc.sent_count OR cc.actual_failed <> rc.failed_count
      ) ORDER BY rc.updated_at DESC)
      FROM recent_campaigns rc
      JOIN campaign_counts cc ON cc.id = rc.id
    ), '[]'::jsonb)
  );
$function$;
