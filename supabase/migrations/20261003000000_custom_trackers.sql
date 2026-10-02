create type public.tracker_field_type as enum (
  'TEXT', 'NUMBER', 'DURATION', 'DATE', 'TIME', 'RATING', 'BOOLEAN', 'SELECT', 'NOTES'
);

create table public.tracker_definitions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  description text check (description is null or char_length(description) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.tracker_fields (
  id uuid primary key default gen_random_uuid(),
  tracker_id uuid not null,
  user_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  field_type public.tracker_field_type not null,
  unit text check (unit is null or char_length(btrim(unit)) between 1 and 24),
  required boolean not null default false,
  position integer not null check (position >= 0),
  active boolean not null default true,
  options jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tracker_fields_tracker_owner_fk
    foreign key (tracker_id, user_id) references public.tracker_definitions (id, user_id) on delete cascade,
  constraint tracker_fields_options_check check (
    jsonb_typeof(options) = 'array'
    and (
      (field_type = 'SELECT' and jsonb_array_length(options) between 2 and 100)
      or (field_type <> 'SELECT' and options = '[]'::jsonb)
    )
  ),
  constraint tracker_fields_tracker_position_unique unique (tracker_id, position) deferrable initially deferred,
  unique (id, tracker_id, user_id)
);

create table public.tracker_records (
  id uuid primary key default gen_random_uuid(),
  tracker_id uuid not null,
  user_id uuid not null,
  occurred_on date not null,
  occurred_at timestamptz,
  values jsonb not null default '{}'::jsonb check (jsonb_typeof(values) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tracker_records_tracker_owner_fk
    foreign key (tracker_id, user_id) references public.tracker_definitions (id, user_id) on delete cascade,
  unique (id, tracker_id, user_id)
);

create index tracker_fields_user_tracker_position_idx on public.tracker_fields (user_id, tracker_id, position);
create unique index tracker_fields_tracker_name_unique on public.tracker_fields (tracker_id, lower(btrim(name)));
create index tracker_records_user_tracker_occurred_idx on public.tracker_records (user_id, tracker_id, occurred_on desc, occurred_at desc);

alter table public.tracker_definitions enable row level security;
alter table public.tracker_fields enable row level security;
alter table public.tracker_records enable row level security;

create policy "Users can read their tracker definitions"
  on public.tracker_definitions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can create their tracker definitions"
  on public.tracker_definitions for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can update their tracker definitions"
  on public.tracker_definitions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users can delete their tracker definitions"
  on public.tracker_definitions for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can read their tracker fields"
  on public.tracker_fields for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can create their tracker fields"
  on public.tracker_fields for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.tracker_definitions d where d.id = tracker_id and d.user_id = (select auth.uid()))
  );
create policy "Users can update their tracker fields"
  on public.tracker_fields for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.tracker_definitions d where d.id = tracker_id and d.user_id = (select auth.uid()))
  );
create policy "Users can delete their tracker fields"
  on public.tracker_fields for delete to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (select 1 from public.tracker_definitions d where d.id = tracker_id and d.user_id = (select auth.uid()))
  );

create policy "Users can read their tracker records"
  on public.tracker_records for select to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (select 1 from public.tracker_definitions d where d.id = tracker_id and d.user_id = (select auth.uid()))
  );
create policy "Users can create their tracker records"
  on public.tracker_records for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.tracker_definitions d where d.id = tracker_id and d.user_id = (select auth.uid()))
  );
create policy "Users can update their tracker records"
  on public.tracker_records for update to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (select 1 from public.tracker_definitions d where d.id = tracker_id and d.user_id = (select auth.uid()))
  )
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.tracker_definitions d where d.id = tracker_id and d.user_id = (select auth.uid()))
  );
create policy "Users can delete their tracker records"
  on public.tracker_records for delete to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (select 1 from public.tracker_definitions d where d.id = tracker_id and d.user_id = (select auth.uid()))
  );

create function public.validate_tracker_field_options()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  item jsonb;
  seen text[] := array[]::text[];
  option_text text;
