-- Master account billing / trial / promotion state
CREATE TABLE public.user_billing (
  user_id uuid PRIMARY KEY,
  promo_started_at timestamptz NOT NULL DEFAULT now(),
  registered_at timestamptz NOT NULL DEFAULT now(),
  plan text NOT NULL DEFAULT 'free',
  subscribed_until timestamptz,
  plan_started_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_billing TO authenticated;
GRANT ALL ON public.user_billing TO service_role;
ALTER TABLE public.user_billing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own billing" ON public.user_billing FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Per-user connector connection keys (encrypted server-side)
CREATE TABLE public.app_user_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  connector_id text NOT NULL,
  connection_key_ciphertext text NOT NULL,
  account_email text,
  daily_limit integer NOT NULL DEFAULT 400,
  sent_count integer NOT NULL DEFAULT 0,
  sent_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  exhausted_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, connector_id)
);
GRANT ALL ON public.app_user_connections TO service_role;
ALTER TABLE public.app_user_connections ENABLE ROW LEVEL SECURITY;

-- Connected campaign Gmail sending profiles
CREATE TABLE public.gmail_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  connector_id text NOT NULL,
  account_email text NOT NULL,
  email_key text NOT NULL,
  connection_key_ciphertext text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  slot integer NOT NULL DEFAULT 0,
  gateway_identity text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, connector_id, email_key)
);
GRANT ALL ON public.gmail_profiles TO service_role;
ALTER TABLE public.gmail_profiles ENABLE ROW LEVEL SECURITY;
CREATE INDEX gmail_profiles_user ON public.gmail_profiles (user_id, connector_id, position);

-- Protected per-Gmail-address sending history (never reset by app data clearing)
CREATE TABLE public.gmail_identity_usage (
  email_key text PRIMARY KEY,
  daily_limit integer NOT NULL DEFAULT 400,
  sent_count integer NOT NULL DEFAULT 0,
  sent_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  exhausted_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.gmail_identity_usage TO service_role;
ALTER TABLE public.gmail_identity_usage ENABLE ROW LEVEL SECURITY;

-- Campaign send log used for plan allowance and the 24HR tracker
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

-- Paystack subscription payments
CREATE TABLE public.payments (
  reference text PRIMARY KEY,
  user_id uuid NOT NULL,
  plan text NOT NULL,
  amount_kobo integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  activated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own payments" ON public.payments FOR SELECT TO authenticated USING (auth.uid() = user_id);