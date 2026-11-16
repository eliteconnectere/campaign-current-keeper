ALTER TABLE public.gmail_identity_usage
  ADD COLUMN IF NOT EXISTS window_started_at timestamptz NOT NULL DEFAULT now();

-- Preserve existing counters and start their first rolling window at rollout.
UPDATE public.gmail_identity_usage
SET window_started_at = now()
WHERE window_started_at IS NULL;
