create type public.entry_kind as enum ('ACTIVITY', 'TASK', 'EVENT');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  time_zone text not null default 'UTC' check (char_length(btrim(time_zone)) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind public.entry_kind not null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  notes text,
  activity_type text,
  occurred_at timestamptz,
  due_at timestamptz,
  priority text,
  completed_at timestamptz,
  starts_at timestamptz,
  ends_at timestamptz,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint entries_kind_fields_check check (
    (kind = 'ACTIVITY' and occurred_at is not null and due_at is null and completed_at is null and starts_at is null and ends_at is null and priority is null)
    or (kind = 'TASK' and occurred_at is null and starts_at is null and ends_at is null and priority is not null and priority in ('LOW', 'NORMAL', 'HIGH'))
    or (kind = 'EVENT' and occurred_at is null and due_at is null and completed_at is null and starts_at is not null and (ends_at is null or ends_at >= starts_at) and priority is null)
  ),
  constraint entries_activity_type_check check (kind = 'ACTIVITY' or activity_type is null)
);

create index entries_user_occurred_at_idx on public.entries (user_id, occurred_at desc) where kind = 'ACTIVITY';
create index entries_user_due_at_idx on public.entries (user_id, due_at asc) where kind = 'TASK' and completed_at is null;
create index entries_user_starts_at_idx on public.entries (user_id, starts_at asc) where kind = 'EVENT';

alter table public.profiles enable row level security;
alter table public.entries enable row level security;

create policy "Users can read their profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "Users can create their profile"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

create policy "Users can update their profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Users can read their entries"
  on public.entries for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their entries"
  on public.entries for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their entries"
  on public.entries for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their entries"
  on public.entries for delete to authenticated
  using ((select auth.uid()) = user_id);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger entries_set_updated_at
  before update on public.entries
  for each row execute function public.set_updated_at();
