import type { Entry, TaskEntry } from "@/types/entry";
import type { RecurringOccurrence } from "@/types/recurring-entry";
import { TimelineEntry } from "@/components/entries/timeline-entry";

type EntryTimelineProps = {
  entries: (Entry | RecurringOccurrence)[];
  timeZone: string;
  onToggleTask: (task: TaskEntry) => void;
  label?: string;
  returnHref?: (entry: Entry) => string;
};

export function EntryTimeline({
  entries,
  timeZone,
  onToggleTask,
  label = "Today's timeline",
  returnHref,
}: EntryTimelineProps) {
  return (
    <ol aria-label={label} className="relative">
      {entries.map((entry) => (
        <TimelineEntry
          key={entry.id}
          entry={entry}
          timeZone={timeZone}
          onToggleTask={onToggleTask}
          href={"occurrenceDate" in entry ? `/recurring/${entry.id}` : returnHref?.(entry)}
        />
      ))}
    </ol>
  );
}
