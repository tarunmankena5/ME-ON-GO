import Link from "next/link";
import type { Entry, TaskEntry } from "@/types/entry";
import type { RecurringOccurrence } from "@/types/recurring-entry";
import { formatInTimeZone, isDateOnlyTimestamp } from "@/lib/dates/time-zone";
import { deadlineLabel } from "@/lib/dates/task-state";

type TimelineEntryProps = {
  entry: Entry | RecurringOccurrence;
  timeZone: string;
  onToggleTask: (task: TaskEntry) => void;
  href?: string;
};

function getEntryTime(entry: Entry, timeZone: string): string | null {
  switch (entry.kind) {
    case "ACTIVITY":
      return entry.occurredAt;
    case "TASK":
      return entry.dueAt && !isDateOnlyTimestamp(entry.dueAt, timeZone) ? entry.dueAt : null;
    case "EVENT":
      return entry.startsAt;
  }
}

export function TimelineEntry({ entry, timeZone, onToggleTask, href }: TimelineEntryProps) {
  const recurring = "occurrenceDate" in entry;
  const time = recurring ? null : getEntryTime(entry, timeZone);
  const completed = entry.kind === "TASK" && entry.completedAt !== null;

  return (
    <li className="timeline-entry group relative grid grid-cols-[3.75rem_1.5rem_minmax(0,1fr)] gap-x-3 py-5 sm:grid-cols-[4.5rem_2rem_minmax(0,1fr)] sm:gap-x-4">
      {recurring || entry.kind === "TASK" && entry.dueAt && isDateOnlyTimestamp(entry.dueAt, timeZone) ? (
        <span className="pt-1 text-right font-mono text-[9px] leading-4 tracking-tight text-stone-600 sm:text-[10px]">{recurring ? "ALL DAY" : "DATE ONLY"}</span>
      ) : <time
        className="pt-1 text-right font-mono text-xs tabular-nums text-stone-500 sm:text-sm"
        dateTime={time ?? undefined}
      >
        {time
          ? formatInTimeZone(time, timeZone, {
              hour: "2-digit",
              minute: "2-digit",
              hourCycle: "h23",
            })
          : "— —"}
      </time>}

      <span aria-hidden="true" className="relative flex justify-center">
        <span
          className={`relative z-10 mt-1 h-2 w-2 rounded-full ring-4 ring-[#090a0b] ${completed ? "bg-stone-700" : recurring ? "bg-violet-200/70" : "bg-amber-200/75"}`}
        />
        <span className="timeline-line absolute bottom-[-1.5rem] top-0 w-px bg-white/[0.08]" />
      </span>

      <div className="min-w-0 pb-1">
        <div className="flex items-start justify-between gap-3">
          <Link href={href ?? (recurring ? `/recurring/${entry.id}` : `/entries/${entry.id}?from=today`)} className="min-w-0 flex-1 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200">
            <h3
              className={`break-words text-base font-medium leading-6 tracking-[-0.015em] sm:text-lg ${completed ? "text-stone-500 line-through decoration-stone-700" : "text-stone-100"}`}
            >
              {entry.title}
            </h3>
            {recurring && entry.yearsSince !== null && (
              <p className="mt-1 text-sm leading-5 text-stone-400">{entry.kind === "BIRTHDAY" ? `${entry.yearsSince} years` : `${entry.yearsSince} years`}</p>
            )}
            {entry.kind === "ACTIVITY" && entry.activityType && (
              <p className="mt-1 text-sm leading-5 text-stone-400">{entry.activityType}</p>
            )}
            {entry.kind === "EVENT" && entry.endsAt && (
              <p className="mt-1 text-sm leading-5 text-stone-500">
                Until{" "}
                {formatInTimeZone(entry.endsAt, timeZone, {
                  hour: "2-digit",
                  minute: "2-digit",
                  hourCycle: "h23",
                })}
              </p>
            )}
            {entry.kind === "TASK" && (
              <p className={`mt-1 text-[10px] font-medium uppercase tracking-[0.14em] ${completed ? "text-stone-600" : deadlineLabel(entry, new Date(), timeZone) ? "text-red-200/70" : entry.priority === "HIGH" ? "text-amber-100/80" : "text-stone-500"}`}>
                {completed ? "Completed" : deadlineLabel(entry, new Date(), timeZone) ? `Overdue · ${deadlineLabel(entry, new Date(), timeZone)}` : entry.priority}
                {entry.category ? ` · ${entry.category}` : ""}
              </p>
            )}
            {entry.notes && (
              <p className={`mt-1.5 whitespace-pre-wrap text-sm leading-6 ${completed ? "text-stone-600" : "text-stone-500"}`}>
                {entry.notes}
              </p>
            )}
          </Link>

          {entry.kind === "TASK" && (
            <button
              type="button"
              onClick={() => onToggleTask(entry)}
              aria-label={completed ? `Mark ${entry.title} incomplete` : `Mark ${entry.title} complete`}
              aria-pressed={completed}
              className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-stone-500 transition-colors hover:text-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200 active:bg-white/5"
            >
              <span
                aria-hidden="true"
                className={`flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${completed ? "border-amber-200/50 bg-amber-200/10 text-amber-100" : "border-stone-600 group-hover:border-amber-100/60"}`}
              >
                {completed && (
                  <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3">
                    <path d="m3.5 8.2 2.8 2.8 6.2-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
