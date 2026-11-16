CREATE TABLE public.gmail_connect_attempts (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  email text,
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
GRANT ALL ON public.gmail_connect_attempts TO service_role;
ALTER TABLE public.gmail_connect_attempts ENABLE ROW LEVEL SECURITY;
CREATE INDEX gmail_connect_attempts_user_idx ON public.gmail_connect_attempts(user_id, created_at DESC);