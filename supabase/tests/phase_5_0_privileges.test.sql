SET search_path TO extensions, public;

BEGIN;

SELECT extensions.plan(16);

-- Anonymous users must have no table privileges.
SELECT extensions.ok(
  NOT has_table_privilege('anon', 'public.profiles', 'SELECT'),
  'anon cannot read profiles'
);
SELECT extensions.ok(
  NOT has_table_privilege('anon', 'public.entries', 'SELECT'),
  'anon cannot read entries'
);
SELECT extensions.ok(
  NOT has_table_privilege('anon', 'public.recurring_entries', 'SELECT'),
  'anon cannot read recurring entries'
);
SELECT extensions.ok(
  NOT has_table_privilege('anon', 'public.tracker_definitions', 'SELECT'),
  'anon cannot read tracker definitions'
);
SELECT extensions.ok(
  NOT has_table_privilege('anon', 'public.tracker_fields', 'SELECT'),
  'anon cannot read tracker fields'
);
SELECT extensions.ok(
  NOT has_table_privilege('anon', 'public.tracker_records', 'SELECT'),
  'anon cannot read tracker records'
);

-- Authenticated users may read, insert, and update their own profile
-- through RLS, but must not directly delete profile rows.
SELECT extensions.ok(
  has_table_privilege('authenticated', 'public.profiles', 'SELECT')
  AND has_table_privilege('authenticated', 'public.profiles', 'INSERT')
  AND has_table_privilege('authenticated', 'public.profiles', 'UPDATE'),
  'authenticated has profile select, insert, and update privileges'
);
SELECT extensions.ok(
  NOT has_table_privilege('authenticated', 'public.profiles', 'DELETE'),
  'authenticated cannot directly delete profiles'
);

-- Authenticated users need CRUD privileges on their application tables.
SELECT extensions.ok(
  has_table_privilege('authenticated', 'public.entries', 'SELECT')
  AND has_table_privilege('authenticated', 'public.entries', 'INSERT')
  AND has_table_privilege('authenticated', 'public.entries', 'UPDATE')
  AND has_table_privilege('authenticated', 'public.entries', 'DELETE'),
  'authenticated has entries CRUD privileges'
);
SELECT extensions.ok(
  has_table_privilege('authenticated', 'public.recurring_entries', 'SELECT')
  AND has_table_privilege('authenticated', 'public.recurring_entries', 'INSERT')
  AND has_table_privilege('authenticated', 'public.recurring_entries', 'UPDATE')
  AND has_table_privilege('authenticated', 'public.recurring_entries', 'DELETE'),
  'authenticated has recurring entries CRUD privileges'
);
SELECT extensions.ok(
  has_table_privilege('authenticated', 'public.tracker_definitions', 'SELECT')
  AND has_table_privilege('authenticated', 'public.tracker_definitions', 'INSERT')
  AND has_table_privilege('authenticated', 'public.tracker_definitions', 'UPDATE')
  AND has_table_privilege('authenticated', 'public.tracker_definitions', 'DELETE'),
  'authenticated has tracker definitions CRUD privileges'
);
SELECT extensions.ok(
  has_table_privilege('authenticated', 'public.tracker_fields', 'SELECT')
  AND has_table_privilege('authenticated', 'public.tracker_fields', 'INSERT')
  AND has_table_privilege('authenticated', 'public.tracker_fields', 'UPDATE')
  AND has_table_privilege('authenticated', 'public.tracker_fields', 'DELETE'),
  'authenticated has tracker fields CRUD privileges'
);
SELECT extensions.ok(
  has_table_privilege('authenticated', 'public.tracker_records', 'SELECT')
  AND has_table_privilege('authenticated', 'public.tracker_records', 'INSERT')
  AND has_table_privilege('authenticated', 'public.tracker_records', 'UPDATE')
  AND has_table_privilege('authenticated', 'public.tracker_records', 'DELETE'),
  'authenticated has tracker records CRUD privileges'
);

-- No direct TRUNCATE, REFERENCES, or TRIGGER privileges.
SELECT extensions.ok(
  NOT has_table_privilege('authenticated', 'public.entries', 'TRUNCATE')
  AND NOT has_table_privilege('authenticated', 'public.entries', 'REFERENCES')
  AND NOT has_table_privilege('authenticated', 'public.entries', 'TRIGGER'),
  'authenticated has no elevated entries table privileges'
);

-- RLS must be enabled on every application table.
SELECT extensions.ok(
  (SELECT bool_and(relrowsecurity)
   FROM pg_class
   WHERE oid = ANY (ARRAY[
     'public.profiles'::regclass,
     'public.entries'::regclass,
     'public.recurring_entries'::regclass,
     'public.tracker_definitions'::regclass,
     'public.tracker_fields'::regclass,
     'public.tracker_records'::regclass
   ])),
  'RLS is enabled on all six application tables'
);

-- Tracker child tables must retain their composite foreign keys.
SELECT extensions.ok(
  EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.tracker_fields'::regclass
      AND contype = 'f'
      AND confrelid = 'public.tracker_definitions'::regclass
  )
  AND EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.tracker_records'::regclass
      AND contype = 'f'
      AND confrelid = 'public.tracker_definitions'::regclass
  ),
  'tracker child tables have foreign keys to tracker definitions'
);

SELECT * FROM extensions.finish(true);

ROLLBACK;
