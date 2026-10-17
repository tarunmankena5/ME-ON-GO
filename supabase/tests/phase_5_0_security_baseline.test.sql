begin;

select no_plan();

-- Disposable identities and rows. The Supabase database test runner rolls this
-- transaction back, so no real user data is involved.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000000a', 'phase50-a@example.invalid'),
  ('00000000-0000-4000-8000-00000000000b', 'phase50-b@example.invalid')
on conflict (id) do nothing;

insert into public.profiles (id, display_name) values
  ('00000000-0000-4000-8000-00000000000b', 'User B')
on conflict (id) do nothing;
insert into public.entries (id, user_id, kind, title, priority) values
  ('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000a', 'TASK', 'A task', 'NORMAL'),
  ('10000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-00000000000b', 'TASK', 'B task', 'NORMAL');
insert into public.recurring_entries (id, user_id, kind, title, month, day) values
  ('20000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000a', 'BIRTHDAY', 'A birthday', 1, 2),
  ('20000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-00000000000b', 'BIRTHDAY', 'B birthday', 1, 2);
insert into public.tracker_definitions (id, user_id, name) values
  ('30000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000a', 'A tracker'),
  ('30000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-00000000000b', 'B tracker');
insert into public.tracker_fields (id, tracker_id, user_id, name, field_type, position) values
  ('40000000-0000-4000-8000-00000000000a', '30000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000a', 'A field', 'TEXT', 0),
  ('40000000-0000-4000-8000-00000000000b', '30000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-00000000000b', 'B field', 'TEXT', 0);
insert into public.tracker_records (id, tracker_id, user_id, occurred_on) values
  ('50000000-0000-4000-8000-00000000000a', '30000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000a', date '2026-10-08'),
  ('50000000-0000-4000-8000-00000000000b', '30000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-00000000000b', date '2026-10-08');

-- Check both layers: the database must grant the operation and RLS must be on.
select ok(not has_table_privilege('anon', 'public.profiles', 'select'), 'anon has no profile read privilege');
select ok(not has_table_privilege('anon', 'public.entries', 'select'), 'anon has no entry read privilege');
select ok(not has_table_privilege('anon', 'public.recurring_entries', 'select'), 'anon has no recurring-entry read privilege');
select ok(not has_table_privilege('anon', 'public.tracker_definitions', 'select'), 'anon has no tracker read privilege');
select ok(not has_table_privilege('anon', 'public.tracker_fields', 'select'), 'anon has no tracker-field read privilege');
select ok(not has_table_privilege('anon', 'public.tracker_records', 'select'), 'anon has no tracker-record read privilege');
select ok(has_table_privilege('authenticated', 'public.profiles', 'select,insert,update,delete'), 'authenticated has profile CRUD privileges');
select ok(has_table_privilege('authenticated', 'public.entries', 'select,insert,update,delete'), 'authenticated has entry CRUD privileges');
select ok(has_table_privilege('authenticated', 'public.recurring_entries', 'select,insert,update,delete'), 'authenticated has recurring-entry CRUD privileges');
select ok(has_table_privilege('authenticated', 'public.tracker_definitions', 'select,insert,update,delete'), 'authenticated has tracker CRUD privileges');
select ok(has_table_privilege('authenticated', 'public.tracker_fields', 'select,insert,update,delete'), 'authenticated has tracker-field CRUD privileges');
select ok(has_table_privilege('authenticated', 'public.tracker_records', 'select,insert,update,delete'), 'authenticated has tracker-record CRUD privileges');
select ok(not exists (select 1 from unnest(array['profiles','entries','recurring_entries','tracker_definitions','tracker_fields','tracker_records']) as t(name) where has_table_privilege('authenticated', format('public.%I', name), 'truncate') or has_table_privilege('authenticated', format('public.%I', name), 'references') or has_table_privilege('authenticated', format('public.%I', name), 'trigger')), 'authenticated has no truncate, references, or trigger privileges');
select ok((select bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = any (array['profiles','entries','recurring_entries','tracker_definitions','tracker_fields','tracker_records'])), 'RLS is enabled on every user-owned table');
select is((select count(*)::int from pg_constraint where conname in ('tracker_fields_tracker_owner_fk', 'tracker_records_tracker_owner_fk') and contype = 'f' and confdeltype = 'c' and pg_get_constraintdef(oid) like '%(tracker_id, user_id)%'), 2, 'tracker children have composite ownership foreign keys with cascade behavior');

