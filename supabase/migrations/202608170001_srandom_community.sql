create table public.srandom_summaries (
  user_id uuid not null references public.profiles(id) on delete cascade,
  table_id smallint not null,
  display_name text not null,
  total_count integer not null default 0,
  clear_count integer not null default 0,
  fail_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, table_id),
  constraint srandom_summaries_table_id_range check (table_id between 0 and 4),
  constraint srandom_summaries_display_name_format check (
    display_name = btrim(display_name)
    and char_length(display_name) between 1 and 24
  ),
  constraint srandom_summaries_counts_valid check (
    total_count between 0 and 2000
    and clear_count between 0 and total_count
    and fail_count between 0 and total_count
    and clear_count + fail_count <= total_count
  )
);

create index srandom_summaries_leaderboard_idx
  on public.srandom_summaries (table_id, clear_count desc, fail_count asc, updated_at desc);

create table public.srandom_records (
  user_id uuid not null references public.profiles(id) on delete cascade,
  table_id smallint not null,
  records jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, table_id),
  constraint srandom_records_table_id_range check (table_id between 0 and 4),
  constraint srandom_records_object check (jsonb_typeof(records) = 'object')
);

create table public.srandom_activity_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  display_name text not null,
  table_id smallint not null,
  message text not null,
  created_at timestamptz not null default now(),
  constraint srandom_activity_logs_table_id_range check (table_id between 0 and 4),
  constraint srandom_activity_logs_display_name_format check (
    display_name = btrim(display_name)
    and char_length(display_name) between 1 and 24
  ),
  constraint srandom_activity_logs_message_format check (
    message = btrim(message)
    and char_length(message) between 1 and 1000
  )
);

create index srandom_activity_logs_created_at_idx
  on public.srandom_activity_logs (created_at desc, id desc);

create index srandom_activity_logs_user_created_at_idx
  on public.srandom_activity_logs (user_id, created_at desc);

alter table public.srandom_summaries enable row level security;
alter table public.srandom_records enable row level security;
alter table public.srandom_activity_logs enable row level security;

create policy "srandom summaries are public"
on public.srandom_summaries
for select
to anon, authenticated
using (true);

create policy "users insert own srandom summaries"
on public.srandom_summaries
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "users update own srandom summaries"
on public.srandom_summaries
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "users delete own srandom summaries"
on public.srandom_summaries
for delete
to authenticated
using ((select auth.uid()) = user_id);

-- Owners can always read their saved records. Other users can only read a
-- table while its matching public summary exists, so hiding a summary also
-- makes the detailed JSON private without deleting the owner's cloud copy.
create policy "published srandom records or owner are readable"
on public.srandom_records
for select
to anon, authenticated
using (
  (select auth.uid()) = user_id
  or exists (
    select 1
    from public.srandom_summaries as summary
    where summary.user_id = srandom_records.user_id
      and summary.table_id = srandom_records.table_id
  )
);

create policy "users insert own srandom records"
on public.srandom_records
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "users update own srandom records"
on public.srandom_records
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "users delete own srandom records"
on public.srandom_records
for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "srandom activity is public"
on public.srandom_activity_logs
for select
to anon, authenticated
using (true);

create policy "users insert own srandom activity"
on public.srandom_activity_logs
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "users delete own srandom activity"
on public.srandom_activity_logs
for delete
to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.srandom_summaries from public, anon, authenticated;
grant select on table public.srandom_summaries to anon, authenticated;
grant insert, update, delete on table public.srandom_summaries to authenticated;

revoke all on table public.srandom_records from public, anon, authenticated;
grant select on table public.srandom_records to anon, authenticated;
grant insert, update, delete on table public.srandom_records to authenticated;

revoke all on table public.srandom_activity_logs from public, anon, authenticated;
grant select on table public.srandom_activity_logs to anon, authenticated;
grant insert, delete on table public.srandom_activity_logs to authenticated;

revoke all on sequence public.srandom_activity_logs_id_seq from public, anon, authenticated;
grant usage, select on sequence public.srandom_activity_logs_id_seq to authenticated;
