-- These authenticated chat RPCs are intentionally SECURITY DEFINER because
-- they perform narrowly-scoped mutations while direct table mutation is denied.
-- Their bodies use auth.uid() and/or connection membership checks. Pin their
-- search_path to pg_catalog; all application objects are schema-qualified.
alter function public.delete_chat_message_everyone(uuid) set search_path = pg_catalog;
alter function public.edit_chat_message(uuid, text) set search_path = pg_catalog;
alter function public.hide_chat_message(uuid) set search_path = pg_catalog;
alter function public.is_chat_eligible() set search_path = pg_catalog;
alter function public.is_connection_member(uuid) set search_path = pg_catalog;
alter function public.mark_chat_delivered() set search_path = pg_catalog;
alter function public.mark_chat_read(uuid) set search_path = pg_catalog;