-- Anonymous requests lack SQL privileges for every operation on every table.
set local role anon;
select throws_ok('select * from public.profiles', '42501', null, 'anon cannot read profiles');
select throws_ok('insert into public.profiles (id) values (''00000000-0000-4000-8000-00000000000a'')', '42501', null, 'anon cannot insert profiles');
select throws_ok('update public.profiles set display_name = ''x''', '42501', null, 'anon cannot update profiles');
select throws_ok('delete from public.profiles', '42501', null, 'anon cannot delete profiles');
select throws_ok('select * from public.entries', '42501', null, 'anon cannot read entries');
select throws_ok('insert into public.entries (user_id, kind, title, priority) values (''00000000-0000-4000-8000-00000000000a'', ''TASK'', ''x'', ''NORMAL'')', '42501', null, 'anon cannot insert entries');
select throws_ok('update public.entries set title = ''x''', '42501', null, 'anon cannot update entries');
select throws_ok('delete from public.entries', '42501', null, 'anon cannot delete entries');
select throws_ok('select * from public.recurring_entries', '42501', null, 'anon cannot read recurring entries');
select throws_ok('insert into public.recurring_entries (user_id, kind, title, month, day) values (''00000000-0000-4000-8000-00000000000a'', ''BIRTHDAY'', ''x'', 1, 1)', '42501', null, 'anon cannot insert recurring entries');
select throws_ok('update public.recurring_entries set title = ''x''', '42501', null, 'anon cannot update recurring entries');
select throws_ok('delete from public.recurring_entries', '42501', null, 'anon cannot delete recurring entries');
select throws_ok('select * from public.tracker_definitions', '42501', null, 'anon cannot read tracker definitions');
select throws_ok('insert into public.tracker_definitions (user_id, name) values (''00000000-0000-4000-8000-00000000000a'', ''x'')', '42501', null, 'anon cannot insert tracker definitions');
select throws_ok('update public.tracker_definitions set name = ''x''', '42501', null, 'anon cannot update tracker definitions');
select throws_ok('delete from public.tracker_definitions', '42501', null, 'anon cannot delete tracker definitions');
select throws_ok('select * from public.tracker_fields', '42501', null, 'anon cannot read tracker fields');
select throws_ok('insert into public.tracker_fields (tracker_id, user_id, name, field_type, position) values (''30000000-0000-4000-8000-00000000000a'', ''00000000-0000-4000-8000-00000000000a'', ''x'', ''TEXT'', 1)', '42501', null, 'anon cannot insert tracker fields');
select throws_ok('update public.tracker_fields set name = ''x''', '42501', null, 'anon cannot update tracker fields');
select throws_ok('delete from public.tracker_fields', '42501', null, 'anon cannot delete tracker fields');
select throws_ok('select * from public.tracker_records', '42501', null, 'anon cannot read tracker records');
select throws_ok('insert into public.tracker_records (tracker_id, user_id, occurred_on) values (''30000000-0000-4000-8000-00000000000a'', ''00000000-0000-4000-8000-00000000000a'', date ''2026-10-08'')', '42501', null, 'anon cannot insert tracker records');
select throws_ok('update public.tracker_records set occurred_on = date ''2026-10-09''', '42501', null, 'anon cannot update tracker records');
select throws_ok('delete from public.tracker_records', '42501', null, 'anon cannot delete tracker records');
reset role;

