import { getDataMode } from "@/lib/config/data-mode";
import { LocalDemoRecurringEntryRepository } from "@/lib/data/local-demo-recurring-entry-repository";
import type { RecurringEntryRepository } from "@/lib/data/recurring-entry-repository";

export function createRecurringEntryRepository(): RecurringEntryRepository {
  if (getDataMode() === "demo") return new LocalDemoRecurringEntryRepository();
  throw new Error("Supabase recurring-entry access is not connected yet. Keep LIFELOG_DATA_MODE=demo until a project is configured.");
}
