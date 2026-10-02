export type RecurringEntryKind = "BIRTHDAY" | "ANNIVERSARY";
export type Recurrence = "YEARLY";

export type RecurringEntry = {
  id: string;
  userId: string;
  kind: RecurringEntryKind;
  title: string;
  month: number;
  day: number;
  year: number | null;
  notes: string | null;
  recurrence: Recurrence;
  createdAt: string;
  updatedAt: string;
};

export type NewRecurringEntry = Omit<RecurringEntry, "id" | "userId" | "createdAt" | "updatedAt">;
export type RecurringEntryChanges = Partial<Omit<RecurringEntry, "id" | "userId" | "kind" | "createdAt" | "updatedAt">>;

/** A calendar occurrence is derived from its source definition and is never persisted. */
export type RecurringOccurrence = RecurringEntry & {
  occurrenceDate: string;
  yearsSince: number | null;
};

export function getRecurringOccurrence(entry: RecurringEntry, year: number): RecurringOccurrence {
  const date = new Date(Date.UTC(year, entry.month - 1, 1));
  const lastDay = new Date(Date.UTC(year, entry.month, 0)).getUTCDate();
  const day = Math.min(entry.day, lastDay);
  date.setUTCDate(day);
  return {
    ...entry,
    occurrenceDate: `${year}-${String(entry.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    yearsSince: entry.year === null || year < entry.year ? null : year - entry.year,
  };
}

export function isValidRecurringDate(month: number, day: number): boolean {
  return Number.isInteger(month) && month >= 1 && month <= 12 && Number.isInteger(day) && day >= 1 && day <= new Date(Date.UTC(2000, month, 0)).getUTCDate();
}