-- User A sees their rows, can CRUD their rows, and cannot access User B's rows.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000a', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select is((select count(*)::int from public.entries), 1, 'User A sees only their entries');
select is((select count(*)::int from public.recurring_entries), 1, 'User A sees only their recurring entries');
select is((select count(*)::int from public.tracker_definitions), 1, 'User A sees only their trackers');
select is((select count(*)::int from public.tracker_fields), 1, 'User A sees only their tracker fields');
select is((select count(*)::int from public.tracker_records), 1, 'User A sees only their tracker records');
select is((select count(*)::int from public.entries where id = '10000000-0000-4000-8000-00000000000b'), 0, 'User A cannot read User B entries');
select is((select count(*)::int from public.recurring_entries where id = '20000000-0000-4000-8000-00000000000b'), 0, 'User A cannot read User B recurring entries');
select is((select count(*)::int from public.tracker_definitions where id = '30000000-0000-4000-8000-00000000000b'), 0, 'User A cannot read User B trackers');
select is((select count(*)::int from public.tracker_fields where id = '40000000-0000-4000-8000-00000000000b'), 0, 'User A cannot read User B tracker fields');
select is((select count(*)::int from public.tracker_records where id = '50000000-0000-4000-8000-00000000000b'), 0, 'User A cannot read User B tracker records');
select lives_ok('insert into public.profiles (id, display_name) values (''00000000-0000-4000-8000-00000000000a'', ''User A'')', 'User A can insert their profile');
select is((select count(*)::int from public.profiles), 1, 'User A can read their profile');
select is((select count(*)::int from public.profiles where id = '00000000-0000-4000-8000-00000000000b'), 0, 'User A cannot read User B profile');
select lives_ok('update public.profiles set display_name = ''User A updated'' where id = ''00000000-0000-4000-8000-00000000000a''', 'User A can update their profile');
select is((with deleted as (delete from public.profiles where id = '00000000-0000-4000-8000-00000000000a' returning 1) select count(*)::int from deleted), 1, 'User A can delete their profile');
select lives_ok('insert into public.entries (id, user_id, kind, title, priority) values (''11000000-0000-4000-8000-00000000000a'', ''00000000-0000-4000-8000-00000000000a'', ''TASK'', ''A new task'', ''NORMAL'')', 'User A can insert their entry');
select lives_ok('update public.entries set title = ''A task updated'' where id = ''10000000-0000-4000-8000-00000000000a''', 'User A can update their entry');
select is((with deleted as (delete from public.entries where id = '11000000-0000-4000-8000-00000000000a' returning 1) select count(*)::int from deleted), 1, 'User A can delete their entry');
select lives_ok('insert into public.recurring_entries (id, user_id, kind, title, month, day) values (''21000000-0000-4000-8000-00000000000a'', ''00000000-0000-4000-8000-00000000000a'', ''BIRTHDAY'', ''A new date'', 2, 3)', 'User A can insert their recurring entry');
select lives_ok('update public.recurring_entries set title = ''A birthday updated'' where id = ''20000000-0000-4000-8000-00000000000a''', 'User A can update their recurring entry');
select is((with deleted as (delete from public.recurring_entries where id = '21000000-0000-4000-8000-00000000000a' returning 1) select count(*)::int from deleted), 1, 'User A can delete their recurring entry');
select lives_ok('insert into public.tracker_definitions (id, user_id, name) values (''31000000-0000-4000-8000-00000000000a'', ''00000000-0000-4000-8000-00000000000a'', ''A new tracker'')', 'User A can insert their tracker');
select lives_ok('update public.tracker_definitions set name = ''A tracker updated'' where id = ''30000000-0000-4000-8000-00000000000a''', 'User A can update their tracker');
select is((with deleted as (delete from public.tracker_definitions where id = '31000000-0000-4000-8000-00000000000a' returning 1) select count(*)::int from deleted), 1, 'User A can delete their tracker');
select lives_ok('insert into public.tracker_fields (id, tracker_id, user_id, name, field_type, position) values (''41000000-0000-4000-8000-00000000000a'', ''30000000-0000-4000-8000-00000000000a'', ''00000000-0000-4000-8000-00000000000a'', ''A new field'', ''TEXT'', 1)', 'User A can insert a field under their tracker');
select lives_ok('update public.tracker_fields set name = ''A field updated'' where id = ''40000000-0000-4000-8000-00000000000a''', 'User A can update their tracker field');
select is((with deleted as (delete from public.tracker_fields where id = '41000000-0000-4000-8000-00000000000a' returning 1) select count(*)::int from deleted), 1, 'User A can delete their tracker field');
select lives_ok('insert into public.tracker_records (id, tracker_id, user_id, occurred_on) values (''51000000-0000-4000-8000-00000000000a'', ''30000000-0000-4000-8000-00000000000a'', ''00000000-0000-4000-8000-00000000000a'', date ''2026-10-09'')', 'User A can insert a record under their tracker');
select lives_ok('update public.tracker_records set occurred_on = date ''2026-10-07'' where id = ''50000000-0000-4000-8000-00000000000a''', 'User A can update their tracker record');
select is((with deleted as (delete from public.tracker_records where id = '51000000-0000-4000-8000-00000000000a' returning 1) select count(*)::int from deleted), 1, 'User A can delete their tracker record');
select is((with updated as (update public.entries set title = 'attempt' where id = '10000000-0000-4000-8000-00000000000b' returning 1) select count(*)::int from updated), 0, 'User A cannot update User B entry');
select is((select count(*)::int from public.entries where id = '10000000-0000-4000-8000-00000000000b'), 0, 'User A still cannot see User B entry after update attempt');
select is((with deleted as (delete from public.entries where id = '10000000-0000-4000-8000-00000000000b' returning 1) select count(*)::int from deleted), 0, 'User A cannot delete User B entry');
select is((with updated as (update public.profiles set display_name = 'attempt' where id = '00000000-0000-4000-8000-00000000000b' returning 1) select count(*)::int from updated), 0, 'User A cannot update User B profile');
select is((with deleted as (delete from public.profiles where id = '00000000-0000-4000-8000-00000000000b' returning 1) select count(*)::int from deleted), 0, 'User A cannot delete User B profile');
select is((with updated as (update public.recurring_entries set title = 'attempt' where id = '20000000-0000-4000-8000-00000000000b' returning 1) select count(*)::int from updated), 0, 'User A cannot update User B recurring entry');
select is((with deleted as (delete from public.recurring_entries where id = '20000000-0000-4000-8000-00000000000b' returning 1) select count(*)::int from deleted), 0, 'User A cannot delete User B recurring entry');
select is((with updated as (update public.tracker_definitions set name = 'attempt' where id = '30000000-0000-4000-8000-00000000000b' returning 1) select count(*)::int from updated), 0, 'User A cannot update User B tracker');
select is((with deleted as (delete from public.tracker_definitions where id = '30000000-0000-4000-8000-00000000000b' returning 1) select count(*)::int from deleted), 0, 'User A cannot delete User B tracker');
select is((with updated as (update public.tracker_fields set name = 'attempt' where id = '40000000-0000-4000-8000-00000000000b' returning 1) select count(*)::int from updated), 0, 'User A cannot update User B tracker field');
select is((with deleted as (delete from public.tracker_fields where id = '40000000-0000-4000-8000-00000000000b' returning 1) select count(*)::int from deleted), 0, 'User A cannot delete User B tracker field');
select is((with updated as (update public.tracker_records set occurred_on = date '2026-10-09' where id = '50000000-0000-4000-8000-00000000000b' returning 1) select count(*)::int from updated), 0, 'User A cannot update User B tracker record');
select is((with deleted as (delete from public.tracker_records where id = '50000000-0000-4000-8000-00000000000b' returning 1) select count(*)::int from deleted), 0, 'User A cannot delete User B tracker record');
select throws_ok('insert into public.entries (user_id, kind, title, priority) values (''00000000-0000-4000-8000-00000000000b'', ''TASK'', ''claimed'', ''NORMAL'')', '42501', null, 'User A cannot insert an entry claiming User B');
select throws_ok('insert into public.recurring_entries (user_id, kind, title, month, day) values (''00000000-0000-4000-8000-00000000000b'', ''BIRTHDAY'', ''claimed'', 2, 3)', '42501', null, 'User A cannot insert recurring entry claiming User B');
select throws_ok('insert into public.tracker_definitions (user_id, name) values (''00000000-0000-4000-8000-00000000000b'', ''claimed'')', '42501', null, 'User A cannot insert tracker claiming User B');
select throws_ok('insert into public.profiles (id, display_name) values (''00000000-0000-4000-8000-00000000000b'', ''claimed'')', '42501', null, 'User A cannot insert profile claiming User B');
select throws_ok('insert into public.tracker_fields (tracker_id, user_id, name, field_type, position) values (''30000000-0000-4000-8000-00000000000b'', ''00000000-0000-4000-8000-00000000000a'', ''cross-owner'', ''TEXT'', 1)', '42501', null, 'User A cannot create a field under User B tracker');
select throws_ok('insert into public.tracker_records (tracker_id, user_id, occurred_on) values (''30000000-0000-4000-8000-00000000000b'', ''00000000-0000-4000-8000-00000000000a'', date ''2026-10-08'')', '42501', null, 'User A cannot create a record under User B tracker');
select throws_ok('insert into public.tracker_fields (tracker_id, user_id, name, field_type, position) values (''30000000-0000-4000-8000-00000000000a'', ''00000000-0000-4000-8000-00000000000b'', ''claimed'', ''TEXT'', 2)', '42501', null, 'User A cannot insert tracker field claiming User B');
select throws_ok('insert into public.tracker_records (tracker_id, user_id, occurred_on) values (''30000000-0000-4000-8000-00000000000a'', ''00000000-0000-4000-8000-00000000000b'', date ''2026-10-08'')', '42501', null, 'User A cannot insert tracker record claiming User B');
reset role;

