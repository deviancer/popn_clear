-- Preserve every top-level song record when old and new clients update the
-- same level concurrently. Existing keys are only replaced when the incoming
-- payload explicitly contains that same key.
create or replace function public.preserve_level_record_keys()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.records := coalesce(old.records, '{}'::jsonb) || coalesce(new.records, '{}'::jsonb);
  return new;
end;
$$;

drop trigger if exists preserve_level_record_keys_before_update on public.level_records;

create trigger preserve_level_record_keys_before_update
before update of records on public.level_records
for each row
execute function public.preserve_level_record_keys();
