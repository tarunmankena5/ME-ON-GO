import type { Entry, EntryChanges, NewEntry, TaskEntry } from "@/types/entry";

/** Storage boundary used by the app. Demo and Supabase implementations belong in this data layer. */
export interface EntryRepository {
  listForDate(date: string, timeZone: string): Promise<Entry[]>;
  /** Returns entries whose primary date falls in [startDate, endDate), in the supplied time zone. */
  listForDateRange(startDate: string, endDate: string, timeZone: string): Promise<Entry[]>;
  listUpcoming(from: string, timeZone: string): Promise<Entry[]>;
  /** One read of the local planning window for Today, overdue, and Upcoming lists. */
  listTodayOverview(today: string, now: string, timeZone: string): Promise<{ today: Entry[]; overdueTasks: TaskEntry[]; upcoming: Entry[] }>;
  findById(id: string): Promise<Entry | null>;
  create(input: NewEntry): Promise<Entry>;
  update(id: string, changes: EntryChanges): Promise<Entry>;
  delete(id: string): Promise<void>;
}

/** Local demo storage is device-local and is not a cloud backup or authenticated account. */
export type RepositoryMode = "demo" | "supabase";