-- User B can read their own rows and is equally isolated from User A.
insert into public.profiles (id, display_name) values ('00000000-0000-4000-8000-00000000000a', 'User A restored for isolation check');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000b', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select is((select count(*)::int from public.profiles), 1, 'User B sees only their profile');
select is((select count(*)::int from public.profiles where id = '00000000-0000-4000-8000-00000000000a'), 0, 'User B cannot read User A profile');
select is((select count(*)::int from public.entries), 1, 'User B sees only their entries');
select is((select count(*)::int from public.recurring_entries), 1, 'User B sees only their recurring entries');
select is((select count(*)::int from public.tracker_definitions), 1, 'User B sees only their trackers');
select is((select count(*)::int from public.tracker_fields), 1, 'User B sees only their tracker fields');
select is((select count(*)::int from public.tracker_records), 1, 'User B sees only their tracker records');
select is((select count(*)::int from public.entries where id = '10000000-0000-4000-8000-00000000000a'), 0, 'User B cannot read User A entries');
select is((select count(*)::int from public.recurring_entries where id = '20000000-0000-4000-8000-00000000000a'), 0, 'User B cannot read User A recurring entries');
select is((select count(*)::int from public.tracker_definitions where id = '30000000-0000-4000-8000-00000000000a'), 0, 'User B cannot read User A trackers');
select is((select count(*)::int from public.tracker_fields where id = '40000000-0000-4000-8000-00000000000a'), 0, 'User B cannot read User A tracker fields');
select is((select count(*)::int from public.tracker_records where id = '50000000-0000-4000-8000-00000000000a'), 0, 'User B cannot read User A tracker records');
select is((with deleted as (delete from public.profiles where id = '00000000-0000-4000-8000-00000000000b' returning 1) select count(*)::int from deleted), 1, 'User B can delete their profile');
select lives_ok('insert into public.profiles (id, display_name) values (''00000000-0000-4000-8000-00000000000b'', ''User B again'')', 'User B can insert their profile');
select lives_ok('update public.profiles set display_name = ''User B updated'' where id = ''00000000-0000-4000-8000-00000000000b''', 'User B can update their profile');
select is((with deleted as (delete from public.profiles where id = '00000000-0000-4000-8000-00000000000b' returning 1) select count(*)::int from deleted), 1, 'User B can delete their profile');
select lives_ok('insert into public.entries (id, user_id, kind, title, priority) values (''11000000-0000-4000-8000-00000000000b'', ''00000000-0000-4000-8000-00000000000b'', ''TASK'', ''B new task'', ''NORMAL'')', 'User B can insert their entry');
select lives_ok('update public.entries set title = ''B task updated'' where id = ''10000000-0000-4000-8000-00000000000b''', 'User B can update their entry');
select is((with deleted as (delete from public.entries where id = '11000000-0000-4000-8000-00000000000b' returning 1) select count(*)::int from deleted), 1, 'User B can delete their entry');
select lives_ok('insert into public.recurring_entries (id, user_id, kind, title, month, day) values (''21000000-0000-4000-8000-00000000000b'', ''00000000-0000-4000-8000-00000000000b'', ''BIRTHDAY'', ''B new date'', 2, 3)', 'User B can insert their recurring entry');
select lives_ok('update public.recurring_entries set title = ''B birthday updated'' where id = ''20000000-0000-4000-8000-00000000000b''', 'User B can update their recurring entry');
select is((with deleted as (delete from public.recurring_entries where id = '21000000-0000-4000-8000-00000000000b' returning 1) select count(*)::int from deleted), 1, 'User B can delete their recurring entry');
select lives_ok('insert into public.tracker_definitions (id, user_id, name) values (''31000000-0000-4000-8000-00000000000b'', ''00000000-0000-4000-8000-00000000000b'', ''B new tracker'')', 'User B can insert their tracker');
select lives_ok('update public.tracker_definitions set name = ''B tracker updated'' where id = ''30000000-0000-4000-8000-00000000000b''', 'User B can update their tracker');
select is((with deleted as (delete from public.tracker_definitions where id = '31000000-0000-4000-8000-00000000000b' returning 1) select count(*)::int from deleted), 1, 'User B can delete their tracker');
select lives_ok('insert into public.tracker_fields (id, tracker_id, user_id, name, field_type, position) values (''41000000-0000-4000-8000-00000000000b'', ''30000000-0000-4000-8000-00000000000b'', ''00000000-0000-4000-8000-00000000000b'', ''B new field'', ''TEXT'', 1)', 'User B can insert a field under their tracker');
select lives_ok('update public.tracker_fields set name = ''B field updated'' where id = ''40000000-0000-4000-8000-00000000000b''', 'User B can update their tracker field');
select is((with deleted as (delete from public.tracker_fields where id = '41000000-0000-4000-8000-00000000000b' returning 1) select count(*)::int from deleted), 1, 'User B can delete their tracker field');
select lives_ok('insert into public.tracker_records (id, tracker_id, user_id, occurred_on) values (''51000000-0000-4000-8000-00000000000b'', ''30000000-0000-4000-8000-00000000000b'', ''00000000-0000-4000-8000-00000000000b'', date ''2026-10-09'')', 'User B can insert a record under their tracker');
select lives_ok('update public.tracker_records set occurred_on = date ''2026-10-07'' where id = ''50000000-0000-4000-8000-00000000000b''', 'User B can update their tracker record');
select is((with deleted as (delete from public.tracker_records where id = '51000000-0000-4000-8000-00000000000b' returning 1) select count(*)::int from deleted), 1, 'User B can delete their tracker record');
select is((with deleted as (delete from public.entries where id = '10000000-0000-4000-8000-00000000000a' returning 1) select count(*)::int from deleted), 0, 'User B cannot delete User A entry');
select is((with updated as (update public.entries set title = 'attempt' where id = '10000000-0000-4000-8000-00000000000a' returning 1) select count(*)::int from updated), 0, 'User B cannot update User A entry');
select is((with deleted as (delete from public.recurring_entries where id = '20000000-0000-4000-8000-00000000000a' returning 1) select count(*)::int from deleted), 0, 'User B cannot delete User A recurring entry');
select is((with updated as (update public.recurring_entries set title = 'attempt' where id = '20000000-0000-4000-8000-00000000000a' returning 1) select count(*)::int from updated), 0, 'User B cannot update User A recurring entry');
select is((with deleted as (delete from public.profiles where id = '00000000-0000-4000-8000-00000000000a' returning 1) select count(*)::int from deleted), 0, 'User B cannot delete User A profile');
select is((with updated as (update public.profiles set display_name = 'attempt' where id = '00000000-0000-4000-8000-00000000000a' returning 1) select count(*)::int from updated), 0, 'User B cannot update User A profile');
select is((with deleted as (delete from public.tracker_definitions where id = '30000000-0000-4000-8000-00000000000a' returning 1) select count(*)::int from deleted), 0, 'User B cannot delete User A tracker');
select is((with updated as (update public.tracker_definitions set name = 'attempt' where id = '30000000-0000-4000-8000-00000000000a' returning 1) select count(*)::int from updated), 0, 'User B cannot update User A tracker');
select is((with updated as (update public.tracker_fields set name = 'attempt' where id = '40000000-0000-4000-8000-00000000000a' returning 1) select count(*)::int from updated), 0, 'User B cannot update User A tracker field');
select is((with deleted as (delete from public.tracker_fields where id = '40000000-0000-4000-8000-00000000000a' returning 1) select count(*)::int from deleted), 0, 'User B cannot delete User A tracker field');
select is((with updated as (update public.tracker_records set occurred_on = date '2026-10-09' where id = '50000000-0000-4000-8000-00000000000a' returning 1) select count(*)::int from updated), 0, 'User B cannot update User A tracker record');
select is((with deleted as (delete from public.tracker_records where id = '50000000-0000-4000-8000-00000000000a' returning 1) select count(*)::int from deleted), 0, 'User B cannot delete User A tracker record');
select throws_ok('insert into public.profiles (id, display_name) values (''00000000-0000-4000-8000-00000000000a'', ''claimed'')', '42501', null, 'User B cannot insert profile claiming User A');
select throws_ok('insert into public.entries (user_id, kind, title, priority) values (''00000000-0000-4000-8000-00000000000a'', ''TASK'', ''claimed'', ''NORMAL'')', '42501', null, 'User B cannot insert an entry claiming User A');
select throws_ok('insert into public.recurring_entries (user_id, kind, title, month, day) values (''00000000-0000-4000-8000-00000000000a'', ''BIRTHDAY'', ''claimed'', 2, 3)', '42501', null, 'User B cannot insert recurring entry claiming User A');
select throws_ok('insert into public.tracker_definitions (user_id, name) values (''00000000-0000-4000-8000-00000000000a'', ''claimed'')', '42501', null, 'User B cannot insert tracker claiming User A');
select throws_ok('insert into public.tracker_fields (tracker_id, user_id, name, field_type, position) values (''30000000-0000-4000-8000-00000000000b'', ''00000000-0000-4000-8000-00000000000a'', ''claimed'', ''TEXT'', 1)', '42501', null, 'User B cannot create a field claiming User A');
select throws_ok('insert into public.tracker_records (tracker_id, user_id, occurred_on) values (''30000000-0000-4000-8000-00000000000b'', ''00000000-0000-4000-8000-00000000000a'', date ''2026-10-08'')', '42501', null, 'User B cannot create a record claiming User A');
select is((with deleted as (delete from public.tracker_fields where id = '40000000-0000-4000-8000-00000000000a' returning 1) select count(*)::int from deleted), 0, 'User B cannot delete User A tracker field');
select is((with deleted as (delete from public.tracker_records where id = '50000000-0000-4000-8000-00000000000a' returning 1) select count(*)::int from deleted), 0, 'User B cannot delete User A tracker record');
reset role;

