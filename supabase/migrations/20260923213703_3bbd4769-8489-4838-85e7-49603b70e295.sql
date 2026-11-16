ALTER TABLE public.user_billing ADD COLUMN IF NOT EXISTS plan_started_at timestamptz;

CREATE TABLE public.send_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  mode text NOT NULL CHECK (mode IN ('standard','elite')),
  sent_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.send_events TO authenticated;
GRANT ALL ON public.send_events TO service_role;
ALTER TABLE public.send_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own send events" ON public.send_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX send_events_user_time ON public.send_events (user_id, sent_at DESC);