-- Friendly preflight check for the registration form. The unique index and
-- auth trigger remain the authoritative race-safe enforcement.
create or replace function public.player_id_available(candidate text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select
    candidate = btrim(candidate)
    and char_length(candidate) between 1 and 24
    and not exists (
      select 1
      from public.profiles as profile
      where lower(profile.display_name) = lower(candidate)
    );
$$;

revoke all on function public.player_id_available(text) from public;
grant execute on function public.player_id_available(text) to anon, authenticated;
