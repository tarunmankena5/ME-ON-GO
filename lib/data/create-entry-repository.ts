import { getDataMode } from "@/lib/config/data-mode";
import { LocalDemoEntryRepository } from "@/lib/data/local-demo-entry-repository";
import type { EntryRepository } from "@/lib/data/entry-repository";

export function createEntryRepository(): EntryRepository {
  if (getDataMode() === "demo") {
    return new LocalDemoEntryRepository();
  }

  throw new Error(
    "Supabase data access is not connected yet. Keep LIFELOG_DATA_MODE=demo until a project is configured.",
  );
}