begin
  if new.field_type <> 'SELECT' then return new; end if;
  for item in select value from jsonb_array_elements(new.options)
  loop
    if jsonb_typeof(item) <> 'string' then
      raise exception 'Select options must be strings.' using errcode = '23514';
    end if;
    option_text := btrim(item #>> '{}');
    if option_text = '' or char_length(option_text) > 80 or lower(option_text) = any(seen) then
      raise exception 'Select options must be non-empty, unique, and no longer than 80 characters.' using errcode = '23514';
    end if;
    seen := array_append(seen, lower(option_text));
  end loop;
  return new;
end;
$$;
create trigger tracker_fields_validate_options_on_insert
  before insert on public.tracker_fields
  for each row execute function public.validate_tracker_field_options();
create trigger tracker_fields_validate_options_on_update
  before update of field_type, options on public.tracker_fields
  for each row execute function public.validate_tracker_field_options();

-- Every value is embedded in its record as a field-ID-keyed JSON object.
-- This keeps record values atomic and prevents orphan value rows.
create function public.validate_tracker_record_values()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  item record;
  field_row public.tracker_fields%rowtype;
  json_type text;
  text_value text;
  numeric_value numeric;
  field_uuid uuid;
begin
  if jsonb_typeof(new.values) <> 'object' then
    raise exception 'Tracker record values must be a JSON object.' using errcode = '23514';
  end if;

  for item in select key, value from jsonb_each(new.values)
  loop
    begin
      field_uuid := item.key::uuid;
    exception when invalid_text_representation then
      raise exception 'Tracker record contains an invalid field identifier.' using errcode = '23514';
    end;

    select * into field_row
      from public.tracker_fields f
      where f.id = field_uuid and f.tracker_id = new.tracker_id and f.user_id = new.user_id;
    if not found then
      raise exception 'Tracker record contains a field from another tracker.' using errcode = '23514';
    end if;

    json_type := jsonb_typeof(item.value);
    text_value := item.value #>> '{}';
    case field_row.field_type
      when 'TEXT' then
        if json_type <> 'string' or char_length(text_value) > 500 then raise exception 'Invalid text value.' using errcode = '23514'; end if;
      when 'NOTES' then
        if json_type <> 'string' or char_length(text_value) > 4000 then raise exception 'Invalid notes value.' using errcode = '23514'; end if;
      when 'NUMBER' then
        if json_type <> 'number' then raise exception 'Invalid numeric value.' using errcode = '23514'; end if;
        numeric_value := text_value::numeric;
        if numeric_value = 'NaN'::numeric then raise exception 'Invalid numeric value.' using errcode = '23514'; end if;
      when 'DURATION' then
        if json_type <> 'number' or text_value !~ '^[0-9]{1,6}$' or text_value::integer > 359999 then raise exception 'Invalid duration value.' using errcode = '23514'; end if;
      when 'DATE' then
        if json_type <> 'string' or text_value !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid date value.' using errcode = '23514'; end if;
        perform text_value::date;
      when 'TIME' then
        if json_type <> 'string' or text_value !~ '^([01]\d|2[0-3]):[0-5]\d$' then raise exception 'Invalid time value.' using errcode = '23514'; end if;
        perform text_value::time;
      when 'RATING' then
        if json_type <> 'number' or text_value !~ '^[1-5]$' then raise exception 'Rating must be an integer from 1 to 5.' using errcode = '23514'; end if;
      when 'BOOLEAN' then
        if json_type <> 'boolean' then raise exception 'Invalid boolean value.' using errcode = '23514'; end if;
      when 'SELECT' then
        if json_type <> 'string' or not (field_row.options @> jsonb_build_array(text_value)) then raise exception 'Select value is not one of the configured options.' using errcode = '23514'; end if;
    end case;
  end loop;

  for field_row in
    select * from public.tracker_fields f
    where f.tracker_id = new.tracker_id and f.user_id = new.user_id and f.active and f.required
  loop
    if not (new.values ? field_row.id::text) then
      raise exception 'A required tracker value is missing.' using errcode = '23514';
    end if;
  end loop;
  return new;
exception when invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range then
  raise exception 'Tracker record contains an invalid date, time, or numeric value.' using errcode = '23514';
end;
$$;

create trigger tracker_records_validate_values_on_insert
  before insert on public.tracker_records
  for each row execute function public.validate_tracker_record_values();
create trigger tracker_records_validate_values_on_update
  before update of values, tracker_id, user_id on public.tracker_records
  for each row execute function public.validate_tracker_record_values();

create function public.protect_tracker_field_history()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if pg_trigger_depth() = 1 and exists (
      select 1 from public.tracker_records r
      where r.tracker_id = old.tracker_id and r.user_id = old.user_id and r.values ? old.id::text
    ) then
      raise exception 'A field with saved record values must be deactivated, not deleted.' using errcode = '23503';
    end if;
    return old;
  end if;

  if old.field_type <> new.field_type and exists (
    select 1 from public.tracker_records r
    where r.tracker_id = old.tracker_id and r.user_id = old.user_id and r.values ? old.id::text
  ) then
    raise exception 'A field with historical values cannot change type.' using errcode = '23514';
  end if;

  if old.field_type = 'SELECT' and new.field_type = 'SELECT' and exists (
    select 1 from public.tracker_records r
    where r.tracker_id = old.tracker_id and r.user_id = old.user_id
      and r.values ? old.id::text
      and not (new.options @> jsonb_build_array(r.values ->> old.id::text))
  ) then
    raise exception 'Options already used in tracker history cannot be removed.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger tracker_fields_protect_history
  before update or delete on public.tracker_fields
  for each row execute function public.protect_tracker_field_history();

create trigger tracker_definitions_set_updated_at
  before update on public.tracker_definitions
  for each row execute function public.set_updated_at();
create trigger tracker_fields_set_updated_at
  before update on public.tracker_fields
  for each row execute function public.set_updated_at();
create trigger tracker_records_set_updated_at
  before update on public.tracker_records
  for each row execute function public.set_updated_at();
