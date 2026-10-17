-- Make the client-facing privileges explicit instead of relying on project defaults.
-- RLS remains responsible for restricting authenticated users to their own rows.
revoke all privileges on table
  public.profiles,
  public.entries,
  public.recurring_entries,
  public.tracker_definitions,
  public.tracker_fields,
  public.tracker_records
from public, anon;

revoke all privileges on table
  public.profiles,
  public.entries,
  public.recurring_entries,
  public.tracker_definitions,
  public.tracker_fields,
  public.tracker_records
from authenticated;

grant usage on schema public to authenticated;

grant select, insert, update, delete on table
  public.profiles,
  public.entries,
  public.recurring_entries,
  public.tracker_definitions,
  public.tracker_fields,
  public.tracker_records
to authenticated;

create policy "Users can delete their profile"
  on public.profiles for delete to authenticated
  using ((select auth.uid()) = id);
