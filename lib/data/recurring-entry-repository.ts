import type { NewRecurringEntry, RecurringEntry, RecurringEntryChanges } from "@/types/recurring-entry";

export interface RecurringEntryRepository {
  listAll(): Promise<RecurringEntry[]>;
  findById(id: string): Promise<RecurringEntry | null>;
  create(input: NewRecurringEntry): Promise<RecurringEntry>;
  update(id: string, changes: RecurringEntryChanges): Promise<RecurringEntry>;
  delete(id: string): Promise<void>;
}
