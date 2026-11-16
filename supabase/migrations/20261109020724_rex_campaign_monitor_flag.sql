ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS rex_monitored boolean NOT NULL DEFAULT false;
