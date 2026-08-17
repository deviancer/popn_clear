-- The former Sran0 catalog is the introductory Sran5 catalog. Preserve every
-- published row and rewrite its stable song IDs while moving table 0 to 5.
alter table public.srandom_summaries
  drop constraint srandom_summaries_table_id_range,
  drop constraint srandom_summaries_counts_valid;

alter table public.srandom_records
  drop constraint srandom_records_table_id_range;

alter table public.srandom_activity_logs
  drop constraint srandom_activity_logs_table_id_range;

alter table public.srandom_summaries
  add column easy_clear_count integer not null default 0;

update public.srandom_summaries
set table_id = 5
where table_id = 0;

update public.srandom_records
set
  table_id = 5,
  records = (
    select coalesce(
      jsonb_object_agg(
        case
          when entry.key like 'sran:v1:0:%'
            then regexp_replace(entry.key, '^sran:v1:0:', 'sran:v1:5:')
          else entry.key
        end,
        entry.value
      ),
      '{}'::jsonb
    )
    from jsonb_each(srandom_records.records) as entry(key, value)
  )
where table_id = 0;

update public.srandom_activity_logs
set table_id = 5
where table_id = 0;

alter table public.srandom_summaries
  add constraint srandom_summaries_table_id_range check (table_id between 1 and 5),
  add constraint srandom_summaries_counts_valid check (
    total_count between 0 and 2000
    and easy_clear_count between 0 and total_count
    and clear_count between 0 and total_count
    and fail_count between 0 and total_count
    and easy_clear_count + clear_count + fail_count <= total_count
  );

alter table public.srandom_records
  add constraint srandom_records_table_id_range check (table_id between 1 and 5);

alter table public.srandom_activity_logs
  add constraint srandom_activity_logs_table_id_range check (table_id between 1 and 5);
