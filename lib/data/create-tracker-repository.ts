import { getDataMode } from "@/lib/config/data-mode";
import { LocalDemoTrackerRepository } from "@/lib/data/local-demo-tracker-repository";
import type { TrackerRepository } from "@/lib/data/tracker-repository";

export function createTrackerRepository(): TrackerRepository {
  if (getDataMode() === "demo") return new LocalDemoTrackerRepository();
  throw new Error("Supabase tracker access is not connected yet. Keep LIFELOG_DATA_MODE=demo until a project is configured.");
}