-- Deleting a tracker must cascade to its owned fields and records, including
-- historical field values. This data is synthetic and remains in this test's
-- transaction, which is rolled back below.
insert into public.tracker_definitions (id, user_id, name) values
  ('30000000-0000-4000-8000-00000000000c', '00000000-0000-4000-8000-00000000000b', 'Cascade test tracker');
insert into public.tracker_fields (id, tracker_id, user_id, name, field_type, position) values
  ('40000000-0000-4000-8000-00000000000c', '30000000-0000-4000-8000-00000000000c', '00000000-0000-4000-8000-00000000000b', 'Cascade field one', 'TEXT', 0),
  ('40000000-0000-4000-8000-00000000000d', '30000000-0000-4000-8000-00000000000c', '00000000-0000-4000-8000-00000000000b', 'Cascade field two', 'TEXT', 1);
insert into public.tracker_records (id, tracker_id, user_id, occurred_on, values) values
  ('50000000-0000-4000-8000-00000000000c', '30000000-0000-4000-8000-00000000000c', '00000000-0000-4000-8000-00000000000b', date '2026-10-08', '{"40000000-0000-4000-8000-00000000000c":"historical value"}');
select is((select count(*)::int from public.tracker_fields where tracker_id = '30000000-0000-4000-8000-00000000000c' and user_id = '00000000-0000-4000-8000-00000000000b'), 2, 'Cascade test tracker has two owned fields before deletion');
select is((select count(*)::int from public.tracker_records where tracker_id = '30000000-0000-4000-8000-00000000000c' and user_id = '00000000-0000-4000-8000-00000000000b'), 1, 'Cascade test tracker has a record with a historical field value before deletion');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000b', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select is((with deleted as (delete from public.tracker_definitions where id = '30000000-0000-4000-8000-00000000000c' returning 1) select count(*)::int from deleted), 1, 'User B can delete their synthetic tracker');
select is((select count(*)::int from public.tracker_fields where tracker_id = '30000000-0000-4000-8000-00000000000c' and user_id = '00000000-0000-4000-8000-00000000000b'), 0, 'Tracker deletion cascades to its fields');
select is((select count(*)::int from public.tracker_records where tracker_id = '30000000-0000-4000-8000-00000000000c' and user_id = '00000000-0000-4000-8000-00000000000b'), 0, 'Tracker deletion cascades to its records');
reset role;

-- Verify parent deletion cascades to both child tables.
delete from auth.users where id = '00000000-0000-4000-8000-00000000000b';
select is((select count(*)::int from public.profiles where id = '00000000-0000-4000-8000-00000000000b'), 0, 'auth user deletion cascades to profile');
select is((select count(*)::int from public.entries where user_id = '00000000-0000-4000-8000-00000000000b'), 0, 'auth user deletion cascades to entries');
select is((select count(*)::int from public.recurring_entries where user_id = '00000000-0000-4000-8000-00000000000b'), 0, 'auth user deletion cascades to recurring entries');
select is((select count(*)::int from public.tracker_definitions where user_id = '00000000-0000-4000-8000-00000000000b'), 0, 'auth user deletion cascades to tracker definition');
select is((select count(*)::int from public.tracker_fields where user_id = '00000000-0000-4000-8000-00000000000b'), 0, 'auth user deletion cascades to tracker fields');
select is((select count(*)::int from public.tracker_records where user_id = '00000000-0000-4000-8000-00000000000b'), 0, 'auth user deletion cascades to tracker records');

select * from finish();
rollback;
