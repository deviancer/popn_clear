-- Hosted project defaults may grant broader table privileges than this
-- feature needs. Reset them explicitly, then add back the minimum surface.
revoke all on table public.guestbook_messages from public, anon, authenticated;
grant select on table public.guestbook_messages to anon, authenticated;
grant insert, delete on table public.guestbook_messages to authenticated;

revoke all on sequence public.guestbook_messages_id_seq from public, anon, authenticated;
grant usage, select on sequence public.guestbook_messages_id_seq to authenticated;
