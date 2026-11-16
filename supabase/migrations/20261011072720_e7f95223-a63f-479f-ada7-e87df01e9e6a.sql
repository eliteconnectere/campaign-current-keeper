DELETE FROM public.gmail_profiles WHERE id IS NOT NULL;
DELETE FROM public.app_user_connections WHERE id IS NOT NULL;
DELETE FROM public.gmail_connect_attempts WHERE id IS NOT NULL;
DELETE FROM public.send_events WHERE id IS NOT NULL;