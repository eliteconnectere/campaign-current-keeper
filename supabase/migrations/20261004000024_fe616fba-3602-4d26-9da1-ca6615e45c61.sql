CREATE TABLE public.chat_profiles (
  user_id uuid PRIMARY KEY,
  display_name text NOT NULL,
  username text NOT NULL,
  eligible boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX chat_profiles_username_key ON public.chat_profiles (lower(username));
GRANT SELECT ON public.chat_profiles TO authenticated;
GRANT ALL ON public.chat_profiles TO service_role;
ALTER TABLE public.chat_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "See eligible chat profiles or own" ON public.chat_profiles FOR SELECT TO authenticated
  USING (eligible OR user_id = auth.uid());

CREATE TABLE public.connection_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);
CREATE UNIQUE INDEX connection_requests_one_pending ON public.connection_requests
  (least(sender_id, receiver_id), greatest(sender_id, receiver_id)) WHERE status = 'pending';
GRANT SELECT ON public.connection_requests TO authenticated;
GRANT ALL ON public.connection_requests TO service_role;
ALTER TABLE public.connection_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants see requests" ON public.connection_requests FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE TABLE public.connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL,
  user_b uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_a, user_b),
  CHECK (user_a < user_b)
);
GRANT SELECT ON public.connections TO authenticated;
GRANT ALL ON public.connections TO service_role;
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants see connections" ON public.connections FOR SELECT TO authenticated
  USING (auth.uid() = user_a OR auth.uid() = user_b);

CREATE OR REPLACE FUNCTION public.is_connection_member(_cid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.connections c WHERE c.id = _cid AND auth.uid() IN (c.user_a, c.user_b))
$$;

CREATE OR REPLACE FUNCTION public.is_chat_eligible()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.chat_profiles p WHERE p.user_id = auth.uid() AND p.eligible)
$$;

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.connections(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'text',
  body text,
  image_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  read_at timestamptz
);
CREATE INDEX chat_messages_conn_idx ON public.chat_messages (connection_id, created_at);
GRANT SELECT, INSERT ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants read messages" ON public.chat_messages FOR SELECT TO authenticated
  USING (public.is_connection_member(connection_id));
CREATE POLICY "Eligible participants send" ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_connection_member(connection_id)
    AND public.is_chat_eligible()
    AND kind IN ('text','image')
    AND (kind <> 'text' OR (body IS NOT NULL AND length(body) BETWEEN 1 AND 4000))
    AND (kind <> 'image' OR (image_path IS NOT NULL AND image_path LIKE connection_id::text || '/%'))
    AND delivered_at IS NULL AND read_at IS NULL
  );

CREATE OR REPLACE FUNCTION public.mark_chat_delivered()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.chat_messages m SET delivered_at = now()
  WHERE m.delivered_at IS NULL AND m.sender_id <> auth.uid()
    AND EXISTS (SELECT 1 FROM public.connections c WHERE c.id = m.connection_id AND auth.uid() IN (c.user_a, c.user_b));
$$;

CREATE OR REPLACE FUNCTION public.mark_chat_read(_cid uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.chat_messages m SET read_at = now(), delivered_at = coalesce(m.delivered_at, now())
  WHERE m.connection_id = _cid AND m.read_at IS NULL AND m.sender_id <> auth.uid()
    AND public.is_connection_member(_cid);
$$;

REVOKE EXECUTE ON FUNCTION public.mark_chat_delivered() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.mark_chat_read(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.mark_chat_delivered() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_chat_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_connection_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_chat_eligible() TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.connection_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.connections;

CREATE POLICY "Chat members read images" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-images' AND public.is_connection_member(((storage.foldername(name))[1])::uuid));
CREATE POLICY "Chat members upload images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-images' AND public.is_chat_eligible()
    AND public.is_connection_member(((storage.foldername(name))[1])::uuid));