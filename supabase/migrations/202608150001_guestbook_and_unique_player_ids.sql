-- Player IDs are public identity labels, so keep them trimmed, short, and
-- unique without regard to letter case.
alter table public.profiles
  add constraint profiles_display_name_format
  check (
    display_name = btrim(display_name)
    and char_length(display_name) between 1 and 24
  );

create unique index profiles_display_name_ci_unique
  on public.profiles (lower(display_name));

-- Auth user creation and profile creation must be one transaction. This keeps
-- a race for the same player ID from leaving behind an account with no profile.
create schema if not exists private;
revoke all on schema private from public;

create or replace function private.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_name text;
begin
  requested_name := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));

  if requested_name = '' then
    requested_name := btrim(split_part(coalesce(new.email, ''), '@', 1));
  end if;

  if char_length(requested_name) not between 1 and 24 then
    raise exception using
      errcode = 'P0001',
      message = 'player_id_invalid';
  end if;

  begin
    insert into public.profiles (id, display_name)
    values (new.id, requested_name);
  exception
    when unique_violation then
      raise exception using
        errcode = 'P0001',
        message = 'player_id_taken';
  end;

  return new;
end;
$$;

revoke all on function private.handle_new_user_profile() from public, anon, authenticated;

drop trigger if exists create_profile_after_auth_signup on auth.users;

create trigger create_profile_after_auth_signup
after insert on auth.users
for each row
execute function private.handle_new_user_profile();

-- Some accounts predate automatic profile creation. Backfill only missing
-- rows, retaining their requested name where possible and adding a stable UUID
-- suffix only when that name is already occupied.
do $$
declare
  auth_user record;
  base_name text;
  candidate_name text;
begin
  for auth_user in
    select u.id, u.email, u.raw_user_meta_data
    from auth.users as u
    where not exists (
      select 1
      from public.profiles as p
      where p.id = u.id
    )
    order by u.created_at, u.id
  loop
    base_name := btrim(coalesce(auth_user.raw_user_meta_data ->> 'display_name', ''));
    if base_name = '' then
      base_name := btrim(split_part(coalesce(auth_user.email, ''), '@', 1));
    end if;
    if base_name = '' then
      base_name := 'player';
    end if;

    base_name := left(base_name, 24);
    candidate_name := base_name;

    if exists (
      select 1
      from public.profiles as p
      where lower(p.display_name) = lower(candidate_name)
    ) then
      candidate_name := left(base_name, 15) || '-' || left(replace(auth_user.id::text, '-', ''), 8);
    end if;

    insert into public.profiles (id, display_name)
    values (auth_user.id, candidate_name);
  end loop;
end;
$$;

create table public.guestbook_messages (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  constraint guestbook_messages_content_format check (
    content = btrim(content)
    and char_length(content) between 1 and 300
  )
);

create index guestbook_messages_created_at_idx
  on public.guestbook_messages (created_at desc, id desc);

create index guestbook_messages_user_created_at_idx
  on public.guestbook_messages (user_id, created_at desc);

alter table public.guestbook_messages enable row level security;

create policy "guestbook messages are public"
on public.guestbook_messages
for select
to anon, authenticated
using (true);

create policy "users insert own guestbook messages"
on public.guestbook_messages
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "users delete own guestbook messages"
on public.guestbook_messages
for delete
to authenticated
using ((select auth.uid()) = user_id);

grant select on table public.guestbook_messages to anon, authenticated;
grant insert, delete on table public.guestbook_messages to authenticated;
grant usage, select on sequence public.guestbook_messages_id_seq to authenticated;

create or replace function public.enforce_guestbook_message_insert()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.user_id is distinct from (select auth.uid()) then
    raise exception using
      errcode = '42501',
      message = 'guestbook_user_mismatch';
  end if;

  new.content := btrim(new.content);
  new.created_at := now();

  if char_length(new.content) not between 1 and 300 then
    raise exception using
      errcode = '22023',
      message = 'guestbook_content_invalid';
  end if;

  -- Serialize posts by one user so simultaneous requests cannot bypass the
  -- rolling cooldown check.
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));

  if exists (
    select 1
    from public.guestbook_messages as message
    where message.user_id = new.user_id
      and message.created_at > now() - interval '15 seconds'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'guestbook_rate_limited';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_guestbook_message_insert() from public, anon, authenticated;

create trigger enforce_guestbook_message_insert_before_insert
before insert on public.guestbook_messages
for each row
execute function public.enforce_guestbook_message_insert();
