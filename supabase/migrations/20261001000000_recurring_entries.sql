create type public.recurring_entry_kind as enum ('BIRTHDAY', 'ANNIVERSARY');

create table public.recurring_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind public.recurring_entry_kind not null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  month smallint not null check (month between 1 and 12),
  day smallint not null check (day between 1 and 31),
  year smallint,
  notes text,
  recurrence text not null default 'YEARLY' check (recurrence = 'YEARLY'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurring_entries_date_check check (
    day <= case month
      when 2 then 29
      when 4 then 30
      when 6 then 30
      when 9 then 30
      when 11 then 30
      else 31
    end
  ),
  constraint recurring_entries_year_check check (
    year is null or year between 1 and 9999
  ),
  constraint recurring_entries_anniversary_year_check check (
    kind <> 'ANNIVERSARY' or year is not null
  )
);

create index recurring_entries_user_date_idx
  on public.recurring_entries (user_id, month, day);

alter table public.recurring_entries enable row level security;

create policy "Users can read their recurring entries"
  on public.recurring_entries for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their recurring entries"
  on public.recurring_entries for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their recurring entries"
  on public.recurring_entries for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their recurring entries"
  on public.recurring_entries for delete to authenticated
  using ((select auth.uid()) = user_id);

create trigger recurring_entries_set_updated_at
  before update on public.recurring_entries
  for each row execute function public.set_updated_at();
