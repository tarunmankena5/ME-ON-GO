# ME ON GO

ME ON GO — Your life, in motion. A private, iPhone-first personal timeline with generic custom trackers, recurring dates, and deadline-aware tasks.

## Start locally

Requirements: Node.js 20.9 or newer and pnpm.

```powershell
pnpm install
pnpm dev
```

Open <http://localhost:3000>. The default `demo` mode starts without Supabase credentials. Demo entries use this browser's local storage; there is no cloud authentication or sync. Demo mode is not a production authentication system.

## Configuration

Copy `.env.example` to `.env.local` if you want to override the defaults. Keep `LIFELOG_DATA_MODE=demo` until a Supabase project is available. Supabase integration is not connected yet; after project setup, configure `SUPABASE_URL` and `SUPABASE_ANON_KEY`, then set `LIFELOG_DATA_MODE=supabase`.

Never put a Supabase service role key in browser code or in a `NEXT_PUBLIC_` variable. User-owned records are protected by the RLS policies in `supabase/migrations/`.

## Checks

```powershell
pnpm lint
pnpm typecheck
pnpm build
```

## Structure

- `app/` — Next.js App Router routes and global styling
- `components/` — reusable interface components
- `lib/config/` — local/demo versus Supabase mode selection
- `lib/data/` — typed repository boundaries for one-time and recurring entry data access
- `lib/trackers/` — editable starter tracker templates
- `lib/dates/` — timezone helpers for date display and grouping
- `lib/supabase/` — Supabase configuration boundary (no client or credentials configured yet)
- `types/` — shared domain types
- `supabase/migrations/` — PostgreSQL schema, indexes, triggers, and row-level security

One-time Activity, Task, and Event dates are represented as ISO timestamps and stored as `timestamptz`; display and day grouping use the user's IANA timezone. Recurring dates are date-only month/day values with an optional source year, so they do not shift across timezones.

Birthdays and anniversaries use `recurring_entries`, separate from one-time `entries`. Calendar occurrences are derived from the source record and are never saved as yearly copies. Local demo recurring dates are stored in this browser's local storage under their own repository and key.

Custom trackers have reusable typed field definitions and independent dated records. Local demo definitions and records use a dedicated `TrackerRepository`; field values are keyed by stable field IDs so record edits do not alter tracker configuration. Date-only tracker records keep a date without inventing a time. The PostgreSQL migration uses a JSONB value object on each record to make each record atomic, validates values against tracker field definitions, and enforces ownership with composite foreign keys and RLS. Tracker entries are not yet part of Today or Calendar.

## Product roadmap

See [ROADMAP.md](ROADMAP.md) for future calendar and native-platform directions. Those integrations and calendar systems are planning constraints only; they are not implemented.
