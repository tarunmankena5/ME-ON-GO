# ME ON GO — Product and architecture roadmap

**Tagline:** Your life, in motion.

This document records current domain constraints and future product directions. The current product includes one-time Activity, Task, and Event entries; the Calendar; yearly birthdays and anniversaries; generic Task deadlines; and user-defined custom trackers with typed fields and records.

## Platform-neutral domain

Keep domain types, persistence contracts, and backend services independent of web or iOS frameworks. Web and future native clients should use the same platform-agnostic concepts and service boundaries. Native APIs must be accessed by a native integration layer; the web UI must not communicate directly with HealthKit, EventKit, or other iOS-only frameworks.

Future timeline items should distinguish their origin conceptually:

- **User-created** — entered directly by the user.
- **Imported** — synchronized or imported from an external source, such as Apple Calendar or HealthKit.
- **System-generated** — derived from configured calendar rules or calculations, such as lunar dates and recurring personal dates.

User-created one-time Activity, Task, and Event records remain in `entries`. User-created yearly birthdays and anniversaries live in `recurring_entries`; their calendar occurrences are derived from the source definition and are not stored as yearly records. Do not overload `entries.metadata` as a substitute for typed fields or source attribution. Imported and other system-generated items remain future concepts; evolve their model through explicit migrations when implementation begins.

Tasks remain a general-purpose kind in `entries`. A category is an optional user-provided label, not a separate entity or fixed list of database categories. Due dates and completion timestamps remain typed fields; overdue state is derived using local date/time and completion status.

Custom trackers are user-owned definitions with ordered typed fields and independent records. Template choices only seed editable definitions. Record values are keyed by stable field IDs; in Postgres they are stored as one JSONB value object per record and validated against the field schema. Record date and optional time are separate, so date-only records do not gain a fabricated timestamp. Fields with historical values are deactivated rather than deleted, and changing a used field's type is blocked. Tracker records are deliberately not integrated into Today or Calendar in Phase 4.

## Future calendar data

### Birthdays

Implemented in Phase 3A: name, month/day, optional birth year, notes, yearly recurrence, and derived calendar occurrences with optional age display. Configurable reminders remain future work. Age is derived and not stored.

### Anniversaries

Implemented in Phase 3A: title, original date including year, notes, yearly recurrence, and derived calendar occurrences with years-since calculation. Reminders and separate person/couple fields remain future work.

### Hindu lunar calendar

Potential calendar data includes Amavasya (new moon), Purnima (full moon), Shukla Paksha, Krishna Paksha, Tithi, Hindu lunar month, and eventually major Hindu festivals. Do not hardcode lunar dates. A future calculation service must account for the observation location and timezone because Panchang/Tithi boundaries vary by location. Keep astronomical/calendar calculation logic behind a dedicated service boundary and record the calculation conventions and data source when selected.

### Other generated and imported events

The future timeline may include moon phases, Hindu calendar events, HealthKit workouts, and Apple Calendar events. Imported or generated data should enter through domain/data-access boundaries and then be presented as timeline items; integrations should not be embedded in screen components.

## Future native iOS integration

The web/PWA architecture should remain compatible with a native iOS companion. A future native layer may integrate with:

- **EventKit** for Calendar and Reminders, subject to user authorization and platform behavior.
- **HealthKit** for health and fitness data, including Apple Watch data where available. Imported workouts should become source-attributed timeline/activity data; the web client should not query HealthKit.
- **Native notifications** for reminders, subject to user preferences and permissions.

Do not add HealthKit, EventKit, notifications, Screen Time/DeviceActivity, native iOS projects, or related tooling during the current Phase 1 work. Reassess current Apple APIs, privacy requirements, and App Store rules when those integrations are approved for implementation.

## Custom trackers

Implemented in Phase 4: reusable tracker definitions; editable Workout, Running, Reading, Meditation, Sleep, Water, and Movies & TV starting templates; nine typed field kinds; local demo persistence; record history/edit/delete; tracker and record confirmation flows; and ownership-aware database schema/RLS. Templates do not create special-purpose systems. Insights and calendar integration remain future work.

## Delivery boundary

Hindu lunar calculations, imported events, notifications, native capabilities, Screen Time/DeviceActivity, Explore, analytics, AI, tracker calendar integration, and tracker insights remain future work. Implement future work as separately scoped changes with explicit domain types, data-source behavior, timezone/location rules, and migrations where needed.
