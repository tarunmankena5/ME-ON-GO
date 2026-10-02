import type { TrackerTemplate } from "@/types/tracker";

function field(name: string, type: TrackerTemplate["fields"][number]["type"], options: string[] = [], unit: string | null = null, required = false) {
  return { name, type, options, unit, required, active: true } as const;
}

export const TRACKER_TEMPLATES: TrackerTemplate[] = [
  { id: "workout", name: "Workout", description: "A flexible starting point for a workout log.", fields: [field("Exercise", "TEXT", [], null, true), field("Weight", "NUMBER", [], "kg"), field("Sets", "NUMBER"), field("Reps", "NUMBER"), field("Notes", "NOTES")] },
  { id: "running", name: "Running", description: "Keep a simple record of your runs.", fields: [field("Distance", "NUMBER", [], "km", true), field("Duration", "DURATION", [], null, true), field("Notes", "NOTES")] },
  { id: "reading", name: "Reading", description: "Track reading sessions, books, and pages.", fields: [field("Book", "TEXT", [], null, true), field("Pages", "NUMBER"), field("Rating", "RATING"), field("Notes", "NOTES")] },
  { id: "meditation", name: "Meditation", description: "A quiet log for meditation sessions.", fields: [field("Duration", "DURATION", [], null, true), field("Mood", "SELECT", ["Calm", "Focused", "Restless"]), field("Notes", "NOTES")] },
  { id: "sleep", name: "Sleep", description: "Record duration and quality of sleep.", fields: [field("Duration", "DURATION", [], null, true), field("Quality", "RATING"), field("Notes", "NOTES")] },
  { id: "water", name: "Water", description: "Record water intake.", fields: [field("Amount", "NUMBER", [], "ml", true), field("Notes", "NOTES")] },
  { id: "movies-tv", name: "Movies & TV", description: "A personal watch log.", fields: [field("Title", "TEXT", [], null, true), field("Type", "SELECT", ["Movie", "Series", "Episode"]), field("Rating", "RATING"), field("Notes", "NOTES")] },
];
