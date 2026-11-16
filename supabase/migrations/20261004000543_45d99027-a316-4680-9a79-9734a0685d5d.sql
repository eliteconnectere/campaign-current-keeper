REVOKE EXECUTE ON FUNCTION public.is_connection_member(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_chat_eligible() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.mark_chat_delivered() FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_chat_read(uuid) FROM anon;