alter table public.entries
  add column category text
  constraint entries_category_length_check check (
    category is null or char_length(btrim(category)) between 1 and 80
  ),
  add constraint entries_category_kind_check check (
    kind = 'TASK' or category is null
  );

create index entries_user_task_category_idx
  on public.entries (user_id, category)
  where kind = 'TASK' and category is not null;
