alter table public.chat_messages drop constraint if exists chat_messages_payload_check;
alter table public.chat_messages add constraint chat_messages_payload_check check (
  deleted_at is not null
  or (kind='text' and body is not null and length(body)<=20000)
  or (kind='image' and (image_path is not null or body is not null))
);
notify pgrst,'reload schema';