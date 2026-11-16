ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS reply_to uuid REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE OR REPLACE FUNCTION public.chat_reply_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.reply_to IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.chat_messages r WHERE r.id = NEW.reply_to AND r.connection_id = NEW.connection_id
  ) THEN
    RAISE EXCEPTION 'Reply target must be in the same conversation';
  END IF;
  IF TG_OP = 'INSERT' THEN NEW.edited_at := NULL; NEW.deleted_at := NULL; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS chat_reply_guard ON public.chat_messages;
CREATE TRIGGER chat_reply_guard BEFORE INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.chat_reply_guard();

CREATE TABLE public.chat_message_hidden (
  user_id uuid NOT NULL,
  message_id uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, message_id)
);
GRANT SELECT ON public.chat_message_hidden TO authenticated;
GRANT ALL ON public.chat_message_hidden TO service_role;
ALTER TABLE public.chat_message_hidden ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own hidden messages" ON public.chat_message_hidden
FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.edit_chat_message(_id uuid, _body text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _body IS NULL OR length(trim(_body)) < 1 OR length(_body) > 4000 THEN
    RAISE EXCEPTION 'Message must be 1-4000 characters';
  END IF;
  UPDATE public.chat_messages SET body = _body, edited_at = now()
  WHERE id = _id AND sender_id = auth.uid() AND kind = 'text' AND deleted_at IS NULL
    AND created_at > now() - interval '15 minutes';
  IF NOT FOUND THEN RAISE EXCEPTION 'This message can no longer be edited'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.delete_chat_message_everyone(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.chat_messages SET deleted_at = now(), body = NULL
  WHERE id = _id AND sender_id = auth.uid() AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Message cannot be deleted'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.hide_chat_message(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.chat_messages m WHERE m.id = _id AND public.is_connection_member(m.connection_id)) THEN
    RAISE EXCEPTION 'Unknown message';
  END IF;
  INSERT INTO public.chat_message_hidden(user_id, message_id) VALUES (auth.uid(), _id) ON CONFLICT DO NOTHING;
  UPDATE public.chat_messages SET read_at = coalesce(read_at, now()), delivered_at = coalesce(delivered_at, now())
  WHERE id = _id AND sender_id <> auth.uid();
END $$;

REVOKE EXECUTE ON FUNCTION public.edit_chat_message(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.delete_chat_message_everyone(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.hide_chat_message(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.edit_chat_message(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_chat_message_everyone(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hide_chat_message(uuid) TO authenticated;