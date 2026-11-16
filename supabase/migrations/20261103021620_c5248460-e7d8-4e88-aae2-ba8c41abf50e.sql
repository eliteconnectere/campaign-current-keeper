CREATE TABLE public.admin_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'appeal',
  body text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  final_decision text,
  decision_reason text,
  decided_at timestamptz,
  release_at timestamptz,
  user_notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_submissions_type_chk CHECK (type IN ('appeal','complaint','report')),
  CONSTRAINT admin_submissions_status_chk CHECK (status IN ('pending','under_review','approved','declined')),
  CONSTRAINT admin_submissions_body_len CHECK (length(body) BETWEEN 1 AND 4000)
);
GRANT ALL ON public.admin_submissions TO service_role;
ALTER TABLE public.admin_submissions ENABLE ROW LEVEL SECURITY;
CREATE INDEX admin_submissions_user_idx ON public.admin_submissions(user_id, created_at DESC);
CREATE INDEX admin_submissions_release_idx ON public.admin_submissions(release_at) WHERE user_notified_at IS NULL;

CREATE TABLE public.user_presence (
  user_id uuid PRIMARY KEY,
  last_seen timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.user_presence TO service_role;
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;